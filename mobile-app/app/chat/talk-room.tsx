import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

import { API_BASE_URL, mapVoiceTokenError, voiceToken } from '../../constants/Api';
import { createVoiceSession, type VoiceSessionController } from '../../lib/livekit/voiceSession';

const normalizeRevealedIndices = (rawIndices: unknown): number[] => {
    if (!Array.isArray(rawIndices)) {
        return [];
    }

    const normalized = rawIndices
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 4);

    return [...new Set(normalized)].sort((a, b) => a - b);
};

const areSameIndices = (left: number[], right: number[]): boolean => (
    left.length === right.length && left.every((value, index) => value === right[index])
);

type VoiceStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'error';

export default function TalkRoomScreen() {
    const router = useRouter();
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const { token } = useAuth();

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [isMuted, setIsMuted] = useState(false);
    const [engaged, setEngaged] = useState(false);
    const [matchUnlocked, setMatchUnlocked] = useState(false); // Both engaged
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(Platform.OS === 'web' ? 'idle' : 'waiting');
    const [voiceError, setVoiceError] = useState<string | null>(
        Platform.OS === 'web' ? 'Voice available on Android dev build only.' : 'Waiting for partner to engage to start voice.',
    );
    // Fix: explicitly define networkError state to prevent reference errors
    const [networkError, setNetworkError] = useState(false);
    const [lastSync, setLastSync] = useState(Date.now());
    const [icebreakers, setIcebreakers] = useState<string[] | null>(null);
    const [reasons, setReasons] = useState<string[] | null>(null);
    const [icebreakersLoading, setIcebreakersLoading] = useState(false);
    const [icebreakersError, setIcebreakersError] = useState<string | null>(null);
    const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
    const [icebreakersMeta, setIcebreakersMeta] = useState<{ model: string | null; cached: boolean | null }>({
        model: null,
        cached: null
    });

    const appState = useRef(AppState.currentState);
    const lastServerSecondsRemainingRef = useRef(300);
    const lastSyncAtRef = useRef(Date.now());
    const pollNowRef = useRef<(() => void) | null>(null);
    const didFetchIcebreakersRef = useRef(false);
    const icebreakersRoomIdRef = useRef<string | null>(null);
    const voiceSessionRef = useRef<VoiceSessionController | null>(null);
    const voiceConnectingRef = useRef(false);
    const voiceAutoJoinTriggeredRef = useRef(false);
    const isMountedRef = useRef(true);

    const getEstimatedRemaining = (nowMs: number = Date.now()) => {
        const elapsedSeconds = Math.floor((nowMs - lastSyncAtRef.current) / 1000);
        return Math.max(0, lastServerSecondsRemainingRef.current - elapsedSeconds);
    };

    const disconnectVoice = useCallback(async () => {
        const session = voiceSessionRef.current;
        voiceSessionRef.current = null;
        voiceConnectingRef.current = false;

        if (!session) {
            return;
        }

        await session.disconnect();
    }, []);

    const getVoiceSession = useCallback(() => {
        if (!voiceSessionRef.current) {
            voiceSessionRef.current = createVoiceSession({
                onConnected: () => {
                    if (!isMountedRef.current) return;
                    setVoiceStatus('connected');
                    setVoiceError(null);
                },
                onDisconnected: () => {
                    if (!isMountedRef.current) return;
                    setVoiceStatus((current) => (current === 'error' ? current : 'idle'));
                },
                onError: (message: string) => {
                    if (!isMountedRef.current) return;
                    setVoiceStatus('error');
                    setVoiceError(message);
                },
            });
        }

        return voiceSessionRef.current;
    }, []);

    const joinVoice = useCallback(async () => {
        if (Platform.OS === 'web') {
            setVoiceStatus('error');
            setVoiceError('Voice available on Android dev build only.');
            return;
        }

        if (!token || voiceConnectingRef.current || voiceSessionRef.current?.isConnected()) {
            return;
        }

        if (!matchUnlocked) {
            setVoiceStatus('waiting');
            setVoiceError('Waiting for partner to engage to start voice.');
            return;
        }

        voiceConnectingRef.current = true;
        setVoiceStatus('connecting');
        setVoiceError(null);

        try {
            const creds = await voiceToken(token);
            const session = getVoiceSession();

            await session.connect({
                url: creds.url,
                token: creds.token,
                muted: isMuted,
            });

            if (!isMountedRef.current) {
                return;
            }

            setVoiceStatus('connected');
            setVoiceError(null);
        } catch (error) {
            if (!isMountedRef.current) {
                return;
            }

            const mappedError = mapVoiceTokenError(error);
            setVoiceStatus(mappedError.reason === 'not_engaged' ? 'waiting' : 'error');
            setVoiceError(mappedError.detail);
        } finally {
            voiceConnectingRef.current = false;
        }
    }, [token, matchUnlocked, isMuted, getVoiceSession]);

    const handleToggleMute = useCallback(async () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);

        if (!voiceSessionRef.current?.isConnected()) {
            return;
        }

        try {
            await voiceSessionRef.current.setMuted(nextMuted);
        } catch {
            if (!isMountedRef.current) {
                return;
            }
            setVoiceStatus('error');
            setVoiceError('Unable to update microphone state.');
        }
    }, [isMuted]);

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
        return () => {
            isMountedRef.current = false;
            void disconnectVoice();
        };
    }, [disconnectVoice]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            return;
        }

        if (!matchUnlocked) {
            if (voiceStatus !== 'connected' && voiceStatus !== 'connecting') {
                setVoiceStatus('waiting');
                setVoiceError('Waiting for partner to engage to start voice.');
            }
            return;
        }

        if (voiceStatus === 'connected' || voiceStatus === 'connecting' || voiceAutoJoinTriggeredRef.current) {
            return;
        }

        voiceAutoJoinTriggeredRef.current = true;
        void joinVoice();
    }, [matchUnlocked, joinVoice, voiceStatus]);

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
        const timerId = setInterval(() => {
            const estimated = getEstimatedRemaining();
            setTimeLeft(prev => (prev === estimated ? prev : estimated));
        }, 1000);
        return () => clearInterval(timerId);
    }, []);

    const fetchIcebreakers = useCallback(async (forceRetry: boolean = false) => {
        if (!roomId || !token) return;
        const requestRoomId = roomId;
        if (
            !forceRetry &&
            didFetchIcebreakersRef.current &&
            icebreakersRoomIdRef.current === requestRoomId
        ) {
            return;
        }

        didFetchIcebreakersRef.current = true;
        icebreakersRoomIdRef.current = requestRoomId;
        setIcebreakersLoading(true);
        setIcebreakersError(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat-night/icebreakers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room_id: roomId })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            if (icebreakersRoomIdRef.current !== requestRoomId) {
                return;
            }
            const parsedIcebreakers = Array.isArray(data?.icebreakers)
                ? data.icebreakers.filter((value: unknown): value is string => typeof value === 'string')
                : [];

            if (parsedIcebreakers.length !== 5) {
                throw new Error('Invalid icebreakers payload');
            }

            const parsedReasons = Array.isArray(data?.reasons)
                ? data.reasons
                    .filter((value: unknown): value is string => typeof value === 'string')
                    .slice(0, 3)
                : [];

            setIcebreakers(parsedIcebreakers);
            setReasons(parsedReasons.length > 0 ? parsedReasons : null);
            setIcebreakersMeta({
                model: typeof data?.model === 'string' ? data.model : null,
                cached: typeof data?.cached === 'boolean' ? data.cached : null
            });

            if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'revealed_indices')) {
                const initialRevealedIndices = normalizeRevealedIndices(data?.revealed_indices);
                setRevealedIndices((prev) => (
                    areSameIndices(prev, initialRevealedIndices) ? prev : initialRevealedIndices
                ));
            }
        } catch (e) {
            if (icebreakersRoomIdRef.current !== requestRoomId) {
                return;
            }
            console.warn('[TalkRoom] Icebreakers fetch error', e);
            setIcebreakers(null);
            setReasons(null);
            setIcebreakersMeta({ model: null, cached: null });
            setIcebreakersError('Icebreakers unavailable. Retry.');
        } finally {
            if (icebreakersRoomIdRef.current === requestRoomId) {
                setIcebreakersLoading(false);
            }
        }
    }, [roomId, token]);

    useEffect(() => {
        if (!roomId) return;
        if (icebreakersRoomIdRef.current === roomId) return;

        void disconnectVoice();
        voiceAutoJoinTriggeredRef.current = false;
        voiceConnectingRef.current = false;

        didFetchIcebreakersRef.current = false;
        icebreakersRoomIdRef.current = null;
        setIcebreakers(null);
        setReasons(null);
        setIcebreakersLoading(false);
        setIcebreakersError(null);
        setRevealedIndices([]);
        setIcebreakersMeta({ model: null, cached: null });
        setVoiceStatus(Platform.OS === 'web' ? 'idle' : 'waiting');
        setVoiceError(Platform.OS === 'web'
            ? 'Voice available on Android dev build only.'
            : 'Waiting for partner to engage to start voice.');
    }, [roomId, disconnectVoice]);

    useEffect(() => {
        if (!roomId || !token) return;
        if (didFetchIcebreakersRef.current) return;
        void fetchIcebreakers();
    }, [roomId, token, fetchIcebreakers]);

    useEffect(() => {
        if (!roomId) return;

        let active = true;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let inFlight = false;

        const scheduleNext = (delayMs: number) => {
            if (!active) return;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                void loop();
            }, delayMs);
        };

        const pollRoom = async (): Promise<number> => {
            if (!active) return 0;
            if (inFlight) return 2000;

            // Slow polling while backgrounded.
            if (appState.current.match(/inactive|background/)) {
                return 4000;
            }

            inFlight = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/chat-night/room/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
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
                setNetworkError(false);

                // Sync Engagement
                const isUnlocked = data.engage_status === 'match_unlocked' || data.match_unlocked === true;
                if (data.engage_status === 'waiting_for_partner') {
                    setEngaged(true);
                } else if (isUnlocked) {
                    setEngaged(true);
                    setMatchUnlocked(true);
                }

                if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'icebreakers_revealed_indices')) {
                    const serverRevealedIndices = normalizeRevealedIndices(data?.icebreakers_revealed_indices);
                    setRevealedIndices((prev) => (
                        areSameIndices(prev, serverRevealedIndices) ? prev : serverRevealedIndices
                    ));
                }

                // Handle Ended
                if (data.state === 'ended' || serverRemaining <= 0) {
                    await disconnectVoice();
                    Alert.alert("Session Ended", "The chat session has finished.");
                    router.replace('/(tabs)/chat-night');
                    return 0; // Stop polling
                }

                return 2000;
            } catch (e) {
                console.warn("[TalkRoom] Polling error", e);
                setNetworkError(true);
                return 5000;
            } finally {
                inFlight = false;
            }
        };

        const loop = async () => {
            const nextDelay = await pollRoom();
            if (!active || nextDelay <= 0) return;
            scheduleNext(nextDelay);
        };

        const triggerImmediatePoll = () => {
            if (!active || inFlight) return;
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
    }, [roomId, token, router, disconnectVoice]);

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

    const handleEndCall = async () => {
        await disconnectVoice();
        router.replace('/(tabs)/chat-night');
    };

    const handleRevealCard = useCallback(async (index: number) => {
        if (!roomId || !token) return;
        if (revealedIndices.includes(index)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat-night/icebreakers/reveal`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room_id: roomId, index })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const serverRevealedIndices = normalizeRevealedIndices(data?.revealed_indices);
            setRevealedIndices((prev) => (
                areSameIndices(prev, serverRevealedIndices) ? prev : serverRevealedIndices
            ));
            pollNowRef.current?.();
        } catch (e) {
            console.warn('[TalkRoom] Reveal card error', e);
        }
    }, [roomId, token, revealedIndices]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <View
                    style={[
                        styles.activeIndicator,
                        {
                            backgroundColor: voiceStatus === 'connected'
                                ? COLORS.success
                                : voiceStatus === 'error'
                                    ? COLORS.destructive
                                    : matchUnlocked
                                        ? COLORS.brandBase
                                        : COLORS.success,
                        },
                    ]}
                />
                <View>
                    <Text style={styles.statusText}>
                        {matchUnlocked ? "Match Unlocked" : "Talk Room Active"}
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

            <View style={[styles.voiceBanner, voiceStatus === 'error' && styles.voiceBannerError]}>
                <Text style={styles.voiceBannerText}>
                    {Platform.OS === 'web'
                        ? 'Voice available on Android dev build only.'
                        : !matchUnlocked
                            ? 'Waiting for partner to engage to start voice.'
                            : voiceStatus === 'connecting'
                                ? 'Connecting to voice...'
                                : voiceStatus === 'connected'
                                    ? 'Voice connected.'
                                    : voiceStatus === 'error'
                                        ? (voiceError || 'Voice is unavailable.')
                                        : 'Ready to join voice.'}
                </Text>
            </View>

            <View style={styles.icebreakersSection}>
                <Text style={styles.icebreakersTitle}>Icebreakers</Text>

                {reasons && (
                    <View style={styles.reasonsWrap}>
                        {reasons.map((reason, index) => (
                            <Text key={`reason-${index}`} style={styles.reasonText}>
                                {reason}
                            </Text>
                        ))}
                    </View>
                )}

                {icebreakers?.map((card, index) => {
                    const isRevealed = revealedIndices.includes(index);
                    return (
                        <TouchableOpacity
                            key={`icebreaker-${index}`}
                            style={[styles.icebreakerCard, isRevealed && styles.icebreakerCardOpen]}
                            onPress={() => void handleRevealCard(index)}
                            disabled={isRevealed}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.icebreakerCardText}>
                                {isRevealed ? card : `Card ${index + 1} - Tap to reveal`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {icebreakersLoading && (
                    <Text style={styles.icebreakersInfoText}>Loading icebreakers...</Text>
                )}

                {!!icebreakersError && (
                    <View style={styles.icebreakersErrorRow}>
                        <Text style={styles.icebreakersErrorText}>{icebreakersError}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => void fetchIcebreakers(true)}
                            disabled={icebreakersLoading}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {__DEV__ && icebreakersMeta.model && (
                    <Text style={styles.icebreakersInfoText}>
                        model: {icebreakersMeta.model} | cached: {icebreakersMeta.cached ? 'true' : 'false'}
                    </Text>
                )}
            </View>

            {Platform.OS !== 'web' && (
                <View style={styles.voiceActions}>
                    <TouchableOpacity
                        style={[
                            styles.voiceJoinButton,
                            (!matchUnlocked || voiceStatus === 'connecting' || voiceStatus === 'connected') && styles.voiceJoinButtonDisabled,
                        ]}
                        onPress={() => void joinVoice()}
                        disabled={!matchUnlocked || voiceStatus === 'connecting' || voiceStatus === 'connected'}
                    >
                        <Text style={styles.voiceJoinButtonText}>
                            {voiceStatus === 'connecting'
                                ? 'Connecting...'
                                : voiceStatus === 'connected'
                                    ? 'Connected'
                                    : 'Join Voice'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.roundButton, isMuted ? styles.btnActive : styles.btnInactive]}
                    onPress={() => void handleToggleMute()}
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
                    onPress={() => void handleEndCall()}
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
    voiceBanner: {
        marginHorizontal: SPACING.screen,
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.dark.surface,
        backgroundColor: COLORS.dark.surface
    },
    voiceBannerError: {
        borderColor: COLORS.destructive
    },
    voiceBannerText: {
        color: COLORS.dark.primaryText,
        fontSize: 12
    },
    icebreakersSection: {
        paddingHorizontal: SPACING.screen,
        marginBottom: SPACING.md
    },
    icebreakersTitle: {
        color: COLORS.dark.primaryText,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: SPACING.sm
    },
    reasonsWrap: {
        marginBottom: SPACING.sm
    },
    reasonText: {
        color: COLORS.dark.secondaryText,
        fontSize: 12,
        marginBottom: 4
    },
    icebreakerCard: {
        backgroundColor: COLORS.dark.surface,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.sm
    },
    icebreakerCardOpen: {
        borderColor: COLORS.brandBase,
        borderWidth: 1
    },
    icebreakerCardText: {
        color: COLORS.dark.primaryText,
        fontSize: 13
    },
    icebreakersInfoText: {
        color: COLORS.dark.secondaryText,
        fontSize: 11,
        marginTop: 2
    },
    icebreakersErrorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.xs
    },
    icebreakersErrorText: {
        color: COLORS.destructive,
        fontSize: 12,
        flexShrink: 1,
        marginRight: SPACING.sm
    },
    retryButton: {
        borderWidth: 1,
        borderColor: COLORS.dark.primaryText,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4
    },
    retryButtonText: {
        color: COLORS.dark.primaryText,
        fontSize: 12,
        fontWeight: '600'
    },
    voiceActions: {
        paddingHorizontal: SPACING.screen,
        marginBottom: SPACING.sm
    },
    voiceJoinButton: {
        borderWidth: 1,
        borderColor: COLORS.brandBase,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        justifyContent: 'center'
    },
    voiceJoinButtonDisabled: {
        borderColor: COLORS.disabled,
        opacity: 0.6
    },
    voiceJoinButtonText: {
        color: COLORS.dark.primaryText,
        fontSize: 13,
        fontWeight: '700'
    },
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
