import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, Coffee, CheckCircle, Eye, EyeOff } from 'lucide-react';

const ResetPassword: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Supabase puts the recovery tokens in the URL hash after redirect.
        // We listen for the PASSWORD_RECOVERY event to know the session is ready.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            }
        });

        // Also check if there's already an active session (user came back to the page)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            setDone(true);
            // Redirect to login after 3 seconds
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. The link may have expired.');
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
                    <p className="text-secondary">Set a new password</p>
                </div>

                {done ? (
                    <div className="forgot-success animate-fade-in">
                        <div className="forgot-success-icon">
                            <CheckCircle size={40} />
                        </div>
                        <h2>Password updated!</h2>
                        <p className="text-secondary">
                            Your password has been changed successfully. Redirecting you to sign in…
                        </p>
                        <Link to="/login" className="forgot-back-link">
                            Go to Sign In
                        </Link>
                    </div>
                ) : !sessionReady ? (
                    <div className="forgot-success">
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
                        <p className="text-secondary" style={{ marginTop: '0.5rem' }}>
                            Verifying your reset link…
                        </p>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            If this takes too long, the link may have expired.{' '}
                            <Link to="/forgot-password" className="forgot-password-link">Request a new one</Link>.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="login-form">
                        {error && <div className="error-message">{error}</div>}

                        <div className="input-group">
                            <label htmlFor="new-password">New Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    id="new-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: '3rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    style={{
                                        position: 'absolute', right: '0.75rem',
                                        background: 'none', border: 'none',
                                        color: 'var(--text-muted)', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="confirm-password">Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    id="confirm-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`login-button ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;

