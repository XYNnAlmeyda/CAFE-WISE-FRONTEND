import { useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import {
    TrendingUp,
    RefreshCw,
    Sparkles,
    X,
    Cpu,
    CheckCircle2,
    Calendar,
    Sliders,
    Layers,
    BarChart3
} from 'lucide-react';
import { API_ENDPOINTS } from '../../lib/api';
import { apiClient } from '../../lib/apiClient';

const SalesChart = () => {
    const [data, setData] = useState<any[]>([]);
    const [forecastDays, setForecastDays] = useState<number>(7);
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [productsList, setProductsList] = useState<{ id: string; name: string; category?: string }[]>([]);
    const [unitSymbol, setUnitSymbol] = useState<string>('₱');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModelModal, setShowModelModal] = useState(false);

    useEffect(() => {
        loadProductsList();
    }, []);

    useEffect(() => {
        fetchChartData(forecastDays, selectedProductId);
    }, [forecastDays, selectedProductId]);

    const loadProductsList = async () => {
        try {
            const resp = await apiClient.get(API_ENDPOINTS.PRODUCTS);
            if (Array.isArray(resp)) {
                const list = resp
                    .filter((p: any) => p.is_active !== false)
                    .map((p: any) => ({
                        id: p.id,
                        name: p.size ? `${p.name} (${p.size})` : p.name,
                        category: p.category
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setProductsList(list);
            }
        } catch (e) {
            console.error("Failed to load products list for chart filter:", e);
        }
    };

    const fetchChartData = async (days: number = forecastDays, productId: string = selectedProductId) => {
        try {
            setLoading(true);
            const url = `${API_ENDPOINTS.ANALYTICS.SARIMAX}?days=${days}${productId && productId !== 'all' ? `&product_id=${productId}` : ''}`;
            const response = await apiClient.get(url);

            setUnitSymbol(response?.unit || (productId !== 'all' ? 'units' : '₱'));
            const actual = Array.isArray(response?.actual) ? response.actual : [];
            const forecast = Array.isArray(response?.forecast) ? response.forecast : [];

            // Merge actual and forecast into a unified timeline
            const dateMap: Record<string, { name: string; actual?: number; forecast?: number }> = {};

            actual.forEach((pt: { date: string; value: number }) => {
                const label = new Date(pt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dateMap[pt.date] = { name: label, actual: pt.value };
            });

            forecast.forEach((pt: { date: string; value: number }) => {
                const label = new Date(pt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dateMap[pt.date]) {
                    dateMap[pt.date].forecast = pt.value;
                } else {
                    dateMap[pt.date] = { name: label, forecast: pt.value };
                }
            });

            // ── Bridge: make the last actual point also the 1st forecast point ──
            if (actual.length > 0 && forecast.length > 0) {
                const sortedActual = [...actual].sort((a, b) => a.date.localeCompare(b.date));
                const lastActualDate = sortedActual[sortedActual.length - 1].date;
                const lastActualValue = dateMap[lastActualDate]?.actual;
                if (lastActualValue !== undefined) {
                    dateMap[lastActualDate].forecast = lastActualValue;
                }
            }

            const sorted = Object.keys(dateMap)
                .sort()
                .map(k => dateMap[k]);

            setData(sorted);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load SARIMAX data');
        } finally {
            setLoading(false);
        }
    };

    const timeframeOptions = [
        { label: '7 Days', value: 7 },
        { label: '14 Days', value: 14 },
        { label: '30 Days', value: 30 },
        { label: '60 Days', value: 60 },
    ];

    const selectedProductName = selectedProductId === 'all'
        ? 'All Products (Store Revenue ₱)'
        : (productsList.find(p => p.id === selectedProductId)?.name || 'Selected Product Demand (Units)');

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', height: '440px', animationDelay: '0.2s', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent-primary, #8B5CF6)' }} />
                        {selectedProductName}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Historical actuals + {forecastDays}-day AI demand prediction ({unitSymbol === '₱' ? 'Revenue' : 'Item Quantity'})
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Product Filter Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product:</span>
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--glass-border)',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                outline: 'none',
                                maxWidth: '200px'
                            }}
                        >
                            <option value="all" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                                All Products (Store Revenue)
                            </option>
                            {productsList.map(p => (
                                <option key={p.id} value={p.id} style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Forecast Horizon Selector */}
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        {timeframeOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setForecastDays(opt.value)}
                                style={{
                                    background: forecastDays === opt.value ? 'var(--accent-primary, #8B5CF6)' : 'transparent',
                                    color: forecastDays === opt.value ? '#FFFFFF' : 'var(--text-muted)',
                                    border: 'none',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: forecastDays === opt.value ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* AI Model Details Modal Button */}
                    <button
                        onClick={() => setShowModelModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            color: '#C4B5FD',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Sparkles style={{ width: '0.85rem', height: '0.85rem', color: '#A78BFA' }} />
                        Model Info
                    </button>

                    <button
                        onClick={() => fetchChartData(forecastDays, selectedProductId)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-muted)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                        }}
                        title="Refresh Forecast"
                    >
                        <RefreshCw style={{ width: '0.85rem', height: '0.85rem', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            <div style={{ height: '320px', width: '100%' }}>
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '0.5rem' }}>
                        <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                        <span>Running SARIMAX model ({forecastDays}-day forecast)…</span>
                    </div>
                )}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--status-danger)', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}
                {!loading && !error && data.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '0 2rem' }}>
                        <TrendingUp style={{ width: '2rem', height: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>No forecast data available for this product.</p>
                    </div>
                )}
                {!loading && !error && data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--status-info)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--status-info)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border-light)" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                dy={10}
                                axisLine={false}
                                tickLine={false}
                                interval={forecastDays > 30 ? 6 : forecastDays > 14 ? 3 : 'preserveStartEnd'}
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                dx={-10}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => unitSymbol === '₱' ? `₱${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}` : `${val}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-panel)',
                                    backdropFilter: 'blur(12px)',
                                    borderColor: 'var(--glass-border)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)'
                                }}
                                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                itemStyle={{ color: 'var(--text-secondary)' }}
                                formatter={(val: number | undefined) => [
                                    unitSymbol === '₱'
                                        ? `₱${(val ?? 0).toFixed(2)}`
                                        : `${(val ?? 0).toFixed(1)} units`,
                                    unitSymbol === '₱' ? 'Revenue' : 'Demand'
                                ]}
                            />
                            <Legend
                                wrapperStyle={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="forecast"
                                stroke="var(--status-info)"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorForecast)"
                                name={`${forecastDays}-Day AI Forecast (${unitSymbol})`}
                                connectNulls
                            />
                            <Area
                                type="monotone"
                                dataKey="actual"
                                stroke="var(--accent-primary)"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorActual)"
                                name={`Actual ${unitSymbol === '₱' ? 'Sales' : 'Demand'}`}
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* AI Model Modal */}
            {showModelModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.45)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        maxWidth: '600px',
                        width: '100%',
                        color: '#1F2937',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15), 0 0 25px rgba(139, 92, 246, 0.1)',
                        position: 'relative'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '0.65rem',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(139, 92, 246, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Cpu style={{ width: '1.5rem', height: '1.5rem', color: '#7C3AED' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                                        AI SARIMAX Forecasting Model
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>
                                        Time Series Predictive Analytics & Exogenous Engine
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModelModal(false)}
                                style={{
                                    background: '#F3F4F6',
                                    border: '1px solid #E5E7EB',
                                    color: '#6B7280',
                                    borderRadius: '8px',
                                    padding: '0.45rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <X style={{ width: '1.1rem', height: '1.1rem' }} />
                            </button>
                        </div>

                        {/* Model Specs Badges */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '20px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#6D28D9' }}>
                                SARIMAX(1,0,1)×(0,1,0,7)
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '20px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', color: '#0991B1' }}>
                                Daily Retrained
                            </span>
                        </div>

                        {/* Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6D28D9', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    <Layers style={{ width: '0.95rem', height: '0.95rem' }} />
                                    Model Architecture
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.4' }}>
                                    Seasonal AutoRegressive Integrated Moving Average with eXogenous features.
                                </p>
                            </div>

                            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    <Calendar style={{ width: '0.95rem', height: '0.95rem' }} />
                                    Seasonality Cycle
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.4' }}>
                                    7-day weekly cyclic demand decomposition & local Taipei timezone sales mapping.
                                </p>
                            </div>

                            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284C7', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    <Sliders style={{ width: '0.95rem', height: '0.95rem' }} />
                                    Exogenous Features (Xₜ)
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.4' }}>
                                    Weekday/weekend indicators, Philippine public holidays, and live weather condition multipliers.
                                </p>
                            </div>

                            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#D97706', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    <CheckCircle2 style={{ width: '0.95rem', height: '0.95rem' }} />
                                    Prediction Horizons
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.4' }}>
                                    Rolling 7-day, 14-day, 30-day, and 60-day item & revenue forecasting.
                                </p>
                            </div>
                        </div>

                        {/* Detailed Exogenous Variables Card */}
                        <div style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '0.9rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6D28D9', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                <Sliders style={{ width: '1rem', height: '1rem' }} />
                                Exogenous Covariates Breakdown (Xₜ)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.45', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div>• <strong>Temporal & Calendar Covariates:</strong> Weekday/Weekend indicator (<code>is_weekday</code>), 7-day Mon-Sun sales velocity, and Philippine public holidays (<code>is_holiday</code>).</div>
                                <div>• <strong>Weather Elasticity Factor (Wₜ):</strong> Live weather condition multipliers (sunny, hot, rainy, stormy, cool) applied to forecast demand.</div>
                                <div>• <strong>Demand & Revenue Filtering:</strong> Product-level unit demand vs total revenue (₱), automatically filtering out refunded sales.</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowModelModal(false)}
                                style={{
                                    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                                    border: 'none',
                                    color: '#FFFFFF',
                                    padding: '0.55rem 1.35rem',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesChart;

