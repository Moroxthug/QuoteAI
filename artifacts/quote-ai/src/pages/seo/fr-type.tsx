// /fr/soumissions/:type: the shared trade page plus the hand-written French
// copy. Kept in its own chunk so English trade pages don't download ~200 kB
// of French text (fr-trade-pages.ts).
import SeoLanding from "./[type]";
import { FR_TRADE_PAGES } from "@/data/fr-trade-pages";

export default function SeoLandingFr() {
  return <SeoLanding frPages={FR_TRADE_PAGES} />;
}
