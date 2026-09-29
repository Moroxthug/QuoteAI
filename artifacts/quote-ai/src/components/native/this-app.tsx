import { Wifi } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { setPhotosOnWifiOnly, useDataSaver } from "@/lib/offline/data-saver";
import { BiometricRow } from "./app-lock";

// More → This app (the phone app only, its own chunk): what is set for this
// phone rather than for the account — fingerprint / face unlock (Phase 121)
// and, Phase 122, photos on Wi-Fi only.

function WifiPhotosRow() {
  const { t } = useLanguage();
  const { wifiOnly } = useDataSaver();
  return (
    <button type="button" className="more-row" role="switch" aria-checked={wifiOnly} aria-labelledby="this-app-wifi" aria-describedby="this-app-wifi-sub" onClick={() => setPhotosOnWifiOnly(!wifiOnly)} data-wifi-photos-row="">
      <Wifi aria-hidden="true" />
      <span className="more-row-label">
        <span id="this-app-wifi">{t("thisApp.wifiPhotos")}</span>
        <span id="this-app-wifi-sub" className="more-row-sub">{t("thisApp.wifiPhotosSub")}</span>
      </span>
      <span className={wifiOnly ? "more-switch on" : "more-switch"} aria-hidden="true" />
    </button>
  );
}

export function ThisAppGroup() {
  const { t } = useLanguage();
  return (
    <section className="more-group" aria-labelledby="more-g-app">
      <h3 id="more-g-app">{t("firstRun.bio.thisApp")}</h3>
      <div className="more-card">
        <BiometricRow />
        <WifiPhotosRow />
      </div>
    </section>
  );
}
