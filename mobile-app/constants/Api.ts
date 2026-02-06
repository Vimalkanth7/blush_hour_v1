import { Platform, Alert } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

let apiUrl = process.env.EXPO_PUBLIC_API_URL || LOCALHOST;

// Safety: Web browsers cannot reach 10.0.2.2 (which is for Android Emulator -> Host)
if (Platform.OS === 'web' && apiUrl.includes('10.0.2.2')) {
    console.warn(`[Api] Overriding invalid web URL ${apiUrl} to localhost`);
    apiUrl = 'http://localhost:8000';
}

export const API_BASE_URL = apiUrl;

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
        } catch (e) {
            // ignore
        }
    }
    return false;
};
