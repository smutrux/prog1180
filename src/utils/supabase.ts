import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Typed client. Use this for the tables listed in database_types.ts. */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * The same client without table types, for the `ncr_list` view, workflow
 * tables, and RPC functions from sql/01_ncr_functions.sql. They are not all
 * in database_types.ts yet. After regenerating that file, these calls can use
 * `supabase` and this export can be removed.
 */
export const looseSupabase = supabase as unknown as SupabaseClient;