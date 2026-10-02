// The server's Needs you rows as the cards SmartHome draws (shared by Home and a role's home).
import { Linking } from "react-native";
import { router } from "expo-router";
import { money, type Locale } from "@/lib/format";
import { telHref, type NeedsCard } from "@/lib/home";
import { homeApi } from "@/lib/homeApi";
import { screenHref } from "@/lib/nav";
import type { NeedsCardData } from "@/ui/NeedsYou";

/** The server's row as the card the board draws. */
export function cardView(c: NeedsCard, t: (k: string, o?: Record<string, unknown>) => string, locale: Locale, toast: (m: { message: string }) => void, refresh: () => void): NeedsCardData {
  const i = c.item;
  const amount = i.amountCents != null ? money(i.amountCents / 100, locale) : "";
  const common = { id: c.id };
  const act = c.action;
  const open = (screen: string, title: string, params?: Record<string, string>) => router.push(screenHref(screen, title, params));
  const run = async (): Promise<boolean | void> => {
    if (act.type === "remind") {
      try { await homeApi.remind(act.invoiceId); refresh(); return true; } catch { toast({ message: t("home.needs.remindFailed") }); return false; }
    }
    if (act.type === "call") { void Linking.openURL(telHref(act.phone)); return; }
    const titles: Record<string, string> = { Invoice: t("menu.rows.invoices.label"), Quote: t("quotes.actions.openQuote"), Leads: t("menu.rows.leads.label"), Job: t("menu.rows.crew.label"), Timesheets: t("menu.rows.timesheets.label") };
    open(act.screen, titles[act.screen] ?? "", act.id ? { id: act.id } : undefined);
  };
  switch (c.kind) {
    case "hours":
      return { ...common, icon: "clock", tone: "sage", title: t("home.needs.hours.title", { hours: i.hours ?? 0 }), sub: t("home.needs.hours.sub", { count: i.count ?? 0, people: i.people ?? 0 }), status: { tone: "warn", shape: "clock", word: t("home.needs.hours.status") }, button: t("home.needs.hours.button"), doneLabel: t("home.needs.hours.done"), onAct: run };
    case "etransfer":
      return { ...common, icon: "bank", tone: "gold", title: t("home.needs.etransfer.title", { amount }), sub: t("home.needs.etransfer.sub", { customer: i.subtitle, number: i.title }), status: { tone: "ok", shape: "check", word: t("home.needs.etransfer.status") }, button: t("home.needs.etransfer.button"), doneLabel: t("home.needs.etransfer.done"), onAct: run };
    case "remind":
      return { ...common, icon: "receipt", tone: "clay", title: t("home.needs.remind.title", { customer: i.subtitle || i.title }), sub: t("home.needs.remind.sub", { number: i.title, amount }), status: { tone: "bad", shape: "alert", word: t("home.needs.remind.status", { count: i.days ?? 0 }) }, button: t("home.needs.remind.button"), doneLabel: t("home.needs.remind.done"), onAct: run };
    case "lead": {
      const call = act.type === "call";
      return { ...common, icon: "chat", tone: "azure", title: t(call ? "home.needs.lead.titleCall" : "home.needs.lead.titleOpen", { name: i.title }), sub: i.subtitle || t("home.needs.lead.sub"), status: { tone: "acc", shape: "dot", word: t("home.needs.lead.status") }, button: t(call ? "home.needs.lead.button" : "home.needs.lead.buttonOpen"), doneLabel: t("home.needs.lead.done"), onAct: run };
    }
    case "blocker": {
      const [who, ...rest] = i.subtitle.split(" — ");
      return { ...common, icon: "cone", tone: "amber", title: rest.length ? t("home.needs.blocker.title", { who }) : t("home.needs.blocker.titleNoName"), sub: rest.length ? rest.join(" — ") : i.subtitle, status: { tone: "info", shape: "dot", word: t("home.needs.blocker.status", { job: i.title }) }, button: t("home.needs.blocker.button"), doneLabel: t("home.needs.blocker.done"), onAct: run };
    }
    case "waiting": {
      const call = act.type === "call";
      return { ...common, icon: "send", tone: "violet", title: t(call ? "home.needs.waiting.titleCall" : "home.needs.waiting.titleOpen", { name: i.title }), sub: t("home.needs.waiting.sub", { job: i.subtitle || i.title, amount }), status: { tone: "info", shape: "q1", word: t("home.needs.waiting.status", { count: i.days ?? 0 }) }, button: t(call ? "home.needs.waiting.button" : "home.needs.waiting.buttonOpen"), doneLabel: t("home.needs.waiting.done"), onAct: run };
    }
  }
}

