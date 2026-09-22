/**
 * ⚠️  SECURITY: supabaseAdmin has been REMOVED from the frontend.
 *
 * The Supabase Service Role Key bypasses ALL Row Level Security (RLS).
 * It must NEVER be included in frontend/browser code — any VITE_ env var
 * is compiled into the public JS bundle and visible to anyone via DevTools.
 *
 * All admin database operations (staff creation, deletions, etc.) are
 * handled exclusively by the FastAPI backend using SUPABASE_SERVICE_ROLE_KEY
 * stored securely in the server environment.
 *
 * If you previously relied on this export, route those calls through
 * the appropriate /api/admin/* backend endpoint instead.
 */

// Safe null export — this file is intentionally a no-op.
// Do NOT add any Supabase client using a service/admin key here.
export const supabaseAdmin: null = null;
