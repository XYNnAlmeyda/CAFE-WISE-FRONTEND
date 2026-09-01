/**
 * Centralized API configuration.
 * Dynamically uses the same host as the frontend so LAN/network access works.
 * Override with VITE_API_BASE_URL env variable for production deployments.
 */
const rawBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
export const API_BASE_URL = rawBase.replace(/\/+$/, '');

export const API_ENDPOINTS = {
    STATS: `${API_BASE_URL}/api/dashboard/stats`,
    ALERTS: `${API_BASE_URL}/api/dashboard/alerts`,
    INVENTORY: `${API_BASE_URL}/api/inventory`,
    PRODUCTS: `${API_BASE_URL}/api/inventory`,
    SALES: `${API_BASE_URL}/api/sales`,
    WASTE: `${API_BASE_URL}/api/waste`,
    INGREDIENTS: `${API_BASE_URL}/api/ingredients`,
    RECIPES: `${API_BASE_URL}/api/recipes`,
    ACTIVITY: `${API_BASE_URL}/api/activity`,
    SHIFTS: `${API_BASE_URL}/api/shifts`,
    ANALYTICS: {
        CATEGORY: `${API_BASE_URL}/api/analytics/category`,
        WASTE_WEEKLY: `${API_BASE_URL}/api/analytics/waste_weekly`,
        SARIMAX: `${API_BASE_URL}/api/analytics/sarimax`
    }
};
