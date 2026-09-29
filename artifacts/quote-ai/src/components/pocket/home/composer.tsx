// Home's "New quote" card (docs/pocket-design/Main.dc.html), 1:1: the dark 26 px card, the
// beating dot, the province and tax in mono, the job typed or dictated, the client and photo
// chips, the mic and the orange send; then the three steps while the quote is written, then
// the white "Draft ready" card with the total counting up, its first lines, Review and send,
// and Redo. The quote is written by the same POST /api/quotes as the New quote screen.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateQuote, useDeleteQuote, useGetSubscription, useListClients, type Quote } from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { haptic } from "@/lib/haptics";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useBusinessProfile, PROVINCE_TAX } from "@/pages/dashboard/settings/data";
import { ArrowUpIcon, CheckIcon, MicIcon, PhotoIcon, PlusIcon } from "../icons";
import { initialsOf } from "../kit";
import { money } from "./format";

type Phase = "idle" | "working" | "ready";
type Picked = { id: string; name: string; data: Record<string, string> };

function maxPhotos(plan: string | null | undefined, active: boolean): number {
  if (!active) return 0;
  if (plan === "monthly_elite" || plan === "monthly_business") return 3;
  if (plan === "monthly_pro") return 3;
  if (plan === "monthly_starter") return 1;
  return 0;
}

const shortName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : n.trim();
};

export function Composer({ city }: { city: string | null }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile } = useBusinessProfile();
  const { data: sub } = useGetSubscription();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [shown, setShown] = useState(0);
  const [client, setClient] = useState<Picked | null>(null);
  const [picking, setPicking] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);
  const create = useCreateQuote();
  const remove = useDeleteQuote();
  const { data: clients } = useListClients({ query: { queryKey: ["/api/clients"], enabled: picking } });
  const voice = useVoiceInput({
    onTranscribed: (said) => setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said)),
    onError: (message) => toast({ title: t("mic.errorTitle"), description: message, variant: "destructive" }),
    offlineTarget: "new-quote",
  });
  const listening = voice.isRecording;
  const province = profile?.province ?? null;
  const tax = province ? PROVINCE_TAX[province] ?? null : null;
  const limit = maxPhotos(sub?.plan, !!sub?.isActive);

  useEffect(() => () => { timers.current.forEach(clearTimeout); if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const draft = () => {
    if (!text.trim() || phase !== "idle" || create.isPending) return;
    if (listening) voice.stopRecording();
    haptic("light");
    setPhase("working");
    setStep(0);
    // The first two steps pass while the server reads and prices; the last one waits for its answer.
    timers.current = [window.setTimeout(() => setStep(1), 750), window.setTimeout(() => setStep(2), 1500)];
    const company = profile ? { companyName: profile.companyName || "", ...(profile.address ? { address: profile.address } : {}), ...(profile.phone ? { phone: profile.phone } : {}), ...(profile.email ? { email: profile.email } : {}), ...(profile.logoUrl ? { logoUrl: profile.logoUrl } : {}) } : undefined;
    create.mutate(
      { data: { rawInput: text, clientData: client ? JSON.stringify(client.data) : undefined, companySnapshot: company ? JSON.stringify(company) : undefined, images: photos.length ? photos : undefined, templateId: "standard" } },
      {
        onSuccess: (q) => {
          timers.current.forEach(clearTimeout);
          setStep(3);
          void queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
          window.setTimeout(() => {
            setQuote(q);
            setPhase("ready");
            haptic("success");
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / 1000);
              setShown(q.totale * (1 - Math.pow(1 - p, 4)));
              if (p < 1) raf.current = requestAnimationFrame(tick);
            };
            raf.current = requestAnimationFrame(tick);
          }, 300);
        },
        onError: (err: unknown) => {
          timers.current.forEach(clearTimeout);
          setPhase("idle");
          const e = err as { status?: number; data?: { error?: string } };
          if (e.status === 429) toast({ title: t("dashboard.new.toast.quotaReachedTitle"), description: t("dashboard.new.toast.quotaReachedDesc"), variant: "destructive" });
          else if ((e.status === 422 || e.status === 400) && e.data?.error) toast({ title: t("dashboard.new.toast.cannotGenerateTitle"), description: e.data.error, variant: "destructive" });
          else toast({ title: t("dashboard.new.toast.genericErrorTitle"), description: t("dashboard.new.toast.genericErrorDesc"), variant: "destructive" });
        },
      },
    );
  };

  const redo = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (quote) remove.mutate({ id: quote.id }, { onSettled: () => void queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }) });
    setQuote(null);
    setShown(0);
    setStep(0);
    setPhase("idle");
  };

  const steps = [t("pocket.home.stepRead"), city ? t("pocket.home.stepPriceCity").replace("{city}", city) : t("pocket.home.stepPrice"), tax ? t("pocket.home.stepTaxOf").replace("{tax}", tax.split(" ")[0]!) : t("pocket.home.stepTax")];
  const lines = quote ? (quote.capitoli.length ? quote.capitoli.map((c) => ({ name: c.titolo, amt: c.subtotale })) : quote.items.map((i) => ({ name: i.descrizione, amt: i.totale }))) : [];
  const taxName = quote?.taxLines?.length ? quote.taxLines.map((l) => l.label.split(" ")[0]).join(" + ") : tax?.split(" ")[0] ?? "";
  const hint = listening
    ? t("pocket.home.hintListening")
    : phase === "idle"
      ? [t("pocket.home.hint"), client && photos.length ? t("pocket.home.hintBoth") : client ? t("pocket.home.hintClient") : photos.length ? t("pocket.home.hintPhotos") : ""].filter(Boolean).join(" ")
      : "";

  const chip: React.CSSProperties = { height: 34, borderRadius: 999, border: 0, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.88)", display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" };

  return (
    <section className="pk-rise" style={{ padding: "20px 16px 0", animationDelay: "70ms" }}>
      <div style={{ background: "#151517", borderRadius: 26, padding: "16px 16px 14px", color: "#ffffff", boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 20px 40px -12px rgba(20,20,22,.45)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,.72)" }}><span className="pk-beat" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e4572e" }} />{t("pocket.home.newQuote")}</span>
          {province && <span className="pk-mono" style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{[province, tax].filter(Boolean).join(" · ")}</span>}
        </div>
        <label htmlFor="pk-job" className="sr-only">{t("pocket.home.describe")}</label>
        <textarea
          id="pk-job"
          className="pk-ta"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("pocket.home.placeholder")}
          disabled={phase !== "idle"}
          style={{ display: "block", marginTop: 10, width: "100%", boxSizing: "border-box", height: 84, resize: "none", padding: "0 2px", border: 0, background: "transparent", color: "#ffffff", fontFamily: "inherit", fontSize: 15, lineHeight: 1.5, letterSpacing: "-0.01em", outline: "none" }}
        />

        {phase === "idle" && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="pk-press" onClick={() => setPicking(true)} aria-label={client ? t("pocket.home.clientIs").replace("{name}", client.name) : t("pocket.home.addClient")} style={{ ...chip, padding: "0 11px 0 4px", gap: 7, maxWidth: 150 }}>
              <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", background: "#f1ede4", color: "#141416", fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{client ? initialsOf(client.name) : <PlusIcon />}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client ? shortName(client.name) : t("pocket.home.client")}</span>
            </button>
            {limit > 0 && (
              <button type="button" className="pk-press" onClick={() => (photos.length >= limit ? setPhotos([]) : fileRef.current?.click())} aria-label={photos.length ? t("pocket.home.photosAttached").replace("{n}", String(photos.length)) : t("pocket.home.addPhotos")} style={{ ...chip, padding: "0 11px", gap: 6 }}>
                <PhotoIcon />{photos.length > 0 && photos.length}
              </button>
            )}
            <span style={{ flexGrow: 1 }} />
            <button type="button" className={`pk-press${listening ? " pk-pulse" : ""}`} onClick={() => (listening ? voice.stopRecording() : voice.startRecording())} disabled={voice.isTranscribing} aria-label={listening ? t("pocket.home.stopDictation") : t("pocket.home.dictate")} aria-pressed={listening} style={{ position: "relative", width: 44, height: 44, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: listening ? "#ffffff" : "rgba(255,255,255,.1)", color: listening ? "#141416" : "#ffffff" }}>
              <MicIcon />
            </button>
            <button type="button" className="pk-press" onClick={draft} disabled={!text.trim()} aria-label={t("pocket.home.draftQuote")} style={{ width: 44, height: 44, borderRadius: "50%", border: 0, background: "#e4572e", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -4px rgba(228,87,46,.6)", cursor: "pointer", opacity: text.trim() ? 1 : 0.5 }}>
              <ArrowUpIcon />
            </button>
          </div>
        )}

        {phase === "working" && (
          <div className="pk-rise" role="status" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", gap: 9 }}>
            {steps.map((label, i) => {
              const st = i < step ? "done" : i === step ? "active" : "wait";
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 500, color: st === "wait" ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.92)" }}>
                  <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {st === "done" && <CheckIcon size={15} color="#ffffff" />}
                    {st === "active" && <span className="pk-spin" style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.2)", borderTopColor: "#e4572e", boxSizing: "border-box" }} />}
                    {st === "wait" && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,.3)" }} />}
                  </span>
                  <span>{label}</span>
                </div>
              );
            })}
            <div style={{ height: 2, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden", marginTop: 3 }}><div className="pk-bar-in" style={{ height: "100%", background: "#e4572e" }} /></div>
          </div>
        )}

        {phase === "ready" && quote && (
          <div className="pk-rise" style={{ marginTop: 12, borderRadius: 18, background: "#ffffff", color: "#141416", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#1f7a45" }}><CheckIcon />{t("pocket.home.draftReady")}</span>
              {quote.numeroPreventivoData && <span className="pk-mono" style={{ fontSize: 11, color: "#6e6e76" }}>{quote.numeroPreventivoData}</span>}
            </div>
            <p className="pk-num" style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>{money(Math.round(shown * 100), lang, true)}</p>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#6e6e76" }}>{[taxName ? t("pocket.home.inclTax").replace("{tax}", taxName) : null, t(lines.length === 1 ? "pocket.home.item" : "pocket.home.items").replace("{n}", String(lines.length))].filter(Boolean).join(" · ")}</p>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column" }}>
              {lines.slice(0, 3).map((li, i) => (
                <div key={i} className="pk-rise" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid #efeeea", fontSize: 13, animationDelay: `${200 + i * 90}ms` }}>
                  <span style={{ color: "#3c3c43" }}>{li.name}</span><span className="pk-num" style={{ fontWeight: 500 }}>{money(Math.round(li.amt * 100), lang, true)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <Link href={`/dashboard/quotes/${quote.id}`} className="pk-btn pk-btn-dark pk-press" style={{ flexGrow: 1 }}>{t("pocket.home.reviewSend")}</Link>
              <button type="button" className="pk-btn pk-btn-soft pk-press" onClick={redo}>{t("pocket.home.redo")}</button>
            </div>
          </div>
        )}
      </div>
      <p aria-live="polite" style={{ margin: "10px 4px 0", fontSize: 12, color: "#6e6e76", minHeight: 16 }}>{hint}</p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; setPhotos((p) => [...p, ...f].slice(0, limit)); }} />

      <BottomSheet open={picking} onOpenChange={setPicking} title={t("pocket.home.whichClient")} flush>
        <div className="lrows">
          {client && (
            <button type="button" className="lrow" onClick={() => { setClient(null); setPicking(false); }}>
              <span className="lrow-main"><span className="lrow-title">{t("pocket.home.noClient")}</span></span>
            </button>
          )}
          {(clients ?? []).map((c) => (
            <button key={c.id} type="button" className="lrow" onClick={() => {
              const data: Record<string, string> = { nome: c.clientName, indirizzo: c.indirizzo ?? "" };
              if (c.email) data.email = c.email;
              if (c.phone) data.phone = c.phone;
              if (c.city) data.city = c.city;
              if (c.postalCode) data.postalCode = c.postalCode;
              if (c.province) data.province = c.province;
              setClient({ id: c.id, name: c.clientName, data });
              setPicking(false);
            }}>
              <span className="lrow-main"><span className="lrow-title">{c.clientName}</span><span className="lrow-meta">{[c.indirizzo, c.city].filter(Boolean).join(", ") || c.email || ""}</span></span>
            </button>
          ))}
          {clients && clients.length === 0 && <p className="more-empty">{t("pocket.home.noClients")}</p>}
          <button type="button" className="lrow" onClick={() => { setPicking(false); navigate("/dashboard/clients?new=1"); }}>
            <span className="lrow-main"><span className="lrow-title">{t("pocket.home.newClient")}</span></span>
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
