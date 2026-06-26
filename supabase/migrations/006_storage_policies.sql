-- Storage bucket policies for item-images.
-- A public bucket still requires explicit storage.objects RLS policies for writes.

CREATE POLICY "Authenticated users can upload item images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can update item images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can delete item images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-images');

CREATE POLICY "Public can view item images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'item-images');

-- Storage bucket policies for avatars.
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can update avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can delete avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
