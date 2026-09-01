import { useState, useEffect, useCallback } from 'react';
import {
    ShoppingCart, Plus, Minus, Trash2, Receipt, CheckCircle,
    Banknote, Smartphone, Tag, AlertCircle,
    AlertTriangle, User, Coffee, Package, Search, RotateCcw,
    Printer, X, Cake, Cookie, CupSoda
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { apiClient } from '../lib/apiClient';

// Types

interface Product {
    id: string;
    name: string;
    category?: string;
    unit_of_measure: string;
    stock?: number;
    reorder_level?: number;
    limiting_ingredient?: string;
    size?: string | null;
    default_price?: number | null;
    is_active?: boolean;
    is_promo?: boolean;
    promo_price?: number | null;
    expiring_ingredient?: string | null;
    expiry_date?: string | null;
}

interface SaleItem {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number | '';
    lowStock?: boolean;
}

interface SaleRecord {
    id: string;
    sale_date: string;
    total_amount: number;
    payment_method: string;
    recorded_by?: string;
    refunded?: boolean;
    refunded_by?: string;
    refunded_at?: string;
    discount?: number;
    sale_items: { quantity: number; unit_price: number; products: { name: string } }[];
}


const PAYMENT_METHODS = [
    { key: 'CASH' as const, label: 'Cash', Icon: Banknote, color: '#10b981' },
    { key: 'E-WALLET' as const, label: 'E-Wallet', Icon: Smartphone, color: '#06b6d4' },
];



// Product icon & color helper (Coffee, Milk Tea / Fruit Soda, Cake, Bread, Package)
// Checks both product name AND category for accurate icon matching
const getProductIconInfo = (name: string, category: string = '') => {
    const lower = (name + ' ' + category).toLowerCase();
    if (lower.includes('cake') || lower.includes('pastry') || lower.includes('pie') || lower.includes('muffin') || lower.includes('cupcake') || lower.includes('dessert') || lower.includes('slice')) {
        return { Icon: Cake, color: '#ec4899', bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.3)' };
    }
    if (lower.includes('bread') || lower.includes('breed') || lower.includes('toast') || lower.includes('sandwich') || lower.includes('croissant') || lower.includes('waffle') || lower.includes('biscuit')) {
        return { Icon: Cookie, color: '#d97706', bg: 'rgba(217,119,6,0.14)', border: 'rgba(217,119,6,0.3)' };
    }
    if (lower.includes('fruit soda') || lower.includes('fruitsoda') || lower.includes('soda') || lower.includes('milk') || lower.includes('milktea') || lower.includes('tea') || lower.includes('boba') || lower.includes('matcha') || lower.includes('smoothie') || lower.includes('juice') || lower.includes('shake') || lower.includes('frappe')) {
        return { Icon: CupSoda, color: '#06b6d4', bg: 'rgba(6,182,212,0.14)', border: 'rgba(6,182,212,0.3)' };
    }
    if (lower.includes('coffee') || lower.includes('latte') || lower.includes('espresso') || lower.includes('cappuccino') || lower.includes('americano') || lower.includes('mocha') || lower.includes('brew') || lower.includes('iced')) {
        return { Icon: Coffee, color: '#b45309', bg: 'rgba(180,83,9,0.14)', border: 'rgba(180,83,9,0.3)' };
    }
    return { Icon: Package, color: '#0d9488', bg: 'rgba(13,148,136,0.14)', border: 'rgba(13,148,136,0.3)' };
};

const ProductIcon = ({ name, category, inCart }: { name: string; category?: string; inCart: boolean }) => {
    const info = getProductIconInfo(name, category || '');
    const IconComp = info.Icon;
    const color = inCart ? '#0d9488' : info.color;
    return <IconComp size={18} color={color} />;
};

// Main Sales Component

interface ReceiptItem {
    name: string;
    qty: number;
    price: number;
}

interface ReceiptData {
    id: string;
    sale_date: string;
    items: ReceiptItem[];
    subtotal: number;
    discount: number;
    total: number;
    cash_tendered?: number;
    change?: number;
    payment_method: string;
    recorded_by: string;
}

const Sales = () => {
    const { fullName, session } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [saleDate, setSaleDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [items, setItems] = useState<SaleItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'E-WALLET'>('CASH');
    const [cashTendered, setCashTendered] = useState<string>('');
    const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
    const [loadingSales, setLoadingSales] = useState(true);
    const [pickerSearch, setPickerSearch] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
    const [filterMode, setFilterMode] = useState<'ALL' | 'PROMO'>('ALL');

    const [success, setSuccess] = useState<string | null>(null);
    const [refundingId, setRefundingId] = useState<string | null>(null);
    const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

    // Discount state
    const [discountType, setDiscountType] = useState<'NONE' | 'SENIOR_PWD' | 'CUSTOM'>('NONE');
    const [customDiscountPercent, setCustomDiscountPercent] = useState('10');

    const openReceiptForSale = (sale: SaleRecord) => {
        const sub = (sale.sale_items || []).reduce((sum, si) => sum + (si.quantity * Number(si.unit_price || 0)), 0);
        setActiveReceipt({
            id: sale.id,
            sale_date: sale.sale_date,
            items: (sale.sale_items || []).map(si => ({
                name: si.products?.name || 'Item',
                qty: si.quantity,
                price: Number(si.unit_price || 0)
            })),
            subtotal: sub || sale.total_amount,
            discount: sale.discount || 0,
            total: sale.total_amount,
            payment_method: sale.payment_method || 'CASH',
            recorded_by: sale.recorded_by || 'Staff'
        });
    };

    const handleRefund = async (saleId: string, amount: number) => {
        if (!window.confirm(`Are you sure you want to refund this sale of PHP ${Number(amount).toFixed(2)}?`)) return;
        setRefundingId(saleId);
        try {
            const res = await apiClient.post(`${API_ENDPOINTS.SALES}/${saleId}/refund`, {});
            setSuccess(res.message || 'Refund processed successfully!');
            setTimeout(() => setSuccess(null), 3000);
            fetchRecentSales();
            fetchProducts();
        } catch (err: any) {
            setError(err.message || 'Failed to refund sale');
        } finally {
            setRefundingId(null);
        }
    };

    // Helper to get base name (e.g., "Iced Latte (M)" -> "Iced Latte")
    const getBaseName = (name: string) => {
        return name.replace(/\s*\([^)]*\)$/, '').trim();
    };

    // Grouping logic
    const groupedProducts = products.reduce((acc, p) => {
        if (p.is_active === false) return acc;
        const base = getBaseName(p.name);
        if (!acc[base]) acc[base] = [];
        acc[base].push(p);
        return acc;
    }, {} as Record<string, Product[]>);

    // Filtered groups based on search and promo filter
    const filteredGroupNames = Object.keys(groupedProducts).filter(name => {
        const matchesSearch = name.toLowerCase().includes(pickerSearch.toLowerCase());
        if (!matchesSearch) return false;

        if (filterMode === 'PROMO') {
            // Check if any variant in the group is on promo
            return groupedProducts[name].some(p => p.is_promo);
        }
        return true;
    });

    // Data fetching

    const fetchRecentSales = useCallback(async () => {
        setLoadingSales(true);
        try {
            const data = await apiClient.get(API_ENDPOINTS.SALES);
            setRecentSales(data);
        } catch (err) {
            console.error('Failed to fetch recent sales:', err);
        } finally {
            setLoadingSales(false);
        }
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const inventory = await apiClient.get(API_ENDPOINTS.INVENTORY);
            setProducts(inventory.map((inv: any) => {
                const batchStock = (inv.inventory_transactions || [])
                    .filter((b: any) => b.status === 'ACTIVE')
                    .reduce((s: number, b: any) => s + Number(b.quantity), 0);
                const stock = inv.recipe_stock != null ? inv.recipe_stock : batchStock;
                return {
                    id: inv.id,
                    name: inv.name,
                    category: inv.category || '',
                    unit_of_measure: inv.unit_of_measure,
                    stock,
                    reorder_level: inv.reorder_level || 0,
                    limiting_ingredient: inv.limiting_ingredient,
                    size: inv.size ?? null,
                    default_price: inv.default_price ?? null,
                    is_active: inv.is_active !== false,
                    is_promo: inv.is_promo || false,
                    promo_price: inv.promo_price ?? null,
                    expiring_ingredient: inv.expiring_ingredient ?? null,
                    expiry_date: inv.expiry_date ?? null,
                };
            }));
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    }, []);


    useEffect(() => {
        fetchProducts();
        fetchRecentSales();
    }, [fetchProducts, fetchRecentSales]);

    // Helpers

    const getStockStatus = (p: Product) => {
        if (p.stock === undefined) return 'ok';
        if (p.stock === 0) return 'out';
        if (p.reorder_level && p.stock <= p.reorder_level) return 'low';
        return 'ok';
    };

    const addProduct = (product: Product) => {
        const existing = items.find(i => i.product_id === product.id);
        const lowStock = getStockStatus(product) !== 'ok';
        if (existing) {
            setItems(prev => prev.map(i =>
                i.product_id === product.id ? { ...i, quantity: i.quantity + 1, lowStock } : i
            ));
        } else {
            setItems(prev => [...prev, {
                id: uuidv4(),
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_price: product.is_promo && product.promo_price ? product.promo_price : (product.default_price ?? ''),
                lowStock,
            }]);
        }
    };

    const updateQty = (id: string, delta: number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            const next = i.quantity + delta;
            return next < 1 ? i : { ...i, quantity: next };
        }));
    };

    const setQtyDirect = (id: string, val: string) => {
        const n = parseInt(val, 10);
        if (!isNaN(n) && n >= 1) setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: n } : i));
    };

    const updatePrice = (id: string, val: string) => {
        setItems(prev => prev.map(i =>
            i.id === id ? { ...i, unit_price: val === '' ? '' : Number(val) } : i
        ));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const subtotal = items.reduce((sum, i) => sum + i.quantity * (Number(i.unit_price) || 0), 0);

    let discountPercent = 0;
    if (discountType === 'SENIOR_PWD') {
        discountPercent = 20;
    } else if (discountType === 'CUSTOM') {
        discountPercent = Math.min(100, Math.max(0, Number(customDiscountPercent) || 0));
    }

    const discountAmount = (subtotal * discountPercent) / 100;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    // Submit

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (items.length === 0) { setError('Add at least one item to record a sale.'); return; }
        if (items.some(i => !i.unit_price || Number(i.unit_price) <= 0)) {
            setError('Please enter a valid unit price for every item.'); return;
        }

        const tenderedNum = Number(cashTendered) || 0;
        if (paymentMethod === 'CASH' && cashTendered !== '' && tenderedNum < finalTotal) {
            setError(`Cash tendered (PHP ${tenderedNum.toFixed(2)}) is less than total amount (PHP ${finalTotal.toFixed(2)}).`); return;
        }

        setSubmitting(true);
        try {
            // Ensure we send a valid UTC ISO string that represents the selected local day
            const now = new Date();
            const [y, m, d] = saleDate.split('-').map(Number);
            // Create a strictly local Date object including current time
            const localDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            const finalSaleDate = localDate.toISOString();

            console.log("DEBUG: Sending sale payload:", {
                sale_date: finalSaleDate,
                payment_method: paymentMethod,
                items: items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                })),
                recorded_by: fullName || 'Staff',
                staff_id: session?.user?.id || null,
                discount: discountAmount,
            });

            const saleData = await apiClient.post(API_ENDPOINTS.SALES, {
                sale_date: finalSaleDate,
                payment_method: paymentMethod,
                items: items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                })),
                recorded_by: fullName || 'Staff',
                staff_id: session?.user?.id || null,
                discount: discountAmount,
            });

            if (saleData?.id) {
                await new Promise(r => setTimeout(r, 300));
            }

            // Auto-open receipt for the new sale
            const finalTendered = paymentMethod === 'CASH' ? (tenderedNum > 0 ? tenderedNum : finalTotal) : undefined;
            const finalChange = paymentMethod === 'CASH' && finalTendered ? Math.max(0, finalTendered - finalTotal) : undefined;

            if (saleData) {
                setActiveReceipt({
                    id: saleData.id || '',
                    sale_date: finalSaleDate,
                    items: items.map(i => ({
                        name: (products.find(p => p.id === i.product_id)?.name ?? 'Item'),
                        qty: i.quantity,
                        price: Number(i.unit_price || 0)
                    })),
                    subtotal,
                    discount: discountAmount,
                    total: finalTotal,
                    cash_tendered: finalTendered,
                    change: finalChange,
                    payment_method: paymentMethod,
                    recorded_by: fullName || 'Staff'
                });
            }

            setItems([]);
            setSaleDate(new Date().toLocaleDateString('en-CA'));
            setPaymentMethod('CASH');
            setCashTendered('');
            setDiscountType('NONE');
            setError(null);
            setSuccess('Sale recorded successfully!');
            setTimeout(() => setSuccess(null), 3000);
            fetchRecentSales();
            fetchProducts();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Styles

    const inputBase: React.CSSProperties = {
        background: 'rgba(0,0,0,0.06)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        padding: '0.5rem 0.7rem',
        fontSize: '0.88rem',
        width: '100%',
        outline: 'none',
        fontFamily: 'inherit',
    };

    // Render

    return (
        <>
        <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {success && (
                <div style={{
                    position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(16, 185, 129, 0.9)', color: 'white', padding: '0.75rem 1.5rem',
                    borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)', zIndex: 3000,
                    fontWeight: 600, fontSize: '0.9rem',
                    animation: 'slideDown 0.3s ease-out', backdropFilter: 'blur(8px)',
                }}>
                    <CheckCircle size={18} />
                    {success}
                </div>
            )}

            {/* No receipt modal */}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', margin: '0 0 0.2rem 0' }}>Record Sale</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Select products, set prices, and record the transaction.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem', borderRadius: '999px', border: '1px solid var(--glass-border)' }}>
                    <User size={13} />
                    <span>{fullName || 'Staff'}</span>
                </div>
            </div>

            {/* POS Layout */}
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

                {/* LEFT: Product Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Date + Payment */}
                    <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Date</span>
                            <input
                                type="date"
                                value={saleDate}
                                onChange={e => setSaleDate(e.target.value)}
                                style={{ ...inputBase, width: '160px' }}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Payment</span>
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                                {PAYMENT_METHODS.map(({ key, label, Icon, color }) => {
                                    const active = paymentMethod === key;
                                    return (
                                        <button key={key} type="button" onClick={() => setPaymentMethod(key)} style={{
                                            flex: 1, padding: '0.45rem 0.4rem', borderRadius: '8px',
                                            border: active ? `2px solid ${color}` : '1.5px solid var(--glass-border)',
                                            background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                                            color: active ? color : 'var(--text-muted)', fontWeight: active ? 700 : 400,
                                            cursor: 'pointer', fontSize: '0.78rem', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                                            transition: 'all 0.15s', fontFamily: 'inherit',
                                        }}>
                                            <Icon size={14} /> {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Products - Tap to Add</span>

                                {/* Filter Tabs */}
                                <div style={{
                                    display: 'flex',
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '2px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    {(['ALL', 'PROMO'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setFilterMode(mode)}
                                            style={{
                                                padding: '0.2rem 0.75rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                background: filterMode === mode ? 'var(--accent-primary)' : 'transparent',
                                                color: filterMode === mode ? 'white' : 'var(--text-muted)',
                                                transition: 'all 0.15s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem'
                                            }}
                                        >
                                            {mode === 'PROMO' && <Tag size={10} />}
                                            {mode.charAt(0) + mode.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ position: 'relative', width: '160px' }}>
                                <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input
                                    placeholder="Search..."
                                    value={pickerSearch}
                                    onChange={e => setPickerSearch(e.target.value)}
                                    style={{ ...inputBase, paddingLeft: '1.8rem', padding: '0.35rem 0.65rem 0.35rem 1.8rem', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        {products.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>Loading products...</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                {filteredGroupNames.map(baseName => {
                                    const variants = groupedProducts[baseName];
                                    const selectedId = selectedProductIds[baseName] || variants[0].id;
                                    const p = variants.find(v => v.id === selectedId) || variants[0];

                                    const stockStatus = getStockStatus(p);
                                    const inCart = items.some(i => i.product_id === p.id);
                                    const cartItem = items.find(i => i.product_id === p.id);

                                    return (
                                        <div
                                            key={baseName}
                                            style={{
                                                position: 'relative',
                                                padding: '0.9rem 0.75rem',
                                                borderRadius: '16px',
                                                border: inCart
                                                    ? '2px solid var(--accent-primary)'
                                                    : stockStatus === 'out'
                                                        ? '1.5px solid rgba(239,68,68,0.35)'
                                                        : stockStatus === 'low'
                                                            ? '1.5px solid rgba(245,158,11,0.35)'
                                                            : '1.5px solid var(--glass-border)',
                                                background: inCart
                                                    ? 'rgba(139,92,246,0.12)'
                                                    : stockStatus === 'out'
                                                        ? 'rgba(239,68,68,0.06)'
                                                        : 'rgba(255,255,255,0.04)',
                                                transition: 'all 0.15s',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.4rem',
                                            }}
                                        >
                                            {/* Qty badge */}
                                            {inCart && (
                                                <div style={{
                                                    position: 'absolute', top: '8px', right: '8px',
                                                    background: 'var(--accent-primary)', color: 'white',
                                                    borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800,
                                                    width: '18px', height: '18px', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 2
                                                }}>
                                                    {cartItem?.quantity}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                {/* Product Logo / Icon Badge — uses both name + category */}
                                                {(() => {
                                                    const iconInfo = getProductIconInfo(p.name, p.category || '');
                                                    return (
                                                        <div style={{
                                                            width: '38px', height: '38px', borderRadius: '10px',
                                                            background: inCart ? 'rgba(13,148,136,0.18)' : iconInfo.bg,
                                                            border: inCart ? '1px solid rgba(13,148,136,0.35)' : `1px solid ${iconInfo.border}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            <ProductIcon name={p.name} category={p.category} inCart={inCart} />
                                                        </div>
                                                    );
                                                })()}

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2, color: 'var(--text-primary)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {baseName}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                                        {p.is_promo && p.promo_price ? (
                                                            <>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>
                                                                    ₱{Number(p.promo_price).toFixed(0)}
                                                                </span>
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                                                    ₱{Number(p.default_price).toFixed(0)}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                                                                ₱{Number(p.default_price).toFixed(0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Size Select or Info */}
                                            <div style={{ marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {p.is_promo && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                                                        padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                                        border: '1px solid rgba(245,158,11,0.25)'
                                                    }}>
                                                        <Tag size={10} /> PROMO: {p.expiring_ingredient} (Near Expiry)
                                                    </div>
                                                )}
                                                {variants.length > 1 ? (
                                                    <select
                                                        value={selectedId}
                                                        onChange={(e) => setSelectedProductIds(prev => ({ ...prev, [baseName]: e.target.value }))}
                                                        style={{
                                                            width: '100%',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: '8px',
                                                            color: 'var(--text-secondary)',
                                                            padding: '0.3rem 0.5rem',
                                                            fontSize: '0.75rem',
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {variants.map(v => (
                                                            <option key={v.id} value={v.id} style={{ background: '#ffffff', color: '#0b2320' }}>
                                                                Size: {v.size || 'Regular'} — ₱{v.default_price}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0' }}>
                                                        {p.size && (
                                                            <span style={{ background: 'rgba(139,92,246,0.2)', color: 'var(--accent-primary)', padding: '0.05rem 0.4rem', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 800 }}>{p.size}</span>
                                                        )}
                                                        <span>per {p.unit_of_measure}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stock Info */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.2rem' }}>
                                                {stockStatus !== 'ok' ? (
                                                    <div style={{
                                                        fontSize: '0.65rem', fontWeight: 700,
                                                        color: stockStatus === 'out' ? '#ef4444' : '#f59e0b',
                                                        display: 'flex', alignItems: 'center', gap: '0.2rem',
                                                    }}>
                                                        <AlertTriangle size={11} />
                                                        {stockStatus === 'out' ? (p.limiting_ingredient ? `Out of stock: ${p.limiting_ingredient}` : 'Out of stock') : `Low: ${p.stock}`}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                        {p.stock} in stock
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    {inCart && (
                                                        <button
                                                            type="button"
                                                            onClick={() => cartItem && cartItem.quantity > 1 ? updateQty(cartItem.id, -1) : removeItem(cartItem?.id || '')}
                                                            style={{
                                                                background: 'rgba(239,68,68,0.15)',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                color: '#ef4444',
                                                                width: '28px',
                                                                height: '28px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                                                        >
                                                            {cartItem && cartItem.quantity === 1 ? <Trash2 size={13} /> : <Minus size={16} />}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => addProduct(p)}
                                                        disabled={stockStatus === 'out'}
                                                        style={{
                                                            background: inCart ? 'var(--accent-primary)' : 'rgba(0,0,0,0.08)',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            color: 'white',
                                                            width: '28px',
                                                            height: '28px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: stockStatus === 'out' ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { if (stockStatus !== 'out') e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Cart items with price entry */}
                    {items.length > 0 && (
                        <div className="glass-card" style={{ padding: '1.25rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Tag size={11} /> Cart - Enter Unit Prices
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 120px 36px', gap: '0.5rem', padding: '0 0.1rem' }}>
                                    {['Item', 'Qty', 'Price', ''].map(h => (
                                        <span key={h} style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                                    ))}
                                </div>
                                {items.map(item => (
                                    <div key={item.id} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 110px 120px 36px',
                                        gap: '0.5rem', alignItems: 'center',
                                        background: item.lowStock ? 'rgba(245,158,11,0.05)' : 'rgba(0,0,0,0.05)',
                                        borderRadius: '8px', padding: '0.5rem 0.6rem',
                                        border: item.lowStock ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(0,0,0,0.06)',
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                {item.product_name}
                                                {item.lowStock && <AlertTriangle size={12} color="#f59e0b" />}
                                            </div>
                                            {item.unit_price !== '' && item.unit_price > 0 && (
                                                <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '1px' }}>
                                                    = Ph{(item.quantity * Number(item.unit_price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <button type="button" onClick={() => updateQty(item.id, -1)} disabled={item.quantity <= 1}
                                                style={{ width: '24px', height: '24px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)', cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: item.quantity <= 1 ? 0.3 : 1, flexShrink: 0 }}>
                                                <Minus size={10} />
                                            </button>
                                            <input type="number" min={1} value={item.quantity} onChange={e => setQtyDirect(item.id, e.target.value)}
                                                style={{ ...inputBase, padding: '0.25rem 0.3rem', textAlign: 'center', width: '36px', fontSize: '0.82rem' }} />
                                            <button type="button" onClick={() => updateQty(item.id, 1)}
                                                style={{ width: '24px', height: '24px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                        <input type="number" min={0.01} step={0.01} placeholder="0.00" value={item.unit_price} onChange={e => updatePrice(item.id, e.target.value)}
                                            style={{ ...inputBase, padding: '0.3rem 0.5rem', fontSize: '0.85rem', borderColor: item.unit_price === '' ? 'rgba(239,68,68,0.45)' : 'var(--glass-border)' }} required />
                                        <button type="button" onClick={() => removeItem(item.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.55, padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.12s' }}
                                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Order Summary */}
                <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Order Summary</div>

                        {items.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                                <ShoppingCart size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                                <div style={{ fontSize: '0.82rem' }}>Tap a product to add it</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {item.lowStock && <AlertTriangle size={10} color="#f59e0b" />}
                                            {item.product_name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span>
                                        </span>
                                        <span style={{ fontWeight: 600 }}>
                                            {item.unit_price !== '' && item.unit_price > 0
                                                ? 'PHP ' + (item.quantity * Number(item.unit_price)).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                                : <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>no price</span>
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ height: '1px', background: 'var(--glass-border-light)' }} />

                        {/* Discount Selector */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Discount</span>
                                {discountAmount > 0 && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                                        -PHP {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {[
                                    { key: 'NONE', label: 'None' },
                                    { key: 'SENIOR_PWD', label: 'Senior / PWD (20%)' },
                                    { key: 'CUSTOM', label: 'Custom %' },
                                ].map(d => {
                                    const active = discountType === d.key;
                                    return (
                                        <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => setDiscountType(d.key as any)}
                                            style={{
                                                flex: d.key === 'SENIOR_PWD' ? '1 1 100%' : '1',
                                                padding: '0.45rem 0.5rem',
                                                borderRadius: '8px',
                                                border: active ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border-light)',
                                                background: active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.7)',
                                                color: active ? '#ffffff' : 'var(--text-primary)',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {discountType === 'CUSTOM' && (
                                <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discount %:</span>
                                    <input
                                        type="number" min="0" max="100" step="1"
                                        value={customDiscountPercent}
                                        onChange={e => setCustomDiscountPercent(e.target.value)}
                                        style={{ ...inputBase, padding: '0.25rem 0.5rem', width: '70px', fontSize: '0.8rem', textAlign: 'center' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ height: '1px', background: 'var(--glass-border-light)' }} />

                        {discountAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                <span>Subtotal</span>
                                <span>PHP {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total</span>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '-0.03em' }}>
                                PHP {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        {(() => {
                            const pm = PAYMENT_METHODS.find(p => p.key === paymentMethod)!;
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: pm.color + '18', border: '1px solid ' + pm.color + '44', borderRadius: '8px', padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: pm.color, fontWeight: 600 }}>
                                    <pm.Icon size={14} /> {pm.label}
                                </div>
                            );
                        })()}

                        {/* Cash Tendered & Change Calculator */}
                        {paymentMethod === 'CASH' && (
                            <div style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                        Client Payment (PHP)
                                    </span>
                                    {cashTendered !== '' && Number(cashTendered) > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setCashTendered('')}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder={`e.g. ${finalTotal > 0 ? finalTotal.toFixed(0) : '100'}`}
                                    value={cashTendered}
                                    onChange={e => setCashTendered(e.target.value)}
                                    style={{ ...inputBase, padding: '0.45rem 0.65rem', fontSize: '0.95rem', fontWeight: 700, borderColor: 'var(--glass-border)' }}
                                />

                                {/* Quick Presets */}
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => setCashTendered(finalTotal > 0 ? finalTotal.toString() : '')}
                                        style={{
                                            flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
                                            border: '1px solid var(--glass-border-light)',
                                            background: 'rgba(255,255,255,0.8)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >
                                        Exact
                                    </button>
                                    {[50, 100, 200, 500, 1000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setCashTendered(amt.toString())}
                                            style={{
                                                padding: '0.3rem 0.5rem', borderRadius: '6px',
                                                border: Number(cashTendered) === amt ? '2px solid #0d9488' : '1px solid var(--glass-border-light)',
                                                background: Number(cashTendered) === amt ? 'rgba(13,148,136,0.18)' : 'rgba(255,255,255,0.8)',
                                                color: Number(cashTendered) === amt ? '#0d9488' : 'var(--text-primary)',
                                                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                                            }}
                                        >
                                            ₱{amt}
                                        </button>
                                    ))}
                                </div>

                                {/* Calculated Change */}
                                {cashTendered !== '' && Number(cashTendered) > 0 && (() => {
                                    const tendered = Number(cashTendered);
                                    const change = tendered - finalTotal;
                                    const isEnough = change >= 0;
                                    return (
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.45rem 0.6rem', borderRadius: '7px',
                                            background: isEnough ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                            border: isEnough ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                                            marginTop: '0.1rem'
                                        }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isEnough ? '#10b981' : '#ef4444' }}>
                                                {isEnough ? 'Change Due:' : 'Insufficient:'}
                                            </span>
                                            <strong style={{ fontSize: '1rem', fontWeight: 800, color: isEnough ? '#10b981' : '#ef4444' }}>
                                                PHP {Math.abs(change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            <User size={11} />
                            <span>Recorded by <strong style={{ color: 'var(--text-secondary)' }}>{fullName || 'Staff'}</strong></span>
                        </div>

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.6rem 0.7rem', fontSize: '0.8rem', color: '#ef4444' }}>
                                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '0.05rem' }} /> {error}
                            </div>
                        )}

                        <button type="submit" disabled={submitting || items.length === 0} style={{
                            background: items.length === 0 ? '#cbd5e1' : 'var(--accent-primary)',
                            border: 'none', borderRadius: '10px',
                            color: items.length === 0 ? '#64748b' : '#ffffff',
                            padding: '0.9rem', fontSize: '1rem', fontWeight: 700,
                            cursor: submitting || items.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.7 : 1, transition: 'all 0.2s',
                            fontFamily: 'inherit', width: '100%',
                            boxShadow: items.length > 0 ? '0 4px 16px rgba(13,148,136,0.35)' : 'none',
                        }}>
                            {submitting ? 'Recording...' : 'Record Sale'}
                        </button>
                    </div>
                </div>
            </form>

            {/* Recent Transactions */}
            <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.1s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <Receipt size={18} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Recent Transactions</h3>

                    {/* Total of non-refunded sales */}
                    {recentSales.length > 0 && (() => {
                        const activeSales = recentSales.filter(s => !s.refunded);
                        const totalRevenue = activeSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
                        const cashTotal = activeSales.filter(s => s.payment_method === 'CASH').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
                        const ewalletTotal = activeSales.filter(s => s.payment_method === 'E-WALLET').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.25rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '8px', padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                                    <strong style={{ color: 'var(--accent-primary)' }}>PHP {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Cash:</span>
                                    <strong style={{ color: '#10b981' }}>PHP {cashTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '8px', padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>E-Wallet:</span>
                                    <strong style={{ color: '#06b6d4' }}>PHP {ewalletTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                            </div>
                        );
                    })()}

                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 50 sales</span>
                </div>
                {loadingSales ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>Loading...</p>
                ) : recentSales.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>No transactions yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border-light)' }}>
                                    {['Date', 'Items', 'Payment', 'Recorded By', 'Total', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Total' ? 'right' : h === 'Action' ? 'center' : 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map((sale, idx) => (
                                    <tr key={sale.id}
                                        style={{ borderBottom: idx < recentSales.length - 1 ? '1px solid var(--glass-border-light)' : 'none', transition: 'background 0.15s', opacity: sale.refunded ? 0.6 : 1 }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            {new Date(sale.sale_date.length === 10 ? sale.sale_date + 'T00:00:00' : sale.sale_date)
                                                .toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)', maxWidth: '260px' }}>
                                            {sale.sale_items && sale.sale_items.length > 0
                                                ? sale.sale_items.map(si => (si.products?.name ?? 'Item') + ' x' + si.quantity).join(', ')
                                                : '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {(() => {
                                                const pm = PAYMENT_METHODS.find(p => p.key === sale.payment_method);
                                                return <span style={{ background: pm ? pm.color + '22' : 'rgba(0,0,0,0.08)', color: pm ? pm.color : 'var(--text-muted)', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{sale.payment_method ?? '-'}</span>;
                                            })()}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {sale.recorded_by
                                                ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><User size={11} />{sale.recorded_by}</span>
                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                                            }
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: sale.refunded ? 'var(--text-muted)' : '#10b981', whiteSpace: 'nowrap', textDecoration: sale.refunded ? 'line-through' : 'none' }}>
                                            PHP {Number(sale.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                {/* Receipt button — always visible */}
                                                <button
                                                    type="button"
                                                    onClick={() => openReceiptForSale(sale)}
                                                    title="View Receipt"
                                                    style={{
                                                        padding: '0.25rem 0.55rem',
                                                        borderRadius: '6px',
                                                        background: 'rgba(139,92,246,0.12)',
                                                        border: '1px solid rgba(139,92,246,0.3)',
                                                        color: '#a78bfa',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.22)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
                                                >
                                                    <Receipt size={12} /> Receipt
                                                </button>

                                                {/* Refund / Refunded */}
                                                {sale.refunded ? (
                                                    <span style={{
                                                        padding: '0.2rem 0.55rem',
                                                        borderRadius: '6px',
                                                        background: 'rgba(239,68,68,0.15)',
                                                        color: '#ef4444',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.04em'
                                                    }}>
                                                        REFUNDED
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRefund(sale.id, sale.total_amount)}
                                                        disabled={refundingId === sale.id}
                                                        style={{
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '6px',
                                                            background: 'rgba(239,68,68,0.12)',
                                                            border: '1px solid rgba(239,68,68,0.3)',
                                                            color: '#ef4444',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            cursor: refundingId === sale.id ? 'not-allowed' : 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <RotateCcw size={12} /> {refundingId === sale.id ? '...' : 'Refund'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>

        {/* ── Receipt Modal ─────────────────────────────────────── */}
        {activeReceipt && (
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 9000,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem'
                }}
                onClick={() => setActiveReceipt(null)}
            >
                <div
                    id="receipt-printable"
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: '#fff', color: '#111', borderRadius: '12px',
                        width: '340px', padding: '1.5rem 1.75rem',
                        fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.6,
                        boxShadow: '0 25px 60px rgba(0,0,0,0.5)', position: 'relative'
                    }}
                >
                    {/* Close */}
                    <button
                        onClick={() => setActiveReceipt(null)}
                        style={{
                            position: 'absolute', top: '0.6rem', right: '0.75rem',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#888', lineHeight: 1
                        }}
                    ><X size={16} /></button>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.08em' }}>☕ HOUSEBLEND CAFE</div>
                        <div style={{ fontSize: '0.72rem', color: '#555' }}>Official Sales Receipt</div>
                        <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '0.2rem' }}>
                            {new Date(activeReceipt.sale_date.length === 10
                                ? activeReceipt.sale_date + 'T00:00:00'
                                : activeReceipt.sale_date
                            ).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                            {' · '}
                            {new Date(activeReceipt.sale_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #bbb', margin: '0.6rem 0' }} />

                    {/* Items */}
                    <div style={{ marginBottom: '0.5rem' }}>
                        {activeReceipt.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <span>{item.name} x{item.qty}</span>
                                <span>PHP {(item.price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #bbb', margin: '0.6rem 0' }} />

                    {/* Subtotal / Discount / Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Subtotal</span>
                        <span>PHP {activeReceipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {activeReceipt.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
                            <span>Discount (Senior/PWD)</span>
                            <span>- PHP {activeReceipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginTop: '0.35rem' }}>
                        <span>TOTAL</span>
                        <span>PHP {activeReceipt.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #bbb', margin: '0.6rem 0' }} />

                    {/* Payment + Staff */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555' }}>
                        <span>Payment Method</span>
                        <span style={{ fontWeight: 700, color: activeReceipt.payment_method === 'E-WALLET' ? '#0891b2' : '#059669' }}>
                            {activeReceipt.payment_method}
                        </span>
                    </div>

                    {activeReceipt.cash_tendered !== undefined && activeReceipt.cash_tendered > 0 && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555' }}>
                                <span>Amount Paid</span>
                                <span>PHP {activeReceipt.cash_tendered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                                <span>Change</span>
                                <span>PHP {(activeReceipt.change ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555', marginTop: '0.2rem' }}>
                        <span>Served by</span>
                        <span>{activeReceipt.recorded_by}</span>
                    </div>

                    {/* Footer */}
                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.72rem', color: '#888', borderTop: '1px dashed #bbb', paddingTop: '0.65rem' }}>
                        Thank you for visiting Houseblend Cafe!<br />
                        Please come again ☕
                    </div>

                    {/* Print Button */}
                    <button
                        onClick={() => {
                            const printContents = document.getElementById('receipt-printable')?.innerHTML;
                            const w = window.open('', '_blank', 'width=400,height=600');
                            if (w && printContents) {
                                w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:13px;padding:20px;color:#111;}</style></head><body>${printContents}</body></html>`);
                                w.document.close();
                                w.focus();
                                w.print();
                                w.close();
                            }
                        }}
                        style={{
                            marginTop: '1rem', width: '100%', padding: '0.6rem',
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            color: 'white', border: 'none', borderRadius: '8px',
                            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                        }}
                    >
                        <Printer size={14} /> Print Receipt
                    </button>
                </div>
            </div>
        )}
        </>
    );
};

export default Sales;


