import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL, handleApiError } from '../constants/Api';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { Platform, Alert } from 'react-native';

interface UserProfile {
    phone_number: string;
    first_name?: string;
    description?: string; // Sometimes used for role in some systems, but let's be explicit
    role?: 'user' | 'admin';
    onboarding_completed: boolean;
    profile_completion?: number; // Backend calculated
    profile_strength?: {
        completion_percent: number;
        missing_fields: string[];
        tier: "Gold" | "Silver" | "Bronze";
    };
    birth_date?: string;

    // Profile Fields
    photos: (string | null)[];
    bio?: string;
    gender?: string;
    dating_preference?: string;
    height?: string;
    work?: string;
    education?: string;
    education_level?: string;
    hometown?: string;
    location?: string;

    // Habits & Details
    habits?: {
        exercise?: string;
        drinking?: string;
        smoking?: string;
        kids?: string;
    };
    kids_have?: string;
    kids_want?: string;
    star_sign?: string;
    politics?: string;
    religion?: string;

    // Lists
    interests?: string[];
    values?: string[];
    causes?: string[];
    languages?: string[];
    prompts?: { question: string; answer: string }[];
}

interface AuthContextProps {
    user: UserProfile | null;
    token: string | null;
    isLoading: boolean;
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
    user: null,
    token: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [sessionReady, setSessionReady] = useState(false);

    const router = useRouter();
    const segments = useSegments();

    // Use a ref to prevent double-navigating in the same tick or render cycle if unnecessary
    const hasRoutedRef = React.useRef(false);

    const API_URL = `${API_BASE_URL}/api`;

    useEffect(() => {
        const loadSession = async () => {
            try {
                let storedToken;
                if (Platform.OS === 'web') {
                    storedToken = localStorage.getItem('auth_token');
                } else {
                    storedToken = await SecureStore.getItemAsync('auth_token');
                }

                console.log("[AuthContext] Load Session: Token exists?", !!storedToken);

                if (storedToken) {
                    setToken(storedToken);
                    await fetchProfile(storedToken);
                }
            } catch (e) {
                console.error("[AuthContext] Failed to load session", e);
            } finally {
                setIsLoading(false);
                setSessionReady(true);
            }
        };
        loadSession();
    }, []);

    const fetchProfile = async (authToken: string) => {
        try {
            console.log(`[AuthContext] Fetching Profile from: ${API_URL}/users/me`);
            const res = await fetch(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            console.log("[AuthContext] Profile Response Status:", res.status);

            if (await handleApiError(res, signOut)) {
                return;
            }

            if (res.ok) {
                const userData = await res.json();
                console.log("[AuthContext] User loaded:", userData.phone_number, "Completed:", userData.onboarding_completed);
                setUser(userData);
            } else {
                console.warn("[AuthContext] Token invalid or user deleted");
                await signOut();
            }
        } catch (e) {
            console.error("[AuthContext] Fetch profile failed", e);
        }
    };

    const signIn = async (newToken: string) => {
        setIsLoading(true);
        try {
            if (Platform.OS === 'web') {
                localStorage.setItem('auth_token', newToken);
            } else {
                await SecureStore.setItemAsync('auth_token', newToken);
            }
            setToken(newToken);
            await fetchProfile(newToken);
        } catch (e) {
            console.error("Sign in failed", e);
        } finally {
            setIsLoading(false);
            setSessionReady(true);
        }
    };

    const signOut = async () => {
        try {
            if (Platform.OS === 'web') {
                localStorage.removeItem('auth_token');
            } else {
                await SecureStore.deleteItemAsync('auth_token');
            }
            setToken(null);
            setUser(null);
            hasRoutedRef.current = false;
            router.replace('/(auth)/welcome');
        } catch (e) {
            console.error("Sign out failed", e);
        }
    };

    const refreshProfile = async () => {
        if (token) await fetchProfile(token);
    };

    // ✅ Navigation Gate Logic (FIXED for Modals)
    useEffect(() => {
        if (!sessionReady) return;

        // segments sometimes starts empty -> do NOT redirect yet
        if (!segments || (segments as string[]).length === 0) return;

        const group = segments[0]; // "(auth)" | "(onboarding)" | "(tabs)" | "modal"
        const inAuth = group === '(auth)';
        const inOnboarding = group === '(onboarding)';
        const inTabs = group === '(tabs)';
        const inModal = group === 'modal'; // Check for modal segment

        // If we have a token but user hasn't been loaded yet, don't redirect.
        // Wait for fetchProfile to populate user or invalidate token.
        if (token && !user) return;

        // ✅ PATCH: Do not redirect if we are inside a modal
        if (inModal) {
            console.log("[AuthContext] Inside modal, skipping redirect checks.");
            return;
        }

        let target: string | null = null;
        let shouldRedirect = false;

        if (!token || !user) {
            // Unauthenticated
            if (!inAuth) {
                target = '/(auth)/welcome';
                shouldRedirect = true;
            }
        } else if (user.onboarding_completed) {
            // Authenticated & Onboarded
            // ONLY redirect to profile if user is currently in auth or onboarding flows
            // If user is in (tabs) OR in modal, let them be.
            if (inAuth || inOnboarding) {
                target = '/(tabs)/profile';
                shouldRedirect = true;
            }
        } else {
            // Incomplete Onboarding
            if (!inOnboarding) {
                target = '/(onboarding)/name';
                shouldRedirect = true;
            }
        }

        if (shouldRedirect && target) {
            console.log(`[AuthContext] Redirecting from ${group} to ${target}`);
            router.replace(target as any);
        }
    }, [sessionReady, token, user, segments]);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
