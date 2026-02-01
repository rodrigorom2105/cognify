import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processDocument } from '@/lib/inngest/functions/process-document';

/**
 * Inngest API endpoint
 *
 * This endpoint:
 * 1. Receives events from the Inngest platform
 * 2. Executes registered background functions
 * 3. Provides the Inngest UI for debugging (in development)
 *
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument],
});
