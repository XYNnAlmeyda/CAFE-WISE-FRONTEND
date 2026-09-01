import React from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
    Coffee,
    LayoutDashboard,
    Package,
    ShoppingCart,
    TrendingUp,
    AlertTriangle,
    BookOpen,
    Users,
    Settings,
    LogOut,
    Clock
} from 'lucide-react';

const ADMIN_NAV = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', to: '/' },
    { icon: <Package size={20} />, label: 'Products', to: '/products' },
    { icon: <ShoppingCart size={20} />, label: 'Sales', to: '/sales' },
    { icon: <TrendingUp size={20} />, label: 'Analytics', to: '/analytics' },
    { icon: <AlertTriangle size={20} />, label: 'Waste Logs', to: '/waste-logs' },
    { icon: <BookOpen size={20} />, label: 'Recipes', to: '/recipes' },
    { icon: <Clock size={20} />, label: 'History', to: '/history' },
    { icon: <Users size={20} />, label: 'Staff', to: '/staff' },
];

const STAFF_NAV = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', to: '/' },
    { icon: <ShoppingCart size={20} />, label: 'Sales', to: '/sales' },
    { icon: <AlertTriangle size={20} />, label: 'Waste Logs', to: '/waste-logs' },
];

const Sidebar = () => {
    const { role, fullName } = useAuth();
    const isStaff = role === 'STAFF';
    const navItems = isStaff ? STAFF_NAV : ADMIN_NAV;

    const roleBadgeColor = isStaff ? '#f59e0b' : '#8b5cf6';
    const roleBadgeBg = isStaff ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)';

    return (
        <aside style={{
            width: 'var(--sidebar-width)',
            height: '100vh',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--glass-border-light)'
        }} className="glass-panel">

            {/* Logo + brand */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.75rem',
                padding: '0 0.5rem'
            }}>
                <div style={{
                    background: isStaff
                        ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    padding: '0.5rem',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Coffee size={22} color="white" />
                </div>
                <h1 style={{ fontSize: '1.2rem', margin: 0 }} className="text-gradient">CafeWise</h1>
            </div>

            {/* Role + user badge */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                background: roleBadgeBg,
                border: `1px solid ${roleBadgeColor}30`,
                borderRadius: '8px',
                marginBottom: '2rem',
                marginLeft: '0.5rem',
            }}>
                <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: roleBadgeColor, flexShrink: 0,
                    boxShadow: `0 0 6px ${roleBadgeColor}`,
                }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: roleBadgeColor, letterSpacing: '0.06em' }}>
                    {role || 'USER'}
                </span>
                {fullName && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                        {fullName}
                    </span>
                )}
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                {navItems.map(item => (
                    <NavItem key={item.to} icon={item.icon} label={item.label} to={item.to} accentColor={roleBadgeColor} />
                ))}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                {!isStaff && <NavItem icon={<Settings size={20} />} label="Settings" to="/settings" accentColor={roleBadgeColor} />}
                <div onClick={() => supabase.auth.signOut()} style={{ cursor: 'pointer' }}>
                    <NavItem icon={<LogOut size={20} />} label="Logout" color="var(--status-danger)" />
                </div>
            </div>
        </aside>
    );
};

const NavItem = ({
    icon, label, to = '#', color = 'var(--text-secondary)', accentColor = 'var(--accent-primary)'
}: {
    icon: React.ReactNode;
    label: string;
    to?: string;
    color?: string;
    accentColor?: string;
}) => {
    return (
        <NavLink to={to} style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--border-radius-md)',
            color: isActive ? accentColor : color,
            background: isActive ? `${accentColor}18` : 'transparent',
            borderLeft: isActive ? `3px solid ${accentColor}` : '3px solid transparent',
            textDecoration: 'none',
            transition: 'all var(--transition-fast)',
            fontWeight: isActive ? 600 : 400,
            fontSize: '0.9rem',
        })}
            onMouseEnter={(e: any) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e: any) => {
                if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = color;
                }
            }}>
            {icon}
            <span>{label}</span>
        </NavLink>
    );
};

export default Sidebar;

