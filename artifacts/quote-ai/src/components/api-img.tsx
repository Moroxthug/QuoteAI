import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { isNativeApp } from "@/lib/native/env";

// Phase 118: an image the API serves only to a signed-in person (job photos,
// receipts, avatars, the company logo). The website's <img> carries the session
// cookie; the phone app has no cookie — it signs in with a bearer token, which
// an <img> cannot send — so there the image is fetched (through the app's
// fetch, token included) and shown from memory. Everywhere else: a plain <img>.

const cache = new Map<string, Promise<string>>();
const MAX = 150;

function needsFetch(src: string): boolean {
  return src.startsWith("/api/");
}

function load(src: string): Promise<string> {
  let hit = cache.get(src);
  if (hit) {
    cache.delete(src);
    cache.set(src, hit);
    return hit;
  }
  hit = fetch(src).then(async (r) => {
    if (!r.ok) throw new Error(String(r.status));
    return URL.createObjectURL(await r.blob());
  });
  hit.catch(() => cache.delete(src));
  cache.set(src, hit);
  if (cache.size > MAX) {
    const [oldest, url] = cache.entries().next().value as [string, Promise<string>];
    cache.delete(oldest);
    void url.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  return hit;
}

function NativeApiImg({ src, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [shown, setShown] = useState<{ src: string; url: string } | null>(null);
  const failed = useRef(onError);
  failed.current = onError;
  useEffect(() => {
    let live = true;
    load(src).then(
      (url) => { if (live) setShown({ src, url }); },
      () => { if (live) failed.current?.({} as never); },
    );
    return () => { live = false; };
  }, [src]);
  // Same box while it loads, so nothing shifts.
  return <img {...rest} src={shown?.src === src ? shown.url : undefined} onError={onError} />;
}

export function ApiImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  if (isNativeApp && typeof src === "string" && needsFetch(src)) return <NativeApiImg src={src} {...rest} />;
  return <img src={src} {...rest} />;
}
