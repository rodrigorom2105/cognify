#!/usr/bin/env node

/**
 * Regenerate `src/lib/supabase/database.types.ts` from the live schema.
 *
 * Run with `pnpm db:types` after every schema change.
 *
 * The remote project is the source of truth, not `supabase/migrations`: this
 * repository has no baseline migration because the schema was built by hand in
 * the Supabase dashboard, so `supabase db reset` will not reproduce it.
 *
 * This wrapper exists only to re-apply the "do not edit" header that the
 * Supabase CLI does not emit; everything below the header is CLI output.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'txrpincvrpiwzscgzpya'; // `cognify`; same ref as NEXT_PUBLIC_SUPABASE_URL
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/lib/supabase/database.types.ts'
);

const HEADER = `// Generated from the remote Supabase project (\`cognify\`, ref ${PROJECT_ID}).
//
// DO NOT EDIT BY HAND. Regenerate after every schema change with:
//
//   pnpm db:types
//
// This repository has no baseline migration -- the schema was built by hand in
// the Supabase dashboard -- so the remote project, not \`supabase/migrations\`,
// is the source of truth for this file. See README.

`;

const result = spawnSync(
  'pnpm',
  [
    'dlx',
    'supabase@latest',
    'gen',
    'types',
    'typescript',
    '--project-id',
    PROJECT_ID,
    '--schema',
    'public',
  ],
  { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }
);

if (result.status !== 0) {
  console.error(
    `\nType generation failed (exit ${result.status}). ` +
      'Make sure you are logged in: `pnpm dlx supabase@latest login`.'
  );
  process.exit(result.status ?? 1);
}

// Never overwrite a good file with a truncated one: a CLI that exits 0 but
// prints nothing useful would otherwise wipe every type in the project.
if (!result.stdout.includes('export type Database')) {
  console.error(
    '\nType generation produced no `Database` type; refusing to overwrite ' +
      `${path.relative(process.cwd(), OUT)}.`
  );
  process.exit(1);
}

fs.writeFileSync(OUT, HEADER + result.stdout);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
