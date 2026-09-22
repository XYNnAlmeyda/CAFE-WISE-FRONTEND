import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, Shield, User, Eye, EyeOff, Search, Mail, Calendar, Clock } from 'lucide-react';
import { getOperatingHours, fetchOperatingHours, saveOperatingHours, OperatingHours, formatTime12h, isStaffLoginAllowed } from '../lib/operatingHours';
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
    color: 'var(--text-secondary)',
    fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    background: 'rgba(0,0,0,0.04)',
    border: '1.5px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
};

const TIME_OPTIONS = (() => {
    const list: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 5) {
            const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const displayH = h % 12 || 12;
            const ampm = h < 12 ? 'AM' : 'PM';
            const label = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
            list.push({ value: val, label });
        }
    }
    return list;
})();

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: {
    icon: React.ReactNode; label: string; value: number; color: string;
}) {
    return (
        <div className="glass-card" style={{
            background: 'var(--bg-card)',
            border: `1.5px solid ${color}35`,
            borderRadius: 'var(--border-radius-lg)',
            padding: '1.25rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flex: 1,
            minWidth: '200px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
        }}>
            <div style={{
                background: `${color}18`,
                borderRadius: '12px',
                padding: '0.65rem',
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</div>
            </div>
        </div>
    );
}

const StaffManagement = () => {
    // View states
    const [view, setView] = useState<'list' | 'create'>('list');

    // Staff list
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGER' | 'STAFF'>('ALL');

    // Form states
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        password: '',
        confirmPassword: '',
        role: 'STAFF' as 'STAFF' | 'MANAGER',
    });
    const [formErrors, setFormErrors] = useState<{
        fullName?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
    }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Operating Hours State
    const [opHours, setOpHours] = useState<OperatingHours>(getOperatingHours());

    useEffect(() => {
        fetchStaff();
        setOpHours(getOperatingHours());
        fetchOperatingHours().then(h => setOpHours(h)).catch(() => {});
    }, []);

    const handleSaveOperatingHours = async () => {
        try {
            const updated = { ...opHours, enabled: true };
            await saveOperatingHours(updated);
            setOpHours(updated);

            let modeText = '';
            if (updated.startTime === updated.endTime) {
                modeText = 'Equal opening and closing times set 24-hour staff access.';
            } else {
                const [sH, sM] = updated.startTime.split(':').map(Number);
                const [eH, eM] = updated.endTime.split(':').map(Number);
                const isOvernight = (sH * 60 + sM) > (eH * 60 + eM);
                modeText = `Allowed login window: ${formatTime12h(updated.startTime)} – ${formatTime12h(updated.endTime)}${isOvernight ? ' (Overnight shift)' : ''}.`;
            }

            setMessage({
                type: 'success',
                text: `Operating hours saved! ${modeText}`
            });
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || 'Failed to save operating hours. Please try again.'
            });
        }
    };

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

    const validateAddStaff = (): boolean => {
        const errs: { fullName?: string; email?: string; password?: string; confirmPassword?: string } = {};

        if (!formData.fullName.trim()) {
            errs.fullName = 'Display name is required.';
        }

        if (!formData.email.trim()) {
            errs.email = 'Email address is required.';
        } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
            errs.email = 'Please enter a valid email address.';
        }

        if (!formData.password) {
            errs.password = 'Password is required.';
        } else if (formData.password.length < 6) {
            errs.password = 'Password must be at least 6 characters long.';
        }

        if (!formData.confirmPassword) {
            errs.confirmPassword = 'Please confirm the password.';
        } else if (formData.password !== formData.confirmPassword) {
            errs.confirmPassword = 'Passwords do not match.';
        }

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAddStaff()) return;

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
                email: formData.email.trim(),
                password: formData.password,
                fullName: formData.fullName.trim(),
            });

            setMessage({ type: 'success', text: `${formData.role === 'MANAGER' ? 'Manager' : 'Staff'} account created successfully!` });
            setFormData({ email: '', fullName: '', password: '', confirmPassword: '', role: 'STAFF' });
            setFormErrors({});
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

    const [deleteModalStaff, setDeleteModalStaff] = useState<{ id: string; name: string } | null>(null);

    const confirmDeleteStaff = async () => {
        if (!deleteModalStaff) return;
        setSubmitting(true);
        try {
            await apiClient.delete(`${API_BASE_URL}/api/admin/staff/${deleteModalStaff.id}`);
            setMessage({ type: 'success', text: 'Staff member removed successfully' });
            setDeleteModalStaff(null);
            await fetchStaff();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to delete staff member' });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredStaff = staffList.filter((member) => {
        const matchesSearch =
            member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase());
        const isManagerRole = member.role === 'ADMIN' || member.role === 'MANAGER';
        const matchesRole =
            roleFilter === 'ALL'
                ? true
                : roleFilter === 'MANAGER'
                ? isManagerRole
                : member.role === 'STAFF';
        return matchesSearch && matchesRole;
    });

    const getRoleStyles = (role: string) => {
        switch (role) {
            case 'ADMIN':
            case 'MANAGER':
                return {
                    bg: 'rgba(139, 92, 246, 0.12)',
                    text: 'var(--accent-primary)',
                    border: 'rgba(139, 92, 246, 0.25)',
                    avatarBg: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    icon: <Shield size={13} />
                };
            default:
                return {
                    bg: 'rgba(16, 185, 129, 0.12)',
                    text: '#059669',
                    border: 'rgba(16, 185, 129, 0.25)',
                    avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
                    icon: <User size={13} />
                };
        }
    };

    // Calculate stats
    const stats = {
        total: staffList.length,
        admins: staffList.filter(m => m.role === 'ADMIN' || m.role === 'MANAGER').length,
        staff: staffList.filter(m => m.role === 'STAFF').length,
    };

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <h2 style={{ fontSize: '1.875rem', margin: 0 }}>Staff Management</h2>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.65rem',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: getOperatingHours().enabled
                                ? (isStaffLoginAllowed() ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                                : 'rgba(0,0,0,0.06)',
                            color: getOperatingHours().enabled
                                ? (isStaffLoginAllowed() ? '#059669' : '#dc2626')
                                : 'var(--text-muted)',
                            border: `1px solid ${getOperatingHours().enabled ? (isStaffLoginAllowed() ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)') : 'var(--glass-border)'}`
                        }}>
                            <Clock size={12} />
                            {getOperatingHours().enabled
                                ? `Staff Login: ${formatTime12h(getOperatingHours().startTime)} - ${formatTime12h(getOperatingHours().endTime)} (${isStaffLoginAllowed() ? 'OPEN' : 'CLOSED'})`
                                : 'Staff Login: 24/7 OPEN'}
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage team members, roles, and account access.</p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => {
                            setView('create');
                            setFormData({ email: '', fullName: '', password: '', confirmPassword: '', role: 'STAFF' });
                            setFormErrors({});
                            setMessage(null);
                        }}
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            border: 'none',
                            color: 'white',
                            padding: '0.65rem 1.3rem',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                            fontSize: '0.88rem',
                        }}>
                        <Plus size={18} /> Add New Staff
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <SummaryCard icon={<User size={22} />} label="Total Members" value={stats.total} color="#8b5cf6" />
                <SummaryCard icon={<Shield size={22} />} label="Managers" value={stats.admins} color="#6366f1" />
                <SummaryCard icon={<User size={22} />} label="Regular Staff" value={stats.staff} color="#10b981" />
            </div>

            {/* Staff Operating Hours Card */}
            {view === 'list' && (
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                            <h3 style={{ margin: '0 0 0.15rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Staff Operating Hours & Login Control</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Set allowed login time window for Staff personnel.</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>Opening Time (Staff Allowed From)</label>
                            <select
                                style={{
                                    ...inputStyle,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                }}
                                value={opHours.startTime}
                                onChange={e => setOpHours(prev => ({ ...prev, startTime: e.target.value }))}
                            >
                                {TIME_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} style={{ background: '#ffffff', color: '#1f2937' }}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Closing Time (Staff Allowed Until)</label>
                            <select
                                style={{
                                    ...inputStyle,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                }}
                                value={opHours.endTime}
                                onChange={e => setOpHours(prev => ({ ...prev, endTime: e.target.value }))}
                            >
                                {TIME_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} style={{ background: '#ffffff', color: '#1f2937' }}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveOperatingHours}
                            style={{
                                padding: '0.65rem 1.4rem',
                                background: 'var(--accent-primary)',
                                border: 'none',
                                color: 'white',
                                borderRadius: 'var(--border-radius-sm)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                whiteSpace: 'nowrap',
                                height: '39px',
                            }}
                        >
                            <Check size={16} />
                            Save Operating Hours
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications */}
            {message && (
                <div
                    style={{
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--border-radius-md)',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
                        color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.9rem'
                    }}
                >
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 500 }}>{message.text}</span>
                </div>
            )}

            {/* Create Account Form */}
            {view === 'create' && (
                <div className="glass-card" style={{
                    padding: '2rem',
                    borderRadius: '20px',
                    border: '1.5px solid var(--glass-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.35rem', fontWeight: 700 }}>Add New Team Member</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Create an account for staff or management access.</p>
                        </div>
                        <button
                            onClick={() => setView('list')}
                            style={{
                                background: 'rgba(0,0,0,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleCreateStaff}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={labelStyle}>Select Access Level</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {(['STAFF', 'MANAGER'] as const).map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: role as any })}
                                        style={{
                                            padding: '1.1rem',
                                            border: `2px solid ${formData.role === role ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                            background: formData.role === role ? 'rgba(139, 92, 246, 0.08)' : 'rgba(0,0,0,0.02)',
                                            borderRadius: '14px',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div style={{
                                            padding: '10px',
                                            borderRadius: '10px',
                                            background: formData.role === role ? 'var(--accent-primary)' : 'rgba(0,0,0,0.06)',
                                            color: formData.role === role ? 'white' : 'var(--text-secondary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {role === 'STAFF' ? <User size={20} /> : <Shield size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>{role === 'MANAGER' ? 'Manager' : 'Staff'}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {role === 'STAFF' ? 'POS operations & order processing' : 'Full access to sales, stock & settings'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                            <div>
                                <label style={labelStyle}>Display Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter full name"
                                    value={formData.fullName}
                                    onChange={(e) => {
                                        setFormData({ ...formData, fullName: e.target.value });
                                        if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' }));
                                    }}
                                    style={{ ...inputStyle, borderColor: formErrors.fullName ? 'var(--status-danger)' : undefined }}
                                />
                                {formErrors.fullName && (
                                    <div style={{ color: 'var(--status-danger)', fontSize: '0.76rem', marginTop: '0.3rem' }}>
                                        {formErrors.fullName}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={labelStyle}>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="name@houseblend.com"
                                    value={formData.email}
                                    onChange={(e) => {
                                        setFormData({ ...formData, email: e.target.value });
                                        if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                                    }}
                                    style={{ ...inputStyle, borderColor: formErrors.email ? 'var(--status-danger)' : undefined }}
                                />
                                {formErrors.email && (
                                    <div style={{ color: 'var(--status-danger)', fontSize: '0.76rem', marginTop: '0.3rem' }}>
                                        {formErrors.email}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
                            <div>
                                <label style={labelStyle}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Create password (min 6 chars)"
                                        value={formData.password}
                                        onChange={(e) => {
                                            setFormData({ ...formData, password: e.target.value });
                                            if (formErrors.password) setFormErrors(prev => ({ ...prev, password: '' }));
                                        }}
                                        style={{ ...inputStyle, borderColor: formErrors.password ? 'var(--status-danger)' : undefined }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.8rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {formErrors.password && (
                                    <div style={{ color: 'var(--status-danger)', fontSize: '0.76rem', marginTop: '0.3rem' }}>
                                        {formErrors.password}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={labelStyle}>Confirm Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Retype password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => {
                                            setFormData({ ...formData, confirmPassword: e.target.value });
                                            if (formErrors.confirmPassword) setFormErrors(prev => ({ ...prev, confirmPassword: '' }));
                                        }}
                                        style={{ ...inputStyle, borderColor: formErrors.confirmPassword ? 'var(--status-danger)' : undefined }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.8rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {formErrors.confirmPassword && (
                                    <div style={{ color: 'var(--status-danger)', fontSize: '0.76rem', marginTop: '0.3rem' }}>
                                        {formErrors.confirmPassword}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setView('list')}
                                style={{
                                    padding: '0.65rem 1.3rem',
                                    background: 'rgba(0,0,0,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.88rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    padding: '0.65rem 1.6rem',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: 'var(--border-radius-sm)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                                    fontSize: '0.88rem'
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
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap'
                    }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    paddingLeft: '2.6rem',
                                    borderRadius: '12px',
                                    background: 'rgba(0,0,0,0.04)',
                                    borderColor: 'var(--glass-border)',
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                left: '0.9rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Search size={16} />
                            </div>
                        </div>

                        {/* Role Filter Tabs & Count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'inline-flex',
                                background: 'rgba(0,0,0,0.05)',
                                padding: '3px',
                                borderRadius: '10px',
                                gap: '3px',
                            }}>
                                {(['ALL', 'MANAGER', 'STAFF'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRoleFilter(r)}
                                        style={{
                                            border: 'none',
                                            background: roleFilter === r ? '#ffffff' : 'transparent',
                                            color: roleFilter === r ? 'var(--accent-primary)' : 'var(--text-muted)',
                                            padding: '0.35rem 0.8rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: roleFilter === r ? 700 : 500,
                                            cursor: 'pointer',
                                            boxShadow: roleFilter === r ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {r === 'ALL' ? 'All Members' : r === 'MANAGER' ? 'Managers' : 'Staff'}
                                    </button>
                                ))}
                            </div>

                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {filteredStaff.length} member{filteredStaff.length !== 1 ? 's' : ''} found
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                            <div className="loader" style={{ marginBottom: '1rem', margin: '0 auto' }}></div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading personnel records...</p>
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderRadius: '16px' }}>
                            <User size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>No staff members found</h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {searchQuery ? 'Try adjusting your search query or filter.' : 'Click "Add New Staff" above to add your first member.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                            {filteredStaff.map((member) => {
                                const styles = getRoleStyles(member.role);
                                const isManager = member.role === 'ADMIN' || member.role === 'MANAGER';
                                return (
                                    <div
                                        key={member.id}
                                        className="glass-card"
                                        style={{
                                            padding: '1.35rem',
                                            borderRadius: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            gap: '1.25rem',
                                            transition: 'all 0.2s ease',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--glass-border)',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: '46px',
                                                    height: '46px',
                                                    borderRadius: '14px',
                                                    background: styles.avatarBg,
                                                    color: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.25rem',
                                                    fontWeight: 800,
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                                    flexShrink: 0
                                                }}>
                                                    {member.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <h3 style={{ margin: '0 0 0.15rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {member.full_name}
                                                    </h3>
                                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        <Mail size={12} style={{ flexShrink: 0 }} />
                                                        <span>{member.email}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.28rem 0.65rem',
                                                background: styles.bg,
                                                color: styles.text,
                                                border: `1px solid ${styles.border}`,
                                                borderRadius: '20px',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.04em',
                                                flexShrink: 0,
                                            }}>
                                                {styles.icon} {isManager ? 'MANAGER' : 'STAFF'}
                                            </span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '0.85rem',
                                            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                                        }}>
                                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}>
                                                <Calendar size={13} />
                                                Joined {member.created_at ? new Date(member.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Recently'}
                                            </span>
                                            <button
                                                onClick={() => setDeleteModalStaff({ id: member.id, name: member.full_name })}
                                                title="Remove staff member"
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.08)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                    color: '#ef4444',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Delete Staff Confirmation Modal */}
            {deleteModalStaff && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        maxWidth: '440px',
                        width: '100%',
                        color: '#1F2937',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.2), 0 0 25px rgba(239, 68, 68, 0.1)',
                        position: 'relative',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '3.5rem',
                            height: '3.5rem',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem auto'
                        }}>
                            <Trash2 style={{ width: '1.75rem', height: '1.75rem' }} />
                        </div>

                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                            Remove Staff Account?
                        </h3>

                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6B7280', lineHeight: '1.5' }}>
                            Are you sure you want to remove the staff account for <strong style={{ color: '#111827' }}>"{deleteModalStaff.name}"</strong>? This action cannot be undone.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteModalStaff(null)}
                                disabled={submitting}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1.25rem',
                                    background: '#F3F4F6',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '10px',
                                    color: '#4B5563',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteStaff}
                                disabled={submitting}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1.25rem',
                                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#FFFFFF',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {submitting ? 'Removing...' : 'Remove Staff'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;
