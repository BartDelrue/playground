/// <reference types="vite/client" />

// DisplayMode selects how the playground is laid out, via ?displaymode= in the URL.
// 'minimal' and 'vertical' are what the admin portal embeds; 'full' is the default UI.
//
// LogType and LogLine used to be declared here as well, shadowing the real enum in
// app/utils/logTypes.ts with different members (WARNING/LOG instead of WARN). Nothing
// used the phantom members, so the duplicate is gone - logTypes.ts is the single source
// and Nuxt auto-imports it.
declare enum DisplayMode {
  MINIMAL = 'minimal',
  FULL = 'full',
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}
