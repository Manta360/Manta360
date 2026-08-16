ALTER TABLE public.contracts
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "endedBy" TEXT;

CREATE INDEX contracts_status_end_date_idx
  ON public.contracts (status, "endDate");
