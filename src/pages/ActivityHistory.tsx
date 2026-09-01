import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    Search,
    RefreshCw,
    BookOpen,
    AlertTriangle,
    Users,
    Package,
    ShoppingCart,
    Filter,
    Shield,
    CheckCircle2,
    Activity,
    Timer
} from 'lucide-react';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';

interface ActivityLog {
    id?: string;
    user_id?: string;
    user_name: string;
    user_role: string;
    action_type: 'RECIPE' | 'WASTE' | 'STAFF' | 'PRODUCTS' | 'SALES' | 'SHIFT' | string;
    action_title: string;
    details: string;
    created_at: string;
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    RECIPE: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: <BookOpen size={18} /> },
    WASTE: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <AlertTriangle size={18} /> },
    STAFF: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: <Users size={18} /> },
    PRODUCTS: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <Package size={18} /> },
    SALES: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <ShoppingCart size={18} /> },
    SHIFT: { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', icon: <Timer size={18} /> },
    GENERAL: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', icon: <Activity size={18} /> },
};

function parseLogDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    let s = dateStr.trim().replace(' ', 'T');

    // If no timezone indicator (+, -, Z after time portion), append Z for UTC default
    const tIndex = s.indexOf('T');
    if (tIndex !== -1) {
        const timePart = s.substring(tIndex);
        if (!timePart.includes('+') && !timePart.includes('-', 1) && !timePart.endsWith('Z')) {
            s += 'Z';
        }
    }
    let d = new Date(s);
    if (isNaN(d.getTime())) d = new Date(dateStr);

    // If parsing produced a future date (due to legacy UTC string interpreted as local), adjust by -8 hours
    const now = Date.now();
    if (d.getTime() > now + 60000) {
        d = new Date(d.getTime() - 8 * 3600 * 1000);
    }
    return d;
}

function formatDate(dateStr: string) {
    if (!dateStr) return '';
    try {
        const d = parseLogDate(dateStr);
        return d.toLocaleString('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return dateStr;
    }
}

function timeAgo(dateStr: string) {
    if (!dateStr) return '';
    try {
        const d = parseLogDate(dateStr);
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    } catch {
        return '';
    }
}

const ActivityHistory: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get(API_ENDPOINTS.ACTIVITY);
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch activity logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = useMemo(() => {
        const list = logs.filter(log => {
            const matchesType = filterType === 'ALL' || log.action_type?.toUpperCase() === filterType.toUpperCase();
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || (
                (log.user_name && log.user_name.toLowerCase().includes(q)) ||
                (log.action_title && log.action_title.toLowerCase().includes(q)) ||
                (log.details && log.details.toLowerCase().includes(q)) ||
                (log.action_type && log.action_type.toLowerCase().includes(q))
            );
            return matchesType && matchesSearch;
        });

        // Strict descending sort by normalized Date timestamp
        return list.sort((a, b) => {
            const tA = parseLogDate(a.created_at).getTime();
            const tB = parseLogDate(b.created_at).getTime();
            return tB - tA;
        });
    }, [logs, filterType, searchQuery]);

    const stats = useMemo(() => {
        const total = logs.length;
        const recipeCount = logs.filter(l => l.action_type === 'RECIPE').length;
        const wasteCount = logs.filter(l => l.action_type === 'WASTE').length;
        const staffCount = logs.filter(l => l.action_type === 'STAFF').length;
        return { total, recipeCount, wasteCount, staffCount };
    }, [logs]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }} className="text-gradient">
                        Activity & Audit History
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Track user actions including recipe creation, recipe building, waste logs, and system modifications.
                    </p>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 1.1rem',
                        background: 'rgba(0,0,0,0.06)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--border-radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh Logs
                </button>
            </div>

            {/* Summary KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-primary)' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Activities Logged</div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>{stats.recipeCount}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recipe & Build Actions</div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{stats.wasteCount}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waste Logs Recorded</div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{stats.staffCount}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Staff & User Events</div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search history by user, action, or keyword…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.7rem 1rem 0.7rem 2.8rem',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--border-radius-md)',
                                color: 'white',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Filter Pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['ALL', 'RECIPE', 'WASTE', 'STAFF', 'PRODUCTS', 'SALES', 'SHIFT'].map(cat => {
                            const active = filterType === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setFilterType(cat)}
                                    style={{
                                        padding: '0.45rem 0.85rem',
                                        borderRadius: '20px',
                                        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                                        background: active ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))' : 'rgba(0,0,0,0.05)',
                                        color: active ? 'white' : 'var(--text-secondary)',
                                        fontSize: '0.8rem',
                                        fontWeight: active ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {cat === 'ALL' ? 'All Activities' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Timeline Activity List */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent-primary)' }} />
                        Loading activity history…
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Clock size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                        <p style={{ fontSize: '1rem', margin: 0 }}>No activity records found.</p>
                        <p style={{ fontSize: '0.825rem', marginTop: '0.25rem' }}>
                            {searchQuery || filterType !== 'ALL' ? 'Try adjusting your search or category filter.' : 'User actions like recipe creation, recipe building, and waste logs will appear here.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredLogs.map((log, idx) => {
                            const catConfig = CATEGORY_COLORS[log.action_type?.toUpperCase()] || CATEGORY_COLORS.GENERAL;
                            const isStaffRole = log.user_role === 'STAFF';
                            const roleBadgeBg = isStaffRole ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)';
                            const roleBadgeColor = isStaffRole ? '#f59e0b' : '#8b5cf6';

                            return (
                                <div
                                    key={log.id || idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '1rem',
                                        padding: '1rem 1.25rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 'var(--border-radius-md)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {/* Icon Badge */}
                                    <div
                                        style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '12px',
                                            background: catConfig.bg,
                                            color: catConfig.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {catConfig.icon}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                    {log.action_title}
                                                </span>
                                                <span
                                                    style={{
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '6px',
                                                        background: catConfig.bg,
                                                        color: catConfig.color,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.04em'
                                                    }}
                                                >
                                                    {log.action_type}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} title={formatDate(log.created_at)}>
                                                    {timeAgo(log.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0.5rem', lineHeight: 1.5 }}>
                                            {log.details}
                                        </p>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>By:</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{log.user_name || 'System User'}</strong>
                                            <span
                                                style={{
                                                    padding: '0.1rem 0.4rem',
                                                    borderRadius: '4px',
                                                    background: roleBadgeBg,
                                                    color: roleBadgeColor,
                                                    fontWeight: 700,
                                                    fontSize: '0.68rem',
                                                }}
                                            >
                                                {log.user_role || 'USER'}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.75rem' }}>
                                                {formatDate(log.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityHistory;


