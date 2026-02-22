-- Storage policies for spot-images bucket
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- Ensure bucket "spot-images" exists (Dashboard > Storage > New bucket, Public: Yes)

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to spot-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'spot-images');

-- Allow public read (for displaying images)
CREATE POLICY "Public read spot-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'spot-images');
