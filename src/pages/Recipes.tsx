import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, BookOpen, ChevronDown, Package, AlertTriangle, Clock, PlusCircle, RefreshCw } from 'lucide-react';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
    id: string;
    name: string;
    unit: string;
    stock_quantity: number;
    min_stock_level: number;
    cost_per_unit: number;
    expiry_date?: string;
    batch_number?: string;
}

interface RecipeRow {
    id: string;
    ingredient_id: string;
    quantity_required: number;
    ingredients: { id: string; name: string; unit: string; stock_quantity: number; cost_per_unit?: number };
}

interface Product {
    id: string;
    name: string;
    unit_of_measure: string;
    size?: string | null;
}

// ── Shared Styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'white',
    outline: 'none',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
};

// ── Helper: stock status ──────────────────────────────────────────────────────

function stockStatus(current: number, min: number): 'danger' | 'warning' | 'ok' {
    if (current <= 0) return 'danger';
    if (current <= min) return 'warning';
    return 'ok';
}

const STATUS_COLOR = {
    danger: 'var(--status-danger)',
    warning: 'var(--status-warning)',
    ok: 'var(--status-success)',
};

const STATUS_BG = {
    danger: 'rgba(239,68,68,0.12)',
    warning: 'rgba(245,158,11,0.12)',
    ok: 'rgba(16,185,129,0.12)',
};

function isSoonExpiry(date?: string): boolean {
    if (!date) return false;
    const d = new Date(date);
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    return d >= new Date() && d <= twoWeeks;
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color, bg }: {
    icon: React.ReactNode; label: string; value: number; color: string; bg: string;
}) {
    return (
        <div style={{
            background: bg,
            border: `1px solid ${color}33`,
            borderRadius: '12px',
            padding: '1rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flex: 1,
            minWidth: 0,
        }}>
            <div style={{
                background: `${color}22`,
                borderRadius: '8px',
                padding: '0.5rem',
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem', whiteSpace: 'nowrap' }}>{label}</div>
            </div>
        </div>
    );
}


// ── Main Component ────────────────────────────────────────────────────────────

const Recipes = () => {
    // Ingredients
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [ingLoading, setIngLoading] = useState(true);
    const [showAddIng, setShowAddIng] = useState(false);
    const [editIng, setEditIng] = useState<Ingredient | null>(null);
    const [ingForm, setIngForm] = useState({
        name: '', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '',
        conversion_multiple: '', conversion_size: ''
    });
    const [ingSubmitting, setIngSubmitting] = useState(false);

    // Inline restock
    const [restockId, setRestockId] = useState<string | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [restocking, setRestocking] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Recipe builder
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [recipe, setRecipe] = useState<RecipeRow[]>([]);
    const [recipeCost, setRecipeCost] = useState(0);
    const [recipeLoading, setRecipeLoading] = useState(false);
    const [addIngId, setAddIngId] = useState('');
    const [addQty, setAddQty] = useState('');
    const [recipeSubmitting, setRecipeSubmitting] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [ingSearch, setIngSearch] = useState('');
    const [showIngDropdown, setShowIngDropdown] = useState(false);

    // Build Recipe state
    const [buildQty, setBuildQty] = useState('1');
    const [building, setBuilding] = useState(false);
    const [buildMessage, setBuildMessage] = useState<string | null>(null);

    const handleBuildRecipe = async () => {
        if (!selectedProduct) return;
        const qty = parseInt(buildQty, 10);
        if (isNaN(qty) || qty <= 0) return;
        setBuilding(true);
        setBuildMessage(null);
        try {
            const res = await apiClient.post(`${API_ENDPOINTS.RECIPES}/${selectedProduct.id}/build`, { quantity: qty });
            setBuildMessage(res.message || `Successfully built ${qty} batch(es)!`);
            fetchIngredients();
            fetchRecipe(selectedProduct.id);
            setTimeout(() => setBuildMessage(null), 4000);
        } catch (err: any) {
            setBuildMessage(err.message || 'Failed to build recipe');
        } finally {
            setBuilding(false);
        }
    };

    useEffect(() => {
        fetchIngredients();
        apiClient.get(API_ENDPOINTS.PRODUCTS)
            .then(data => setProducts(Array.isArray(data) ? data : []))
            .catch(() => { });
    }, []);

    const fetchIngredients = async () => {
        setIngLoading(true);
        try {
            const data = await apiClient.get(API_ENDPOINTS.INGREDIENTS);
            setIngredients(Array.isArray(data) ? data : []);
        } catch { }
        finally { setIngLoading(false); }
    };

    const fetchRecipe = async (productId: string) => {
        setRecipeLoading(true);
        try {
            const data = await apiClient.get(`${API_ENDPOINTS.RECIPES}/${productId}`);
            // Handle both old format (array) and new format (object with items)
            const items = Array.isArray(data) ? data : (data?.items || []);
            setRecipe(items);
        } catch { }
        finally { setRecipeLoading(false); }
    };

    // ── Summary stats ───────────────────────────────────────────────────────

    const summary = useMemo(() => {
        const low = ingredients.filter(i => i.stock_quantity > 0 && i.stock_quantity <= i.min_stock_level).length;
        const out = ingredients.filter(i => i.stock_quantity <= 0).length;
        const expiring = ingredients.filter(i => isSoonExpiry(i.expiry_date)).length;
        return { total: ingredients.length, low, out, expiring };
    }, [ingredients]);


    // ── How many can we make ─────────────────────────────────────────────────

    const canMake = useMemo(() => {
        if (!selectedProduct || recipe.length === 0) return null;
        let minServable = Infinity;
        for (const row of recipe) {
            const stock = row.ingredients.stock_quantity;
            const qty = row.quantity_required;
            if (qty > 0) minServable = Math.min(minServable, Math.floor(stock / qty));
        }
        
        // Calculate total cost per unit
        let totalCost = 0;
        for (const row of recipe) {
            const costPerUnit = row.ingredients.cost_per_unit || 0;
            const qty = row.quantity_required;
            totalCost += costPerUnit * qty;
        }
        setRecipeCost(totalCost);
        
        return minServable === Infinity ? 0 : minServable;
    }, [recipe, selectedProduct]);

    // ── Filtered ingredients ─────────────────────────────────────────────────

    const filteredIngredients = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return q
            ? ingredients.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.unit.toLowerCase().includes(q) ||
                (i.batch_number && i.batch_number.toLowerCase().includes(q))
            )
            : ingredients;
    }, [ingredients, searchQuery]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSelectProduct = (p: Product) => {
        setSelectedProduct(p);
        setAddIngId('');
        setAddQty('');
        fetchRecipe(p.id);
    };

    const handleSaveIng = async (e: React.FormEvent) => {
        e.preventDefault();
        setIngSubmitting(true);
        try {
            const body = {
                name: ingForm.name,
                unit: ingForm.unit,
                stock_quantity: Number(ingForm.stock_quantity) || 0,
                min_stock_level: Number(ingForm.min_stock_level) || 0,
                cost_per_unit: Number(ingForm.cost_per_unit) || 0,
                expiry_date: ingForm.expiry_date || null,
                batch_number: ingForm.batch_number.trim() || 'Main'
            };
            if (editIng) {
                await apiClient.put(`${API_ENDPOINTS.INGREDIENTS}/${editIng.id}`, body);
            } else {
                await apiClient.post(API_ENDPOINTS.INGREDIENTS, body);
            }
            setShowAddIng(false);
            setEditIng(null);
            setIngForm({ name: '', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '', conversion_multiple: '', conversion_size: '' });
            fetchIngredients();
        } catch { }
        finally { setIngSubmitting(false); }
    };

    const handleDeleteIng = async (id: string, name: string) => {
        if (!window.confirm(`Delete "${name}"? This will also remove it from all recipes.`)) return;
        await apiClient.delete(`${API_ENDPOINTS.INGREDIENTS}/${id}`);
        fetchIngredients();
        if (selectedProduct) fetchRecipe(selectedProduct.id);
    };

    const openEditIng = (ing: Ingredient) => {
        setEditIng(ing);
        setIngForm({
            name: ing.name, unit: ing.unit,
            stock_quantity: String(ing.stock_quantity),
            min_stock_level: String(ing.min_stock_level),
            cost_per_unit: String(ing.cost_per_unit),
            expiry_date: ing.expiry_date || '',
            batch_number: ing.batch_number || '',
            conversion_multiple: '', conversion_size: ''
        });
        setShowAddIng(true);
    };

    const handleRestock = async (ing: Ingredient) => {
        const qty = parseFloat(restockQty);
        if (isNaN(qty) || qty <= 0) return;
        setRestocking(true);
        try {
            await apiClient.put(`${API_ENDPOINTS.INGREDIENTS}/${ing.id}`, {
                stock_quantity: ing.stock_quantity + qty,
                batch_number: ing.batch_number || 'Main'
            });
            setRestockId(null);
            setRestockQty('');
            fetchIngredients();
            if (selectedProduct) fetchRecipe(selectedProduct.id);
        } catch { }
        finally { setRestocking(false); }
    };

    const handleAddToRecipe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !addIngId || !addQty) return;
        setRecipeSubmitting(true);
        try {
            await apiClient.post(`${API_ENDPOINTS.RECIPES}/${selectedProduct.id}`, {
                ingredient_id: addIngId,
                quantity_required: Number(addQty)
            });
            setAddIngId('');
            setAddQty('');
            fetchRecipe(selectedProduct.id);
        } catch { }
        finally { setRecipeSubmitting(false); }
    };

    const handleRemoveFromRecipe = async (ingredientId: string) => {
        if (!selectedProduct) return;
        try {
            await apiClient.delete(`${API_ENDPOINTS.RECIPES}/${selectedProduct.id}/${ingredientId}`);
            fetchRecipe(selectedProduct.id);
        } catch { }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Recipe Inventory</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Track ingredient stock and define product recipes.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowAddIng(true); setEditIng(null);
                        setIngForm({ name: '', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '', conversion_multiple: '', conversion_size: '' });
                    }}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        border: 'none', color: 'white', padding: '0.6rem 1.2rem',
                        borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}>
                    <Plus size={18} /> Add Ingredient
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <SummaryCard icon={<Package size={20} />} label="Total Ingredients" value={summary.total}
                    color="#8b5cf6" bg="rgba(139,92,246,0.08)" />
                <SummaryCard icon={<AlertTriangle size={20} />} label="Low Stock" value={summary.low}
                    color="var(--status-warning)" bg="rgba(245,158,11,0.08)" />
                <SummaryCard icon={<Package size={20} />} label="Out of Stock" value={summary.out}
                    color="var(--status-danger)" bg="rgba(239,68,68,0.08)" />
                <SummaryCard icon={<Clock size={20} />} label="Expiring in 14 days" value={summary.expiring}
                    color="#f59e0b" bg="rgba(245,158,11,0.06)" />
            </div>

            {/* ── Main Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* ── LEFT: Ingredient Inventory Table ── */}
                <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🧂 Ingredient Stock
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
                                {filteredIngredients.length} items
                            </span>
                        </h3>
                        {/* Search */}
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search ingredients…"
                            style={{
                                padding: '0.45rem 0.85rem',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.82rem',
                                outline: 'none',
                                width: '180px',
                            }}
                        />
                    </div>

                    {ingLoading ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Loading...</p>
                    ) : filteredIngredients.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                            {ingredients.length === 0 ? 'No ingredients yet. Add one to get started.' : 'No results found.'}
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 500 }}>Ingredient</th>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 500 }}>Batch</th>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 500 }}>Stock</th>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 500 }}>Cost</th>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 500 }}>Expiry</th>
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 500 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIngredients.map(ing => {
                                        const status = stockStatus(ing.stock_quantity, ing.min_stock_level);
                                        const expSoon = isSoonExpiry(ing.expiry_date);
                                        const isRestocking = restockId === ing.id;
                                        return (
                                            <>
                                                <tr key={ing.id} style={{
                                                    borderBottom: isRestocking ? 'none' : '1px solid var(--glass-border-light)',
                                                    background: isRestocking ? 'rgba(139,92,246,0.06)' : 'transparent',
                                                    transition: 'background 0.2s',
                                                }}>
                                                    {/* Name */}
                                                    <td style={{ padding: '0.7rem 0.6rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                background: STATUS_COLOR[status], flexShrink: 0,
                                                                boxShadow: `0 0 4px ${STATUS_COLOR[status]}`
                                                            }} />
                                                            <span style={{ fontWeight: 500 }}>{ing.name}</span>
                                                        </div>
                                                        {ing.min_stock_level > 0 && (
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem', paddingLeft: '1.25rem' }}>
                                                                Min: {ing.min_stock_level} {ing.unit}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {/* Batch */}
                                                    <td style={{ padding: '0.7rem 0.6rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                        {ing.batch_number || 'Main'}
                                                    </td>
                                                    {/* Stock qty */}
                                                    <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: STATUS_COLOR[status],
                                                            background: STATUS_BG[status],
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.82rem',
                                                        }}>
                                                            {ing.stock_quantity} {ing.unit}
                                                        </span>
                                                    </td>
                                                    {/* Cost */}
                                                    <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                        ₱{Number(ing.cost_per_unit).toFixed(2)}/{ing.unit}
                                                    </td>
                                                    {/* Expiry */}
                                                    <td style={{ padding: '0.7rem 0.6rem', textAlign: 'center' }}>
                                                        {ing.expiry_date ? (
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                padding: '2px 7px',
                                                                borderRadius: '6px',
                                                                background: expSoon ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.06)',
                                                                color: expSoon ? 'var(--status-warning)' : 'var(--text-muted)',
                                                                whiteSpace: 'nowrap',
                                                            }}>
                                                                {expSoon ? '⚠ ' : ''}{new Date(ing.expiry_date + 'T00:00:00').toLocaleDateString()}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                                        )}
                                                    </td>
                                                    {/* Actions */}
                                                    <td style={{ padding: '0.7rem 0.6rem', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                            {/* Restock toggle */}
                                                            <button
                                                                onClick={() => {
                                                                    setRestockId(isRestocking ? null : ing.id);
                                                                    setRestockQty('');
                                                                }}
                                                                title="Restock"
                                                                style={{
                                                                    background: isRestocking ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
                                                                    border: '1px solid rgba(16,185,129,0.35)',
                                                                    color: 'var(--status-success)',
                                                                    borderRadius: 'var(--border-radius-sm)',
                                                                    padding: '0.3rem 0.5rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center',
                                                                }}>
                                                                <PlusCircle size={13} />
                                                            </button>
                                                            <button onClick={() => openEditIng(ing)} title="Edit"
                                                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--accent-primary)', borderRadius: 'var(--border-radius-sm)', padding: '0.3rem 0.5rem', cursor: 'pointer' }}>
                                                                ✏️
                                                            </button>
                                                            <button onClick={() => handleDeleteIng(ing.id, ing.name)} title="Delete"
                                                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-danger)', borderRadius: 'var(--border-radius-sm)', padding: '0.3rem 0.5rem', cursor: 'pointer' }}>
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Inline Restock Row */}
                                                {isRestocking && (
                                                    <tr key={`${ing.id}-restock`} style={{ borderBottom: '1px solid var(--glass-border-light)', background: 'rgba(16,185,129,0.04)' }}>
                                                        <td colSpan={5} style={{ padding: '0.5rem 0.8rem 0.8rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                <RefreshCw size={13} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                                    Add to stock ({ing.unit}):
                                                                </span>
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    min="0.001"
                                                                    step="any"
                                                                    value={restockQty}
                                                                    onChange={e => setRestockQty(e.target.value)}
                                                                    placeholder={`Amount in ${ing.unit}`}
                                                                    style={{
                                                                        padding: '0.4rem 0.7rem',
                                                                        background: 'rgba(0,0,0,0.25)',
                                                                        border: '1px solid rgba(16,185,129,0.4)',
                                                                        borderRadius: '8px',
                                                                        color: 'white',
                                                                        fontSize: '0.85rem',
                                                                        outline: 'none',
                                                                        width: '160px',
                                                                    }}
                                                                    onKeyDown={e => { if (e.key === 'Enter') handleRestock(ing); }}
                                                                />
                                                                <button
                                                                    disabled={restocking || !restockQty}
                                                                    onClick={() => handleRestock(ing)}
                                                                    style={{
                                                                        background: 'var(--status-success)',
                                                                        border: 'none',
                                                                        borderRadius: '8px',
                                                                        color: 'white',
                                                                        padding: '0.4rem 0.9rem',
                                                                        cursor: restocking || !restockQty ? 'not-allowed' : 'pointer',
                                                                        fontWeight: 600,
                                                                        fontSize: '0.82rem',
                                                                        opacity: restocking || !restockQty ? 0.6 : 1,
                                                                    }}>
                                                                    {restocking ? 'Saving…' : 'Restock'}
                                                                </button>
                                                                <button
                                                                    onClick={() => { setRestockId(null); setRestockQty(''); }}
                                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem' }}>
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Recipe Builder ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BookOpen size={18} /> Recipe Builder
                        </h3>

                        {/* Searchable product selector */}
                        <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search product…"
                                    value={productSearch || (selectedProduct ? `${selectedProduct.name}${selectedProduct.size ? ` • ${selectedProduct.size}` : ''}${selectedProduct.unit_of_measure ? ` (${selectedProduct.unit_of_measure})` : ''}` : '')}
                                    onChange={e => {
                                        setProductSearch(e.target.value);
                                        setShowProductDropdown(true);
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
                                    style={{
                                        ...inputStyle,
                                        paddingRight: '2.5rem',
                                        cursor: 'text',
                                        color: productSearch ? 'white' : 'var(--text-muted)',
                                    }}
                                />
                                <ChevronDown
                                    size={16}
                                    style={{
                                        position: 'absolute', right: '0.85rem', top: '50%',
                                        transform: `translateY(-50%) rotate(${showProductDropdown ? 180 : 0}deg)`,
                                        color: 'var(--text-muted)', pointerEvents: 'none',
                                        transition: 'transform 0.2s',
                                    }}
                                />
                            </div>

                            {/* Dropdown list */}
                            {showProductDropdown && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                    background: '#1a1d27',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '10px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    zIndex: 200,
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                }}>
                                    {/* Clear selection option */}
                                    <div
                                        onMouseDown={() => {
                                            setSelectedProduct(null);
                                            setRecipe([]);
                                            setProductSearch('');
                                            setShowProductDropdown(false);
                                        }}
                                        style={{
                                            padding: '0.6rem 0.85rem',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--glass-border-light)',
                                        }}
                                    >
                                        — Clear selection —
                                    </div>

                                    {products
                                        .filter(p => {
                                            const query = productSearch.toLowerCase();
                                            return p.name.toLowerCase().includes(query) ||
                                                p.unit_of_measure.toLowerCase().includes(query) ||
                                                (p.size || '').toLowerCase().includes(query);
                                        })
                                        .map(p => (
                                            <div
                                                key={p.id}
                                                onMouseDown={() => {
                                                    handleSelectProduct(p);
                                                    setProductSearch('');
                                                    setShowProductDropdown(false);
                                                }}
                                                style={{
                                                    padding: '0.6rem 0.85rem',
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer',
                                                    background: selectedProduct?.id === p.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                                                    color: selectedProduct?.id === p.id ? 'var(--accent-primary)' : 'white',
                                                    borderBottom: '1px solid var(--glass-border-light)',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = selectedProduct?.id === p.id ? 'rgba(139,92,246,0.15)' : 'transparent')}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>{p.name}</span>
                                                    {(p.size || p.unit_of_measure) && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                                            {p.size ? `• ${p.size}` : ''}
                                                            {p.size && p.unit_of_measure ? ' ' : ''}
                                                            {p.unit_of_measure ? `(${p.unit_of_measure})` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                    {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '0.75rem 0.85rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            No products match "{productSearch}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!selectedProduct ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
                                Select a product above to view or edit its recipe.
                            </p>
                        ) : (
                            <>
                                {/* Can-make badge */}
                                {canMake !== null && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        padding: '0.6rem 0.9rem',
                                        borderRadius: '10px',
                                        marginBottom: '1rem',
                                        background: canMake === 0
                                            ? 'rgba(239,68,68,0.12)'
                                            : canMake <= 5
                                                ? 'rgba(245,158,11,0.12)'
                                                : 'rgba(16,185,129,0.12)',
                                        border: `1px solid ${canMake === 0
                                            ? 'rgba(239,68,68,0.3)'
                                            : canMake <= 5
                                                ? 'rgba(245,158,11,0.3)'
                                                : 'rgba(16,185,129,0.3)'}`,
                                    }}>
                                        <span style={{ fontSize: '1.3rem' }}>
                                            {canMake === 0 ? '🚫' : canMake <= 5 ? '⚠️' : '✅'}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                color: canMake === 0
                                                    ? 'var(--status-danger)'
                                                    : canMake <= 5
                                                        ? 'var(--status-warning)'
                                                        : 'var(--status-success)'
                                            }}>
                                                Can make <span style={{ fontSize: '1.2rem' }}>{canMake}</span> unit{canMake !== 1 ? 's' : ''}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                of <strong style={{ color: 'white' }}>{selectedProduct.name}</strong> with current stock
                                            </div>
                                        </div>
                                        <div style={{
                                            textAlign: 'right',
                                            padding: '0.5rem 0.8rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '8px',
                                            borderLeft: '1px solid var(--glass-border-light)'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cost per unit</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                                                ₱{recipeCost.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Existing recipe list */}
                                {recipeLoading ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Loading recipe...</p>
                                ) : recipe.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', padding: '0.5rem 0 1rem', fontSize: '0.9rem' }}>
                                        No recipe defined yet for <strong>{selectedProduct.name}</strong>. Add ingredients below.
                                    </p>
                                ) : (
                                    <div style={{ marginBottom: '1.2rem' }}>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
                                            Per 1 unit of <strong style={{ color: 'white' }}>{selectedProduct.name}</strong> sold:
                                        </p>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                    <th style={{ padding: '0.45rem 0.4rem', textAlign: 'left', fontWeight: 500 }}>Ingredient</th>
                                                    <th style={{ padding: '0.45rem 0.4rem', textAlign: 'right', fontWeight: 500 }}>Qty / Unit</th>
                                                    <th style={{ padding: '0.45rem 0.4rem', textAlign: 'right', fontWeight: 500 }}>In Stock</th>
                                                    <th style={{ padding: '0.45rem 0.4rem' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recipe.map(row => {
                                                    const s = row.ingredients.stock_quantity;
                                                    const canMakeThis = row.quantity_required > 0 ? Math.floor(s / row.quantity_required) : Infinity;
                                                    const isLimiting = canMake !== null && canMakeThis === canMake && canMake < Infinity;
                                                    return (
                                                        <tr key={row.id} style={{
                                                            borderBottom: '1px solid var(--glass-border-light)',
                                                            background: isLimiting ? 'rgba(239,68,68,0.05)' : 'transparent',
                                                        }}>
                                                            <td style={{ padding: '0.6rem 0.4rem', fontWeight: 500 }}>
                                                                {row.ingredients.name}
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                                {row.quantity_required} {row.ingredients.unit}
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', fontSize: '0.85rem' }}>
                                                                <span style={{
                                                                    color: s <= 0 ? 'var(--status-danger)' : s <= row.quantity_required * 5 ? 'var(--status-warning)' : 'var(--status-success)',
                                                                    fontWeight: 600,
                                                                }}>
                                                                    {s} {row.ingredients.unit}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                                                                <button onClick={() => handleRemoveFromRecipe(row.ingredient_id)} title="Remove"
                                                                    style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: '0.2rem' }}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* ── Build / Prepare Recipe ── */}
                                <div style={{
                                    borderTop: '1px solid var(--glass-border)',
                                    paddingTop: '1rem',
                                    marginBottom: '0.5rem',
                                }}>
                                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        🛠️ Build / Prepare Recipe
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px' }}>
                                            <label style={{ ...labelStyle, margin: 0, whiteSpace: 'nowrap' }}>Batches:</label>
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={buildQty}
                                                onChange={e => setBuildQty(e.target.value)}
                                                style={{ ...inputStyle, width: '90px' }}
                                            />
                                        </div>
                                        <button
                                            onClick={handleBuildRecipe}
                                            disabled={building || recipe.length === 0 || canMake === 0}
                                            style={{
                                                padding: '0.65rem 1.2rem',
                                                background: (building || recipe.length === 0 || canMake === 0)
                                                    ? 'rgba(0,0,0,0.07)'
                                                    : 'linear-gradient(135deg, #10b981, #059669)',
                                                border: 'none',
                                                borderRadius: 'var(--border-radius-md)',
                                                color: (building || recipe.length === 0 || canMake === 0) ? 'var(--text-muted)' : 'white',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',
                                                cursor: (building || recipe.length === 0 || canMake === 0) ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {building ? (
                                                <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Building…</>
                                            ) : (
                                                <>✅ Build Recipe</>
                                            )}
                                        </button>
                                    </div>
                                    {buildMessage && (
                                        <div style={{
                                            marginTop: '0.65rem',
                                            padding: '0.55rem 0.9rem',
                                            borderRadius: '8px',
                                            fontSize: '0.84rem',
                                            background: buildMessage.toLowerCase().includes('fail') || buildMessage.toLowerCase().includes('error')
                                                ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                                            color: buildMessage.toLowerCase().includes('fail') || buildMessage.toLowerCase().includes('error')
                                                ? 'var(--status-danger)' : 'var(--status-success)',
                                            border: `1px solid ${buildMessage.toLowerCase().includes('fail') || buildMessage.toLowerCase().includes('error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                        }}>
                                            {buildMessage}
                                        </div>
                                    )}
                                </div>

                                {/* Add ingredient to recipe */}
                                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>+ Add ingredient to recipe</p>
                                    <form onSubmit={handleAddToRecipe} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={labelStyle}>Ingredient</label>
                                            {/* Searchable ingredient combobox */}
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    placeholder={
                                                        addIngId
                                                            ? ingredients.find(i => i.id === addIngId)?.name + ' (' + ingredients.find(i => i.id === addIngId)?.unit + ')'
                                                            : '🔍 Search ingredient…'
                                                    }
                                                    value={ingSearch}
                                                    onChange={e => {
                                                        setIngSearch(e.target.value);
                                                        setShowIngDropdown(true);
                                                        if (e.target.value === '') setAddIngId('');
                                                    }}
                                                    onFocus={() => setShowIngDropdown(true)}
                                                    onBlur={() => setTimeout(() => setShowIngDropdown(false), 150)}
                                                    style={{
                                                        ...inputStyle,
                                                        paddingRight: '2rem',
                                                        color: ingSearch ? 'white' : 'var(--text-muted)',
                                                    }}
                                                />
                                                <ChevronDown size={14} style={{
                                                    position: 'absolute', right: '0.7rem', top: '50%',
                                                    transform: `translateY(-50%) rotate(${showIngDropdown ? 180 : 0}deg)`,
                                                    color: 'var(--text-muted)', pointerEvents: 'none',
                                                    transition: 'transform 0.2s',
                                                }} />

                                                {showIngDropdown && (
                                                    <div style={{
                                                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                                        background: '#1a1d27',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '10px',
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                                        zIndex: 300,
                                                        maxHeight: '180px',
                                                        overflowY: 'auto',
                                                    }}>
                                                        {ingredients
                                                            .filter(ing => !recipe.find(r => r.ingredient_id === ing.id))
                                                            .filter(ing =>
                                                                ing.name.toLowerCase().includes(ingSearch.toLowerCase()) ||
                                                                (ing.batch_number && ing.batch_number.toLowerCase().includes(ingSearch.toLowerCase()))
                                                            )
                                                            .map(ing => (
                                                                <div
                                                                    key={ing.id}
                                                                    onMouseDown={() => {
                                                                        setAddIngId(ing.id);
                                                                        setIngSearch('');
                                                                        setShowIngDropdown(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '0.55rem 0.85rem',
                                                                        fontSize: '0.85rem',
                                                                        cursor: 'pointer',
                                                                        background: addIngId === ing.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                                                                        color: addIngId === ing.id ? 'var(--accent-primary)' : 'white',
                                                                        borderBottom: '1px solid var(--glass-border-light)',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                    }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = addIngId === ing.id ? 'rgba(139,92,246,0.15)' : 'transparent')}
                                                                >
                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <span>{ing.name}</span>
                                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                            Batch: {ing.batch_number || 'Main'}
                                                                        </span>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                        {ing.stock_quantity} {ing.unit} left
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        {ingredients
                                                            .filter(ing => !recipe.find(r => r.ingredient_id === ing.id))
                                                            .filter(ing => ing.name.toLowerCase().includes(ingSearch.toLowerCase()))
                                                            .length === 0 && (
                                                                <div style={{ padding: '0.65rem 0.85rem', fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                                    {ingSearch ? `No match for "${ingSearch}"` : 'All ingredients added'}
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>Qty per unit</label>
                                            <input required type="number" min="0.001" step="any"
                                                value={addQty} onChange={e => setAddQty(e.target.value)}
                                                placeholder="e.g. 30" style={inputStyle} />
                                        </div>
                                        <button type="submit" disabled={recipeSubmitting} style={{
                                            padding: '0.65rem 1rem',
                                            background: 'var(--accent-primary)',
                                            border: 'none', borderRadius: 'var(--border-radius-md)',
                                            color: 'white', cursor: recipeSubmitting ? 'not-allowed' : 'pointer',
                                            fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                                        }}>
                                            {recipeSubmitting ? '...' : <><Plus size={15} style={{ verticalAlign: 'middle' }} /> Add</>}
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Add/Edit Ingredient Modal ── */}
            {showAddIng && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{editIng ? 'Edit Ingredient' : 'New Ingredient'}</h3>
                            <button onClick={() => { setShowAddIng(false); setEditIng(null); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveIng} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>Ingredient Name *</label>
                                    <input required style={inputStyle} value={ingForm.name}
                                        onChange={e => setIngForm({ ...ingForm, name: e.target.value })}
                                        placeholder="e.g. Espresso, Whole Milk" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Unit *</label>
                                    <select
                                        required
                                        style={{
                                            ...inputStyle,
                                            appearance: 'none',
                                            cursor: 'pointer',
                                            background: 'rgba(0,0,0,0.2)'
                                        }}
                                        value={ingForm.unit}
                                        onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}
                                    >
                                        <option value="" disabled style={{ background: '#1e1e30', color: 'white' }}>Select unit...</option>
                                        <option value="pcs" style={{ background: '#1e1e30', color: 'white' }}>pcs</option>
                                        <option value="cups" style={{ background: '#1e1e30', color: 'white' }}>cups</option>
                                        <option value="oz" style={{ background: '#1e1e30', color: 'white' }}>oz</option>
                                        <option value="g" style={{ background: '#1e1e30', color: 'white' }}>g</option>
                                        <option value="ml" style={{ background: '#1e1e30', color: 'white' }}>ml</option>
                                        <option value="kg" style={{ background: '#1e1e30', color: 'white' }}>kg</option>
                                        <option value="Slice" style={{ background: '#1e1e30', color: 'white' }}>Slice</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Stock Quantity</label>
                                    <input type="number" min="0" step="0.01" style={inputStyle}
                                        value={ingForm.stock_quantity}
                                        onChange={e => setIngForm({ ...ingForm, stock_quantity: e.target.value })}
                                        placeholder="0" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Min Stock Level</label>
                                    <input type="number" min="0" step="0.01" style={inputStyle}
                                        value={ingForm.min_stock_level}
                                        onChange={e => setIngForm({ ...ingForm, min_stock_level: e.target.value })}
                                        placeholder="0" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Cost per Unit (₱)</label>
                                    <input type="number" min="0" step="0.01" style={inputStyle}
                                        value={ingForm.cost_per_unit}
                                        onChange={e => setIngForm({ ...ingForm, cost_per_unit: e.target.value })}
                                        placeholder="0.00" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Expiry Date (Optional)</label>
                                    <input type="date" style={inputStyle} value={ingForm.expiry_date}
                                        onChange={e => setIngForm({ ...ingForm, expiry_date: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Batch Number</label>
                                    <input style={inputStyle} value={ingForm.batch_number}
                                        onChange={e => setIngForm({ ...ingForm, batch_number: e.target.value })}
                                        placeholder="e.g. B-001, Main" />
                                </div>
                                <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>📦 UNIT CONVERTER (STOCKS)</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Multiples (e.g. 5 cartons)</label>
                                            <input type="number" step="any" style={inputStyle}
                                                value={ingForm.conversion_multiple}
                                                onChange={e => {
                                                    const m = e.target.value;
                                                    const s = ingForm.conversion_size;
                                                    const total = (parseFloat(m) || 0) * (parseFloat(s) || 0);
                                                    setIngForm({
                                                        ...ingForm,
                                                        conversion_multiple: m,
                                                        stock_quantity: total > 0 ? String(total) : ingForm.stock_quantity
                                                    });
                                                }}
                                                placeholder="Qty" />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Size per unit (e.g. 50ml)</label>
                                            <input type="number" step="any" style={inputStyle}
                                                value={ingForm.conversion_size}
                                                onChange={e => {
                                                    const s = e.target.value;
                                                    const m = ingForm.conversion_multiple;
                                                    const total = (parseFloat(m) || 0) * (parseFloat(s) || 0);
                                                    setIngForm({
                                                        ...ingForm,
                                                        conversion_size: s,
                                                        stock_quantity: total > 0 ? String(total) : ingForm.stock_quantity
                                                    });
                                                }}
                                                placeholder="Size" />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Result: {(parseFloat(ingForm.conversion_multiple) || 0) * (parseFloat(ingForm.conversion_size) || 0)} {ingForm.unit || 'units'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => { setShowAddIng(false); setEditIng(null); }}
                                    style={{ padding: '0.7rem 1.4rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'white', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={ingSubmitting}
                                    style={{ padding: '0.7rem 1.4rem', background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--border-radius-md)', color: 'white', cursor: ingSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                                    {ingSubmitting ? 'Saving...' : editIng ? 'Save Changes' : 'Add Ingredient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recipes;


