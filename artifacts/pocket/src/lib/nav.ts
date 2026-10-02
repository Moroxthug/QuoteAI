// Where the app's links go. A screen from a later step or phase isn't built yet, but its row or
// link stays on screen exactly as designed (owner ruling 2026-09-30) and opens the one shared
// "Coming soon" screen with that screen's real title. Building a screen = adding it to BUILT;
// every link to it already goes through `screenHref`, so nothing else changes.
import type { Href } from "expo-router";

/** A route this file built. Not `Href` on purpose: expo-router's own type is a union of every route, and past about 250 routes TypeScript cannot combine two of them (`a ? screenHref(x) : screenHref(y)`).
 *  Every route comes from BUILT or the Coming soon screen, so nothing is lost. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppHref = any;

/** Screens built so far, by the design's screen name. */
export const BUILT = {
  Menu: "/menu",
  SmartHome: "/home",
  Quotes: "/quotes",
  Clients: "/clients",
  Client: "/client",
  Quote: "/quote",
  NewQuote: "/new-quote",
  QuoteEditor: "/quote-editor",
  PriceCheck: "/price-check",
  Invoices: "/invoices",
  Invoice: "/invoice",
  Leads: "/leads",
  Jobs: "/jobs",
  JobSetup: "/job-setup",
  Job: "/job",
  ChangeOrder: "/change-order",
  Schedule: "/schedule",
  Team: "/team",
  ServiceCalls: "/service-calls",
  CrewMap: "/crew-map",
  Teammate: "/teammate",
  ForemanHome: "/foreman-home",
  CrewNow: "/crew-now",
  CrewHours: "/crew-hours",
  CrewTravel: "/crew-travel",
  LiveLocation: "/live-location",
  CrewExpired: "/crew-expired",
  Books: "/books",
  Pay: "/pay",
  AccountantView: "/accountant-view",
  Compliance: "/compliance",
  Contracts: "/contracts",
  Contract: "/contract",
  PriceBook: "/price-book",
  Suppliers: "/suppliers",
  Supplier: "/supplier",
  Inventory: "/inventory",
  Documents: "/documents",
  Group: "/group",
  Analytics: "/analytics",
  Notifications: "/notifications",
  Settings: "/settings",
  Profile: "/profile",
  SetSecurity: "/set-security",
  SetPlan: "/set-plan",
  SetMessaging: "/set-messaging",
  MessageTemplates: "/message-templates",
  SetWidget: "/set-widget",
  Archive: "/archive",
  Imports: "/imports",
  Integrations: "/integrations",
  Integration: "/integration",
  Feedback: "/feedback",
  WhatsNew: "/whats-new",
  HelpCentre: "/help-centre",
  VideoPlayer: "/video-player",
  Dunning: "/dunning",
  SetRoles: "/set-roles",
  CustomizeHome: "/customize-home",
  RoleHomes: "/role-homes",
  Assistant: "/assistant",
  SetCompany: "/set-company",
  SetTaxes: "/set-taxes",
  SetQuotes: "/set-quotes",
  SetInvoices: "/set-invoices",
  Search: "/search",
  AssistantProposals: "/assistant-proposals",
  AssistantActivity: "/assistant-activity",
  AssistantPermissions: "/assistant-permissions",
} as const;

export type BuiltScreen = keyof typeof BUILT;
export type ScreenName = BuiltScreen | (string & {});

/** The Coming soon screen for a later screen, titled with its already-translated name. */
export function comingSoonHref(title: string): AppHref {
  return { pathname: "/coming-soon", params: { title } } as Href;
}

/**
 * A link to the design's screen `name`: its route when built (with `params`), else Coming soon
 * titled `title` (already translated).
 */
export function screenHref(name: ScreenName, title: string, params?: Record<string, string>): AppHref {
  const route = (BUILT as Record<string, string>)[name];
  if (!route) return comingSoonHref(title);
  return (params ? { pathname: route, params } : route) as Href;
}

export function builtHref(screen: BuiltScreen): AppHref {
  return BUILT[screen] as Href;
}
