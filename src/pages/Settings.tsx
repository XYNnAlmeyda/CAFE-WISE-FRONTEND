import { useState, useEffect } from 'react';
import {
    User,
    Shield,
    Check,
    AlertCircle,
    Mail,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 0.9rem',
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1.5px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
};

const Settings = () => {
    const { role: authRole } = useAuth();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [fullName, setFullName] = useState('');
    const [initialFullName, setInitialFullName] = useState('');
    const [formErrors, setFormErrors] = useState<{ fullName?: string }>({});
    const [loading, setLoading] = useState(false);
    const [sendEmailLoading, setSendEmailLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchUserAndProfile();
    }, []);

    const fetchUserAndProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            const name = user.user_metadata?.full_name || 'User';
            setFullName(name);
            setInitialFullName(name);

            // Fetch role from users or profiles
            const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
            if (userData) {
                setProfile(userData);
            } else {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                setProfile(profileData);
            }
        }
    };

    const validateForm = (): boolean => {
        const errors: { fullName?: string } = {};

        if (!fullName.trim()) {
            errors.fullName = 'Full name is required.';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveAccount = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const updatePayload: any = {
                data: { full_name: fullName.trim() }
            };

            const { error } = await supabase.auth.updateUser(updatePayload);
            if (error) throw error;

            // Also update profiles table
            await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id);

            setInitialFullName(fullName.trim());
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setFormErrors({});
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSendChangePasswordEmail = async () => {
        if (!user?.email) return;
        setSendEmailLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setMessage({
                type: 'success',
                text: `Password change link sent to ${user.email}. Please check your email inbox.`
            });
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || 'Failed to send password change link. Please try again.'
            });
        } finally {
            setSendEmailLoading(false);
        }
    };

    const effectiveRole = authRole || profile?.role || user?.user_metadata?.role;
    const isStaff = effectiveRole === 'STAFF';
    const isManagerOrAdmin = effectiveRole === 'MANAGER' || effectiveRole === 'ADMIN';
    const displayRole = isStaff ? 'Staff' : 'Manager';

    return (
        <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Settings</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage your account and app preferences.</p>
            </div>

            {message.text && (
                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--border-radius-md)',
                    background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
                    color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.9rem'
                }}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Profile & Account Settings Card */}
            <div className="glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={32} color="white" />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 0.2rem 0' }}>{fullName}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.email}</p>
                            <span style={{
                                fontSize: '0.7rem',
                                background: isStaff ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                color: isStaff ? '#d97706' : 'var(--accent-primary)',
                                border: `1px solid ${isStaff ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                                padding: '0.12rem 0.5rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                                letterSpacing: '0.03em',
                            }}>
                                {displayRole.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSaveAccount(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={labelStyle}>Full Name</label>
                        <input
                            style={{ ...inputStyle, borderColor: formErrors.fullName ? 'var(--status-danger)' : undefined }}
                            value={fullName}
                            onChange={e => {
                                setFullName(e.target.value);
                                if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' }));
                            }}
                            placeholder="Enter your name"
                        />
                        {formErrors.fullName && (
                            <div style={{ color: 'var(--status-danger)', fontSize: '0.76rem', marginTop: '0.3rem' }}>
                                {formErrors.fullName}
                            </div>
                        )}
                    </div>
                    <div>
                        <label style={labelStyle}>Email Address</label>
                        <input style={{ ...inputStyle, background: 'rgba(0, 0, 0, 0.08)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} value={user?.email || ''} readOnly />
                    </div>

                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <label style={{ ...labelStyle, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Shield size={15} style={{ color: 'var(--accent-primary)' }} />
                            <span>Security & Password</span>
                        </label>

                        {/* Email Change Password Link Card */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem 1.25rem',
                            background: 'rgba(99, 102, 241, 0.05)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: '10px',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-primary)',
                                }}>
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        Change Password via Email
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        Send a change password link to {user?.email || 'your email'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSendChangePasswordEmail}
                                disabled={sendEmailLoading || !user?.email}
                                style={{
                                    padding: '0.55rem 1.1rem',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    color: 'white',
                                    borderRadius: '6px',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: (sendEmailLoading || !user?.email) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                                }}
                            >
                                <Mail size={15} />
                                {sendEmailLoading ? 'Sending Link...' : 'Send Link to Change Password'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{ padding: '0.65rem 1.4rem', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: 'var(--border-radius-sm)', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;
