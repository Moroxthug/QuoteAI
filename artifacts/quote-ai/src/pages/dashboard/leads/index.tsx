import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Users, Search, Plus, Loader2, Send, Mail, Phone, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { leadsApi, type LeadDto, type LeadStatus } from "@/lib/leads-api";

const COLUMNS: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost", "unsubscribed"];

const CHANNEL_ICON = { email: Mail, sms: Phone, whatsapp: MessageCircle };

export default function LeadsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => leadsApi.list() });
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: () => leadsApi.create({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setCreateOpen(false);
      setForm({ name: "", email: "", phone: "", notes: "" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => leadsApi.update(id, { status }),
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
    statusMutation.mutate({ id, status });
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
          <button type="button" className="btn btn-navy" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("leads.newLead")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="kanban">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-[16px]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">{t("leads.empty")}</div>
      ) : (
        <div className="kanban">
          {COLUMNS.map((status) => {
            const leads = byColumn.get(status) ?? [];
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
                onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => handleDrop(status, e)}
                className={cn("kan-col", dragOverCol === status && "drop-over")}
              >
                <div className="kan-head">
                  <b>{t(`leads.status.${status}`)}</b>
                  <span className="chip chip-grey">{leads.length}</span>
                </div>
                {leads.length === 0 ? (
                  <div className="text-xs text-[var(--faint)] text-center py-6">{t("leads.column.empty")}</div>
                ) : (
                  leads.map((lead) => {
                    const ChannelIcon = CHANNEL_ICON[lead.preferredChannel];
                    const canSend = !["won", "lost", "unsubscribed"].includes(lead.status) && !!(lead.email || lead.phone);
                    return (
                      <div
                        key={lead.id}
                        draggable
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
                          <span className="flex items-center gap-1 text-xs text-[var(--faint)]">
                            <ChannelIcon className="h-3 w-3" />
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            disabled={!canSend || sendMutation.isPending}
                            onClick={() => sendMutation.mutate(lead.id)}
                          >
                            {sendMutation.isPending && sendMutation.variables === lead.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {t("leads.sendNow")}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leads.newLead")}</DialogTitle>
            <DialogDescription>{t("leads.newLeadDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("leads.field.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t("leads.field.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>{t("leads.field.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>{t("leads.field.notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!form.name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("leads.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
