import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhilippinePeso, Activity, PackageSearch, AlertCircle } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ExpiryAlerts from '../components/dashboard/ExpiryAlerts';
import { API_ENDPOINTS } from '../lib/api';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const Dashboard = () => {
    const { role } = useAuth();
    const isStaff = role === 'STAFF';
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        revenue: 0,
        revenue_change: null as number | null,
        demand: 0,
        demand_change: null as number | null,
        expiring: 0,
        expiring_change: null as number | null,
        waste: 0,
        waste_change: null as number | null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const data = await apiClient.get(API_ENDPOINTS.STATS);
            setStats(data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportReport = async () => {
        try {
            const PptxGenJS = (await import('pptxgenjs')).default;
            const pptx = new PptxGenJS();

            // Brand colors
            const BG = '0F0F1A';
            const CARD = '1A1A2E';
            const ACCENT = '8B5CF6';
            const ACCENT2 = '06B6D4';
            const TEXT = 'FFFFFF';
            const MUTED = 'A0A0C0';
            const GREEN = '10B981';
            const RED = 'EF4444';
            const YELLOW = 'F59E0B';

            pptx.layout = 'LAYOUT_WIDE';
            pptx.title = 'CafeWise Executive Summary';

            // ── Fetch data ──────────────────────────────────────────
            const [inventory, sales, waste, forecastData, shifts] = await Promise.all([
                apiClient.get(API_ENDPOINTS.INVENTORY),
                apiClient.get(API_ENDPOINTS.SALES),
                apiClient.get(API_ENDPOINTS.WASTE),
                apiClient.get(API_ENDPOINTS.ANALYTICS.SARIMAX),
                apiClient.get(API_ENDPOINTS.SHIFTS).catch(() => [])
            ]);

            const { actual: sarimaxActual, forecast } = forecastData;
            const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

            // ── Helper: dark slide background ────────────────────────
            const addBg = (slide: any) => {
                slide.background = { color: BG };
                slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.07, h: 7.5, fill: { color: ACCENT } });
            };

            // ══════════════════════════════════════════════════════
            // SLIDE 1 — Executive Title & Overview
            // ══════════════════════════════════════════════════════
            const slide1 = pptx.addSlide();
            addBg(slide1);
            slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 2.8, fill: { color: CARD } });
            slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT } });

            slide1.addText('☕ CafeWise', {
                x: 0.4, y: 0.45, w: 12, h: 0.8,
                fontSize: 38, bold: true, color: TEXT, fontFace: 'Segoe UI'
            });
            slide1.addText('Executive Operations & Business Performance Report', {
                x: 0.4, y: 1.35, w: 12, h: 0.5,
                fontSize: 18, color: MUTED, fontFace: 'Segoe UI'
            });
            slide1.addText(`Prepared for Management · Generated on ${today}`, {
                x: 0.4, y: 3.1, w: 12, h: 0.4,
                fontSize: 13, color: MUTED, fontFace: 'Segoe UI'
            });

            // Executive KPI Cards
            const activeSalesList = (sales || []).filter((s: any) => !s.refunded);
            const totalCash = activeSalesList.filter((s: any) => s.payment_method === 'CASH').reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
            const totalEwallet = activeSalesList.filter((s: any) => s.payment_method === 'E-WALLET').reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
            const totalDiscount = activeSalesList.reduce((sum: number, s: any) => sum + Number(s.discount || 0), 0);

            const kpis = [
                { label: 'Gross Revenue', value: `₱${Number(stats.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, sub: `Cash: ₱${totalCash.toLocaleString()} | E-Wallet: ₱${totalEwallet.toLocaleString()}`, color: GREEN },
                { label: 'Weekly Demand', value: `${stats.demand} units`, sub: 'Forecasted sales demand', color: ACCENT2 },
                { label: 'Senior/PWD Discounts', value: `₱${totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, sub: 'Applied customer discounts', color: YELLOW },
                { label: 'Waste & Loss', value: `₱${Number(stats.waste).toFixed(2)}`, sub: 'Logged ingredient waste', color: RED }
            ];

            kpis.forEach((k, i) => {
                const x = 0.3 + i * 3.22;
                slide1.addShape(pptx.ShapeType.roundRect, {
                    x, y: 3.9, w: 3.0, h: 2.2,
                    fill: { color: CARD },
                    line: { color: k.color, width: 1.5 },
                    rectRadius: 0.12
                });
                slide1.addText(k.label, { x, y: 4.1, w: 3.0, h: 0.4, fontSize: 10, color: MUTED, align: 'center', fontFace: 'Segoe UI' });
                slide1.addText(k.value, { x, y: 4.55, w: 3.0, h: 0.7, fontSize: 17, bold: true, color: k.color, align: 'center', fontFace: 'Segoe UI' });
                slide1.addText(k.sub, { x, y: 5.35, w: 3.0, h: 0.5, fontSize: 8.5, color: MUTED, align: 'center', fontFace: 'Segoe UI' });
            });
            slide1.addText('CafeWise Intelligent Management · Comprehensive Operational Deck', {
                x: 0, y: 7.1, w: 13.33, h: 0.35,
                fontSize: 9, color: MUTED, align: 'center', fontFace: 'Segoe UI'
            });

            // ══════════════════════════════════════════════════════
            // SLIDE 2 — Inventory Health & Stock Levels
            // ══════════════════════════════════════════════════════
            const slide2 = pptx.addSlide();
            addBg(slide2);
            slide2.addText('Inventory Health & Stock Availability', { x: 0.25, y: 0.2, w: 12, h: 0.6, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' });
            slide2.addText('Real-time ingredient stock status and reorder warnings', { x: 0.25, y: 0.75, w: 12, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' });

            const invRows: any[][] = [[
                { text: 'Product Item', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Category', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Available Stock', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Unit Price', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Health Status', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } }
            ]];
            (inventory || []).slice(0, 10).forEach((p: any, idx: number) => {
                const batchStock = (p.inventory_transactions || []).filter((b: any) => b.status === 'ACTIVE').reduce((s: number, b: any) => s + Number(b.quantity), 0);
                const stock = p.recipe_stock != null ? Number(p.recipe_stock) : batchStock;
                const status = stock === 0 ? 'Out of Stock' : stock <= (p.reorder_level || 5) ? 'Low Stock' : 'Optimal';
                const statusColor = status === 'Optimal' ? GREEN : status === 'Low Stock' ? YELLOW : RED;
                const rowFill = idx % 2 === 0 ? CARD : '16162A';
                const priceStr = p.default_price ? `₱${Number(p.default_price).toFixed(2)}` : '-';
                invRows.push([
                    { text: p.name, options: { color: TEXT, fill: { color: rowFill } } },
                    { text: p.category || 'General', options: { color: MUTED, fill: { color: rowFill } } },
                    { text: `${stock} ${p.unit_of_measure || 'pcs'}`, options: { color: TEXT, fill: { color: rowFill }, align: 'center' } },
                    { text: priceStr, options: { color: MUTED, fill: { color: rowFill }, align: 'center' } },
                    { text: status, options: { color: statusColor, bold: true, fill: { color: rowFill }, align: 'center' } }
                ]);
            });
            slide2.addTable(invRows, {
                x: 0.25, y: 1.2, w: 12.8,
                colW: [3.4, 2.4, 2.4, 2.2, 2.4],
                fontSize: 10.5, fontFace: 'Segoe UI',
                border: { type: 'solid', color: '2A2A4A', pt: 0.5 },
                rowH: 0.42
            });

            // ══════════════════════════════════════════════════════
            // SLIDE 3 — Sales & Payment Breakdown
            // ══════════════════════════════════════════════════════
            const slide3 = pptx.addSlide();
            addBg(slide3);
            slide3.addText('Sales Transactions & Revenue Breakdown', { x: 0.25, y: 0.2, w: 8, h: 0.6, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' });
            slide3.addText(`Summary of recent orders, payment channels, and discounts`, { x: 0.25, y: 0.75, w: 8, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' });

            // Sales breakdown box
            slide3.addShape(pptx.ShapeType.roundRect, { x: 9.3, y: 0.15, w: 3.8, h: 1.3, fill: { color: CARD }, line: { color: GREEN, width: 1.5 }, rectRadius: 0.12 });
            slide3.addText('Cash vs. E-Wallet Sales', { x: 9.3, y: 0.2, w: 3.8, h: 0.35, fontSize: 9.5, color: MUTED, align: 'center', fontFace: 'Segoe UI' });
            slide3.addText(`Cash: ₱${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, { x: 9.3, y: 0.55, w: 3.8, h: 0.35, fontSize: 12, bold: true, color: GREEN, align: 'center', fontFace: 'Segoe UI' });
            slide3.addText(`E-Wallet: ₱${totalEwallet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, { x: 9.3, y: 0.9, w: 3.8, h: 0.35, fontSize: 12, bold: true, color: ACCENT2, align: 'center', fontFace: 'Segoe UI' });

            const salesRows: any[][] = [[
                { text: 'Transaction Date', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Payment Method', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Discount', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Final Total', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Recorded By', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } }
            ]];
            (sales || []).slice(0, 11).forEach((s: any, idx: number) => {
                const rowFill = idx % 2 === 0 ? CARD : '16162A';
                const dateStr = new Date(s.sale_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                const isRefunded = s.refunded;
                const disc = s.discount > 0 ? `₱${Number(s.discount).toFixed(2)}` : '-';
                salesRows.push([
                    { text: dateStr, options: { color: isRefunded ? RED : MUTED, fill: { color: rowFill }, align: 'center' } },
                    { text: isRefunded ? 'REFUNDED' : (s.payment_method || 'CASH'), options: { color: isRefunded ? RED : (s.payment_method === 'E-WALLET' ? ACCENT2 : GREEN), bold: true, fill: { color: rowFill }, align: 'center' } },
                    { text: disc, options: { color: YELLOW, fill: { color: rowFill }, align: 'center' } },
                    { text: `₱${Number(s.total_amount).toFixed(2)}`, options: { color: isRefunded ? RED : GREEN, bold: true, fill: { color: rowFill }, align: 'center' } },
                    { text: s.recorded_by || 'Staff', options: { color: TEXT, fill: { color: rowFill }, align: 'center' } }
                ]);
            });
            slide3.addTable(salesRows, {
                x: 0.25, y: 1.2, w: 8.8,
                colW: [2.2, 1.8, 1.6, 1.8, 1.4],
                fontSize: 10, fontFace: 'Segoe UI',
                border: { type: 'solid', color: '2A2A4A', pt: 0.5 },
                rowH: 0.42
            });

            // ══════════════════════════════════════════════════════
            // SLIDE 4 — Register Shift Audit & Reconciliations
            // ══════════════════════════════════════════════════════
            const slide4 = pptx.addSlide();
            addBg(slide4);
            slide4.addText('Shift Register Audit & Reconciliations', { x: 0.25, y: 0.2, w: 12, h: 0.6, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' });
            slide4.addText('Staff shift opening/closing floats and register balancing', { x: 0.25, y: 0.75, w: 12, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' });

            const shiftRows: any[][] = [[
                { text: 'Shift Opener', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Opened At', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Opening Cash Float', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Closing Cash Float', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Shift Status', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } }
            ]];
            (shifts || []).slice(0, 10).forEach((st: any, idx: number) => {
                const rowFill = idx % 2 === 0 ? CARD : '16162A';
                const openTime = st.opened_at ? new Date(st.opened_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-';
                const closeCash = st.closing_cash !== null && st.closing_cash !== undefined ? `₱${Number(st.closing_cash).toFixed(2)}` : '-';
                shiftRows.push([
                    { text: st.opened_by || 'Staff', options: { color: TEXT, fill: { color: rowFill } } },
                    { text: openTime, options: { color: MUTED, fill: { color: rowFill }, align: 'center' } },
                    { text: `₱${Number(st.opening_cash || 0).toFixed(2)}`, options: { color: GREEN, fill: { color: rowFill }, align: 'center' } },
                    { text: closeCash, options: { color: ACCENT2, fill: { color: rowFill }, align: 'center' } },
                    { text: st.status || 'OPEN', options: { color: st.status === 'OPEN' ? GREEN : MUTED, bold: true, fill: { color: rowFill }, align: 'center' } }
                ]);
            });
            if ((shifts || []).length === 0) {
                shiftRows.push([
                    { text: 'No shift records found', options: { color: MUTED, fill: { color: CARD } } },
                    { text: '-', options: { color: MUTED, fill: { color: CARD }, align: 'center' } },
                    { text: '-', options: { color: MUTED, fill: { color: CARD }, align: 'center' } },
                    { text: '-', options: { color: MUTED, fill: { color: CARD }, align: 'center' } },
                    { text: '-', options: { color: MUTED, fill: { color: CARD }, align: 'center' } }
                ]);
            }
            slide4.addTable(shiftRows, {
                x: 0.25, y: 1.2, w: 12.8,
                colW: [2.8, 2.2, 2.6, 2.6, 2.6],
                fontSize: 10.5, fontFace: 'Segoe UI',
                border: { type: 'solid', color: '2A2A4A', pt: 0.5 },
                rowH: 0.42
            });

            // ══════════════════════════════════════════════════════
            // SLIDE 5 — Waste & Loss Audit
            // ══════════════════════════════════════════════════════
            const slide5 = pptx.addSlide();
            addBg(slide5);
            slide5.addText('Waste & Loss Audit', { x: 0.25, y: 0.2, w: 8, h: 0.6, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' });
            slide5.addText('Track logged waste to identify loss patterns and reduce costs', { x: 0.25, y: 0.75, w: 8, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' });

            slide5.addShape(pptx.ShapeType.roundRect, { x: 9.3, y: 0.15, w: 3.8, h: 1.2, fill: { color: CARD }, line: { color: RED, width: 1.5 }, rectRadius: 0.12 });
            slide5.addText('Total Waste Cost', { x: 9.3, y: 0.2, w: 3.8, h: 0.4, fontSize: 10, color: MUTED, align: 'center', fontFace: 'Segoe UI' });
            slide5.addText(`₱${Number(stats.waste).toFixed(2)}`, { x: 9.3, y: 0.6, w: 3.8, h: 0.65, fontSize: 22, bold: true, color: RED, align: 'center', fontFace: 'Segoe UI' });

            const wasteRows: any[][] = [[
                { text: 'Logged Date', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Item Description', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Wasted Quantity', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Recorded Reason', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } }
            ]];
            (waste || []).slice(0, 11).forEach((w: any, idx: number) => {
                const rowFill = idx % 2 === 0 ? CARD : '16162A';
                wasteRows.push([
                    { text: new Date(w.logged_date).toLocaleDateString('en-PH'), options: { color: MUTED, fill: { color: rowFill }, align: 'center' } },
                    { text: w.products?.name || 'Ingredient Item', options: { color: TEXT, fill: { color: rowFill } } },
                    { text: `${w.quantity} ${w.products?.unit_of_measure || ''}`, options: { color: YELLOW, fill: { color: rowFill }, align: 'center' } },
                    { text: w.reason || 'Spoilage', options: { color: MUTED, fill: { color: rowFill } } }
                ]);
            });
            slide5.addTable(wasteRows, {
                x: 0.25, y: 1.2, w: 8.8,
                colW: [2.2, 2.6, 1.8, 2.2],
                fontSize: 10, fontFace: 'Segoe UI',
                border: { type: 'solid', color: '2A2A4A', pt: 0.5 },
                rowH: 0.42
            });

            // ══════════════════════════════════════════════════════
            // SLIDE 6 — AI Demand Forecast (SARIMAX)
            // ══════════════════════════════════════════════════════
            const slide6 = pptx.addSlide();
            addBg(slide6);
            slide6.addText('7-Day AI Sales Demand Projection', { x: 0.25, y: 0.2, w: 8, h: 0.6, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' });
            slide6.addText('SARIMAX predictive revenue trend to optimize purchasing and staff schedule', { x: 0.25, y: 0.75, w: 8, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' });

            const totalForecasted = forecast.reduce((acc: number, f: any) => acc + f.value, 0);
            slide6.addShape(pptx.ShapeType.roundRect, { x: 9.3, y: 0.15, w: 3.8, h: 1.2, fill: { color: CARD }, line: { color: ACCENT2, width: 1.5 }, rectRadius: 0.12 });
            slide6.addText('7-Day Forecasted Revenue', { x: 9.3, y: 0.2, w: 3.8, h: 0.4, fontSize: 10, color: MUTED, align: 'center', fontFace: 'Segoe UI' });
            slide6.addText(`₱${totalForecasted.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, { x: 9.3, y: 0.6, w: 3.8, h: 0.65, fontSize: 20, bold: true, color: ACCENT2, align: 'center', fontFace: 'Segoe UI' });

            const actualPoints = (sarimaxActual || []).slice(-7);
            const allLabels = [...actualPoints, ...forecast].map((p: any) =>
                new Date(p.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
            );

            const paddedActuals = [...actualPoints.map((p: any) => p.value), ...new Array(forecast.length).fill(null)];
            const paddedForecast = [...new Array(actualPoints.length).fill(null), ...forecast.map((p: any) => p.value)];

            slide6.addChart(pptx.ChartType.line, [
                { name: 'Actual', labels: allLabels, values: paddedActuals },
                { name: 'Forecast', labels: allLabels, values: paddedForecast }
            ], {
                x: 0.25, y: 1.2, w: 8.5, h: 3.5,
                showTitle: false,
                chartColors: [ACCENT, ACCENT2],
                valAxisMinVal: 0,
                lineDataSymbol: 'circle',
                lineDataSymbolSize: 4,
                lineSize: 2,
                showLegend: true,
                legendPos: 't',
                legendColor: TEXT,
                catAxisLabelColor: MUTED,
                valAxisLabelColor: MUTED,
                catAxisLineColor: '2A2A4A',
                valAxisLineColor: '2A2A4A'
            });

            const forecastRows: any[][] = [[
                { text: 'Forecast Date', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Predicted Revenue', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } },
                { text: 'Day of Week', options: { bold: true, color: TEXT, fill: { color: ACCENT }, align: 'center' } }
            ]];
            forecast.forEach((f: any, idx: number) => {
                const rowFill = idx % 2 === 0 ? CARD : '16162A';
                const fDate = new Date(f.date + 'T00:00:00');
                const dayName = fDate.toLocaleDateString('en-PH', { weekday: 'long' });
                forecastRows.push([
                    { text: fDate.toLocaleDateString('en-PH'), options: { color: TEXT, fill: { color: rowFill }, align: 'center' } },
                    { text: `₱${f.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, options: { color: ACCENT2, bold: true, fill: { color: rowFill }, align: 'center' } },
                    { text: dayName, options: { color: MUTED, fill: { color: rowFill }, align: 'center' } }
                ]);
            });
            slide6.addTable(forecastRows, {
                x: 0.25, y: 4.8, w: 8.5,
                colW: [2.8, 2.8, 2.9],
                fontSize: 10, fontFace: 'Segoe UI',
                border: { type: 'solid', color: '2A2A4A', pt: 0.5 },
                rowH: 0.35
            });

            // ── Download Presentation ─────────────────────────────
            await pptx.writeFile({ fileName: `CafeWise_Executive_Report_${new Date().toISOString().slice(0, 10)}.pptx` });
        } catch (err) {
            console.error(err);
            alert('Failed to export PPTX report.');
        }
    };
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%'
        }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.25rem 0' }}>Overview</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Monitor your cafe's performance and inventory health.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {!isStaff && (
                        <button
                            onClick={handleExportReport}
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--glass-border-light)',
                                color: 'var(--text-primary)',
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--border-radius-sm)',
                                cursor: 'pointer',
                                fontWeight: 500,
                                transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                        >
                            Export Report
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/recipes')}
                        style={{
                            background: 'var(--accent-primary)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--accent-primary-hover)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--accent-primary)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        Log Inventory
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="dashboard-grid">

                <div className="col-span-3">
                    <StatCard
                        title="Total Revenue"
                        value={loading ? "..." : `₱${stats.revenue.toLocaleString()}`}
                        trend={stats.revenue_change !== null ? `${Math.abs(stats.revenue_change)}%` : undefined}
                        isPositive={stats.revenue_change !== null ? stats.revenue_change >= 0 : true}
                        icon={<PhilippinePeso size={20} />}
                        delay={0.1}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Forecasted Demand"
                        value={loading ? "..." : `${stats.demand.toLocaleString()} units`}
                        trend={stats.demand_change !== null ? `${Math.abs(stats.demand_change)}%` : undefined}
                        isPositive={stats.demand_change !== null ? stats.demand_change >= 0 : true}
                        icon={<Activity size={20} />}
                        delay={0.2}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Items Expiring SOON"
                        value={loading ? "..." : `${stats.expiring} batches`}
                        trend={stats.expiring_change !== null ? `${Math.abs(stats.expiring_change)}%` : undefined}
                        isPositive={stats.expiring_change !== null ? stats.expiring_change <= 0 : false}
                        icon={<AlertCircle size={20} />}
                        delay={0.3}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Waste Logged"
                        value={loading ? "..." : `₱${stats.waste.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        trend={stats.waste_change !== null ? `${Math.abs(stats.waste_change)}%` : undefined}
                        isPositive={stats.waste_change !== null ? stats.waste_change <= 0 : false}
                        icon={<PackageSearch size={20} />}
                        delay={0.4}
                    />
                </div>
            </div >

            {/* Charts & Alerts Row */}
            < div className="dashboard-grid" style={{ marginTop: '0.5rem' }}>
                {!isStaff && (
                    <div className="col-span-8">
                        <SalesChart />
                    </div>
                )}
                <div className={isStaff ? "col-span-12" : "col-span-4"}>
                    <ExpiryAlerts />
                </div>
            </div >

        </div >
    );
};

export default Dashboard;



