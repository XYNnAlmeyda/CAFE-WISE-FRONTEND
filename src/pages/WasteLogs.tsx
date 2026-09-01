import { useState, useEffect } from 'react';
import { PackageSearch, Calendar, Plus, X } from 'lucide-react';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';

interface WasteLog {
    id: string;
    ingredient_name: string;
    batch_number: string;
    date: string;
    quantity: string;
    reason: string;
    cost: string;
}

const WasteLogs = () => {
    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalValueLost, setTotalValueLost] = useState(0);
    const [mostWasted, setMostWasted] = useState<{ name: string; qty: number; unit: string } | null>(null);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        ingredient_id: '',
        quantity: '' as number | '',
        reason: 'Expired'
    });

    interface IngredientItem {
        id: string;
        name: string;
        unit: string;
        cost_per_unit: number;
        batch_number: string;
    }
    const [ingredientsList, setIngredientsList] = useState<IngredientItem[]>([]);

    useEffect(() => {
        fetchWasteLogs();
        fetchIngredientsList();
    }, []);

    const fetchIngredientsList = async () => {
        try {
            const data = await apiClient.get(API_ENDPOINTS.INGREDIENTS);
            if (Array.isArray(data)) {
                setIngredientsList(data.map((i: any) => ({
                    id: i.id,
                    name: i.name,
                    unit: i.unit,
                    cost_per_unit: i.cost_per_unit || 0,
                    batch_number: i.batch_number || 'Main'
                })));
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, ingredient_id: data[0].id }));
                }
            }
        } catch (error) {
            console.error("Error fetching ingredients:", error);
        }
    };

    const fetchWasteLogs = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get(API_ENDPOINTS.WASTE);

            let totalLost = 0;

            const formattedLogs = data.map((log: any) => {
                // Use ingredient cost if available, fall back to batch cost
                const costPerUnit = log.ingredients?.cost_per_unit
                    || log.inventory_transactions?.cost_per_unit
                    || 0;
                const logCost = costPerUnit * log.quantity;
                totalLost += logCost;

                // Show ingredient name if available, fall back to product name
                const displayName = log.ingredients?.name
                    || log.products?.name
                    || 'Unknown';
                const displayUnit = log.ingredients?.unit
                    || log.products?.unit_of_measure
                    || '';

                return {
                    id: log.id,
                    ingredient_name: displayName,
                    batch_number: log.ingredients?.batch_number || '-',
                    date: new Date(log.logged_date).toLocaleDateString(),
                    quantity: `${log.quantity} ${displayUnit}`,
                    reason: log.reason,
                    cost: `₱${logCost.toFixed(2)}`
                };
            });

            setWasteLogs(formattedLogs);
            setTotalValueLost(totalLost);

            // Compute Most Wasted Item
            const qtyByItem: Record<string, { name: string; qty: number; unit: string }> = {};
            data.forEach((log: any) => {
                const name = log.ingredients?.name || log.products?.name || 'Unknown';
                const unit = log.ingredients?.unit || log.products?.unit_of_measure || '';
                if (!qtyByItem[name]) qtyByItem[name] = { name, qty: 0, unit };
                qtyByItem[name].qty += Number(log.quantity);
            });
            const top = Object.values(qtyByItem).sort((a, b) => b.qty - a.qty)[0] || null;
            setMostWasted(top);
        } catch (error) {
            console.error("Error fetching waste logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogWaste = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.ingredient_id || Number(formData.quantity) <= 0) return;
        setSubmitting(true);

        try {
            await apiClient.post(API_ENDPOINTS.WASTE, {
                ingredient_id: formData.ingredient_id,
                quantity: formData.quantity,
                reason: formData.reason
            });

            setIsAddModalOpen(false);
            setFormData({ ...formData, quantity: '', reason: 'Expired' });
            fetchWasteLogs();
        } catch (error) {
            console.error("Error logging waste:", error);
            alert("Failed to log waste.");
        } finally {
            setSubmitting(false);
        }
    };

    const selectedIngredient = ingredientsList.find(i => i.id === formData.ingredient_id);

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Waste Logs</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track and analyze ingredient waste to improve efficiency.</p>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="glass-card" style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid var(--status-danger)',
                        color: 'var(--status-danger)',
                        padding: '0.6rem 1.2rem',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                    <Plus size={18} />
                    Log Waste
                </button>
            </div>

            {/* LOG WASTE MODAL */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--status-danger)' }}>Log Ingredient Waste</h3>
                            <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleLogWaste} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ingredient *</label>
                                <select required value={formData.ingredient_id} onChange={e => setFormData({ ...formData, ingredient_id: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'white', outline: 'none' }}>
                                    {ingredientsList.length === 0 && (
                                        <option value="" style={{ background: 'var(--bg-panel)' }}>No ingredients found — add some in Recipes</option>
                                    )}
                                    {ingredientsList.map(i => (
                                        <option key={i.id} value={i.id} style={{ background: 'var(--bg-panel)', color: 'white' }}>
                                            {i.name} (Batch: {i.batch_number}) — {i.unit} — ₱{i.cost_per_unit}/unit
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    Quantity Lost * {selectedIngredient ? `(${selectedIngredient.unit})` : ''}
                                </label>
                                <input required type="number" min="0.01" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'white' }} />
                                {selectedIngredient && formData.quantity !== '' && Number(formData.quantity) > 0 && (
                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--status-danger)' }}>
                                        Est. cost: ₱{(selectedIngredient.cost_per_unit * Number(formData.quantity)).toFixed(2)}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Reason *</label>
                                <select required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'white', outline: 'none' }}>
                                    <option value="Expired" style={{ background: 'var(--bg-panel)' }}>Expired</option>
                                    <option value="Preparation Error" style={{ background: 'var(--bg-panel)' }}>Preparation Error</option>
                                    <option value="Spillage" style={{ background: 'var(--bg-panel)' }}>Spillage</option>
                                    <option value="Damaged" style={{ background: 'var(--bg-panel)' }}>Damaged</option>
                                    <option value="Other" style={{ background: 'var(--bg-panel)' }}>Other</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'white', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: '0.75rem 1.5rem', background: 'var(--status-danger)', border: 'none', borderRadius: 'var(--border-radius-md)', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{submitting ? 'Logging...' : 'Log Waste Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="dashboard-grid">
                <div className="col-span-8 glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PackageSearch size={20} color="var(--accent-primary)" />
                        Recent Waste Entries
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Date</th>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Ingredient</th>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Batch #</th>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Quantity</th>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Reason</th>
                                <th style={{ padding: '1rem 0', fontWeight: 500 }}>Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Loading waste logs...
                                    </td>
                                </tr>
                            ) : wasteLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No waste logs found.
                                    </td>
                                </tr>
                            ) : (
                                wasteLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border-light)' }}>
                                        <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>{log.date}</td>
                                        <td style={{ padding: '1rem 0', fontWeight: 500 }}>{log.ingredient_name}</td>
                                        <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{log.batch_number}</td>
                                        <td style={{ padding: '1rem 0', color: 'var(--status-warning)' }}>{log.quantity}</td>
                                        <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{log.reason}</td>
                                        <td style={{ padding: '1rem 0', fontWeight: 600, color: 'var(--status-danger)' }}>{log.cost}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="col-span-4 glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={20} color="var(--status-info)" />
                        Waste Summary (This Month)
                    </h3>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5rem' }}>
                        <div>
                            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Total Value Lost</p>
                            <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--status-danger)' }}>₱{totalValueLost.toFixed(2)}</h2>
                        </div>
                        <div>
                            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Most Wasted Item</p>
                            {mostWasted ? (
                                <h4 style={{ margin: 0, fontSize: '1.25rem' }}>
                                    {mostWasted.name}{' '}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400 }}>({mostWasted.qty} {mostWasted.unit})</span>
                                </h4>
                            ) : (
                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No data yet</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default WasteLogs;


