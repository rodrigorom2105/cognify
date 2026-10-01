import { NextRequest, NextResponse } from 'next/server';
import { completeUpload } from '@/lib/actions/documents';

/**
 * HTTP entry point for the same upload the dashboard performs.
 *
 * The UI calls the upload server actions directly, which have no stable URL a
 * script can target. These routes run those exact functions, so scripted
 * uploads (the load test in `scripts/loadtest.mjs`) exercise the production
 * code path rather than a re-implementation of it:
 *
 * 1. `POST /api/documents/upload-url` -> signed Storage upload token
 * 2. upload the PDF straight to Supabase Storage with that token
 * 3. `POST /api/documents` with `{ storagePath, filename }` -> register it
 */
export async function POST(request: NextRequest) {
  const { storagePath, filename } = await request.json();
  const result = await completeUpload(storagePath, filename);

  if (result.success) {
    return NextResponse.json(result, { status: 201 });
  }

  // `error` is only set when completeUpload hit an unexpected failure; the
  // rest are validation or quota rejections.
  return NextResponse.json(result, { status: 'error' in result ? 500 : 400 });
}
