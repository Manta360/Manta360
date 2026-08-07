import { createClient } from "@supabase/supabase-js";

function requiredServerEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} debe estar definido en el entorno del servidor`);
  }

  return value;
}

/**
 * Creates a Supabase client for Route Handlers and other server-only code.
 * The service-role key must never be imported by client components.
 */
export function createSupabaseServerClient() {
  return createClient(
    requiredServerEnv("SUPABASE_URL"),
    requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
