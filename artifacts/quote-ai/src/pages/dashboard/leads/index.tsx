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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { leadsApi, type LeadDto, type LeadStatus } from "@/lib/leads-api";

const FILTERS: (LeadStatus | "all")[] = ["all", "new", "contacted", "quoted", "won", "lost", "unsubscribed"];

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  quoted: "bg-violet-100 text-violet-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-200 text-slate-600",
  unsubscribed: "bg-red-100 text-red-700",
};

const CHANNEL_ICON = { email: Mail, sms: Phone, whatsapp: MessageCircle };

export default function LeadsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => leadsApi.list() });
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((l) => {
      const inFilter = filter === "all" || l.status === filter;
      const inSearch = !q || l.name.toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q) || (l.phone ?? "").includes(q);
      return inFilter && inSearch;
    });
  }, [data, filter, search]);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-violet-600" />
            {t("leads.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("leads.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("leads.newLead")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder={t("leads.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                filter === f ? "bg-violet-600 text-white border-violet-600" : "bg-card text-slate-600 border-slate-200 hover:border-violet-300",
              )}
            >
              {f === "all" ? t("leads.filter.all") : t(`leads.status.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed rounded-lg">{t("leads.empty")}</div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {items.map((lead) => {
            const ChannelIcon = CHANNEL_ICON[lead.preferredChannel];
            const canSend = !["won", "lost", "unsubscribed"].includes(lead.status) && !!(lead.email || lead.phone);
            return (
              <div key={lead.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-slate-900">{lead.name}</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1">
                    <ChannelIcon className="h-3.5 w-3.5" />
                    {lead.email || lead.phone || "—"}
                  </div>
                </div>
                <Badge variant="secondary" className="font-normal">{t(`leads.source.${lead.source}`)}</Badge>
                <Select value={lead.status} onValueChange={(status) => statusMutation.mutate({ id: lead.id, status: status as LeadStatus })}>
                  <SelectTrigger className={cn("w-[140px] h-8 text-xs font-medium border-0", STATUS_COLORS[lead.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["new", "contacted", "quoted", "won", "lost", "unsubscribed"] as LeadStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{t(`leads.status.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lead.nextFollowUpAt && (
                  <div className="text-xs text-slate-400 min-w-[120px]">
                    {t("leads.nextFollowUp")}: {formatDistanceToNow(new Date(lead.nextFollowUpAt), { addSuffix: true, locale })}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!canSend || sendMutation.isPending}
                  onClick={() => sendMutation.mutate(lead.id)}
                >
                  {sendMutation.isPending && sendMutation.variables === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {t("leads.sendNow")}
                </Button>
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
