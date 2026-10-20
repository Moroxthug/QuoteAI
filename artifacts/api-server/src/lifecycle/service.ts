// Phase 134: the lifecycle email runner. Called from the cron tick (guarded, at most once an hour) and from /api/cron/lifecycle.
// Nothing is sent unless LIFECYCLE_EMAILS_ENABLED=1. LIFECYCLE_DRY_RUN=1 logs what WOULD be sent and records nothing.

import { sql, inArray } from "drizzle-orm";
import { db, lifecycleSendsTable, effectivePlan, type FeatureFlags } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { brandedResend } from "../lib/emailUtils.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { allowanceOf, freeQuotesLimit } from "../lib/freeQuotes.js";
import { currentLaunchOffer } from "../lib/launchPrice.js";
import { timeZoneForProvince } from "../jobs/dates.js";
import { TEST_EMAIL_SUFFIX, TEST_USER_PREFIXES, isTestAccount } from "../hq/testAccounts.js";
import { dueMessages, type LifecycleKey, type LifecycleState } from "./rules.js";
import { buildLifecycleEmail, type LaunchOfferInfo } from "./content.js";
import { unsubscribeToken, unsubscribeUrl } from "./token.js";

export const LIFECYCLE_FROM = "QuoteAI <no-reply@quoteai.ca>";
export const LIFECYCLE_REPLY_TO = "support@quoteai.ca";
/** Only people who signed up this recently are considered. */
export const CANDIDATE_WINDOW_DAYS = 60;
const DEFAULT_LIMIT = 500;

export const lifecycleEnabled = (): boolean => process.env.LIFECYCLE_EMAILS_ENABLED === "1";
export const lifecycleDryRun = (): boolean => process.env.LIFECYCLE_DRY_RUN === "1";

export type LifecycleRunResult = {
  ran: boolean;
  reason?: "disabled" | "too_soon" | "no_secret";
  dryRun: boolean;
  considered: number;
  due: number;
  sent: number;
  failed: number;
  byKey: Record<string, number>;
};

const emptyResult = (dryRun: boolean, reason?: LifecycleRunResult["reason"]): LifecycleRunResult => ({ ran: false, reason, dryRun, considered: 0, due: 0, sent: 0, failed: 0, byKey: {} });

type CandidateRow = {
  id: string;
  email: string;
  name: string | null;
  signup_ms: string | number;
  province: string | null;
  doc_language: string | null;
  pref_language: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  feature_flags: FeatureFlags | null;
  quote_count: string | number;
  sent_count: string | number;
  first_quote_ms: string | number | null;
  last_quote_ms: string | number | null;
  last_session_ms: string | number | null;
};

/**
 * One query: people who signed up in the window with a verified address, not opted out, not test accounts, with their counts.
 * Quote and session aggregates are correlated subqueries on indexed user_id columns, so the cost follows the candidate count (capped by `limit`).
 */
async function loadCandidates(now: Date, limit: number): Promise<CandidateRow[]> {
  const since = new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * 24 * 3_600_000);
  const prefixConds = TEST_USER_PREFIXES.map((p) => sql`u.id not like ${p + "%"}`);
  const result = await db.execute<CandidateRow>(sql`
    select u.id, u.email, u.name,
      extract(epoch from u.created_at) * 1000 as signup_ms,
      bp.province, bp.doc_language, bp.subscription_plan, bp.subscription_status, bp.feature_flags,
      (select mp.prefs ->> 'language' from member_preferences mp where mp.user_id = u.id and mp.member_user_id = u.id limit 1) as pref_language,
      (select count(*) from quotes q where q.user_id = u.id) as quote_count,
      (select count(*) from quotes q where q.user_id = u.id and q.sent_at is not null) as sent_count,
      (select extract(epoch from min(q.created_at)) * 1000 from quotes q where q.user_id = u.id) as first_quote_ms,
      (select extract(epoch from max(q.created_at)) * 1000 from quotes q where q.user_id = u.id) as last_quote_ms,
      (select extract(epoch from max(s.updated_at)) * 1000 from auth_session s where s.user_id = u.id) as last_session_ms
    from auth_user u
    join business_profiles bp on bp.user_id = u.id
    where u.created_at >= ${since}
      and u.email_verified
      and not bp.marketing_emails_opt_out
      and ${sql.join(prefixConds, sql` and `)}
      and lower(u.email) not like ${"%" + TEST_EMAIL_SUFFIX}
    order by u.created_at asc
    limit ${limit}`);
  return result.rows as unknown as CandidateRow[];
}

const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const date = (v: string | number | null | undefined): Date | null => (v === null || v === undefined ? null : new Date(Number(v)));

export function stateFor(row: CandidateRow, sends: { messageKey: string; sentAt: Date }[]): LifecycleState {
  const signupAt = new Date(num(row.signup_ms));
  const quoteCount = num(row.quote_count);
  const paid = effectivePlan({ subscriptionPlan: row.subscription_plan, subscriptionStatus: row.subscription_status, featureFlags: row.feature_flags }) !== "free";
  const allowance = allowanceOf({ paid, used: quoteCount, limit: freeQuotesLimit(), enforced: false });
  const activity = [signupAt, date(row.last_quote_ms), date(row.last_session_ms)].filter((d): d is Date => d !== null);
  const lastActivityAt = new Date(Math.max(...activity.map((d) => d.getTime())));
  const lastSentAt = sends.length ? new Date(Math.max(...sends.map((s) => s.sentAt.getTime()))) : null;
  const lang = row.pref_language === "fr" || row.pref_language === "en" ? row.pref_language : row.doc_language === "fr" ? "fr" : "en";
  return {
    signupAt,
    quoteCount,
    sentQuoteCount: num(row.sent_count),
    firstQuoteAt: date(row.first_quote_ms),
    paid,
    freeLeft: allowance.left,
    lastActivityAt,
    lang,
    timeZone: timeZoneForProvince(row.province),
    sentKeys: sends.map((s) => s.messageKey),
    lastSentAt,
    optedOut: false, // filtered in SQL
    testAccount: isTestAccount(row.id, row.email),
  };
}

let lastRunAt = 0;

/** The cron entry point: does nothing unless switched on, and runs at most once an hour. Never throws. */
export async function runLifecycleIfDue(now: Date = new Date()): Promise<LifecycleRunResult> {
  const dryRun = lifecycleDryRun();
  if (!lifecycleEnabled() && !dryRun) return emptyResult(false, "disabled");
  if (now.getTime() - lastRunAt < 3_600_000) return emptyResult(dryRun, "too_soon");
  lastRunAt = now.getTime();
  try {
    return await runLifecycle(now, { dryRun });
  } catch (err) {
    logger.error({ err }, "Lifecycle run failed");
    return { ...emptyResult(dryRun), failed: 1 };
  }
}

export async function runLifecycle(now: Date, opts: { dryRun?: boolean; limit?: number } = {}): Promise<LifecycleRunResult> {
  const dryRun = opts.dryRun ?? lifecycleDryRun();
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_LIMIT, 5000));
  const result: LifecycleRunResult = { ran: true, dryRun, considered: 0, due: 0, sent: 0, failed: 0, byKey: {} };

  const apiKey = process.env.RESEND_API_KEY;
  if (!dryRun && !apiKey) {
    logger.warn("RESEND_API_KEY not set: lifecycle emails not sent");
    return { ...result, ran: false, reason: "disabled" };
  }
  if (unsubscribeToken("probe") === null) {
    logger.warn("No signing secret: lifecycle emails not sent");
    return { ...result, ran: false, reason: "no_secret" };
  }

  const rows = await loadCandidates(now, limit);
  result.considered = rows.length;
  if (rows.length === 0) return result;

  const sendRows = await db
    .select({ userId: lifecycleSendsTable.userId, messageKey: lifecycleSendsTable.messageKey, sentAt: lifecycleSendsTable.sentAt })
    .from(lifecycleSendsTable)
    .where(inArray(lifecycleSendsTable.userId, rows.map((r) => r.id)));
  const sendsByUser = new Map<string, { messageKey: string; sentAt: Date }[]>();
  for (const s of sendRows) sendsByUser.set(s.userId, [...(sendsByUser.get(s.userId) ?? []), s]);

  let offer: LaunchOfferInfo | null = null;
  try {
    const o = await currentLaunchOffer();
    offer = { active: o.active, launchPriceCents: o.launchPriceCents, remaining: o.remaining };
  } catch (err) {
    logger.warn({ err }, "Lifecycle: launch offer unavailable; emails will not mention a price");
  }

  const baseUrl = getBaseUrl();
  const resend = !dryRun && apiKey ? brandedResend(apiKey) : null;

  for (const row of rows) {
    try {
      const state = stateFor(row, sendsByUser.get(row.id) ?? []);
      const key: LifecycleKey | null = dueMessages(state, now);
      if (!key) continue;
      result.due += 1;
      if (dryRun) {
        logger.info({ userId: row.id, key, lang: state.lang }, "Lifecycle dry run: would send");
        result.byKey[key] = (result.byKey[key] ?? 0) + 1;
        continue;
      }

      // Reserve first: the unique (user_id, message_key) row is what makes "at most once, ever" true even if two runs overlap.
      const reserved = await db.insert(lifecycleSendsTable).values({ userId: row.id, messageKey: key, sentAt: now }).onConflictDoNothing().returning({ id: lifecycleSendsTable.id });
      if (reserved.length === 0) continue;
      const reservationId = reserved[0]!.id;

      try {
        const token = unsubscribeToken(row.id)!;
        const unsubUrl = unsubscribeUrl(baseUrl, token);
        const mail = buildLifecycleEmail({ key, lang: state.lang, name: row.name ?? "", baseUrl, unsubscribeUrl: unsubUrl, freeLimit: freeQuotesLimit(), offer });
        const res = await resend!.emails.send({
          from: LIFECYCLE_FROM,
          to: [row.email],
          replyTo: LIFECYCLE_REPLY_TO,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.id) await db.update(lifecycleSendsTable).set({ providerId: res.data.id }).where(sql`${lifecycleSendsTable.id} = ${reservationId}`);
        result.sent += 1;
        result.byKey[key] = (result.byKey[key] ?? 0) + 1;
      } catch (err) {
        // Not delivered: free the reservation so a later run can try again.
        await db.delete(lifecycleSendsTable).where(sql`${lifecycleSendsTable.id} = ${reservationId}`).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      result.failed += 1;
      logger.error({ err, userId: row.id }, "Lifecycle email failed for one user");
    }
  }
  logger.info({ ...result }, "Lifecycle run finished");
  return result;
}

/** Test seam: forget the hourly guard. */
export function resetLifecycleGuard(): void {
  lastRunAt = 0;
}
