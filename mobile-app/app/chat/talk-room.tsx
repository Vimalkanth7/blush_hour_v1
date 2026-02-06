import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

import { API_BASE_URL } from '../../constants/Api';

export default function TalkRoomScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const { token } = useAuth();

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [isMuted, setIsMuted] = useState(false);
    const [engaged, setEngaged] = useState(false);
    const [matchUnlocked, setMatchUnlocked] = useState(false); // Both engaged
    const [roomState, setRoomState] = useState('active');
    // Fix: explicitly define networkError state to prevent reference errors
    const [networkError, setNetworkError] = useState(false);
    const [lastSync, setLastSync] = useState(Date.now());

    const appState = useRef(AppState.currentState);

    // Track AppState
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            appState.current = nextAppState;
        });
        return () => subscription.remove();
    }, []);

    // Local Timer Tick: Decrement every second for smooth UI
    useEffect(() => {
        const timerId = setInterval(() => {
            // Only decrement if active? Actually better to keep running or rely on sync
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timerId);
    }, []);

    useEffect(() => {
        if (!roomId) return;

        let active = true;
        let timeoutId: any; // Type 'any' to handle Platform differences (number vs NodeJS.Timeout)

        const loop = async () => {
            if (!active) return;

            // 1. Hygiene: Pause if background
            if (appState.current.match(/inactive|background/)) {
                timeoutId = setTimeout(loop, 4000); // Slow poll or pause
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/chat-night/room/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    // 404 or other error -> maybe room ended or network issue
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();
                if (!active) return;

                // Sync State
                setTimeLeft(data.seconds_remaining);
                setRoomState(data.state);
                setLastSync(Date.now());
                setNetworkError(false);

                // Sync Engagement
                if (data.engage_status === 'waiting_for_partner') {
                    setEngaged(true);
                } else if (data.engage_status === 'match_unlocked') {
                    setEngaged(true);
                    setMatchUnlocked(true);
                }

                // Handle Ended
                if (data.state === 'ended' || data.seconds_remaining <= 0) {
                    Alert.alert("Session Ended", "The chat session has finished.");
                    handleEndCall();
                    return; // Stop polling
                }

                // Handle Match
                if (data.match_unlocked) {
                    setMatchUnlocked(true);
                    setTimeout(() => {
                        Alert.alert("It's a Match! 💖", "You both engaged! You can now find them in your Matches tab.");
                        router.replace('/(tabs)/matches');
                    }, 1000);
                    return; // Stop polling
                }

                // Next poll
                timeoutId = setTimeout(loop, 2000);

            } catch (e) {
                console.warn("[TalkRoom] Polling error", e);
                setNetworkError(true);
                // Backoff on error
                timeoutId = setTimeout(loop, 5000);
            }
        };

        // Start loop
        loop();

        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, [roomId, token]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleEngage = async () => {
        if (!roomId || engaged) return;

        // Optimistic UI
        setEngaged(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat-night/engage`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room_id: roomId })
            });
            if (!res.ok) {
                Alert.alert("Error", "Could not submit engagement.");
                setEngaged(false); // Revert
            }
        } catch (e) {
            console.error(e);
            setEngaged(false);
        }
    };

    const handleEndCall = () => {
        router.replace('/(tabs)/chat-night');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <View style={[styles.activeIndicator, { backgroundColor: matchUnlocked ? COLORS.destructive : COLORS.success }]} />
                <View>
                    <Text style={styles.statusText}>
                        {matchUnlocked ? "Match Unlocked!" : "Voice Connected"}
                    </Text>
                    <Text style={{ fontSize: 10, color: networkError ? COLORS.destructive : COLORS.dark.secondaryText, textAlign: 'center' }}>
                        {networkError ? "Network Error" : `Sync: ${Math.floor((Date.now() - lastSync) / 1000)}s ago`}
                    </Text>
                </View>
            </View>

            <View style={styles.centerContent}>
                <View style={[styles.timerCircle, matchUnlocked && { borderColor: COLORS.destructive }]}>
                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                    <Text style={styles.timerLabel}>REMAINING</Text>
                </View>
                <Text style={styles.hintText}>No names, no photos. Just talk.</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.roundButton, isMuted ? styles.btnActive : styles.btnInactive]}
                    onPress={() => setIsMuted(!isMuted)}
                >
                    <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? COLORS.brandBase : COLORS.dark.primaryText} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.engageButton, (engaged || matchUnlocked) && styles.engagedButton]}
                    onPress={handleEngage}
                    disabled={engaged || matchUnlocked}
                >
                    <Ionicons name={matchUnlocked ? "heart-circle" : "heart"} size={32} color={COLORS.dark.primaryText} />
                    <Text style={styles.engageText}>
                        {matchUnlocked ? "Unlocked" : engaged ? "Sent" : "Engage"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.roundButton, styles.endButton]}
                    onPress={handleEndCall}
                >
                    <Ionicons name="call" size={28} color={COLORS.dark.primaryText} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.dark.background },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.screen },
    activeIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, marginRight: SPACING.md },
    statusText: { color: COLORS.dark.secondaryText, fontSize: 16, fontWeight: '600' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    timerCircle: {
        width: 200, height: 200, borderRadius: 100,
        borderWidth: 4, borderColor: COLORS.dark.surface,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 40
    },
    timerText: { color: COLORS.dark.primaryText, fontSize: 48, fontWeight: 'bold' },
    timerLabel: { color: COLORS.dark.secondaryText, fontSize: 12, marginTop: 5, letterSpacing: 2 },
    hintText: { color: COLORS.dark.secondaryText, fontSize: 16 },
    controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 50 },
    roundButton: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    btnInactive: { backgroundColor: COLORS.dark.surface },
    btnActive: { backgroundColor: COLORS.dark.primaryText },
    endButton: { backgroundColor: COLORS.destructive },
    engageButton: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: COLORS.destructive, justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.card,
        marginBottom: 20 // Push up slightly
    },
    engagedButton: { backgroundColor: COLORS.disabled, shadowOpacity: 0 },
    engageText: { color: COLORS.dark.primaryText, fontSize: 12, fontWeight: 'bold', marginTop: 2 }
});
