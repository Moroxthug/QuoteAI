import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Search, Plus, Loader2, Send, Mail, Phone, MessageCircle, ArrowRight, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollTabs } from "@/components/mobile/scroll-tabs";
import { ActionSheet } from "@/components/mobile/action-sheet";
import { leadsApi, type LeadChannel, type LeadDto, type LeadStatus } from "@/lib/leads-api";
import { patch, useOptimisticMutation } from "@/lib/optimistic";

const COLUMNS: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost", "unsubscribed"];

const CHANNEL_ICON = { email: Mail, sms: Phone, whatsapp: MessageCircle };

export default function LeadsListPage() {
  const { t, lang } = useLanguage();
  const can = useCan();
  const phone = useMediaQuery("(max-width: 640px)");
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => leadsApi.list() });
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Phase 101: the phone New sheet opens this form with ?new=1 (then drops it, so Back does not reopen it).
  const query = useSearch();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (new URLSearchParams(query).get("new") !== "1") return;
    setCreateOpen(true);
    navigate("/dashboard/leads", { replace: true });
  }, [query, navigate]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "", preferredChannel: "email" as LeadChannel });
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Phase 107: on a phone the board is one stage at a time (tabs above, swipe between them).
  const [stage, setStage] = useState<LeadStatus | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q) || (l.phone ?? "").includes(q),
    );
  }, [data, search]);

  const byColumn = useMemo(() => {
    const map = new Map<LeadStatus, LeadDto[]>(COLUMNS.map((c) => [c, []]));
    for (const lead of items) map.get(lead.status)?.push(lead);
    return map;
  }, [items]);

  // Until a stage is picked: the first one that has leads.
  const shownStage: LeadStatus = stage ?? COLUMNS.find((c) => (byColumn.get(c)?.length ?? 0) > 0) ?? "new";
  const stepStage = (dir: 1 | -1) => {
    const i = COLUMNS.indexOf(shownStage) + dir;
    if (i >= 0 && i < COLUMNS.length) setStage(COLUMNS[i]!);
  };

  const createMutation = useMutation({
    mutationFn: () => leadsApi.create({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined, preferredChannel: form.phone ? form.preferredChannel : "email" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setCreateOpen(false);
      setForm({ name: "", email: "", phone: "", notes: "", preferredChannel: "email" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  // Phase 115: a lead moves to its new stage on the drop / tap, with Undo back to the old one.
  const statusMutation = useOptimisticMutation({
    mutationFn: ({ lead, status }: { lead: LeadDto; status: LeadStatus }) => leadsApi.update(lead.id, { status }),
    patch: ({ lead, status }) => [patch<{ items: LeadDto[] }>(["leads"], (d) => ({ ...d, items: d.items.map((l) => (l.id === lead.id ? { ...l, status } : l)) }))],
    undo: ({ lead, status }) => ({ title: t("undo.leadMoved").replace("{name}", lead.name).replace("{stage}", t(`leads.status.${status}`)), inverse: { lead: { ...lead, status }, status: lead.status } }),
  });

  // Phase 74: flip a lead between email and text follow-ups (needs a phone; records the SMS consent basis server-side).
  const channelMutation = useMutation({
    mutationFn: ({ id, preferredChannel }: { id: string; preferredChannel: LeadChannel }) => leadsApi.update(id, { preferredChannel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => leadsApi.sendNow(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: t("leads.sendNow"), description: `Sent via ${res.channel}` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const handleDrop = (status: LeadStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("text/lead-id");
    if (!id) return;
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    statusMutation.mutate({ lead, status });
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1>{t("leads.title")}</h1>
          <p className="sub">{t("leads.subtitle")}</p>
        </div>
        <div className="head-actions">
          <label className="search sm">
            <Search className="h-4 w-4" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("leads.search")} aria-label={t("leads.search")} />
          </label>
          {can("leads", "edit") && (
            <button type="button" className="btn btn-navy hide-phone" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t("leads.newLead")}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        // Phase 115: columns of lead cards, as the board will be (one column on a phone).
        <div className={cn("kanban skel-wait", phone && "one")} aria-busy="true">
          {(phone ? [3] : [3, 2, 2, 1]).map((n, i) => (
            <div key={i} className="kan-col" aria-hidden="true">
              <div className="kan-head"><Skeleton className="skel-line skel-title" style={{ width: 84 }} /></div>
              {Array.from({ length: n }, (_, j) => <Skeleton key={j} className="h-[112px] w-full rounded-[12px]" />)}
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">{t("leads.empty")}</div>
      ) : (
        <>
        {phone && (
          <ScrollTabs
            tabs={COLUMNS.map((c) => ({ id: c, label: t(`leads.status.${c}`), count: byColumn.get(c)?.length ?? 0 }))}
            value={shownStage}
            onChange={(id) => setStage(id as LeadStatus)}
            sticky
            label={t("leads.m.stages")}
          />
        )}
        <div
          className={cn("kanban", phone && "one")}
          onTouchStart={phone ? (e) => { const p = e.touches[0]!; touch.current = { x: p.clientX, y: p.clientY }; } : undefined}
          onTouchEnd={phone ? (e) => {
            const s = touch.current; touch.current = null;
            const p = e.changedTouches[0];
            if (!s || !p) return;
            const dx = p.clientX - s.x, dy = p.clientY - s.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepStage(dx < 0 ? 1 : -1);
          } : undefined}
        >
          {(phone ? [shownStage] : COLUMNS).map((status) => {
            const leads = byColumn.get(status) ?? [];
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
                onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => handleDrop(status, e)}
                className={cn("kan-col", dragOverCol === status && "drop-over")}
              >
                <div className={cn("kan-head", phone && "hide-phone")}>
                  <b>{t(`leads.status.${status}`)}</b>
                  <span className="chip chip-grey">{leads.length}</span>
                </div>
                {leads.length === 0 ? (
                  <div className="text-xs text-[var(--muted-mk)] text-center py-6">{t("leads.column.empty")}</div>
                ) : (
                  leads.map((lead) => {
                    const ChannelIcon = CHANNEL_ICON[lead.preferredChannel];
                    const canSend = !["won", "lost", "unsubscribed"].includes(lead.status) && !!(lead.email || lead.phone);
                    return (
                      <div
                        key={lead.id}
                        draggable={can("leads", "edit")}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/lead-id", lead.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(lead.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={cn("kan-card", draggingId === lead.id && "dragging")}
                      >
                        <b>{lead.name}</b>
                        <p className="ksub">
                          {t(`leads.source.${lead.source}`)} · {lead.email || lead.phone || "—"}
                        </p>
                        {lead.nextFollowUpAt && (
                          <p className="ksub" style={{ marginTop: -8 }}>
                            {t("leads.nextFollowUp")}: {formatDistanceToNow(new Date(lead.nextFollowUpAt), { addSuffix: true, locale })}
                          </p>
                        )}
                        <div className="kan-foot">
                          {can("leads", "edit") && (
                            <ActionSheet
                              title={t("leads.m.moveTitle").replace("{name}", lead.name)}
                              trigger={<button type="button" className="ic-btn kan-move" aria-label={t("leads.m.moveTitle").replace("{name}", lead.name)}><MoreHorizontal /></button>}
                              actions={COLUMNS.filter((c) => c !== lead.status).map((c) => ({
                                label: t("leads.m.moveTo").replace("{stage}", t(`leads.status.${c}`)),
                                icon: ArrowRight,
                                onSelect: () => statusMutation.mutate({ lead, status: c }),
                              }))}
                            />
                          )}
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-[var(--faint)] hover:text-foreground disabled:cursor-default"
                            title={t(lead.preferredChannel === "sms" ? "leads.channel.switchToEmail" : "leads.channel.switchToSms")}
                            aria-label={t(`leads.channel.${lead.preferredChannel}`)}
                            disabled={!lead.phone || lead.preferredChannel === "whatsapp" || channelMutation.isPending || !can("leads", "edit")}
                            onClick={() => channelMutation.mutate({ id: lead.id, preferredChannel: lead.preferredChannel === "sms" ? "email" : "sms" })}
                          >
                            <ChannelIcon className="h-3 w-3" />
                            <span>{t(`leads.channel.${lead.preferredChannel}`)}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-navy"
                            style={{ padding: "6px 12px", fontSize: 12.5 }}
                            disabled={!canSend || sendMutation.isPending || !can("leads", "edit")}
                            onClick={() => sendMutation.mutate(lead.id)}
                          >
                            {sendMutation.isPending && sendMutation.variables === lead.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {t("leads.sendNow")}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leads.newLead")}</DialogTitle>
            <DialogDescription>{t("leads.newLeadDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <label>{t("leads.field.name")}</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>{t("leads.field.email")}</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("leads.field.phone")}</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>{t("leads.field.channel")}</label>
              <select value={form.phone ? form.preferredChannel : "email"} disabled={!form.phone} onChange={(e) => setForm((f) => ({ ...f, preferredChannel: e.target.value as LeadChannel }))}>
                <option value="email">{t("leads.channel.email")}</option>
                <option value="sms">{t("leads.channel.sms")}</option>
              </select>
              <span className="text-xs text-muted-foreground mt-1 block">{t("leads.field.channelHint")}</span>
            </div>
            <div className="field">
              <label>{t("leads.field.notes")}</label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setCreateOpen(false)}>{t("jobs.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" disabled={!form.name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("leads.create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
