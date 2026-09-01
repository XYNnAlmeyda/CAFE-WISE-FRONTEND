import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, Shield, User, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/api';

interface StaffMember {
    id: string;
    full_name: string;
    email: string;
    role: 'STAFF' | 'MANAGER' | 'ADMIN';
    created_at?: string;
}


const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    background: 'rgba(255,255,255,0.85)',
    border: '1.5px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
};

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color, bg }: {
    icon: React.ReactNode; label: string; value: number; color: string; bg: string;
}) {
    return (
        <div style={{
            background: bg,
            border: `1px solid ${color}33`,
            borderRadius: '12px',
            padding: '1rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flex: 1,
            minWidth: '200px',
        }}>
            <div style={{
                background: `${color}22`,
                borderRadius: '8px',
                padding: '0.5rem',
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem', whiteSpace: 'nowrap' }}>{label}</div>
            </div>
        </div>
    );
}

const StaffManagement = () => {
    // View states
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');

    // Staff list
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form states
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        password: '',
        role: 'STAFF' as 'STAFF' | 'MANAGER',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get(`${API_BASE_URL}/api/admin/staff`);
            setStaffList(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to fetch staff:', err);
            setMessage({ type: 'error', text: 'Failed to load staff list' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.fullName || !formData.password) {
            setMessage({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        setSubmitting(true);
        setMessage(null);

        try {
            const endpoint =
                formData.role === ('ADMIN' as any)
                    ? `${API_BASE_URL}/api/admin/admins`
                    : formData.role === 'MANAGER'
                        ? `${API_BASE_URL}/api/admin/managers`
                        : `${API_BASE_URL}/api/admin/staff`;

            await apiClient.post(endpoint, {
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
            });

            setMessage({ type: 'success', text: `ADMIN (MANAGER) account created successfully!` });
            setFormData({ email: '', fullName: '', password: '', role: 'STAFF' });
            setView('list');
            await fetchStaff();
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || 'Failed to create account',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteStaff = async (id: string, name: string) => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

        try {
            await apiClient.delete(`${API_BASE_URL}/api/admin/staff/${id}`);
            setMessage({ type: 'success', text: 'Staff member removed' });
            await fetchStaff();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to delete staff member' });
        }
    };

    const filteredStaff = staffList.filter(
        (member) =>
            member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleStyles = (role: string) => {
        switch (role) {
            case 'ADMIN':
            case 'MANAGER':
                return {
                    bg: 'rgba(239, 68, 68, 0.1)',
                    text: '#ff4d4d',
                    border: 'rgba(239, 68, 68, 0.2)',
                    icon: <Shield size={14} />
                };
            default:
                return {
                    bg: 'rgba(139, 92, 246, 0.1)',
                    text: '#a78bfa',
                    border: 'rgba(139, 92, 246, 0.2)',
                    icon: <User size={14} />
                };
        }
    };

    // Calculate stats
    const stats = {
        total: staffList.length,
        admins: staffList.filter(m => m.role === 'ADMIN').length,
        staff: staffList.filter(m => m.role === 'STAFF').length,
    };

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Staff Management

                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Manage roles, permissions, and security for Houseblend
                    </p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => {
                            setView('create');
                            setFormData({ email: '', fullName: '', password: '', role: 'STAFF' });
                            setMessage(null);
                        }}
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            border: 'none', color: 'white', padding: '0.6rem 1.2rem',
                            borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                        }}>
                        <Plus size={18} /> Create Account
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <SummaryCard icon={<User size={20} />} label="Total Members" value={stats.total}
                    color="#8b5cf6" bg="rgba(139,92,246,0.08)" />
                <SummaryCard icon={<Shield size={20} />} label="Admins (Managers)" value={stats.admins}
                    color="#ef4444" bg="rgba(239,68,68,0.08)" />
                <SummaryCard icon={<User size={20} />} label="Regular Staff" value={stats.staff}
                    color="#10b981" bg="rgba(16,185,129,0.08)" />
            </div>

            {/* Notifications */}
            {message && (
                <div
                    style={{
                        padding: '1.2rem',
                        borderRadius: '16px',
                        marginBottom: '2rem',
                        background: message.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        animation: 'fadeIn 0.3s ease-out',
                    }}
                >
                    {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                    <span style={{ fontWeight: 500 }}>{message.text}</span>
                </div>
            )}

            {/* Create Account Form */}
            {view === 'create' && (
                <div style={{
                    animation: 'slideUp 0.4s ease-out',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '2.5rem',
                    borderRadius: '28px',
                    border: '1.5px solid var(--glass-border)',
                    marginBottom: '3rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.10)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Add Team Member</h2>
                        <button
                            onClick={() => setView('list')}
                            style={{
                                background: 'rgba(0,0,0,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.10)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleCreateStaff}>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={labelStyle}>Select Access Level</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                                {(['STAFF', 'MANAGER'] as const).map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: role as any })}
                                        style={{
                                            padding: '1.5rem',
                                            border: `2px solid ${formData.role === role ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                            background: formData.role === role ? 'rgba(13,148,136,0.08)' : 'rgba(255,255,255,0.85)',
                                            borderRadius: '20px',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.8rem',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: formData.role === role ? 'var(--accent-primary)' : 'rgba(0,0,0,0.08)',
                                            color: formData.role === role ? 'white' : 'var(--text-secondary)'
                                        }}>
                                            {role === 'STAFF' ? <User size={24} /> : <Shield size={24} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{role === 'MANAGER' ? 'ADMIN (MANAGER)' : role}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {role === 'STAFF' ? 'Daily operations and sales' : 'Full access to inventory, recipes, and management'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={labelStyle}>Display Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter full name"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    style={{ ...inputStyle, borderRadius: '14px', background: 'rgba(255,255,255,0.9)' }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="work@houseblend.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={{ ...inputStyle, borderRadius: '14px', background: 'rgba(255,255,255,0.9)' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '2.5rem' }}>
                            <label style={labelStyle}>Temporary Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="Create password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    style={{ ...inputStyle, borderRadius: '14px', background: 'rgba(255,255,255,0.9)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '1.2rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setView('list')}
                                style={{
                                    padding: '0.9rem 2rem',
                                    background: 'transparent',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    borderRadius: '14px',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    padding: '0.9rem 2.5rem',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '14px',
                                    color: 'white',
                                    fontWeight: 700,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)'
                                }}
                            >
                                {submitting ? 'Creating...' : 'Create Member'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Team List with Grid/Cards */}
            {view === 'list' && (
                <>
                    <div style={{
                        marginBottom: '2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1.5rem',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    paddingLeft: '3rem',
                                    borderRadius: '16px',
                                    background: 'rgba(0,0,0,0.05)',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                left: '1.2rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }}>
                                🔍
                            </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                            {filteredStaff.length} member{filteredStaff.length !== 1 ? 's' : ''} found
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                            <div className="loader" style={{ marginBottom: '1rem' }}></div>
                            <p style={{ color: 'var(--text-muted)' }}>Retrieving secure personnel data...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {filteredStaff.map((member) => {
                                const styles = getRoleStyles(member.role);
                                return (
                                    <div
                                        key={member.id}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            borderRadius: '24px',
                                            padding: '1.8rem',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1.2rem'
                                        }}
                                        className="staff-card"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-5px)';
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '16px',
                                                background: styles.bg,
                                                color: styles.text,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.5rem',
                                                fontWeight: 800
                                            }}>
                                                {member.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '0.4rem 0.8rem',
                                                background: styles.bg,
                                                color: styles.text,
                                                border: `1px solid ${styles.border}`,
                                                borderRadius: '10px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.05em'
                                            }}>
                                                {styles.icon} {member.role === 'ADMIN' || member.role === 'MANAGER' ? 'ADMIN (MANAGER)' : member.role}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.2rem', fontWeight: 700 }}>{member.full_name}</h3>
                                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{member.email}</p>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '1.2rem',
                                            borderTop: '1px solid rgba(0,0,0,0.05)'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Joined {member.created_at ? new Date(member.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-'}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteStaff(member.id, member.full_name)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.05)',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    padding: '0.6rem',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.03)'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StaffManagement;


