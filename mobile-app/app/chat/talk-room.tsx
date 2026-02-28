import { COLORS, SPACING, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

import { API_BASE_URL } from '../../constants/Api';

type NetworkState = 'ok' | 'reconnecting' | 'offline' | 'rate_limited';
const POLL_BACKOFF_MS = [2000, 3000, 5000, 8000, 13000] as const;

export default function TalkRoomScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const { token } = useAuth();

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [isMuted, setIsMuted] = useState(false);
    const [engaged, setEngaged] = useState(false);
    const [engageStatus, setEngageStatus] = useState<'pending' | 'waiting_for_partner' | 'match_unlocked'>('pending');
    const [matchUnlocked, setMatchUnlocked] = useState(false); // Both engaged
    const [networkState, setNetworkState] = useState<NetworkState>('ok');
    const [lastSync, setLastSync] = useState(Date.now());

    const appState = useRef(AppState.currentState);
    const lastServerSecondsRemainingRef = useRef(300);
    const lastSyncAtRef = useRef(Date.now());
    const backoffIndexRef = useRef(0);
    const lastErrorCodeRef = useRef<number | undefined>(undefined);
    const pollNowRef = useRef<(() => void) | null>(null);
    const didNavigateRef = useRef(false);

    const getEstimatedRemaining = (nowMs: number = Date.now()) => {
        const elapsedSeconds = Math.floor((nowMs - lastSyncAtRef.current) / 1000);
        return Math.max(0, lastServerSecondsRemainingRef.current - elapsedSeconds);
    };

    // Track AppState
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            appState.current = nextAppState;
            if (nextAppState === 'active') {
                pollNowRef.current?.();
            }
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        const handleWebFocus = () => {
            if (!document.hidden) {
                pollNowRef.current?.();
            }
        };

        document.addEventListener('visibilitychange', handleWebFocus);
        window.addEventListener('focus', handleWebFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleWebFocus);
            window.removeEventListener('focus', handleWebFocus);
        };
    }, []);

    // Local timer is a smooth estimate between authoritative server syncs.
    useEffect(() => {
        if (!roomId || !token) {
            return;
        }

        const timerId = setInterval(() => {
            if (didNavigateRef.current) return;
            const estimated = getEstimatedRemaining();
            setTimeLeft(prev => (prev === estimated ? prev : estimated));
        }, 1000);
        return () => clearInterval(timerId);
    }, [roomId, token]);

    useEffect(() => {
        if (!roomId) {
            if (!didNavigateRef.current) {
                didNavigateRef.current = true;
                Alert.alert("Session Error", "Talk room not found. Returning to Chat Night.");
                router.replace('/(tabs)/chat-night');
            }
            return;
        }

        if (!token) {
            if (!didNavigateRef.current) {
                didNavigateRef.current = true;
                Alert.alert("Not Authenticated", "Please login to continue.");
                router.replace('/(auth)/welcome');
            }
            return;
        }

        let active = true;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let inFlight = false;

        const consumeBackoffDelay = (minDelayMs = 0) => {
            const boundedIndex = Math.min(backoffIndexRef.current, POLL_BACKOFF_MS.length - 1);
            const nextDelay = Math.max(POLL_BACKOFF_MS[boundedIndex], minDelayMs);
            if (backoffIndexRef.current < POLL_BACKOFF_MS.length - 1) {
                backoffIndexRef.current += 1;
            }
            return nextDelay;
        };

        const scheduleNext = (delayMs: number) => {
            if (!active) return;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                void loop();
            }, delayMs);
        };

        const pollRoom = async (): Promise<number> => {
            if (!active || didNavigateRef.current) return 0;
            if (inFlight) return 2000;

            // Slow polling while backgrounded.
            if (appState.current.match(/inactive|background/)) {
                return 4000;
            }

            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
                lastErrorCodeRef.current = undefined;
                setNetworkState('offline');
                return consumeBackoffDelay(8000);
            }

            inFlight = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/chat-night/room/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 401 || res.status === 403) {
                    if (!didNavigateRef.current) {
                        didNavigateRef.current = true;
                        Alert.alert("Session Expired", "Please login again.");
                        router.replace('/(auth)/welcome');
                    }
                    return 0;
                }

                if (res.status === 404) {
                    if (!didNavigateRef.current) {
                        didNavigateRef.current = true;
                        Alert.alert("Room Ended", "This chat room is no longer available.");
                        router.replace('/(tabs)/chat-night');
                    }
                    return 0;
                }

                if (res.status === 429) {
                    lastErrorCodeRef.current = 429;
                    setNetworkState('rate_limited');
                    return consumeBackoffDelay(8000);
                }

                if (res.status >= 500) {
                    lastErrorCodeRef.current = res.status;
                    setNetworkState('reconnecting');
                    return consumeBackoffDelay();
                }

                if (!res.ok) {
                    lastErrorCodeRef.current = res.status;
                    setNetworkState('reconnecting');
                    return consumeBackoffDelay();
                }

                const data = await res.json();
                if (!active) return 0;

                const parsedSeconds = Number(data.seconds_remaining);
                const serverRemaining = Number.isFinite(parsedSeconds)
                    ? Math.max(0, Math.floor(parsedSeconds))
                    : 0;
                const syncedAt = Date.now();

                // Authoritative reconciliation from backend.
                lastServerSecondsRemainingRef.current = serverRemaining;
                lastSyncAtRef.current = syncedAt;
                setTimeLeft(serverRemaining);
                setLastSync(syncedAt);
                backoffIndexRef.current = 0;
                lastErrorCodeRef.current = undefined;
                setNetworkState('ok');
                setEngageStatus((data.engage_status ?? 'pending') as 'pending' | 'waiting_for_partner' | 'match_unlocked');

                // Sync Engagement
                if (data.engage_status === 'waiting_for_partner') {
                    setEngaged(true);
                } else if (data.engage_status === 'match_unlocked') {
                    setEngaged(true);
                    setMatchUnlocked(true);
                }

                // Handle Ended
                if (data.state === 'ended' || serverRemaining <= 0) {
                    if (!didNavigateRef.current) {
                        didNavigateRef.current = true;
                        Alert.alert("Session Ended", "The chat session has finished.");
                        router.replace('/(tabs)/chat-night');
                    }
                    return 0; // Stop polling
                }

                // Handle Match
                if (data.match_unlocked) {
                    setMatchUnlocked(true);
                    if (!didNavigateRef.current) {
                        didNavigateRef.current = true;
                        Alert.alert("It's a Match!", "You both engaged! You can now find them in your Matches tab.");
                        router.replace('/(tabs)/matches');
                    }
                    return 0; // Stop polling
                }

                return 2000;
            } catch (e) {
                if (didNavigateRef.current) {
                    return 0;
                }
                const lastErrorCode = lastErrorCodeRef.current;
                lastErrorCodeRef.current = undefined;
                console.warn("[TalkRoom] Polling error", { error: e, lastErrorCode });
                setNetworkState('reconnecting');
                return consumeBackoffDelay();
            } finally {
                inFlight = false;
            }
        };

        const loop = async () => {
            let nextDelay = 0;
            try {
                nextDelay = await pollRoom();
            } catch (e) {
                console.warn("[TalkRoom] Poll loop fallback", e);
                setNetworkState('reconnecting');
                nextDelay = consumeBackoffDelay();
            }
            if (!active || nextDelay <= 0) return;
            scheduleNext(nextDelay);
        };

        const triggerImmediatePoll = () => {
            if (!active || inFlight || didNavigateRef.current) return;
            if (timeoutId) clearTimeout(timeoutId);
            void loop();
        };

        pollNowRef.current = triggerImmediatePoll;

        // Start loop
        void loop();

        return () => {
            active = false;
            pollNowRef.current = null;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [roomId, token, router]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleEngage = async () => {
        if (!roomId || engaged || didNavigateRef.current) return;

        if (!token) {
            if (!didNavigateRef.current) {
                didNavigateRef.current = true;
                Alert.alert("Not Authenticated", "Please login to continue.");
                router.replace('/(auth)/welcome');
            }
            return;
        }

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
                return;
            }

            const payload = await res.json().catch(() => null);

            if (payload?.engage_status) {
                setEngageStatus(payload.engage_status as 'pending' | 'waiting_for_partner' | 'match_unlocked');
            }

            if (payload?.engage_status === 'waiting_for_partner') {
                setEngaged(true);
            } else if (payload?.engage_status === 'match_unlocked') {
                setEngaged(true);
                setMatchUnlocked(true);
            }

            if (payload?.match_unlocked === true) {
                setMatchUnlocked(true);
                setEngaged(true);
            }
        } catch (e) {
            console.error(e);
            setEngaged(false);
        }
    };

    const handleEndCall = () => {
        if (didNavigateRef.current) return;
        didNavigateRef.current = true;
        router.replace('/(tabs)/chat-night');
    };

    const syncSecondsAgo = Math.floor((Date.now() - lastSync) / 1000);
    const syncStatusText = networkState === 'offline'
        ? 'Offline'
        : networkState === 'reconnecting'
            ? 'Reconnecting...'
            : networkState === 'rate_limited'
                ? 'Retrying (rate limit)...'
                : `Sync: ${syncSecondsAgo}s ago`;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <View
                    style={[
                        styles.activeIndicator,
                        { backgroundColor: matchUnlocked ? COLORS.destructive : COLORS.success },
                    ]}
                />
                <View>
                    <Text style={styles.statusText}>
                        {matchUnlocked ? "Match Unlocked!" : "Voice Connected"}
                    </Text>
                    <Text
                        style={{
                            fontSize: 10,
                            color: networkState === 'ok' ? COLORS.dark.secondaryText : COLORS.destructive,
                            textAlign: "center",
                        }}
                    >
                        {syncStatusText}
                    </Text>
                </View>
            </View>

            <View style={styles.centerContent}>
                <View
                    style={[
                        styles.timerCircle,
                        matchUnlocked ? { borderColor: COLORS.destructive } : undefined,
                    ]}
                >
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
                    <Ionicons
                        name={isMuted ? "mic-off" : "mic"}
                        size={28}
                        color={isMuted ? COLORS.brandBase : COLORS.dark.primaryText}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.engageButton,
                        (engaged || matchUnlocked) ? styles.engagedButton : undefined,
                    ]}
                    onPress={handleEngage}
                    disabled={engaged || matchUnlocked}
                >
                    <Ionicons
                        name={matchUnlocked ? "heart-circle" : "heart"}
                        size={32}
                        color={COLORS.dark.primaryText}
                    />
                    <Text style={styles.engageText}>
                        {matchUnlocked ? "Unlocked" : engageStatus === "waiting_for_partner" ? "Waiting" : engaged ? "Sent" : "Engage"}
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
