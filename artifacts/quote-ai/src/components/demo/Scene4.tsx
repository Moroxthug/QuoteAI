import { motion, useAnimation } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

/* ── DATA ─────────────────────────────────────────────────── */
function buildChapters(t: (key: string) => string) {
  return [
    {
      lettera: 'A',
      titolo: t('scene4.chapterA.title'),
      osservazione: t('scene4.chapterA.note'),
      voci: [
        { descrizione: t('scene4.chapterA.item1'), um: 'sq.ft', quantita: 194, prezzoUnitario: 1.10 },
        { descrizione: t('scene4.chapterA.item2'), um: 'cu.yd', quantita: 2, prezzoUnitario: 65.00 },
      ],
    },
    {
      lettera: 'B',
      titolo: t('scene4.chapterB.title'),
      osservazione: t('scene4.chapterB.note'),
      voci: [
        { descrizione: t('scene4.chapterB.item1'), um: 'ea', quantita: 1, prezzoUnitario: 320.00 },
        { descrizione: t('scene4.chapterB.item2'), um: 'ea', quantita: 1, prezzoUnitario: 580.00 },
        { descrizione: t('scene4.chapterB.item3'), um: 'ea', quantita: 1, prezzoUnitario: 490.00 },
      ],
    },
    {
      lettera: 'C',
      titolo: t('scene4.chapterC.title'),
      osservazione: t('scene4.chapterC.note'),
      voci: [
        { descrizione: t('scene4.chapterC.item1'), um: 'ln.ft', quantita: 46, prezzoUnitario: 9.50 },
        { descrizione: t('scene4.chapterC.item2'), um: 'ea', quantita: 2, prezzoUnitario: 145.00 },
        { descrizione: t('scene4.chapterC.item3'), um: 'ea', quantita: 1, prezzoUnitario: 180.00 },
      ],
    },
  ];
}

function subtotale(cap: ReturnType<typeof buildChapters>[0]) {
  return cap.voci.reduce((s, v) => s + v.quantita * v.prezzoUnitario, 0);
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

/* ── COMPONENT ────────────────────────────────────────────── */
export function Scene4() {
  const { t } = useLanguage();
  const CAPITOLI = useMemo(() => buildChapters(t), [t]);
  const CONDIZIONI = useMemo(() => [
    t('scene4.terms1'),
    t('scene4.terms2'),
    t('scene4.terms3'),
  ], [t]);
  const SUBTOTALE = useMemo(() => CAPITOLI.reduce((s, c) => s + subtotale(c), 0), [CAPITOLI]);
  const TAX_PERC = 13;
  const TAX_VAL = SUBTOTALE * (TAX_PERC / 100);
  const TOTALE = SUBTOTALE + TAX_VAL;

  const [phase, setPhase] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(['A', 'B']));
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollCtrl = useAnimation();

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(() => setPhase(5), 5500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Auto-scroll the quote card after phase 4
  useEffect(() => {
    if (phase >= 4) {
      void scrollCtrl.start({ y: -420 } as Parameters<typeof scrollCtrl.start>[0], { duration: 4.5, ease: 'easeInOut' });
    }
  }, [phase, scrollCtrl]);

  // Expand chapter C once we start scrolling
  useEffect(() => {
    if (phase >= 5) setExpandedChapters(new Set(['A', 'B', 'C']));
  }, [phase]);

  const logoSrc = `${import.meta.env.BASE_URL}quoteai-logo.png`;

  return (
    <motion.div
      className="absolute inset-0 flex items-stretch"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* ── LEFT: headline ─────────────────────────────────── */}
      <div className="w-[32%] flex flex-col justify-center pl-[7vw] pr-8 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="font-black tracking-tighter text-slate-900 leading-[1.08]"
            style={{ fontSize: '3.6vw' }}
          >
            {t('scene4.headlineLine1')}<br />
            <span className="gradient-text">{t('scene4.headlineLine2')}</span><br />
            {t('scene4.headlineLine3')}
          </div>
          <motion.p
            className="text-slate-500 mt-5 font-medium leading-relaxed"
            style={{ fontSize: '1.1vw' }}
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
          >
            {t('scene4.subLine1')}<br />
            {t('scene4.subLine2')}<br />
            {t('scene4.subLine3')}
          </motion.p>
        </motion.div>
      </div>

      {/* ── RIGHT: quote card (exact [id].tsx replica) ─────── */}
      <div className="flex-1 flex items-start justify-center py-[2vh] pr-[5vw] overflow-hidden">
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.97 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, scale: 1 } : {}}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          style={{
            width: '100%',
            maxWidth: '42vw',
            height: '96vh',
            overflow: 'hidden',
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)',
            background: '#fff',
          }}
        >
          {/* Scrolling inner container — mirrors the Card content from [id].tsx */}
          <motion.div
            ref={scrollRef}
            animate={scrollCtrl}
            style={{ willChange: 'transform' }}
          >
            {/* ── Exact replica of <div className="p-8 sm:p-10 ..."> ── */}
            <div style={{ padding: '2.2vw 2.4vw', color: '#000', background: '#fff' }}>

              {/* COMPANY HEADER — mirrors lines 577-602 */}
              <motion.div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: '1.5vw',
                  marginBottom: '1.5vw',
                  borderBottom: '2px solid #1e293b',
                }}
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5 }}
              >
                {/* Left: logo + company info */}
                <div>
                  <img
                    src={logoSrc}
                    alt="Logo"
                    style={{ maxHeight: '2.4vw', maxWidth: '8vw', objectFit: 'contain', marginBottom: '0.4vw' }}
                  />
                  <div style={{ fontSize: '1vw', fontWeight: 700, color: '#1e293b' }}>
                    {t('scene4.companyName')}
                  </div>
                  <div style={{ fontSize: '0.65vw', color: '#64748b', marginTop: '0.2vw' }}>
                    {t('scene4.businessNumberLabel')}: 845209183 RT0001
                  </div>
                  <div style={{ fontSize: '0.65vw', color: '#64748b' }}>
                    {t('scene4.companyAddress')}
                  </div>
                  <div style={{ fontSize: '0.65vw', color: '#64748b' }}>(416) 555-0198</div>
                  <div style={{ fontSize: '0.65vw', color: '#64748b' }}>info@rossiplumbing.ca</div>
                </div>
                {/* Right: quote number + date */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.6vw', fontWeight: 600, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {t('scene4.quoteLabel')}
                  </div>
                  <div style={{ fontSize: '0.8vw', fontWeight: 700, color: '#334155', marginTop: '0.3vw' }}>
                    QTE-2025/047
                  </div>
                  <div style={{ fontSize: '0.6vw', color: '#64748b', marginTop: '0.2vw' }}>
                    {t('scene4.dateLabel')}: 2025-05-15
                  </div>
                </div>
              </motion.div>

              {/* DOCUMENT TITLE */}
              <motion.div
                style={{ textAlign: 'center', marginBottom: '0.4vw' }}
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div style={{ fontSize: '0.75vw', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1e293b' }}>
                  {t('scene4.docTitle')}
                </div>
                <div style={{ fontSize: '0.62vw', color: '#64748b', fontStyle: 'italic', marginTop: '0.15vw' }}>
                  {t('scene4.docSubtitle')}
                </div>
              </motion.div>

              {/* SPETT.LE COMMITTENTE — mirrors lines 632-720 */}
              <motion.div
                style={{ marginTop: '1vw', marginBottom: '1.2vw' }}
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <div style={{
                  fontSize: '0.58vw', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.4vw',
                }}>
                  {t('scene4.billTo')}
                </div>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '0.5vw 0.8vw',
                }}>
                  <div style={{ fontSize: '0.75vw', fontWeight: 600, color: '#1e293b' }}>
                    {t('scene4.clientName')}
                  </div>
                  <div style={{ fontSize: '0.62vw', color: '#64748b' }}>
                    {t('scene4.clientAddress')}
                  </div>
                </div>
              </motion.div>

              {/* 1. QUADRO SINTETICO — mirrors lines 724-750 */}
              <motion.div
                style={{ marginBottom: '1.2vw' }}
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5 }}
              >
                <div style={{
                  fontSize: '0.58vw', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.4vw',
                }}>
                  {t('scene4.summaryTitle')}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65vw' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#fff' }}>
                      <th style={{ padding: '0.35vw 0.5vw', textAlign: 'left', fontWeight: 600 }}>{t('scene4.colChapter')}</th>
                      <th style={{ padding: '0.35vw 0.5vw', textAlign: 'right', fontWeight: 600 }}>{t('scene4.colNetAmount')}</th>
                      <th style={{ padding: '0.35vw 0.5vw', textAlign: 'left', fontWeight: 600 }}>{t('scene4.colNote')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAPITOLI.map((cap, i) => (
                      <tr key={cap.lettera} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '0.3vw 0.5vw', color: '#334155' }}>
                          {cap.lettera}. {cap.titolo}
                        </td>
                        <td style={{ padding: '0.3vw 0.5vw', textAlign: 'right', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap' }}>
                          {fmt(subtotale(cap))}
                        </td>
                        <td style={{ padding: '0.3vw 0.5vw', color: '#94a3b8', fontStyle: 'italic' }}>
                          {cap.osservazione}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>

              {/* 2. COMPUTO METRICO DETTAGLIATO — mirrors lines 1189-1240 */}
              <motion.div
                style={{ marginBottom: '1.2vw' }}
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div style={{
                  fontSize: '0.58vw', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.6vw',
                }}>
                  {t('scene4.detailedBreakdownTitle')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5vw' }}>
                  {CAPITOLI.map((cap, ci) => {
                    const isExpanded = expandedChapters.has(cap.lettera);
                    return (
                      <motion.div
                        key={cap.lettera}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}
                        initial={{ opacity: 0, x: -12 }}
                        animate={phase >= 4 ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.45, delay: ci * 0.15 }}
                      >
                        {/* Chapter accordion header — mirrors lines 1198-1207 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45vw 0.7vw',
                          background: '#f1f5f9',
                          cursor: 'default',
                        }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.7vw' }}>
                            {cap.lettera}. {cap.titolo}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
                            <span style={{ fontSize: '0.7vw', fontWeight: 600, color: '#334155' }}>
                              {fmt(subtotale(cap))}
                            </span>
                            {/* ChevronDown / Right icon */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              {isExpanded
                                ? <polyline points="6 9 12 15 18 9" />
                                : <polyline points="9 6 15 12 9 18" />
                              }
                            </svg>
                          </div>
                        </div>

                        {/* Voci table — mirrors lines 1208-1235 */}
                        {isExpanded && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.62vw' }}>
                            <thead>
                              <tr style={{ background: '#334155', color: '#fff' }}>
                                <th style={{ padding: '0.3vw 0.5vw', textAlign: 'left', fontWeight: 500 }}>{t('scene4.colDescription')}</th>
                                <th style={{ padding: '0.3vw 0.35vw', textAlign: 'center', fontWeight: 500, width: '7%' }}>{t('scene4.colUnit')}</th>
                                <th style={{ padding: '0.3vw 0.35vw', textAlign: 'center', fontWeight: 500, width: '7%' }}>{t('scene4.colQty')}</th>
                                <th style={{ padding: '0.3vw 0.5vw', textAlign: 'right', fontWeight: 500, width: '12%' }}>{t('scene4.colUnitPrice')}</th>
                                <th style={{ padding: '0.3vw 0.5vw', textAlign: 'right', fontWeight: 500, width: '13%' }}>{t('scene4.colTotal')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cap.voci.map((voce, vi) => (
                                <tr key={vi} style={{ background: vi % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                  <td style={{ padding: '0.3vw 0.5vw', color: '#334155' }}>{voce.descrizione}</td>
                                  <td style={{ padding: '0.3vw 0.35vw', textAlign: 'center', color: '#64748b' }}>{voce.um}</td>
                                  <td style={{ padding: '0.3vw 0.35vw', textAlign: 'center', color: '#64748b' }}>{voce.quantita}</td>
                                  <td style={{ padding: '0.3vw 0.5vw', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>
                                    {fmt(voce.prezzoUnitario)}
                                  </td>
                                  <td style={{ padding: '0.3vw 0.5vw', textAlign: 'right', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                    {fmt(voce.quantita * voce.prezzoUnitario)}
                                  </td>
                                </tr>
                              ))}
                              {/* Subtotale row — mirrors lines 1229-1232 */}
                              <tr style={{ background: '#e2e8f0' }}>
                                <td colSpan={4} style={{ padding: '0.3vw 0.5vw', fontWeight: 700, color: '#334155', textAlign: 'right', fontSize: '0.6vw' }}>
                                  {t('scene4.chapterSubtotal')} {cap.lettera}
                                </td>
                                <td style={{ padding: '0.3vw 0.5vw', textAlign: 'right', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                  {fmt(subtotale(cap))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* TOTALI — mirrors lines 1267-1346 */}
              <motion.div
                style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.4vw', marginBottom: '1.2vw' }}
                initial={{ opacity: 0, y: 12 }}
                animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.45 }}
              >
                <div style={{
                  width: '14vw',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  fontSize: '0.7vw',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45vw 0.8vw', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                    <span>{t('scene4.subtotalLabel')}:</span>
                    <span style={{ fontWeight: 500 }}>{fmt(SUBTOTALE)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45vw 0.8vw', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                    <span>{t('scene4.taxLabel')} ({TAX_PERC}%):</span>
                    <span style={{ fontWeight: 500 }}>{fmt(TAX_VAL)}</span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '0.55vw 0.8vw',
                    background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.75vw',
                  }}>
                    <span>{t('scene4.totalLabel')}</span>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={phase >= 4 ? { opacity: 1 } : {}}
                      transition={{ delay: 0.7 }}
                    >
                      {fmt(TOTALE)}
                    </motion.span>
                  </div>
                </div>
              </motion.div>

              {/* CONDIZIONI DI PAGAMENTO — mirrors lines 1382-1393 */}
              <motion.div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '0.8vw',
                  marginBottom: '1.2vw',
                }}
                initial={{ opacity: 0 }}
                animate={phase >= 4 ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <div style={{
                  fontSize: '0.58vw', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5vw',
                }}>
                  {t('scene4.paymentTermsTitle')}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3vw' }}>
                  {CONDIZIONI.map((cond, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4vw', fontSize: '0.63vw', color: '#334155' }}>
                      {/* CheckCircle2 icon — matches [id].tsx line 1388 */}
                      <svg style={{ flexShrink: 0, marginTop: '0.05vw', color: '#94a3b8' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span style={{ fontWeight: 500, textTransform: 'uppercase' }}>{cond}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
