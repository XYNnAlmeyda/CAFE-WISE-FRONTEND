/**
 * Operating Hours utilities.
 *
 * The source of truth is now the backend database (operating_hours table).
 * - getOperatingHours()   → GET  /api/admin/operating-hours  (cached in sessionStorage)
 * - saveOperatingHours()  → PUT  /api/admin/operating-hours  (via apiClient)
 * - formatTime12h()       → pure formatting utility, no network
 * - isStaffLoginAllowed() → pure time check, used by AuthContext for UX only
 *
 * NOTE: The real security enforcement is on the server (require_staff_hours dependency).
 * Client-side checks here are for UX purposes (show the error message quickly).
 */

import { apiClient } from './apiClient';
import { API_ENDPOINTS } from './api';

export interface OperatingHours {
    enabled: boolean;
    startTime: string; // "HH:MM" 24-hour format
    endTime: string;
}

// Internal DB shape (backend uses snake_case)
interface DBOperatingHours {
    id?: number;
    enabled: boolean;
    start_time: string;
    end_time: string;
    updated_at?: string;
}

// Session-level cache so we don't hit the API on every render
const CACHE_KEY = 'houseblend_ophours_cache';

function fromDB(db: DBOperatingHours): OperatingHours {
    return {
        enabled: db.enabled,
        startTime: db.start_time || '07:00',
        endTime: db.end_time || '22:00',
    };
}

function toDB(h: OperatingHours): Partial<DBOperatingHours> {
    return {
        enabled: h.enabled,
        start_time: h.startTime,
        end_time: h.endTime,
    };
}

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
    enabled: true,
    startTime: '07:00',
    endTime: '22:00',
};

/** Returns cached hours synchronously (from sessionStorage). Falls back to defaults. */
export const getOperatingHours = (): OperatingHours => {
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached) as OperatingHours;
    } catch {
        // ignore
    }
    return { ...DEFAULT_OPERATING_HOURS };
};

/**
 * Fetches operating hours from the backend API and updates the session cache.
 * Use this on Settings page load and after saving.
 */
export const fetchOperatingHours = async (): Promise<OperatingHours> => {
    try {
        const db = await apiClient.get<DBOperatingHours>(API_ENDPOINTS.OPERATING_HOURS);
        const hours = fromDB(db);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(hours));
        return hours;
    } catch (e) {
        // Return cached / default if network fails
        return getOperatingHours();
    }
};

/**
 * Saves operating hours to the backend database.
 * Updates the session cache on success.
 */
export const saveOperatingHours = async (hours: OperatingHours): Promise<void> => {
    const db = await apiClient.put<DBOperatingHours>(API_ENDPOINTS.OPERATING_HOURS, toDB(hours));
    const saved = fromDB(db);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(saved));
};

/** Format a "HH:MM" string as "h:MM AM/PM". Pure utility, no I/O. */
export const formatTime12h = (time24: string): string => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
};

/**
 * Pure time-window check. Used CLIENT-SIDE for UX only (show error quickly).
 * Real enforcement is server-side via require_staff_hours dependency.
 */
export const isStaffLoginAllowed = (hours: OperatingHours = getOperatingHours()): boolean => {
    if (!hours.enabled) return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = hours.startTime.split(':').map(Number);
    const [endH, endM] = hours.endTime.split(':').map(Number);

    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes   = endH   * 60 + (endM   || 0);

    if (startMinutes === endMinutes) return true; // equal = 24h open

    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    // Overnight window (e.g. 22:00 → 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};
