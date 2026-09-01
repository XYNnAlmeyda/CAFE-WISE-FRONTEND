import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Loader2, Coffee, ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) throw resetError;
            setSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send reset email. Please try again.');
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
                    <p className="text-secondary">Reset your password</p>
                </div>

                {sent ? (
                    <div className="forgot-success animate-fade-in">
                        <div className="forgot-success-icon">
                            <CheckCircle size={40} />
                        </div>
                        <h2>Check your email</h2>
                        <p className="text-secondary">
                            We sent a password reset link to <strong>{email}</strong>.
                            Please check your inbox and follow the instructions.
                        </p>
                        <Link to="/login" className="forgot-back-link">
                            <ArrowLeft size={16} />
                            Back to Sign In
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="login-form">
                        {error && <div className="error-message">{error}</div>}

                        <p className="forgot-description text-secondary">
                            Enter the email address associated with your account and we'll send you a link to reset your password.
                        </p>

                        <div className="input-group">
                            <label htmlFor="reset-email">Email Address</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={18} />
                                <input
                                    id="reset-email"
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`login-button ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
                        </button>

                        <div className="login-footer">
                            <Link to="/login" className="forgot-back-link">
                                <ArrowLeft size={16} />
                                Back to Sign In
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;

