-- =============================================================================
-- Storage buckets. CVs and verification documents live in PRIVATE buckets with
-- no policy granting access to anon/authenticated: every upload goes through
-- server-side validation, and every download through an authorisation function
-- followed by a short-lived signed URL. Company logos are public images.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resumes', 'resumes', false, 4194304,
   array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('verification-documents', 'verification-documents', false, 4194304,
   array['application/pdf', 'image/png', 'image/jpeg']),
  ('company-logos', 'company-logos', true, 524288,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created for these buckets on purpose:
-- anon/authenticated cannot list, read, write or delete objects directly.
