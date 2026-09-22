import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Package, X, Shield, Users, Timer, Play, Square, CheckCircle, Menu } from 'lucide-react';
import { API_ENDPOINTS } from '../../lib/api';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../lib/AuthContext';

interface Notification {
    id: string;
    type: 'expiry' | 'lowstock';
    title: string;
    detail: string;
    daysLeft?: number;
    batchId?: string;
    quantity?: number;
}

interface Shift {
    id: string;
    opened_by: string;
    opened_at: string;
    opening_cash: number;
    opening_ewallet?: number;
    cash_sales?: number;
    ewallet_sales?: number;
    total_sales?: number;
    expected_cash?: number;
    expected_ewallet?: number;
    status: 'OPEN' | 'CLOSED';
}

interface TopbarProps {
    onToggleMobileNav?: () => void;
}

const Topbar = ({ onToggleMobileNav }: TopbarProps) => {
    const { role, fullName } = useAuth();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const shiftRef = useRef<HTMLDivElement>(null);

    // Shift state
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [shiftOpen, setShiftOpen] = useState(false);
    const [openingCash, setOpeningCash] = useState('');
    const [openingEwallet, setOpeningEwallet] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [closingEwallet, setClosingEwallet] = useState('');
    const [shiftNotes, setShiftNotes] = useState('');
    const [shiftSubmitting, setShiftSubmitting] = useState(false);
    const [shiftMsg, setShiftMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isStaff = role === 'STAFF';
    const roleColor = isStaff ? '#f59e0b' : '#8b5cf6';
    const RoleIcon = isStaff ? Users : Shield;
    const roleLabel = isStaff ? 'Staff' : 'Manager';
    const displayName = fullName || (isStaff ? 'Staff Member' : 'Admin User');

    useEffect(() => {
        fetchNotifications();
        fetchCurrentShift();

        const handleShiftUpdate = () => fetchCurrentShift();
        window.addEventListener('sale-recorded', handleShiftUpdate);
        window.addEventListener('shift-changed', handleShiftUpdate);
        window.addEventListener('focus', handleShiftUpdate);

        return () => {
            window.removeEventListener('sale-recorded', handleShiftUpdate);
            window.removeEventListener('shift-changed', handleShiftUpdate);
            window.removeEventListener('focus', handleShiftUpdate);
        };
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
            if (shiftRef.current && !shiftRef.current.contains(e.target as Node)) {
                setShiftOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchCurrentShift = async () => {
        try {
            const data = await apiClient.get(`${API_ENDPOINTS.SHIFTS}/current`);
            setCurrentShift(data || null);
        } catch {
            setCurrentShift(null);
        }
    };

    const _MAX_FLOAT = 500000;

    const handleOpenShift = async (e: React.FormEvent) => {
        e.preventDefault();
        const cashVal = Number(openingCash);
        const ewVal = Number(openingEwallet);

        if (isNaN(cashVal) || cashVal < 0 || cashVal > _MAX_FLOAT) {
            setShiftMsg({ type: 'error', text: `Opening cash float must be between ₱0 and ₱${_MAX_FLOAT.toLocaleString()}` });
            return;
        }
        if (isNaN(ewVal) || ewVal < 0 || ewVal > _MAX_FLOAT) {
            setShiftMsg({ type: 'error', text: `Opening e-wallet float must be between ₱0 and ₱${_MAX_FLOAT.toLocaleString()}` });
            return;
        }

        setShiftSubmitting(true);
        setShiftMsg(null);
        try {
            const res = await apiClient.post(`${API_ENDPOINTS.SHIFTS}/open`, {
                opening_cash: cashVal,
                opening_ewallet: ewVal
            });
            setCurrentShift({
                id: res.shift_id,
                opened_by: res.opened_by,
                opened_at: res.opened_at,
                opening_cash: res.opening_cash,
                opening_ewallet: ewVal,
                status: 'OPEN'
            });
            setOpeningCash('');
            setOpeningEwallet('');
            setShiftMsg({ type: 'success', text: 'Shift opened!' });
            window.dispatchEvent(new Event('shift-changed'));
            setTimeout(() => { setShiftMsg(null); setShiftOpen(false); }, 1500);
        } catch (err: any) {
            setShiftMsg({ type: 'error', text: err.message || 'Failed to open shift' });
        } finally {
            setShiftSubmitting(false);
        }
    };

    const handleCloseShift = async (e: React.FormEvent) => {
        e.preventDefault();
        const cashVal = Number(closingCash);
        const ewVal = Number(closingEwallet);

        if (isNaN(cashVal) || cashVal < 0 || cashVal > _MAX_FLOAT) {
            setShiftMsg({ type: 'error', text: `Closing cash amount must be between ₱0 and ₱${_MAX_FLOAT.toLocaleString()}` });
            return;
        }
        if (isNaN(ewVal) || ewVal < 0 || ewVal > _MAX_FLOAT) {
            setShiftMsg({ type: 'error', text: `Closing e-wallet amount must be between ₱0 and ₱${_MAX_FLOAT.toLocaleString()}` });
            return;
        }

        setShiftSubmitting(true);
        setShiftMsg(null);
        try {
            await apiClient.post(`${API_ENDPOINTS.SHIFTS}/close`, {
                closing_cash: cashVal,
                closing_ewallet: ewVal,
                notes: shiftNotes.trim().slice(0, 500)
            });
            setCurrentShift(null);
            setClosingCash('');
            setClosingEwallet('');
            setShiftNotes('');
            setShiftMsg({ type: 'success', text: 'Shift closed!' });
            window.dispatchEvent(new Event('shift-changed'));
            setTimeout(() => { setShiftMsg(null); setShiftOpen(false); }, 1500);
        } catch (err: any) {
            setShiftMsg({ type: 'error', text: err.message || 'Failed to close shift' });
        } finally {
            setShiftSubmitting(false);
        }
    };

    const fetchNotifications = async () => {
        try {
            const [alertsData, products, ingredients] = await Promise.all([
                apiClient.get(API_ENDPOINTS.ALERTS),
                apiClient.get(API_ENDPOINTS.INVENTORY),
                apiClient.get(API_ENDPOINTS.INGREDIENTS)
            ]);
            const notifs: Notification[] = [];

            if (alertsData && Array.isArray(alertsData)) {
                alertsData.forEach((batch: any) => {
                    const daysLeft = Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    // Show if it expires within 7 days, OR if it's already expired (daysLeft <= 0)
                    if (daysLeft <= 7) {
                        notifs.push({
                            id: `exp-${batch.id}`,
                            type: 'expiry',
                            title: daysLeft < 0 ? `Expired: ${batch.products?.name || 'Unknown'}` : `Expiring Soon: ${batch.products?.name || 'Unknown'}`,
                            detail: `Batch ${batch.batch_number || 'Main'} · Qty: ${batch.quantity} ${batch.products?.unit_of_measure || ''}`,
                            daysLeft,
                            batchId: batch.id,
                            quantity: batch.quantity
                        });
                    }
                });
            }

            if (products && Array.isArray(products)) {
                products.forEach((p: any) => {
                    if (p.is_active === false) return; // Skip inactive products

                    const batchStock = (p.inventory_transactions || [])
                        .filter((b: any) => b.status === 'ACTIVE')
                        .reduce((s: number, b: any) => s + Number(b.quantity), 0);

                    // Use recipe_stock if product relies on recipe ingredients
                    const totalStock = p.recipe_stock != null ? Number(p.recipe_stock) : batchStock;
                    const reorderLvl = p.reorder_level != null ? Number(p.reorder_level) : 5;

                    if (totalStock === 0) {
                        const detailStr = p.limiting_ingredient
                            ? `Out of stock: ${p.limiting_ingredient} is depleted.`
                            : `No active stock. Please restock immediately.`;
                        notifs.push({
                            id: `out-${p.id}`,
                            type: 'lowstock',
                            title: `Out of Stock: ${p.name}`,
                            detail: detailStr
                        });
                    } else if (totalStock <= reorderLvl) {
                        notifs.push({
                            id: `low-${p.id}`,
                            type: 'lowstock',
                            title: `Low Stock: ${p.name}`,
                            detail: `Only ${totalStock} ${p.unit_of_measure || 'pcs'} left (reorder at ${reorderLvl})`
                        });
                    }
                });
            }

            if (ingredients && Array.isArray(ingredients)) {
                ingredients.forEach((ing: any) => {
                    const qty = Number(ing.stock_quantity || 0);
                    const minLvl = Number(ing.min_stock_level || 0);
                    if (qty === 0) {
                        notifs.push({
                            id: `ing-out-${ing.id}`,
                            type: 'lowstock',
                            title: `Ingredient Out of Stock: ${ing.name}`,
                            detail: `Stock is 0 ${ing.unit || ''}. Please restock ingredient.`
                        });
                    } else if (minLvl > 0 && qty <= minLvl) {
                        notifs.push({
                            id: `ing-low-${ing.id}`,
                            type: 'lowstock',
                            title: `Low Ingredient Stock: ${ing.name}`,
                            detail: `Only ${qty} ${ing.unit || ''} left (minimum: ${minLvl} ${ing.unit || ''})`
                        });
                    }
                });
            }

            notifs.sort((a, b) => {
                if (a.daysLeft !== undefined && b.daysLeft !== undefined) return a.daysLeft - b.daysLeft;
                if (a.daysLeft !== undefined) return -1;
                if (b.daysLeft !== undefined) return 1;
                if (a.title.startsWith('Out of Stock') && !b.title.startsWith('Out of Stock')) return -1;
                if (!a.title.startsWith('Out of Stock') && b.title.startsWith('Out of Stock')) return 1;
                return 0;
            });

            setNotifications(notifs);
        } catch {
            // silently fail
        }
    };


    const unread = notifications.length;

    return (
        <header className="topbar-container glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                    onClick={onToggleMobileNav}
                    className="mobile-menu-toggle-btn"
                    aria-label="Toggle Navigation Menu"
                >
                    <Menu size={22} />
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                {/* Shift Status Widget */}
                <div ref={shiftRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => {
                            setShiftOpen(o => !o);
                            // Refresh shift data every time the panel is opened
                            fetchCurrentShift();
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            border: currentShift ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
                            background: currentShift ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: currentShift ? '#10b981' : '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: currentShift ? '#10b981' : '#ef4444',
                            boxShadow: currentShift ? '0 0 6px #10b981' : '0 0 6px #ef4444',
                        }} />
                        <span>{currentShift ? 'Shift Open' : 'No Active Shift'}</span>
                    </button>

                    {shiftOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                            width: '320px',
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--border-radius-md)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            zIndex: 200,
                            padding: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Timer size={18} color={currentShift ? '#10b981' : '#ef4444'} />
                                    {currentShift ? 'Shift In Progress' : 'Open New Shift'}
                                </span>
                                <button onClick={() => setShiftOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            {shiftMsg && (
                                <div style={{
                                    padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.85rem',
                                    background: shiftMsg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                    color: shiftMsg.type === 'success' ? '#10b981' : '#ef4444',
                                    border: `1px solid ${shiftMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                                }}>
                                    {shiftMsg.text}
                                </div>
                            )}

                            {!currentShift ? (
                                <form onSubmit={handleOpenShift} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                        Start your work shift to track sales and cash drawer floating amount.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Opening Cash Float (PHP)
                                            </label>
                                            <input
                                                type="number" step="0.01" min="0" required
                                                value={openingCash} onChange={e => setOpeningCash(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.55rem 0.75rem',
                                                    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.9rem',
                                                    boxSizing: 'border-box'
                                                }}
                                                placeholder="e.g. 1000.00"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Opening E-Wallet (PHP)
                                            </label>
                                            <input
                                                type="number" step="0.01" min="0" required
                                                value={openingEwallet} onChange={e => setOpeningEwallet(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.55rem 0.75rem',
                                                    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.9rem',
                                                    boxSizing: 'border-box'
                                                }}
                                                placeholder="e.g. 0.00"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit" disabled={shiftSubmitting}
                                        style={{
                                            padding: '0.65rem', borderRadius: '8px', border: 'none',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: 'white', fontWeight: 700, fontSize: '0.875rem',
                                            cursor: shiftSubmitting ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                                        }}
                                    >
                                        <Play size={14} /> {shiftSubmitting ? 'Opening…' : 'Start / Open Shift'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleCloseShift} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <div style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--glass-border-light)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.35rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Opener:</span> <strong>{currentShift.opened_by}</strong>
                                        </div>

                                        {/* Opening Floats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Opening Cash</span>
                                                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`PHP ${Number(currentShift.opening_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                                                    PHP {Number(currentShift.opening_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Opening E-Wallet</span>
                                                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`PHP ${Number(currentShift.opening_ewallet || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                                                    PHP {Number(currentShift.opening_ewallet || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Shift Sales Breakdown */}
                                        <div style={{ height: '1px', background: 'var(--glass-border-light)' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', overflow: 'hidden' }}>
                                            <span>Cash Sales:</span> <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+PHP {Number(currentShift.cash_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#06b6d4', overflow: 'hidden' }}>
                                            <span>E-Wallet Sales:</span> <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+PHP {Number(currentShift.ewallet_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                        </div>

                                        {/* Expected Totals */}
                                        <div style={{ height: '1px', borderTop: '1px dashed var(--glass-border)', marginTop: '0.1rem' }} />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', paddingTop: '0.2rem', fontWeight: 700 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 400 }}>Expected Cash</span>
                                                <span style={{ color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`PHP ${Number(currentShift.expected_cash ?? currentShift.opening_cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                                                    PHP {Number(currentShift.expected_cash ?? currentShift.opening_cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 400 }}>Expected E-Wallet</span>
                                                <span style={{ color: '#06b6d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`PHP ${Number(currentShift.expected_ewallet ?? currentShift.opening_ewallet ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                                                    PHP {Number(currentShift.expected_ewallet ?? currentShift.opening_ewallet ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                Closing Cash (PHP)
                                            </label>
                                            <input
                                                type="number" step="0.01" min="0" max="500000" required
                                                value={closingCash} onChange={e => setClosingCash(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.5rem 0.65rem',
                                                    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.85rem',
                                                    boxSizing: 'border-box'
                                                }}
                                                placeholder="e.g. 3500.00"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                Closing E-Wallet (PHP)
                                            </label>
                                            <input
                                                type="number" step="0.01" min="0" max="500000" required
                                                value={closingEwallet} onChange={e => setClosingEwallet(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.5rem 0.65rem',
                                                    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.85rem',
                                                    boxSizing: 'border-box'
                                                }}
                                                placeholder="e.g. 90.00"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                            Shift Notes / Comments (Optional)
                                        </label>
                                        <textarea
                                            rows={2} maxLength={500}
                                            value={shiftNotes} onChange={e => setShiftNotes(e.target.value)}
                                            style={{
                                                width: '100%', padding: '0.55rem 0.75rem',
                                                background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                                                borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.82rem',
                                                resize: 'none', boxSizing: 'border-box'
                                            }}
                                            placeholder="Handover info, cash drawer variance..."
                                        />
                                    </div>

                                    <button
                                        type="submit" disabled={shiftSubmitting}
                                        style={{
                                            padding: '0.65rem', borderRadius: '8px', border: 'none',
                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                            color: 'white', fontWeight: 700, fontSize: '0.875rem',
                                            cursor: shiftSubmitting ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                                        }}
                                    >
                                        <Square size={14} /> {shiftSubmitting ? 'Closing…' : 'End / Close Shift'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Notification Bell */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOpen(o => !o)}
                        style={{
                            background: 'transparent', border: 'none',
                            color: open ? roleColor : 'var(--text-secondary)',
                            cursor: 'pointer', position: 'relative', padding: '4px',
                            transition: 'color 0.2s'
                        }}
                    >
                        <Bell size={20} />
                        {unread > 0 && (
                            <span style={{
                                position: 'absolute', top: '-2px', right: '-2px',
                                minWidth: '16px', height: '16px',
                                backgroundColor: 'var(--status-danger)',
                                borderRadius: '999px',
                                fontSize: '9px', fontWeight: 700,
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 3px'
                            }}>
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </button>

                    {open && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                            width: '340px',
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--border-radius-md)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            zIndex: 200,
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.9rem 1.1rem',
                                borderBottom: '1px solid var(--glass-border)'
                            }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                    Notifications {unread > 0 && (
                                        <span style={{
                                            background: 'var(--status-danger)',
                                            color: 'white', borderRadius: '999px',
                                            padding: '1px 7px', fontSize: '0.7rem', marginLeft: '6px'
                                        }}>{unread}</span>
                                    )}
                                </span>
                                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        ✅ All clear! No alerts right now.
                                    </div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n.id} style={{
                                            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                            padding: '0.85rem 1.1rem',
                                            borderBottom: '1px solid var(--glass-border-light)',
                                            transition: 'background 0.15s'
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: n.type === 'expiry' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'
                                            }}>
                                                {n.type === 'expiry'
                                                    ? <AlertTriangle size={15} color="var(--status-danger)" />
                                                    : <Package size={15} color="var(--status-warning)" />
                                                }
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                                                        {n.title}
                                                    </p>
                                                    {n.daysLeft !== undefined && (
                                                        <span style={{
                                                            flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
                                                            color: n.daysLeft < 0 ? 'white' : n.daysLeft === 0 ? 'var(--status-danger)' : 'var(--status-warning)',
                                                            background: n.daysLeft < 0 ? 'var(--status-danger)' : n.daysLeft === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                                            borderRadius: '4px', padding: '2px 6px'
                                                        }}>
                                                            {n.daysLeft < 0 ? `Expired ${Math.abs(n.daysLeft)}d ago` : n.daysLeft === 0 ? 'Expires Today' : `${n.daysLeft}d left`}
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                                    {n.detail}
                                                </p>
                                                {/* Action Button for Admins/Managers */}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ padding: '0.65rem 1.1rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <button
                                    onClick={fetchNotifications}
                                    style={{ background: 'none', border: 'none', color: roleColor, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}
                                >
                                    ↻ Refresh notifications
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User info */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    paddingLeft: '1.5rem', borderLeft: '1px solid var(--glass-border)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{displayName}</span>
                        <span style={{
                            fontSize: '0.7rem', color: roleColor, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                        }}>
                            <RoleIcon size={10} /> {roleLabel}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Topbar;


