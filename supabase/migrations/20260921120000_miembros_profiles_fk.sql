-- Permite embed PostgREST miembros → profiles (antes solo FK a auth.users).
-- profiles.id ya referencia auth.users, así que el UUID sigue siendo válido.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'miembros'
      AND constraint_name = 'miembros_user_id_fkey'
  ) THEN
    ALTER TABLE miembros DROP CONSTRAINT miembros_user_id_fkey;
  END IF;
END $$;

ALTER TABLE miembros
  ADD CONSTRAINT miembros_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
