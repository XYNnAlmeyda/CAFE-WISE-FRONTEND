import { useState, useEffect } from 'react';
import {
    User,
    Shield,
    Info,
    Check,
    AlertCircle,
    Users,
    Plus,
    Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/api';

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'white',
    fontSize: '0.9rem',
    outline: 'none',
};

const Settings = () => {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('Account');
    const [fullName, setFullName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Staff Management State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [newStaff, setNewStaff] = useState({ email: '', fullName: '', password: '', role: 'STAFF' as 'STAFF' | 'ADMIN' });

    useEffect(() => {
        fetchUserAndProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'Staff Management') {
            fetchStaff();
        }
    }, [activeTab]);

    const fetchUserAndProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            setFullName(user.user_metadata?.full_name || 'Admin User');

            // Fetch role from profiles
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setProfile(data);
        }
    };

    const fetchStaff = async () => {
        try {
            const data = await apiClient.get(`${API_BASE_URL}/api/admin/staff`);
            setStaffList(data || []);
        } catch (err: any) {
            console.error('Failed to fetch staff:', err);
        }
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            });
            if (error) throw error;

            // Also update profiles table
            await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!newPassword) return;
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setNewPassword('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            // Use the appropriate endpoint based on role
            const endpoint = newStaff.role === 'ADMIN' 
                ? `${API_BASE_URL}/api/admin/managers`
                : `${API_BASE_URL}/api/admin/staff`;
            
            await apiClient.post(endpoint, {
                email: newStaff.email,
                password: newStaff.password,
                fullName: newStaff.fullName
            });

            setMessage({ type: 'success', text: `✅ ${newStaff.role === 'ADMIN' ? 'Manager' : 'Staff'} account created for ${newStaff.email}!` });
            setNewStaff({ email: '', fullName: '', password: '', role: 'STAFF' });
            fetchStaff();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to create staff account.' });
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteStaff = async (staffId: string, staffName: string) => {
        if (!window.confirm(`Remove staff account for "${staffName}"? This cannot be undone.`)) return;
        
        setLoading(true);
        setMessage({ type: '', text: '' });
        
        try {
            await apiClient.delete(`${API_BASE_URL}/api/admin/staff/${staffId}`);
            setMessage({ type: 'success', text: `Staff account removed.` });
            fetchStaff();
        } catch (err: any) {
            console.error('Error removing staff:', err);
            setMessage({ type: 'error', text: err.message || 'Failed to remove staff account.' });
        } finally {
            setLoading(false);
        }
    };


    const menuItems = profile?.role === 'ADMIN'
        ? ['Account', 'Staff Management', 'Security']
        : ['Account', 'Security'];

    return (
        <div style={{ padding: '0', maxWidth: '1000px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={32} color="white" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>{fullName}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.email}</p>
                                <span style={{ fontSize: '0.7rem', background: 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>{profile?.role || 'USER'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 2.5fr', gap: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {menuItems.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`settings-nav-btn ${activeTab === tab ? 'active' : ''}`}
                                >
                                    {tab === 'Staff Management' ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={16} /> Staff</div> : tab}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {activeTab === 'Account' && (
                                <>
                                    <div>
                                        <label style={labelStyle}>Full Name</label>
                                        <input
                                            style={inputStyle}
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            placeholder="Enter your name"
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Email Address</label>
                                        <input style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} value={user?.email || ''} readOnly />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={loading}
                                            style={{ padding: '0.65rem 1.4rem', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: 'var(--border-radius-sm)', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
                                        >
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {activeTab === 'Security' && (
                                <>
                                    <div>
                                        <label style={labelStyle}>New Password</label>
                                        <input
                                            type="password"
                                            style={inputStyle}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Minimum 6 characters"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <button
                                            onClick={handleUpdatePassword}
                                            disabled={loading || !newPassword}
                                            style={{ padding: '0.65rem 1.4rem', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: 'var(--border-radius-sm)', cursor: (loading || !newPassword) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                                        >
                                            {loading ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {activeTab === 'Staff Management' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--border-radius-md)', border: '1px dashed var(--glass-border)' }}>
                                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={16} /> Create New Staff Account</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={labelStyle}>Full Name</label>
                                                <input required style={inputStyle} value={newStaff.fullName} onChange={e => setNewStaff({ ...newStaff, fullName: e.target.value })} placeholder="Staff Name" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Email Address</label>
                                                <input required type="email" style={inputStyle} value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} placeholder="staff@cafewise.com" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={labelStyle}>Initial Password</label>
                                                <input required type="password" style={inputStyle} value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} placeholder="Enter Password" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Account Role</label>
                                                <select 
                                                    style={inputStyle} 
                                                    value={newStaff.role} 
                                                    onChange={e => setNewStaff({ ...newStaff, role: e.target.value as any })}
                                                >
                                                    <option value="STAFF">Staff Member</option>
                                                    <option value="ADMIN">Manager (Admin)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" disabled={loading} style={{ background: 'var(--accent-secondary)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                                            {loading ? 'Enrolling...' : 'Create Staff Member'}
                                        </button>
                                    </form>

                                    <div>
                                        <h4 style={{ margin: '0 0 1rem 0' }}>Current Staff ({staffList.length})</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {staffList.length === 0 ? (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>No staff accounts found.</p>
                                            ) : (
                                                staffList.map(staff => (
                                                    <div key={staff.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--border-radius-md)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                                                <User size={20} />
                                                            </div>
                                                            <div>
                                                                <p style={{ margin: 0, fontWeight: 500 }}>{staff.full_name}</p>
                                                                <p style={{ margin: 0, fontSize: '0.75rem', color: staff.role === 'ADMIN' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                                                    {staff.role === 'ADMIN' ? 'Manager' : 'Staff Member'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteStaff(staff.id, staff.full_name)}
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab !== 'Account' && activeTab !== 'Security' && activeTab !== 'Staff Management' && (
                                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                                    <p>{activeTab} settings coming soon in v3.0</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-primary)' }}>
                            <Shield size={18} /> Privacy & Security
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Your data is encrypted and synced securely via Supabase.</p>
                        <button
                            onClick={() => setActiveTab('Security')}
                            style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-sm)', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            Update Password
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-secondary)' }}>
                            <Info size={18} /> System Info
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>App Version</span>
                                <span style={{ fontWeight: 500 }}>v2.4.0-capstone</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Backend Status</span>
                                <span style={{ color: 'var(--status-success)', fontWeight: 500 }}>Connected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .settings-nav-btn {
                    padding: 0.85rem 1rem;
                    text-align: left;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    border-radius: var(--border-radius-sm);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                    border-left: 2px solid transparent;
                    outline: none;
                }
                .settings-nav-btn:hover {
                    background: rgba(0,0,0,0.05);
                    color: white;
                }
                .settings-nav-btn.active {
                    background: rgba(139, 92, 246, 0.1);
                    color: var(--accent-primary);
                    font-weight: 600;
                    border-left: 2px solid var(--accent-primary);
                }
            `}</style>
        </div>
    );
};

export default Settings;


