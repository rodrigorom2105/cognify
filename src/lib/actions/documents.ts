'use server';

import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { revalidatePath } from 'next/dist/server/web/spec-extension/revalidate';

/**
 * Upload a document and trigger background processing
 *
 * Steps:
 * 1. Validate file (PDF only, max 10MB)
 * 2. Check user's upload limit (10 documents/month for free tier)
 * 3. Upload file to Supabase Storage
 * 4. Create document record in database
 * 5. Trigger Inngest processing job
 *
 * @param formData - FormData containing the PDF file
 * @returns Success message or error
 */
export async function uploadDocument(formData: FormData) {
  try {
    // Extract file from FormData
    const file = formData.get('file') as File;

    // Create a Supabase client
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return {
        success: false,
        message: 'You must be logged in to upload documents',
      };

    // Validate file exists, is PDF, under 10MB
    if (!file) return { success: false, message: 'No file provided' };
    if (!file.type.includes('pdf'))
      return { success: false, message: 'Only PDF files are allowed' };
    if (file.size > 10 * 1024 * 1024)
      return { success: false, message: 'File size exceeds 10MB limit' };

    // Check user hasn't exceeded 10 documents uploaded
    const { data: usage, error: usageQueryError } = await supabase
      .from('user_usage')
      .select('documents_uploaded')
      .eq('user_id', user.id)
      .single();

    if (usageQueryError) {
      throw new Error(`Failed to fetch user usage: ${usageQueryError.message}`);
    }

    const USER_FREE_USAGE_LIMIT = 10;

    if (usage && usage.documents_uploaded >= USER_FREE_USAGE_LIMIT) {
      return { success: false, message: 'Document upload limit reached' };
    }

    // Generate unique filename: ${Date.now()}-${originalName}
    const uniqueFilename = `${Date.now()}-${file.name}`;

    // Upload to Storage: documents/${userId}/${uniqueFilename}
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`${user.id}/${uniqueFilename}`, file);

    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    let storagePath = data.path;

    try {
      // Create database record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: storagePath,
          status: 'processing',
          file_size_bytes: file.size,
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

      // Trigger Inngest function to process document

      await inngest
        .send({
          name: 'document.uploaded',
          data: {
            documentId: document.id,
            userId: user.id,
            storagePath: storagePath,
            filename: file.name,
          },
          // Manage response from inngest if needed (not shown here)
        })
        .catch((inngestError) => {
          console.error('Inngest trigger failed:', inngestError);
        })
        .finally(() => {
          revalidatePath('/dashboard/documents');
        });

      console.log(`Document uploaded successfully: ${document.id}`);

      return {
        success: true,
        message: 'Document uploaded successfully. Processing has started.',
        documentId: document.id,
      };
    } catch (dbError) {
      // If database operations fail, clean up the uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
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

      // Return { success: true }
      revalidatePath('/dashboard/documents');
      return { success: true, message: 'Document deleted successfully' };
    } catch (dbError) {
      // If database operations fail after storage deletion, we can't rollback the storage deletion
      // Log this as a warning but don't throw - the file is already deleted
      console.warn('Database operation failed after file deletion:', dbError);
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
  } catch (error: Error | any) {
    return { success: false, message: error.message };
  }
}
