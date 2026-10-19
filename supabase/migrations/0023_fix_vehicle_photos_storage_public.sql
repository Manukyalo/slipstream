-- Migration 0023: Ensure vehicle-photos bucket is public and readable
UPDATE storage.buckets
SET public = true
WHERE id = 'vehicle-photos';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'vehicle-photos: public read'
  ) THEN
    CREATE POLICY "vehicle-photos: public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'vehicle-photos');
  END IF;
END $$;
