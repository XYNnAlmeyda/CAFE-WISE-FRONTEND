import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'

import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/products'
import WasteLogs from './pages/WasteLogs'
import Analytics from './pages/Analytics'
import Sales from './pages/Sales'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Recipes from './pages/Recipes'
import ActivityHistory from './pages/ActivityHistory'
import SettingsPage from './pages/Settings'
import StaffManagement from './pages/StaffManagement'

// Pages accessible by STAFF only
const STAFF_ALLOWED = ['/sales', '/waste-logs'];

function AppInner() {
    const { session, role, loading } = useAuth();
    const location = useLocation();
    // Pages that use the full-screen login layout (no sidebar/topbar)
    const isLoginPage = location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname === '/reset-password';
    // Pages that should redirect to home if already logged in (reset-password excluded — it needs the recovery session)
    const isAuthOnlyPage = location.pathname === '/login' || location.pathname === '/forgot-password';
    const isStaff = role === 'STAFF';
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';

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
    // Already logged in on a plain auth page (login/forgot) → go home
    if (session && isAuthOnlyPage) return <Navigate to="/" replace />;

    // Staff trying to access an admin-only page → redirect to /sales
    if (session && isStaff && !isLoginPage) {
        const path = location.pathname;
        const allowed = STAFF_ALLOWED.some(p => path === p || path.startsWith(p + '/'));
        if (!allowed && path !== '/') {
            return <Navigate to="/sales" replace />;
        }
    }

    return (
        <div className="app-layout">
            {!isLoginPage && <Sidebar />}
            <main className={isLoginPage ? 'login-main-wrapper' : 'main-content'}>
                {!isLoginPage && <Topbar />}
                <div className={isLoginPage ? 'login-center-container' : 'scrollable-content'}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/products" element={isStaff ? <Navigate to="/sales" replace /> : <Inventory />} />
                        <Route path="/sales" element={<Sales />} />
                        <Route path="/analytics" element={isStaff ? <Navigate to="/sales" replace /> : <Analytics />} />
                        <Route path="/waste-logs" element={<WasteLogs />} />
                        <Route path="/recipes" element={isStaff ? <Navigate to="/sales" replace /> : <Recipes />} />
                        <Route path="/history" element={isStaff ? <Navigate to="/sales" replace /> : <ActivityHistory />} />
                        <Route path="/staff" element={isStaff ? <Navigate to="/sales" replace /> : <StaffManagement />} />
                        <Route path="/settings" element={isStaff ? <Navigate to="/sales" replace /> : <SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
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

