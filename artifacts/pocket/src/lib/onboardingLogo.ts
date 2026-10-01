// The logo picker's native half. Picking a photo needs expo-image-picker, which is not installed
// (it needs a dev-client rebuild), so for now this reports "not available yet" and never throws.
// TODO(native): when expo-image-picker is added, launch the library here (images only, max 2 MB,
// PNG / JPG / SVG as the web app allows), return { ok: true, uri, name, type } and upload with
// useUploadBusinessProfileLogo (POST /api/business-profile/logo, multipart field "logo").
export type LogoPick = { ok: true; uri: string; name: string; type: string } | { ok: false; reason: "unavailable" | "cancelled" };

export async function pickLogo(): Promise<LogoPick> {
  return { ok: false, reason: "unavailable" };
}
