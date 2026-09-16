import { ArrowRight, Mic, FileText } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type MsgFrom = "bot" | "user";
type MsgKind = "text" | "voice" | "preview" | "pdf";

interface ChatMsg {
  id: string;
  from: MsgFrom;
  kind: MsgKind;
  text?: string;
  time?: string;
}

type Phase = {
  action: "addMsg" | "setTyping" | "clearTyping" | "reset";
  delay: number;
  msg?: ChatMsg;
};

// ── Data ──────────────────────────────────────────────────────────────────────

function formatTime(h: number, m: number) {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function buildPreviewData(t: (key: string) => string) {
  return {
    title: t("waDemo.preview.title"),
    chapters: [
      { label: t("waDemo.preview.chapter1"), amt: "$ 450.00" },
      { label: t("waDemo.preview.chapter2"), amt: "$ 980.00" },
      { label: t("waDemo.preview.chapter3"), amt: "$ 390.00" },
    ],
    subtotale: "$ 1,820.00",
    iva: "$ 236.60",
    totale: "$ 2,056.60",
  };
}

function buildPhases(t: (key: string) => string): Phase[] {
  return [
    { action: "addMsg", delay: 400, msg: { id: "u1", from: "user", kind: "voice", text: "0:08", time: formatTime(9, 41) } },
    { action: "setTyping", delay: 500 },
    { action: "addMsg", delay: 1100, msg: { id: "b1", from: "bot", kind: "text", text: t("waDemo.msg.generating"), time: formatTime(9, 41) } },
    { action: "setTyping", delay: 600 },
    { action: "addMsg", delay: 2800, msg: { id: "b2", from: "bot", kind: "preview", time: formatTime(9, 42) } },
    { action: "clearTyping", delay: 0 },
    { action: "addMsg", delay: 700, msg: { id: "b3", from: "bot", kind: "text", text: t("waDemo.msg.hereIsPreview"), time: formatTime(9, 42) } },
    { action: "addMsg", delay: 2000, msg: { id: "u2", from: "user", kind: "text", text: t("waDemo.msg.ok"), time: formatTime(9, 42) } },
    { action: "setTyping", delay: 600 },
    { action: "addMsg", delay: 1000, msg: { id: "b4", from: "bot", kind: "text", text: t("waDemo.msg.foundClient"), time: formatTime(9, 43) } },
    { action: "clearTyping", delay: 0 },
    { action: "addMsg", delay: 1600, msg: { id: "u3", from: "user", kind: "text", text: t("waDemo.msg.clientConfirmed"), time: formatTime(9, 43) } },
    { action: "setTyping", delay: 600 },
    { action: "addMsg", delay: 1800, msg: { id: "b5", from: "bot", kind: "text", text: t("waDemo.msg.quoteSaved"), time: formatTime(9, 43) } },
    { action: "clearTyping", delay: 0 },
    { action: "addMsg", delay: 600, msg: { id: "b6", from: "bot", kind: "pdf", text: "quote-interior-painting-90sqm.pdf", time: formatTime(9, 43) } },
    { action: "reset", delay: 4000 },
  ];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Waveform() {
  const heights = [3, 6, 10, 14, 10, 16, 8, 12, 6, 9, 14, 10, 6, 10, 8];
  return (
    <div className="flex items-center gap-[2px] h-4">
      {heights.map((h, i) => (
        <div key={i} className="w-[2px] rounded-full bg-current opacity-70" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function BotAvatar({ size = 8 }: { size?: number }) {
  return (
    <img
      src="/quoteai-icon.png"
      alt="QuoteAI"
      className="rounded-full object-cover shrink-0 shadow-sm"
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    />
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-1.5 mb-2 animate-in fade-in duration-200">
      <BotAvatar size={6} />
      <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            style={{ animation: `wa-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ data, t }: { data: ReturnType<typeof buildPreviewData>; t: (key: string) => string }) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden w-[200px] text-[8px]">
      <div className="bg-navy-700 px-2 py-1.5 text-white font-bold text-[9px] flex items-center gap-1">
        <FileText className="w-2.5 h-2.5 shrink-0" />
        {t("waDemo.preview.quoteLabel")}
      </div>
      <div className="px-2 py-1.5 space-y-1">
        <p className="font-semibold text-gray-800 text-[8px] leading-tight">{data.title}</p>
        <div className="border-t border-gray-100 pt-1 space-y-0.5">
          {data.chapters.map((c, i) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span className="truncate flex-1 pr-1">{c.label}</span>
              <span className="font-mono font-semibold text-gray-800 shrink-0">{c.amt}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 pt-1 space-y-0.5">
          <div className="flex justify-between text-gray-500">
            <span>{t("waDemo.preview.subtotal")}</span><span className="font-mono">{data.subtotale}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>{t("waDemo.preview.tax")}</span><span className="font-mono">{data.iva}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-[9px] pt-0.5">
            <span>{t("waDemo.preview.total")}</span><span className="font-mono">{data.totale}</span>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-2 py-1 text-[7px] text-gray-400 text-center">
        {t("waDemo.preview.generatedWith")}
      </div>
    </div>
  );
}

function PdfBubble({ filename }: { filename: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm flex items-center gap-2 px-2.5 py-2 w-[210px] border border-gray-100">
      <div className="w-8 h-9 bg-red-100 rounded flex flex-col items-center justify-center shrink-0">
        <div className="w-3.5 h-4 bg-red-500 rounded-sm flex items-center justify-center">
          <span className="text-white font-bold text-[5px]">PDF</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-semibold text-gray-800 truncate">{filename}</p>
        <p className="text-[7px] text-gray-400">48 KB · PDF</p>
      </div>
      <div className="w-5 h-5 rounded-full bg-navy-100 flex items-center justify-center shrink-0">
        <ArrowRight className="w-2.5 h-2.5 text-navy-600" />
      </div>
    </div>
  );
}

function formatChatText(text: string) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith("*") && p.endsWith("*")
            ? <strong key={j}>{p.slice(1, -1)}</strong>
            : <span key={j}>{p}</span>
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

function ChatBubble({ msg, previewData, t }: { msg: ChatMsg; previewData: ReturnType<typeof buildPreviewData>; t: (key: string) => string }) {
  const isBot = msg.from === "bot";

  if (isBot && msg.kind === "preview") {
    return (
      <div className="flex items-end gap-1.5 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <BotAvatar size={6} />
        <div>
          <PreviewCard data={previewData} t={t} />
          {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 ml-1">{msg.time}</p>}
        </div>
      </div>
    );
  }

  if (isBot && msg.kind === "pdf") {
    return (
      <div className="flex items-end gap-1.5 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <BotAvatar size={6} />
        <div>
          <PdfBubble filename={msg.text ?? "quote.pdf"} />
          {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 ml-1">{msg.time}</p>}
        </div>
      </div>
    );
  }

  if (!isBot && msg.kind === "voice") {
    return (
      <div className="flex flex-col items-end mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-[#d9fdd3] rounded-2xl rounded-br-sm px-2.5 py-1.5 shadow-sm flex items-center gap-2 max-w-[160px]">
          <div className="w-6 h-6 rounded-full bg-navy-600 flex items-center justify-center shrink-0">
            <Mic className="w-3 h-3 text-white" />
          </div>
          <div className="text-[#075e54]">
            <Waveform />
          </div>
          <span className="text-[8px] font-mono text-gray-500 shrink-0">{msg.text}</span>
        </div>
        {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 mr-1">{msg.time}</p>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isBot ? "items-start" : "items-end"}`}>
      <div className={`flex items-end gap-1.5 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <BotAvatar size={6} />}
        <div
          className={`px-2.5 py-1.5 rounded-2xl shadow-sm text-[9px] leading-relaxed max-w-[200px] ${
            isBot
              ? "bg-white text-gray-800 rounded-bl-sm"
              : "bg-[#d9fdd3] text-gray-900 rounded-br-sm"
          }`}
        >
          {formatChatText(msg.text ?? "")}
        </div>
      </div>
      {msg.time && (
        <p className={`text-[7px] text-gray-400 mt-0.5 ${isBot ? "ml-8" : "mr-1"}`}>{msg.time}</p>
      )}
    </div>
  );
}

// ── Main exported component ────────────────────────────────────────────────────

export function WhatsAppChatDemo() {
  const { t } = useLanguage();
  const phases = useMemo(() => buildPhases(t), [t]);
  const previewData = useMemo(() => buildPreviewData(t), [t]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const [phase, setPhase] = useState(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase < 0 || phase >= phases.length) return;
    const p = phases[phase]!;

    const timer = setTimeout(() => {
      if (p.action === "addMsg" && p.msg) {
        setMessages(prev => [...prev, p.msg!]);
        setBotTyping(false);
      } else if (p.action === "setTyping") {
        setBotTyping(true);
      } else if (p.action === "clearTyping") {
        setBotTyping(false);
      } else if (p.action === "reset") {
        setMessages([]);
        setBotTyping(false);
        setPhase(-1);
        return;
      }
      setPhase(prev => prev + 1);
    }, p.delay);

    return () => clearTimeout(timer);
  }, [phase, phases]);

  useEffect(() => {
    if (phase !== -1) return;
    const timer = setTimeout(() => setPhase(0), 50);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, botTyping]);

  return (
    <>
      <style>{`@keyframes wa-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
      <div className="relative mx-auto" style={{ width: 280 }}>
        <div className="relative bg-gray-900 rounded-[36px] p-[10px] shadow-2xl border border-gray-700">
          <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-b-xl z-20 flex items-center justify-center">
            <div className="w-10 h-2 bg-black rounded-full" />
          </div>

          <div className="bg-white rounded-[28px] overflow-hidden" style={{ height: 520 }}>
            <div className="bg-[#075e54] px-3 pt-7 pb-2 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
                <img src="/quoteai-icon.png" alt="QuoteAI" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[12px] leading-tight">QuoteAI</p>
                <p className="text-white/60 text-[9px]">{t("waDemo.botOnline")}</p>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-1 rounded-full bg-white/40" />
                <div className="w-1 h-1 rounded-full bg-white/40" />
                <div className="w-1 h-1 rounded-full bg-white/40" />
              </div>
            </div>

            <div
              ref={chatContainerRef}
              className="flex flex-col px-2 py-2 overflow-y-auto"
              style={{
                height: 420,
                background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\"), #efeae2",
              }}
            >
              {messages.map(msg => (
                <ChatBubble key={msg.id} msg={msg} previewData={previewData} t={t} />
              ))}
              {botTyping && <TypingIndicator />}
            </div>

            <div className="bg-[#f0f2f5] px-2 py-1.5 flex items-center gap-1.5 border-t border-gray-200">
              <div className="flex-1 bg-white rounded-full px-2.5 py-1.5 text-[9px] text-gray-400">
                {t("waDemo.typeMessage")}
              </div>
              <div className="w-6 h-6 rounded-full bg-[#075e54] flex items-center justify-center shrink-0">
                <Mic className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute -inset-6 rounded-full blur-3xl opacity-20 pointer-events-none -z-10"
          style={{ background: "radial-gradient(ellipse, #7c3aed 0%, transparent 70%)" }}
        />
      </div>
    </>
  );
}
