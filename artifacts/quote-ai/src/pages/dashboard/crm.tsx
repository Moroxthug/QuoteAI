import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  TrendingUp,
  AlertCircle,
  Building2,
  Receipt,
  FolderOpen,
  BarChart3,
  Calendar,
  Settings,
  Plus,
  CheckCircle2,
  DollarSign,
  Clock,
  ArrowUpRight,
  FileText,
  Loader2,
  UserPlus,
  TrendingDown,
  Hammer,
  Search,
  ChevronRight,
  Info,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  Mail,
  Sparkles,
  X,
  BookOpen,
  Menu
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { PriceCatalogSection } from "@/components/price-catalog-section";
import { useLanguage } from "@/i18n/LanguageContext";



// Tipi allineati allo schema reale del backend (lib/db/src/schema/crm.ts).
// budget/hourlyRate/amount arrivano dal DB in centesimi (integer); vengono
// convertiti in euro solo per la visualizzazione tramite centsToEuro().
interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
}

interface Project {
  id: string;
  userId: string;
  quoteId: string | null;
  name: string;
  description: string;
  status: "planning" | "active" | "suspended" | "completed";
  startDate: string | null;
  endDate: string | null;
  budget: number; // centesimi
  createdAt: string;
}

interface Collaborator {
  id: string;
  userId: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  hourlyRate: number; // centesimi
}

interface Supplier {
  id: string;
  userId: string;
  name: string;
  category: string;
  contactInfo: string;
  email: string | null;
  phone: string | null;
}

interface ExtraCost {
  id: string;
  projectId: string;
  description: string;
  amount: number; // centesimi
  date: string;
}

interface ProjectAssignment {
  id: string;
  projectId: string;
  collaboratorId: string;
  roleInProject: string;
  collaboratorName: string;
  collaboratorRole: string;
  collaboratorHourlyRate: number;
}

const centsToEuro = (c: number) => Math.round(c) / 100;
const euroToCents = (e: number) => Math.round(e * 100);

const INITIAL_PRATICHE = [
  { title: "CILA - 45 Roma St", status: "Approved", date: "2026-05-02", prot: "CILA-2026/8892" },
  { title: "SCIA - Aurora Condominium Renovation", status: "In Progress", date: "2026-07-10", prot: "SCIA-2026/1029" },
  { title: "Completion & APE - Residenza Verde", status: "Ready", date: "2026-06-20", prot: "APE-251412" },
];

const SECTION_TITLE_KEYS: Record<string, string> = {
  dashboard: "dashboard.crm.section.dashboard",
  cantieri: "dashboard.crm.section.projects",
  lavoratori: "dashboard.crm.section.workforce",
  finanze: "dashboard.crm.section.finance",
  costi_extra: "dashboard.crm.section.extraCosts",
  fornitori: "dashboard.crm.section.suppliers",
  fatturazione: "dashboard.crm.section.invoicing",
  pratiche: "dashboard.crm.section.permits",
  analytics: "dashboard.crm.section.analytics",
  calendario: "dashboard.crm.section.calendar",
  impostazioni: "dashboard.crm.section.settings",
  listino: "dashboard.crm.section.catalog",
  sal: "dashboard.crm.section.sal",
};

export default function CrmPage() {
  const { t } = useLanguage();
  const PROJECT_STATUS_LABELS: Record<string, string> = {
    planning: t("dashboard.crm.projects.statusPlanning"),
    active: t("dashboard.crm.projects.statusActive"),
    suspended: t("dashboard.crm.projects.statusSuspended"),
    completed: t("dashboard.crm.projects.statusCompleted"),
  };
  const [activeSection, setActiveSection] = useState<
    | "dashboard"
    | "cantieri"
    | "lavoratori"
    | "finanze"
    | "costi_extra"
    | "fornitori"
    | "fatturazione"
    | "pratiche"
    | "analytics"
    | "calendario"
    | "impostazioni"
    | "listino"
    | "sal"
  >("dashboard");

  // Dati reali dal backend CRM (artifacts/api-server/src/routes/crm.ts).
  // "pratiche" (CILA/SCIA/APE) resta locale: non esiste ancora una tabella
  // dedicata nel backend per le pratiche edilizie.
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTask[]>>({});
  const [extraCosts, setExtraCosts] = useState<Record<string, ExtraCost[]>>({});
  const [assignments, setAssignments] = useState<Record<string, ProjectAssignment[]>>({});
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [invoiceResults, setInvoiceResults] = useState<Record<string, { number: string; url: string; total: number }>>({});

  const [pratiche, setPratiche] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("quoteai_crm_pratiche") : null;
    return saved ? JSON.parse(saved) : INITIAL_PRATICHE;
  });

  React.useEffect(() => {
    localStorage.setItem("quoteai_crm_pratiche", JSON.stringify(pratiche));
  }, [pratiche]);

  async function crmFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
    const r = await fetch(path, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || t("dashboard.crm.errors.genericStatus").replace("{status}", String(r.status)));
    }
    if (r.status === 204) return null as T;
    return r.json();
  }

  // Caricamento iniziale: cantieri, collaboratori, fornitori
  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingProjects(true);
    crmFetch<Project[]>("/api/crm/projects")
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch((err) => { console.error("Errore caricamento cantieri", err); if (!cancelled) setCrmError(t("dashboard.crm.errors.loadProjects")); })
      .finally(() => { if (!cancelled) setIsLoadingProjects(false); });
    crmFetch<Collaborator[]>("/api/crm/collaborators")
      .then((data) => { if (!cancelled) setCollaborators(data); })
      .catch((err) => console.error("Errore caricamento collaboratori", err));
    crmFetch<Supplier[]>("/api/crm/suppliers")
      .then((data) => { if (!cancelled) setSuppliers(data); })
      .catch((err) => console.error("Errore caricamento fornitori", err));
    return () => { cancelled = true; };
  }, []);

  // Task e costi extra sono mostrati sia nella lista cantieri (barre di
  // avanzamento) sia nel dettaglio: li carichiamo in blocco per progetto.
  React.useEffect(() => {
    if (projects.length === 0) return;
    let cancelled = false;
    Promise.all(
      projects.map((p) =>
        crmFetch<ProjectTask[]>(`/api/crm/projects/${p.id}/tasks`)
          .then((tasks) => [p.id, tasks] as const)
          .catch(() => [p.id, []] as const)
      )
    ).then((results) => { if (!cancelled) setProjectTasks(Object.fromEntries(results)); });
    Promise.all(
      projects.map((p) =>
        crmFetch<ExtraCost[]>(`/api/crm/projects/${p.id}/extra-costs`)
          .then((costs) => [p.id, costs] as const)
          .catch(() => [p.id, []] as const)
      )
    ).then((results) => { if (!cancelled) setExtraCosts(Object.fromEntries(results)); });
    return () => { cancelled = true; };
  }, [projects]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("quoteai_crm_sidebar_collapsed") : null;
    return saved === "true";
  });

  React.useEffect(() => {
    localStorage.setItem("quoteai_crm_sidebar_collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // States for interactive panels
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Gli "operai assegnati" servono solo nel dettaglio del cantiere aperto
  React.useEffect(() => {
    if (!selectedProjectId || assignments[selectedProjectId]) return;
    crmFetch<ProjectAssignment[]>(`/api/crm/projects/${selectedProjectId}/assignments`)
      .then((data) => setAssignments((prev) => ({ ...prev, [selectedProjectId]: data })))
      .catch((err) => console.error("Errore caricamento assegnazioni", err));
  }, [selectedProjectId]);

  // Forms toggles
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [isAddingCollab, setIsAddingCollab] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isAddingPratica, setIsAddingPratica] = useState(false);

  // New item States
  const [newProjName, setNewProjName] = useState("");
  const [newProjBudget, setNewProjBudget] = useState("");
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRate, setNewCollabRate] = useState("");
  const [newCollabPhone, setNewCollabPhone] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCat, setNewSupplierCat] = useState("Materiali Edili");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newPraticaTitle, setNewPraticaTitle] = useState("");
  const [newPraticaProt, setNewPraticaProt] = useState("");
  const [selectedSalProjId, setSelectedSalProjId] = useState<string>("");
  const [salNumber, setSalNumber] = useState("1");
  const [garanziaRetention, setGaranziaRetention] = useState(0.5);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newExtraCostDesc, setNewExtraCostDesc] = useState("");
  const [newExtraCostAmount, setNewExtraCostAmount] = useState("");
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [newAssignCollabId, setNewAssignCollabId] = useState("");
  const [newAssignRole, setNewAssignRole] = useState("");

  // Calculations — in centesimi come lo schema DB; convertiti in euro solo
  // in fase di rendering tramite centsToEuro(). Non esiste tracciamento
  // ore lavorate nel backend: i costi "collaboratori" non sono calcolabili,
  // solo i costi extra registrati per cantiere.
  const budgetTotale = projects.reduce((acc, p) => acc + p.budget, 0);
  const costiExtraTotali = Object.values(extraCosts).flat().reduce((acc, c) => acc + c.amount, 0);
  const entrateTotali = projects.filter(p => p.status === "completed" || p.status === "active").reduce((acc, p) => acc + p.budget, 0);
  const margineNetto = entrateTotali - costiExtraTotali;

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const activeProjectTasks = selectedProjectId ? (projectTasks[selectedProjectId] ?? []) : [];
  const activeProjectExtraCosts = selectedProjectId ? (extraCosts[selectedProjectId] ?? []) : [];
  const activeProjectAssignments = selectedProjectId ? (assignments[selectedProjectId] ?? []) : [];

  // Methods — chiamano il backend reale (artifacts/api-server/src/routes/crm.ts)
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    try {
      const created = await crmFetch<Project>("/api/crm/projects", {
        method: "POST",
        body: JSON.stringify({ name: newProjName, budget: euroToCents(parseFloat(newProjBudget) || 0) }),
      });
      setProjects((prev) => [created, ...prev]);
      setNewProjName("");
      setNewProjBudget("");
      setIsAddingProj(false);
    } catch (err) {
      console.error("Errore creazione cantiere", err);
      setCrmError(t("dashboard.crm.errors.createProject"));
    }
  };

  const handleUpdateProjectStatus = async (projectId: string, status: Project["status"]) => {
    try {
      const updated = await crmFetch<Project>(`/api/crm/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    } catch (err) {
      console.error("Errore aggiornamento stato cantiere", err);
      setCrmError(t("dashboard.crm.errors.updateProjectStatus"));
    }
  };

  const handleAddTask = async (projectId: string) => {
    if (!newTaskTitle.trim()) return;
    try {
      const created = await crmFetch<ProjectTask>(`/api/crm/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: newTaskTitle }),
      });
      setProjectTasks((prev) => ({ ...prev, [projectId]: [...(prev[projectId] ?? []), created] }));
      setNewTaskTitle("");
    } catch (err) {
      console.error("Errore creazione scadenza", err);
      setCrmError(t("dashboard.crm.errors.addTask"));
    }
  };

  const handleToggleTask = async (projectId: string, task: ProjectTask) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    try {
      const updated = await crmFetch<ProjectTask>(`/api/crm/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setProjectTasks((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) => (t.id === task.id ? updated : t)),
      }));
    } catch (err) {
      console.error("Errore aggiornamento scadenza", err);
      setCrmError(t("dashboard.crm.errors.updateTask"));
    }
  };

  const handleAddExtraCost = async (projectId: string) => {
    const amt = parseFloat(newExtraCostAmount);
    if (!newExtraCostDesc.trim() || isNaN(amt)) return;
    try {
      const created = await crmFetch<ExtraCost>(`/api/crm/projects/${projectId}/extra-costs`, {
        method: "POST",
        body: JSON.stringify({ description: newExtraCostDesc, amount: euroToCents(amt) }),
      });
      setExtraCosts((prev) => ({ ...prev, [projectId]: [...(prev[projectId] ?? []), created] }));
      setNewExtraCostDesc("");
      setNewExtraCostAmount("");
    } catch (err) {
      console.error("Errore registrazione costo extra", err);
      setCrmError(t("dashboard.crm.errors.addExtraCost"));
    }
  };

  const handleAssignCollaborator = async (projectId: string) => {
    if (!newAssignCollabId) return;
    try {
      const created = await crmFetch<ProjectAssignment>(`/api/crm/projects/${projectId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ collaboratorId: newAssignCollabId, roleInProject: newAssignRole }),
      });
      setAssignments((prev) => ({ ...prev, [projectId]: [...(prev[projectId] ?? []), created] }));
      setNewAssignCollabId("");
      setNewAssignRole("");
    } catch (err) {
      console.error("Errore assegnazione collaboratore", err);
      setCrmError(t("dashboard.crm.errors.assignCollaborator"));
    }
  };

  const handleRemoveAssignment = async (projectId: string, assignmentId: string) => {
    try {
      await crmFetch(`/api/crm/projects/${projectId}/assignments/${assignmentId}`, { method: "DELETE" });
      setAssignments((prev) => ({ ...prev, [projectId]: (prev[projectId] ?? []).filter((a) => a.id !== assignmentId) }));
    } catch (err) {
      console.error("Errore rimozione assegnazione", err);
      setCrmError(t("dashboard.crm.errors.removeAssignment"));
    }
  };

  const handleCreateCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabName.trim()) return;
    try {
      const created = await crmFetch<Collaborator>("/api/crm/collaborators", {
        method: "POST",
        body: JSON.stringify({
          name: newCollabName,
          role: "Dipendente",
          hourlyRate: euroToCents(parseFloat(newCollabRate) || 0),
          phone: newCollabPhone || null,
        }),
      });
      setCollaborators((prev) => [...prev, created]);
      setNewCollabName("");
      setNewCollabRate("");
      setNewCollabPhone("");
      setIsAddingCollab(false);
    } catch (err) {
      console.error("Errore creazione collaboratore", err);
      setCrmError(t("dashboard.crm.errors.addCollaborator"));
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    try {
      const created = await crmFetch<Supplier>("/api/crm/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: newSupplierName,
          category: newSupplierCat,
          contactInfo: newSupplierContact,
        }),
      });
      setSuppliers((prev) => [...prev, created]);
      setNewSupplierName("");
      setNewSupplierContact("");
      setIsAddingSupplier(false);
    } catch (err) {
      console.error("Errore creazione fornitore", err);
      setCrmError(t("dashboard.crm.errors.addSupplier"));
    }
  };

  // Genera fattura: chiama l'endpoint reale del backend, che al momento
  // restituisce un documento SIMULATO (integrazione QuickBooks non
  // ancora attiva). Il risultato non viene persistito sul cantiere — il
  // backend stesso non lo salva — quindi resta visibile solo per la sessione.
  const handleTriggerInvoice = async (projectId: string) => {
    setIsInvoicing(true);
    try {
      const result = await crmFetch<{ success: boolean; invoice: { number: string; url: string; total: number } }>(
        "/api/crm/invoices/generate",
        { method: "POST", body: JSON.stringify({ projectId }) }
      );
      setInvoiceResults((prev) => ({ ...prev, [projectId]: result.invoice }));
    } catch (err) {
      console.error("Errore generazione fattura", err);
      setCrmError(t("dashboard.crm.errors.generateInvoice"));
    } finally {
      setIsInvoicing(false);
    }
  };

  const handleAddPratica = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPraticaTitle.trim()) return;
    setPratiche([
      ...pratiche,
      {
        title: newPraticaTitle,
        status: "In Progress",
        date: new Date().toISOString().split("T")[0],
        prot: newPraticaProt || "PROT-N/D",
      },
    ]);
    setNewPraticaTitle("");
    setNewPraticaProt("");
    setIsAddingPratica(false);
  };

  const handlePrintSal = (proj: Project, tasks: ProjectTask[]) => {
    const doneTasks = tasks.filter(t => t.status === "done").length;
    const pct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const budgetEuro = centsToEuro(proj.budget);
    const totalEseguito = (budgetEuro * pct) / 100;
    const retentionVal = totalEseguito * (garanziaRetention / 100);
    const nettoDaPagare = totalEseguito - retentionVal;
    const startDateLabel = proj.startDate ? new Date(proj.startDate).toLocaleDateString("en-CA") : "N/A";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>SAL No. ${salNumber} - ${proj.name}</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 40px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 900; color: #7c3aed; }
            .company-info { text-align: right; font-size: 11px; color: #666; }
            .doc-title { text-align: center; font-size: 20px; font-weight: 800; text-transform: uppercase; margin-bottom: 30px; color: #111; letter-spacing: 1px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 12px; }
            .info-box { border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fafafa; }
            .info-box h4 { margin: 0 0 8px 0; color: #7c3aed; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f7f7f7; font-weight: bold; }
            .totals { margin-left: auto; width: 300px; font-size: 12px; margin-bottom: 40px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .totals-row.final { font-weight: bold; font-size: 14px; color: #7c3aed; border-bottom: 2px double #7c3aed; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px; text-align: center; }
            .sig-box { width: 200px; border-top: 1px solid #333; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">QuoteAI</div>
              <div style="font-size: 10px; color: #666; margin-top: 4px;">Smart Construction Solutions</div>
            </div>
            <div class="company-info">
              <strong>QuoteAI Construction Inc.</strong><br>
              Business No.: 012345678<br>
              123 Craftsman Ave, Toronto, ON<br>
              admin@quoteai.ca
            </div>
          </div>

          <div class="doc-title">Progress Report (S.A.L.) No. ${salNumber}</div>

          <div class="info-grid">
            <div class="info-box">
              <h4>Project Details</h4>
              <strong>${proj.name}</strong><br>
              Contract Budget: $${budgetEuro.toLocaleString('en-CA')}<br>
              Start date: ${startDateLabel}<br>
              Overall Progress: ${pct}%
            </div>
            <div class="info-box">
              <h4>Client Details</h4>
              <strong>Client Company Inc.</strong><br>
              Tax ID: 889922110<br>
              Contract No. 104 of 2026<br>
              Payment: Bank Transfer
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Work Description</th>
                <th>Contract Amount</th>
                <th>Progress</th>
                <th>Amount Earned</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map((t) => {
                const taskPct = t.status === "done" ? 100 : 0;
                const taskBudget = budgetEuro / tasks.length;
                const taskMaturato = t.status === "done" ? taskBudget : 0;
                return `
                  <tr>
                    <td>${t.title}</td>
                    <td>$${taskBudget.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${taskPct}%</td>
                    <td>$${taskMaturato.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Total Work Completed:</span>
              <span>$${totalEseguito.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="totals-row">
              <span>Retention Holdback (${garanziaRetention}%):</span>
              <span>$${retentionVal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="totals-row final">
              <span>Net SAL Amount:</span>
              <span>$${nettoDaPagare.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              Site Supervisor
            </div>
            <div class="sig-box">
              Contractor
            </div>
            <div class="sig-box">
              Client
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen flex bg-white font-sans antialiased text-gray-900">

      {/* Mobile Sidebar Overlay/Drawer */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col shadow-xl transition-transform duration-300 md:hidden text-gray-300",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "linear-gradient(180deg, #0B1120 0%, #101830 100%)" }}
      >
        {/* Logo Section */}
        <div className="h-14 flex items-center border-b border-white/5 justify-between px-6 shrink-0">
          <Link href="/dashboard" className="flex items-center" onClick={() => setIsMobileSidebarOpen(false)}>
            <span className="quoteai-word text-xl font-extrabold">quoteai</span>
          </Link>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition"
            title={t("dashboard.crm.nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2.5 pb-2">{t("dashboard.crm.nav.coreHeading")}</p>
            {[
              { id: "dashboard", label: t("dashboard.crm.nav.dashboard"), icon: LayoutDashboard },
              { id: "clienti", label: t("dashboard.crm.nav.clients"), icon: UserPlus },
              { id: "cantieri", label: t("dashboard.crm.nav.projects"), icon: Briefcase },
              { id: "lavoratori", label: t("dashboard.crm.nav.workforce"), icon: Users },
              { id: "finanze", label: t("dashboard.crm.nav.finance"), icon: TrendingUp },
              { id: "costi_extra", label: t("dashboard.crm.nav.extraCosts"), icon: AlertCircle },
              { id: "fornitori", label: t("dashboard.crm.nav.suppliers"), icon: Building2 },
              { id: "listino", label: t("dashboard.nav.catalog"), icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              const navClass = cn(
                "flex items-center rounded-xl text-sm font-semibold transition-all w-full gap-3 px-3 py-2",
                active
                  ? "crm-nav-active"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              );
              if (item.id === "clienti") {
                return (
                  <Link
                    key={item.id}
                    href="/dashboard/clients"
                    title={t("dashboard.crm.nav.clientsTooltip")}
                    className={navClass}
                    onClick={() => setIsMobileSidebarOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    <span>{item.label}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as any);
                    setSelectedProjectId(null);
                    setIsMobileSidebarOpen(false);
                  }}
                  title={item.label}
                  className={navClass}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1 pt-4 border-t border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2.5 pb-2">{t("dashboard.crm.nav.adminHeading")}</p>
            {[
              { id: "sal", label: t("dashboard.crm.nav.sal"), icon: FileText },
              { id: "fatturazione", label: t("dashboard.crm.nav.invoicing"), icon: Receipt },
              { id: "pratiche", label: t("dashboard.crm.nav.permits"), icon: FolderOpen },
              { id: "analytics", label: t("dashboard.crm.nav.analytics"), icon: BarChart3 },
              { id: "calendario", label: t("dashboard.crm.nav.calendar"), icon: Calendar },
              { id: "impostazioni", label: t("dashboard.crm.nav.apiSettings"), icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as any);
                    setSelectedProjectId(null);
                    setIsMobileSidebarOpen(false);
                  }}
                  title={item.label}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-semibold transition-all w-full gap-3 px-3 py-2",
                    active
                      ? "crm-nav-active"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-white/5 text-[10px] text-gray-500 font-semibold text-center shrink-0">
          {t("dashboard.crm.moduleVersion")}
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 transition-all duration-200 text-gray-300",
          isSidebarCollapsed ? "w-14" : "w-64"
        )}
        style={{ background: "linear-gradient(180deg, #0B1120 0%, #101830 100%)" }}
      >
        {/* Logo Section */}
        <div className={cn("h-14 flex items-center border-b border-white/5 justify-between", isSidebarCollapsed ? "px-2 justify-center" : "px-6")}>
          {!isSidebarCollapsed ? (
            <>
              <Link href="/dashboard" className="flex items-center">
                <span className="quoteai-word text-xl font-extrabold">quoteai</span>
              </Link>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition"
                title={t("dashboard.crm.nav.collapseSidebar")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition"
              title={t("dashboard.crm.nav.expandSidebar")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sidebar Navigation Items */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2.5 pb-2">CRM CORE</p>
            )}
            {[
              { id: "dashboard", label: "Dashboard Generale", icon: LayoutDashboard },
              { id: "clienti", label: "Clienti & Lead", icon: UserPlus },
              { id: "cantieri", label: "Gestione Cantieri", icon: Briefcase },
              { id: "lavoratori", label: "Gestione Lavoratori", icon: Users },
              { id: "finanze", label: "Gestione Finanze", icon: TrendingUp },
              { id: "costi_extra", label: "Costi Extra", icon: AlertCircle },
              { id: "fornitori", label: "Fornitori", icon: Building2 },
              { id: "listino", label: "Listino Prezzi", icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              const navClass = cn(
                "flex items-center rounded-xl text-sm font-semibold transition-all w-full",
                isSidebarCollapsed ? "justify-center h-9 w-9 mx-auto p-0" : "gap-3 px-3 py-2",
                active
                  ? "crm-nav-active"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              );
              if (item.id === "clienti") {
                return (
                  <Link
                    key={item.id}
                    href="/dashboard/clients"
                    title={t("dashboard.crm.nav.clientsTooltip")}
                    className={navClass}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id as any); setSelectedProjectId(null); }}
                  title={item.label}
                  className={navClass}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-1 pt-4 border-t border-white/5">
            {!isSidebarCollapsed && (
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2.5 pb-2">AMMINISTRAZIONE</p>
            )}
            {[
              { id: "sal", label: "Stato Avanzamento (SAL)", icon: FileText },
              { id: "fatturazione", label: "Fatturazione Elettronica", icon: Receipt },
              { id: "pratiche", label: "Gestione Pratiche", icon: FolderOpen },
              { id: "analytics", label: "KPI & Analytics", icon: BarChart3 },
              { id: "calendario", label: "Calendario Scadenze", icon: Calendar },
              { id: "impostazioni", label: "Impostazioni API", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id as any); setSelectedProjectId(null); }}
                  title={item.label}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-semibold transition-all w-full",
                    isSidebarCollapsed ? "justify-center h-9 w-9 mx-auto p-0" : "gap-3 px-3 py-2",
                    active
                      ? "crm-nav-active"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        {!isSidebarCollapsed && (
          <div className="p-4 border-t border-white/5 text-[10px] text-gray-500 font-semibold text-center">
            {t("dashboard.crm.moduleVersion")}
          </div>
        )}
      </aside>

      {/* ── MAIN WORKSPACE CONTENT AREA ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 md:hidden transition"
              title={t("dashboard.crm.nav.openMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm md:text-base font-bold text-gray-900 uppercase tracking-wider capitalize">
              {SECTION_TITLE_KEYS[activeSection] ? t(SECTION_TITLE_KEYS[activeSection]) : activeSection.replace("_", " ")}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">{t("dashboard.crm.header.simulationBadge")}</span>
              <span className="sm:hidden">{t("dashboard.crm.header.simulationBadgeShort")}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Section Contents */}
        <main className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full flex-1">

          {crmError && (
            <div className="mb-4 flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-2.5 rounded-xl">
              <span>{crmError}</span>
              <button onClick={() => setCrmError(null)} className="p-1 rounded hover:bg-rose-100 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 1. SECTION: DASHBOARD */}
          {activeSection === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t("dashboard.crm.dashboard.statTotalRevenue"), val: `$${centsToEuro(entrateTotali).toLocaleString("en-CA")}`, icon: DollarSign, color: "text-blue-600 bg-blue-50" },
                  { label: t("dashboard.crm.dashboard.statOperatingMargin"), val: `$${centsToEuro(margineNetto).toLocaleString("en-CA")}`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
                  { label: t("dashboard.crm.dashboard.statCollaborators"), val: `${collaborators.length}`, icon: Users, color: "text-amber-600 bg-amber-50" },
                  { label: t("dashboard.crm.dashboard.statUnexpectedExpenses"), val: `$${centsToEuro(costiExtraTotali).toLocaleString("en-CA")}`, icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
                ].map((stat, idx) => (
                  <Card key={idx} className="border-gray-100 card-soft rounded-2xl">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                        <h4 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">{stat.val}</h4>
                      </div>
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Progress and Deadlines Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-gray-100 card-soft rounded-2xl">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t("dashboard.crm.dashboard.progressTitle")}</h3>
                    {projects.length === 0 && !isLoadingProjects && (
                      <p className="text-xs text-gray-400">{t("dashboard.crm.dashboard.noProjectsYet")}</p>
                    )}
                    <div className="space-y-4">
                      {projects.map((p, idx) => {
                        const tasks = projectTasks[p.id] ?? [];
                        const total = tasks.length;
                        const done = tasks.filter(t => t.status === "done").length;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                          <div key={p.id} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-gray-700">
                              <span className="truncate pr-2">{p.name}</span>
                              <span className="shrink-0">{pct}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="bar-grow-in h-full rounded-full"
                                style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7C3AED, #4F46E5, #06B6D4)", animationDelay: `${idx * 0.12}s` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 card-soft rounded-2xl">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t("dashboard.crm.dashboard.permitsTitle")}</h3>
                    <div className="divide-y divide-gray-100">
                      {pratiche.map((pr: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-2.5 first:pt-0 last:pb-0 items-center text-xs">
                          <div>
                            <p className="font-bold text-gray-800">{pr.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pr.prot}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            pr.status === "Approved" ? "bg-green-50 text-green-700 border border-green-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. SECTION: GESTIONE CANTIERI */}
          {activeSection === "cantieri" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">{t("dashboard.crm.projects.title")}</h3>
                  <p className="text-xs text-gray-500">{t("dashboard.crm.projects.subtitle")}</p>
                </div>
                <button
                  onClick={() => setIsAddingProj(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Plus className="h-4 w-4" /> {t("dashboard.crm.projects.newProject")}
                </button>
              </div>

              {isAddingProj && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4 sm:items-end">
                      <div className="flex-1 w-full space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">{t("dashboard.crm.projects.projectNameLabel")}</label>
                        <input
                          type="text"
                          placeholder={t("dashboard.crm.projects.projectNamePlaceholder")}
                          value={newProjName}
                          onChange={(e) => setNewProjName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-full sm:w-48 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">{t("dashboard.crm.projects.totalBudgetLabel")}</label>
                        <input
                          type="number"
                          placeholder="50000"
                          value={newProjBudget}
                          onChange={(e) => setNewProjBudget(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        {t("dashboard.crm.projects.add")}
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {isLoadingProjects ? (
                <p className="text-xs text-gray-400">{t("dashboard.crm.projects.loading")}</p>
              ) : projects.length === 0 ? (
                <p className="text-xs text-gray-400">{t("dashboard.crm.projects.noProjects")}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {projects.map((p) => {
                    const tasks = projectTasks[p.id] ?? [];
                    const done = tasks.filter(t => t.status === "done").length;
                    const total = tasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const isSelected = selectedProjectId === p.id;

                    return (
                      <Card
                        key={p.id}
                        className={`border-gray-150 hover:shadow-sm transition cursor-pointer ${
                          isSelected ? "ring-2 ring-violet-500" : ""
                        }`}
                        onClick={() => setSelectedProjectId(p.id)}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500">{t("dashboard.crm.projects.statusPrefix")} {PROJECT_STATUS_LABELS[p.status] ?? p.status}</span>
                            <span className="text-sm font-extrabold text-violet-700">${centsToEuro(p.budget).toLocaleString("en-CA")}</span>
                          </div>
                          <h4 className="font-extrabold text-gray-900 text-sm">{p.name}</h4>
                          <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                              <span>{t("dashboard.crm.projects.deadlines")}</span>
                              <span>{t("dashboard.crm.projects.completeCount").replace("{done}", String(done)).replace("{total}", String(total))}</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-150">
                              <div className="h-full bg-violet-600" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Popup Detail Modal */}
              {activeProject && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-white border border-gray-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                    <button
                      onClick={() => setSelectedProjectId(null)}
                      className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                      title={t("dashboard.crm.projects.close")}
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <div className="border-b border-gray-100 pb-4 pr-8 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-black text-gray-900 text-base">{activeProject.name}</h3>
                        <p className="text-xs text-gray-450 mt-1">{t("dashboard.crm.projects.budgetAllocated").replace("{amount}", centsToEuro(activeProject.budget).toLocaleString("en-CA"))}</p>
                      </div>
                      <select
                        value={activeProject.status}
                        onChange={(e) => handleUpdateProjectStatus(activeProject.id, e.target.value as Project["status"])}
                        className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="planning">{t("dashboard.crm.projects.statusPlanning")}</option>
                        <option value="active">{t("dashboard.crm.projects.statusActive")}</option>
                        <option value="suspended">{t("dashboard.crm.projects.statusSuspended")}</option>
                        <option value="completed">{t("dashboard.crm.projects.statusCompleted")}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Sub-tasks */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">{t("dashboard.crm.projects.deadlinesTitle")}</h4>
                        <div className="space-y-2">
                          {activeProjectTasks.map(task => (
                            <div
                              key={task.id}
                              onClick={() => handleToggleTask(activeProject.id, task)}
                              className="flex items-center gap-2.5 p-2.5 bg-gray-55/40 hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer text-xs"
                            >
                              <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center ${
                                task.status === "done" ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                              }`}>
                                {task.status === "done" && <Check className="h-3 w-3" />}
                              </div>
                              <span className={task.status === "done" ? "line-through text-gray-400" : "font-semibold text-gray-700"}>{task.title}</span>
                            </div>
                          ))}
                          {activeProjectTasks.length === 0 && (
                            <p className="text-[11px] text-gray-400">{t("dashboard.crm.projects.noDeadlines")}</p>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder={t("dashboard.crm.projects.newDeadlinePlaceholder")}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddTask(activeProject.id)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleAddTask(activeProject.id)}
                            className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Workers */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">{t("dashboard.crm.projects.workersTitle")}</h4>
                        <div className="space-y-2.5">
                          {activeProjectAssignments.map((a) => (
                            <div key={a.id} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                              <div>
                                <p className="font-bold text-gray-800">{a.collaboratorName}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{a.roleInProject || a.collaboratorRole}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveAssignment(activeProject.id, a.id)}
                                className="p-1 rounded hover:bg-rose-50 text-gray-350 hover:text-rose-600 transition"
                                title={t("dashboard.crm.projects.removeFromProject")}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {activeProjectAssignments.length === 0 && (
                            <p className="text-[11px] text-gray-400">{t("dashboard.crm.projects.noWorkers")}</p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <select
                            value={newAssignCollabId}
                            onChange={(e) => setNewAssignCollabId(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          >
                            <option value="">{t("dashboard.crm.projects.selectCollaborator")}</option>
                            {collaborators.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t("dashboard.crm.projects.rolePlaceholder")}
                            value={newAssignRole}
                            onChange={(e) => setNewAssignRole(e.target.value)}
                            className="flex-1 sm:w-32 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleAssignCollaborator(activeProject.id)}
                            className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 shrink-0"
                          >
                            {t("dashboard.crm.projects.assign")}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Costi Extra del Cantiere */}
                    <div className="pt-6 border-t border-gray-100 space-y-3">
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">{t("dashboard.crm.projects.extraCostsTitle")}</h4>
                      <div className="space-y-2">
                        {activeProjectExtraCosts.map((c) => (
                          <div key={c.id} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                            <div>
                              <p className="font-bold text-gray-800">{c.description}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.date).toLocaleDateString("en-CA")}</p>
                            </div>
                            <span className="font-bold text-rose-600">- ${centsToEuro(c.amount).toLocaleString("en-CA")}</span>
                          </div>
                        ))}
                        {activeProjectExtraCosts.length === 0 && (
                          <p className="text-[11px] text-gray-400">{t("dashboard.crm.projects.noExtraCosts")}</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder={t("dashboard.crm.projects.extraCostDescPlaceholder")}
                          value={newExtraCostDesc}
                          onChange={(e) => setNewExtraCostDesc(e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                          <input
                            type="number"
                            placeholder={t("dashboard.crm.projects.amountPlaceholder")}
                            value={newExtraCostAmount}
                            onChange={(e) => setNewExtraCostAmount(e.target.value)}
                            className="w-28 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleAddExtraCost(activeProject.id)}
                            className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Fatturazione del Cantiere */}
                    <div className="pt-6 border-t border-gray-100 space-y-3">
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">{t("dashboard.crm.projects.invoicingTitle")}</h4>
                      {invoiceResults[activeProject.id] ? (
                        <div className="flex justify-between items-center text-xs p-3 bg-blue-50 border border-blue-150 rounded-lg">
                          <div>
                            <p className="font-extrabold text-gray-800">{invoiceResults[activeProject.id].number}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{t("dashboard.crm.projects.simulatedDocDesc").replace("{total}", invoiceResults[activeProject.id].total.toLocaleString("en-CA"))}</p>
                          </div>
                          <a href={invoiceResults[activeProject.id].url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-blue-100 text-blue-500">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleTriggerInvoice(activeProject.id)}
                          disabled={isInvoicing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition disabled:opacity-50"
                        >
                          {isInvoicing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                          {t("dashboard.crm.projects.generateInvoice")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. SECTION: GESTIONE LAVORATORI */}
          {activeSection === "lavoratori" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Collaboratori e Ore</h3>
                  <p className="text-xs text-slate-500">Gestisci i dipendenti e collaboratori dell'azienda</p>
                </div>
                <button
                  onClick={() => setIsAddingCollab(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <UserPlus className="h-4 w-4" /> Aggiungi Collaboratore
                </button>
              </div>

              {isAddingCollab && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form
                      onSubmit={handleCreateCollaborator}
                      className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Nome e Cognome</label>
                        <input
                          type="text"
                          placeholder="Marco Rossi"
                          value={newCollabName}
                          onChange={(e) => setNewCollabName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Tariffa ($/ora)</label>
                        <input
                          type="number"
                          placeholder="25"
                          value={newCollabRate}
                          onChange={(e) => setNewCollabRate(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Telefono</label>
                        <input
                          type="text"
                          placeholder="+39 333..."
                          value={newCollabPhone}
                          onChange={(e) => setNewCollabPhone(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Salva
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {collaborators.length === 0 ? (
                <p className="text-xs text-gray-400">Nessun collaboratore ancora. Aggiungine uno con "Aggiungi Collaboratore".</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {collaborators.map((c) => (
                    <Card key={c.id} className="border-gray-150 shadow-xs">
                      <CardContent className="p-5 space-y-4">
                        <div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{c.role}</span>
                          <h4 className="font-extrabold text-gray-900 text-sm mt-1">{c.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{c.phone || "Nessun telefono"}</p>
                        </div>
                        <div className="pt-3 border-t border-gray-100 text-xs">
                          <p className="text-gray-400">Tariffa</p>
                          <p className="font-extrabold text-gray-700 mt-0.5">${centsToEuro(c.hourlyRate)}/h</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. SECTION: GESTIONE FINANZE */}
          {activeSection === "finanze" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-gray-150 bg-gradient-to-tr from-slate-900 to-slate-800 text-white shadow-sm">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrate Certificate</p>
                    <h3 className="text-2xl font-black">${centsToEuro(entrateTotali).toLocaleString("en-CA")}</h3>
                    <p className="text-[10px] text-slate-450">Commesse sbloccate o in corso</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-150 shadow-xs bg-white">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Margine di Cassa</p>
                    <h3 className="text-2xl font-black text-emerald-600">${centsToEuro(margineNetto).toLocaleString("en-CA")}</h3>
                    <p className="text-[10px] text-gray-500">Entrate meno costi extra registrati</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-150 shadow-xs bg-white">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Costi Extra Commesse</p>
                    <h3 className="text-2xl font-black text-rose-600">${centsToEuro(costiExtraTotali).toLocaleString("en-CA")}</h3>
                    <p className="text-[10px] text-gray-500">Spese impreviste registrate sui cantieri</p>
                  </CardContent>
                </Card>
              </div>

              {/* Cashflow bar representation */}
              <Card className="border-gray-150 shadow-xs bg-white">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Flussi Finanziari Commesse</h3>
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-600">Margine Operativo ({Math.round((margineNetto / Math.max(1, entrateTotali)) * 100)}%)</span>
                      <span className="font-bold text-emerald-600">${centsToEuro(margineNetto).toLocaleString("en-CA")}</span>
                    </div>
                    <div className="h-3 w-full bg-rose-100 rounded-full overflow-hidden border border-rose-200 flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, (margineNetto / Math.max(1, entrateTotali)) * 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 5. SECTION: COSTI EXTRA */}
          {activeSection === "costi_extra" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Storico Costi Extra Cantieri</h3>
                  <p className="text-xs text-gray-500">Visualizza tutte le spese impreviste sostenute al di fuori del preventivo iniziale</p>
                </div>
                <span className="text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                  Speso Extra: ${centsToEuro(costiExtraTotali).toLocaleString("en-CA")}
                </span>
              </div>

              <div className="space-y-3">
                {projects.flatMap((p) =>
                  (extraCosts[p.id] ?? []).map((c) => (
                    <Card key={c.id} className="border-gray-150 shadow-xs">
                      <CardContent className="p-4 flex justify-between items-center text-xs font-semibold">
                        <div>
                          <p className="text-gray-900 font-bold">{c.description}</p>
                          <p className="text-[10px] text-gray-450 mt-1">Cantiere: {p.name} | Data: {new Date(c.date).toLocaleDateString("it-IT")}</p>
                        </div>
                        <span className="font-bold text-rose-600">- ${centsToEuro(c.amount).toLocaleString("en-CA")}</span>
                      </CardContent>
                    </Card>
                  ))
                )}
                {projects.every((p) => (extraCosts[p.id] ?? []).length === 0) && (
                  <p className="text-xs text-gray-400">Nessun costo extra registrato.</p>
                )}
              </div>
            </div>
          )}

          {/* 6. SECTION: FORNITORI */}
          {activeSection === "fornitori" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Rubrica Fornitori Partner</h3>
                  <p className="text-xs text-gray-500">Fornitori di fiducia per materiali edili, noleggio e tecnologia</p>
                </div>
                <button
                  onClick={() => setIsAddingSupplier(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Building2 className="h-4 w-4" /> Nuovo Fornitore
                </button>
              </div>

              {isAddingSupplier && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form
                      onSubmit={handleCreateSupplier}
                      className="flex flex-col sm:flex-row gap-4 items-end"
                    >
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Ragione Sociale</label>
                        <input
                          type="text"
                          placeholder="es. Ferramenta Rossi S.a.s."
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-64 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Contatto Info</label>
                        <input
                          type="text"
                          placeholder="E-mail o indirizzo..."
                          value={newSupplierContact}
                          onChange={(e) => setNewSupplierContact(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Aggiungi
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {suppliers.length === 0 ? (
                <p className="text-xs text-gray-400">Nessun fornitore ancora. Aggiungine uno con "Nuovo Fornitore".</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {suppliers.map((s) => (
                    <Card key={s.id} className="border-gray-150 shadow-xs">
                      <CardContent className="p-5 flex gap-3">
                        <div className="h-9 w-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 className="h-4.5 w-4.5 text-gray-500" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-gray-900 text-sm">{s.name}</h4>
                          <span className="inline-block text-[9px] font-bold text-violet-700 bg-violet-55/50 border border-violet-100 px-2 py-0.5 rounded-full mt-1.5 uppercase">
                            {s.category}
                          </span>
                          <p className="text-xs text-gray-500 mt-2">{s.contactInfo}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. SECTION: FATTURAZIONE (QuickBooks API Sync) */}
          {activeSection === "fatturazione" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-150 p-6 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-gray-800 text-base">QuickBooks Integration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      The QuickBooks integration isn't live yet: "Generate Invoice" calls the real
                      backend, which currently returns a simulated document so you can test the flow.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full shrink-0">
                    Simulazione
                  </span>
                </div>
              </div>

              {/* Invoices created list (solo per la sessione corrente: il backend non le persiste ancora) */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Documenti Generati in Questa Sessione</h3>
                {Object.entries(invoiceResults).map(([projectId, inv]) => {
                  const proj = projects.find((p) => p.id === projectId);
                  return (
                    <Card key={projectId} className="border-gray-150 shadow-xs">
                      <CardContent className="p-4 flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 text-[9px] font-black rounded uppercase">BOZZA SIMULATA</span>
                            <span className="font-extrabold text-gray-800">{inv.number}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Cantiere: {proj?.name ?? "N/D"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">${inv.total.toLocaleString("en-CA")}</span>
                          <a
                            href={inv.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {Object.keys(invoiceResults).length === 0 && (
                  <p className="text-xs text-gray-400">Nessun documento generato. Aprine uno da "Gestione Cantieri" → dettaglio cantiere.</p>
                )}
              </div>
            </div>
          )}

          {/* 8. SECTION: GESTIONE PRATICHE */}
          {activeSection === "pratiche" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Pratiche Edilizie (CILA, SCIA, APE)</h3>
                  <p className="text-xs text-gray-500">Archivio e scadenze dei permessi comunali</p>
                </div>
                <button
                  onClick={() => setIsAddingPratica(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Plus className="h-4 w-4" /> Nuova Pratica
                </button>
              </div>

              {isAddingPratica && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleAddPratica} className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Titolo Pratica / Immobile</label>
                        <input
                          type="text"
                          placeholder="es. CILA - Via Manzoni 12"
                          value={newPraticaTitle}
                          onChange={(e) => setNewPraticaTitle(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-56 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Protocollo Comune</label>
                        <input
                          type="text"
                          placeholder="PROT-2026/..."
                          value={newPraticaProt}
                          onChange={(e) => setNewPraticaProt(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Aggiungi
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {pratiche.map((p: any, idx: number) => (
                  <Card key={idx} className="border-gray-150 shadow-xs">
                    <CardContent className="p-4 flex justify-between items-center text-xs font-semibold">
                      <div>
                        <p className="text-gray-900 font-bold">{p.title}</p>
                        <p className="text-[10px] text-gray-450 mt-1">Prot: {p.prot} | Data: {p.date}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        p.status === "Approved" ? "bg-green-50 text-green-700 border border-green-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {p.status}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 9. SECTION: ANALYTICS & KPI */}
          {activeSection === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs">
                <CardContent className="p-6 space-y-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Job Site Margins</h3>
                  
                  <div className="space-y-4">
                    {projects.map(p => {
                      const costCents = (extraCosts[p.id] ?? []).reduce((acc, c) => acc + c.amount, 0);
                      const marginCents = p.budget - costCents;
                      const pct = Math.max(0, Math.round((marginCents / Math.max(1, p.budget)) * 100));

                      return (
                        <div key={p.id} className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-800">{p.name}</span>
                            <span className="font-bold text-emerald-600">{pct}% Margine (Utile: ${centsToEuro(marginCents).toLocaleString("en-CA")})</span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 rounded-full border border-gray-150 overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 10. SECTION: CALENDARIO SCADENZE */}
          {activeSection === "calendario" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs">
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold text-gray-850 uppercase tracking-wider mb-5">Scadenze Cronologiche</h3>
                  <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                    {[
                      { date: "02 Luglio 2026", type: "Pratica", title: "Approvazione CILA - Villa Roma" },
                      { date: "05 Luglio 2026", type: "Cantiere", title: "Posa del massetto autolivellante - Cantiere Via Roma" },
                      { date: "10 Luglio 2026", type: "Fattura", title: "Acconto 30% - Condominio Aurora" },
                      { date: "15 Luglio 2026", type: "Tasse", title: "F24 Ritenute d'acconto dipendenti" },
                    ].map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border-2 border-violet-500 bg-white" />
                        <div className="flex justify-between items-start bg-gray-50/50 p-4 rounded-xl border border-gray-150 hover:border-gray-200 transition">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 block">{item.date}</span>
                            <h4 className="text-xs font-bold text-gray-800 mt-1">{item.title}</h4>
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">{item.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 11. SECTION: IMPOSTAZIONI API */}
          {activeSection === "impostazioni" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs bg-white">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">QuickBooks integration not yet live</h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    There's no API key configuration to save here yet: invoice generation
                    (the "Invoicing" section) currently uses a backend endpoint that simulates the document,
                    pending activation of the partner's QuickBooks account. Once it's connected,
                    this page will let you enter and save the real keys.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 12. SECTION: STATO AVANZAMENTO LAVORI (SAL) */}
          {activeSection === "sal" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-150 p-6 rounded-xl shadow-xs space-y-4">
                <h3 className="font-black text-gray-800 text-base">Generatore Stato Avanzamento Lavori (SAL)</h3>
                <p className="text-xs text-gray-500">Seleziona un cantiere attivo e configura le ritenute per calcolare l'avanzamento dei lavori in formato PDF.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Seleziona Cantiere</label>
                    <select
                      value={selectedSalProjId}
                      onChange={(e) => setSelectedSalProjId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="">Scegli un cantiere...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Numero SAL</label>
                    <input
                      type="text"
                      value={salNumber}
                      onChange={(e) => setSalNumber(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ritenuta di Garanzia (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={garanziaRetention}
                      onChange={(e) => setGaranziaRetention(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Document Preview Card */}
              {selectedSalProjId ? (
                (() => {
                  const proj = projects.find(p => p.id === selectedSalProjId);
                  if (!proj) return null;
                  const tasks = projectTasks[proj.id] ?? [];
                  const doneTasks = tasks.filter(t => t.status === "done").length;
                  const pct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
                  const budgetEuro = centsToEuro(proj.budget);
                  const totalEseguito = (budgetEuro * pct) / 100;
                  const retentionVal = totalEseguito * (garanziaRetention / 100);
                  const nettoDaPagare = totalEseguito - retentionVal;
                  const startDateLabel = proj.startDate ? new Date(proj.startDate).toLocaleDateString("it-IT") : "N/D";

                  return (
                    <div className="space-y-6">
                      {/* Interactive Sheet Preview */}
                      <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto text-xs text-gray-800 space-y-6">
                        {/* Doc Header */}
                        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b-2 border-violet-600 pb-4">
                          <div>
                            <div className="text-lg font-black text-violet-750 uppercase tracking-wide">QuoteAI</div>
                            <div className="text-[9px] text-gray-400 mt-0.5">Costruzioni & Ristrutturazioni</div>
                          </div>
                          <div className="text-left sm:text-right text-[10px] text-gray-500">
                            <strong>QuoteAI Costruzioni S.r.l.</strong><br />
                            P.IVA 01234567890<br />
                            Via dell'Artigianato 12, Milano
                          </div>
                        </div>

                        <div className="text-center font-bold text-base text-gray-900 uppercase tracking-wider py-2">
                          Stato Avanzamento Lavori (S.A.L.) N. {salNumber}
                        </div>

                        {/* Info details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-gray-50 border border-gray-150 p-4 rounded-xl space-y-1">
                            <h4 className="text-[9px] font-bold text-violet-600 uppercase tracking-wider">Cantiere</h4>
                            <p className="font-bold text-gray-900">{proj.name}</p>
                            <p>Budget di Contratto: ${budgetEuro.toLocaleString("en-CA")}</p>
                            <p>Data inizio: {startDateLabel}</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-4 rounded-xl space-y-1">
                            <h4 className="text-[9px] font-bold text-violet-600 uppercase tracking-wider">Committente</h4>
                            <p className="font-bold text-gray-900">Impresa Committente S.p.A.</p>
                            <p>CF / P.IVA: IT889922110</p>
                            <p>Stato Lavori Globale: {pct}%</p>
                          </div>
                        </div>

                        {/* Tasks Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-200 min-w-[600px]">
                            <thead>
                              <tr className="bg-gray-50 text-[10px] font-bold text-gray-600 uppercase">
                                <th className="border border-gray-200 p-2 text-left">Descrizione Voce / Lavorazione</th>
                                <th className="border border-gray-200 p-2 text-right">Quota Contratto</th>
                                <th className="border border-gray-200 p-2 text-center">Stato</th>
                                <th className="border border-gray-200 p-2 text-right">Importo Maturato</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tasks.map((t) => {
                                const taskPct = t.status === "done" ? 100 : 0;
                                const taskBudget = budgetEuro / tasks.length;
                                const taskMaturato = t.status === "done" ? taskBudget : 0;
                                return (
                                  <tr key={t.id} className="border-b border-gray-150">
                                    <td className="border border-gray-200 p-2 font-medium">{t.title}</td>
                                    <td className="border border-gray-200 p-2 text-right font-mono">${taskBudget.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
                                    <td className="border border-gray-200 p-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${
                                        t.status === "done" ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
                                      }`}>
                                        {taskPct}%
                                      </span>
                                    </td>
                                    <td className="border border-gray-200 p-2 text-right font-mono">${taskMaturato.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Calculation summary */}
                        <div className="w-full sm:w-64 ml-auto space-y-1.5 border-t border-gray-200 pt-3">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Importo Lavori Maturati:</span>
                            <span className="font-mono font-bold">${totalEseguito.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Ritenuta Garanzia ({garanziaRetention}%):</span>
                            <span className="font-mono text-rose-600">- ${retentionVal.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between border-t border-violet-200 pt-2 font-bold text-sm text-violet-750 gap-4">
                            <span>Importo Netto da Liquidare:</span>
                            <span className="font-mono">${nettoDaPagare.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Signatures */}
                        <div className="flex flex-col sm:flex-row justify-between gap-8 sm:gap-4 pt-12 text-[10px] text-center text-gray-500">
                          <div className="w-full sm:w-40 border-t border-gray-300 pt-1.5">Il Direttore dei Lavori</div>
                          <div className="w-full sm:w-40 border-t border-gray-300 pt-1.5">L'Impresa Appaltatrice</div>
                          <div className="w-full sm:w-40 border-t border-gray-300 pt-1.5">Il Committente</div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={() => handlePrintSal(proj, tasks)}
                          className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-violet-600/10"
                        >
                          <FileText className="h-4 w-4" /> Genera & Stampa PDF SAL
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500 shadow-xs">
                  Seleziona un cantiere in alto per configurare ed elaborare lo Stato Avanzamento Lavori.
                </div>
              )}
            </div>
          )}

          {/* 13. SECTION: LISTINO PREZZI */}
          {activeSection === "listino" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-150 p-6 rounded-xl shadow-xs">
                <div className="mb-4">
                  <h3 className="font-bold text-gray-800 text-lg">Gestione Listino Prezzi</h3>
                  <p className="text-xs text-gray-500 mt-1">Gestisci le lavorazioni e i prezzi unitari del tuo archivio. Le modifiche si riflettono istantaneamente sia nel CRM che nella generazione dei preventivi AI.</p>
                </div>
                <PriceCatalogSection />
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
