import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export type SignatureValue = { type: "drawn"; data: string } | { type: "typed"; data: string } | null;

/**
 * Draw-or-type signature capture. Drawn signatures are exported as a PNG
 * data URL (transparent background) sized for the PDF; typed signatures are
 * rendered in a script face and stored as the typed text.
 */
export function SignaturePad({ value, onChange, defaultName }: { value: SignatureValue; onChange: (v: SignatureValue) => void; defaultName?: string }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"drawn" | "typed">("drawn");
  const [typed, setTyped] = useState(defaultName ?? "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Hi-DPI canvas setup
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
  }, [mode]);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasInk.current && canvasRef.current) onChange({ type: "drawn", data: canvasRef.current.toDataURL("image/png") });
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
    onChange(null);
  };

  const switchMode = (m: "drawn" | "typed") => {
    setMode(m);
    hasInk.current = false;
    if (m === "typed") onChange(typed.trim() ? { type: "typed", data: typed.trim() } : null);
    else onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button type="button" onClick={() => switchMode("drawn")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all", mode === "drawn" ? "bg-card shadow-sm text-slate-900" : "text-slate-500")}>
          <PenLine className="h-3.5 w-3.5" /> {t("signature.draw")}
        </button>
        <button type="button" onClick={() => switchMode("typed")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all", mode === "typed" ? "bg-card shadow-sm text-slate-900" : "text-slate-500")}>
          <Type className="h-3.5 w-3.5" /> {t("signature.type")}
        </button>
      </div>

      {mode === "drawn" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-40 rounded-xl border-2 border-dashed border-slate-300 bg-card touch-none cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
          />
          {!value && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500">{t("signature.drawHint")}</div>}
          <button type="button" onClick={clear} className="absolute top-2 right-2 text-xs text-slate-500 hover:text-slate-800 bg-card/80 rounded-md px-2 py-1 flex items-center gap-1">
            <Eraser className="h-3 w-3" /> {t("signature.clear")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              onChange(e.target.value.trim() ? { type: "typed", data: e.target.value.trim() } : null);
            }}
            placeholder={t("signature.typePlaceholder")}
            className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          <div className="h-24 rounded-xl border border-slate-200 bg-card flex items-center justify-center overflow-hidden">
            <span className="text-3xl text-slate-900" style={{ fontFamily: '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive' }}>{typed || " "}</span>
          </div>
        </div>
      )}
    </div>
  );
}
