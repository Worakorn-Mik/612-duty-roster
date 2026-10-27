import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Always hit the database — never let Next's fetch cache serve a stale roster.
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ยังไม่ได้ตั้งค่า environment variable: ${name}`);
  return v;
}

/** Read-only client (anon key + RLS select policies). Used by the public page. */
export function getPublicClient(): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStore },
  });
}

/** Privileged client (service_role). ONLY for Server Actions after the admin PIN check. */
export function getAdminClient(): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStore },
  });
}
