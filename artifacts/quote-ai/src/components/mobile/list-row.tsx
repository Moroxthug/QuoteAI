import { Fragment, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { rowLink } from "@/lib/row-link";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { cn } from "@/lib/utils";
import type { SheetAction } from "./action-sheet";
import { RowMore } from "./row-more";
import { useProgressiveList } from "@/hooks/use-progressive-list";

/**
 * Phase 100 — one row of a phone list (docs/MOBILE-RULES.md rule 4): a strong
 * line (client / title), a quiet line (date · status), the amount and a chip
 * on the right. A link when given `href`, a button with `onClick`, else static.
 */
export function ListRow({
  title,
  meta,
  below,
  amount,
  end,
  lead,
  href,
  onClick,
  chevron,
  className,
}: {
  title: ReactNode;
  /** Pieces of the quiet line; empty ones are dropped, the rest joined by " · ". */
  meta?: ReactNode | ReactNode[];
  /** Under the quiet line (a progress bar). */
  below?: ReactNode;
  amount?: ReactNode;
  /** Under the amount (a status chip), or alone on the right. */
  end?: ReactNode;
  /** Before the text (an avatar, an icon tile). */
  lead?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Show a › at the end (on by default for links). */
  chevron?: boolean;
  className?: string;
}) {
  // Phase 115: a link row starts loading its screen when pressed (usePrefetchOnPress).
  const press = usePrefetchOnPress();
  const parts = (Array.isArray(meta) ? meta : [meta]).filter((m) => m !== null && m !== undefined && m !== false && m !== "");
  const body = (
    <>
      {lead && <span className="lrow-lead">{lead}</span>}
      <span className="lrow-main">
        <span className="lrow-title">{title}</span>
        {parts.length > 0 && (
          <span className="lrow-meta">
            {parts.map((p, i) => (
              <Fragment key={i}>{i > 0 && " · "}{p}</Fragment>
            ))}
          </span>
        )}
        {below && <span className="lrow-below">{below}</span>}
      </span>
      {(amount !== undefined || end) && (
        <span className="lrow-end">
          {amount !== undefined && <span className="lrow-amt">{amount}</span>}
          {end}
        </span>
      )}
      {(chevron ?? !!href) && <ChevronRight className="lrow-chev" aria-hidden="true" />}
    </>
  );
  if (href) return <Link href={href} className={cn("lrow", className)} {...press(href)}>{body}</Link>;
  if (onClick) return <button type="button" className={cn("lrow", className)} onClick={onClick}>{body}</button>;
  return <div className={cn("lrow", className)}>{body}</div>;
}

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /**
   * Where the column lands in the phone row: before the text (`lead`, an
   * avatar or a checkbox), the strong line (`title`, the first one wins), the
   * quiet line (`meta`, in order), the right side (`amount`, then `end` under
   * it), or not at all (`hidden`, the default for anything unmarked — say
   * what a phone needs, don't inherit a desktop).
   */
  mobile?: "lead" | "title" | "meta" | "amount" | "end" | "hidden";
};

/**
 * Phase 100 — one column definition, two layouts: the `.tbl` table from
 * 640 px up, `ListRow`s below it. No horizontal scrolling for data on a phone.
 *
 * Phase 110: `rowActions` gives each phone row its own ⋯ (`RowMore`) for
 * what the desktop row does with its buttons — mark that button column
 * `hidden`; `rowClassName` dims a row (inactive) or bolds it (a total).
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  getKey,
  rowHref,
  rowActions,
  rowActionsLabel,
  rowClassName,
  label,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  rowHref?: (row: T) => string;
  /** Phone only: the row's actions as a ⋯ sheet. */
  rowActions?: (row: T) => Array<SheetAction | false | null | undefined>;
  /** Names that ⋯ ("Actions for Pat Worker"). */
  rowActionsLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  /** Names the table (and the list) for a screen reader. */
  label: string;
  empty?: ReactNode;
}) {
  const phone = useMediaQuery("(max-width: 639.98px)");
  const [, navigate] = useLocation();
  const press = usePrefetchOnPress();
  // Phase 115: long lists render their first rows now and the rest when the browser is idle.
  const shown = useProgressiveList(rows);
  if (rows.length === 0 && empty) return <>{empty}</>;

  if (phone) {
    const lead = columns.find((c) => c.mobile === "lead");
    const title = columns.find((c) => c.mobile === "title") ?? columns[0]!;
    const metas = columns.filter((c) => c.mobile === "meta");
    const amount = columns.find((c) => c.mobile === "amount");
    const end = columns.find((c) => c.mobile === "end");
    return (
      <ul className="lrows" aria-label={label}>
        {shown.map((row) => {
          const actions = rowActions?.(row).filter(Boolean) ?? [];
          const item = (
            <ListRow
              lead={lead?.cell(row)}
              title={title.cell(row)}
              meta={metas.map((c) => c.cell(row))}
              amount={amount?.cell(row)}
              end={end?.cell(row)}
              href={rowHref?.(row)}
              className={rowClassName?.(row)}
            />
          );
          return actions.length ? (
            <li key={getKey(row)} className="lrow-split">
              {item}
              <RowMore actions={actions} label={rowActionsLabel?.(row)} />
            </li>
          ) : (
            <li key={getKey(row)}>{item}</li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="tbl-wrap">
      <table className="tbl" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const href = rowHref?.(row);
            const link = href ? rowLink(() => navigate(href)) : null;
            return (
              <tr key={getKey(row)} {...link} {...press(href)} className={cn(link?.className, rowClassName?.(row)) || undefined}>
                {columns.map((c) => (
                  <td key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>{c.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
