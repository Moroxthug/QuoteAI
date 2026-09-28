// Phase 115: one language of one dictionary pack, emitted by the i18n-split
// plugin in vite.config.ts (see src/i18n/registry.ts).
declare module "virtual:i18n/*" {
  const dict: Record<string, string>;
  export default dict;
}
