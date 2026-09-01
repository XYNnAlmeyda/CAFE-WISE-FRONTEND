import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList
} from 'recharts';
import SalesChart from '../components/dashboard/SalesChart';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';

const COLORS = ['var(--accent-primary)', 'var(--status-info)', 'var(--status-warning)', 'var(--status-danger)', 'var(--text-muted)'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Analytics = () => {
    const [categoryData, setCategoryData] = useState<{ name: string, value: number, percent: string }[]>([]);
    const [weeklyWaste, setWeeklyWaste] = useState<{ name: string, amount: number }[]>([]);

    useEffect(() => {
        fetchAnalyticsData();
    }, []);

    const fetchAnalyticsData = async () => {
        try {
            // 1. Sales by Category
            const saleItems = await apiClient.get(API_ENDPOINTS.ANALYTICS.CATEGORY);
            if (Array.isArray(saleItems)) {
                const categoryMap: Record<string, number> = {};
                saleItems.forEach((item: any) => {
                    const category = item.products?.category || 'Uncategorized';
                    const value = Number(item.quantity) * Number(item.unit_price);
                    categoryMap[category] = (categoryMap[category] || 0) + value;
                });
                const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
                const total = pieData.reduce((sum, d) => sum + d.value, 0);
                const withPercent = pieData
                    .sort((a, b) => b.value - a.value)
                    .map(d => ({ ...d, percent: total > 0 ? ((d.value / total) * 100).toFixed(1) + '%' : '0%' }));
                setCategoryData(withPercent);
            }

            // 2. Weekly Waste Log
            const wasteLogs = await apiClient.get(API_ENDPOINTS.ANALYTICS.WASTE_WEEKLY);
            if (Array.isArray(wasteLogs)) {
                const weekData = DAYS.map(day => ({ name: day, amount: 0 }));
                wasteLogs.forEach((log: any) => {
                    const date = new Date(log.logged_date);
                    const dayName = DAYS[date.getDay()];
                    const cost = log.ingredients?.cost_per_unit || 0;
                    const value = Number(log.quantity) * Number(cost);

                    const dayData = weekData.find(d => d.name === dayName);
                    if (dayData) dayData.amount += value;
                });
                const orderedWaste = [...weekData.slice(1), weekData[0]];
                setWeeklyWaste(orderedWaste);
            }
        } catch (error) {
            console.error("Error fetching analytics data:", error);
        }
    };
    return (
        <div style={{ padding: '0', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div>
                <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Analytics Deep Dive</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Advanced metrics, forecasting, and waste analysis reports.</p>
            </div>

            <div className="dashboard-grid">
                <div className="col-span-12">
                    <SalesChart />
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="col-span-6 glass-card" style={{ padding: '1.5rem', height: '350px' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Sales by Category</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart
                            data={categoryData}
                            layout="vertical"
                            margin={{ top: 0, right: 80, left: 10, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border-light)" horizontal={false} />
                            <XAxis
                                type="number"
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                tickFormatter={(v) => `₱${v}`}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={80}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                contentStyle={{ backgroundColor: 'var(--bg-panel)', backdropFilter: 'blur(12px)', borderColor: 'var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                itemStyle={{ color: 'var(--text-secondary)' }}
                                formatter={(value: number | undefined, _name: string | undefined, props: any) => [`₱${(value ?? 0).toFixed(2)} (${props.payload?.percent ?? '0%'})`, 'Revenue'] as [string, string]}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                {categoryData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                                <LabelList
                                    dataKey="percent"
                                    position="right"
                                    style={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="col-span-6 glass-card" style={{ padding: '1.5rem', height: '350px' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem' }}>Weekly Waste Log (₱ Value)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyWaste} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border-light)" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                contentStyle={{ backgroundColor: 'var(--bg-panel)', backdropFilter: 'blur(12px)', borderColor: 'var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                itemStyle={{ color: 'var(--text-secondary)' }}
                            />
                            <Bar dataKey="amount" fill="var(--status-danger)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};

export default Analytics;


