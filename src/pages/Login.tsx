import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, Coffee, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Read any error stored by AuthContext (e.g., operating hours denial, auto-logout)
    useEffect(() => {
        const savedErr = sessionStorage.getItem('staff_login_error');
        if (savedErr) {
            setError(savedErr);
            sessionStorage.removeItem('staff_login_error');
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) throw authError;
            if (!data.user || !data.session) throw new Error('User account not found.');

            // AuthContext.fetchProfile handles the server-side hours check via verify-login.
            // It keeps loading=true until the check resolves, preventing any dashboard blink.
            // If the check fails, AuthContext stores the error in sessionStorage and signs out,
            // causing this page to remount and show the error automatically.
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-background-blobs">
                <div className="blob blob-1" />
                <div className="blob blob-2" />
            </div>

            <div className="glass-card login-card animate-fade-in">
                <div className="login-header">
                    <div className="login-logo-container">
                        <Coffee className="login-logo-icon" size={26} />
                    </div>
                    <h1 className="text-gradient">CafeWise</h1>
                    <p className="text-secondary">Houseblend Coffee Management System</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && (
                        <div style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            lineHeight: '1.4',
                        }}>
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={18} />
                            <input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={18} />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="forgot-password-row">
                        <Link to="/forgot-password" className="forgot-password-link">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        className={`login-button ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
                    </button>

                    <div className="login-footer">
                        <p className="text-muted">Contact your administrator for account access.</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
