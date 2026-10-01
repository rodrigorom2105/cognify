import { NextRequest, NextResponse } from 'next/server';
import { prepareUpload } from '@/lib/actions/documents';

/**
 * HTTP entry point for step 1 of an upload (see `prepareUpload`): validate the
 * file's name, type and size, and return a signed Storage upload token.
 */
export async function POST(request: NextRequest) {
  const { name, type, size } = await request.json();
  const result = await prepareUpload({ name, type, size });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
