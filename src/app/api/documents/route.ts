import { NextRequest, NextResponse } from 'next/server';
import { uploadDocument } from '@/lib/actions/documents';

/**
 * HTTP entry point for the same upload the dashboard performs.
 *
 * The UI calls `uploadDocument` as a server action, which has no stable URL a
 * script can target. This route runs that exact function, so scripted uploads
 * (the load test in `scripts/loadtest.mjs`) exercise the production code path
 * rather than a re-implementation of it.
 *
 * Note that Vercel caps request bodies at 4.5 MB, below the 10 MB the action
 * validates against — that applies to the server action too.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await uploadDocument(formData);

  if (result.success) {
    return NextResponse.json(result, { status: 201 });
  }

  // `error` is only set when uploadDocument hit an unexpected failure; the
  // rest are validation or quota rejections.
  return NextResponse.json(result, { status: 'error' in result ? 500 : 400 });
}
