// /quotes/:type: the shared trade page plus the hand-written English copy
// (en-trade-pages.ts), kept in its own chunk like fr-type.tsx so French pages
// don't download it.
import SeoLanding from "./[type]";
import { EN_TRADE_PAGES } from "@/data/en-trade-pages";

export default function SeoLandingEn() {
  return <SeoLanding pages={EN_TRADE_PAGES} />;
}
