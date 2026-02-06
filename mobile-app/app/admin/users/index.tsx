import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, FlatList, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../constants/Api';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface UserSummary {
    id: string;
    name?: string;
    phone: string;
    role: string;
    tier: string;
    completion?: number;
    is_banned: boolean;
    created_at: string;
}

export default function AdminUsersList() {
    const { token } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!search) {
            setFilteredUsers(users);
        } else {
            const lower = search.toLowerCase();
            setFilteredUsers(users.filter(u =>
                (u.name || '').toLowerCase().includes(lower) ||
                u.phone.includes(lower)
            ));
        }
    }, [search, users]);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log("ADMIN USERS RAW:", data);
                // Assume data.users or array
                setUsers(Array.isArray(data) ? data : data.users || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.headerRow}>
            <Text style={[styles.col, { flex: 2 }]}>User</Text>
            <Text style={[styles.col, { flex: 2 }]}>Phone</Text>
            <Text style={[styles.col, { flex: 1 }]}>Role</Text>
            <Text style={[styles.col, { flex: 1 }]}>Tier</Text>
            <Text style={[styles.col, { flex: 1 }]}>Comp %</Text>
            <Text style={[styles.col, { flex: 1 }]}>Status</Text>
            <Text style={[styles.col, { flex: 0.5 }]}>Action</Text>
        </View>
    );

    const renderItem = ({ item }: { item: UserSummary }) => {
        const displayName = item.name ?? (item.phone ? `User-${item.phone.slice(-4)}` : "Unknown");

        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/admin/users/${item.id}` as any)}
            >
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: item.name ? COLORS.primary : '#E2E8F0' }]}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{displayName[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.cellText}>{displayName}</Text>
                </View>
                <Text style={[styles.cellText, { flex: 2 }]}>{item.phone}</Text>
                <Text style={[styles.cellText, { flex: 1, textTransform: 'capitalize' }]}>{item.role}</Text>

                <View style={{ flex: 1 }}>
                    <View style={[styles.badge, { backgroundColor: item.tier === 'Gold' ? '#FEF3C7' : '#F3F4F6' }]}>
                        <Text style={{ fontSize: 11, color: item.tier === 'Gold' ? '#D97706' : '#64748B', fontWeight: 'bold' }}>{item.tier}</Text>
                    </View>
                </View>

                <Text style={[styles.cellText, { flex: 1 }]}>{(item.completion ?? 0)}%</Text>

                <View style={{ flex: 1 }}>
                    {item.is_banned ? (
                        <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>BANNED</Text>
                        </View>
                    ) : (
                        <Text style={[styles.cellText, { color: '#10B981' }]}>Active</Text>
                    )}
                </View>

                <View style={{ flex: 0.5 }}>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <Text style={styles.pageTitle}>User Management</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name or phone..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#94A3B8"
                />
            </View>

            <View style={styles.tableContainer}>
                {renderHeader()}
                {loading ? (
                    <ActivityIndicator style={{ padding: 40 }} color={COLORS.primary} />
                ) : (
                    <FlatList
                        data={filteredUsers}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    pageTitle: { ...TYPOGRAPHY.h1, color: '#1E293B' },
    searchInput: {
        backgroundColor: '#FFF', width: 300, height: 40, borderRadius: 8, paddingHorizontal: 12,
        borderWidth: 1, borderColor: '#E2E8F0', outlineStyle: 'none' as any
    },

    tableContainer: {
        backgroundColor: '#FFF', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E2E8F0',
        flex: 1, overflow: 'hidden'
    },
    headerRow: {
        flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0'
    },
    row: {
        flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center'
    },
    col: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    cellText: { fontSize: 14, color: '#334155', fontWeight: '500' },

    avatarPlaceholder: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }
});
