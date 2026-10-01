'use server';

import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { revalidatePath } from 'next/cache';
import { FREE_TIER_LIMITS, MAX_UPLOAD_BYTES } from '@/lib/constants';

const DOCUMENTS_BUCKET = 'documents';

type PrepareUploadResult =
  | { success: true; storagePath: string; token: string }
  | { success: false; message: string };

type CompleteUploadResult =
  | { success: true; message: string; documentId: string }
  | { success: false; message: string; documentId?: string; error?: string };

function validatePdf(type: string, size: number): string | null {
  if (!type.includes('pdf')) return 'Only PDF files are allowed';
  if (size > MAX_UPLOAD_BYTES)
    return `File size exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`;
  return null;
}

async function hasUploadQuota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data: usage, error } = await supabase
    .from('user_usage')
    .select('documents_uploaded')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user usage: ${error.message}`);
  }

  return !usage || usage.documents_uploaded < FREE_TIER_LIMITS.documents;
}

/**
 * Step 1 of an upload: validate the file and hand back a signed upload URL.
 *
 * The browser uploads the PDF straight to Supabase Storage with the returned
 * token, then calls `completeUpload`. Sending the file through a server action
 * or route instead capped uploads at Vercel's 4.5 MB request-body limit, below
 * the 10 MB the app advertises. The bucket enforces the same size and type
 * limits, so a client that skips this check is still refused.
 */
export async function prepareUpload(file: {
  name: string;
  type: string;
  size: number;
}): Promise<PrepareUploadResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return {
        success: false,
        message: 'You must be logged in to upload documents',
      };

    const invalid = validatePdf(file.type, file.size);
    if (invalid) return { success: false, message: invalid };

    if (!(await hasUploadQuota(supabase, user.id))) {
      return { success: false, message: 'Document upload limit reached' };
    }

    // documents/${userId}/${Date.now()}-${originalName}; the storage RLS
    // policy only lets a user write under their own id.
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(`${user.id}/${Date.now()}-${file.name}`);

    if (error || !data) {
      throw new Error(`Failed to create upload URL: ${error?.message}`);
    }

    return { success: true, storagePath: data.path, token: data.token };
  } catch (error) {
    console.error('Prepare upload error:', error);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Step 2 of an upload: register the stored PDF and trigger processing.
 *
 * Steps:
 * 1. Confirm the object exists under the caller's folder, and re-check its
 *    real size and type from Storage rather than trusting the client
 * 2. Re-check the upload limit (another upload may have finished meanwhile)
 * 3. Create the document record and increment usage
 * 4. Trigger the Inngest processing job
 */
export async function completeUpload(
  storagePath: string,
  filename: string
): Promise<CompleteUploadResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return {
        success: false,
        message: 'You must be logged in to upload documents',
      };

    if (!storagePath.startsWith(`${user.id}/`)) {
      return { success: false, message: 'Invalid upload path' };
    }

    const { data: object, error: infoError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .info(storagePath);

    if (infoError || !object) {
      return { success: false, message: 'Uploaded file not found' };
    }

    const size = object.size ?? 0;
    const invalid = validatePdf(object.contentType ?? '', size);
    const overQuota = !invalid && !(await hasUploadQuota(supabase, user.id));

    if (invalid || overQuota) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      return {
        success: false,
        message: invalid ?? 'Document upload limit reached',
      };
    }

    try {
      // Create database record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename,
          storage_path: storagePath,
          status: 'processing',
          file_size_bytes: size,
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Failed to create document record: ${dbError.message}`);
      }

      // Increment user's document count
      const { error: usageError } = await supabase.rpc(
        'increment_documents_uploaded',
        {
          user_id_input: user.id,
        }
      );

      if (usageError) {
        throw new Error(`Failed to update user usage: ${usageError.message}`);
      }

      // Trigger Inngest function to process document.
      // If the event never reaches Inngest the document would sit in
      // 'processing' forever, so mark it failed and surface the reason
      // instead of reporting a successful upload.
      try {
        await inngest.send({
          name: 'document.uploaded',
          data: {
            documentId: document.id,
            userId: user.id,
            storagePath,
            filename,
          },
        });
      } catch (inngestError) {
        console.error('Inngest trigger failed:', inngestError);

        const { error: statusError } = await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', document.id);

        if (statusError) {
          console.error(
            `Failed to mark document ${document.id} as failed: ${statusError.message}`
          );
        }

        revalidatePath('/dashboard/documents');

        return {
          success: false,
          message: `Upload succeeded but processing could not be started: ${
            inngestError instanceof Error
              ? inngestError.message
              : 'Unknown error'
          }`,
          documentId: document.id,
        };
      }

      console.log(`Document uploaded successfully: ${document.id}`);

      // Revalidate the documents page to show the new document
      revalidatePath('/dashboard/documents');

      return {
        success: true,
        message: 'Document uploaded successfully. Processing has started.',
        documentId: document.id,
      };
    } catch (dbError) {
      // If database operations fail, clean up the uploaded file
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      throw dbError;
    }
  } catch (error) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a document and all associated chunks
 *
 * @param documentId - UUID of the document to delete
 * @returns Success message or error
 */
export async function deleteDocument(documentId: string) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('You must be logged in to delete documents');

    // Fetch document record
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path, user_id')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error('Document not found');
    }

    // Verify ownership (RLS should handle this, but double-check)
    if (document.user_id !== user.id) {
      throw new Error('You do not have permission to delete this document');
    }

    // Delete from Storage using storage_path
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.storage_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with database cleanup even if storage deletion fails
    }

    try {
      // Delete database record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw new Error(
          `Failed to delete document record: ${deleteError.message}`
        );
      }

      // Decrement user_usage.documents_uploaded
      const { error: usageError } = await supabase.rpc(
        'decrement_documents_uploaded',
        {
          user_id_input: user.id,
        }
      );

      if (usageError) {
        throw new Error(`Failed to update user usage: ${usageError.message}`);
      }

      // Revalidate the documents page to reflect the deletion
      revalidatePath('/dashboard/documents');

      return { success: true, message: 'Document deleted successfully' };
    } catch (dbError) {
      // If database operations fail after storage deletion, we can't rollback the storage deletion
      // Log this as a warning but don't throw - the file is already deleted
      console.warn('Database operation failed after file deletion:', dbError);

      return {
        success: false,
        message:
          'The file was removed but its record could not be deleted. Please try again.',
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all documents for the current user
 *
 * @returns Array of documents or error
 */
export async function getUserDocuments() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'You must be logged in to view documents' };
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch documents error:', error);
      return { error: `Failed to fetch documents: ${error.message}` };
    }

    return { success: true, documents };
  } catch (error) {
    console.error('Get user documents error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function getDocumentUrl(documentPath: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(documentPath, 60);

    if (error || !data) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
