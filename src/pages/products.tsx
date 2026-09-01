import { useState, useEffect } from 'react';
import { Plus, Search, X, Trash2, Pencil, BookOpen, Package, Coffee, Cake, Cookie, CupSoda, AlertTriangle, EyeOff, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, API_BASE_URL } from '../lib/api';
import { apiClient } from '../lib/apiClient';

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
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Edit Product modal
    const [editProduct, setEditProduct] = useState<{ id: string; name: string } | null>(null);
    const [editForm, setEditForm] = useState({
        name: '', category: '', size: '', unit_of_measure: 'pcs', default_price: 0, is_active: true
    });

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

    useEffect(() => {
        fetchInventory();
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

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Strip fields that don't belong in the products table
            const { addInitialBatch, quantity, cost_per_unit, expiry_date, ...productData } = formData;

            await apiClient.post(`${API_BASE_URL}/api/inventory/product`, {
                ...productData,
                reorder_level: formData.reorder_level === '' ? 0 : Number(formData.reorder_level),
                default_price: formData.default_price === '' ? null : Number(formData.default_price),
            });

            // Success: Close modal, reset form, refresh data
            setIsAddModalOpen(false);
            setFormData({ name: '', category: '', sku: '', unit_of_measure: 'pcs', reorder_level: '', size: '', default_price: '', is_active: true, addInitialBatch: false, quantity: '', cost_per_unit: '', expiry_date: '' });
            fetchInventory();
        } catch (error) {
            console.error("Error adding product:", error);
            alert("Failed to add product. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        if (!window.confirm(`Delete "${name}" and all its inventory batches? This cannot be undone.`)) return;
        try {
            await apiClient.delete(`${API_ENDPOINTS.INVENTORY}/product/${id}`);
            fetchInventory();
        } catch (err) {
            alert('Failed to delete product.');
        }
    };

    const handleEditProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editProduct) return;
        setSubmitting(true);
        try {
            await apiClient.put(`${API_ENDPOINTS.INVENTORY}/product/${editProduct.id}`, {
                name: editForm.name,
                category: editForm.category,
                size: editForm.size || null,
                unit_of_measure: editForm.unit_of_measure,
                default_price: Number(editForm.default_price),
                is_active: editForm.is_active,
            });
            setEditProduct(null);
            fetchInventory();
        } catch (err) {
            alert('Failed to update product.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Product Inventory</h2>
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

            {/* EDIT PRODUCT MODAL */}
            {editProduct && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1.5rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="glass-card" style={{
                        width: '100%', maxWidth: '500px',
                        padding: '2rem', position: 'relative',
                        animation: 'slideUp 0.3s ease-out',
                        border: '1px solid rgba(0,0,0,0.08)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Edit Product</h2>
                            <button onClick={() => setEditProduct(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleEditProduct}>
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={labelStyle}>Product Name</label>
                                <input
                                    type="text" required
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Category</label>
                                    <select
                                        value={editForm.category}
                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="Coffee">Coffee</option>
                                        <option value="Milk Tea">Milk Tea</option>
                                        <option value="Fruit Soda">Fruit Soda</option>
                                        <option value="Cakes & Desserts">Cakes & Desserts</option>
                                        <option value="Bread & Pastry">Bread & Pastry</option>
                                        <option value="General">General</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Size</label>
                                    <input
                                        type="text"
                                        value={editForm.size}
                                        onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Default Price (₱)</label>
                                    <input
                                        type="number" step="0.01"
                                        value={editForm.default_price}
                                        onChange={(e) => setEditForm({ ...editForm, default_price: Number(e.target.value) })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Unit of Measure</label>
                                    <input
                                        type="text" required
                                        value={editForm.unit_of_measure}
                                        onChange={(e) => setEditForm({ ...editForm, unit_of_measure: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Default Price (₱)</label>
                                    <input
                                        type="number" step="0.01"
                                        value={editForm.default_price}
                                        onChange={(e) => setEditForm({ ...editForm, default_price: Number(e.target.value) })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>&nbsp;</label>
                                    <div style={{ visibility: 'hidden' }}>placeholder</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="edit_is_active"
                                    checked={editForm.is_active}
                                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                />
                                <label htmlFor="edit_is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Active Product</label>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditProduct(null)}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: 'transparent',
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        cursor: 'pointer'
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
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1.5rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="glass-card" style={{
                        width: '100%', maxWidth: '650px',
                        padding: '2rem', position: 'relative',
                        animation: 'slideUp 0.3s ease-out',
                        border: '1px solid rgba(0,0,0,0.08)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Add New Product</h2>
                            <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddProduct}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Product Name</label>
                                    <input
                                        type="text" required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Arabica Beans"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Category</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="e.g. Coffee"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Size / Variant</label>
                                    <input
                                        type="text"
                                        value={formData.size}
                                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                        placeholder="e.g. 500g"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Default Price (₱)</label>
                                    <input
                                        type="number" step="0.01"
                                        value={formData.default_price}
                                        onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                                        placeholder="0.00"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Unit of Measure</label>
                                    <input
                                        type="text" required
                                        value={formData.unit_of_measure}
                                        onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                        placeholder="pcs, kg, etc."
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Reorder Level</label>
                                    <input
                                        type="number"
                                        value={formData.reorder_level}
                                        onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                                        placeholder="0"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Active Product</label>
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
                                                type="number"
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

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: 'transparent',
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        cursor: 'pointer'
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '0.5rem 1rem 0.5rem 2.4rem',
                                color: 'white',
                                outline: 'none',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {inventory.length} products listed
                    </div>
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
                                        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
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
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sku || 'NO SKU'}</div>
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
                                                        {item.category || 'General'}
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
                                                            onClick={() => navigate('/recipes')}
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
                                                            onClick={() => {
                                                                setEditProduct({ id: item.id, name: item.name });
                                                                setEditForm({
                                                                    name: item.name || '',
                                                                    category: item.category || '',
                                                                    size: item.size || '',
                                                                    unit_of_measure: item.unit_of_measure || 'pcs',
                                                                    default_price: item.default_price ?? 0,
                                                                    is_active: item.is_active !== false,
                                                                });
                                                            }}
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
                                                            onClick={() => handleDeleteProduct(item.id, item.name)}
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
        </div>
    );
};

export default Inventory;


