import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Slot, useRouter, usePathname, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/Api';

export default function AdminLayout() {
    const { user, token, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = loading

    useEffect(() => {
        if (isLoading) return;
        if (Platform.OS !== 'web') return;

        checkAdminAccess();
    }, [isLoading, token]);

    const checkAdminAccess = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/metrics/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
            }
        } catch {
            setIsAuthorized(false);
        }
    };

    if (Platform.OS !== 'web') {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Admin Dashboard is Web Only.</Text>
            </View>
        );
    }

    if (isLoading || isAuthorized === null) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!isAuthorized) {
        return (
            <View style={styles.center}>
                <Ionicons name="lock-closed" size={48} color={COLORS.destructive} />
                <Text style={styles.errorText}>Access Denied</Text>
                <Text style={styles.subText}>You do not have admin permissions.</Text>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.button}>
                    <Text style={styles.buttonText}>Go Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Admin Sidebar/Nav Layout
    return (
        <View style={styles.container}>
            {/* Sidebar */}
            <View style={styles.sidebar}>
                <Text style={styles.logo}>BH Admin</Text>

                <NavItem label="Overview" icon="stats-chart" route="/admin" current={pathname === '/admin'} router={router} />
                <NavItem label="Users" icon="people" route="/admin/users" current={pathname.startsWith('/admin/users')} router={router} />
                <NavItem label="Toggles" icon="switch" route="/admin/toggles" current={pathname === '/admin/toggles'} router={router} />

                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.navItem}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.secondaryText} />
                    <Text style={styles.navText}>Exit Admin</Text>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                <Slot />
            </View>
        </View>
    );
}

const NavItem = ({ label, icon, route, current, router }: any) => (
    <TouchableOpacity
        style={[styles.navItem, current && styles.navItemActive]}
        onPress={() => router.push(route)}
    >
        <Ionicons name={icon} size={20} color={current ? COLORS.primary : COLORS.secondaryText} />
        <Text style={[styles.navText, current && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9' }, // Light gray bg
    sidebar: { width: 240, backgroundColor: '#FFFFFF', padding: 20, borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    content: { flex: 1, padding: 30, overflow: 'hidden' }, // Content area

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
    errorText: { ...TYPOGRAPHY.h2, color: COLORS.destructive, marginTop: 16 },
    subText: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, marginTop: 8, marginBottom: 24 },

    logo: { ...TYPOGRAPHY.h1, color: COLORS.primary, marginBottom: 40 },

    navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
    navItemActive: { backgroundColor: '#EEF2FF' }, // Light Indigo
    navText: { marginLeft: 12, fontSize: 14, color: COLORS.secondaryText, fontWeight: '500' },
    navTextActive: { color: COLORS.primary, fontWeight: '700' },

    button: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
    buttonText: { color: '#FFF', fontWeight: 'bold' }
});
