import { Router } from "express";
import { db, incentivesCatalogTable, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq, and, ne, or, desc, lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAdmin } from "./admin.js";
import { sendWidgetLeadNotification, sendWidgetClientConfirmationEmail } from "../lib/email.js";
import { runIncentivesVerification } from "../lib/incentivesVerification.js";

const router = Router();

// "Fondo perduto" (non-repayable) grants use up their funding and have a
// deadline (application window): once passed, without human intervention they
// stay marked "active" forever. Here we close them automatically based on the
// deadline field, so the status at least reflects the known date even if no one
// checks them manually.
async function closeExpiredIncentives() {
  await db
    .update(incentivesCatalogTable)
    .set({ stato: "closed" })
    .where(and(lt(incentivesCatalogTable.scadenza, new Date()), ne(incentivesCatalogTable.stato, "closed")));
}

// Automatic seeder function that ensures the catalog always contains national, regional, and municipal incentives
// NOTE: this seed data models the Italian tax-incentive system (IRPEF deductions, ISEE, regional/municipal
// grants tied to Italian regions and cities) inherited from the original Italian product. It has NOT been
// redesigned for Canadian programs (e.g. federal/provincial rebates, HST/GST considerations) — that is a
// product decision beyond a literal translation pass, so the scheme names, regions, and tax rules below
// are intentionally left as-is pending a dedicated Canadianization effort.
async function ensureDefaultIncentives() {
  await closeExpiredIncentives();

  const existingCount = await db.select().from(incentivesCatalogTable);
  if (existingCount.length > 0) return;

  logger.info("Seeding default incentives catalog (Statali, Regionali, Comunali)...");
  await db.insert(incentivesCatalogTable).values([
    {
      level: "statale",
      codice: "BONUS_CASA_50",
      titolo: "Bonus Ristrutturazione Edilizia 50%",
      descrizione: "Detrazione fiscale del 50% in 10 quote annuali di pari importo per interventi di manutenzione straordinaria e ristrutturazione edilizia residenziale.",
      province: null,
      city: null,
      categoriaIntervento: "tutti",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "50.00",
      massimaleSpesa: "96000.00",
      massimaleContributo: "48000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.agenziaentrate.gov.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "ECOBONUS_65",
      titolo: "Ecobonus Riqualificazione Energetica 65%",
      descrizione: "Detrazione IRPEF/IRES fino al 65% in 10 anni per interventi di miglioramento energetico (cappotto termico, sostituzione infissi, pompe di calore, solare termico).",
      province: null,
      city: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "65.00",
      massimaleSpesa: "100000.00",
      massimaleContributo: "65000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.enea.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "CONTO_TERMICO_30",
      titolo: "Conto Termico GSE (Incentivo Diretto in Conto Capitale)",
      descrizione: "Rimborso diretto sul conto corrente bancario entro 90 giorni dal GSE fino al 65% della spesa per la sostituzione di impianti di climatizzazione invernale con pompe di calore o solare termico.",
      province: null,
      city: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "conto_termico_gse",
      percentualeMassima: "65.00",
      massimaleSpesa: "50000.00",
      massimaleContributo: "15000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.gse.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "BARRIERE_75",
      titolo: "Bonus Abbattimento Barriere Architettoniche 75%",
      descrizione: "Detrazione del 75% per lavori finalizzati all'eliminazione delle barriere architettoniche in edifici esistenti (adeguamento bagni con doccia filo pavimento, allargamento porte, rampe, ascensori).",
      province: null,
      city: null,
      categoriaIntervento: "barriere_architettoniche",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "75.00",
      massimaleSpesa: "50000.00",
      massimaleContributo: "37500.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.agenziaentrate.gov.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "LOMBARDIA_EFF_2026",
      titolo: "Bando Efficienza Energetica e Riscaldamento Regione Lombardia 2026",
      descrizione: "Contributo a fondo perduto fino a 5.000 € a sportello per cittadini residenti in Lombardia che effettuano interventi di efficientamento energetico (+2 classi o installazione pompe di calore).",
      province: "Lombardia",
      city: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "50.00",
      massimaleSpesa: "20000.00",
      massimaleContributo: "5000.00",
      requisitiIseeMax: "45000.00",
      // Indicative closing date for the application window (placeholder, to be confirmed:
      // see TODO item 3). Without a deadline, the grant can never be
      // auto-marked "closed" once its funding runs out.
      scadenza: new Date("2026-12-31T23:59:59Z"),
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.lombardia.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "PIEMONTE_CALDAIE",
      titolo: "Bando Sostituzione Impianti Termici Regione Piemonte",
      descrizione: "Contributo regionale a fondo perduto fino a 3.500 € cumulabile con Conto Termico per rottamazione vecchi generatori e installazione di pompe di calore ad alta efficienza.",
      province: "Piemonte",
      city: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "40.00",
      massimaleSpesa: "15000.00",
      massimaleContributo: "3500.00",
      scadenza: new Date("2026-12-31T23:59:59Z"), // placeholder, to be confirmed (see TODO item 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.piemonte.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "EMILIA_SOLARE",
      titolo: "Bando Solare e Rinnovabili per Residenziale Emilia-Romagna",
      descrizione: "Incentivo a fondo perduto per l'installazione di sistemi fotovoltaici e accumulo su edifici residenziali in Emilia-Romagna.",
      province: "Emilia-Romagna",
      city: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "40.00",
      massimaleSpesa: "12000.00",
      massimaleContributo: "4000.00",
      scadenza: new Date("2026-11-30T23:59:59Z"), // placeholder, to be confirmed (see TODO item 3)
      stato: "active",
      fonteUfficialeUrl: "https://energia.regione.emilia-romagna.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "VENETO_BORGHI",
      titolo: "Bando Rigenerazione e Ristrutturazione Sostenibile Veneto 2026",
      descrizione: "Contributo a fondo perduto per la riqualificazione di immobili residenziali nei comuni e borghi del Veneto ad alta valenza storico-ambientale.",
      province: "Veneto",
      city: null,
      categoriaIntervento: "ristrutturazione",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "35.00",
      massimaleSpesa: "25000.00",
      massimaleContributo: "4500.00",
      scadenza: new Date("2026-12-31T23:59:59Z"), // placeholder, to be confirmed (see TODO item 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.veneto.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "comunale",
      codice: "MILANO_FACCIATE_2026",
      titolo: "Bando Comune di Milano - Rinnovo Facciate ed Efficienza Condominiale/Residenziale",
      descrizione: "Incentivo comunale a sportello fino a 3.000 € per interventi di isolamento termico e ripristino facciate nel territorio del Comune di Milano.",
      province: "Lombardia",
      city: "Milano",
      categoriaIntervento: "tutti",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "30.00",
      massimaleSpesa: "15000.00",
      massimaleContributo: "3000.00",
      scadenza: new Date("2026-10-31T23:59:59Z"), // placeholder, to be confirmed (see TODO item 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.comune.milano.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "comunale",
      codice: "BOLOGNA_GREEN",
      titolo: "Bando Verde Urbano e Resilienza Energetica Comune di Bologna",
      descrizione: "Contributo fino a 2.500 € a fondo perduto per infissi ad alto isolamento, coperture verdi e riduzione dell'isola di calore urbana.",
      province: "Emilia-Romagna",
      city: "Bologna",
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "35.00",
      massimaleSpesa: "10000.00",
      massimaleContributo: "2500.00",
      scadenza: new Date("2026-12-15T23:59:59Z"), // placeholder, to be confirmed (see TODO item 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.comune.bologna.it",
      // Placeholder data inserted on first startup, never checked against the
      // official sources: isVerifiedByAi starts as false and lastCheckedAt as null so
      // the first cron run (see lib/incentivesVerification.ts) treats them as
      // not yet verified, instead of falsely declaring them already confirmed.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
  ]);
}

// GET /api/public/incentives - Returns active incentives filtered by province/city/category
router.get("/public/incentives", async (req, res) => {
  try {
    await ensureDefaultIncentives();

    const provinceParam = req.query.province ? String(req.query.province).trim() : null;
    const cityParam = req.query.city ? String(req.query.city).trim() : null;
    const categoriaParam = req.query.categoria ? String(req.query.categoria).trim() : null;

    const allIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"))
      .orderBy(desc(incentivesCatalogTable.level), incentivesCatalogTable.titolo);

    // Filter server-side for maximum flexibility
    const filtered = allIncentives.filter(inc => {
      // Filter by level and area
      if (inc.level === "statale") return true;
      if (inc.level === "regionale") {
        if (!provinceParam) return true;
        return inc.province?.toLowerCase().includes(provinceParam.toLowerCase()) ||
               provinceParam.toLowerCase().includes(inc.province?.toLowerCase() || "");
      }
      if (inc.level === "comunale") {
        if (!cityParam && !provinceParam) return true;
        const matchCity = cityParam && inc.city?.toLowerCase().includes(cityParam.toLowerCase());
        const matchProvince = provinceParam && inc.province?.toLowerCase().includes(provinceParam.toLowerCase());
        return matchCity || matchProvince;
      }
      return true;
    }).filter(inc => {
      // Filter by category
      if (!categoriaParam || inc.categoriaIntervento === "tutti") return true;
      if (categoriaParam === "efficienza_energetica" || categoriaParam === "completa" || categoriaParam === "elettrico" || categoriaParam === "idraulico") {
        return inc.categoriaIntervento === "efficienza_energetica" || inc.categoriaIntervento === "tutti" || inc.categoriaIntervento === "ristrutturazione";
      }
      if (categoriaParam === "bagno" || categoriaParam === "barriere") {
        return inc.categoriaIntervento === "barriere_architettoniche" || inc.categoriaIntervento === "tutti" || inc.categoriaIntervento === "ristrutturazione";
      }
      return inc.categoriaIntervento === "ristrutturazione" || inc.categoriaIntervento === "tutti";
    });

    res.json({
      success: true,
      count: filtered.length,
      incentives: filtered,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching public incentives");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes/:quoteId/incentives - Calculates the bonuses on the quote and updates the lead
router.post("/public/quotes/:quoteId/incentives", async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    
    // Find the quote
    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quoteId));

    if (!quote) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }

    const {
      tipoImmobile = "prima_casa",
      obiettivoLavori = "ristrutturazione",
      fasciaIsee = "sopra_30k",
      province = "",
      postalCode = "",
      totalePreventivo,
    } = req.body;

    const totaleLavori = Number(totalePreventivo) || Number(quote.totale) || 0;

    // 1. Calculate the reduced VAT/tax discount (10% for residential primary/secondary home vs. 22% standard)
    const isResidenziale = tipoImmobile === "prima_casa" || tipoImmobile === "seconda_casa" || tipoImmobile === "condominio";
    const scontoIvaStimato = isResidenziale ? Math.round(totaleLavori * 0.10) : 0; // Net savings ~10% on the taxable amount

    // 2. Calculate the compatible national bonus/deduction
    // The tax deduction underlying Ristrutturazione/Ecobonus is reserved
    // for individuals on residential-use properties: an office/commercial
    // property doesn't qualify. Between primary and secondary residence, the
    // full rate applies only to the primary residence/condo; on a secondary
    // residence it's reduced (indicative rate, to be confirmed once the actual
    // regulatory rules are formalized — see TODO item 3). The accessibility
    // barrier-removal bonus, on the other hand, stays unchanged: the regulation
    // doesn't limit it to the primary residence only.
    const isUfficio = tipoImmobile === "ufficio";
    const isSecondaCasa = tipoImmobile === "seconda_casa";

    let bonusStataleApplicato = "Bonus Ristrutturazione Edilizia 50% (Detrazione 10 anni)";
    let bonusStataleCodice = "BONUS_CASA_50";
    let percentualeBonusStatale = 0.50;
    let percentualeSecondaCasa = 0.36;

    if (obiettivoLavori === "efficienza" || obiettivoLavori === "efficienza_energetica") {
      bonusStataleApplicato = "Ecobonus 65% / Conto Termico GSE (Incentivo Diretto)";
      bonusStataleCodice = "ECOBONUS_65";
      percentualeBonusStatale = 0.65;
      percentualeSecondaCasa = 0.50;
    } else if (obiettivoLavori === "barriere" || obiettivoLavori === "barriere_architettoniche") {
      bonusStataleApplicato = "Bonus Abbattimento Barriere Architettoniche 75%";
      bonusStataleCodice = "BARRIERE_75";
      percentualeBonusStatale = 0.75;
      percentualeSecondaCasa = 0.75; // the regulation doesn't reduce this bonus for a secondary residence
    }

    const bonusBarriere = bonusStataleCodice === "BARRIERE_75";
    if (isUfficio && !bonusBarriere) {
      bonusStataleApplicato = `${bonusStataleApplicato} — non applicabile: detrazione riservata a immobili ad uso abitativo`;
      percentualeBonusStatale = 0;
    } else if (isSecondaCasa && !bonusBarriere) {
      percentualeBonusStatale = percentualeSecondaCasa;
      bonusStataleApplicato = `${bonusStataleApplicato} — aliquota ridotta ${Math.round(percentualeSecondaCasa * 100)}% per seconda casa`;
    }

    let importoBonusStatale = Math.round(totaleLavori * percentualeBonusStatale);

    // Cap at the standard maximum
    if (importoBonusStatale > 48000) importoBonusStatale = 48000;

    // 3. Match with a regional or municipal grant program
    await ensureDefaultIncentives();
    const allIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    // Verification status of the applied national bonus: reflects whether an admin
    // has manually checked the corresponding catalog entry (see humanVerified).
    const bonusStataleRecord = allIncentives.find(inc => inc.codice === bonusStataleCodice);
    const bonusStataleHumanVerified = bonusStataleRecord?.humanVerified ?? false;

    let bandoRegionaleApplicato = "Nessun bando regionale a sportello specifico individuato (si applicano i Bonus Statali)";
    let importoBandoRegionale = 0;
    let bandoRegionaleHumanVerified: boolean | null = null;

    if (province || postalCode) {
      const matchReg = allIncentives.find(inc =>
        (inc.level === "regionale" || inc.level === "comunale") &&
        ((province && inc.province?.toLowerCase().includes(province.toLowerCase())) ||
         (province && province.toLowerCase().includes(inc.province?.toLowerCase() || "")) ||
         (inc.city && postalCode.startsWith("20") && inc.city.toLowerCase() === "milano") ||
         (inc.city && postalCode.startsWith("40") && inc.city.toLowerCase() === "bologna"))
      );

      if (matchReg) {
        bandoRegionaleApplicato = `${matchReg.titolo} (${matchReg.tipoAgevolazione === 'fondo_perduto' ? 'Fondo Perduto' : 'Contributo'})`;
        importoBandoRegionale = Number(matchReg.massimaleContributo) || 3000;
        bandoRegionaleHumanVerified = matchReg.humanVerified;
        if (fasciaIsee === "sotto_30k") {
          importoBandoRegionale = Math.round(importoBandoRegionale * 1.25); // Maggiorazione sociale ISEE
        }
      }
    }

    // Immediate out-of-pocket cost: only what actually reduces the payment during
    // the work (non-repayable grant and reduced tax rate). Tax deductions are recovered over 10 years
    // of tax returns and must NOT be subtracted as an upfront discount.
    const esborsoImmediatoStimato = Math.max(0, Math.round(totaleLavori - importoBandoRegionale - scontoIvaStimato));
    const detrazioneFiscaleAnnua = Math.round(importoBonusStatale / 10);

    const incentivesData = {
      tipoImmobile,
      obiettivoLavori,
      fasciaIsee,
      province,
      postalCode,
      bonusStataleApplicato: `${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")})`,
      bonusStataleHumanVerified,
      bandoRegionaleApplicato: importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : bandoRegionaleApplicato,
      bandoRegionaleHumanVerified,
      scontoIvaStimato,
      esborsoImmediatoStimato,
      detrazioneFiscaleDecennale: importoBonusStatale,
      detrazioneFiscaleAnnua,
    };

    // Update the quote with the incentive responses
    const currentClientData = quote.clientData || { nome: "", indirizzo: "" };
    const updatedClientData = {
      ...currentClientData,
      incentivesData,
    };

    await db
      .update(quotesTable)
      .set({
        clientData: updatedClientData,
        updatedAt: new Date(),
      })
      .where(eq(quotesTable.id, quoteId));

    // Email notification to the company (if we found the partner's email)
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, quote.userId));

    if (profile && profile.email) {
      sendWidgetLeadNotification({
        toEmail: profile.email,
        companyName: profile.companyName,
        clientName: currentClientData.nome || "Lead Widget",
        clientEmail: currentClientData.email || "No email provided",
        clientPhone: currentClientData.phone || "No phone provided",
        rawInput: quote.rawInput || "",
        totale: quote.totale,
        prezzoMinimo: (Number(quote.totale) * 0.9).toFixed(2),
        prezzoMassimo: (Number(quote.totale) * 1.25).toFixed(2),
        incentivesSummary: `🏛️ STIMA PRELIMINARE AGEVOLAZIONI (da confermare in sede di sopralluogo tecnico e fiscale):\n` +
          `• Immobile: ${tipoImmobile} | Obiettivo: ${obiettivoLavori} | ISEE: ${fasciaIsee}\n` +
          `• Bonus Statale Compatibile: ${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")}, detrazione IRPEF in 10 quote annuali da ~€${detrazioneFiscaleAnnua.toLocaleString("it-IT")})\n` +
          `• Bando Regionale/Comunale: ${importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : 'Nessuno a sportello'}\n` +
          `• Risparmio IVA 10%: ~€${scontoIvaStimato.toLocaleString("it-IT")}\n` +
          `👉 ESBORSO IMMEDIATO STIMATO (esclusa detrazione, recuperata in 10 anni): ~€${esborsoImmediatoStimato.toLocaleString("it-IT")}`
      }).catch(err => {
        logger.error({ err }, "Failed to send updated incentives email notification to contractor");
      });
    }

    // Email notification to the end client, if they provided an address, including the incentives summary
    const clientEmail = currentClientData.email;
    if (clientEmail && clientEmail.includes("@") && profile) {
      sendWidgetClientConfirmationEmail({
        toEmail: clientEmail,
        clientName: currentClientData.nome || "Customer",
        companyName: profile.companyName,
        companyPhone: profile.phone ?? null,
        companyEmail: profile.email ?? null,
        prezzoMinimo: (Number(quote.totale) * 0.9).toFixed(2),
        prezzoMassimo: (Number(quote.totale) * 1.25).toFixed(2),
        incentivesSummary: `Immobile: ${tipoImmobile} | Obiettivo: ${obiettivoLavori}\n` +
          `• Bonus Statale Compatibile: ${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")}, detrazione IRPEF in 10 quote annuali da ~€${detrazioneFiscaleAnnua.toLocaleString("it-IT")})\n` +
          `• Bando Regionale/Comunale: ${importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : 'Nessuno a sportello'}\n` +
          `• Risparmio IVA 10%: ~€${scontoIvaStimato.toLocaleString("it-IT")}\n` +
          `• Esborso immediato stimato (esclusa detrazione, recuperata in 10 anni): ~€${esborsoImmediatoStimato.toLocaleString("it-IT")}`,
      }).catch(err => {
        logger.error({ err }, "Failed to send incentives confirmation email to client");
      });
    }

    res.json({
      success: true,
      quoteId,
      totaleLavori,
      scontoIvaStimato,
      bonusStataleApplicato: incentivesData.bonusStataleApplicato,
      bonusStataleHumanVerified,
      bandoRegionaleApplicato: incentivesData.bandoRegionaleApplicato,
      bandoRegionaleHumanVerified,
      esborsoImmediatoStimato,
      detrazioneFiscaleDecennale: importoBonusStatale,
      detrazioneFiscaleAnnua,
    });
  } catch (err) {
    logger.error({ err }, "Error calculating incentives for quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================================
// ADMIN ROUTES FOR MANAGEMENT AND THE AI CRON
// ==========================================

// GET /api/admin/incentives - Full list for the admin dashboard
router.get("/admin/incentives", requireAdmin, async (_req, res) => {
  try {
    await ensureDefaultIncentives();
    const list = await db
      .select()
      .from(incentivesCatalogTable)
      .orderBy(incentivesCatalogTable.level, incentivesCatalogTable.titolo);
    res.json({ success: true, count: list.length, incentives: list });
  } catch (err) {
    logger.error({ err }, "Error fetching admin incentives catalog");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/incentives - Manual or custom addition of a grant program
router.post("/admin/incentives", requireAdmin, async (req, res) => {
  try {
    const {
      level = "regionale",
      codice,
      titolo,
      descrizione,
      province = null,
      city = null,
      categoriaIntervento = "tutti",
      tipoAgevolazione = "fondo_perduto",
      percentualeMassima = "50.00",
      massimaleSpesa = null,
      massimaleContributo = null,
      requisitiIseeMax = null,
      stato = "active",
      fonteUfficialeUrl = null,
    } = req.body;

    if (!codice || !titolo || !descrizione) {
      res.status(400).json({ error: "The code, title, and description fields are required." });
      return;
    }

    const [inserted] = await db
      .insert(incentivesCatalogTable)
      .values({
        level,
        codice,
        titolo,
        descrizione,
        province,
        city,
        categoriaIntervento,
        tipoAgevolazione,
        percentualeMassima: String(percentualeMassima),
        massimaleSpesa: massimaleSpesa ? String(massimaleSpesa) : null,
        massimaleContributo: massimaleContributo ? String(massimaleContributo) : null,
        requisitiIseeMax: requisitiIseeMax ? String(requisitiIseeMax) : null,
        stato,
        fonteUfficialeUrl,
        isVerifiedByAi: false,
      })
      .returning();

    res.status(201).json({ success: true, incentive: inserted });
  } catch (err) {
    logger.error({ err }, "Error creating admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/incentives/:id - Edit an existing grant program
router.patch("/admin/incentives/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      level,
      codice,
      titolo,
      descrizione,
      province,
      city,
      categoriaIntervento,
      tipoAgevolazione,
      percentualeMassima,
      massimaleSpesa,
      massimaleContributo,
      requisitiIseeMax,
      stato,
      fonteUfficialeUrl,
      humanVerified,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (level !== undefined) updates.level = level;
    if (codice !== undefined) updates.codice = codice;
    if (titolo !== undefined) updates.titolo = titolo;
    if (descrizione !== undefined) updates.descrizione = descrizione;
    if (province !== undefined) updates.province = province;
    if (city !== undefined) updates.city = city;
    if (categoriaIntervento !== undefined) updates.categoriaIntervento = categoriaIntervento;
    if (tipoAgevolazione !== undefined) updates.tipoAgevolazione = tipoAgevolazione;
    if (percentualeMassima !== undefined) updates.percentualeMassima = String(percentualeMassima);
    if (massimaleSpesa !== undefined) updates.massimaleSpesa = massimaleSpesa ? String(massimaleSpesa) : null;
    if (massimaleContributo !== undefined) updates.massimaleContributo = massimaleContributo ? String(massimaleContributo) : null;
    if (requisitiIseeMax !== undefined) updates.requisitiIseeMax = requisitiIseeMax ? String(requisitiIseeMax) : null;
    if (stato !== undefined) updates.stato = stato;
    if (fonteUfficialeUrl !== undefined) updates.fonteUfficialeUrl = fonteUfficialeUrl;
    // humanVerified: the only way to mark a grant program as manually checked
    // by an admin against the official source (unlike isVerifiedByAi,
    // which only reflects the AI cron's heuristic outcome).
    if (humanVerified !== undefined) updates.humanVerified = Boolean(humanVerified);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    const [updated] = await db
      .update(incentivesCatalogTable)
      .set(updates)
      .where(eq(incentivesCatalogTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Incentive not found." });
      return;
    }

    res.json({ success: true, incentive: updated });
  } catch (err) {
    logger.error({ err }, "Error updating admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/incentives/:id - Delete a grant program
router.delete("/admin/incentives/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await db.delete(incentivesCatalogTable).where(eq(incentivesCatalogTable.id, id));
    res.json({ success: true, deletedId: id });
  } catch (err) {
    logger.error({ err }, "Error deleting admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/incentives/cron-sync - Runs the Daily AI Incentive Agent (Verification and Update)
router.post("/admin/incentives/cron-sync", requireAdmin, async (_req, res) => {
  try {
    logger.info("Executing Daily AI Incentive Agent verification...");
    await ensureDefaultIncentives();

    const activeIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    const outcome = await runIncentivesVerification(activeIncentives);

    res.json({
      success: true,
      verifiedCount: outcome.updatedCount,
      sourcesFetched: outcome.sourcesFetched,
      sourcesTotal: outcome.sourcesTotal,
      summary: outcome.summary,
      disclaimer: outcome.disclaimer,
    });
  } catch (err) {
    logger.error({ err }, "Error running daily AI incentive sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
