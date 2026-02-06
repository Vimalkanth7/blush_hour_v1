import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TextInput, TouchableOpacity, Switch } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/Api';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '../../constants/Theme';

export default function AdminToggles() {
    const { token } = useAuth();
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [minCompletion, setMinCompletion] = useState('80');

    useEffect(() => {
        fetchToggles();
    }, []);

    const fetchToggles = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/toggles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                // Check dynamic override first, then root level
                const dyn = data.dynamic_overrides?.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT;
                const root = data.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT;

                if (dyn !== undefined) {
                    setMinCompletion(String(dyn));
                } else if (root !== undefined) {
                    setMinCompletion(String(root));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        console.log("AdminToggles: handleSave pressed");
        setSaving(true);
        try {
            // Updated payload format as per requirements: value as string
            const body = {
                key: "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT",
                value: String(minCompletion)
            };
            console.log("AdminToggles: Sending body", body);

            const res = await fetch(`${API_BASE_URL}/api/admin/toggles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            console.log("AdminToggles: Response status", res.status);

            if (res.ok) {
                Alert.alert("Success", "Configuration updated.");
                fetchToggles(); // Persist/refresh
            } else {
                const text = await res.text();
                console.error("AdminToggles: Save failed", text);
                Alert.alert("Error", "Failed to update configuration.");
            }
        } catch (e) {
            console.error("AdminToggles: Network error", e);
            Alert.alert("Error", "Network error.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>System Configuration</Text>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Chat Night Rules</Text>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Min Profile Completion %</Text>
                    <Text style={styles.helper}>Threshold for users to enter Chat Night.</Text>
                    <TextInput
                        style={styles.input}
                        value={minCompletion}
                        onChangeText={setMinCompletion}
                        keyboardType="numeric"
                    />
                </View>

                <View style={[styles.fieldGroup, { opacity: 0.5 }]}>
                    <Text style={styles.label}>Force Open Chat Night (Env Var)</Text>
                    <Text style={styles.helper}>Controlled by backend server flags.</Text>
                    <Text style={{ fontWeight: 'bold' }}>{config?.FORCE_OPEN ? 'ENABLED' : 'DISABLED'}</Text>
                </View>

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { ...TYPOGRAPHY.h1, color: '#1E293B', marginBottom: 24 },

    card: {
        backgroundColor: '#FFF', padding: 32, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: '#E2E8F0', maxWidth: 600, width: '100%'
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },

    fieldGroup: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 4 },
    helper: { fontSize: 13, color: '#64748B', marginBottom: 8 },
    input: {
        borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, padding: 10, fontSize: 16, width: 100
    },

    saveBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, width: 160
    },
    saveText: { color: '#FFF', fontWeight: 'bold' }
});
