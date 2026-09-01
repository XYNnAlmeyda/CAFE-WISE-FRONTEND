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
import { API_ENDPOINTS } from '../../lib/api';
import { apiClient } from '../../lib/apiClient';

const SalesChart = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchChartData();
    }, []);

    const fetchChartData = async () => {
        try {
            setLoading(true);
            const { actual, forecast } = await apiClient.get(API_ENDPOINTS.ANALYTICS.SARIMAX);

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
            // This eliminates the visual "cut" between the two lines
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

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', height: '400px', animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.125rem' }}>Sales vs. SARIMAX Forecast</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 30 days actual + 7-day AI prediction</p>
                </div>
                <button
                    onClick={fetchChartData}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-muted)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                    }}
                >
                    ↻ Refresh
                </button>
            </div>

            <div style={{ height: '300px', width: '100%' }}>
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Running SARIMAX model…
                    </div>
                )}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--status-danger)', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}
                {!loading && !error && data.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '0 2rem' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📈</div>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>No sales data available yet.</p>
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
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                dx={-10}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `₱${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val} `}
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
                                formatter={(val: number | undefined) => [`₱${(val ?? 0).toFixed(2)} `]}
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
                                name="SARIMAX Forecast"
                                connectNulls
                            />
                            <Area
                                type="monotone"
                                dataKey="actual"
                                stroke="var(--accent-primary)"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorActual)"
                                name="Actual Sales"
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default SalesChart;

