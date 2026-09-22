import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Trash2, Pencil, BookOpen, Package, Coffee, Cake, Cookie, CupSoda, AlertTriangle, EyeOff, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, API_BASE_URL } from '../lib/api';
import { apiClient } from '../lib/apiClient';
import { getEffectiveUnitCost } from '../lib/utils';

const getProductIconInfo = (name: string, category: string = '') => {
    const lower = (name + ' ' + category).toLowerCase();
    if (lower.includes('cake') || lower.includes('pastry') || lower.includes('pie') || lower.includes('muffin') || lower.includes('cupcake') || lower.includes('dessert') || lower.includes('slice')) {
        return { Icon: Cake, color: '#ec4899', bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.3)' };
    }
    if (lower.includes('bread') || lower.includes('breed') || lower.includes('toast') || lower.includes('sandwich') || lower.includes('croissant') || lower.includes('waffle') || lower.includes('pan') || lower.includes('cookie') || lower.includes('biscuit')) {
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

// Helper to standardize & validate product Size / Variant (e.g., "s" -> "S", "16 oz" -> "16oz")
const normalizeSize = (size: string = ''): string => {
    const trimmed = (size || '').trim();
    if (!trimmed) return '';
    const slice30 = trimmed.slice(0, 30).trim();
    const lower = slice30.toLowerCase();

    if (lower === 's' || lower === 'small') return 'S';
    if (lower === 'm' || lower === 'med' || lower === 'medium') return 'M';
    if (lower === 'l' || lower === 'large') return 'L';
    if (lower === 'xl' || lower === 'extra large' || lower === 'extralarge') return 'XL';
    if (lower === 'xxl' || lower === '2xl') return '2XL';
    if (lower === '16 oz' || lower === '16oz') return '16oz';
    if (lower === '22 oz' || lower === '22oz') return '22oz';
    if (lower === 'solo') return 'Solo';
    if (lower === 'family') return 'Family';
    if (lower === 'regular' || lower === 'reg') return 'Regular';

    if (slice30.length <= 4) return slice30.toUpperCase();
    return slice30.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL', '16oz', '22oz', 'Solo', 'Family', 'Regular', '1pc', 'Slice', '500g', '1kg'];

// Helper to standardize Unit of Measure entries (e.g. "pc" -> "pcs", "kilogram" -> "kg", "ml" -> "mL")
const normalizeUOM = (uom: string = ''): string => {
    const trimmed = (uom || '').trim();
    if (!trimmed) return 'pcs';
    const lower = trimmed.toLowerCase().replace(/[\s\-_]+/g, '');

    if (lower === 'pc' || lower === 'piece' || lower === 'pieces' || lower === 'pcs') return 'pcs';
    if (lower === 'kg' || lower === 'kilogram' || lower === 'kilograms' || lower === 'kilo') return 'kg';
    if (lower === 'g' || lower === 'gram' || lower === 'grams') return 'g';
    if (lower === 'mg' || lower === 'milligram' || lower === 'milligrams') return 'mg';
    if (lower === 'l' || lower === 'liter' || lower === 'liters' || lower === 'litre' || lower === 'litres') return 'L';
    if (lower === 'ml' || lower === 'milliliter' || lower === 'milliliters' || lower === 'millilitre') return 'mL';
    if (lower === 'cup' || lower === 'cups') return 'cups';
    if (lower === 'tbsp' || lower === 'tablespoon' || lower === 'tablespoons') return 'tbsp';
    if (lower === 'tsp' || lower === 'teaspoon' || lower === 'teaspoons') return 'tsp';
    if (lower === 'oz' || lower === 'ounce' || lower === 'ounces') return 'oz';
    if (lower === 'lb' || lower === 'lbs' || lower === 'pound' || lower === 'pounds') return 'lbs';
    if (lower === 'sachet' || lower === 'sachets') return 'sachet';
    if (lower === 'pack' || lower === 'packs' || lower === 'packet' || lower === 'packets') return 'pack';
    if (lower === 'bottle' || lower === 'bottles') return 'bottle';
    if (lower === 'can' || lower === 'cans') return 'can';
    if (lower === 'box' || lower === 'boxes') return 'box';
    if (lower === 'bag' || lower === 'bags') return 'bag';
    if (lower === 'sheet' || lower === 'sheets') return 'sheet';
    if (lower === 'roll' || lower === 'rolls') return 'roll';
    if (lower === 'tray' || lower === 'trays') return 'tray';
    if (lower === 'dozen' || lower === 'doz') return 'dozen';

    // Return title-cased if unrecognized
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const STANDARD_UNITS = [
    'pcs', 'kg', 'g', 'mg', 'L', 'mL', 'cups', 'tbsp', 'tsp',
    'oz', 'lbs', 'sachet', 'pack', 'bottle', 'can', 'box', 'bag',
    'sheet', 'roll', 'tray', 'dozen'
];

interface Product {
    id: string;
    name: string;
    category: string;
    sku: string;
    unit_of_measure: string;
    reorder_level: number;
    stock: number;
    status: string;
    limiting_ingredient?: string;
    size?: string | null;
    default_price?: number | null;
    is_active?: boolean;
}

interface RawIngredient {
    id: string;
    name: string;
    unit: string;
    stock_quantity: number;
    cost_per_unit: number;
}

interface DraftRecipeItem {
    ingredient_id: string;
    ingredient_name: string;
    unit: string;
    quantity_required: number;
    cost_per_unit: number;
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
    color: 'var(--text-muted)',
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
            minWidth: '200px',
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

const Inventory = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Validation errors
    const [addErrors, setAddErrors] = useState<Record<string, string>>({});
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});

    // Edit Product modal
    const [editProduct, setEditProduct] = useState<{ id: string; name: string } | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        category: string;
        size: string;
        unit_of_measure: string;
        default_price: string | number;
        is_active: boolean;
    }>({
        name: '', category: '', size: '', unit_of_measure: 'pcs', default_price: '', is_active: true
    });

    // Delete Product modal
    const [deleteModalProduct, setDeleteModalProduct] = useState<{ id: string; name: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState<{
        name: string;
        category: string;
        sku: string;
        unit_of_measure: string;
        reorder_level: string | number;
        size: string;
        default_price: string | number;
        is_active: boolean;
        addInitialBatch: boolean;
        quantity: string | number;
        cost_per_unit: string | number;
        expiry_date: string;
    }>({
        name: '', category: '', sku: '', unit_of_measure: 'pcs', reorder_level: '',
        size: '', default_price: '', is_active: true,
        addInitialBatch: false, quantity: '', cost_per_unit: '', expiry_date: ''
    });

    // Recipe Builder State in Add Product Modal
    const [rawIngredients, setRawIngredients] = useState<RawIngredient[]>([]);
    const [draftRecipe, setDraftRecipe] = useState<DraftRecipeItem[]>([]);
    const [recipeMultiplier, setRecipeMultiplier] = useState<number>(1.5);
    const [ingSearch, setIngSearch] = useState('');
    const [ingQty, setIngQty] = useState('');
    const [ingErr, setIngErr] = useState('');
    const [ingQtyErr, setIngQtyErr] = useState('');

    // Edit Product Recipe state
    const [recipeOnlyProduct, setRecipeOnlyProduct] = useState<any | null>(null);
    const [editDraftRecipe, setEditDraftRecipe] = useState<DraftRecipeItem[]>([]);
    const [originalRecipeIngIds, setOriginalRecipeIngIds] = useState<string[]>([]);
    const [editIngSearch, setEditIngSearch] = useState('');
    const [editIngQty, setEditIngQty] = useState('');
    const [editIngErr, setEditIngErr] = useState('');
    const [editIngQtyErr, setEditIngQtyErr] = useState('');

    const openRecipeOnlyModal = async (item: any) => {
        setRecipeOnlyProduct(item);
        setEditIngSearch('');
        setEditIngQty('');
        setEditIngErr('');
        setEditIngQtyErr('');
        setEditDraftRecipe([]);
        setOriginalRecipeIngIds([]);

        try {
            const recipeData = await apiClient.get(`${API_ENDPOINTS.RECIPES}/${item.id}`);
            const rawItems = Array.isArray(recipeData) ? recipeData : (recipeData?.items || []);
            if (rawItems.length > 0) {
                const mappedItems: DraftRecipeItem[] = rawItems.map((r: any) => {
                    const ing = r.ingredients || {};
                    return {
                        ingredient_id: r.ingredient_id,
                        ingredient_name: ing.name || r.ingredient_name || 'Ingredient',
                        unit: ing.unit || r.unit || 'unit',
                        quantity_required: Number(r.quantity_required || 0),
                        cost_per_unit: Number(ing.cost_per_unit || r.cost_per_unit || 0)
                    };
                });
                setEditDraftRecipe(mappedItems);
                setOriginalRecipeIngIds(mappedItems.map(i => i.ingredient_id));
            }
        } catch (err) {
            console.error('Failed to load recipe for product:', err);
        }
    };

    const openEditModal = async (item: any, focusRecipe = false) => {
        setEditProduct(item);
        setEditForm({
            name: item.name,
            category: item.category || '',
            size: item.size || '',
            unit_of_measure: item.unit_of_measure || 'pcs',
            default_price: item.default_price != null ? item.default_price : '',
            is_active: item.is_active !== false,
        });
        setEditErrors({});
        setEditIngSearch('');
        setEditIngQty('');
        setEditIngErr('');
        setEditIngQtyErr('');
        setEditDraftRecipe([]);
        setOriginalRecipeIngIds([]);

        if (focusRecipe) {
            setTimeout(() => {
                const recipeSec = document.getElementById('edit-product-recipe-section');
                if (recipeSec) {
                    recipeSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }

        try {
            const recipeData = await apiClient.get(`${API_ENDPOINTS.RECIPES}/${item.id}`);
            // API returns { items: [...], total_cost_per_unit: ..., ingredient_count: ... }
            const rawItems = Array.isArray(recipeData) ? recipeData : (recipeData?.items || []);
            if (rawItems.length > 0) {
                const mappedItems: DraftRecipeItem[] = rawItems.map((r: any) => {
                    const ing = r.ingredients || {};
                    return {
                        ingredient_id: r.ingredient_id,
                        ingredient_name: ing.name || r.ingredient_name || 'Ingredient',
                        unit: ing.unit || r.unit || 'unit',
                        quantity_required: Number(r.quantity_required || 0),
                        cost_per_unit: Number(ing.cost_per_unit || r.cost_per_unit || 0)
                    };
                });
                setEditDraftRecipe(mappedItems);
                setOriginalRecipeIngIds(mappedItems.map(i => i.ingredient_id));
            }
        } catch (err) {
            console.error('Failed to load recipe for edit product:', err);
        }
    };

    const handleAddEditDraftIngredient = () => {
        setEditIngErr('');
        setEditIngQtyErr('');

        const ing = findIngredient(editIngSearch);
        if (!ing) {
            setEditIngErr('Please select a valid raw ingredient from the list.');
            return;
        }

        const existingItem = editDraftRecipe.find(i => i.ingredient_id === ing.id);
        if (existingItem) {
            setEditIngErr(`Ingredient "${ing.name}" is already added to this recipe.`);
            return;
        }

        if (!editIngQty.trim()) {
            setEditIngQtyErr('Qty Required is required.');
            return;
        }

        const qty = Number(editIngQty);
        if (isNaN(qty) || qty <= 0) {
            setEditIngQtyErr('Qty Required must be greater than 0.');
            return;
        }
        if (qty > 5000) {
            setEditIngQtyErr(`Qty Required cannot exceed 5,000 ${ing.unit} per serving.`);
            return;
        }

        setEditDraftRecipe(prev => [...prev, {
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            unit: ing.unit,
            quantity_required: qty,
            cost_per_unit: Number(ing.cost_per_unit || 0)
        }]);

        setEditIngSearch('');
        setEditIngQty('');
        setEditIngErr('');
        setEditIngQtyErr('');
    };

    const handleRemoveEditDraftIngredient = (ingId: string) => {
        setEditDraftRecipe(prev => prev.filter(i => i.ingredient_id !== ingId));
    };

    const totalEditRecipeCost = useMemo(() => {
        return editDraftRecipe.reduce((acc, item) => {
            const effCost = getEffectiveUnitCost(item.unit, item.cost_per_unit);
            return acc + (effCost * item.quantity_required);
        }, 0);
    }, [editDraftRecipe]);

    const editRecipeServingsInfo = useMemo(() => {
        if (editDraftRecipe.length === 0) return { maxServings: 0, limitingIng: '' };
        let minServings = Infinity;
        let limitingIng = '';

        editDraftRecipe.forEach(item => {
            const rawIng = rawIngredients.find(r => r.id === item.ingredient_id);
            const availableStock = rawIng ? Number(rawIng.stock_quantity || 0) : 0;
            if (item.quantity_required > 0) {
                const possible = Math.floor(availableStock / item.quantity_required);
                if (possible < minServings) {
                    minServings = possible;
                    limitingIng = item.ingredient_name;
                }
            }
        });

        return {
            maxServings: minServings === Infinity ? 0 : minServings,
            limitingIng
        };
    }, [editDraftRecipe, rawIngredients]);


    const fetchIngredients = async () => {
        try {
            const data = await apiClient.get(API_ENDPOINTS.INGREDIENTS);
            setRawIngredients(data || []);
        } catch (err) {
            console.error('Error fetching raw ingredients:', err);
        }
    };

    const findIngredient = (searchText: string): RawIngredient | null => {
        const trimmed = searchText.trim().toLowerCase();
        if (!trimmed) return null;
        return rawIngredients.find(i => {
            const effCost = getEffectiveUnitCost(i.unit, i.cost_per_unit || 0);
            const labelWithStock = `${i.name} — stock: ${i.stock_quantity} ${i.unit} — ₱${effCost.toFixed(2)}/${i.unit}`.toLowerCase();
            const fullLabel = `${i.name} (${i.unit}) — ₱${effCost.toFixed(2)}/${i.unit}`.toLowerCase();
            const rawLabel = `${i.name} (${i.unit}) — ₱${Number(i.cost_per_unit || 0).toFixed(2)}/${i.unit}`.toLowerCase();
            const nameWithUnit = `${i.name} (${i.unit})`.toLowerCase();
            const justName = i.name.toLowerCase();
            return fullLabel === trimmed || rawLabel === trimmed || nameWithUnit === trimmed || justName === trimmed || i.id === trimmed;
        }) || rawIngredients.find(i => {
            const cleanSearch = trimmed.split('—')[0].split('(')[0].trim();
            return i.name.toLowerCase() === cleanSearch || i.name.toLowerCase().includes(cleanSearch);
        }) || null;
    };

    const handleAddDraftIngredient = () => {
        setIngErr('');
        setIngQtyErr('');

        const ing = findIngredient(ingSearch);
        if (!ing) {
            setIngErr('Please select a valid raw ingredient from the list.');
            return;
        }

        const existingItem = draftRecipe.find(item => item.ingredient_id === ing.id);
        if (existingItem) {
            setIngErr(`Ingredient "${ing.name}" is already added to this recipe.`);
            return;
        }

        if (!ingQty.trim()) {
            setIngQtyErr('Qty Required is required.');
            return;
        }

        const qty = Number(ingQty);
        if (isNaN(qty) || qty <= 0) {
            setIngQtyErr('Qty Required must be greater than 0.');
            return;
        }
        if (qty > 5000) {
            setIngQtyErr(`Qty Required cannot exceed 5,000 ${ing.unit} per serving.`);
            return;
        }

        setDraftRecipe(prev => [...prev, {
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            unit: ing.unit,
            quantity_required: qty,
            cost_per_unit: Number(ing.cost_per_unit || 0)
        }]);

        setIngSearch('');
        setIngQty('');
        setIngErr('');
        setIngQtyErr('');
    };

    const handleRemoveDraftIngredient = (ingId: string) => {
        setDraftRecipe(prev => prev.filter(item => item.ingredient_id !== ingId));
    };

    const totalRecipeCost = useMemo(() => {
        return draftRecipe.reduce((acc, item) => {
            const effCost = getEffectiveUnitCost(item.unit, item.cost_per_unit);
            return acc + (effCost * item.quantity_required);
        }, 0);
    }, [draftRecipe]);

    const recipeServingsInfo = useMemo(() => {
        if (draftRecipe.length === 0) return { maxServings: 0, limitingIng: '' };
        let minServings = Infinity;
        let limitingIng = '';

        draftRecipe.forEach(item => {
            const rawIng = rawIngredients.find(r => r.id === item.ingredient_id);
            const availableStock = rawIng ? Number(rawIng.stock_quantity || 0) : 0;
            if (item.quantity_required > 0) {
                const possible = Math.floor(availableStock / item.quantity_required);
                if (possible < minServings) {
                    minServings = possible;
                    limitingIng = item.ingredient_name;
                }
            }
        });

        return {
            maxServings: minServings === Infinity ? 0 : minServings,
            limitingIng
        };
    }, [draftRecipe, rawIngredients]);



    const categoryOptions = useMemo(() => {
        const set = new Set<string>([
            'Coffee', 'Milk Tea', 'Fruit Soda', 'Cakes & Desserts', 'Bread & Pastry',
            'Burgers', 'Fries', 'Hotdog', 'Iced Blended', 'Iced Coffee',
            'Mango Series', 'Matcha Series', 'Siomai', 'Takoyaki', 'Ube Series', 'General'
        ]);
        inventory.forEach(item => {
            if (item.category && item.category.trim()) {
                const norm = normalizeCategory(item.category);
                if (norm) set.add(norm);
            }
        });
        return Array.from(set).sort();
    }, [inventory]);

    useEffect(() => {
        fetchInventory();
        fetchIngredients();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const products = await apiClient.get(API_ENDPOINTS.INVENTORY);

            const formattedInventory = products.map((product: any) => {
                // Use recipe-based stock if available, else fall back to batch stock
                const batchStock = product.inventory_transactions
                    ? product.inventory_transactions
                        .filter((batch: any) => batch.status === 'ACTIVE')
                        .reduce((acc: number, batch: any) => acc + Number(batch.quantity), 0)
                    : 0;

                const totalStock = product.recipe_stock != null
                    ? product.recipe_stock
                    : batchStock;

                let status = 'In Stock';
                if (totalStock === 0) {
                    status = product.limiting_ingredient
                        ? `Out of Stock: ${product.limiting_ingredient}`
                        : 'Out of Stock';
                } else if (totalStock <= product.reorder_level) {
                    status = 'Low Stock';
                }

                return {
                    id: product.id,
                    name: product.name,
                    category: product.category,
                    sku: product.sku,
                    unit_of_measure: product.unit_of_measure,
                    reorder_level: product.reorder_level,
                    stock: totalStock,
                    has_recipe: product.recipe_stock != null,
                    limiting_ingredient: product.limiting_ingredient,
                    status: status,
                    size: product.size ?? null,
                    default_price: product.default_price ?? null,
                    is_active: product.is_active !== false,
                };
            });

            setInventory(formattedInventory);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            try {
                const products = await apiClient.get(API_ENDPOINTS.PRODUCTS);
                setInventory(products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category || '',
                    sku: p.sku || '',
                    unit_of_measure: p.unit_of_measure || '',
                    reorder_level: 0,
                    stock: 0,
                    status: 'Unknown',
                    size: p.size ?? null,
                    default_price: p.default_price ?? null,
                    is_active: p.is_active !== false,
                })));
            } catch { }
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats
    const stats = {
        total: inventory.length,
        low: inventory.filter(i => i.status === 'Low Stock').length,
        out: inventory.filter(i => i.status.startsWith('Out of Stock')).length,
        inactive: inventory.filter(i => i.is_active === false).length,
    };

    const validateAddForm = (): Record<string, string> => {
        const errs: Record<string, string> = {};
        if (!formData.name.trim()) {
            errs.name = 'Product name is required.';
        }
        if (formData.default_price === '' || formData.default_price == null) {
            errs.default_price = 'Default price is required.';
        } else {
            const price = Number(formData.default_price);
            if (isNaN(price) || price <= 0) {
                errs.default_price = 'Default price must be greater than ₱0.';
            } else if (price > 5000) {
                errs.default_price = 'Default price cannot exceed ₱5,000.';
            }
        }
        if (formData.reorder_level !== '' && formData.reorder_level != null) {
            const reorder = Number(formData.reorder_level);
            if (isNaN(reorder) || reorder < 0) {
                errs.reorder_level = 'Reorder level must be a valid number (≥ 0).';
            } else if (reorder > 10000) {
                errs.reorder_level = 'Reorder level cannot exceed 10,000.';
            }
        }
        return errs;
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        // Auto-add pending recipe ingredient if user typed it into the input before clicking submit
        let finalDraft = [...draftRecipe];
        if (ingSearch.trim() || ingQty.trim()) {
            const ing = findIngredient(ingSearch);
            const qty = Number(ingQty);
            if (!ing) {
                setAddErrors({ _api: "Please select a valid raw ingredient from the list in Recipe Builder or clear the search box." });
                return;
            }
            if (isNaN(qty) || qty <= 0) {
                setAddErrors({ _api: "Please enter a valid Qty Required (> 0) in Recipe Builder or clear it." });
                return;
            }
            if (qty > 5000) {
                setAddErrors({ _api: `Qty Required (${qty} ${ing.unit}) per serving cannot exceed 5,000 ${ing.unit}.` });
                return;
            }
            const existing = finalDraft.find(item => item.ingredient_id === ing.id);
            if (existing) {
                setAddErrors({ _api: `Ingredient "${ing.name}" is already added to this recipe.` });
                return;
            }
            finalDraft.push({
                ingredient_id: ing.id,
                ingredient_name: ing.name,
                unit: ing.unit,
                quantity_required: qty,
                cost_per_unit: Number(ing.cost_per_unit || 0)
            });
        }

        const errs = validateAddForm();
        if (Object.keys(errs).length > 0) { setAddErrors(errs); return; }
        setAddErrors({});
        setSubmitting(true);

        try {
            // Strip fields that don't belong in the products table
            const { addInitialBatch, quantity, cost_per_unit, expiry_date, ...productData } = formData;

            const createdProduct = await apiClient.post(`${API_BASE_URL}/api/inventory/product`, {
                ...productData,
                category: normalizeCategory(formData.category),
                size: normalizeSize(formData.size) || null,
                unit_of_measure: normalizeUOM(formData.unit_of_measure),
                reorder_level: formData.reorder_level === '' ? 0 : Number(formData.reorder_level),
                default_price: formData.default_price === '' ? null : Number(formData.default_price),
            });

            // Save recipe items if any were configured
            if (createdProduct?.id && finalDraft.length > 0) {
                for (const item of finalDraft) {
                    await apiClient.post(`${API_ENDPOINTS.RECIPES}/${createdProduct.id}`, {
                        ingredient_id: item.ingredient_id,
                        quantity_required: item.quantity_required,
                    });
                }
            }

            // Success: Close modal, reset form & recipe draft, refresh data
            setIsAddModalOpen(false);
            setAddErrors({});
            setDraftRecipe([]);
            setIngSearch('');
            setIngQty('');
            setIngErr('');
            setIngQtyErr('');
            setFormData({ name: '', category: '', sku: '', unit_of_measure: 'pcs', reorder_level: '', size: '', default_price: '', is_active: true, addInitialBatch: false, quantity: '', cost_per_unit: '', expiry_date: '' });
            fetchInventory();
        } catch (error: any) {
            const msg = error?.message || 'Failed to add product. Please try again.';
            setAddErrors({ _api: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDeleteProduct = async () => {
        if (!deleteModalProduct) return;
        setSubmitting(true);
        try {
            await apiClient.delete(`${API_ENDPOINTS.INVENTORY}/product/${deleteModalProduct.id}`);
            setDeleteModalProduct(null);
            fetchInventory();
        } catch (err) {
            alert('Failed to delete product.');
        } finally {
            setSubmitting(false);
        }
    };

    const validateEditForm = (): Record<string, string> => {
        const errs: Record<string, string> = {};
        if (!editForm.name.trim()) {
            errs.name = 'Product name is required.';
        }
        if (editForm.default_price === '' || editForm.default_price == null) {
            errs.default_price = 'Default price is required.';
        } else {
            const price = Number(editForm.default_price);
            if (isNaN(price) || price <= 0) {
                errs.default_price = 'Default price must be greater than ₱0.';
            } else if (price > 5000) {
                errs.default_price = 'Default price cannot exceed ₱5,000.';
            }
        }
        return errs;
    };

    const handleEditProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editProduct) return;
        const errs = validateEditForm();
        if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
        setEditErrors({});
        setSubmitting(true);
        try {
            await apiClient.put(`${API_ENDPOINTS.INVENTORY}/product/${editProduct.id}`, {
                name: editForm.name,
                category: normalizeCategory(editForm.category),
                size: normalizeSize(editForm.size) || null,
                unit_of_measure: normalizeUOM(editForm.unit_of_measure),
                default_price: editForm.default_price === '' || editForm.default_price == null ? null : Number(editForm.default_price),
                is_active: editForm.is_active,
            });

            // Auto-add pending recipe ingredient if typed before submit
            let finalEditDraft = [...editDraftRecipe];
            if (editIngSearch.trim() || editIngQty.trim()) {
                const ing = findIngredient(editIngSearch);
                const qty = Number(editIngQty);
                if (ing && !isNaN(qty) && qty > 0 && !finalEditDraft.some(x => x.ingredient_id === ing.id)) {
                    finalEditDraft.push({
                        ingredient_id: ing.id,
                        ingredient_name: ing.name,
                        unit: ing.unit,
                        quantity_required: qty,
                        cost_per_unit: Number(ing.cost_per_unit || 0)
                    });
                }
            }

            // Sync recipe modifications
            const currentIngIds = finalEditDraft.map(item => item.ingredient_id);
            for (const origId of originalRecipeIngIds) {
                if (!currentIngIds.includes(origId)) {
                    try {
                        await apiClient.delete(`${API_ENDPOINTS.RECIPES}/${editProduct.id}/${origId}`);
                    } catch {}
                }
            }
            for (const item of finalEditDraft) {
                try {
                    await apiClient.post(`${API_ENDPOINTS.RECIPES}/${editProduct.id}`, {
                        ingredient_id: item.ingredient_id,
                        quantity_required: item.quantity_required
                    });
                } catch {}
            }

            setEditProduct(null);
            setEditErrors({});
            fetchInventory();
        } catch (err: any) {
            setEditErrors({ _api: err?.message || 'Failed to update product.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveRecipeOnly = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeOnlyProduct) return;
        setSubmitting(true);
        try {
            // Auto-add pending recipe ingredient if typed before submit
            let finalEditDraft = [...editDraftRecipe];
            if (editIngSearch.trim() || editIngQty.trim()) {
                const ing = findIngredient(editIngSearch);
                const qty = Number(editIngQty);
                if (ing && !isNaN(qty) && qty > 0 && !finalEditDraft.some(x => x.ingredient_id === ing.id)) {
                    finalEditDraft.push({
                        ingredient_id: ing.id,
                        ingredient_name: ing.name,
                        unit: ing.unit,
                        quantity_required: qty,
                        cost_per_unit: Number(ing.cost_per_unit || 0)
                    });
                }
            }

            // Sync recipe modifications
            const currentIngIds = finalEditDraft.map(item => item.ingredient_id);
            for (const origId of originalRecipeIngIds) {
                if (!currentIngIds.includes(origId)) {
                    try {
                        await apiClient.delete(`${API_ENDPOINTS.RECIPES}/${recipeOnlyProduct.id}/${origId}`);
                    } catch {}
                }
            }
            for (const item of finalEditDraft) {
                try {
                    await apiClient.post(`${API_ENDPOINTS.RECIPES}/${recipeOnlyProduct.id}`, {
                        ingredient_id: item.ingredient_id,
                        quantity_required: item.quantity_required
                    });
                } catch {}
            }

            setRecipeOnlyProduct(null);
            fetchInventory();
        } catch (err: any) {
            console.error('Failed to save recipe:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Products</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>View and manage your current stock levels.</p>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        border: 'none',
                        color: 'white',
                        padding: '0.6rem 1.2rem',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}>
                    <Plus size={18} />
                    Add Item
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <SummaryCard icon={<Package size={20} />} label="Total Products" value={stats.total}
                    color="#8b5cf6" bg="rgba(139,92,246,0.08)" />
                <SummaryCard icon={<AlertTriangle size={20} />} label="Low Stock" value={stats.low}
                    color="#f59e0b" bg="rgba(245,158,11,0.08)" />
                <SummaryCard icon={<Archive size={20} />} label="Out of Stock" value={stats.out}
                    color="#ef4444" bg="rgba(239,68,68,0.08)" />
                <SummaryCard icon={<EyeOff size={20} />} label="Inactive Items" value={stats.inactive}
                    color="rgba(255,255,255,0.4)" bg="rgba(0,0,0,0.05)" />
            </div>

            {/* DEDICATED PRODUCT RECIPE MODAL */}
            {recipeOnlyProduct && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1.5rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="glass-card" style={{
                        width: '100%', maxWidth: '720px', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                        padding: 0, overflow: 'hidden', position: 'relative',
                        animation: 'slideUp 0.3s ease-out',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid var(--glass-border)',
                            background: 'var(--bg-panel)', flexShrink: 0
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BookOpen size={22} color="#06b6d4" />
                                    Product Recipe
                                </h2>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{recipeOnlyProduct.name}</strong>
                                    {recipeOnlyProduct.size && <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '0.1rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{recipeOnlyProduct.size}</span>}
                                    <span style={{ color: 'var(--text-muted)' }}>• {normalizeCategory(recipeOnlyProduct.category)}</span>
                                    {recipeOnlyProduct.default_price != null && <span style={{ color: '#10b981', fontWeight: 700 }}>• ₱{Number(recipeOnlyProduct.default_price).toFixed(2)}</span>}
                                </div>
                            </div>
                            <button onClick={() => setRecipeOnlyProduct(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRecipeOnly} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                                {/* Recipe Builder Section */}
                                <div style={{
                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                    background: 'rgba(6, 182, 212, 0.04)',
                                    padding: '1.2rem',
                                    borderRadius: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#06b6d4' }}>
                                            <span>Configured Ingredients ({editDraftRecipe.length})</span>
                                        </div>
                                        {totalEditRecipeCost > 0 && (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#06b6d4', background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Can Make Stock: {editRecipeServingsInfo.maxServings} servings
                                                </span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Recipe Cost: ₱{totalEditRecipeCost.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ingredient search input + Qty input + Add button */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.6rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Ingredient</label>
                                            <input
                                                type="text"
                                                list="raw-ingredient-recipe-only-suggestions"
                                                value={editIngSearch}
                                                onChange={(e) => {
                                                    setEditIngSearch(e.target.value);
                                                    setEditIngErr('');
                                                }}
                                                placeholder="Type/Search ingredient..."
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: editIngErr ? '#ef4444' : undefined }}
                                            />
                                            <datalist id="raw-ingredient-recipe-only-suggestions">
                                                {rawIngredients.map(ing => {
                                                    const effCost = getEffectiveUnitCost(ing.unit, ing.cost_per_unit || 0);
                                                    return (
                                                        <option key={ing.id} value={`${ing.name} (${ing.unit}) — ₱${effCost.toFixed(2)}/${ing.unit}`} />
                                                    );
                                                })}
                                            </datalist>
                                            {editIngErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{editIngErr}</div>}
                                            {(() => {
                                                const selIng = findIngredient(editIngSearch);
                                                if (!selIng) return null;
                                                return (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                        Stock available: <strong style={{ color: 'var(--text-secondary)' }}>{selIng.stock_quantity} {selIng.unit}</strong>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Qty / Serving ({(() => { const s = findIngredient(editIngSearch); return s ? s.unit : 'unit'; })()})</label>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                value={editIngQty}
                                                onChange={(e) => { setEditIngQty(e.target.value); setEditIngQtyErr(''); }}
                                                placeholder="e.g. 25"
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: editIngQtyErr ? '#ef4444' : undefined }}
                                            />
                                            {editIngQtyErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{editIngQtyErr}</div>}
                                        </div>
                                        <div style={{ paddingTop: '1.45rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleAddEditDraftIngredient}
                                                style={{
                                                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    padding: '0.6rem 0.9rem', fontWeight: 600, fontSize: '0.82rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    height: '38px'
                                                }}
                                            >
                                                <Plus size={16} /> Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Ingredient list */}
                                    {editDraftRecipe.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed rgba(6,182,212,0.25)', paddingTop: '0.75rem' }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                                                Recipe Ingredients ({editDraftRecipe.length}):
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {editDraftRecipe.map(item => {
                                                    const itemCost = getEffectiveUnitCost(item.unit, item.cost_per_unit) * item.quantity_required;
                                                    return (
                                                        <div key={item.ingredient_id} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            background: 'rgba(0, 0, 0, 0.03)', border: '1px solid var(--glass-border)',
                                                            borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.82rem'
                                                        }}>
                                                            <div>
                                                                <strong style={{ color: 'var(--text-primary)' }}>{item.ingredient_name}</strong>
                                                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                                                                    ({item.quantity_required} {item.unit} / serving)
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                {item.cost_per_unit > 0 && (
                                                                    <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                                                                        ₱{itemCost.toFixed(2)}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveEditDraftIngredient(item.ingredient_id)}
                                                                    style={{
                                                                        background: 'transparent', border: 'none',
                                                                        color: '#ef4444', cursor: 'pointer', display: 'flex',
                                                                        alignItems: 'center', padding: '2px'
                                                                    }}
                                                                    title="Remove ingredient"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                                display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center',
                                padding: '1rem 1.75rem',
                                background: 'var(--bg-panel)',
                                borderTop: '1px solid var(--glass-border)',
                                flexShrink: 0
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setRecipeOnlyProduct(null)}
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        background: 'var(--bg-dark)',
                                        border: '1.5px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Saving Recipe...' : 'Save Recipe'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT PRODUCT MODAL */}
            {editProduct && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1.5rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="glass-card" style={{
                        width: '100%', maxWidth: '720px', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                        padding: 0, overflow: 'hidden', position: 'relative',
                        animation: 'slideUp 0.3s ease-out',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid var(--glass-border)',
                            background: 'var(--bg-panel)', flexShrink: 0
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Product</h2>
                            <button onClick={() => setEditProduct(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleEditProduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                                {editErrors._api && (
                                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1rem', color: '#ef4444', fontSize: '0.82rem' }}>
                                        {editErrors._api}
                                    </div>
                                )}
                                <div style={{ marginBottom: '1.2rem' }}>
                                    <label style={labelStyle}>Product Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); setEditErrors(p => ({ ...p, name: '' })); }}
                                        style={{ ...inputStyle, borderColor: editErrors.name ? '#ef4444' : undefined }}
                                        placeholder="e.g. Arabica Beans"
                                    />
                                    {editErrors.name && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '0.3rem' }}>{editErrors.name}</div>}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                    <div>
                                        <label style={labelStyle}>Category</label>
                                        <input
                                            type="text"
                                            list="category-edit-suggestions"
                                            value={editForm.category}
                                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                            style={inputStyle}
                                            placeholder="e.g. Milk Tea"
                                        />
                                        <datalist id="category-edit-suggestions">
                                            {categoryOptions.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Size / Variant</label>
                                        <input
                                            type="text"
                                            list="size-edit-suggestions"
                                            maxLength={30}
                                            value={editForm.size}
                                            onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                                            placeholder="e.g. S, M, L, 16oz, Solo"
                                            style={inputStyle}
                                        />
                                        <datalist id="size-edit-suggestions">
                                            {STANDARD_SIZES.map(sz => (
                                                <option key={sz} value={sz} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                    <div>
                                        <label style={labelStyle}>Default Price (₱)</label>
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={editForm.default_price}
                                            onChange={(e) => { setEditForm({ ...editForm, default_price: e.target.value }); setEditErrors(p => ({ ...p, default_price: '' })); }}
                                            style={{ ...inputStyle, borderColor: editErrors.default_price ? '#ef4444' : undefined }}
                                        />
                                        {editErrors.default_price && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '0.3rem' }}>{editErrors.default_price}</div>}
                                        {totalEditRecipeCost > 0 && (
                                            <div style={{ fontSize: '0.74rem', marginTop: '0.35rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ color: '#06b6d4', fontWeight: 600 }}>
                                                    Suggested ({recipeMultiplier}x): ₱{(totalEditRecipeCost * recipeMultiplier).toFixed(2)}
                                                </span>
                                                {(() => {
                                                    const price = parseFloat(String(editForm.default_price)) || 0;
                                                    if (price <= 0) return null;
                                                    const profit = price - totalEditRecipeCost;
                                                    const margin = (profit / price) * 100;
                                                    return (
                                                        <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                            Profit: ₱{profit.toFixed(2)} ({margin.toFixed(1)}%)
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Unit of Measure</label>
                                        <input
                                            type="text"
                                            list="uom-edit-suggestions"
                                            value={editForm.unit_of_measure}
                                            onChange={(e) => setEditForm({ ...editForm, unit_of_measure: e.target.value })}
                                            placeholder="e.g. pcs, kg, mL"
                                            style={inputStyle}
                                        />
                                        <datalist id="uom-edit-suggestions">
                                            {STANDARD_UNITS.map(u => (
                                                <option key={u} value={u} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="edit_is_active"
                                        checked={editForm.is_active}
                                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                    />
                                    <label htmlFor="edit_is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Active Product</label>
                                </div>

                                {/* Recipe Builder Section for Edit Product */}
                                <div id="edit-product-recipe-section" style={{
                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                    background: 'rgba(6, 182, 212, 0.04)',
                                    padding: '1.2rem',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#06b6d4' }}>
                                            <BookOpen size={18} />
                                            <span>Product Recipe</span>
                                        </div>
                                        {totalEditRecipeCost > 0 && (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#06b6d4', background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Can Make Stock: {editRecipeServingsInfo.maxServings} servings
                                                </span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Recipe Cost: ₱{totalEditRecipeCost.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.6rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Ingredient</label>
                                            <input
                                                type="text"
                                                list="raw-ingredient-edit-suggestions"
                                                value={editIngSearch}
                                                onChange={(e) => {
                                                    setEditIngSearch(e.target.value);
                                                    setEditIngErr('');
                                                }}
                                                placeholder="Type/Search ingredient..."
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: editIngErr ? '#ef4444' : undefined }}
                                            />
                                            <datalist id="raw-ingredient-edit-suggestions">
                                                {rawIngredients.map(ing => {
                                                    const effCost = getEffectiveUnitCost(ing.unit, ing.cost_per_unit || 0);
                                                    return (
                                                        <option key={ing.id} value={`${ing.name} (${ing.unit}) — ₱${effCost.toFixed(2)}/${ing.unit}`} />
                                                    );
                                                })}
                                            </datalist>
                                            {editIngErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{editIngErr}</div>}
                                            {(() => {
                                                const selIng = findIngredient(editIngSearch);
                                                if (!selIng) return null;
                                                return (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                        Stock available: <strong style={{ color: 'var(--text-secondary)' }}>{selIng.stock_quantity} {selIng.unit}</strong>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Qty / Serving ({(() => { const s = findIngredient(editIngSearch); return s ? s.unit : 'unit'; })()})</label>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                value={editIngQty}
                                                onChange={(e) => { setEditIngQty(e.target.value); setEditIngQtyErr(''); }}
                                                placeholder="e.g. 25"
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: editIngQtyErr ? '#ef4444' : undefined }}
                                            />
                                            {editIngQtyErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{editIngQtyErr}</div>}
                                        </div>
                                        <div style={{ paddingTop: '1.45rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleAddEditDraftIngredient}
                                                style={{
                                                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    padding: '0.6rem 0.9rem', fontWeight: 600, fontSize: '0.82rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    height: '38px'
                                                }}
                                            >
                                                <Plus size={16} /> Add
                                            </button>
                                        </div>
                                    </div>

                                    {editDraftRecipe.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed rgba(6,182,212,0.25)', paddingTop: '0.75rem' }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                                                Recipe Ingredients ({editDraftRecipe.length}):
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {editDraftRecipe.map(item => {
                                                    const itemCost = getEffectiveUnitCost(item.unit, item.cost_per_unit) * item.quantity_required;
                                                    return (
                                                        <div key={item.ingredient_id} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            background: 'rgba(0, 0, 0, 0.03)', border: '1px solid var(--glass-border)',
                                                            borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.82rem'
                                                        }}>
                                                            <div>
                                                                <strong style={{ color: 'var(--text-primary)' }}>{item.ingredient_name}</strong>
                                                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                                                                    ({item.quantity_required} {item.unit} / serving)
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                {item.cost_per_unit > 0 && (
                                                                    <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                                                                        ₱{itemCost.toFixed(2)}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveEditDraftIngredient(item.ingredient_id)}
                                                                    style={{
                                                                        background: 'transparent', border: 'none',
                                                                        color: '#ef4444', cursor: 'pointer', display: 'flex',
                                                                        alignItems: 'center', padding: '2px'
                                                                    }}
                                                                    title="Remove ingredient"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center',
                                padding: '1rem 1.75rem',
                                background: 'var(--bg-panel)',
                                borderTop: '1px solid var(--glass-border)',
                                flexShrink: 0
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setEditProduct(null)}
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        background: 'var(--bg-dark)',
                                        border: '1.5px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        background: 'var(--accent-primary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD PRODUCT MODAL */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1.5rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="glass-card" style={{
                        width: '100%', maxWidth: '720px', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                        padding: 0, overflow: 'hidden', position: 'relative',
                        animation: 'slideUp 0.3s ease-out',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid var(--glass-border)',
                            background: 'var(--bg-panel)', flexShrink: 0
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Add New Product</h2>
                            <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                                {addErrors._api && (
                                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1rem', color: '#ef4444', fontSize: '0.82rem' }}>
                                        {addErrors._api}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                    <div>
                                        <label style={labelStyle}>Product Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setAddErrors(p => ({ ...p, name: '' })); }}
                                            placeholder="e.g. Arabica Beans"
                                            style={{ ...inputStyle, borderColor: addErrors.name ? '#ef4444' : undefined }}
                                        />
                                        {addErrors.name && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '0.3rem' }}>{addErrors.name}</div>}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Category</label>
                                        <input
                                            type="text"
                                            list="category-add-suggestions"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="e.g. Milk Tea"
                                            style={inputStyle}
                                        />
                                        <datalist id="category-add-suggestions">
                                            {categoryOptions.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                    <div>
                                        <label style={labelStyle}>Size / Variant</label>
                                        <input
                                            type="text"
                                            list="size-add-suggestions"
                                            maxLength={30}
                                            value={formData.size}
                                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                            placeholder="e.g. S, M, L, 16oz, Solo"
                                            style={inputStyle}
                                        />
                                        <datalist id="size-add-suggestions">
                                            {STANDARD_SIZES.map(sz => (
                                                <option key={sz} value={sz} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Default Price (₱)</label>
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={formData.default_price}
                                            onChange={(e) => { setFormData({ ...formData, default_price: e.target.value }); setAddErrors(p => ({ ...p, default_price: '' })); }}
                                            placeholder="0.00"
                                            style={{ ...inputStyle, borderColor: addErrors.default_price ? '#ef4444' : undefined }}
                                        />
                                        {addErrors.default_price && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '0.3rem' }}>{addErrors.default_price}</div>}
                                        {totalRecipeCost > 0 && (
                                            <div style={{ fontSize: '0.74rem', marginTop: '0.35rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ color: '#06b6d4', fontWeight: 600 }}>
                                                    Suggested ({recipeMultiplier}x): ₱{(totalRecipeCost * recipeMultiplier).toFixed(2)}
                                                </span>
                                                {(() => {
                                                    const price = parseFloat(String(formData.default_price)) || 0;
                                                    if (price <= 0) return null;
                                                    const profit = price - totalRecipeCost;
                                                    const margin = (profit / price) * 100;
                                                    return (
                                                        <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                            Profit: ₱{profit.toFixed(2)} ({margin.toFixed(1)}%)
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                    <div>
                                        <label style={labelStyle}>Unit of Measure</label>
                                        <input
                                            type="text"
                                            list="uom-add-suggestions"
                                            value={formData.unit_of_measure}
                                            onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                            placeholder="e.g. pcs, kg, mL"
                                            style={inputStyle}
                                        />
                                        <datalist id="uom-add-suggestions">
                                            {STANDARD_UNITS.map(u => (
                                                <option key={u} value={u} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Reorder Level</label>
                                        <input
                                            type="number" min="0"
                                            value={formData.reorder_level}
                                            onChange={(e) => { setFormData({ ...formData, reorder_level: e.target.value }); setAddErrors(p => ({ ...p, reorder_level: '' })); }}
                                            placeholder="0"
                                            style={{ ...inputStyle, borderColor: addErrors.reorder_level ? '#ef4444' : undefined }}
                                        />
                                        {addErrors.reorder_level && <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '0.3rem' }}>{addErrors.reorder_level}</div>}
                                    </div>
                                </div>

                                <div style={{ display: 'none' }}>
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <label htmlFor="is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Active Product</label>
                                </div>

                                {/* Recipe Builder Section */}
                                <div style={{
                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                    background: 'rgba(6, 182, 212, 0.04)',
                                    padding: '1.2rem',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#06b6d4' }}>
                                            <BookOpen size={18} />
                                            <span>Product Recipe</span>
                                        </div>
                                        {totalRecipeCost > 0 && (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#06b6d4', background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Can Make Stock: {recipeServingsInfo.maxServings} servings
                                                </span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>
                                                    Recipe Cost: ₱{totalRecipeCost.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.6rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Ingredient</label>
                                            <input
                                                type="text"
                                                list="raw-ingredient-suggestions"
                                                value={ingSearch}
                                                onChange={(e) => {
                                                    setIngSearch(e.target.value);
                                                    setIngErr('');
                                                }}
                                                placeholder="Type/Search ingredient..."
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: ingErr ? '#ef4444' : undefined }}
                                            />
                                            <datalist id="raw-ingredient-suggestions">
                                                {rawIngredients.map(ing => {
                                                    const effCost = getEffectiveUnitCost(ing.unit, ing.cost_per_unit || 0);
                                                    return (
                                                        <option key={ing.id} value={`${ing.name} (${ing.unit}) — ₱${effCost.toFixed(2)}/${ing.unit}`} />
                                                    );
                                                })}
                                            </datalist>
                                            {ingErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{ingErr}</div>}
                                            {(() => {
                                                const selIng = findIngredient(ingSearch);
                                                if (!selIng) return null;
                                                return (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                        Stock available: <strong style={{ color: 'var(--text-secondary)' }}>{selIng.stock_quantity} {selIng.unit}</strong>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Qty / Serving ({(() => { const s = findIngredient(ingSearch); return s ? s.unit : 'unit'; })()})</label>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                value={ingQty}
                                                onChange={(e) => { setIngQty(e.target.value); setIngQtyErr(''); }}
                                                placeholder="e.g. 25"
                                                style={{ ...inputStyle, padding: '0.55rem 0.75rem', borderColor: ingQtyErr ? '#ef4444' : undefined }}
                                            />
                                            {ingQtyErr && <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '0.25rem' }}>{ingQtyErr}</div>}
                                        </div>
                                        <div style={{ paddingTop: '1.45rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleAddDraftIngredient}
                                                style={{
                                                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    padding: '0.6rem 0.9rem', fontWeight: 600, fontSize: '0.82rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    height: '38px'
                                                }}
                                            >
                                                <Plus size={16} /> Add
                                            </button>
                                        </div>
                                    </div>

                                    {draftRecipe.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed rgba(6,182,212,0.25)', paddingTop: '0.75rem' }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                                                Recipe Ingredients ({draftRecipe.length}):
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {draftRecipe.map(item => {
                                                    const itemCost = getEffectiveUnitCost(item.unit, item.cost_per_unit) * item.quantity_required;
                                                    return (
                                                        <div key={item.ingredient_id} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            background: 'rgba(0, 0, 0, 0.03)', border: '1px solid var(--glass-border)',
                                                            borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.82rem'
                                                        }}>
                                                            <div>
                                                                <strong style={{ color: 'var(--text-primary)' }}>{item.ingredient_name}</strong>
                                                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                                                                    ({item.quantity_required} {item.unit} / serving)
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                {item.cost_per_unit > 0 && (
                                                                    <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                                                                        ₱{itemCost.toFixed(2)}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveDraftIngredient(item.ingredient_id)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {totalRecipeCost > 0 && (
                                        <div style={{
                                            marginTop: '0.85rem',
                                            padding: '0.85rem 1rem',
                                            borderRadius: '10px',
                                            background: 'rgba(16, 185, 129, 0.05)',
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '0.85rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                        Suggested Selling Price Options
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                                        {[
                                                            { label: '1.5x (33% Margin)', mult: 1.5 },
                                                            { label: '2.0x (50% Margin)', mult: 2.0 },
                                                            { label: '2.5x (60% Margin)', mult: 2.5 },
                                                        ].map(tier => {
                                                            const sugPrice = (totalRecipeCost * tier.mult).toFixed(2);
                                                            const isSelected = recipeMultiplier === tier.mult;
                                                            return (
                                                                <button
                                                                    key={tier.mult}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRecipeMultiplier(tier.mult);
                                                                        setFormData(prev => ({ ...prev, default_price: sugPrice }));
                                                                        setAddErrors(p => ({ ...p, default_price: '' }));
                                                                    }}
                                                                    style={{
                                                                        background: isSelected ? '#06b6d4' : 'rgba(6, 182, 212, 0.1)',
                                                                        color: isSelected ? '#ffffff' : '#000000',
                                                                        border: isSelected ? '1px solid #06b6d4' : '1px solid rgba(6, 182, 212, 0.35)',
                                                                        borderRadius: '6px',
                                                                        padding: '0.25rem 0.55rem',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem'
                                                                    }}
                                                                >
                                                                    <span>{tier.label}:</span>
                                                                    <strong style={{ fontSize: '0.78rem' }}>₱{sugPrice}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ borderLeft: '1px solid rgba(0,0,0,0.08)', paddingLeft: '0.85rem' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                    Suggested Price ({recipeMultiplier}x)
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#06b6d4', marginTop: '0.15rem' }}>
                                                    ₱{(totalRecipeCost * recipeMultiplier).toFixed(2)}
                                                </div>
                                            </div>

                                            <div style={{ borderLeft: '1px solid rgba(0,0,0,0.08)', paddingLeft: '0.85rem' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                    Estimated Profit / Serving
                                                </div>
                                                {(() => {
                                                    const price = parseFloat(String(formData.default_price)) || 0;
                                                    if (price <= 0) {
                                                        return (
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                                                                Set Default Price above
                                                            </div>
                                                        );
                                                    }
                                                    const profit = price - totalRecipeCost;
                                                    const margin = (profit / price) * 100;
                                                    const isProfitable = profit >= 0;
                                                    return (
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isProfitable ? '#10b981' : '#ef4444', marginTop: '0.15rem' }}>
                                                            ₱{profit.toFixed(2)}{' '}
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>
                                                                ({margin.toFixed(1)}% margin)
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    border: '1px solid rgba(139,92,246,0.2)',
                                    background: 'rgba(139,92,246,0.03)',
                                    padding: '1.2rem',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                                        <input
                                            type="checkbox"
                                            id="addInitialBatch"
                                            checked={formData.addInitialBatch}
                                            onChange={(e) => setFormData({ ...formData, addInitialBatch: e.target.checked })}
                                        />
                                        <label htmlFor="addInitialBatch" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Initial Stock Batch (Optional)</label>
                                    </div>

                                    {formData.addInitialBatch && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={labelStyle}>Quantity</label>
                                                <input
                                                    type="number" min="1"
                                                    value={formData.quantity}
                                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                                    placeholder="0"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Expiry Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.expiry_date}
                                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center',
                                padding: '1rem 1.75rem',
                                background: 'var(--bg-panel)',
                                borderTop: '1px solid var(--glass-border)',
                                flexShrink: 0
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        background: 'var(--bg-dark)',
                                        border: '1.5px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        background: 'var(--accent-primary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Adding...' : 'Add Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="glass-card" style={{ padding: '1.5rem', flex: 1, overflow: 'hidden' }}>
                {/* Search + count row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'var(--bg-panel)',
                                border: '1.5px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '0.5rem 1rem 0.5rem 2.4rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {inventory.filter(item =>
                            (selectedCategory === 'All' || normalizeCategory(item.category) === selectedCategory) &&
                            (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())))
                        ).length} products listed
                    </div>
                </div>

                {/* Category filter tabs */}
                <div style={{
                    display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
                    marginBottom: '1.25rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    {['All', ...categoryOptions].map(cat => {
                        const isActive = selectedCategory === cat;
                        const isAll = cat === 'All';
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.3rem 0.7rem',
                                    borderRadius: '8px',
                                    border: isActive ? '1.5px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                                    background: isActive ? 'var(--accent-primary)' : 'rgba(0,0,0,0.04)',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    fontSize: '0.73rem',
                                    fontWeight: isActive ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontFamily: 'inherit',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {isAll ? 'All Products' : cat}
                            </button>
                        );
                    })}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Product Details</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Category</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Base Size</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'right' }}>Price</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'right' }}>Stock Level</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ marginBottom: '0.5rem' }}>Loading Inventory...</div>
                                    </td>
                                </tr>
                            ) : inventory.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No products found in database.
                                    </td>
                                </tr>
                            ) : (
                                inventory
                                    .filter(item =>
                                        (selectedCategory === 'All' || normalizeCategory(item.category) === selectedCategory) &&
                                        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())))
                                    )
                                    .map(item => {
                                        const isOut = item.status.startsWith('Out of Stock');
                                        const isLow = item.status === 'Low Stock';
                                        const statusColor = isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';

                                        return (
                                            <tr key={item.id} style={{
                                                borderBottom: '1px solid rgba(0,0,0,0.05)',
                                                opacity: item.is_active === false ? 0.4 : 1,
                                                background: item.is_active === false ? 'rgba(0,0,0,0.05)' : 'transparent'
                                            }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: statusColor,
                                                            boxShadow: `0 0 8px ${statusColor}44`,
                                                            flexShrink: 0
                                                        }} />
                                                        {(() => {
                                                            const iconInfo = getProductIconInfo(item.name, item.category);
                                                            const IconComp = iconInfo.Icon;
                                                            return (
                                                                <div style={{
                                                                    width: '34px', height: '34px', borderRadius: '8px',
                                                                    background: iconInfo.bg,
                                                                    border: `1px solid ${iconInfo.border}`,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    flexShrink: 0
                                                                }}>
                                                                    <IconComp size={16} color={iconInfo.color} />
                                                                </div>
                                                            );
                                                        })()}
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        background: 'rgba(0,0,0,0.05)',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)'
                                                    }}>
                                                        {normalizeCategory(item.category)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {item.size ? (
                                                        <span style={{
                                                            background: 'rgba(139,92,246,0.1)',
                                                            color: '#a78bfa',
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {item.size}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                    {item.default_price != null ? `₱${Number(item.default_price).toFixed(2)}` : '—'}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {item.stock} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.unit_of_measure}</span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        background: `${statusColor}15`,
                                                        color: statusColor,
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        border: `1px solid ${statusColor}33`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => openRecipeOnlyModal(item)}
                                                            title="Recipe"
                                                            style={{
                                                                background: 'rgba(59,130,246,0.1)',
                                                                border: '1px solid rgba(59,130,246,0.25)',
                                                                color: '#60a5fa',
                                                                borderRadius: '8px',
                                                                padding: '0.4rem',
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                            }}
                                                        >
                                                            <BookOpen size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Edit"
                                                            style={{
                                                                background: 'rgba(139,92,246,0.1)',
                                                                border: '1px solid rgba(139,92,246,0.25)',
                                                                color: '#a78bfa',
                                                                borderRadius: '8px',
                                                                padding: '0.4rem',
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                            }}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteModalProduct({ id: item.id, name: item.name })}
                                                            title="Delete"
                                                            style={{
                                                                background: 'rgba(239,68,68,0.1)',
                                                                border: '1px solid rgba(239,68,68,0.25)',
                                                                color: '#ef4444',
                                                                borderRadius: '8px',
                                                                padding: '0.4rem',
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Product Confirmation Modal */}
            {deleteModalProduct && (
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
                            Delete Product?
                        </h3>

                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6B7280', lineHeight: '1.5' }}>
                            Are you sure you want to delete <strong style={{ color: '#111827' }}>"{deleteModalProduct.name}"</strong> and all of its inventory batches? This action cannot be undone.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteModalProduct(null)}
                                disabled={submitting}
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
                                onClick={confirmDeleteProduct}
                                disabled={submitting}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1.25rem',
                                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#FFFFFF',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {submitting ? 'Deleting...' : 'Delete Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;


