-- La restricción histórica por (userId, documentType) impide guardar los dos
-- lados de una cédula y también cualquier versión histórica del documento.
DO $$
DECLARE
  legacy_constraint text;
BEGIN
  SELECT constraint_name
    INTO legacy_constraint
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'identity_documents'
    AND constraint_type = 'UNIQUE'
    AND constraint_name IN ('identity_documents_userId_documentType_key', 'identity_documents_user_id_document_type_key')
  LIMIT 1;

  IF legacy_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.identity_documents DROP CONSTRAINT %I', legacy_constraint);
  END IF;
END $$;

DROP INDEX IF EXISTS public.identity_documents_one_current_idx;

CREATE UNIQUE INDEX IF NOT EXISTS identity_documents_current_side_unique
  ON public.identity_documents ("userId", "documentType", side)
  WHERE "isCurrent";
