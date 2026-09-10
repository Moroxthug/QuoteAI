import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Receipt,
  Search,
  Filter,
  ArrowUpRight,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus
} from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  clientName: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "pagata" | "in_attesa" | "scaduta";
  provider: "Fatture in Cloud";
}

const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv1",
    number: "FAT-2026-104",
    clientName: "Isolamento Termico Cappotto - Residenza Verde",
    amount: 68000,
    date: "2026-06-15",
    dueDate: "2026-07-15",
    status: "in_attesa",
    provider: "Fatture in Cloud",
  },
  {
    id: "inv2",
    number: "FAT-2026-101",
    clientName: "Condominio Aurora (Acconto Rifacimento Tetto)",
    amount: 12600,
    date: "2026-05-10",
    dueDate: "2026-06-10",
    status: "pagata",
    provider: "Fatture in Cloud",
  },
  {
    id: "inv3",
    number: "FAT-2026-098",
    clientName: "Studio Tecnico Rossi (Consulenza Progettazione)",
    amount: 3200,
    date: "2026-04-05",
    dueDate: "2026-05-05",
    status: "scaduta",
    provider: "Fatture in Cloud",
  },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pagata" | "in_attesa" | "scaduta">("all");

  const filtered = invoices.filter((inv) => {
    const matchesSearch = inv.number.toLowerCase().includes(search.toLowerCase()) || 
                          inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "pagata":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-3 w-3" /> Pagata
          </span>
        );
      case "in_attesa":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
            <ClockIcon className="h-3 w-3" /> In Attesa
          </span>
        );
      case "scaduta":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
            <AlertCircle className="h-3 w-3" /> Scaduta
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="h-8 w-8 text-blue-600" />
            Fatture Elettroniche
          </h1>
          <p className="text-slate-500 mt-1">
            Visualizza e sincronizza le tue fatture elettroniche con il tuo account Fatture in Cloud.
          </p>
        </div>

        <a
          href="https://mock.fattureincloud.it"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
        >
          Apri Pannello Fatture in Cloud
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50/50">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Fatturato Incassato</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">
              ${invoices.filter(i => i.status === "pagata").reduce((acc, i) => acc + i.amount, 0).toLocaleString("en-CA")}
            </h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-orange-50/50">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-amber-600 uppercase">Pendenze Attive</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">
              ${invoices.filter(i => i.status === "in_attesa").reduce((acc, i) => acc + i.amount, 0).toLocaleString("en-CA")}
            </h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-red-50 to-pink-50/50">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-red-600 uppercase">Scadute / Insolute</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">
              ${invoices.filter(i => i.status === "scaduta").reduce((acc, i) => acc + i.amount, 0).toLocaleString("en-CA")}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per numero fattura o cantiere..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Tutti gli stati</option>
            <option value="pagata">Pagate</option>
            <option value="in_attesa">In Attesa</option>
            <option value="scaduta">Scadute</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold">
                  <th className="p-4">Numero</th>
                  <th className="p-4">Cantiere / Cliente</th>
                  <th className="p-4">Importo</th>
                  <th className="p-4">Scadenza</th>
                  <th className="p-4">Stato</th>
                  <th className="p-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-700">{inv.number}</td>
                    <td className="p-4 text-slate-600 font-medium">{inv.clientName}</td>
                    <td className="p-4 font-bold text-slate-800">${inv.amount.toLocaleString("en-CA")}</td>
                    <td className="p-4 text-slate-500">{inv.dueDate}</td>
                    <td className="p-4">{getStatusBadge(inv.status)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition" title="Scarica PDF">
                          <Download className="h-4 w-4" />
                        </button>
                        <a
                          href={`https://mock.fattureincloud.it/documenti/fatture`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                          title="Visualizza in Fatture in Cloud"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
