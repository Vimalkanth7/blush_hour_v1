import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../constants/Api';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function AdminUserDetail() {
    const { id } = useLocalSearchParams();
    const { token } = useAuth();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (id) fetchUser();
    }, [id]);

    const fetchUser = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBanToggle = async () => {
        if (!user) return;
        const p = user.profile || {};
        const isBanned = p.is_banned === true; // Check profile.is_banned as requested
        const action = isBanned ? 'unban' : 'ban';
        console.log(`AdminUserDetail: handleBanToggle -> ${action} (current state: ${isBanned})`);

        if (Platform.OS === 'web') {
            if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

            let reason = "Admin Action";
            if (action === 'ban') {
                const input = window.prompt("Enter reason for ban:", "Admin Action");
                if (input === null) return;
                reason = input || "Admin Action";
            }

            const body = action === 'ban' ? { reason } : {};
            // Using /actions/ban and /actions/unban as requested
            performAction(`${API_BASE_URL}/api/admin/users/${id}/actions/${action}`, 'POST', body);
        } else {
            Alert.alert(`Confirm ${action}`, `Are you sure you want to ${action} this user?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm', style: 'destructive', onPress: async () => {
                        const body = action === 'ban' ? { reason: "Admin Action" } : {};
                        performAction(`${API_BASE_URL}/api/admin/users/${id}/actions/${action}`, 'POST', body);
                    }
                }
            ]);
        }
    };

    const handleResetPasses = async () => {
        console.log("AdminUserDetail: handleResetPasses");
        const defaultCount = 1;

        const onSuccess = (data: any) => {
            const newCount = data?.new_passes ?? defaultCount;
            const msg = `Passes set to ${newCount}`;
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert("Success", msg);
        };

        if (Platform.OS === 'web') {
            const input = window.prompt("Reset Chat Night passes count:", String(defaultCount));
            if (input !== null) {
                const count = parseInt(input, 10) || defaultCount;
                const body = { count };
                performAction(`${API_BASE_URL}/api/admin/users/${id}/actions/reset-passes`, 'POST', body, onSuccess);
            }
        } else {
            Alert.alert("Confirm Reset", `Reset passes to ${defaultCount}?`, [
                { text: 'Cancel' },
                {
                    text: 'Reset', onPress: async () => {
                        const body = { count: defaultCount };
                        performAction(`${API_BASE_URL}/api/admin/users/${id}/actions/reset-passes`, 'POST', body, onSuccess);
                    }
                }
            ]);
        }
    };

    const performAction = async (url: string, method: string, body: any = {}, onSuccess?: (data: any) => void) => {
        console.log(`AdminUserDetail: performAction ${method} ${url}`, body);
        setActionLoading(true);
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            console.log("AdminUserDetail: Response status", res.status);

            if (res.ok) {
                let data = {};
                try {
                    data = await res.json();
                } catch (err) {
                    // Ignore JSON parse error if body is empty
                }

                if (onSuccess) {
                    onSuccess(data);
                } else {
                    if (Platform.OS === 'web') window.alert("Action completed.");
                    else Alert.alert("Success", "Action completed.");
                }
                fetchUser(); // Refresh
            } else {
                const text = await res.text();
                console.error("AdminUserDetail: Action failed", text);
                if (Platform.OS === 'web') window.alert(`Error: ${text}`);
                else Alert.alert("Error", "Action failed.");
            }
        } catch (e) {
            console.error(e);
            if (Platform.OS === 'web') window.alert("Network error.");
            else Alert.alert("Error", "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
    if (!user) return <View style={styles.center}><Text>User not found</Text></View>;

    const p = user.profile || {};
    const s = user.strength || {};
    const stats = user.activity_stats || {};

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                <Ionicons name="arrow-back" size={20} color={COLORS.secondaryText} />
                <Text style={{ marginLeft: 8, color: COLORS.secondaryText }}>Back to Users</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.avatarLarge}>
                        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFF' }}>
                            {(p.first_name || '?')[0]}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.userName}>{p.first_name} {p.last_name}</Text>
                        <Text style={styles.userSub}>{p.phone_number}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <Badge text={s.tier || 'Standard'} color={s.tier === 'Gold' ? 'orange' : 'gray'} />
                            <Badge text={`${s.completion_percent || 0}% Complete`} color="blue" />
                            {p.is_banned && <Badge text="BANNED" color="red" />}
                        </View>
                    </View>
                </View>

                <View style={styles.actions}>
                    <ActionButton
                        label={p.is_banned ? "Unban User" : "Ban User"}
                        icon="ban"
                        color={p.is_banned ? "#10B981" : "#EF4444"}
                        onPress={handleBanToggle}
                        loading={actionLoading}
                    />
                    <ActionButton
                        label="Reset Passes"
                        icon="refresh"
                        color="#3B82F6"
                        onPress={handleResetPasses}
                        loading={actionLoading}
                    />
                </View>
            </View>

            <View style={styles.grid}>
                {/* Profile Card */}
                <Card title="Profile Summary">
                    <Row label="Role" value={p.role || user.role} />
                    <Row label="ID" value={user.id} />
                    <Row label="Name" value={p.first_name ? `${p.first_name} ${p.last_name || ''}` : 'Unknown'} />
                    <Row label="Phone" value={p.phone_number} />
                    <Row label="Created" value={p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'} />
                    <Row label="Gender" value={p.gender || '-'} />
                    <Row label="Location" value={p.location || '-'} />
                </Card>

                {/* Activity Card */}
                <Card title="Activity Stats">
                    <Row label="Chat Night Passes" value={stats.chat_night_passes_used_today !== undefined ? `${stats.chat_night_passes_used_today} used` : '0 used'} />
                    <Row label="Matches" value={stats.matches_count_all_time?.toString() || '0'} />
                    <Row label="Messages Sent" value={stats.messages_sent_all_time?.toString() || '0'} />
                </Card>
            </View>

        </ScrollView>
    );
}

const Card = ({ title, children }: any) => (
    <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        {children}
    </View>
);

const Row = ({ label, value }: any) => (
    <View style={styles.row}>
        <Text style={styles.label}>{label}:</Text>
        <Text style={styles.value}>{value}</Text>
    </View>
);

const Badge = ({ text, color }: any) => (
    <View style={[styles.badge, { backgroundColor: color === 'red' ? '#FEE2E2' : color === 'orange' ? '#FEF3C7' : '#DBEAFE' }]}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: color === 'red' ? '#DC2626' : color === 'orange' ? '#D97706' : '#1D4ED8' }}>{text}</Text>
    </View>
);

const ActionButton = ({ label, icon, color, onPress, loading }: any) => (
    <TouchableOpacity
        style={[styles.actionBtn, { borderColor: color }]}
        onPress={onPress}
        disabled={loading}
    >
        <Ionicons name={icon} size={16} color={color} style={{ marginRight: 8 }} />
        <Text style={{ color, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { paddingBottom: 40, paddingRight: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 20 },
    userName: { ...TYPOGRAPHY.h2, color: '#1E293B' },
    userSub: { color: COLORS.secondaryText, marginTop: 2 },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, backgroundColor: '#FFF' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    card: { backgroundColor: '#FFF', padding: 24, borderRadius: RADIUS.md, borderColor: '#E2E8F0', borderWidth: 1, width: 400 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 16 },

    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 },
    label: { color: COLORS.secondaryText, fontSize: 13 },
    value: { color: '#334155', fontWeight: '500', fontSize: 14 }
});
