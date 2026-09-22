/**
 * Centralized API configuration.
 * Dynamically uses the same host as the frontend so LAN/network access works.
 * Override with VITE_API_BASE_URL env variable for production deployments.
 */
const rawBase = import.meta.env.VITE_API_BASE_URL || 'https://mlxxc.site';
export const API_BASE_URL = rawBase.replace(/\/+$/, '');

export const API_ENDPOINTS = {
    STATS: `${API_BASE_URL}/api/dashboard/stats`,
    ALERTS: `${API_BASE_URL}/api/dashboard/alerts`,
    INVENTORY: `${API_BASE_URL}/api/inventory`,
    PRODUCTS: `${API_BASE_URL}/api/inventory`,
    SALES: `${API_BASE_URL}/api/sales`,
    WASTE: `${API_BASE_URL}/api/waste`,
    INGREDIENTS: `${API_BASE_URL}/api/ingredients`,
    EXPIRE_CHECK: `${API_BASE_URL}/api/ingredients/expire-check`,
    RECIPES: `${API_BASE_URL}/api/recipes`,
    RECIPE_USAGE: `${API_BASE_URL}/api/recipes/usage/all`,
    ACTIVITY: `${API_BASE_URL}/api/activity`,
    SHIFTS: `${API_BASE_URL}/api/shifts`,
    STAFF: `${API_BASE_URL}/api/admin/staff`,
    ASSIGNMENTS: `${API_BASE_URL}/api/inventory/assignments`,
    ASSIGN: `${API_BASE_URL}/api/inventory/assign`,
    ANALYTICS: {
        CATEGORY: `${API_BASE_URL}/api/analytics/category`,
        WASTE_WEEKLY: `${API_BASE_URL}/api/analytics/waste_weekly`,
        SARIMAX: `${API_BASE_URL}/api/analytics/sarimax`,
        PRODUCT_FORECASTS: `${API_BASE_URL}/api/analytics/product_forecasts`
    },
    OPERATING_HOURS: `${API_BASE_URL}/api/admin/operating-hours`,
    VERIFY_LOGIN: `${API_BASE_URL}/api/auth/verify-login`,
};
