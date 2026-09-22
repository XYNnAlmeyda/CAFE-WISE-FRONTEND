import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Plus, Minus, Trash2, Receipt, CheckCircle,
    Banknote, Smartphone, Tag, AlertCircle,
    AlertTriangle, User, Coffee, Package, Search, RotateCcw,
    Printer, X, Cake, Cookie, CupSoda, Percent
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
    reference_number?: string;
    sale_items: { quantity: number; unit_price: number; products: { name: string } }[];
}


const PAYMENT_METHODS = [
    { key: 'CASH' as const, label: 'Cash', Icon: Banknote, color: '#10b981' },
    { key: 'E-WALLET' as const, label: 'E-Wallet', Icon: Smartphone, color: '#06b6d4' },
];

const EWALLET_PROVIDERS = [
    { key: 'GCASH', label: 'GCash', color: '#1a73e8', bg: 'rgba(26,115,232,0.12)', border: 'rgba(26,115,232,0.35)' },
    { key: 'PAYMAYA', label: 'PayMaya', color: '#00b15c', bg: 'rgba(0,177,92,0.12)', border: 'rgba(0,177,92,0.35)' },
    { key: 'MARIBANK', label: 'Maribank', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.35)' },
    { key: 'GOTYME', label: 'GoTyme', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.35)' },
    { key: 'BANKTRANSFER', label: 'Bank Transfer', color: '#d97706', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.35)' },
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
    const [ewalletProvider, setEwalletProvider] = useState<string>('GCASH');
    const [cashTendered, setCashTendered] = useState<string>('');
    const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
    const [loadingSales, setLoadingSales] = useState(true);
    const [pickerSearch, setPickerSearch] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
    const [filterMode, setFilterMode] = useState<string>('ALL');

    const [success, setSuccess] = useState<string | null>(null);
    const [refundingId, setRefundingId] = useState<string | null>(null);
    const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

    const [showRefModal, setShowRefModal] = useState(false);
    const [refNumber, setRefNumber] = useState('');
    const [refError, setRefError] = useState<string | null>(null);
    const [pendingSalePayload, setPendingSalePayload] = useState<any>(null);

    // Discount state
    const [discountType, setDiscountType] = useState<'NONE' | 'SENIOR_PWD' | 'CUSTOM'>('NONE');
    const [customDiscountPercent, setCustomDiscountPercent] = useState('10');

    // Shift check state
    const [activeShift, setActiveShift] = useState<any>(null);
    const [checkingShift, setCheckingShift] = useState(true);

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
            recorded_by: sale.recorded_by || 'Staff',
            reference_number: sale.reference_number,
        } as any);
    };

    const handlePrintReceipt = () => {
        const printArea = document.getElementById('receipt-printable-content');
        if (!printArea) return;

        let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'receipt-print-iframe';
            Object.assign(iframe.style, {
                position: 'fixed', right: '0', bottom: '0',
                width: '0', height: '0', border: 'none',
            });
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(`<!DOCTYPE html><html><head><title>Receipt - Houseblend Cafe</title><style>
            @page { size: auto; margin: 10mm; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.6; color: #111; margin: 0; padding: 15px; width: 320px; background: #fff; }
            * { box-sizing: border-box; }
        </style></head><body></body></html>`);
        doc.close();

        const clone = printArea.cloneNode(true) as HTMLElement;
        doc.body.appendChild(clone);

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 250);
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

// Helper to standardize category names & catch common typos across ALL categories
const normalizeCategory = (cat: string = ''): string => {
    const trimmed = (cat || '').trim();
    if (!trimmed) return 'General';
    const lower = trimmed.toLowerCase();

    // Milk Tea
    if (lower.includes('milk') && (lower.includes('tea') || lower.includes('ta') || lower.includes('t3a'))) return 'Milk Tea';
    // Coffee & Iced Coffee
    if (lower.includes('iced') && (lower.includes('coff') || lower.includes('cofe'))) return 'Iced Coffee';
    if (lower.includes('coff') || lower.includes('cofe')) return 'Coffee';
    // Fruit Soda
    if (lower.includes('fruit') && lower.includes('soda')) return 'Fruit Soda';
    // Cakes & Desserts
    if (lower.includes('cake') || lower.includes('dessert')) return 'Cakes & Desserts';
    // Bread & Pastry
    if (lower.includes('bread') || lower.includes('pastry')) return 'Bread & Pastry';
    // Iced Blended
    if (lower.includes('blend')) return 'Iced Blended';
    // Mango Series
    if (lower.includes('mango')) return 'Mango Series';
    // Matcha Series
    if (lower.includes('matcha')) return 'Matcha Series';
    // Ube Series
    if (lower.includes('ube')) return 'Ube Series';
    // Burgers
    if (lower.includes('burger')) return 'Burgers';
    // Fries
    if (lower.includes('fry') || lower.includes('fries')) return 'Fries';
    // Hotdog
    if (lower.includes('hotdog') || lower.includes('hot dog')) return 'Hotdog';
    // Siomai
    if (lower.includes('siomai')) return 'Siomai';
    // Takoyaki
    if (lower.includes('takoyaki')) return 'Takoyaki';

    const lowerNoSpace = lower.replace(/[\s\-_]+/g, '');
    if (lowerNoSpace === 'milktea' || lowerNoSpace === 'milkteaa') return 'Milk Tea';
    if (lowerNoSpace === 'fruitsoda') return 'Fruit Soda';

    // Auto title-case custom categories
    return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

    // Dynamic category list computation from available products
    const availableCategories = useMemo(() => {
        const customSet = new Set<string>();
        products.forEach(p => {
            if (p.is_active !== false && p.category && p.category.trim()) {
                const norm = normalizeCategory(p.category);
                if (norm) customSet.add(norm);
            }
        });
        const customCats = Array.from(customSet).sort();
        const presets = ['Coffee', 'Milk Tea', 'Fruit Soda', 'Cakes & Desserts', 'Bread & Pastry'];
        const merged = Array.from(new Set([...presets, ...customCats]));
        return ['ALL', 'PROMO', ...merged];
    }, [products]);

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

    // Filtered groups based on search and selected category
    const filteredGroupNames = Object.keys(groupedProducts).filter(name => {
        const variants = groupedProducts[name];
        const matchesSearch = name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
            variants.some(p => normalizeCategory(p.category || '').toLowerCase().includes(pickerSearch.toLowerCase()));
        if (!matchesSearch) return false;

        if (filterMode === 'PROMO') {
            return variants.some(p => p.is_promo);
        }
        if (filterMode !== 'ALL') {
            const normFilter = normalizeCategory(filterMode).toLowerCase();
            return variants.some(p => normalizeCategory(p.category || '').toLowerCase() === normFilter);
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


    const fetchActiveShift = useCallback(async () => {
        try {
            const data = await apiClient.get(`${API_ENDPOINTS.SHIFTS}/current`);
            setActiveShift(data || null);
        } catch {
            setActiveShift(null);
        } finally {
            setCheckingShift(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchRecentSales();
        fetchActiveShift();

        const handleShiftUpdate = () => fetchActiveShift();
        window.addEventListener('shift-changed', handleShiftUpdate);
        window.addEventListener('sale-recorded', handleShiftUpdate);

        // ── Visibility-based shift refresh ────────────────────────────────────
        // Use 'visibilitychange' instead of 'focus' — 'focus' fires on every
        // click anywhere in the window, causing the shift API to be hammered
        // continuously. Visibility change fires only when the tab actually becomes
        // visible again after being hidden (e.g. switching browser tabs).
        let visibilityDebounce: ReturnType<typeof setTimeout>;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                clearTimeout(visibilityDebounce);
                visibilityDebounce = setTimeout(() => fetchActiveShift(), 1000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('shift-changed', handleShiftUpdate);
            window.removeEventListener('sale-recorded', handleShiftUpdate);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearTimeout(visibilityDebounce);
        };
    }, [fetchProducts, fetchRecentSales, fetchActiveShift]);


    // Unsaved changes warning on refresh/close when cart is not empty
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (items.length > 0 || showRefModal) {
                const msg = items.length > 0
                    ? `You have ${items.length} item(s) in your cart that haven't been recorded yet. If you refresh, your cart will be lost!`
                    : 'You have an unfinished reference number input. Refreshing will cancel the sale recording.';
                e.preventDefault();
                e.returnValue = msg;
                return msg;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [items, showRefModal]);

    // Helpers

    const getStockStatus = (p: Product) => {
        if (p.stock === undefined) return 'ok';
        if (p.stock === 0) return 'out';
        if (p.reorder_level && p.stock <= p.reorder_level) return 'low';
        return 'ok';
    };

    const addProduct = (product: Product) => {
        if (!activeShift) {
            setError('Cannot add items: No active shift is currently open. Please start a shift first at top right.');
            return;
        }
        const existing = items.find(i => i.product_id === product.id);
        const lowStock = getStockStatus(product) !== 'ok';

        const availableStock = product.stock;
        const currentQty = existing ? existing.quantity : 0;

        if (availableStock != null && currentQty + 1 > availableStock) {
            setError(`Cannot add more: Only ${availableStock} '${product.name}' available in stock.`);
            return;
        }

        setError(null);
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
        setError(null);
        const item = items.find(i => i.id === id);
        if (!item) return;

        const prod = products.find(p => p.id === item.product_id);
        const availableStock = prod?.stock;

        const next = item.quantity + delta;
        if (next < 1) return;

        if (delta > 0 && availableStock != null && next > availableStock) {
            setError(`Cannot increase quantity: Only ${availableStock} '${item.product_name}' available in stock.`);
            return;
        }

        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            return { ...i, quantity: next };
        }));
    };

    const setQtyDirect = (id: string, val: string) => {
        if (val === '') return;
        setError(null);
        const item = items.find(i => i.id === id);
        if (!item) return;

        const prod = products.find(p => p.id === item.product_id);
        const availableStock = prod?.stock;

        const n = parseInt(val, 10);
        if (!isNaN(n)) {
            let bounded = Math.min(9999, Math.max(1, n));
            if (availableStock != null && bounded > availableStock) {
                setError(`Cannot set quantity to ${bounded}: Only ${availableStock} '${item.product_name}' available in stock.`);
                bounded = availableStock;
            }
            setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: bounded } : i));
        }
    };

    const updatePrice = (id: string, val: string) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            if (val === '') return { ...i, unit_price: '' };
            const num = Number(val);
            if (isNaN(num)) return i;
            const bounded = Math.min(100000, Math.max(0, num));
            return { ...i, unit_price: bounded };
        }));
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

        if (!activeShift) {
            setError('Cannot record sale: No active shift is currently open. Please click "No Active Shift" at the top right to start a shift.');
            return;
        }
        setSuccess(null);

        if (items.length === 0) { setError('Add at least one item to record a sale.'); return; }

        for (const item of items) {
            const prod = products.find(p => p.id === item.product_id);
            const availableStock = prod?.stock;
            if (availableStock != null && item.quantity > availableStock) {
                setError(`Cannot record sale: '${item.product_name}' requested quantity (${item.quantity}) exceeds available stock (${availableStock}).`);
                return;
            }
        }

        if (items.some(i => i.quantity < 1 || i.quantity > 9999)) {
            setError('Item quantity must be between 1 and 9,999.'); return;
        }
        if (items.some(i => i.unit_price === '' || isNaN(Number(i.unit_price)) || Number(i.unit_price) <= 0 || Number(i.unit_price) > 100000)) {
            setError('Please enter a valid unit price between ₱0.01 and ₱100,000.00 for every item.'); return;
        }

        const tenderedNum = Number(cashTendered);
        if (paymentMethod === 'CASH') {
            if (cashTendered === '' || isNaN(tenderedNum) || tenderedNum < 0) {
                setError('Please enter a valid client payment amount.'); return;
            }
            if (tenderedNum > 500000) {
                setError('Client payment amount cannot exceed ₱500,000.00.'); return;
            }
            if (tenderedNum < finalTotal) {
                setError(`Cash tendered (PHP ${tenderedNum.toFixed(2)}) is less than total amount (PHP ${finalTotal.toFixed(2)}).`); return;
            }
        }

        // Build the payload and keep it in state so the ref modal can use it
        const now = new Date();
        const [y, m, d] = saleDate.split('-').map(Number);
        const localDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        const finalSaleDate = localDate.toISOString();
        const finalTendered = paymentMethod === 'CASH' ? (tenderedNum > 0 ? tenderedNum : finalTotal) : undefined;
        const finalChange = paymentMethod === 'CASH' && finalTendered ? Math.max(0, finalTendered - finalTotal) : undefined;

        const payload = {
            sale_date: finalSaleDate,
            payment_method: paymentMethod, // Always store clean 'CASH' or 'E-WALLET'
            ewallet_provider: paymentMethod === 'E-WALLET' ? ewalletProvider : undefined,
            items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
            recorded_by: fullName || 'Staff',
            staff_id: session?.user?.id || null,
            discount: discountAmount,
            finalTendered,
            finalChange,
            finalSaleDate,
        };

        // For E-Wallet: open reference number modal first
        if (paymentMethod === 'E-WALLET') {
            setPendingSalePayload(payload);
            setRefNumber('');
            setRefError(null);
            setShowRefModal(true);
            return;
        }

        await submitSale(payload);
    };

    const submitSale = async (payload: any, referenceNumber?: string) => {
        setSubmitting(true);
        try {
            const postBody: any = {
                sale_date: payload.finalSaleDate,
                payment_method: payload.payment_method,
                ewallet_provider: payload.ewallet_provider,
                items: payload.items,
                recorded_by: payload.recorded_by,
                staff_id: payload.staff_id,
                discount: payload.discount,
            };
            if (referenceNumber) postBody.reference_number = referenceNumber;

            console.log('[Sales] Sending sale to backend...');

            const saleData = await apiClient.post(API_ENDPOINTS.SALES, postBody);

            if (saleData?.id) {
                await new Promise(r => setTimeout(r, 300));
            }

            if (saleData) {
                setActiveReceipt({
                    id: saleData.id || '',
                    sale_date: payload.finalSaleDate,
                    items: items.map(i => ({
                        name: (products.find(p => p.id === i.product_id)?.name ?? 'Item'),
                        qty: i.quantity,
                        price: Number(i.unit_price || 0)
                    })),
                    subtotal,
                    discount: payload.discount,
                    discount_type: discountType,
                    total: finalTotal,
                    cash_tendered: payload.finalTendered,
                    change: payload.finalChange,
                    payment_method: payload.payment_method,
                    ewallet_provider: payload.ewallet_provider,
                    recorded_by: payload.recorded_by,
                    reference_number: referenceNumber,
                } as any);
            }

            setItems([]);
            setSaleDate(new Date().toLocaleDateString('en-CA'));
            setPaymentMethod('CASH');
            setEwalletProvider('GCASH');
            setCashTendered('');
            setDiscountType('NONE');
            setShowRefModal(false);
            setPendingSalePayload(null);
            setRefNumber('');
            setError(null);
            setSuccess('Sale recorded successfully!');
            setTimeout(() => setSuccess(null), 3000);
            fetchRecentSales();
            fetchProducts();
            window.dispatchEvent(new Event('sale-recorded'));
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

                {/* Active Shift Warning Banner */}
                {!checkingShift && !activeShift && (
                    <div className="animate-fade-in" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.9rem 1.25rem', borderRadius: '14px',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444', flexWrap: 'wrap', gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 700, fontSize: '0.9rem' }}>
                            <AlertCircle size={20} style={{ flexShrink: 0 }} />
                            <span>No Active Shift! Recording sales is disabled until a work shift is started.</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Click "No Active Shift" at top right to start a shift
                        </span>
                    </div>
                )}

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

                        {/* E-Wallet Provider Selector */}
                        {paymentMethod === 'E-WALLET' && (
                            <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>E-Wallet Provider</span>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 1 }}>
                                    {EWALLET_PROVIDERS.map(p => {
                                        const active = ewalletProvider === p.key;
                                        return (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => setEwalletProvider(p.key)}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '8px',
                                                    border: active ? `2px solid ${p.color}` : `1.5px solid ${p.border}`,
                                                    background: active ? p.bg : 'rgba(255,255,255,0.03)',
                                                    color: active ? p.color : 'var(--text-muted)',
                                                    fontWeight: active ? 700 : 500,
                                                    cursor: 'pointer',
                                                    fontSize: '0.78rem',
                                                    transition: 'all 0.15s',
                                                    fontFamily: 'inherit',
                                                    boxShadow: active ? `0 0 0 3px ${p.color}22` : 'none',
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Product Grid */}
                        <div className="glass-card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Products - Tap to Add</span>

                                <div style={{ position: 'relative', width: '240px', maxWidth: '100%' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input
                                        placeholder="Search products..."
                                        value={pickerSearch}
                                        onChange={e => setPickerSearch(e.target.value)}
                                        style={{
                                            ...inputBase,
                                            padding: '0.35rem 2rem 0.35rem 2.1rem',
                                            fontSize: '0.8rem',
                                            width: '100%',
                                            borderRadius: '8px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    {pickerSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setPickerSearch('')}
                                            style={{
                                                position: 'absolute',
                                                right: '0.5rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '2px',
                                                borderRadius: '50%'
                                            }}
                                            title="Clear search"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Category Filter Pills & Custom % Promo Discount */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border-light)' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                                    {availableCategories.map(cat => {
                                        const isActive = filterMode === cat;
                                        const isPromo = cat === 'PROMO';
                                        const isAll = cat === 'ALL';
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    setFilterMode(cat);
                                                    if (cat === 'PROMO') {
                                                        setDiscountType('CUSTOM');
                                                    } else if (discountType === 'CUSTOM') {
                                                        setDiscountType('NONE');
                                                    }
                                                }}
                                                style={{
                                                    padding: '0.3rem 0.7rem',
                                                    borderRadius: '8px',
                                                    border: isActive ? '1.5px solid var(--accent-primary)' : '1px solid var(--glass-border-light)',
                                                    background: isActive ? 'var(--accent-primary)' : 'rgba(0,0,0,0.04)',
                                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                                    fontSize: '0.73rem',
                                                    fontWeight: isActive ? 700 : 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    fontFamily: 'inherit'
                                                }}
                                            >
                                                {isPromo && <Tag size={11} color={isActive ? 'white' : '#f59e0b'} />}
                                                {isAll ? 'All Products' : cat}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Inline Custom % Input when Promo tab is active or Custom discount set */}
                                {(filterMode === 'PROMO' || discountType === 'CUSTOM') && (
                                    <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.35)', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Promo Discount %:</span>
                                        <input
                                            type="number" min="0" max="100" step="1"
                                            className="no-spinner"
                                            value={customDiscountPercent}
                                            onChange={e => {
                                                setCustomDiscountPercent(e.target.value);
                                                setDiscountType('CUSTOM');
                                            }}
                                            style={{ ...inputBase, padding: '0.15rem 0.4rem', width: '55px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 700, MozAppearance: 'textfield' }}
                                        />
                                    </div>
                                )}
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
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2, color: 'var(--text-primary)', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {baseName}
                                                        </div>
                                                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                                                            {normalizeCategory(p.category)}
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
                                                <input type="number" min={1} max={9999} step={1} value={item.quantity} onChange={e => setQtyDirect(item.id, e.target.value)}
                                                    style={{ ...inputBase, padding: '0.25rem 0.3rem', textAlign: 'center', width: '36px', fontSize: '0.82rem' }} />
                                                <button type="button" onClick={() => updateQty(item.id, 1)}
                                                    style={{ width: '24px', height: '24px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Plus size={10} />
                                                </button>
                                            </div>
                                            <input type="number" min={0.01} max={100000} step={0.01} placeholder="0.00" value={item.unit_price} onChange={e => updatePrice(item.id, e.target.value)}
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
                                    ].map(d => {
                                        const active = discountType === d.key;
                                        return (
                                            <button
                                                key={d.key}
                                                type="button"
                                                onClick={() => setDiscountType(d.key as any)}
                                                style={{
                                                    flex: 1,
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
                                        max="500000"
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

                            <button type="submit" disabled={submitting || items.length === 0 || !activeShift} style={{
                                background: (!activeShift || items.length === 0) ? '#cbd5e1' : 'var(--accent-primary)',
                                border: 'none', borderRadius: '10px',
                                color: (!activeShift || items.length === 0) ? '#64748b' : '#ffffff',
                                padding: '0.9rem', fontSize: '1rem', fontWeight: 700,
                                cursor: (submitting || items.length === 0 || !activeShift) ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.7 : 1, transition: 'all 0.2s',
                                fontFamily: 'inherit', width: '100%',
                                boxShadow: (items.length > 0 && activeShift) ? '0 4px 16px rgba(13,148,136,0.35)' : 'none',
                            }}>
                                {submitting ? 'Recording...' : !activeShift ? 'No Active Shift (Open Shift First)' : 'Record Sale'}
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
                            const ewalletTotal = activeSales.filter(s => s.payment_method?.startsWith('E-WALLET')).reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
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
                                                    const rawPm = sale.payment_method ?? '-';
                                                    const isEwallet = rawPm.startsWith('E-WALLET');
                                                    const pm = isEwallet
                                                        ? PAYMENT_METHODS.find(p => p.key === 'E-WALLET')
                                                        : PAYMENT_METHODS.find(p => p.key === rawPm);
                                                    // Build friendly label: "E-Wallet / GCash" or raw method
                                                    const displayLabel = isEwallet
                                                        ? rawPm.replace('E-WALLET:', 'E-Wallet / ').replace('E-WALLET', 'E-Wallet')
                                                        : rawPm;
                                                    return <span style={{ background: pm ? pm.color + '22' : 'rgba(0,0,0,0.08)', color: pm ? pm.color : 'var(--text-muted)', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{displayLabel}</span>;
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

            {/* ── Reference Number Modal (E-Wallet) ─────────────────── */}
            {showRefModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9100,
                        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', color: '#111', borderRadius: '16px',
                            width: '380px', maxWidth: '96vw', padding: '2rem',
                            boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
                            border: '1px solid rgba(6,182,212,0.2)',
                            display: 'flex', flexDirection: 'column', gap: '1.25rem',
                            position: 'relative',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '12px',
                                background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Smartphone size={20} color="#06b6d4" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111' }}>E-Wallet Reference</div>
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                    {EWALLET_PROVIDERS.find(p => p.key === ewalletProvider)?.label || ewalletProvider} · PHP {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Info box */}
                        <div style={{
                            background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                            borderRadius: '10px', padding: '0.75rem 1rem',
                            fontSize: '0.78rem', color: '#444', lineHeight: 1.5
                        }}>
                            <strong style={{ color: '#0891b2' }}>Enter the transaction reference number</strong> from the e-wallet app before recording the sale.<br />
                            <span style={{ color: '#666', fontSize: '0.72rem' }}>Example: <code style={{ background: 'rgba(6,182,212,0.12)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#0891b2' }}>GC-20260916-ABCD1234</code></span>
                        </div>

                        {/* Input */}
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555', display: 'block', marginBottom: '0.4rem' }}>
                                Reference Number <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                id="ref-number-input"
                                autoFocus
                                type="text"
                                maxLength={50}
                                placeholder={`e.g. GC-20260916-ABCD1234`}
                                value={refNumber}
                                onChange={e => { setRefNumber(e.target.value); setRefError(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (!refNumber.trim()) { setRefError('Reference number is required.'); return; }
                                        submitSale(pendingSalePayload, refNumber.trim());
                                    }
                                }}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: '#f8f9fa',
                                    border: refError ? '1.5px solid #ef4444' : '1.5px solid rgba(6,182,212,0.4)',
                                    borderRadius: '10px',
                                    color: '#111',
                                    padding: '0.65rem 0.9rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.04em',
                                }}
                            />
                            {refError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.75rem', color: '#ef4444' }}>
                                    <AlertCircle size={12} />
                                    {refError}
                                </div>
                            )}
                        </div>

                        {/* Unsaved warning */}
                        <div style={{
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: '8px', padding: '0.55rem 0.75rem',
                            fontSize: '0.73rem', color: '#b45309',
                            display: 'flex', alignItems: 'flex-start', gap: '0.4rem'
                        }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '0.05rem' }} />
                            <span>If you accidentally refresh the page before submitting, the sale will <strong>not</strong> be recorded. Make sure to confirm the reference number first.</span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button
                                type="button"
                                onClick={() => { setShowRefModal(false); setPendingSalePayload(null); setRefNumber(''); }}
                                disabled={submitting}
                                style={{
                                    flex: 1, padding: '0.65rem',
                                    borderRadius: '10px',
                                    border: '1.5px solid #ddd',
                                    background: '#f1f5f9',
                                    color: '#555',
                                    fontSize: '0.85rem', fontWeight: 600,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', transition: 'all 0.15s'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!refNumber.trim()) { setRefError('Reference number is required.'); return; }
                                    submitSale(pendingSalePayload, refNumber.trim());
                                }}
                                disabled={submitting}
                                style={{
                                    flex: 2, padding: '0.65rem',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: submitting ? '#4b5563' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                    color: 'white',
                                    fontSize: '0.9rem', fontWeight: 700,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', transition: 'all 0.15s',
                                    boxShadow: submitting ? 'none' : '0 4px 14px rgba(6,182,212,0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                                }}
                            >
                                {submitting ? 'Recording...' : '✓ Confirm & Record Sale'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                        {/* Receipt Printable Content */}
                        <div id="receipt-printable-content">
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
                            {activeReceipt.discount > 0 && (() => {
                                const sub = activeReceipt.subtotal || (activeReceipt.total + activeReceipt.discount);
                                const pct = sub > 0 ? Math.round((activeReceipt.discount / sub) * 100) : 0;
                                const isSenior = (activeReceipt as any).discount_type === 'SENIOR_PWD';
                                const label = isSenior
                                    ? `Discount 20%(Senior/PWD)`
                                    : `Discount ${pct > 0 ? `${pct}%` : ''} Promo`;
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
                                        <span>{label}</span>
                                        <span>- PHP {activeReceipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                );
                            })()}
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
                                    {activeReceipt.payment_method === 'E-WALLET'
                                        ? `E-Wallet${(activeReceipt as any).ewallet_provider ? ' / ' + (activeReceipt as any).ewallet_provider : ''}`
                                        : activeReceipt.payment_method}
                                </span>
                            </div>

                            {(activeReceipt as any).reference_number && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555' }}>
                                    <span>Ref. No.</span>
                                    <span style={{ fontWeight: 700, color: '#0891b2', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{(activeReceipt as any).reference_number}</span>
                                </div>
                            )}

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
                        </div>

                        {/* Print Button */}
                        <button
                            type="button"
                            onClick={handlePrintReceipt}
                            style={{
                                marginTop: '1rem', width: '100%', padding: '0.65rem',
                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                color: 'white', border: 'none', borderRadius: '8px',
                                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                boxShadow: '0 4px 12px rgba(139,92,246,0.3)', transition: 'all 0.15s'
                            }}
                        >
                            <Printer size={15} /> Print Receipt
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sales;


