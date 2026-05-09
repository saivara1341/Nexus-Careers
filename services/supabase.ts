
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// This function will be called once in App.tsx to create the client.
export function createSupabaseClient(supabaseUrl: string, supabasePublishableKey: string): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase URL and publishable key must be provided for client initialization.");
  }
  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
