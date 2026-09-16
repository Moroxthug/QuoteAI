import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Users, Search, Plus, Loader2, Send, Mail, Phone, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { leadsApi, type LeadDto, type LeadStatus } from "@/lib/leads-api";

const COLUMNS: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost", "unsubscribed"];

const COLUMN_STYLES: Record<LeadStatus, { dot: string; header: string }> = {
  new: { dot: "bg-blue-500", header: "text-blue-700" },
  contacted: { dot: "bg-amber-500", header: "text-amber-700" },
  quoted: { dot: "bg-[var(--qa-purple)]", header: "text-[var(--qa-purple)]" },
  won: { dot: "bg-[var(--qa-green)]", header: "text-[var(--qa-green-dark)]" },
  lost: { dot: "bg-slate-400", header: "text-slate-600" },
  unsubscribed: { dot: "bg-[var(--qa-red)]", header: "text-[var(--qa-red)]" },
};

const CARD_BADGE: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  quoted: "bg-[var(--qa-purple-t)] text-[var(--qa-purple)]",
  won: "bg-[var(--qa-green-t)] text-[var(--qa-green-dark)]",
  lost: "bg-slate-200 text-slate-600",
  unsubscribed: "bg-[var(--qa-red-t)] text-[var(--qa-red)]",
};

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
    const id = e.dataTransfer.getData("text/lead-id");
    if (!id) return;
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    statusMutation.mutate({ id, status });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-navy-600" />
            {t("leads.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("leads.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("leads.newLead")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder={t("leads.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed rounded-[var(--radius)]">{t("leads.empty")}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {COLUMNS.map((status) => {
            const leads = byColumn.get(status) ?? [];
            const style = COLUMN_STYLES[status];
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(status);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => handleDrop(status, e)}
                className={cn(
                  "flex-1 min-w-[260px] max-w-[300px] rounded-[var(--radius)] bg-slate-50/70 border border-slate-200/80 flex flex-col transition-colors",
                  dragOverCol === status && "bg-navy-50 border-navy-300",
                )}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/80">
                  <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", style.header)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {t(`leads.status.${status}`)}
                  </div>
                  <Badge variant="secondary" className="font-normal text-xs">{leads.length}</Badge>
                </div>
                <div className="flex-1 space-y-2 p-2 min-h-[80px]">
                  {leads.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-6">{t("leads.column.empty")}</div>
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
                          }}
                          className="rounded-[var(--radius-sm)] border border-slate-200 bg-card p-3 shadow-[0_1px_3px_rgba(16,16,49,0.06)] cursor-grab active:cursor-grabbing hover:shadow-[0_4px_12px_rgba(16,16,49,0.10)] transition-shadow space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-slate-900 leading-tight">{lead.name}</div>
                            <Badge className={cn("text-[10px] font-normal shrink-0", CARD_BADGE[lead.status])} variant="secondary">
                              {t(`leads.source.${lead.source}`)}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                            <ChannelIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.email || lead.phone || "—"}</span>
                          </div>
                          {lead.nextFollowUpAt && (
                            <div className="text-[11px] text-slate-400">
                              {t("leads.nextFollowUp")}: {formatDistanceToNow(new Date(lead.nextFollowUpAt), { addSuffix: true, locale })}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5 h-7 text-xs"
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
                      );
                    })
                  )}
                </div>
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
