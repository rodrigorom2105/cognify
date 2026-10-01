/**
 * Free tier usage limits.
 *
 * Kept in one place because the dashboard, the settings page and the upload
 * action all have to agree on them — they were previously duplicated as magic
 * numbers in each, so a limit change silently updated only some of the UI.
 */
export const FREE_TIER_LIMITS = {
  documents: 10,
  queries: 100,
  tokens: 1_000_000,
} as const;

/**
 * Largest PDF a user can upload, in bytes. Enforced by the upload action and
 * by the `documents` bucket's own file_size_limit, which must match.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
