-- Contract dates are persisted from several API flows. These constraints are the
-- final guard for direct database writes and concurrent application requests.
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_end_date_after_start_date
  CHECK ("endDate" > "startDate");

ALTER TABLE public.contract_requests
  ADD CONSTRAINT contract_requests_end_date_after_start_date
  CHECK (
    "startDate" IS NULL
    OR "endDate" IS NULL
    OR "endDate" > "startDate"
  );
