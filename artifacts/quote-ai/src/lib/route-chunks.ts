// Phase 115: one loader per signed-in page, shared by the router (React.lazy)
// and by prefetching. A nav link or a list row calls prefetchRoute(href) on
// hover / pointerdown, so the page's chunk is already in the module cache by
// the time the tap is released and the route renders without a fallback.
// Vite dedupes the dynamic import: lazy() and the prefetch share one request.

type Loader = () => Promise<unknown>;

export const pageLoaders = {
  today: () => import("@/pages/dashboard/index"),
  newQuote: () => import("@/pages/dashboard/new"),
  quotes: () => import("@/pages/dashboard/quotes/index"),
  quote: () => import("@/pages/dashboard/quotes/[id]"),
  billing: () => import("@/pages/dashboard/billing"),
  settings: () => import("@/pages/dashboard/settings/index"),
  catalog: () => import("@/pages/dashboard/catalog"),
  analytics: () => import("@/pages/dashboard/analytics"),
  clients: () => import("@/pages/dashboard/clients/index"),
  client: () => import("@/pages/dashboard/clients/[name]"),
  leads: () => import("@/pages/dashboard/leads/index"),
  imports: () => import("@/pages/dashboard/imports/index"),
  invoices: () => import("@/pages/dashboard/invoices"),
  invoice: () => import("@/pages/dashboard/invoices/[id]"),
  jobs: () => import("@/pages/dashboard/jobs/index"),
  job: () => import("@/pages/dashboard/jobs/[id]"),
  jobSetup: () => import("@/pages/dashboard/jobs/setup"),
  team: () => import("@/pages/dashboard/team"),
  schedule: () => import("@/pages/dashboard/schedule"),
  compliance: () => import("@/pages/dashboard/compliance"),
  books: () => import("@/pages/dashboard/books"),
  pay: () => import("@/pages/dashboard/pay"),
  group: () => import("@/pages/dashboard/group"),
  me: () => import("@/pages/dashboard/me"),
  assistant: () => import("@/pages/dashboard/assistant"),
  documents: () => import("@/pages/dashboard/documents"),
  archive: () => import("@/pages/dashboard/archive"),
  notifications: () => import("@/pages/dashboard/notifications"),
  contracts: () => import("@/pages/dashboard/contracts/index"),
  contract: () => import("@/pages/dashboard/contracts/[id]"),
} satisfies Record<string, Loader>;

// Most specific first: the first pattern that matches the path wins.
const ROUTES: Array<[RegExp, Loader]> = [
  [/^\/dashboard\/?$/, pageLoaders.today],
  [/^\/dashboard\/new$/, pageLoaders.newQuote],
  [/^\/dashboard\/quotes\/[^/]+$/, pageLoaders.quote],
  [/^\/dashboard\/quotes$/, pageLoaders.quotes],
  [/^\/dashboard\/jobs\/[^/]+\/setup$/, pageLoaders.jobSetup],
  [/^\/dashboard\/jobs\/[^/]+$/, pageLoaders.job],
  [/^\/dashboard\/jobs$/, pageLoaders.jobs],
  [/^\/dashboard\/invoices\/[^/]+$/, pageLoaders.invoice],
  [/^\/dashboard\/invoices$/, pageLoaders.invoices],
  [/^\/dashboard\/clients\/[^/]+$/, pageLoaders.client],
  [/^\/dashboard\/clients$/, pageLoaders.clients],
  [/^\/dashboard\/contracts\/[^/]+$/, pageLoaders.contract],
  [/^\/dashboard\/contracts$/, pageLoaders.contracts],
  [/^\/dashboard\/settings(\/.*)?$/, pageLoaders.settings],
  [/^\/dashboard\/(me|people\/[^/]+)$/, pageLoaders.me],
  [/^\/dashboard\/billing$/, pageLoaders.billing],
  [/^\/dashboard\/catalog$/, pageLoaders.catalog],
  [/^\/dashboard\/analytics$/, pageLoaders.analytics],
  [/^\/dashboard\/leads$/, pageLoaders.leads],
  [/^\/dashboard\/imports$/, pageLoaders.imports],
  [/^\/dashboard\/team$/, pageLoaders.team],
  [/^\/dashboard\/schedule$/, pageLoaders.schedule],
  [/^\/dashboard\/compliance$/, pageLoaders.compliance],
  [/^\/dashboard\/books$/, pageLoaders.books],
  [/^\/dashboard\/pay$/, pageLoaders.pay],
  [/^\/dashboard\/group$/, pageLoaders.group],
  [/^\/dashboard\/assistant$/, pageLoaders.assistant],
  [/^\/dashboard\/documents$/, pageLoaders.documents],
  [/^\/dashboard\/archive$/, pageLoaders.archive],
  [/^\/dashboard\/notifications$/, pageLoaders.notifications],
];

const started = new Set<Loader>();

/** Starts loading the page chunk for `href` (a no-op for unknown paths and repeats). Never throws. */
export function prefetchRoute(href: string): void {
  const path = href.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  const loader = ROUTES.find(([re]) => re.test(path))?.[1];
  if (!loader || started.has(loader)) return;
  started.add(loader);
  // A failed prefetch (offline, deploy in between) is retried by the real navigation.
  loader().catch(() => started.delete(loader));
}
