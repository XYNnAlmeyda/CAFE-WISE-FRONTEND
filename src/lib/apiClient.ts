import { supabase } from './supabase';

// ── Request configuration ─────────────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 30_000;  // 30 seconds — prevents UI hanging forever
const MAX_RETRIES = 2;              // Retry up to 2 times on transient 5xx errors
const RETRY_DELAY_MS = 800;         // Base delay between retries (doubles each attempt)

/** HTTP status codes that are safe to retry (transient server errors). */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/**
 * Enhanced API Client that automatically attaches the Supabase JWT
 * to the Authorization header for every request.
 *
 * Features:
 * - Automatic 30-second request timeout (AbortController)
 * - Exponential-backoff retry on 502/503/504
 * - Content-Type validation before JSON parsing
 */
export const apiClient = {
    async get<T = any>(url: string, signal?: AbortSignal): Promise<T> {
        return this.request<T>(url, { method: 'GET' }, signal);
    },

    async post<T = any>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
        return this.request<T>(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        }, signal);
    },

    async put<T = any>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
        return this.request<T>(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        }, signal);
    },

    async patch<T = any>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
        return this.request<T>(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        }, signal);
    },

    async delete<T = any>(url: string, signal?: AbortSignal): Promise<T> {
        return this.request<T>(url, { method: 'DELETE' }, signal);
    },

    async request<T = any>(url: string, options: RequestInit = {}, externalSignal?: AbortSignal): Promise<T> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> | undefined),
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        let lastError: Error = new Error('Request failed');

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            // Create a per-attempt AbortController that respects any external signal
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(
                () => timeoutController.abort(new DOMException('Request timed out', 'TimeoutError')),
                REQUEST_TIMEOUT_MS
            );

            // Combine timeout signal with optional caller-supplied signal
            const signal = externalSignal
                ? AbortSignal.any
                    ? AbortSignal.any([timeoutController.signal, externalSignal])
                    : timeoutController.signal   // fallback for older browsers
                : timeoutController.signal;

            try {
                const response = await fetch(url, { ...options, headers, signal });
                clearTimeout(timeoutId);

                // On retryable status codes, wait and retry (except on last attempt)
                if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
                    console.warn(`[apiClient] ${response.status} on ${url} — retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                if (!response.ok) {
                    if (response.status === 401) {
                        console.error('[apiClient] Unauthorized — please login again.');
                    }

                    // Safely parse error details
                    const contentType = response.headers.get('content-type') || '';
                    const errorData = contentType.includes('application/json')
                        ? await response.json().catch(() => ({}))
                        : {};
                    throw new Error(
                        (errorData as Record<string, string>).detail ||
                        `API request failed with status ${response.status}`
                    );
                }

                // Validate response Content-Type before calling .json()
                const ct = response.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    // Some endpoints return 204 No Content or plain text on success
                    if (response.status === 204) return null as unknown as T;
                    const text = await response.text();
                    console.warn(`[apiClient] Non-JSON response from ${url}: ${text.slice(0, 100)}`);
                    return null as unknown as T;
                }

                return response.json();

            } catch (err) {
                clearTimeout(timeoutId);

                if (err instanceof DOMException && err.name === 'AbortError') {
                    // Check if this was our timeout or an external abort
                    if (externalSignal?.aborted) {
                        throw new Error('Request was cancelled');
                    }
                    throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Please check your connection and try again.`);
                }

                lastError = err as Error;

                // Don't retry on explicit errors (only on retryable HTTP statuses handled above)
                if (attempt >= MAX_RETRIES) break;
            }
        }

        throw lastError;
    }
};
