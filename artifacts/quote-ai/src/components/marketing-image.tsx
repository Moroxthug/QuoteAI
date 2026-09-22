// Phase 81 — renders one entry of data/marketing-images.ts.
//
// When the slot has the owner's photograph it is an <img> with the slot's own
// alt text. Until then it draws something that is *true*: a small mockup of
// the product the surrounding copy is describing, a flat brand-tinted cover
// for a card thumbnail, or — for the decorative CTA bands, which sit under an
// 84 % navy scrim — nothing but that scrim's own mesh.
//
// What it deliberately never draws is a stand-in photograph: no stock person,
// no generated "contractor", nothing a visitor could mistake for a picture of
// a real crew. The aspect ratio is fixed per shape, so the page does not move
// when a real photograph replaces the fallback.

import { FileText, Hammer, Receipt, MessageSquare, Mic } from "lucide-react";
import { MARKETING_SLOTS, coverTint, type MarketingSlot, type MarketingSlotId } from "@/data/marketing-images";
import { useLanguage } from "@/i18n/LanguageContext";

const SHAPE_CLASS = { split: "mk-img split-img", card: "mk-img card-img", band: "mk-img band-img" } as const;

export function MarketingImage({ slot, seed }: { slot: MarketingSlotId; seed?: string }) {
  const { lang } = useLanguage();
  // The registry is `as const` so a typo in `slot` is a type error; widening
  // here is what lets one branch read `alt` (only the non-decorative slots
  // declare it) without narrowing per slot id.
  const entry: MarketingSlot = MARKETING_SLOTS[slot];
  const decorative = entry.shape === "band";
  const alt = decorative ? "" : (entry.alt?.[lang] ?? "");

  if (entry.src) {
    return (
      <img
        src={entry.src}
        alt={alt}
        {...(decorative ? { "aria-hidden": true as const } : {})}
        loading="lazy"
        decoding="async"
        className={SHAPE_CLASS[entry.shape]}
      />
    );
  }

  switch (entry.fallback) {
    case "quote":
      return <QuoteArt alt={alt} />;
    case "job":
      return <JobArt alt={alt} />;
    case "invoice":
      return <InvoiceArt alt={alt} />;
    case "phone":
      return <PhoneArt alt={alt} />;
    case "cover":
      return <CoverArt seed={seed ?? slot} />;
    case "mesh":
      return <div className="mk-mesh" aria-hidden="true" />;
  }
}

/**
 * The product mockups below carry the surrounding slot's alt text as their
 * accessible name: to a screen reader the panel says the same thing the
 * photograph would, rather than reading out eight disconnected numbers.
 */
function ArtFrame({ alt, children }: { alt: string; children: React.ReactNode }) {
  return (
    <div className="mk-art" role="img" aria-label={alt}>
      <div className="doc-mock" aria-hidden="true">{children}</div>
    </div>
  );
}

function QuoteArt({ alt }: { alt: string }) {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  return (
    <ArtFrame alt={alt}>
      <div className="dm-bar">
        <FileText className="h-4 w-4" style={{ color: "var(--navy)" }} />
        <b>{fr ? "Soumission 2024-108" : "Quote 2024-108"}</b>
        <span className="chip chip-green">{fr ? "Acceptée" : "Accepted"}</span>
      </div>
      <div className="dm-body">
        <div className="dm-co">
          <span><b>{fr ? "Rénovation de salle de bain" : "Bathroom renovation"}</b>Vancouver, BC</span>
        </div>
        <div className="dm-row"><span>{fr ? "A. Démolition et évacuation" : "A. Demolition & disposal"}</span><span className="v">$1,850.00</span></div>
        <div className="dm-row"><span>{fr ? "B. Plomberie brute" : "B. Rough-in plumbing"}</span><span className="v">$2,400.00</span></div>
        <div className="dm-row"><span>{fr ? "C. Céramique et finition" : "C. Tile & finishing"}</span><span className="v">$3,120.00</span></div>
        <div className="dm-tot">
          <div className="dm-row"><span>{fr ? "Sous-total" : "Subtotal"}</span><span className="v">$7,370.00</span></div>
          <div className="dm-row"><span>{fr ? "TPS 5 % + TVP 7 %" : "GST 5% + PST 7%"}</span><span className="v">$884.40</span></div>
          <div className="dm-grand"><span>{fr ? "Total" : "Total"}</span><b>$8,254.40</b></div>
        </div>
      </div>
    </ArtFrame>
  );
}

function JobArt({ alt }: { alt: string }) {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  const tasks = fr
    ? [["Démolition", "done"], ["Plomberie brute", "done"], ["Inspection", "now"], ["Céramique", "next"]]
    : [["Demolition", "done"], ["Rough-in plumbing", "done"], ["Inspection", "now"], ["Tile", "next"]];
  return (
    <ArtFrame alt={alt}>
      <div className="dm-bar">
        <Hammer className="h-4 w-4" style={{ color: "var(--navy)" }} />
        <b>{fr ? "Chantier · Rue Maple" : "Job site · Maple Street"}</b>
        <span className="chip chip-teal">{fr ? "En cours" : "In progress"}</span>
      </div>
      <div className="dm-body">
        <ul className="mk-tasks">
          {tasks.map(([label, state]) => (
            <li key={label} className={`mk-task is-${state}`}>
              <span className="mk-dot" />
              {label}
            </li>
          ))}
        </ul>
        <div className="dm-tot">
          <div className="dm-row"><span>{fr ? "Budget" : "Budget"}</span><span className="v">$7,370</span></div>
          <div className="dm-row"><span>{fr ? "Coûts réels" : "Actual costs"}</span><span className="v">$5,940</span></div>
          <div className="mk-bar"><i style={{ width: "81%" }} /></div>
        </div>
      </div>
    </ArtFrame>
  );
}

function InvoiceArt({ alt }: { alt: string }) {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  return (
    <ArtFrame alt={alt}>
      <div className="dm-bar">
        <Receipt className="h-4 w-4" style={{ color: "var(--navy)" }} />
        <b>{fr ? "Facture INV-0042" : "Invoice INV-0042"}</b>
        <span className="chip chip-green">{fr ? "Payée" : "Paid"}</span>
      </div>
      <div className="dm-body">
        <div className="dm-row"><span>{fr ? "Acompte (30 %)" : "Deposit (30%)"}</span><span className="v">$2,476.32</span></div>
        <div className="dm-row"><span>{fr ? "Mi-parcours (40 %)" : "Midpoint (40%)"}</span><span className="v">$3,301.76</span></div>
        <div className="dm-row"><span>{fr ? "Solde final (30 %)" : "Final balance (30%)"}</span><span className="v">$2,476.32</span></div>
        <div className="dm-tot">
          <div className="dm-grand"><span>{fr ? "Solde dû" : "Balance due"}</span><b>$0.00</b></div>
        </div>
      </div>
      <div className="dm-chips">
        <span className="chip chip-grey">{fr ? "Virement Interac" : "Interac e-Transfer"}</span>
        <span className="chip chip-grey">{fr ? "Rappels automatiques" : "Automatic reminders"}</span>
      </div>
    </ArtFrame>
  );
}

function PhoneArt({ alt }: { alt: string }) {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  return (
    <div className="mk-art" role="img" aria-label={alt}>
      <div className="mk-phone" aria-hidden="true">
        <div className="mk-phone-bar">
          <MessageSquare className="h-3.5 w-3.5" />
          <b>quoteai</b>
        </div>
        <div className="mk-phone-body">
          <p className="mk-bubble out voice"><Mic className="h-3 w-3" />{fr ? "Note vocale · 0:14" : "Voice note · 0:14"}</p>
          <p className="mk-bubble in">
            {fr
              ? "Peinture, 3 chambres, 2 couches. Brouillon prêt : 1 840 $ + TVH. J'envoie le PDF?"
              : "Painting, 3 bedrooms, 2 coats. Draft ready: $1,840 + HST. Send the PDF?"}
          </p>
          <p className="mk-bubble out">{fr ? "Oui, envoie" : "Yes, send it"}</p>
          <p className="mk-bubble in file">{fr ? "Soumission_2024-108.pdf" : "Quote_2024-108.pdf"}</p>
        </div>
      </div>
    </div>
  );
}

const COVER_ICON = { green: FileText, teal: Hammer, purple: MessageSquare, yellow: Receipt } as const;

function CoverArt({ seed }: { seed: string }) {
  const tint = coverTint(seed);
  const Icon = COVER_ICON[tint];
  return (
    <div className={`mk-cover mk-cover-${tint}`} aria-hidden="true">
      <Icon />
    </div>
  );
}
