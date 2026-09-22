import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, BookOpen, ChevronDown, Package, AlertTriangle, Clock, PlusCircle, RefreshCw, Layers, Pencil, Calculator } from 'lucide-react';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
    id: string;
    name: string;
    category?: string;
    unit: string;
    stock_quantity: number;
    min_stock_level: number;
    cost_per_unit: number;
    expiry_date?: string;
    batch_number?: string;
    received_date?: string;
    parent_id?: string;
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
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1.5px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--text-primary)',
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

import { getEffectiveUnitCost } from '../lib/utils';
export { getEffectiveUnitCost };

// ── Helper: stock status ──────────────────────────────────────────────────────

function stockStatus(current: number, min: number): 'danger' | 'warning' | 'ok' {
    if (current <= 0) return 'danger';
    if (current <= min) return 'warning';
    return 'ok';
}

function inferIngredientCategory(name: string): string {
    const n = (name || '').toLowerCase();
    if (['espresso', 'coffee', 'bean', 'roast', 'decaf', 'arabica', 'robusta', 'shot'].some(k => n.includes(k))) return 'Coffee & Espresso';
    if (['tea', 'brew', 'matcha', 'chamomile', 'jasmine', 'earl grey'].some(k => n.includes(k))) return 'Tea & Brews';
    if (['milk', 'cream', 'dairy', 'condensed', 'evaporated', 'cheese', 'butter', 'whip'].some(k => n.includes(k))) return 'Dairy & Milk';
    if (['syrup', 'caramel', 'vanilla', 'hazelnut', 'sugar', 'flavor', 'sauce', 'purée', 'puree', 'honey', 'sweetener', 'chocolate'].some(k => n.includes(k))) return 'Syrups & Flavors';
    if (['pastry', 'bread', 'bun', 'patty', 'meat', 'cake', 'cookie', 'bacon', 'biscuit', 'croissant', 'sandwich', 'ham', 'egg', 'flour', 'nori', 'aonori', 'flake', 'bonito'].some(k => n.includes(k))) return 'Pastries & Food';
    if (['ice', 'soda', 'powder', 'beverage', 'water', 'boba', 'pearl', 'jelly', 'tapioca', 'smoothie'].some(k => n.includes(k))) return 'Ice & Beverages';
    if (['straw', 'cup', 'lid', 'box', 'packaging', 'wrapper', 'paper', 'bag', 'napkin', 'container', 'takeout'].some(k => n.includes(k))) return 'Packaging & Supplies';
    return 'General';
}

function getCategory(ing: { category?: string; name: string }): string {
    if (ing.category) return ing.category;
    return inferIngredientCategory(ing.name);
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

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
    'Coffee & Espresso': { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706' },
    'Tea & Brews': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' },
    'Dairy & Milk': { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' },
    'Syrups & Flavors': { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' },
    'Pastries & Food': { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' },
    'Ice & Beverages': { bg: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' },
    'Packaging & Supplies': { bg: 'rgba(107, 114, 128, 0.12)', color: '#6b7280' },
    'General': { bg: 'rgba(156, 163, 175, 0.12)', color: '#9ca3af' },
};

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
        name: '', category: 'General', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '', received_date: '',
        conversion_multiple: '', conversion_size: ''
    });
    const [ingSubmitting, setIngSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Category Filter & Recipe Usage Mapping
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [recipeUsages, setRecipeUsages] = useState<Record<string, string[]>>({});

    // Multi-Batch: source ingredient when opening modal in "new batch" mode
    const [batchSourceIng, setBatchSourceIng] = useState<Ingredient | null>(null);

    // Expiry auto-delete banner
    const [expiredBanner, setExpiredBanner] = useState<{ name: string; quantity: number }[]>([]);

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
        fetchIngredientsAndCheckExpiry();
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

    const fetchIngredientsAndCheckExpiry = async () => {
        setIngLoading(true);
        try {
            const data = await apiClient.get(API_ENDPOINTS.INGREDIENTS);
            setIngredients(Array.isArray(data) ? data : []);
        } catch { }
        finally { setIngLoading(false); }

        // After ingredients load, run server-side expiry check
        try {
            const result = await apiClient.post<{ removed: { id: string; name: string; quantity: number }[] }>(
                API_ENDPOINTS.EXPIRE_CHECK
            );
            if (result?.removed?.length > 0) {
                // Remove expired IDs from local state immediately
                const removedIds = new Set(result.removed.map(r => r.id));
                setIngredients(prev => prev.filter(i => !removedIds.has(i.id)));
                // Show the dismissible banner
                setExpiredBanner(result.removed);
                // Auto-dismiss after 8 seconds
                setTimeout(() => setExpiredBanner([]), 8000);
            }
        } catch {
            // Silently ignore expire-check errors — non-critical
        }
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

        // Calculate total cost per unit with effective unit cost
        let totalCost = 0;
        for (const row of recipe) {
            const costPerUnit = row.ingredients.cost_per_unit || 0;
            const unit = row.ingredients.unit || '';
            const qty = row.quantity_required || 0;
            totalCost += getEffectiveUnitCost(unit, costPerUnit) * qty;
        }
        setRecipeCost(totalCost);

        return minServable === Infinity ? 0 : minServable;
    }, [recipe, selectedProduct]);

    // ── Filtered ingredients ─────────────────────────────────────────────────

    const filteredIngredients = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return ingredients.filter(i => {
            const cat = getCategory(i);
            const ingUsages = recipeUsages[i.id]
                || (i.parent_id ? recipeUsages[i.parent_id] : [])
                || recipeUsages[i.name.toLowerCase().trim()]
                || [];

            const matchesSearch = !q || (
                i.name.toLowerCase().includes(q) ||
                i.unit.toLowerCase().includes(q) ||
                cat.toLowerCase().includes(q) ||
                (i.batch_number && i.batch_number.toLowerCase().includes(q)) ||
                ingUsages.some(r => r.toLowerCase().includes(q))
            );
            const matchesCategory = selectedCategory === 'ALL' || cat === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [ingredients, searchQuery, selectedCategory, recipeUsages]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSelectProduct = (p: Product) => {
        setSelectedProduct(p);
        setAddIngId('');
        setAddQty('');
        fetchRecipe(p.id);
    };

    const validateIngForm = (): boolean => {
        const errors: Record<string, string> = {};

        const name = ingForm.name.trim();
        if (!name) {
            errors.name = 'Ingredient name is required.';
        } else if (name.length < 2 || name.length > 50) {
            errors.name = 'Name must be between 2 and 50 characters.';
        } else if (!/[a-zA-Z]/.test(name)) {
            errors.name = 'Name must contain letters (e.g. Arabica Beans, Whole Milk).';
        }

        if (!batchSourceIng) {
            const unit = ingForm.unit.trim();
            if (!unit) errors.unit = 'Please select a unit.';
            else if (unit.length > 20) errors.unit = 'Unit must not exceed 20 characters.';
        }

        const stockStr = String(ingForm.stock_quantity).trim();
        if (stockStr !== '') {
            const stock = Number(stockStr);
            if (isNaN(stock)) errors.stock_quantity = 'Stock quantity must be a valid number.';
            else if (stock < 0) errors.stock_quantity = 'Stock quantity cannot be negative.';
            else if (stock > 50000) errors.stock_quantity = 'Stock quantity cannot exceed 50,000.';
        }

        const minStockStr = String(ingForm.min_stock_level).trim();
        if (minStockStr !== '') {
            const minStock = Number(minStockStr);
            if (isNaN(minStock)) errors.min_stock_level = 'Min stock level must be a valid number.';
            else if (minStock < 0) errors.min_stock_level = 'Min stock level cannot be negative.';
            else if (minStock > 10000) errors.min_stock_level = 'Min stock level cannot exceed 10,000.';
        }

        const costStr = String(ingForm.cost_per_unit).trim();
        if (costStr !== '') {
            const cost = Number(costStr);
            if (isNaN(cost)) errors.cost_per_unit = 'Cost per unit must be a valid number.';
            else if (cost < 0) errors.cost_per_unit = 'Cost per unit cannot be negative.';
            else if (cost > 50000) errors.cost_per_unit = 'Cost per unit cannot exceed ₱50,000.';
        }

        if (ingForm.expiry_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxExpDate = new Date();
            maxExpDate.setFullYear(maxExpDate.getFullYear() + 5);

            const exp = new Date(ingForm.expiry_date + 'T00:00:00');
            if (isNaN(exp.getTime())) errors.expiry_date = 'Invalid date format.';
            else if (exp <= today) errors.expiry_date = 'Expiry date must be in the future.';
            else if (exp > maxExpDate) errors.expiry_date = 'Expiry date cannot exceed 5 years in advance.';
        }

        if (ingForm.received_date) {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const rec = new Date(ingForm.received_date + 'T00:00:00');
            const minPastDate = new Date();
            minPastDate.setFullYear(minPastDate.getFullYear() - 10);

            if (isNaN(rec.getTime())) errors.received_date = 'Invalid date format.';
            else if (rec > today) errors.received_date = 'Received date cannot be in the future.';
            else if (rec < minPastDate) errors.received_date = 'Received date cannot be older than 10 years.';

            if (ingForm.expiry_date) {
                const exp = new Date(ingForm.expiry_date + 'T00:00:00');
                if (!isNaN(exp.getTime()) && exp <= rec) {
                    errors.expiry_date = 'Expiry date must be after batch received date.';
                }
            }
        }

        const batchNum = ingForm.batch_number.trim();
        if (batchNum.length > 20) errors.batch_number = 'Batch number must not exceed 20 characters.';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveIng = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateIngForm()) return;
        setIngSubmitting(true);
        try {
            const body = {
                name: ingForm.name.trim(),
                category: ingForm.category || 'General',
                unit: ingForm.unit,
                stock_quantity: Number(ingForm.stock_quantity) || 0,
                min_stock_level: Number(ingForm.min_stock_level) || 0,
                cost_per_unit: Number(ingForm.cost_per_unit) || 0,
                expiry_date: ingForm.expiry_date || null,
                batch_number: ingForm.batch_number.trim() || 'Main',
                received_date: ingForm.received_date || null
            };
            if (editIng) {
                await apiClient.put(`${API_ENDPOINTS.INGREDIENTS}/${editIng.id}`, body);
            } else {
                await apiClient.post(API_ENDPOINTS.INGREDIENTS, body);
            }
            setShowAddIng(false);
            setEditIng(null);
            setBatchSourceIng(null);
            setFormErrors({});
            setIngForm({ name: '', category: 'General', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '', received_date: '', conversion_multiple: '', conversion_size: '' });
            fetchIngredients();
        } catch (err: any) {
            const serverMsg = err?.response?.data?.detail;
            if (serverMsg) {
                setFormErrors({ submit: typeof serverMsg === 'string' ? serverMsg : 'Failed to save ingredient.' });
            } else {
                setFormErrors({ submit: 'Failed to save ingredient. Please check your inputs.' });
            }
        } finally {
            setIngSubmitting(false);
        }
    };

    const openNewBatch = (ing: Ingredient) => {
        setBatchSourceIng(ing);
        setEditIng(null);
        setFormErrors({});
        setIngForm({
            name: ing.name,
            category: getCategory(ing),
            unit: ing.unit,
            stock_quantity: '',
            min_stock_level: String(ing.min_stock_level),
            cost_per_unit: '',
            expiry_date: '',
            batch_number: '',
            received_date: new Date().toISOString().split('T')[0],
            conversion_multiple: '',
            conversion_size: '',
        });
        setShowAddIng(true);
    };

    // Delete Ingredient modal
    const [deleteModalIng, setDeleteModalIng] = useState<{ id: string; name: string } | null>(null);

    const confirmDeleteIng = async () => {
        if (!deleteModalIng) return;
        setIngSubmitting(true);
        try {
            await apiClient.delete(`${API_ENDPOINTS.INGREDIENTS}/${deleteModalIng.id}`);
            setDeleteModalIng(null);
            fetchIngredients();
            if (selectedProduct) fetchRecipe(selectedProduct.id);
        } catch (err) {
            alert('Failed to delete ingredient.');
        } finally {
            setIngSubmitting(false);
        }
    };

    const openEditIng = (ing: Ingredient) => {
        setEditIng(ing);
        setBatchSourceIng(null);
        setFormErrors({});
        setIngForm({
            name: ing.name,
            category: getCategory(ing),
            unit: ing.unit,
            stock_quantity: String(ing.stock_quantity),
            min_stock_level: String(ing.min_stock_level),
            cost_per_unit: String(ing.cost_per_unit),
            expiry_date: ing.expiry_date || '',
            batch_number: ing.batch_number || '',
            received_date: ing.received_date || '',
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
                        setShowAddIng(true); setEditIng(null); setBatchSourceIng(null); setFormErrors({});
                        setIngForm({ name: '', category: 'General', unit: '', stock_quantity: '', min_stock_level: '', cost_per_unit: '', expiry_date: '', batch_number: '', received_date: new Date().toISOString().split('T')[0], conversion_multiple: '', conversion_size: '' });
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

            {/* ── Expiry Auto-Delete Banner ── */}
            {expiredBanner.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem 1.1rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '12px',
                    animation: 'fadeInDown 0.3s ease',
                }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        <strong style={{ color: '#f59e0b' }}>
                            {expiredBanner.length} expired ingredient{expiredBanner.length > 1 ? 's' : ''} auto-moved to Waste Log:
                        </strong>
                        {' '}
                        {expiredBanner.map(r => r.name).join(', ')}
                    </div>
                    <button
                        onClick={() => setExpiredBanner([])}
                        title="Dismiss"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.15rem',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                        }}>
                        <X size={16} />
                    </button>
                </div>
            )}

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* ── LEFT: Ingredient Inventory Table ── */}
                <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                    {/* Category Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {['ALL', 'Coffee & Espresso', 'Tea & Brews', 'Dairy & Milk', 'Syrups & Flavors', 'Pastries & Food', 'Ice & Beverages', 'Packaging & Supplies', 'General'].map(cat => {
                            const active = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                                        background: active ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-panel)',
                                        color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        transition: 'all 0.15s ease',
                                    }}>
                                    {cat === 'ALL' ? 'All Categories' : cat}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Ingredient Stock
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
                                {filteredIngredients.length} items
                            </span>
                        </h3>
                        {/* Search */}
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search ingredients or recipes…"
                            style={{
                                padding: '0.45rem 0.85rem',
                                background: 'var(--bg-panel)',
                                border: '1.5px solid var(--glass-border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none',
                                width: '220px',
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
                                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 500 }}>Category</th>
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
                                        const displayCat = getCategory(ing);
                                        const catStyle = CATEGORY_STYLE[displayCat] || CATEGORY_STYLE['General'];
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
                                                    {/* Category */}
                                                    <td style={{ padding: '0.7rem 0.6rem' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: catStyle.bg,
                                                            color: catStyle.color,
                                                            display: 'inline-block',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {displayCat}
                                                        </span>
                                                    </td>
                                                    {/* Batch */}
                                                    <td style={{ padding: '0.7rem 0.6rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                        <div style={{ fontWeight: 500 }}>{ing.batch_number || 'Main'}</div>
                                                        {ing.received_date && (
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                Rec: {new Date(ing.received_date + 'T00:00:00').toLocaleDateString()}
                                                            </div>
                                                        )}
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
                                                        ₱{getEffectiveUnitCost(ing.unit, ing.cost_per_unit).toFixed(2)}/{ing.unit}
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
                                                                title="Quick Restock"
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
                                                            {/* New Batch */}
                                                            <button
                                                                onClick={() => openNewBatch(ing)}
                                                                title="New Batch"
                                                                style={{
                                                                    background: 'rgba(99,102,241,0.1)',
                                                                    border: '1px solid rgba(99,102,241,0.35)',
                                                                    color: '#6366f1',
                                                                    borderRadius: 'var(--border-radius-sm)',
                                                                    padding: '0.3rem 0.5rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center',
                                                                }}>
                                                                <Layers size={13} />
                                                            </button>
                                                            <button onClick={() => openEditIng(ing)} title="Edit"
                                                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--accent-primary)', borderRadius: 'var(--border-radius-sm)', padding: '0.3rem 0.5rem', cursor: 'pointer' }}>
                                                                ✏️
                                                            </button>
                                                            <button onClick={() => setDeleteModalIng({ id: ing.id, name: ing.name })} title="Delete"
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
            </div>

            {/* ── Add/Edit Ingredient Modal ── */}
            {showAddIng && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>
                                {editIng ? 'Edit Ingredient'
                                    : batchSourceIng ? <><Layers size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem', color: '#6366f1' }} />New Batch — {batchSourceIng.name}</>
                                    : 'New Ingredient'}
                            </h3>
                            <button onClick={() => { setShowAddIng(false); setEditIng(null); setBatchSourceIng(null); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>
                        {/* New Batch hint strip */}
                        {batchSourceIng && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.55rem 0.85rem',
                                background: 'rgba(99,102,241,0.09)',
                                border: '1px solid rgba(99,102,241,0.25)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.8rem',
                                color: '#818cf8',
                            }}>
                                <Layers size={13} />
                                New separate batch row for <strong style={{ marginLeft: '0.2rem' }}>{batchSourceIng.name}</strong>. Name &amp; unit are locked to the parent.
                            </div>
                        )}
                        <form onSubmit={handleSaveIng} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {formErrors.submit && (
                                <div style={{
                                    padding: '0.6rem 0.85rem',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '8px',
                                    color: 'var(--status-danger)',
                                    fontSize: '0.82rem',
                                    fontWeight: 500
                                }}>
                                    {formErrors.submit}
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>Ingredient Name *</label>
                                    <input style={{
                                        ...inputStyle,
                                        ...(batchSourceIng ? { opacity: 0.65, cursor: 'not-allowed', background: 'rgba(0,0,0,0.08)' } : {}),
                                        ...(formErrors.name ? { borderColor: 'var(--status-danger)' } : {}),
                                    }} value={ingForm.name}
                                        maxLength={50}
                                        readOnly={!!batchSourceIng}
                                        onChange={e => {
                                            if (!batchSourceIng) {
                                                setIngForm({ ...ingForm, name: e.target.value });
                                                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                                            }
                                        }}
                                        placeholder="e.g. Espresso, Whole Milk" />
                                    {formErrors.name && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.name}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Category</label>
                                    <select
                                        disabled={!!batchSourceIng}
                                        style={{
                                            ...inputStyle,
                                            appearance: 'none',
                                            cursor: batchSourceIng ? 'not-allowed' : 'pointer',
                                            ...(batchSourceIng ? { opacity: 0.65, background: 'rgba(0,0,0,0.08)' } : {}),
                                        }}
                                        value={ingForm.category}
                                        onChange={e => setIngForm({ ...ingForm, category: e.target.value })}
                                    >
                                        <option value="Coffee & Espresso">Coffee &amp; Espresso</option>
                                        <option value="Tea & Brews">Tea &amp; Brews</option>
                                        <option value="Dairy & Milk">Dairy &amp; Milk</option>
                                        <option value="Syrups & Flavors">Syrups &amp; Flavors</option>
                                        <option value="Pastries & Food">Pastries &amp; Food</option>
                                        <option value="Ice & Beverages">Ice &amp; Beverages</option>
                                        <option value="Packaging & Supplies">Packaging &amp; Supplies</option>
                                        <option value="General">General</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Unit *</label>
                                    {batchSourceIng ? (
                                        <input style={{
                                            ...inputStyle,
                                            opacity: 0.65, cursor: 'not-allowed', background: 'rgba(0,0,0,0.08)'
                                        }} value={ingForm.unit} readOnly />
                                    ) : (
                                    <select
                                        style={{
                                            ...inputStyle,
                                            appearance: 'none',
                                            cursor: 'pointer',
                                            ...(formErrors.unit ? { borderColor: 'var(--status-danger)' } : {}),
                                        }}
                                        value={ingForm.unit}
                                        onChange={e => {
                                            setIngForm({ ...ingForm, unit: e.target.value });
                                            if (formErrors.unit) setFormErrors(prev => ({ ...prev, unit: '' }));
                                        }}
                                    >
                                        <option value="" disabled>Select unit...</option>
                                        <option value="pcs">pcs</option>
                                        <option value="cups">cups</option>
                                        <option value="oz">oz</option>
                                        <option value="g">g</option>
                                        <option value="ml">ml</option>
                                        <option value="kg">kg</option>
                                        <option value="Slice">Slice</option>
                                    </select>
                                    )}
                                    {formErrors.unit && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.unit}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Stock Quantity</label>
                                    <input type="number" min="0" max="50000" step="0.01" style={{
                                        ...inputStyle,
                                        ...(formErrors.stock_quantity ? { borderColor: 'var(--status-danger)' } : {}),
                                    }}
                                        value={ingForm.stock_quantity}
                                        onChange={e => {
                                            setIngForm({ ...ingForm, stock_quantity: e.target.value });
                                            if (formErrors.stock_quantity) setFormErrors(prev => ({ ...prev, stock_quantity: '' }));
                                        }}
                                        placeholder="0" />
                                    {formErrors.stock_quantity && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.stock_quantity}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Min Stock Level</label>
                                    <input type="number" min="0" max="10000" step="0.01" style={{
                                        ...inputStyle,
                                        ...(formErrors.min_stock_level ? { borderColor: 'var(--status-danger)' } : {}),
                                    }}
                                        value={ingForm.min_stock_level}
                                        onChange={e => {
                                            setIngForm({ ...ingForm, min_stock_level: e.target.value });
                                            if (formErrors.min_stock_level) setFormErrors(prev => ({ ...prev, min_stock_level: '' }));
                                        }}
                                        placeholder="0" />
                                    {formErrors.min_stock_level && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.min_stock_level}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Cost per Unit (₱)</label>
                                    <input type="number" min="0" max="50000" step="0.01" style={{
                                        ...inputStyle,
                                        ...(formErrors.cost_per_unit ? { borderColor: 'var(--status-danger)' } : {}),
                                    }}
                                        value={ingForm.cost_per_unit}
                                        onChange={e => {
                                            setIngForm({ ...ingForm, cost_per_unit: e.target.value });
                                            if (formErrors.cost_per_unit) setFormErrors(prev => ({ ...prev, cost_per_unit: '' }));
                                        }}
                                        placeholder="0.00" />
                                    {formErrors.cost_per_unit && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.cost_per_unit}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Expiry Date (Optional)</label>
                                    <input type="date" style={{
                                        ...inputStyle,
                                        ...(formErrors.expiry_date ? { borderColor: 'var(--status-danger)' } : {}),
                                    }} value={ingForm.expiry_date}
                                        onChange={e => {
                                            setIngForm({ ...ingForm, expiry_date: e.target.value });
                                            if (formErrors.expiry_date) setFormErrors(prev => ({ ...prev, expiry_date: '' }));
                                        }} />
                                    {formErrors.expiry_date && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.expiry_date}</div>}
                                </div>
                                                                  <div>
                                     <label style={labelStyle}>Batch</label>
                                     <input style={{
                                         ...inputStyle,
                                         ...(formErrors.batch_number ? { borderColor: 'var(--status-danger)' } : {}),
                                     }} value={ingForm.batch_number}
                                         maxLength={20}
                                         onChange={e => {
                                             setIngForm({ ...ingForm, batch_number: e.target.value });
                                             if (formErrors.batch_number) setFormErrors(prev => ({ ...prev, batch_number: '' }));
                                         }}
                                         placeholder="e.g. B-001, Main" />
                                     {formErrors.batch_number && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.batch_number}</div>}
                                 </div>
                                 <div>
                                     <label style={labelStyle}>Date Batch Arrived</label>
                                     <input type="date" style={{
                                         ...inputStyle,
                                         ...(formErrors.received_date ? { borderColor: 'var(--status-danger)' } : {}),
                                     }} value={ingForm.received_date}
                                         onChange={e => {
                                             setIngForm({ ...ingForm, received_date: e.target.value });
                                             if (formErrors.received_date) setFormErrors(prev => ({ ...prev, received_date: '' }));
                                         }} />
                                     {formErrors.received_date && <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '0.3rem' }}>{formErrors.received_date}</div>}
                                 </div>
                                <div style={{
                                    gridColumn: '1/-1',
                                    padding: '0.85rem 1rem',
                                    background: 'rgba(99, 102, 241, 0.04)',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.02em' }}>
                                            <Calculator size={15} />
                                            <span>UNIT CONVERTER (STOCKS)</span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Auto-fills Stock Quantity
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.72rem', fontWeight: 500 }}>Multiples (e.g. 5 cartons)</label>
                                            <input type="number" step="any" style={inputStyle}
                                                value={ingForm.conversion_multiple}
                                                onChange={e => {
                                                    const m = e.target.value;
                                                    const s = ingForm.conversion_size;
                                                    const total = (parseFloat(m) || 0) * (parseFloat(s) || 0);
                                                    setIngForm({
                                                        ...ingForm,
                                                        conversion_multiple: m,
                                                        stock_quantity: total > 0 ? String(total) : (m === '' && s === '' ? '' : ingForm.stock_quantity)
                                                    });
                                                }}
                                                placeholder="Qty (e.g. 5)" />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.72rem', fontWeight: 500 }}>Size per unit (e.g. 50ml)</label>
                                            <input type="number" step="any" style={inputStyle}
                                                value={ingForm.conversion_size}
                                                onChange={e => {
                                                    const s = e.target.value;
                                                    const m = ingForm.conversion_multiple;
                                                    const total = (parseFloat(m) || 0) * (parseFloat(s) || 0);
                                                    setIngForm({
                                                        ...ingForm,
                                                        conversion_size: s,
                                                        stock_quantity: total > 0 ? String(total) : (m === '' && s === '' ? '' : ingForm.stock_quantity)
                                                    });
                                                }}
                                                placeholder="Size (e.g. 50)" />
                                        </div>
                                    </div>
                                    {(() => {
                                        const mult = parseFloat(ingForm.conversion_multiple) || 0;
                                        const size = parseFloat(ingForm.conversion_size) || 0;
                                        const calculatedTotal = mult * size;
                                        const hasInputs = ingForm.conversion_multiple !== '' || ingForm.conversion_size !== '';
                                        const unitDisplay = ingForm.unit || 'units';

                                        return (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.65rem 0.85rem',
                                                background: hasInputs && calculatedTotal > 0 ? 'rgba(16, 185, 129, 0.09)' : 'rgba(0, 0, 0, 0.04)',
                                                border: hasInputs && calculatedTotal > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--glass-border)',
                                                borderRadius: '8px',
                                                transition: 'all 0.2s ease',
                                                marginTop: '0.1rem',
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                        Calculated Total Stock
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {hasInputs && mult > 0 && size > 0 ? `${mult} × ${size} ${unitDisplay}` : 'Enter quantity & unit size above'}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    fontSize: '1.1rem',
                                                    fontWeight: 700,
                                                    color: hasInputs && calculatedTotal > 0 ? '#10b981' : 'var(--text-muted)',
                                                    background: hasInputs && calculatedTotal > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                }}>
                                                    <span>{calculatedTotal}</span>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{unitDisplay}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => { setShowAddIng(false); setEditIng(null); setBatchSourceIng(null); }}
                                    style={{ padding: '0.7rem 1.4rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={ingSubmitting}
                                    style={{
                                        padding: '0.7rem 1.4rem',
                                        background: batchSourceIng
                                            ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                            : 'var(--accent-primary)',
                                        border: 'none', borderRadius: 'var(--border-radius-md)',
                                        color: 'white', cursor: ingSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600,
                                        boxShadow: batchSourceIng ? '0 4px 12px rgba(99,102,241,0.35)' : undefined,
                                    }}>
                                    {ingSubmitting ? 'Saving...'
                                        : editIng ? 'Save Changes'
                                        : batchSourceIng ? '+ Add Batch'
                                        : 'Add Ingredient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Ingredient Confirmation Modal */}
            {deleteModalIng && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        maxWidth: '440px',
                        width: '100%',
                        color: '#1F2937',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.2), 0 0 25px rgba(239, 68, 68, 0.1)',
                        position: 'relative',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '3.5rem',
                            height: '3.5rem',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem auto'
                        }}>
                            <Trash2 style={{ width: '1.75rem', height: '1.75rem' }} />
                        </div>

                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                            Delete Ingredient?
                        </h3>

                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6B7280', lineHeight: '1.5' }}>
                            Are you sure you want to delete <strong style={{ color: '#111827' }}>"{deleteModalIng.name}"</strong>? This will also remove it from all product recipes.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteModalIng(null)}
                                disabled={ingSubmitting}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1.25rem',
                                    background: '#F3F4F6',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '10px',
                                    color: '#4B5563',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteIng}
                                disabled={ingSubmitting}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1.25rem',
                                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#FFFFFF',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: ingSubmitting ? 'not-allowed' : 'pointer',
                                    opacity: ingSubmitting ? 0.7 : 1,
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {ingSubmitting ? 'Deleting...' : 'Delete Ingredient'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recipes;




