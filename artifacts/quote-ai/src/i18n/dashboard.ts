// Side-effect module: importing it merges the dashboard-only strings into the
// runtime dictionary. Imported by every dashboard root (the dashboard layout
// and the admin page) so the keys are registered before any dashboard page
// renders, and bundled with those lazy chunks rather than the public entry.
import { registerTranslations } from "./registry";
import { dashboardTranslations } from "./translations.dashboard";

registerTranslations(dashboardTranslations);
