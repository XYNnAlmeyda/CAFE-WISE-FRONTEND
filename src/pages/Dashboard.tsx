import { useState, useEffect, useRef } from 'react';
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
    const [isExporting, setIsExporting] = useState(false);
    const [isShiftExporting, setIsShiftExporting] = useState(false);
    // Ref to abort in-flight export requests if the button is clicked again
    const exportAbortRef = useRef<AbortController | null>(null);

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

    const escapeXml = (str: any): string => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const handleExportReport = async () => {
        // Cancel any previous in-flight export (prevents stacking parallel requests)
        if (exportAbortRef.current) {
            exportAbortRef.current.abort();
        }
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setIsExporting(true);
        try {
            const [inventory, sales, waste, forecastData, shifts, staffList, ingredientsData] = await Promise.all([
                apiClient.get(API_ENDPOINTS.INVENTORY, controller.signal).catch(() => []),
                apiClient.get(API_ENDPOINTS.SALES, controller.signal).catch(() => []),
                apiClient.get(API_ENDPOINTS.WASTE, controller.signal).catch(() => []),
                apiClient.get(API_ENDPOINTS.ANALYTICS.SARIMAX, controller.signal).catch(() => ({ forecast: [] })),
                apiClient.get(API_ENDPOINTS.SHIFTS, controller.signal).catch(() => []),
                apiClient.get(API_ENDPOINTS.STAFF, controller.signal).catch(() => []),
                apiClient.get(API_ENDPOINTS.INGREDIENTS, controller.signal).catch(() => [])
            ]);

            const forecast = forecastData?.forecast || [];
            const todayStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            const fileDate = new Date().toISOString().slice(0, 10);

            // Active sales filtering & summary calculations
            const activeSalesList = (sales || []).filter((s: any) => !s.refunded);
            const refundedSalesList = (sales || []).filter((s: any) => s.refunded);
            const refundedTotal = refundedSalesList.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);

            const totalTransactions = activeSalesList.length;
            const grossRev = activeSalesList.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
            const totalDiscount = activeSalesList.reduce((sum: number, s: any) => sum + Number(s.discount || 0), 0);
            const netRev = grossRev - totalDiscount;
            const aov = totalTransactions > 0 ? grossRev / totalTransactions : 0;

            const totalCash = activeSalesList.filter((s: any) => s.payment_method === 'CASH').reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
            const totalEwallet = activeSalesList.filter((s: any) => s.payment_method?.startsWith('E-WALLET')).reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
            const totalWasteCost = Number(stats.waste || 0);
            const netMarginProxy = netRev - totalWasteCost;

            const totalForecasted = forecast.reduce((acc: number, f: any) => acc + (Number(f.value) || 0), 0);
            const avgDailyForecast = forecast.length > 0 ? totalForecasted / forecast.length : 0;

            // Inventory stats
            const totalInvItems = (inventory || []).length;
            let lowStockCount = 0;
            let outOfStockCount = 0;
            let optimalStockCount = 0;
            let totalAssetVal = 0;

            (inventory || []).forEach((p: any) => {
                const batchStock = (p.inventory_transactions || []).filter((b: any) => b.status === 'ACTIVE').reduce((s: number, b: any) => s + Number(b.quantity), 0);
                const stock = p.recipe_stock != null ? Number(p.recipe_stock) : batchStock;
                if (stock === 0) outOfStockCount++;
                else if (stock <= (p.reorder_level || 5)) lowStockCount++;
                else optimalStockCount++;
                totalAssetVal += stock * Number(p.default_price || 0);
            });

            // Recipe Ingredients Stats
            const ingredientsList = Array.isArray(ingredientsData) ? ingredientsData : [];
            const totalIngredientVal = ingredientsList.reduce((sum: number, ing: any) => sum + (Number(ing.stock_quantity || 0) * Number(ing.cost_per_unit || 0)), 0);
            const totalIngCount = ingredientsList.length;
            let lowStockIngCount = 0;
            let outOfStockIngCount = 0;
            let expiring14DaysCount = 0;
            const nowMs = Date.now();
            const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

            ingredientsList.forEach((ing: any) => {
                const qty = Number(ing.stock_quantity || 0);
                const minLvl = Number(ing.min_stock_level || 0);
                if (qty === 0) outOfStockIngCount++;
                else if (qty <= minLvl) lowStockIngCount++;

                if (ing.expiry_date) {
                    const expTime = new Date(ing.expiry_date).getTime();
                    if (!isNaN(expTime) && expTime > nowMs && (expTime - nowMs) <= fourteenDaysMs) {
                        expiring14DaysCount++;
                    }
                }
            });

            // Category Aggregation
            const catMap: Record<string, { name: string; productCount: number; unitsSold: number; totalRev: number }> = {};
            (inventory || []).forEach((p: any) => {
                const cat = p.category || 'General';
                if (!catMap[cat]) catMap[cat] = { name: cat, productCount: 0, unitsSold: 0, totalRev: 0 };
                catMap[cat].productCount++;
            });
            activeSalesList.forEach((s: any) => {
                (s.sale_items || []).forEach((item: any) => {
                    const cat = item.products?.category || 'General';
                    const qty = Number(item.quantity || 0);
                    const price = Number(item.unit_price || 0);
                    if (!catMap[cat]) catMap[cat] = { name: cat, productCount: 0, unitsSold: 0, totalRev: 0 };
                    catMap[cat].unitsSold += qty;
                    catMap[cat].totalRev += qty * price;
                });
            });
            const sortedCategories = Object.values(catMap).sort((a, b) => b.totalRev - a.totalRev);

            // Top Selling Products Aggregation
            const prodMap: Record<string, { name: string; category: string; qty: number; unitPrice: number; total: number }> = {};
            activeSalesList.forEach((s: any) => {
                (s.sale_items || []).forEach((item: any) => {
                    const name = item.products?.name || item.product_name || 'Item';
                    const qty = Number(item.quantity || 0);
                    const price = Number(item.unit_price || 0);
                    const lineTotal = qty * price;
                    if (!prodMap[name]) {
                        prodMap[name] = { name, category: item.products?.category || 'General', qty: 0, unitPrice: price, total: 0 };
                    }
                    prodMap[name].qty += qty;
                    prodMap[name].total += lineTotal;
                    if (price > 0) prodMap[name].unitPrice = price;
                });
            });
            const sortedProducts = Object.values(prodMap).sort((a, b) => b.total - a.total);
            const totalUnitsSold = sortedProducts.reduce((sum, p) => sum + p.qty, 0);

            // Payment Channel Breakdown
            const payMap: Record<string, { name: string; count: number; total: number }> = {};
            activeSalesList.forEach((s: any) => {
                const rawPm = s.payment_method || 'CASH';
                let name = rawPm;
                if (rawPm.startsWith('E-WALLET')) {
                    const provider = (rawPm.includes(':') ? rawPm.split(':')[1] : s.ewallet_provider) || 'E-Wallet';
                    name = `E-Wallet (${provider})`;
                }
                if (!payMap[name]) {
                    payMap[name] = { name, count: 0, total: 0 };
                }
                payMap[name].count += 1;
                payMap[name].total += Number(s.total_amount || 0);
            });
            const sortedPayments = Object.values(payMap).sort((a, b) => b.total - a.total);

            // Shift Register Stats
            const shiftsList = Array.isArray(shifts) ? shifts : [];
            const totalOpeningFloat = shiftsList.reduce((sum: number, st: any) => sum + Number(st.opening_cash || 0), 0);
            const totalClosingFloat = shiftsList.reduce((sum: number, st: any) => sum + Number(st.closing_cash || 0), 0);
            const netFloatVariance = totalClosingFloat - totalOpeningFloat;

            // Staff Performance Audit Map
            const staffPerfMap: Record<string, { name: string; role: string; email: string; orderCount: number; totalRev: number }> = {};
            const staffArray = Array.isArray(staffList) ? staffList : [];
            staffArray.forEach((st: any) => {
                const name = st.full_name || st.name || st.email || 'Staff';
                staffPerfMap[name] = { name, role: st.role || 'STAFF', email: st.email || '-', orderCount: 0, totalRev: 0 };
            });
            activeSalesList.forEach((s: any) => {
                const recordedName = s.recorded_by || 'Staff';
                if (!staffPerfMap[recordedName]) {
                    staffPerfMap[recordedName] = { name: recordedName, role: 'STAFF', email: '-', orderCount: 0, totalRev: 0 };
                }
                staffPerfMap[recordedName].orderCount += 1;
                staffPerfMap[recordedName].totalRev += Number(s.total_amount || 0);
            });
            const sortedStaffPerf = Object.values(staffPerfMap).sort((a, b) => b.totalRev - a.totalRev);

            let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Font ss:FontName="Segoe UI" ss:Size="15" ss:Bold="1" ss:Color="#4C1D95"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="ReportSubTitle">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#4C1D95"/>
   <Interior ss:Color="#EDE9FE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C4B5FD"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C4B5FD"/>
   </Borders>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6D28D9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4C1D95"/>
   </Borders>
  </Style>
  <Style ss:ID="DataLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="DataLeftZebra">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="DataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="DataCenterZebra">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="&#34;PHP &#34;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CurrencyZebra">
   <NumberFormat ss:Format="&#34;PHP &#34;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Number">
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberZebra">
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Percent">
   <NumberFormat ss:Format="0.0%"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="PercentZebra">
   <NumberFormat ss:Format="0.0%"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#4C1D95"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#7C3AED"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#7C3AED"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCenter">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#4C1D95"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#7C3AED"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#7C3AED"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCurrency">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#4C1D95"/>
   <NumberFormat ss:Format="&#34;PHP &#34;#,##0.00"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#7C3AED"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#7C3AED"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalNumber">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#4C1D95"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#7C3AED"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#7C3AED"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusOptimal">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#15803D"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusWarning">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#B45309"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusDanger">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#B91C1C"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>`;

            // --- SHEET 1: Executive Summary ---
            xml += `
 <Worksheet ss:Name="Executive Summary">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="270"/>
   <Column ss:Width="190"/>
   <Column ss:Width="380"/>
   <Row ss:Height="32">
    <Cell ss:StyleID="ReportTitle"><Data ss:Type="String">☕ HOUSEBLEND CAFE — EXECUTIVE OPERATIONS REPORT</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="ReportSubTitle"><Data ss:Type="String">Generated on: ${escapeXml(todayStr)} | Prepared for Cafe Management</Data></Cell>
   </Row>
   <Row ss:Height="12"></Row>

   <!-- SECTION 1: FINANCIAL & REVENUE METRICS -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">1. FINANCIAL &amp; REVENUE PERFORMANCE</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metric Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Amount / Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Operational Context &amp; Remarks</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Gross Revenue</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Total accumulated sales revenue before discounts</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Senior / PWD Discounts</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${totalDiscount}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Total mandatory customer discount savings extended</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Net Sales Revenue</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${netRev}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Net revenue generated after discounts</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Total Completed Orders</Data></Cell>
    <Cell ss:StyleID="NumberZebra"><Data ss:Type="Number">${totalTransactions}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Successful non-refunded transaction count</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Average Order Value (AOV)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${aov}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Average expenditure per customer transaction</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Cash Revenue</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${totalCash}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Sales collected in cash</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">E-Wallet Revenue</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalEwallet}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">GCash / PayMaya / GoTyme / Bank Transfers</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Refunded Sales Amount</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${refundedTotal}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Total refunded transaction value (${refundedSalesList.length} orders refunded)</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Logged Waste &amp; Loss</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalWasteCost}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Total ingredient spoilage / waste cost recorded</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Net Operating Revenue Proxy</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${netMarginProxy}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Net Sales Revenue minus Logged Spoilage Waste</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- SECTION 2: INVENTORY & ASSET HEALTH -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">2. INVENTORY &amp; ASSET HEALTH</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metric Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Amount / Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Operational Context &amp; Remarks</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Catalog Menu Products</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${totalInvItems}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Active catalog products in inventory system</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Total Stock Asset Value</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${totalAssetVal}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Monetary value of current available stock inventory</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Recipe Raw Ingredients Count</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${ingredientsList.length}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Configured raw recipe ingredients in database</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Recipe Ingredient Asset Value</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${totalIngredientVal}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Total monetary valuation of recipe ingredient inventory</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Optimal Stock Items</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${optimalStockCount}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Products maintaining healthy inventory levels</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Low Stock Warnings</Data></Cell>
    <Cell ss:StyleID="NumberZebra"><Data ss:Type="Number">${lowStockCount}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Products at or below reorder threshold</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Out of Stock Alerts</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${outOfStockCount}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Products currently depleted / unavailable</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- PRODUCTS CATALOG & STOCK LIST IN EXECUTIVE SUMMARY -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">PRODUCTS CATALOG &amp; STOCK LIST</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category / Size / Price</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Stock Quantity &amp; Status</Data></Cell>
   </Row>
${(inventory || []).map((p: any, idx: number) => {
                const isEven = idx % 2 === 1;
                const batchStock = (p.inventory_transactions || []).filter((b: any) => b.status === 'ACTIVE').reduce((s: number, b: any) => s + Number(b.quantity), 0);
                const stock = p.recipe_stock != null ? Number(p.recipe_stock) : batchStock;
                const status = stock === 0 ? 'Out of Stock' : stock <= (p.reorder_level || 5) ? 'Low Stock' : 'In Stock';
                const prodName = escapeXml(p.name || 'Product');
                const cat = escapeXml(p.category || 'General');
                const size = escapeXml(p.size || '-');
                const priceFormatted = `₱${Number(p.default_price || 0).toFixed(2)}`;

                return `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${prodName}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${cat} (${size}) — ${escapeXml(priceFormatted)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${stock} pcs | ${status}</Data></Cell>
   </Row>`;
            }).join('')}
   <Row ss:Height="14"></Row>

   <!-- SECTION 3: REGISTER & SHIFT AUDIT -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">3. SHIFT REGISTER &amp; STAFF AUDIT</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metric Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Amount / Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Operational Context &amp; Remarks</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Registered Staff Members</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${sortedStaffPerf.length}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">Active cashiers, managers, and admin users</Data></Cell>
   </Row>
${shiftsList.length === 0 ? `
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Opened Shift</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">No open shift logs recorded</Data></Cell>
   </Row>` : shiftsList.map((st: any, idx: number) => {
                const isEvenRow = idx % 2 === 1;
                const openCash = Number(st.opening_cash || 0);
                const openCashStr = openCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const opener = escapeXml(st.opened_by || 'Staff');
                const ewOpen = Number(st.opening_ewallet || 0);
                const ewStr = ewOpen > 0 ? ` and ₱${ewOpen.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} opening e-wallet` : '';

                let itemXml = `
   <Row ss:Height="22">
    <Cell ss:StyleID="${isEvenRow ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">Opened Shift</Data></Cell>
    <Cell ss:StyleID="${isEvenRow ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${openCash}</Data></Cell>
    <Cell ss:StyleID="${isEvenRow ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${opener} opened a new shift with ₱${openCashStr} opening cash${escapeXml(ewStr)}</Data></Cell>
   </Row>`;

                if (st.status === 'CLOSED' || st.closed_at) {
                    const closeCash = Number(st.closing_cash || 0);
                    const closeCashStr = closeCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const closer = escapeXml(st.closed_by || st.opened_by || 'Staff');
                    itemXml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="${!isEvenRow ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">Closed Shift</Data></Cell>
    <Cell ss:StyleID="${!isEvenRow ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${closeCash}</Data></Cell>
    <Cell ss:StyleID="${!isEvenRow ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${closer} closed shift with ₱${closeCashStr} closing cash</Data></Cell>
   </Row>`;
                }
                return itemXml;
            }).join('')}
   <Row ss:Height="14"></Row>

   <!-- SECTION 4: RECIPE INVENTORY -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">4. RECIPE INVENTORY</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Ingredient</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Stock / Cost</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Batch, Status &amp; Expiry Information</Data></Cell>
   </Row>
${ingredientsList.map((ing: any, idx: number) => {
                const isEven = idx % 2 === 1;
                const qty = Number(ing.stock_quantity || 0);
                const minLvl = Number(ing.min_stock_level || 0);
                const costUnit = Number(ing.cost_per_unit || 0);
                const unitStr = ing.unit || '';
                const expDate = ing.expiry_date ? new Date(ing.expiry_date).toLocaleDateString('en-PH') : '-';
                const ingName = escapeXml(ing.name || 'Ingredient');
                const stockFormatted = `${qty} ${unitStr}`.trim();
                const costFormatted = `₱${costUnit.toFixed(2)}/${unitStr || 'unit'}`;
                const batchStr = escapeXml(ing.batch_number || 'Main');
                const status = qty === 0 ? 'Out of Stock' : (minLvl > 0 && qty <= minLvl) ? 'Low Stock' : 'In Stock';

                return `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${ingName}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(stockFormatted)} (${escapeXml(costFormatted)})</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">Batch: ${batchStr} | Status: ${status} | Expiry: ${escapeXml(expDate)}</Data></Cell>
   </Row>`;
            }).join('')}
   <Row ss:Height="14"></Row>

   <!-- SECTION 5: PREDICTIVE AI DEMAND -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="SectionHeader"><Data ss:Type="String">5. PREDICTIVE AI DEMAND INTELLIGENCE</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Metric Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Amount / Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Operational Context &amp; Remarks</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">7-Day Demand Forecast Total</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${totalForecasted}</Data></Cell>
    <Cell ss:StyleID="DataLeft"><Data ss:Type="String">SARIMAX AI projected revenue for upcoming 7 days</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Projected Daily Average</Data></Cell>
    <Cell ss:StyleID="CurrencyZebra"><Data ss:Type="Number">${avgDailyForecast}</Data></Cell>
    <Cell ss:StyleID="DataLeftZebra"><Data ss:Type="String">Forecasted daily revenue average per shift day</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 2: Category Performance ---
            xml += `
 <Worksheet ss:Name="Category Performance">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="140"/>
   <Column ss:Width="170"/>
   <Column ss:Width="160"/>
   <Column ss:Width="150"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Units Sold</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Gross Revenue (PHP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Avg Price / Unit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Revenue Share %</Data></Cell>
   </Row>`;

            sortedCategories.forEach((c, idx) => {
                const isEven = idx % 2 === 1;
                const pct = grossRev > 0 ? c.totalRev / grossRev : 0;
                const avgPrice = c.unitsSold > 0 ? c.totalRev / c.unitsSold : 0;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(c.name)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${c.productCount}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${c.unitsSold}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${c.totalRev}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${avgPrice}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'PercentZebra' : 'Percent'}"><Data ss:Type="Number">${pct}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL CATEGORIES (${sortedCategories.length})</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalInvItems}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalUnitsSold}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">1</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 3: Top Selling Products ---
            xml += `
 <Worksheet ss:Name="Top Selling Products">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="60"/>
   <Column ss:Width="240"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="150"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Units Sold</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Unit Price</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Gross Sales (PHP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Sales Share %</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cumulative Share %</Data></Cell>
   </Row>`;

            let cumulativeRev = 0;
            sortedProducts.forEach((p, idx) => {
                const isEven = idx % 2 === 1;
                const pct = grossRev > 0 ? p.total / grossRev : 0;
                cumulativeRev += p.total;
                const cumPct = grossRev > 0 ? cumulativeRev / grossRev : 0;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(p.category)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${p.qty}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${p.unitPrice}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${p.total}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'PercentZebra' : 'Percent'}"><Data ss:Type="Number">${pct}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'PercentZebra' : 'Percent'}"><Data ss:Type="Number">${cumPct}</Data></Cell>
   </Row>`;
            });

            // Summary row for Top Products
            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL PRODUCTS SOLD</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalUnitsSold}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">1</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">1</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 4: Inventory Health ---
            xml += `
 <Worksheet ss:Name="Inventory Health">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="240"/>
   <Column ss:Width="140"/>
   <Column ss:Width="90"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Size</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Price (PHP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Stock</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
   </Row>`;

            (inventory || []).forEach((p: any, idx: number) => {
                const batchStock = (p.inventory_transactions || []).filter((b: any) => b.status === 'ACTIVE').reduce((s: number, b: any) => s + Number(b.quantity), 0);
                const stock = p.recipe_stock != null ? Number(p.recipe_stock) : batchStock;
                const status = stock === 0 ? 'Out of Stock' : stock <= (p.reorder_level || 5) ? 'Low Stock' : 'In Stock';
                const statusStyle = status === 'In Stock' ? 'StatusOptimal' : status === 'Low Stock' ? 'StatusWarning' : 'StatusDanger';
                const isEven = idx % 2 === 1;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(p.category || 'General')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(p.size || '-')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${p.default_price || 0}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${stock} pcs</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${status}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL PRODUCTS (${(inventory || []).length} Items)</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalAssetVal}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 5: Recipe & Ingredient Inventory ---
            xml += `
 <Worksheet ss:Name="Recipe Inventory">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="150"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Ingredient</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Stock</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cost</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Expiry</Data></Cell>
   </Row>`;

            ingredientsList.forEach((ing: any, idx: number) => {
                const isEven = idx % 2 === 1;
                const qty = Number(ing.stock_quantity || 0);
                const minLvl = Number(ing.min_stock_level || 0);
                const costUnit = Number(ing.cost_per_unit || 0);
                const unitStr = ing.unit || '';
                const expDate = ing.expiry_date ? new Date(ing.expiry_date).toLocaleDateString('en-PH') : '-';

                const ingName = ing.name || 'Ingredient';
                const stockFormatted = `${qty} ${unitStr}`.trim();
                const costFormatted = `₱${costUnit.toFixed(2)}/${unitStr || 'unit'}`;

                const status = qty === 0 ? 'Out of Stock' : (minLvl > 0 && qty <= minLvl) ? 'Low Stock' : 'In Stock';
                const statusStyle = status === 'In Stock' ? 'StatusOptimal' : status === 'Low Stock' ? 'StatusWarning' : 'StatusDanger';

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(ingName)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(ing.batch_number || 'Main')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(stockFormatted)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(costFormatted)}</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${status}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(expDate)}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL RECIPE INGREDIENTS (${totalIngCount} Items)</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalIngredientVal}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 6: Sales Transactions ---
            xml += `
 <Worksheet ss:Name="Sales Transactions">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="160"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Column ss:Width="160"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Payment Method</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Reference No.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Discount</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Amount</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Recorded By</Data></Cell>
   </Row>`;

            (sales || []).forEach((s: any, idx: number) => {
                const dateStr = new Date(s.sale_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                const pm = s.refunded ? 'REFUNDED' : (s.payment_method || 'CASH');
                const isEven = idx % 2 === 1;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(dateStr)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(pm)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(s.reference_number || '-')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${s.discount || 0}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${s.total_amount || 0}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(s.recorded_by || 'Staff')}</Data></Cell>
   </Row>`;
            });

            // Sales Total Row
            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL SALES (${activeSalesList.length} Orders)</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalDiscount}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 6: Payment Channels & E-Wallets ---
            xml += `
 <Worksheet ss:Name="Payment Channels">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="180"/>
   <Column ss:Width="140"/>
   <Column ss:Width="160"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Payment Channel</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transactions Count</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Volume (PHP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Revenue Share %</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Avg Ticket Size</Data></Cell>
   </Row>`;

            sortedPayments.forEach((p, idx) => {
                const isEven = idx % 2 === 1;
                const pct = grossRev > 0 ? p.total / grossRev : 0;
                const avgTicket = p.count > 0 ? p.total / p.count : 0;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${p.count}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${p.total}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'PercentZebra' : 'Percent'}"><Data ss:Type="Number">${pct}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${avgTicket}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL PAYMENT CHANNELS</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalTransactions}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">1</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${aov}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 7: Shift Register Audit ---
            xml += `
 <Worksheet ss:Name="Shift Audit">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="160"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="160"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opened By</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opened At</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opening Float</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Closing Float</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Float Variance</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
   </Row>`;

            shiftsList.forEach((st: any, idx: number) => {
                const openTime = st.opened_at ? new Date(st.opened_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-';
                const isEven = idx % 2 === 1;
                const openCash = Number(st.opening_cash || 0);
                const closeCash = Number(st.closing_cash || 0);
                const variance = closeCash - openCash;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(st.opened_by || 'Staff')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(openTime)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${openCash}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${closeCash}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${variance}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(st.status || 'OPEN')}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL SHIFT AUDIT (${shiftsList.length} Sessions)</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalOpeningFloat}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalClosingFloat}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${netFloatVariance}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 8: Waste & Loss Audit ---
            xml += `
 <Worksheet ss:Name="Waste Logs">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="140"/>
   <Column ss:Width="220"/>
   <Column ss:Width="140"/>
   <Column ss:Width="240"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Log Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Item Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Wasted Qty</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Reason</Data></Cell>
   </Row>`;

            (waste || []).forEach((w: any, idx: number) => {
                const dStr = new Date(w.logged_date).toLocaleDateString('en-PH');
                const isEven = idx % 2 === 1;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(dStr)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(w.products?.name || 'Ingredient Item')}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${w.quantity || 0}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(w.reason || 'Spoilage')}</Data></Cell>
   </Row>`;
            });

            // Waste Summary Row
            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL LOGGED LOSS</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">${(waste || []).length} Logs</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalWasteCost}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 9: 7-Day AI Forecast ---
            xml += `
 <Worksheet ss:Name="AI 7-Day Forecast">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="180"/>
   <Column ss:Width="220"/>
   <Column ss:Width="260"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Forecast Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Day of Week</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Predicted Revenue</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Demand Outlook</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Operational Action Advice</Data></Cell>
   </Row>`;

            (forecast || []).forEach((f: any, idx: number) => {
                const fDate = new Date(f.date + 'T00:00:00');
                const dayName = fDate.toLocaleDateString('en-PH', { weekday: 'long' });
                const dateFormatted = fDate.toLocaleDateString('en-PH');
                const isEven = idx % 2 === 1;
                const val = Number(f.value) || 0;
                const outlook = val > 3000 ? 'High Sales Expected' : val > 1500 ? 'Normal Sales' : 'Low Traffic';
                const advice = val > 3000 ? 'Prepare extra espresso beans & milk batching' : val > 1500 ? 'Standard ingredient preparation' : 'Optimize staffing & reduce inventory waste';

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(dateFormatted)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(dayName)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${val}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(outlook)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(advice)}</Data></Cell>
   </Row>`;
            });

            // Forecast Total Row
            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL 7-DAY FORECAST</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">7 Days Projected</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalForecasted}</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

            // --- SHEET 10: Staff Directory & Audit ---
            xml += `
 <Worksheet ss:Name="Staff Performance Audit">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="200"/>
   <Column ss:Width="220"/>
   <Column ss:Width="130"/>
   <Column ss:Width="150"/>
   <Column ss:Width="180"/>
   <Column ss:Width="160"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Staff Member Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Email Address</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">System Role</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Orders Processed</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Sales Volume (PHP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Avg Order Size</Data></Cell>
   </Row>`;

            sortedStaffPerf.forEach((st, idx) => {
                const isEven = idx % 2 === 1;
                const avgStaffTicket = st.orderCount > 0 ? st.totalRev / st.orderCount : 0;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(st.name)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataLeftZebra' : 'DataLeft'}"><Data ss:Type="String">${escapeXml(st.email)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'DataCenterZebra' : 'DataCenter'}"><Data ss:Type="String">${escapeXml(st.role)}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'NumberZebra' : 'Number'}"><Data ss:Type="Number">${st.orderCount}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${st.totalRev}</Data></Cell>
    <Cell ss:StyleID="${isEven ? 'CurrencyZebra' : 'Currency'}"><Data ss:Type="Number">${avgStaffTicket}</Data></Cell>
   </Row>`;
            });

            xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL STAFF MEMBERS (${sortedStaffPerf.length})</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalTransactions}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${grossRev}</Data></Cell>
    <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${aov}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

            const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CafeWise_Executive_Report_${fileDate}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error(err);
            alert('Failed to export Excel report.');
        }
    };

    const handleShiftReport = async () => {
        if (isShiftExporting) return;
        setIsShiftExporting(true);
        try {
            const shifts: any[] = await apiClient.get(API_ENDPOINTS.SHIFTS).catch(() => []);
            const fileDate = new Date().toISOString().slice(0, 10);
            const reportDate = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

            const styles = `
 <Styles>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#0d6efd"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="SubTitle"><Font ss:Italic="1" ss:Size="10" ss:Color="#6c757d"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#0d6efd" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style>
  <Style ss:ID="DataLeft"><Font ss:Size="9"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="DataCenter"><Font ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="Currency"><NumberFormat ss:Format="\u20b1#,##0.00"/><Font ss:Size="9"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="DataLeftZ"><Font ss:Size="9"/><Interior ss:Color="#f0f4ff" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="DataCenterZ"><Font ss:Size="9"/><Interior ss:Color="#f0f4ff" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="CurrencyZ"><NumberFormat ss:Format="\u20b1#,##0.00"/><Font ss:Size="9"/><Interior ss:Color="#f0f4ff" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dee2e6"/></Borders></Style>
  <Style ss:ID="GoodNum"><NumberFormat ss:Format="\u20b1#,##0.00"/><Font ss:Size="9" ss:Color="#198754" ss:Bold="1"/><Alignment ss:Horizontal="Right"/></Style>
  <Style ss:ID="BadNum"><NumberFormat ss:Format="\u20b1#,##0.00"/><Font ss:Size="9" ss:Color="#dc3545" ss:Bold="1"/><Alignment ss:Horizontal="Right"/></Style>
  <Style ss:ID="TotalRow"><Font ss:Bold="1" ss:Size="10" ss:Color="#0d6efd"/><Interior ss:Color="#e7f0ff" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style>
  <Style ss:ID="TotalCur"><NumberFormat ss:Format="\u20b1#,##0.00"/><Font ss:Bold="1" ss:Size="10" ss:Color="#0d6efd"/><Interior ss:Color="#e7f0ff" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style>
 </Styles>`;

            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${styles}\n`;

            xml += `
 <Worksheet ss:Name="Shift Report">
  <Table ss:FullColumns="1" ss:FullRows="1">
   <Column ss:Width="60"/>
   <Column ss:Width="155"/>
   <Column ss:Width="155"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="10" ss:StyleID="Title"><Data ss:Type="String">CAFE-WISE SHIFT REPORT — ${escapeXml(reportDate)}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="10" ss:StyleID="SubTitle"><Data ss:Type="String">Last ${shifts.length} shifts (most recent first)</Data></Cell>
   </Row>
   <Row ss:Height="8"></Row>
   <Row ss:Height="26">
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opened At</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Closed At</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opened By</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Closed By</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opening Cash</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Closing Cash</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cash Diff</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Opening E-Wallet</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Closing E-Wallet</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status / Notes</Data></Cell>
   </Row>`;

            shifts.forEach((sh: any, idx: number) => {
                const isZ = idx % 2 === 1;
                const dL = isZ ? 'DataLeftZ' : 'DataLeft';
                const dC = isZ ? 'DataCenterZ' : 'DataCenter';
                const cur = isZ ? 'CurrencyZ' : 'Currency';
                const openAt = sh.opened_at ? new Date(sh.opened_at).toLocaleString('en-PH') : '-';
                const closeAt = sh.closed_at ? new Date(sh.closed_at).toLocaleString('en-PH') : '-';
                const openCash = Number(sh.opening_cash || 0);
                const closeCash = Number(sh.closing_cash || 0);
                const openEw = Number(sh.opening_ewallet || 0);
                const closeEw = Number(sh.closing_ewallet || 0);
                const cashDiff = sh.status === 'CLOSED' ? closeCash - openCash : null;
                const diffStyle = cashDiff === null ? cur : cashDiff >= 0 ? 'GoodNum' : 'BadNum';
                const statusNote = `${sh.status || 'OPEN'}${sh.notes ? ' | ' + sh.notes : ''}`;

                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${dC}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="${dC}"><Data ss:Type="String">${escapeXml(openAt)}</Data></Cell>
    <Cell ss:StyleID="${dC}"><Data ss:Type="String">${escapeXml(closeAt)}</Data></Cell>
    <Cell ss:StyleID="${dL}"><Data ss:Type="String">${escapeXml(sh.opened_by || '-')}</Data></Cell>
    <Cell ss:StyleID="${dL}"><Data ss:Type="String">${escapeXml(sh.closed_by || '-')}</Data></Cell>
    <Cell ss:StyleID="${cur}"><Data ss:Type="Number">${openCash}</Data></Cell>
    <Cell ss:StyleID="${cur}"><Data ss:Type="Number">${closeCash}</Data></Cell>
    <Cell ss:StyleID="${diffStyle}"><Data ss:Type="Number">${cashDiff ?? 0}</Data></Cell>
    <Cell ss:StyleID="${cur}"><Data ss:Type="Number">${openEw}</Data></Cell>
    <Cell ss:StyleID="${cur}"><Data ss:Type="Number">${closeEw}</Data></Cell>
    <Cell ss:StyleID="${dL}"><Data ss:Type="String">${escapeXml(statusNote)}</Data></Cell>
   </Row>`;
            });

            // Totals row
            const totalOpenCash = shifts.reduce((s: number, sh: any) => s + Number(sh.opening_cash || 0), 0);
            const totalCloseCash = shifts.reduce((s: number, sh: any) => s + Number(sh.closing_cash || 0), 0);
            const totalOpenEw = shifts.reduce((s: number, sh: any) => s + Number(sh.opening_ewallet || 0), 0);
            const totalCloseEw = shifts.reduce((s: number, sh: any) => s + Number(sh.closing_ewallet || 0), 0);
            const closedCount = shifts.filter((sh: any) => sh.status === 'CLOSED').length;

            xml += `
   <Row ss:Height="22">
    <Cell ss:MergeAcross="4" ss:StyleID="TotalRow"><Data ss:Type="String">TOTALS — ${shifts.length} Shifts (${closedCount} Closed)</Data></Cell>
    <Cell ss:StyleID="TotalCur"><Data ss:Type="Number">${totalOpenCash}</Data></Cell>
    <Cell ss:StyleID="TotalCur"><Data ss:Type="Number">${totalCloseCash}</Data></Cell>
    <Cell ss:StyleID="TotalCur"><Data ss:Type="Number">${totalCloseCash - totalOpenCash}</Data></Cell>
    <Cell ss:StyleID="TotalCur"><Data ss:Type="Number">${totalOpenEw}</Data></Cell>
    <Cell ss:StyleID="TotalCur"><Data ss:Type="Number">${totalCloseEw}</Data></Cell>
    <Cell ss:StyleID="TotalRow"><Data ss:Type="String">-</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

            const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CafeWise_ShiftReport_${fileDate}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Failed to export shift report.');
        } finally {
            setIsShiftExporting(false);
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
                    {!isStaff && (
                        <button
                            onClick={handleShiftReport}
                            disabled={isShiftExporting}
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--glass-border-light)',
                                color: 'var(--text-primary)',
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--border-radius-sm)',
                                cursor: isShiftExporting ? 'not-allowed' : 'pointer',
                                fontWeight: 500,
                                opacity: isShiftExporting ? 0.7 : 1,
                                transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => { if (!isShiftExporting) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                        >
                            {isShiftExporting ? 'Exporting...' : 'Shift Report'}
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
                        value={loading ? "..." : `₱${Number(stats.revenue || 0).toLocaleString()}`}
                        trend={stats.revenue_change !== null && stats.revenue_change !== undefined ? `${Math.abs(stats.revenue_change)}%` : undefined}
                        isPositive={stats.revenue_change !== null && stats.revenue_change !== undefined ? stats.revenue_change >= 0 : true}
                        icon={<PhilippinePeso size={20} />}
                        delay={0.1}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Forecasted Demand"
                        value={loading ? "..." : `${Number(stats.demand || 0).toLocaleString()} units`}
                        trend={stats.demand_change !== null && stats.demand_change !== undefined ? `${Math.abs(stats.demand_change)}%` : undefined}
                        isPositive={stats.demand_change !== null && stats.demand_change !== undefined ? stats.demand_change >= 0 : true}
                        icon={<Activity size={20} />}
                        delay={0.2}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Expiry"
                        value={loading ? "..." : `${stats.expiring || 0} batches`}
                        trend={stats.expiring_change !== null && stats.expiring_change !== undefined ? `${Math.abs(stats.expiring_change)}%` : undefined}
                        isPositive={stats.expiring_change !== null && stats.expiring_change !== undefined ? stats.expiring_change <= 0 : false}
                        icon={<AlertCircle size={20} />}
                        delay={0.3}
                    />
                </div>
                <div className="col-span-3">
                    <StatCard
                        title="Waste Logged"
                        value={loading ? "..." : `₱${Number(stats.waste || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        trend={stats.waste_change !== null && stats.waste_change !== undefined ? `${Math.abs(stats.waste_change)}%` : undefined}
                        isPositive={stats.waste_change !== null && stats.waste_change !== undefined ? stats.waste_change <= 0 : false}
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



