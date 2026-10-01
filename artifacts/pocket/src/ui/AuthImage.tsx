// An image the server only gives to the signed-in company (a job photo): the phone sends the bearer token and the acting company with the
// request; the web fetches it with them and shows the bytes. Until it arrives (or if it doesn't) the `fallback` shows.
import { useEffect, useState, type ReactNode } from "react";
import { Image, Platform, type ImageStyle, type StyleProp } from "react-native";
import { getActiveOrg, getToken } from "@/lib/session";

export function AuthImage({ uri, style, fallback, label }: { uri: string; style?: StyleProp<ImageStyle>; fallback?: ReactNode; label?: string }) {
  const [src, setSrc] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let object: string | null = null;
    setSrc(null);
    setFailed(false);
    void (async () => {
      const [token, org] = await Promise.all([getToken(), getActiveOrg()]);
      const headers: Record<string, string> = { ...(token ? { authorization: `Bearer ${token}` } : null), ...(org ? { "x-active-org": org } : null) };
      if (Platform.OS !== "web") {
        if (live) setSrc({ uri, headers });
        return;
      }
      try {
        const res = await fetch(uri, { headers });
        if (!res.ok) throw new Error(String(res.status));
        object = URL.createObjectURL(await res.blob());
        if (live) setSrc({ uri: object });
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; if (object) URL.revokeObjectURL(object); };
  }, [uri]);

  if (!src || failed) return <>{fallback ?? null}</>;
  return <Image source={src} style={style} resizeMode="cover" accessibilityLabel={label} onError={() => setFailed(true)} />;
}
