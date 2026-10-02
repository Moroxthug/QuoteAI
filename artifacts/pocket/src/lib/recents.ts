// "Recently opened" on Search: a quote, client, job or invoice is remembered on the phone when its screen is opened, so the search box can offer it again.
import { useEffect } from "react";
import { kvGet, kvSet } from "./kv";
import { addOpened, isOpened, parseList, type Opened } from "./search";

export const OPENED_KEY = "quoteai_recently_opened";

export async function rememberOpened(o: Opened): Promise<void> {
  const list = addOpened(parseList(await kvGet(OPENED_KEY), isOpened), o);
  await kvSet(OPENED_KEY, JSON.stringify(list));
}

/** Call from a detail screen with the record once it has loaded (null until then): it is remembered once per visit. */
export function useRememberOpened(o: Opened | null): void {
  const key = o ? `${o.type}:${o.id}:${o.title}:${o.sub}` : "";
  useEffect(() => {
    if (o && o.title) void rememberOpened(o);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
