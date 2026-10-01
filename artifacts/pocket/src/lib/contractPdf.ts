// Downloads a contract's PDF (GET /api/contracts/:id/pdf, which needs the app's token, so a plain link will not do): the draft preview or the
// executed copy. It goes to the phone's share sheet; on the web it is saved as a file. Not covered by node tests (native modules).
import { Platform } from "react-native";
import { API_ORIGIN } from "./session";
import { ApiFailure } from "./api";

export async function downloadContractPdf(id: string, number: string): Promise<void> {
  let res: Response;
  try { res = await fetch(`${API_ORIGIN}/api/contracts/${encodeURIComponent(id)}/pdf?download=1`); } catch { throw new ApiFailure(0, undefined, "offline"); }
  if (!res.ok) throw new ApiFailure(res.status, undefined, `HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `${number || "contract"}.pdf`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: name });
}
