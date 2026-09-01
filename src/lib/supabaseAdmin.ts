import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// Only instantiate if the service key is available.
// If not set (e.g. on Vercel before the env var is added), the app won't crash —
// but admin operations like staff creation will be unavailable until the key is added.
export const supabaseAdmin: SupabaseClient | null = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;
