import { Link } from "wouter";
import { SearchX, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <PublicLayout>
      <SeoHead
        title={t("notFound.title")}
        description={t("notFound.description")}
        canonical=""
        noIndex={true}
      />

      <div className="wrap" style={{ maxWidth: 620, paddingBlock: "clamp(64px, 10vw, 120px)", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 24px",
            background: "var(--soft)",
            color: "var(--navy)",
          }}
        >
          <SearchX className="h-7 w-7" />
        </div>
        <p className="eyebrow" style={{ justifyContent: "center", display: "flex" }}>404</p>
        <h1 className="h2" style={{ marginBottom: 14 }}>{t("notFound.heading")}</h1>
        <p className="lead" style={{ margin: "0 auto 32px" }}>{t("notFound.body")}</p>
        <Link href="/" className="btn btn-navy">
          {t("errorBoundary.backHome")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicLayout>
  );
}
