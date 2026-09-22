import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../lib/api';
import { apiClient } from '../../lib/apiClient';

interface IngredientStockDetail {
    name: string;
    stock_quantity: number;
    unit: string;
    quantity_required: number;
    expiry_date?: string;
    batch_number?: string;
}

interface ProductForecastItem {
    id: string;
    name: string;
    raw_name: string;
    category: string;
    size?: string;
    price: number;
    recipe_cost?: number;
    unit_profit?: number;
    profit_margin_percent?: number;
    forecasted_profit_php?: number;
    current_stock: number;
    forecasted_demand: number;
    forecasted_revenue_php: number;
    daily_avg_demand: number;
    reorder_level: number;
    stock_status: 'AT_RISK' | 'NORMAL';
    batch_expiry_status: 'EXPIRED' | 'EXPIRING_SOON' | 'SAFE';
    expiring_ingredient?: string;
    days_to_expiry?: number;
    ingredient_stock_details?: IngredientStockDetail[];
    assigned_staff_id?: string;
    assigned_staff_name?: string;
}

interface StaffUser {
    id: string;
    full_name?: string;
    name?: string;
    email?: string;
    role?: string;
}

interface SummaryData {
    total_items_demand: number;
    total_projected_revenue_php: number;
    total_projected_profit_php?: number;
    overall_profit_margin_percent?: number;
    total_products: number;
    at_risk_count: number;
    normal_count: number;
    expiring_batches_count: number;
    days: number;
    weather: string;
    seasonality_velocity?: Record<string, number>;
}

const ProductForecastTable = () => {
    const [days, setDays] = useState<number>(14);
    const [weather, setWeather] = useState<string>('sunny');
    const [products, setProducts] = useState<ProductForecastItem[]>([]);
    const [staffList, setStaffList] = useState<StaffUser[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [categories, setCategories] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'AT_RISK' | 'NORMAL'>('ALL');
    const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'SAFE'>('ALL');
    const [staffFilter, setStaffFilter] = useState<string>('ALL');
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [page, setPage] = useState<number>(1);
    const pageSize = 10;

    useEffect(() => {
        fetchStaffList();
    }, []);

    useEffect(() => {
        fetchProductForecasts();
    }, [days, weather]);

    const fetchStaffList = async () => {
        try {
            const resp = await apiClient.get(API_ENDPOINTS.STAFF);
            if (Array.isArray(resp)) {
                setStaffList(resp);
            }
        } catch (e) {
            console.error('Failed to load staff list:', e);
        }
    };

    const fetchProductForecasts = async () => {
        try {
            setLoading(true);
            const resp = await apiClient.get(`${API_ENDPOINTS.ANALYTICS.PRODUCT_FORECASTS}?days=${days}&weather=${weather}`);
            if (resp && resp.products) {
                setProducts(resp.products);
                setSummary(resp.summary);

                // Extract unique categories
                const cats = Array.from(new Set(resp.products.map((p: ProductForecastItem) => p.category))) as string[];
                setCategories(['All', ...cats.sort()]);
            }
        } catch (e) {
            console.error('Failed to fetch product forecasts:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignStaff = async (productId: string, productName: string, staffId: string) => {
        try {
            setAssigningId(productId);
            if (!staffId || staffId === 'unassign') {
                await apiClient.delete(`${API_ENDPOINTS.ASSIGNMENTS}/${productId}`);
                setProducts(prev => prev.map(p => p.id === productId ? { ...p, assigned_staff_id: undefined, assigned_staff_name: 'Unassigned' } : p));
            } else {
                const staffObj = staffList.find(s => s.id === staffId);
                const staffName = staffObj?.full_name || staffObj?.name || 'Staff Member';

                await apiClient.post(API_ENDPOINTS.ASSIGN, {
                    item_id: productId,
                    staff_id: staffId,
                    staff_name: staffName,
                    item_name: productName
                });

                setProducts(prev => prev.map(p => p.id === productId ? { ...p, assigned_staff_id: staffId, assigned_staff_name: staffName } : p));
            }
        } catch (e) {
            console.error('Failed to update staff assignment:', e);
        } finally {
            setAssigningId(null);
        }
    };

    // Filter products based on search, category, risk status, batch expiry, and staff assignment
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.category.toLowerCase().includes(search.toLowerCase()) ||
            (p.assigned_staff_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesStatus = statusFilter === 'ALL' || p.stock_status === statusFilter;
        const matchesExpiry = expiryFilter === 'ALL' || p.batch_expiry_status === expiryFilter;

        let matchesStaff = true;
        if (staffFilter === 'ASSIGNED') {
            matchesStaff = !!p.assigned_staff_id && p.assigned_staff_name !== 'Unassigned';
        } else if (staffFilter === 'UNASSIGNED') {
            matchesStaff = !p.assigned_staff_id || p.assigned_staff_name === 'Unassigned';
        } else if (staffFilter !== 'ALL') {
            matchesStaff = p.assigned_staff_name === staffFilter;
        }

        return matchesSearch && matchesCategory && matchesStatus && matchesExpiry && matchesStaff;
    });

    const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
    const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

    const weatherOptions = [
        { id: 'sunny', label: 'Sunny' },
        { id: 'hot', label: 'Hot Weather' },
        { id: 'rainy', label: 'Rainy' },
        { id: 'stormy', label: 'Stormy' },
        { id: 'cool', label: 'Cool Weather' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

            {/* ── Summary KPI Cards ────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

                {/* Card 1: Total Demand & Projected Revenue */}
                <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-primary)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Forecast Demand & Revenue ({days} Days)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.35rem 0', color: 'var(--text-primary)' }}>
                        {summary ? summary.total_items_demand.toLocaleString() : 0} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>units</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10B981' }}>
                        ₱{summary ? summary.total_projected_revenue_php.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'} projected
                    </div>
                </div>

                {/* Card 2: Projected Net Profit */}
                <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10B981' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Projected Profit ({days} Days)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.35rem 0', color: '#10B981' }}>
                        ₱{summary ? (summary.total_projected_profit_php || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '0.1rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {summary?.overall_profit_margin_percent ?? 0}% profit margin
                        </span>
                    </div>
                </div>

                {/* Card 3: Products At Stock Risk */}
                <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #EF4444' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Stock Risk Warning
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.35rem 0', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {summary ? summary.at_risk_count : 0} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>products</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Servable stock below forecast demand
                    </div>
                </div>

                {/* Card 4: Batch Expiry Threshold Alerts */}
                <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Batch Expiry Threshold Alerts
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.35rem 0', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {summary ? summary.expiring_batches_count : 0} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>items</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Ingredients expiring within 7 days or expired
                    </div>
                </div>

                {/* Card 5: Total Products Monitored */}
                <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Monitored Catalog
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.35rem 0', color: '#3B82F6' }}>
                        {summary ? summary.total_products : 0} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>items</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Live SARIMAX AI model
                    </div>
                </div>

            </div>

            {/* ── Table Container Card ─────────────────────────────────── */}
            <div className="glass-card" style={{ padding: '1.5rem', width: '100%' }}>

                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Product Demand & Stock Availability Forecast Table
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Compare recipe stock availability (g/ml/units) against AI forecasted demand over {days} days
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

                        {/* Days Horizon Toggle */}
                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            {[7, 14, 30, 60].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    style={{
                                        background: days === d ? 'var(--accent-primary, #8B5CF6)' : 'transparent',
                                        color: days === d ? '#FFFFFF' : 'var(--text-muted)',
                                        border: 'none',
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: days === d ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {d} Days
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Search product..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                outline: 'none',
                                width: '170px'
                            }}
                        />

                        {/* Category Dropdown */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        >
                            {categories.map(c => (
                                <option key={c} value={c} style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                                    {c === 'All' ? 'All Categories' : c}
                                </option>
                            ))}
                        </select>

                        {/* Batch Expiry Filter */}
                        <select
                            value={expiryFilter}
                            onChange={(e) => { setExpiryFilter(e.target.value as any); setPage(1); }}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL" style={{ background: 'var(--bg-panel)' }}>All Batch Expiry</option>
                            <option value="EXPIRED" style={{ background: 'var(--bg-panel)', color: '#EF4444' }}>Expired Ingredients</option>
                            <option value="EXPIRING_SOON" style={{ background: 'var(--bg-panel)', color: '#F59E0B' }}>Expiring Soon (&lt;7 days)</option>
                            <option value="SAFE" style={{ background: 'var(--bg-panel)', color: '#10B981' }}>Safe Shelf-Life</option>
                        </select>

                        {/* Status Risk Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL" style={{ background: 'var(--bg-panel)' }}>All Stock Statuses</option>
                            <option value="AT_RISK" style={{ background: 'var(--bg-panel)', color: '#EF4444' }}>At Risk Only</option>
                            <option value="NORMAL" style={{ background: 'var(--bg-panel)', color: '#10B981' }}>Normal Level</option>
                        </select>

                    </div>
                </div>

                {/* Table View */}
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Computing product stock availability (g/ml/units), weather elasticity & SARIMAX forecasts...
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No products match the selected search or risk filters.
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.4rem' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>
                                        <th style={{ padding: '0.6rem 1rem' }}>Product Name & Size</th>
                                        <th style={{ padding: '0.6rem 1rem' }}>Category</th>
                                        <th style={{ padding: '0.6rem 1rem' }}>Live Ingredient Stock</th>
                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>Batch Expiry Alert</th>
                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Forecast Demand & Revenue</th>
                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Unit Profit & Margin</th>
                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Current Servable</th>
                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>Stock Risk Indicator</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map(item => {
                                        const isAtRisk = item.stock_status === 'AT_RISK';
                                        const isExpired = item.batch_expiry_status === 'EXPIRED';
                                        const isExpiringSoon = item.batch_expiry_status === 'EXPIRING_SOON';

                                        return (
                                            <tr
                                                key={item.id}
                                                style={{
                                                    background: isAtRisk ? 'rgba(239, 68, 68, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {/* Product Name, Pricing, & Size Tag */}
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                                                        {item.price > 0 && (
                                                            <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                                                                ₱{item.price.toFixed(2)}
                                                            </span>
                                                        )}
                                                        {item.size && (
                                                            <span style={{
                                                                background: 'rgba(59, 130, 246, 0.12)',
                                                                color: '#3B82F6',
                                                                padding: '0.1rem 0.4rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 500
                                                            }}>
                                                                {item.size}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Category */}
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                    <span style={{
                                                        background: 'rgba(255,255,255,0.06)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--glass-border-light)'
                                                    }}>
                                                        {item.category}
                                                    </span>
                                                </td>

                                                {/* Live Ingredient Stock (g/ml/units) */}
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {item.ingredient_stock_details && item.ingredient_stock_details.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                            {item.ingredient_stock_details.slice(0, 2).map((ing, idx) => (
                                                                <span key={idx} style={{ color: ing.stock_quantity < 50 ? '#EF4444' : 'var(--text-muted)' }}>
                                                                    {ing.stock_quantity.toLocaleString()} {ing.unit} - {ing.name}
                                                                </span>
                                                            ))}
                                                            {item.ingredient_stock_details.length > 2 && (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                    +{item.ingredient_stock_details.length - 2} more ingredients
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>Recipe standard stock</span>
                                                    )}
                                                </td>

                                                {/* Batch Expiry Alert Badge */}
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    {isExpired ? (
                                                        <span style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#EF4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600
                                                        }}>
                                                            Expired: {item.expiring_ingredient || 'Batch'}
                                                        </span>
                                                    ) : isExpiringSoon ? (
                                                        <span style={{
                                                            background: 'rgba(245, 158, 11, 0.15)',
                                                            color: '#F59E0B',
                                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600
                                                        }}>
                                                            Expiring ({item.days_to_expiry}d): {item.expiring_ingredient || 'Batch'}
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            background: 'rgba(16, 185, 129, 0.1)',
                                                            color: '#10B981',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontSize: '0.72rem'
                                                        }}>
                                                            Safe Shelf-Life
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Forecasted Demand & Projected Revenue */}
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
                                                        {item.forecasted_demand} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>units</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 500, marginTop: '0.1rem' }}>
                                                        ₱{item.forecasted_revenue_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </td>

                                                {/* Unit Profit & Margin */}
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: '#10B981', fontSize: '0.88rem' }}>
                                                        ₱{(item.unit_profit || 0).toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ unit</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.15rem' }}>
                                                        <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                                                            {item.profit_margin_percent || 0}% margin
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Current Availability / Stock */}
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: isAtRisk ? '#EF4444' : '#10B981', fontSize: '0.9rem' }}>
                                                    {item.current_stock} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>servable</span>
                                                </td>

                                                {/* Stock Risk Indicator Badge */}
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    {isAtRisk ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#EF4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            padding: '0.3rem 0.75rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                                                            At Risk (Low Stock)
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10B981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            padding: '0.3rem 0.75rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                                                            Normal Level
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border-light)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredProducts.length)} of {filteredProducts.length} products
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--glass-border)',
                                        color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '4px',
                                        cursor: page === 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    Previous
                                </button>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--glass-border)',
                                        color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '4px',
                                        cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}

            </div>

        </div>
    );
};

export default ProductForecastTable;
