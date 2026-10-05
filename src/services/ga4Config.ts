// GA4 Service Account Credentials
//
// This committed version holds PLACEHOLDER values so the web build compiles.
// The real key must NEVER be committed.
//
// On your local machine (for Android builds), fill in the real values, then run:
//     git update-index --skip-worktree src/services/ga4Config.ts
// so git ignores your local edits and never pushes the real key.
//
// On Cloudflare (web), GA4 signing is handled server-side by the ga4auth
// Pages Function instead of this file.

export const GA4_SERVICE_ACCOUNT_EMAIL = 'PLACEHOLDER_EMAIL';
export const GA4_SERVICE_ACCOUNT_PRIVATE_KEY = 'PLACEHOLDER_KEY';
