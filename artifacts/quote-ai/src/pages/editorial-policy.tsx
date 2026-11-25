// SEO-RECOVERY-PLAN S5.3: how the guides, articles and calculators are
// researched, sourced, dated and corrected. /editorial-policy/ and
// /fr/politique-editoriale/. Every article and French guide links here from
// its byline. Keep it true to how the content is actually made.
import { Link } from "wouter";
import { SeoHead } from "@/components/seo-head";
import { BASE_URL, breadcrumbJsonLd } from "@/data/json-ld";
import { EDITORIAL_PATHS } from "@/data/seo-slugs";

type Lang = "en" | "fr";

const UPDATED = "2026-11-25";

const COPY: Record<Lang, {
  title: string; description: string; home: string; h1: string; lead: string;
  sections: ReadonlyArray<{ h2: string; paras?: readonly string[]; list?: readonly string[] }>;
  updated: string; contact: string;
}> = {
  en: {
    title: "Editorial policy: how our guides are sourced | quoteai",
    description: "How quoteai writes, sources, dates and corrects its guides, articles and calculators for Canadian contractors, and how to report an error.",
    home: "Home",
    h1: "Editorial policy",
    lead: "How the guides, articles and free calculators on quoteai.ca are researched, checked, dated and corrected.",
    sections: [
      {
        h2: "Who writes them",
        paras: [
          "Articles and guides are published by the quoteai editorial team, the people who build the product. They are written for contractors who run their own business: owner-operators, small crews and the office staff who quote for them. They are not written for homeowners shopping for a price.",
          "Drafts are researched and written with the help of AI writing tools. A draft is not published until every rule, rate, threshold and deadline in it has been checked against the official source, as described below.",
        ],
      },
      {
        h2: "Sources",
        list: [
          "Rules, rates, thresholds and deadlines come from the body that sets them: the Canada Revenue Agency, Revenu Québec, provincial and federal statutes and regulations, licensing bodies (for example the RBQ), consumer-protection offices, workers' compensation boards and municipal sites.",
          "Each source is opened and read before it is cited, and linked on the claim it supports, so you can check it yourself. If a fact can't be confirmed on an official page, it is left out.",
          "Market prices are given only when a public body or a named industry association publishes them. Otherwise the article explains what drives the price instead of guessing a range.",
          "Numbers in a sample quote, schedule or worked example are illustrations. They are labelled as examples, and the arithmetic is checked to the cent.",
          "We don't publish invented statistics, surveys or claims about what \"most contractors\" do.",
        ],
      },
      {
        h2: "Dates and updates",
        list: [
          "Every article shows the date it was last checked. That date is also in the page's structured data.",
          "Tax rates, thresholds and program amounts change, often on 1 January or after a budget. Articles are reviewed when a rule they rely on changes. Announced changes are described with their effective date.",
          "The calculators read the same tax-rate table the product uses for quotes and invoices, so a rate change reaches both at once. Their arithmetic is covered by automated tests.",
        ],
      },
      {
        h2: "Product mentions and comparisons",
        list: [
          "Articles mention quoteai briefly and only for what it actually does. Where the product doesn't do something, the article says so.",
          "Comparison pages use each company's own published prices and features, with the date they were checked. A fact we can't confirm is shown as \"Not confirmed\", never as \"No\".",
          "No article contains paid placements, sponsored content or affiliate links.",
        ],
      },
      {
        h2: "Not legal or tax advice",
        paras: [
          "Guides explain public rules in plain language at the date shown. They are general information, not legal, tax or accounting advice. For your own situation, check with the authority concerned, your accountant or a lawyer.",
        ],
      },
      {
        h2: "Corrections",
        paras: [
          "If you find an error, an outdated rule or a broken source, write to info@quoteai.ca with the page address. We check it against the source, correct the page and update its date.",
        ],
      },
    ],
    updated: "Last updated",
    contact: "Report an error",
  },
  fr: {
    title: "Politique éditoriale : nos sources et nos méthodes | quoteai",
    description: "Comment quoteai rédige, vérifie, date et corrige ses guides, articles et calculateurs pour les entrepreneurs, et comment signaler une erreur.",
    home: "Accueil",
    h1: "Politique éditoriale",
    lead: "Comment les guides, articles et calculateurs gratuits de quoteai.ca sont recherchés, vérifiés, datés et corrigés.",
    sections: [
      {
        h2: "Qui les rédige",
        paras: [
          "Les articles et guides sont publiés par l'équipe éditoriale de quoteai, les personnes qui conçoivent le produit. Ils s'adressent aux entrepreneurs qui gèrent leur propre entreprise : entrepreneurs autonomes, petites équipes et personnel de bureau qui prépare les soumissions. Ils ne visent pas les particuliers qui magasinent un prix.",
          "Les brouillons sont recherchés et rédigés avec l'aide d'outils de rédaction par IA. Aucun texte n'est publié avant que chaque règle, taux, seuil et délai n'ait été vérifié à la source officielle, comme décrit ci-dessous.",
        ],
      },
      {
        h2: "Sources",
        list: [
          "Les règles, taux, seuils et délais viennent de l'organisme qui les fixe : Agence du revenu du Canada, Revenu Québec, lois et règlements fédéraux et provinciaux, organismes de licence (par exemple la RBQ), Office de la protection du consommateur, CNESST et autres organismes de santé et sécurité, sites municipaux.",
          "Chaque source est ouverte et lue avant d'être citée, et indiquée là où elle appuie l'affirmation, pour que vous puissiez vérifier. Un fait qu'on ne peut confirmer sur une page officielle est retiré.",
          "Les prix du marché ne sont donnés que si un organisme public ou une association reconnue les publie. Sinon, l'article explique ce qui fait varier le prix plutôt que d'avancer une fourchette.",
          "Les chiffres d'une soumission type, d'un calendrier ou d'un exemple sont des illustrations. Ils sont présentés comme des exemples, et les calculs sont vérifiés au cent près.",
          "Nous ne publions ni statistiques inventées, ni sondages, ni affirmations sur ce que font « la plupart des entrepreneurs ».",
        ],
      },
      {
        h2: "Dates et mises à jour",
        list: [
          "Chaque article affiche la date de sa dernière vérification. Cette date figure aussi dans les données structurées de la page.",
          "Les taux, seuils et montants de programmes changent, souvent le 1er janvier ou après un budget. Les articles sont revus quand une règle sur laquelle ils reposent change. Un changement annoncé est décrit avec sa date d'entrée en vigueur.",
          "Les calculateurs utilisent la même table de taxes que le produit pour les soumissions et les factures : un changement de taux touche les deux en même temps. Leurs calculs sont couverts par des tests automatisés.",
        ],
      },
      {
        h2: "Mentions du produit et comparaisons",
        list: [
          "Les articles mentionnent quoteai brièvement, et seulement pour ce qu'il fait réellement. Si le produit ne fait pas une chose, l'article le dit.",
          "Les comparaisons reprennent les prix et fonctionnalités publiés par chaque entreprise, avec la date de vérification. Un fait non confirmé est indiqué « Non confirmé », jamais « Non ».",
          "Aucun article ne contient de placement payé, de contenu commandité ni de lien d'affiliation.",
        ],
      },
      {
        h2: "Pas un avis juridique ou fiscal",
        paras: [
          "Les guides expliquent des règles publiques en langage simple, à la date indiquée. Ce sont des renseignements généraux, pas un avis juridique, fiscal ou comptable. Pour votre situation, vérifiez auprès de l'organisme concerné, de votre comptable ou d'un avocat.",
        ],
      },
      {
        h2: "Corrections",
        paras: [
          "Si vous trouvez une erreur, une règle dépassée ou une source brisée, écrivez à info@quoteai.ca en indiquant l'adresse de la page. Nous vérifions à la source, corrigeons la page et mettons sa date à jour.",
        ],
      },
    ],
    updated: "Dernière mise à jour",
    contact: "Signaler une erreur",
  },
};

export default function EditorialPolicyPage({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const other: Lang = lang === "fr" ? "en" : "fr";
  const path = EDITORIAL_PATHS[lang];
  const date = new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${UPDATED}T00:00:00Z`));
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={c.title}
        description={c.description}
        canonical={`${BASE_URL}${path}`}
        altCanonical={`${BASE_URL}${EDITORIAL_PATHS[other]}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: c.h1,
            description: c.description,
            url: `${BASE_URL}${path}`,
            inLanguage: lang === "fr" ? "fr-CA" : "en-CA",
            dateModified: UPDATED,
            publisher: { "@id": `${BASE_URL}/#org` },
          },
          breadcrumbJsonLd([
            { name: c.home, path: lang === "fr" ? "/fr/" : "/" },
            { name: c.h1, path },
          ]),
        ]}
      />
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="crumbs">
          <Link href={lang === "fr" ? "/fr/" : "/"}>{c.home}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{c.h1}</span>
        </nav>
      </div>
      <article className="wrap" style={{ maxWidth: 780, paddingTop: "clamp(12px, 2vw, 24px)", paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.7rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 16 }}>{c.h1}</h1>
        <p className="lead" style={{ maxWidth: "none" }}>{c.lead}</p>
        <p style={{ fontSize: 13, color: "var(--faint)", margin: "12px 0 32px" }}>
          {c.updated} <time dateTime={UPDATED}>{date}</time>
        </p>
        <div className="prose blog-prose max-w-none">
          {c.sections.map((s) => (
            <section key={s.h2}>
              <h2>{s.h2}</h2>
              {s.paras?.map((p) => <p key={p}>{p}</p>)}
              {s.list && <ul>{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
            </section>
          ))}
          <p><a href="mailto:info@quoteai.ca">{c.contact}: info@quoteai.ca</a></p>
        </div>
      </article>
    </div>
  );
}
