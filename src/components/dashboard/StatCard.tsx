import React from 'react';

interface StatCardProps {
    title: string;
    value: string;
    trend?: string;
    isPositive?: boolean;
    icon: React.ReactNode;
    delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, isPositive = true, icon, delay = 0 }) => {
    return (
        <div
            className={`glass-card animate-fade-in`}
            style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                animationDelay: `${delay}s`
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                    {title}
                </p>
                <div style={{
                    padding: '0.5rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 'var(--border-radius-sm)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {icon}
                </div>
            </div>

            <div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>{value}</h3>
                {trend && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                            color: isPositive ? 'var(--status-success)' : 'var(--status-danger)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            background: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px'
                        }}>
                            {isPositive ? '+' : ''}{trend}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>vs last week</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;

