import { useListClients } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users, ChevronRight, DollarSign, FileText, Clock, MapPin, Mail, Phone, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

export default function ClientsPage() {
  const { data: clients, isLoading } = useListClients();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground mt-1">
          All clients extracted from your quotes.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-navy-50 flex items-center justify-center">
              <Users className="h-6 w-6 text-navy-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No clients yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clients will show up here as soon as you create quotes with a client name.
              </p>
            </div>
            <Link href="/dashboard/new" className="btn-gradient inline-flex h-9 items-center px-4 text-sm font-semibold mt-2">
              Create your first quote
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="block"
            >
              <Card className="hover:shadow-sm hover:border-navy-200 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-navy-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-navy-700 uppercase">
                        {client.clientName.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{client.clientName}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {client.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {client.phone}
                          </span>
                        )}
                        {!client.email && (client.city || client.indirizzo) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {client.city
                              ? client.city + (client.province ? ` (${client.province})` : "")
                              : client.indirizzo}
                          </span>
                        )}
                        {client.partitaIva && (
                          <span className="text-xs text-muted-foreground">Tax ID: {client.partitaIva}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {client.quoteCount} {client.quoteCount === 1 ? "quote" : "quotes"}
                        </span>
                        {client.unlockedCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-navy-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {client.unlockedCount} accepted
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(client.totalValue)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(client.lastQuoteDate), "dd MMM yyyy", { locale: enCA })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
