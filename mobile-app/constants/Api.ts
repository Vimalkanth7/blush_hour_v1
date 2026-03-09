import { Platform, Alert } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

let apiUrl = process.env.EXPO_PUBLIC_API_URL || LOCALHOST;

// Safety: Web browsers cannot reach 10.0.2.2 (which is for Android Emulator -> Host)
if (Platform.OS === 'web' && apiUrl.includes('10.0.2.2')) {
    console.warn(`[Api] Overriding invalid web URL ${apiUrl} to localhost`);
    apiUrl = 'http://localhost:8000';
}

export const API_BASE_URL = apiUrl;

export interface ApiRequestError extends Error {
    status: number;
    detail: string;
}

export interface OtpStartResponse {
    status: string;
}

export interface OtpVerifyResponse {
    access_token: string;
    token_type?: string;
}

const createApiRequestError = (status: number, detail: string): ApiRequestError => {
    const error = new Error(detail) as ApiRequestError;
    error.name = 'ApiRequestError';
    error.status = status;
    error.detail = detail;
    return error;
};

const parseResponseDetail = async (response: Response, fallbackMessage: string): Promise<string> => {
    const text = await response.text();

    if (!text) {
        return fallbackMessage;
    }

    try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
            return parsed.detail;
        }
        if (typeof parsed?.message === 'string' && parsed.message.trim()) {
            return parsed.message;
        }
    } catch {
        // Ignore parse errors and fall back to raw text.
    }

    return text.length > 200 ? fallbackMessage : text;
};

const postJson = async <TResponse>(path: string, payload: Record<string, string>, fallbackMessage: string): Promise<TResponse> => {
    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Network request failed';
        throw createApiRequestError(0, detail);
    }

    if (!response.ok) {
        const detail = await parseResponseDetail(response, fallbackMessage);
        throw createApiRequestError(response.status, detail);
    }

    try {
        return (await response.json()) as TResponse;
    } catch {
        throw createApiRequestError(response.status, fallbackMessage);
    }
};

export const isApiRequestError = (error: unknown): error is ApiRequestError => {
    if (!(error instanceof Error)) {
        return false;
    }
    return typeof (error as Partial<ApiRequestError>).status === 'number';
};

export const otpStart = async (phone: string): Promise<OtpStartResponse> => {
    return postJson<OtpStartResponse>(
        '/api/auth/otp/start',
        { phone },
        'Unable to send OTP right now.',
    );
};

export const otpVerify = async (phone: string, code: string): Promise<OtpVerifyResponse> => {
    return postJson<OtpVerifyResponse>(
        '/api/auth/otp/verify',
        { phone, code },
        'Unable to verify OTP right now.',
    );
};

export const handleApiError = async (response: Response, signOut?: () => Promise<void>) => {
    if (response.status === 429) {
        if (Platform.OS === 'web') {
            window.alert("Too many attempts. Try again in a minute.");
        } else {
            Alert.alert("Rate Limit", "Too many attempts. Try again in a minute.");
        }
        return true;
    }

    if (response.status === 403) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            const msg = (data?.detail || data?.message || "").toLowerCase();

            if (msg.includes("banned")) {
                if (Platform.OS === 'web') {
                    window.alert("Your account is restricted.");
                } else {
                    Alert.alert("Access Denied", "Your account is restricted.");
                }
                if (signOut) await signOut();
                return true;
            }
        } catch {
            // ignore
        }
    }
    return false;
};
