-- Historical property validations observed in the source project.
-- Existing rows are preserved; new and modified rows are validated.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_title_not_blank_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_title_not_blank_ck CHECK (length(btrim(title)) > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_monthly_rent_positive_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_monthly_rent_positive_ck CHECK ("monthlyRent" > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_bedrooms_positive_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_bedrooms_positive_ck CHECK (bedrooms IS NULL OR bedrooms >= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_bathrooms_positive_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_bathrooms_positive_ck CHECK (bathrooms IS NULL OR bathrooms >= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_latitude_range_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_latitude_range_ck CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_longitude_range_ck') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_longitude_range_ck CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)) NOT VALID;
  END IF;
END $$;
