-- Enforce the upload limits on the `documents` bucket itself.
--
-- Uploads now go from the browser straight to Storage with a signed upload
-- URL, so the file no longer passes through a Vercel function (whose 4.5 MB
-- request-body cap sat below the advertised 10 MB). That also means the
-- server action's size and type checks no longer stand between the client
-- and the bucket, so the bucket repeats them. Keep file_size_limit equal to
-- MAX_UPLOAD_BYTES in src/lib/constants.ts.

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf']
where id = 'documents';
