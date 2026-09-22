import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/products';
import WasteLogs from './pages/WasteLogs';
import Analytics from './pages/Analytics';
import Sales from './pages/Sales';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Recipes from './pages/Recipes';
import ActivityHistory from './pages/ActivityHistory';
import SettingsPage from './pages/Settings';
import StaffManagement from './pages/StaffManagement';

// Pages accessible by STAFF
const STAFF_ALLOWED = ['/sales', '/waste-logs', '/recipes', '/products'];

function AppInner() {
    const { session, role, loading } = useAuth();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Auto-close mobile navigation drawer on route change
    useEffect(() => {
        setMobileNavOpen(false);
    }, [location.pathname]);

    // Pages that use the full-screen login layout (no sidebar/topbar)
    const isLoginPage = location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname === '/reset-password';
    // Pages that should redirect to home if already logged in (reset-password excluded — it needs the recovery session)
    const isAuthOnlyPage = location.pathname === '/login' || location.pathname === '/forgot-password';
    const isStaff = role === 'STAFF';

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    border: '3px solid transparent',
                    borderTop: '3px solid var(--accent-primary)',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Not logged in → go to login (allow /reset-password through — Supabase recovery link provides session)
    if (!session && !isLoginPage) return <Navigate to="/login" replace />;
    // Already logged in on a plain auth page (login/forgot) → go home (or /recipes for staff)
    if (session && isAuthOnlyPage) return <Navigate to={isStaff ? "/recipes" : "/"} replace />;

    // Staff trying to access an admin-only page or root '/' → redirect to /recipes
    if (session && isStaff && !isLoginPage) {
        const path = location.pathname;
        const allowed = STAFF_ALLOWED.some(p => path === p || path.startsWith(p + '/'));
        if (!allowed) {
            return <Navigate to="/recipes" replace />;
        }
    }

    return (
        <div className="app-layout">
            {!isLoginPage && (
                <Sidebar 
                    isOpen={mobileNavOpen} 
                    onClose={() => setMobileNavOpen(false)} 
                />
            )}
            <main className={isLoginPage ? 'login-main-wrapper' : 'main-content'}>
                {!isLoginPage && (
                    <Topbar 
                        onToggleMobileNav={() => setMobileNavOpen(prev => !prev)} 
                    />
                )}
                <div className={isLoginPage ? 'login-center-container' : 'scrollable-content'}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/" element={isStaff ? <Navigate to="/recipes" replace /> : <Dashboard />} />
                        <Route path="/products" element={<Inventory />} />
                        <Route path="/sales" element={<Sales />} />
                        <Route path="/analytics" element={isStaff ? <Navigate to="/recipes" replace /> : <Analytics />} />
                        <Route path="/waste-logs" element={<WasteLogs />} />
                        <Route path="/recipes" element={<Recipes />} />
                        <Route path="/history" element={isStaff ? <Navigate to="/recipes" replace /> : <ActivityHistory />} />
                        <Route path="/staff" element={isStaff ? <Navigate to="/recipes" replace /> : <StaffManagement />} />
                        <Route path="/settings" element={isStaff ? <Navigate to="/recipes" replace /> : <SettingsPage />} />
                        <Route path="*" element={<Navigate to={isStaff ? "/recipes" : "/"} replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppInner />
        </AuthProvider>
    );
}

export default App

