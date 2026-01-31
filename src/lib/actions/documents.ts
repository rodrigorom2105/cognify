'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/dist/server/web/spec-extension/revalidate';

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

    if (!user) return { success: false, message: 'User not authenticated' };

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

    if (usage && usage.documents_uploaded >= 10) {
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
      const { error: documentError } = await supabase.from('documents').insert({
        user_id: user.id,
        filename: file.name,
        storage_path: storagePath,
        status: 'processing',
        file_size_bytes: file.size,
      });

      if (documentError) {
        throw new Error(
          `Failed to create document record: ${documentError.message}`
        );
      }

      // Increment user_usage.documents_uploaded
      const { error: usageError } = await supabase
        .from('user_usage')
        .update({
          documents_uploaded: (usage?.documents_uploaded || 0) + 1,
        })
        .eq('user_id', user.id);

      if (usageError) {
        throw new Error(`Failed to update user usage: ${usageError.message}`);
      }

      // Return { success: true }
      revalidatePath('/dashboard/documents');
      return { success: true, message: 'File uploaded successfully', data };
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

export async function deleteDocument(documentId: string) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, message: 'User not authenticated' };

    // Fetch document record
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !document) {
      return {
        success: false,
        message: 'Document not found',
        error: fetchError?.message,
      };
    }

    // Delete from Storage using storage_path
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([document.storage_path]);

    if (deleteError) {
      throw new Error(
        `Failed to delete file from storage: ${deleteError.message}`
      );
    }

    try {
      // Delete database record
      const { error: recordError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (recordError) {
        throw new Error(
          `Failed to delete document record: ${recordError.message}`
        );
      }

      // Decrement user_usage.documents_uploaded
      const { data: usage, error: usageQueryError } = await supabase
        .from('user_usage')
        .select('documents_uploaded')
        .eq('user_id', user.id)
        .single();

      if (usageQueryError) {
        throw new Error(
          `Failed to fetch user usage: ${usageQueryError.message}`
        );
      }

      const { error: usageError } = await supabase
        .from('user_usage')
        .update({
          documents_uploaded: Math.max((usage?.documents_uploaded || 1) - 1, 0),
        })
        .eq('user_id', user.id);

      if (usageError) {
        throw new Error(`Failed to update user usage: ${usageError.message}`);
      }

      // Return { success: true }
      return { success: true, message: 'Document deleted successfully' };
    } catch (dbError) {
      // If database operations fail after storage deletion, we can't rollback the storage deletion
      // Log this as a warning but don't throw - the file is already deleted
      console.warn('Database operation failed after file deletion:', dbError);
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
