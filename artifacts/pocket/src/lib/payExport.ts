// Downloads the pay period's file for the payroll provider (GET /api/pay/export.csv, which needs the app's token, so a plain link will not do; the
// server records who exported what) and hands it to the phone's share sheet; on the web it is saved as a file. Not covered by node tests (native modules).
import { Platform } from "react-native";
import { API_ORIGIN } from "./session";
import { ApiFailure } from "./api";
import { payApi } from "./payApi";
import type { PayFormat } from "./pay";

export async function exportPayPeriod(date: string, format: PayFormat): Promise<string> {
  let res: Response;
  try { res = await fetch(`${API_ORIGIN}${payApi.exportPath(date, format)}`); } catch { throw new ApiFailure(0, undefined, "offline"); }
  if (!res.ok) throw new ApiFailure(res.status, undefined, `HTTP ${res.status}`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `pay-${format}-${date}.csv`;
  const text = await res.text();
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return name;
  }
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: name });
  return name;
}
