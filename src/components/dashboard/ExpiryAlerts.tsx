import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { API_ENDPOINTS } from '../../lib/api';
import { apiClient } from '../../lib/apiClient';

interface ExpiryAlert {
    id: string;
    product: string;
    batch: string;
    daysLeft: number;
    quantity: string;
    status: 'critical' | 'warning' | 'info';
}

const ExpiryAlerts = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [disposingId, setDisposingId] = useState<string | null>(null);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        try {
            const data = await apiClient.get(API_ENDPOINTS.ALERTS);
            if (data) {
                const formatted = data
                    .map((batch: any) => {
                        const daysLeft = Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                        return {
                            id: batch.id,
                            product: batch.products?.name || 'Unknown',
                            batch: batch.batch_number,
                            daysLeft: daysLeft,
                            quantity: `${batch.quantity} ${batch.products?.unit_of_measure || ''}`,
                            status: daysLeft <= 1 ? 'critical' : daysLeft <= 7 ? 'warning' : 'info'
                        };
                    })
                    .filter((alert: any) => alert.daysLeft <= 7); // Show anything <= 7 days, including expired

                // Sort by nearest to expire first
                formatted.sort((a: any, b: any) => a.daysLeft - b.daysLeft);

                setAlerts(formatted as ExpiryAlert[]);
            }
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDispose = async (item: ExpiryAlert) => {
        if (!window.confirm(`Are you sure you want to dispose of ${item.product} (${item.quantity})? This will remove the stock and log it as waste.`)) return;

        setDisposingId(item.id);
        try {
            // Extract numeric quantity
            const numericQty = parseFloat(item.quantity.split(' ')[0]) || 0;

            await apiClient.post(API_ENDPOINTS.WASTE, {
                ingredient_id: item.id,
                quantity: numericQty,
                reason: 'Expired'
            });

            await fetchAlerts();
        } catch (error) {
            console.error("Error disposing item:", error);
            window.alert('An error occurred.');
        } finally {
            setDisposingId(null);
        }
    };
    return (
        <>
            <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column', animationDelay: '0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={18} color="var(--status-warning)" />
                        Expiry Alerts
                    </h3>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                        View All
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                    {loading ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>
                    ) : alerts.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items expiring soon.</div>
                    ) : alerts.slice(0, 5).map(alert => (
                        <div key={alert.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border-light)',
                            borderRadius: 'var(--border-radius-md)',
                            borderLeft: `4px solid ${alert.status === 'critical' ? 'var(--status-danger)' :
                                alert.status === 'warning' ? 'var(--status-warning)' : 'var(--status-info)'
                                }`
                        }}>
                            <div>
                                <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>{alert.product}</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Batch: {alert.batch} • Qty: {alert.quantity}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                color: alert.status === 'critical' ? 'var(--status-danger)' :
                                    alert.status === 'warning' ? 'var(--status-warning)' : 'var(--text-secondary)',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '0.3rem 0.6rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.875rem'
                            }}>
                                <Clock size={14} />
                                <span>
                                    {alert.daysLeft < 0 ? `Expired ${Math.abs(alert.daysLeft)}d ago` :
                                        alert.daysLeft === 0 ? 'Expires Today' :
                                            `${alert.daysLeft} ${alert.daysLeft === 1 ? 'day' : 'days'}`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* View All Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div className="glass-panel animate-fade-in" style={{
                        width: '100%', maxWidth: '600px', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column',
                        background: 'var(--bg-panel)',
                        borderRadius: 'var(--border-radius-lg)',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            padding: '1.5rem', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={20} color="var(--status-warning)" />
                                All Expiry Alerts ({alerts.length})
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {alerts.map(alert => (
                                <div key={`modal-${alert.id}`} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--glass-border-light)',
                                    borderRadius: 'var(--border-radius-md)',
                                    borderLeft: `4px solid ${alert.status === 'critical' ? 'var(--status-danger)' :
                                        alert.status === 'warning' ? 'var(--status-warning)' : 'var(--status-info)'
                                        }`
                                }}>
                                    <div>
                                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>{alert.product}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Batch: {alert.batch} • Qty: {alert.quantity}
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            color: alert.status === 'critical' ? 'var(--status-danger)' :
                                                alert.status === 'warning' ? 'var(--status-warning)' : 'var(--text-secondary)',
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: 'var(--border-radius-sm)',
                                            fontSize: '0.875rem'
                                        }}>
                                            <Clock size={14} />
                                            <span>
                                                {alert.daysLeft < 0 ? `Expired ${Math.abs(alert.daysLeft)}d ago` :
                                                    alert.daysLeft === 0 ? 'Expires Today' :
                                                        `${alert.daysLeft} ${alert.daysLeft === 1 ? 'day' : 'days'}`}
                                            </span>
                                        </div>

                                        <button
                                            disabled={disposingId === alert.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDispose(alert);
                                            }}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#ef4444',
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: 'var(--border-radius-sm)',
                                                fontSize: '0.75rem',
                                                cursor: disposingId === alert.id ? 'not-allowed' : 'pointer',
                                                fontWeight: 700,
                                                transition: 'all 0.2s',
                                                opacity: disposingId === alert.id ? 0.5 : 1,
                                                whiteSpace: 'nowrap'
                                            }}
                                            onMouseEnter={(e) => { if (disposingId !== alert.id) { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; } }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                                        >
                                            {disposingId === alert.id ? 'Removing...' : 'Dispose & Remove'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExpiryAlerts;

