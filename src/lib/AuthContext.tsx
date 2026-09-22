import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { API_ENDPOINTS } from './api';
import { getOperatingHours, isStaffLoginAllowed, formatTime12h } from './operatingHours';

interface AuthContextValue {
    session: Session | null;
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | null;
    fullName: string;
    loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
    session: null,
    role: null,
    fullName: '',
    loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF' | null>(null);
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(true);
    const autoLogoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Auto-logout timer for STAFF: checks every minute if closing time has arrived
    const startAutoLogoutTimer = (userRole: string) => {
        if (autoLogoutTimer.current) clearInterval(autoLogoutTimer.current);
        if (userRole !== 'STAFF') return;

        autoLogoutTimer.current = setInterval(async () => {
            const hours = getOperatingHours();
            if (!isStaffLoginAllowed(hours)) {
                const errMsg = hours.enabled
                    ? `Your shift has ended. Staff login hours (${formatTime12h(hours.startTime)} – ${formatTime12h(hours.endTime)}) are now closed. You have been automatically logged out.`
                    : 'You have been automatically logged out.';
                sessionStorage.setItem('staff_login_error', errMsg);
                await supabase.auth.signOut();
            }
        }, 60_000); // Check every 60 seconds
    };

    const stopAutoLogoutTimer = () => {
        if (autoLogoutTimer.current) {
            clearInterval(autoLogoutTimer.current);
            autoLogoutTimer.current = null;
        }
    };

    /**
     * Fetches user role, then — for STAFF — calls the backend verify-login gate
     * to confirm operating hours BEFORE resolving (keeps loading=true throughout).
     * This prevents any dashboard flash for denied staff logins.
     */
    const fetchProfile = async (userId: string, accessToken?: string) => {
        try {
            let userRole: 'ADMIN' | 'STAFF' | 'MANAGER' | null = null;
            let name = '';

            const { data } = await supabase
                .from('users')
                .select('role, full_name')
                .eq('id', userId)
                .single();
            if (data) {
                userRole = data.role as any;
                name = data.full_name || '';
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.role) userRole = user.user_metadata.role;
                if (user?.user_metadata?.full_name) name = user.user_metadata.full_name;
            }

            const roleUpper = String(userRole || '').toUpperCase();

            // ── Server-side hours gate (STAFF only) ───────────────────────────────
            // Called here — while loading=true — so the dashboard NEVER renders
            // for a denied staff user. ADMIN/MANAGER bypass this entirely.
            if (roleUpper === 'STAFF') {
                const token = accessToken
                    || (await supabase.auth.getSession()).data.session?.access_token;

                if (token) {
                    try {
                        const resp = await fetch(API_ENDPOINTS.VERIFY_LOGIN, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ access_token: token }),
                        });
                        if (!resp.ok) {
                            const errData = await resp.json().catch(() => ({}));
                            const errMsg = (errData as any).detail
                                || 'Staff login is currently closed.';
                            sessionStorage.setItem('staff_login_error', errMsg);
                            stopAutoLogoutTimer();
                            await supabase.auth.signOut();
                            setSession(null);
                            setRole(null);
                            setFullName('');
                            return; // Exit — signOut triggers onAuthStateChange
                        }
                    } catch {
                        // Backend unreachable — sign out for safety
                        sessionStorage.setItem(
                            'staff_login_error',
                            'Cannot connect to server. Please try again.'
                        );
                        stopAutoLogoutTimer();
                        await supabase.auth.signOut();
                        setSession(null);
                        setRole(null);
                        setFullName('');
                        return;
                    }
                }

                // Staff verified — start auto-logout timer
                startAutoLogoutTimer('STAFF');
            } else {
                stopAutoLogoutTimer(); // Admin/Manager — no timer needed
            }

            setRole(userRole);
            setFullName(name);
        } catch {
            // Fallback — silently ignore, user stays on login screen
        }
    };

    useEffect(() => {
        let mounted = true;

        // Initial session check on mount
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (!mounted) return;
                setSession(session);
                if (session?.user) {
                    fetchProfile(session.user.id, session.access_token).finally(() => {
                        if (mounted) setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            })
            .catch(() => {
                if (mounted) setLoading(false);
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!mounted) return;
            if (newSession?.user) {
                // Keep loading=true while fetchProfile runs (includes verify-login for STAFF)
                // This prevents the dashboard from ever rendering for a denied login
                setLoading(true);
                setSession(newSession);
                fetchProfile(newSession.user.id, newSession.access_token).finally(() => {
                    if (mounted) setLoading(false);
                });
            } else {
                // Signed out — clear state and stop timer
                stopAutoLogoutTimer();
                setSession(null);
                setRole(null);
                setFullName('');
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            stopAutoLogoutTimer();
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ session, role, fullName, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
