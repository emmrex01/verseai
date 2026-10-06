import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Use only on the server, and always
 * scope queries by owner_id / book_id that you have already authorized.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
