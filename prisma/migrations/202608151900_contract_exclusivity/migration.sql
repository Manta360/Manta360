-- Prisma does not model PostgreSQL partial unique indexes. This index is the
-- final database guard against two simultaneously effective contracts.
CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_effective_contract_per_property
  ON public.contracts ("propertyId")
  WHERE status IN ('ACTIVO', 'EN_RENOVACION');
