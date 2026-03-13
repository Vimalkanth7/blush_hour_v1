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

export interface PhotoUploadUrlResponse {
    upload_url: string;
    final_url: string;
    key: string;
    expires_in: number;
    required_headers: Record<string, string>;
}

export interface VoiceTokenResponse {
    url: string;
    token: string;
    room: string;
    identity: string;
    expires_in: number;
}

export type SafetyReportCategory =
    | 'harassment'
    | 'spam'
    | 'hate_speech'
    | 'nudity'
    | 'underage'
    | 'scam'
    | 'other';

export type SafetyActionKind = 'report' | 'mute' | 'block';

export interface SafetyReportOption {
    value: SafetyReportCategory;
    label: string;
}

export interface StatusOkResponse {
    status: 'ok';
}

export const SAFETY_REPORT_OPTIONS: SafetyReportOption[] = [
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'nudity', label: 'Nudity' },
    { value: 'underage', label: 'Underage' },
    { value: 'scam', label: 'Scam' },
    { value: 'other', label: 'Other' },
];

export type VoiceTokenErrorReason =
    | 'voice_unavailable'
    | 'not_engaged'
    | 'expired'
    | 'network'
    | 'unknown';

export interface VoiceTokenApiError extends ApiRequestError {
    reason: VoiceTokenErrorReason;
}

const createApiRequestError = (status: number, detail: string): ApiRequestError => {
    const error = new Error(detail) as ApiRequestError;
    error.name = 'ApiRequestError';
    error.status = status;
    error.detail = detail;
    return error;
};

const createVoiceTokenApiError = (
    status: number,
    detail: string,
    reason: VoiceTokenErrorReason,
): VoiceTokenApiError => {
    const error = createApiRequestError(status, detail) as VoiceTokenApiError;
    error.reason = reason;
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

const postJson = async <TResponse>(path: string, payload: Record<string, unknown>, fallbackMessage: string): Promise<TResponse> => {
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

const postJsonAuthenticated = async <TResponse>(
    path: string,
    payload: Record<string, unknown>,
    token: string,
    fallbackMessage: string,
): Promise<TResponse> => {
    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
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

export const isUnauthorizedApiError = (error: unknown): error is ApiRequestError => {
    return isApiRequestError(error) && error.status === 401;
};

export const isUnavailableApiError = (error: unknown): error is ApiRequestError => {
    return isApiRequestError(error) && (error.status === 403 || error.status === 404);
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

export const photoUploadUrl = async (
    content_type: string,
    content_length: number,
    token: string,
): Promise<PhotoUploadUrlResponse> => {
    return postJsonAuthenticated<PhotoUploadUrlResponse>(
        '/api/photos/upload-url',
        { content_type, content_length },
        token,
        'Unable to prepare photo upload right now.',
    );
};

export const blockUser = async (targetUserId: string, token: string): Promise<StatusOkResponse> => {
    return postJsonAuthenticated<StatusOkResponse>(
        '/api/safety/block',
        { target_user_id: targetUserId },
        token,
        'Unable to block this user right now.',
    );
};

export const muteUser = async (targetUserId: string, token: string): Promise<StatusOkResponse> => {
    return postJsonAuthenticated<StatusOkResponse>(
        '/api/safety/mute',
        { target_user_id: targetUserId },
        token,
        'Unable to mute this user right now.',
    );
};

export interface ReportUserInput {
    targetUserId: string;
    category: SafetyReportCategory;
    token: string;
    roomId?: string;
}

export const reportUser = async ({
    targetUserId,
    category,
    token,
    roomId,
}: ReportUserInput): Promise<StatusOkResponse> => {
    return postJsonAuthenticated<StatusOkResponse>(
        '/api/safety/report',
        {
            target_user_id: targetUserId,
            category,
            room_id: roomId,
        },
        token,
        'Unable to submit this report right now.',
    );
};

export const mapSafetyActionError = (action: SafetyActionKind, error: unknown): string => {
    if (isApiRequestError(error)) {
        if (error.status === 0) {
            return 'Connection issue. Try again.';
        }
        if (error.status === 401) {
            return 'Please sign in again.';
        }
        if (error.status === 403 || error.status === 404) {
            return 'This connection is no longer available.';
        }
        if (error.status === 503) {
            return action === 'block'
                ? 'This action is unavailable right now.'
                : 'Safety tools are temporarily unavailable.';
        }
    }

    if (action === 'report') {
        return 'Unable to submit this report right now.';
    }
    if (action === 'mute') {
        return 'Unable to mute this user right now.';
    }
    return 'Unable to block this user right now.';
};

export const mapVoiceTokenError = (error: unknown): VoiceTokenApiError => {
    if (isApiRequestError(error)) {
        if (error.status === 503) {
            return createVoiceTokenApiError(503, 'Voice is temporarily unavailable.', 'voice_unavailable');
        }
        if (error.status === 409) {
            return createVoiceTokenApiError(409, 'Waiting for partner to engage to start voice.', 'not_engaged');
        }
        if (error.status === 410) {
            return createVoiceTokenApiError(410, 'This Talk Room has expired or ended.', 'expired');
        }
        if (error.status === 0) {
            return createVoiceTokenApiError(0, 'Network error while connecting voice.', 'network');
        }
        return createVoiceTokenApiError(
            error.status,
            error.detail || 'Unable to start voice right now.',
            'unknown',
        );
    }

    if (error instanceof Error && error.message) {
        return createVoiceTokenApiError(0, error.message, 'unknown');
    }

    return createVoiceTokenApiError(0, 'Unable to start voice right now.', 'unknown');
};

export const voiceToken = async (token: string): Promise<VoiceTokenResponse> => {
    try {
        const response = await postJsonAuthenticated<VoiceTokenResponse>(
            '/api/voice/token',
            {},
            token,
            'Unable to start voice right now.',
        );

        if (
            typeof response.url !== 'string' ||
            typeof response.token !== 'string' ||
            typeof response.room !== 'string' ||
            typeof response.identity !== 'string' ||
            typeof response.expires_in !== 'number'
        ) {
            throw createVoiceTokenApiError(0, 'Invalid voice token response from server.', 'unknown');
        }

        return response;
    } catch (error) {
        throw mapVoiceTokenError(error);
    }
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
