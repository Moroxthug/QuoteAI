import { Receipt } from "lucide-react";

export default function InvoicesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <Receipt className="h-8 w-8 text-blue-600" />
          Invoicing
        </h1>
        <p className="text-slate-500 mt-1">
          Track and sync your invoices from quoteai.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-800">Coming soon</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
          Invoicing is on our roadmap. When it launches, you'll be able to track payment status
          and sync invoices directly from your quotes.
        </p>
      </div>
    </div>
  );
}
