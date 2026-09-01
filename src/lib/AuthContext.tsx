import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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

    const fetchProfile = async (userId: string) => {
        try {
            const { data } = await supabase
                .from('users')
                .select('role, full_name')
                .eq('id', userId)
                .single();
            if (data) {
                setRole(data.role as 'ADMIN' | 'STAFF' | 'MANAGER');
                setFullName(data.full_name || '');
            }
        } catch {
            // user record not found – try metadata as fallback
            try {
                const role = supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user?.user_metadata?.role) {
                        setRole(user.user_metadata.role as 'ADMIN' | 'STAFF' | 'MANAGER');
                    }
                    if (user?.user_metadata?.full_name) {
                        setFullName(user.user_metadata.full_name);
                    }
                });
            } catch {
                // fallback to null
            }
        }
    };

    useEffect(() => {
        let mounted = true;

        const timeoutId = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 2000);

        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (!mounted) return;
                setSession(session);
                if (session?.user) {
                    fetchProfile(session.user.id).finally(() => {
                        if (mounted) setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            })
            .catch(() => {
                if (mounted) setLoading(false);
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setRole(null);
                setFullName('');
            }
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
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

