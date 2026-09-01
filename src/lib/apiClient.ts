import { supabase } from './supabase';

/**
 * Enhanced API Client that automatically attaches the Supabase JWT
 * to the Authorization header for every request.
 */
export const apiClient = {
    async get(url: string) {
        return this.request(url, { method: 'GET' });
    },

    async post(url: string, body: any) {
        return this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    async put(url: string, body: any) {
        return this.request(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    async delete(url: string) {
        return this.request(url, { method: 'DELETE' });
    },

    async request(url: string, options: RequestInit = {}) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const headers = {
            ...options.headers as Record<string, string>,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            if (response.status === 401) {
                // Potential token expiry or invalidation
                console.error('Unauthorized access. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status ${response.status}`);
        }

        return response.json();
    }
};
