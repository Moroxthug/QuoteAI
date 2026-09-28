import { useEffect } from "react";
import { useLocation } from "wouter";
import { opensHome } from "@/lib/native/routes";

/**
 * Phase 118: the phone app reached a page that is not part of the app (the
 * Terms and Privacy links on sign-up, a help link, a client's quote link). It
 * opens on the website in an in-app browser tab and the app stays where it
 * was; the homepage just means the app's home.
 */
export function NativeOutside({ path }: { path: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (opensHome(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    void import("@/lib/native/shell").then((m) => m.openOnWebsite(path)).catch(() => {});
    if (window.history.length > 1) window.history.back();
    else navigate("/dashboard", { replace: true });
  }, [path, navigate]);
  return null;
}
