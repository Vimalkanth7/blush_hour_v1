import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/Api';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';

interface DashboardMetrics {
    users: {
        total: number;
        new_24h: number;
        dau_24h: number;
    };
    engagement: {
        matches_total: number;
        matches_today: number;
        threads_total: number;
        messages_total: number;
    };
}

export default function AdminOverview() {
    const { token } = useAuth();
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMetrics();
    }, []);

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/metrics/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log("ADMIN OVERVIEW RAW:", data);
                setMetrics(data);
            } else {
                console.error("Fetch metrics failed", res.status);
                setError(`Failed to fetch metrics (Status: ${res.status})`);
            }
        } catch (e) {
            console.error(e);
            setError("Network error fetching metrics");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={{ color: COLORS.destructive, fontSize: 16 }}>{error}</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.pageTitle}>Dashboard Overview</Text>

            <View style={styles.grid}>
                <StatCard label="Total Users" value={metrics?.users?.total || 0} icon="people" color="#3B82F6" />
                <StatCard label="Active Today (DAU)" value={metrics?.users?.dau_24h || 0} icon="flash" color="#10B981" />
                <StatCard label="Matches Today" value={metrics?.engagement?.matches_today || 0} icon="heart" color="#EC4899" />
                <StatCard label="Total Threads" value={metrics?.engagement?.threads_total || 0} icon="chatbubbles" color="#8B5CF6" />
                <StatCard label="Total Messages" value={metrics?.engagement?.messages_total || 0} icon="mail" color="#F59E0B" />
            </View>
        </ScrollView>
    );
}

const StatCard = ({ label, value, icon, color }: any) => (
    <Card style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}> {/* 20% opacity */}
            <Ionicons name={icon} size={24} color={color} />
        </View>
        <View>
            <Text style={styles.statValue}>{value.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    </Card>
);

const styles = StyleSheet.create({
    container: { paddingBottom: 40 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { ...TYPOGRAPHY.h1, color: COLORS.primaryText, marginBottom: SPACING.xl },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },

    card: {
        width: 240,
        flexDirection: 'row',
        alignItems: 'center'
    },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryText },
    statLabel: { fontSize: 13, color: COLORS.secondaryText, fontWeight: '500' }
});
