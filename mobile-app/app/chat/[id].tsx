import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    API_BASE_URL,
    blockUser,
    handleApiError,
    isApiRequestError,
    mapSafetyActionError,
    muteUser,
    reportUser,
    type SafetyActionKind,
    type SafetyReportCategory,
} from '../../constants/Api';
import { useAuth } from '../../context/AuthContext';
import { BlurView } from 'expo-blur';
import PartnerProfileView, { PartnerProfile } from '../../components/profile/PartnerProfileView';
import SafetyActionsMenu from '../../components/chat/SafetyActionsMenu';

// Simple Message Interface for Web Fallback
interface IMessage {
    _id: string | number;
    text: string;
    createdAt: string | number | Date;
    user: {
        _id: string | number;
        name?: string;
    };
}

type NoticeTone = 'success' | 'error';

const DEFAULT_THREAD_UNAVAILABLE_MESSAGE = 'This connection is no longer available.';
const BLOCKED_THREAD_MESSAGE = 'User blocked.\nThis connection is no longer available.';

// --- Helper Functions ---
const isTempId = (id: string | number) => typeof id === 'number';

const dedupeById = (messages: IMessage[]) => {
    const map = new Map<string, IMessage>();
    messages.forEach(m => map.set(String(m._id), m));
    return Array.from(map.values());
};

const sortAsc = (messages: IMessage[]) => {
    return messages.sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());
};
// ------------------------

export default function ChatThread() {
    const { id, partnerId, partnerName, partnerPhoto, partnerAge } = useLocalSearchParams<{
        id: string;
        partnerId?: string;
        partnerName?: string;
        partnerPhoto?: string;
        partnerAge?: string;
    }>();
    const router = useRouter();
    const { user, token, signOut } = useAuth();
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [webInputText, setWebInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [safetyMenuVisible, setSafetyMenuVisible] = useState(false);
    const [safetyBusyAction, setSafetyBusyAction] = useState<SafetyActionKind | null>(null);
    const [statusNotice, setStatusNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
    const [conversationUnavailableMessage, setConversationUnavailableMessage] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const pName = partnerName || partnerProfile?.first_name || 'Match';
    const pPhoto = partnerPhoto || partnerProfile?.photos?.[0] || 'https://placeimg.com/150/150/people';
    const pAge = partnerAge || (partnerProfile?.age ? String(partnerProfile.age) : '24');
    const targetUserId = partnerId || partnerProfile?.id || null;

    const markConversationUnavailable = useCallback((message: string = DEFAULT_THREAD_UNAVAILABLE_MESSAGE) => {
        setConversationUnavailableMessage(message);
        setSafetyMenuVisible(false);
        setSafetyBusyAction(null);
        setStatusNotice(null);
        setIsProfileOpen(false);
        setIsLoading(false);
        setLoadingProfile(false);
        setProfileError(null);
    }, []);

    const handleThreadAccessResponse = useCallback(async (response: Response): Promise<boolean> => {
        if (response.status === 401) {
            await signOut();
            return true;
        }

        if (response.status === 403 || response.status === 404) {
            markConversationUnavailable();
            return true;
        }

        return false;
    }, [markConversationUnavailable, signOut]);

    const handleSafetyActionError = useCallback(async (action: SafetyActionKind, error: unknown) => {
        if (isApiRequestError(error)) {
            if (error.status === 401) {
                await signOut();
                return;
            }

            if (error.status === 403 || error.status === 404) {
                markConversationUnavailable();
                return;
            }
        }

        setSafetyMenuVisible(false);
        setStatusNotice({
            tone: 'error',
            text: mapSafetyActionError(action, error),
        });
    }, [markConversationUnavailable, signOut]);

    useEffect(() => {
        if (!statusNotice) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setStatusNotice(null);
        }, 2600);

        return () => clearTimeout(timeoutId);
    }, [statusNotice]);

    useEffect(() => {
        setMessages([]);
        setNextCursor(null);
        setWebInputText('');
        setIsLoading(true);
        setIsProfileOpen(false);
        setPartnerProfile(null);
        setLoadingProfile(false);
        setProfileError(null);
        setSafetyMenuVisible(false);
        setSafetyBusyAction(null);
        setStatusNotice(null);
        setConversationUnavailableMessage(null);
    }, [id]);

    const fetchPartnerProfile = useCallback(async () => {
        if (!token || !id || conversationUnavailableMessage) return;
        setLoadingProfile(true);
        setProfileError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/threads/${id}/partner`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleThreadAccessResponse(response)) {
                return;
            }

            if (response.ok) {
                const data = await response.json();
                setPartnerProfile((data.partner ?? data) as PartnerProfile);
            } else {
                setProfileError("Profile unavailable. Please try again.");
            }
        } catch (error) {
            console.error("Failed to fetch partner profile", error);
            setProfileError("Network error. Please try again.");
        } finally {
            setLoadingProfile(false);
        }
    }, [conversationUnavailableMessage, handleThreadAccessResponse, id, token]);

    const fetchMessages = useCallback(async (cursor?: string | null) => {
        if (!token || !id || conversationUnavailableMessage) return;
        try {
            const url = cursor
                ? `${API_BASE_URL}/api/chat/threads/${id}/messages?limit=50&before=${cursor}`
                : `${API_BASE_URL}/api/chat/threads/${id}/messages?limit=50`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleThreadAccessResponse(response)) {
                return;
            }

            if (response.ok) {
                const data = await response.json();
                const rawMessages = data.messages || [];
                const newCursor = data.next_cursor;

                const mapped: IMessage[] = rawMessages.map((m: any) => ({
                    _id: m.id,
                    text: m.content || m.text || "",
                    createdAt: m.created_at,
                    user: {
                        _id: m.sender_id,
                        name: m.sender_id === (user as any)?._id ? 'Me' : 'Match'
                    }
                }));

                setMessages(prev => {
                    let combined: IMessage[];

                    if (!cursor) {
                        // Polling / Initial Load
                        // 1. Keep temp messages from prev state (optimistic sends that haven't been replaced yet)
                        const pendingTemp = prev.filter(m => isTempId(m._id));
                        // 2. Combine pending temp + new server snapshot
                        combined = [...pendingTemp, ...mapped];
                    } else {
                        // Pagination Load
                        // Merge older messages with current state
                        combined = [...prev, ...mapped];
                    }

                    // Dedupe & Sort
                    const unique = dedupeById(combined);
                    return sortAsc(unique);
                });

                // Update cursor logic:
                // If cursor was provided, we are paginating, update if newCursor exists.
                // If no cursor (initial), we set it.
                setNextCursor((prev) => (cursor || !prev ? newCursor : prev));
            } else {
                setStatusNotice({
                    tone: 'error',
                    text: 'Unable to load messages right now.',
                });
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
            setStatusNotice({
                tone: 'error',
                text: 'Unable to load messages right now.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [conversationUnavailableMessage, handleThreadAccessResponse, id, token, user]);

    const markRead = useCallback(async () => {
        if (!token || !id || conversationUnavailableMessage) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/threads/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await handleThreadAccessResponse(response);
        } catch (e) {
            console.error("Failed to mark read", e);
        }
    }, [conversationUnavailableMessage, handleThreadAccessResponse, id, token]);

    useEffect(() => {
        if (conversationUnavailableMessage) {
            return;
        }

        fetchMessages();
        fetchPartnerProfile();
        markRead();

        const interval = setInterval(() => fetchMessages(), 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [conversationUnavailableMessage, fetchMessages, fetchPartnerProfile, markRead]);


    const handleWebSend = async () => {
        if (!webInputText.trim() || !token || conversationUnavailableMessage) return;

        const tempId = Date.now();
        const textToSend = webInputText;
        setWebInputText('');

        // Optimistic update
        const newMessage: IMessage = {
            _id: tempId,
            text: textToSend,
            createdAt: new Date(),
            user: { _id: (user as any)?._id || 'me' }
        };

        // Add temp message immediately, deduped and sorted
        setMessages(prev => {
            const updated = [...prev, newMessage];
            return sortAsc(dedupeById(updated));
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/threads/${id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text: textToSend })
            });

            if (await handleThreadAccessResponse(response)) {
                setMessages(prev => prev.filter(m => m._id !== tempId));
                return;
            }

            if (await handleApiError(response, signOut)) {
                setMessages(prev => prev.filter(m => m._id !== tempId));
                return;
            }

            if (response.ok) {
                // Success: remove temp message and fetch real ones
                // Although polling does this, immediate fetch is better
                setMessages(prev => prev.filter(m => m._id !== tempId));
                fetchMessages();
            } else {
                setMessages(prev => prev.filter(m => m._id !== tempId));
                setStatusNotice({
                    tone: 'error',
                    text: 'Unable to send message right now.',
                });
            }
        } catch (error) {
            console.error("Send error", error);
            setMessages(prev => prev.filter(m => m._id !== tempId));
            setStatusNotice({
                tone: 'error',
                text: 'Connection issue. Try again.',
            });
        }
    };

    const handleMuteUser = async () => {
        if (!token || !targetUserId) {
            setStatusNotice({ tone: 'error', text: 'Actions are unavailable right now.' });
            return;
        }

        setSafetyBusyAction('mute');

        try {
            await muteUser(targetUserId, token);
            setSafetyMenuVisible(false);
            setStatusNotice({ tone: 'success', text: 'User muted.' });
        } catch (error) {
            await handleSafetyActionError('mute', error);
        } finally {
            setSafetyBusyAction(null);
        }
    };

    const handleReportUser = async (category: SafetyReportCategory) => {
        if (!token || !targetUserId) {
            setStatusNotice({ tone: 'error', text: 'Actions are unavailable right now.' });
            return;
        }

        setSafetyBusyAction('report');

        try {
            await reportUser({
                targetUserId,
                category,
                token,
            });
            setSafetyMenuVisible(false);
            setStatusNotice({ tone: 'success', text: 'Report submitted.' });
        } catch (error) {
            await handleSafetyActionError('report', error);
        } finally {
            setSafetyBusyAction(null);
        }
    };

    const handleBlockUser = async () => {
        if (!token || !targetUserId) {
            setStatusNotice({ tone: 'error', text: 'Actions are unavailable right now.' });
            return;
        }

        setSafetyBusyAction('block');

        try {
            await blockUser(targetUserId, token);
            markConversationUnavailable(BLOCKED_THREAD_MESSAGE);
        } catch (error) {
            await handleSafetyActionError('block', error);
        } finally {
            setSafetyBusyAction(null);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>

                <TouchableOpacity
                    disabled={!!conversationUnavailableMessage}
                    style={styles.profileHeader}
                    onPress={() => setIsProfileOpen(true)}
                >
                    <Image source={{ uri: pPhoto }} style={styles.headerAvatar} />
                    <View>
                        <Text style={styles.headerName}>{pName}</Text>
                        <Text style={styles.headerStatus}>
                            {conversationUnavailableMessage ? 'Unavailable' : 'Online'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        disabled={!!conversationUnavailableMessage}
                        style={styles.infoButton}
                        onPress={() => setIsProfileOpen(true)}
                    >
                        <Ionicons name="information-circle-outline" size={26} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityLabel="Safety actions"
                        disabled={!targetUserId || !!conversationUnavailableMessage}
                        testID="safety-menu-trigger"
                        style={[styles.menuButton, (!targetUserId || !!conversationUnavailableMessage) && styles.iconButtonDisabled]}
                        onPress={() => setSafetyMenuVisible(true)}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.primaryText} />
                    </TouchableOpacity>
                </View>
            </View>

            {statusNotice ? (
                <View style={[styles.statusNotice, statusNotice.tone === 'error' && styles.statusNoticeError]}>
                    <Text style={styles.statusNoticeText}>{statusNotice.text}</Text>
                </View>
            ) : null}

            {conversationUnavailableMessage ? (
                <View style={styles.unavailableContainer}>
                    <Ionicons name="shield-checkmark-outline" size={42} color={COLORS.primary} />
                    <Text style={styles.unavailableTitle}>Conversation unavailable</Text>
                    <Text style={styles.unavailableText}>{conversationUnavailableMessage}</Text>
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)/matches')}
                        style={styles.unavailableButton}
                    >
                        <Text style={styles.unavailableButtonText}>Back to matches</Text>
                    </TouchableOpacity>
                </View>
            ) : isLoading && messages.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.webChatContent}
                    onContentSizeChange={() => {
                        // Only auto-scroll to end if we are at the bottom or it's initial load?
                        // For now keep as is, but if we load older messages, we probably DON'T want to scroll to bottom.
                        // Ideally we detect that but let's leave as is per "Minimal" requirement or it will be jarring.
                        // Actually, if we prepend messages content size changes, causing scroll to bottom.
                        // User constraint: "Only fix API parsing + pagination support (minimal)"
                        // We will keep scroll behavior simple.
                        if (!nextCursor) { // Heuristic: only scroll if we don't have pages loaded? no.
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                >
                    {nextCursor && (
                        <TouchableOpacity
                            onPress={() => fetchMessages(nextCursor)}
                            style={{ padding: 10, alignItems: 'center' }}
                        >
                            <Text style={{ color: COLORS.brandBase, fontSize: 14 }}>Load older messages</Text>
                        </TouchableOpacity>
                    )}
                    {/* Render messages directly (no reverse) because state is sorted ascending (oldest -> newest) */}
                    {messages.map((msg) => {
                        const isMe = msg.user._id === (user as any)?._id || msg.user._id === 'me';
                        return (
                            <View key={msg._id} style={[styles.webBubbleWrapper, isMe ? styles.webBubbleRight : styles.webBubbleLeft]}>
                                <View style={[styles.webBubble, isMe ? styles.webBubbleBgRight : styles.webBubbleBgLeft]}>
                                    <Text style={isMe ? styles.webTextRight : styles.webTextLeft}>{msg.text}</Text>
                                </View>
                                <Text style={styles.webTime}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {!conversationUnavailableMessage ? (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
                    <View style={styles.webInputContainer}>
                        <TextInput
                            style={styles.webInput}
                            placeholder="Type a message..."
                            placeholderTextColor={COLORS.disabledText}
                            value={webInputText}
                            onChangeText={setWebInputText}
                            onSubmitEditing={handleWebSend}
                            returnKeyType="send"
                        />
                        <TouchableOpacity onPress={handleWebSend} style={styles.webSendButton}>
                            <Ionicons name="send" size={20} color={COLORS.brandBase} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            ) : null}
            {/* Profile Drawer Modal */}
            <Modal
                visible={isProfileOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsProfileOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setIsProfileOpen(false)} />
                    <View style={styles.profileDrawer}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
                            {loadingProfile ? (
                                // SKELTON LOADER
                                <View style={{ padding: 20 }}>
                                    <View style={[styles.skeletonBlock, { height: 300, borderRadius: 16, marginBottom: 20 }]} />
                                    <View style={[styles.skeletonBlock, { height: 24, width: '60%', marginBottom: 12 }]} />
                                    <View style={[styles.skeletonBlock, { height: 16, width: '90%', marginBottom: 8 }]} />
                                    <View style={[styles.skeletonBlock, { height: 16, width: '80%', marginBottom: 20 }]} />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={[styles.skeletonBlock, { height: 32, width: 80, borderRadius: 16 }]} />
                                        <View style={[styles.skeletonBlock, { height: 32, width: 80, borderRadius: 16 }]} />
                                    </View>
                                </View>
                            ) : profileError ? (
                                // ERROR STATE
                                <View style={styles.centerContainer}>
                                    <Ionicons name="alert-circle-outline" size={48} color={COLORS.destructive} />
                                    <Text style={styles.errorText}>{profileError}</Text>
                                    <TouchableOpacity style={styles.retryButton} onPress={fetchPartnerProfile}>
                                        <Text style={styles.retryText}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                // SUCCESS CONTENT
                                <View style={{ position: 'relative' }}>
                                    {/* Close Button Float */}
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
                                        onPress={() => setIsProfileOpen(false)}
                                    >
                                        <BlurView intensity={30} style={styles.closeBlur}>
                                            <Ionicons name="close" size={24} color={COLORS.primaryText} />
                                        </BlurView>
                                    </TouchableOpacity>

                                    <PartnerProfileView
                                        profile={partnerProfile ?? ({ id: targetUserId || 'partner' } as PartnerProfile)}
                                        fallbackName={pName}
                                        fallbackAge={pAge}
                                        fallbackPhoto={pPhoto}
                                    />

                                    {/* Actions */}
                                    <View style={styles.drawerActions}>
                                        <TouchableOpacity style={styles.actionButton} onPress={() => setIsProfileOpen(false)}>
                                            <Text style={styles.actionButtonText}>Keep Chatting</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <SafetyActionsMenu
                visible={safetyMenuVisible}
                onClose={() => setSafetyMenuVisible(false)}
                onMute={handleMuteUser}
                onBlock={handleBlockUser}
                onReport={handleReportUser}
                busyAction={safetyBusyAction}
                targetName={pName}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        height: 60
    },
    backButton: { marginRight: SPACING.md },
    profileHeader: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.sm },
    headerName: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.primaryText },
    headerStatus: { fontSize: 12, color: COLORS.success },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    infoButton: { padding: SPACING.xs },
    menuButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    iconButtonDisabled: { opacity: 0.45 },
    statusNotice: {
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.35)',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    statusNoticeError: {
        borderColor: 'rgba(225, 29, 72, 0.35)',
        backgroundColor: 'rgba(225, 29, 72, 0.12)',
    },
    statusNoticeText: {
        color: COLORS.primaryText,
        fontSize: 12,
        textAlign: 'center',
    },
    unavailableContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.screen,
    },
    unavailableTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginTop: SPACING.md,
    },
    unavailableText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginTop: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    unavailableButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.pill,
    },
    unavailableButtonText: {
        color: COLORS.brandBase,
        fontSize: 14,
        fontWeight: '700',
    },

    // Web Chat Styles
    webChatContent: { padding: SPACING.md, paddingBottom: 20 },
    webBubbleWrapper: { marginVertical: 4, maxWidth: '80%' },
    webBubbleLeft: { alignSelf: 'flex-start' },
    webBubbleRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    webBubble: { padding: 12, borderRadius: 16 },
    webBubbleBgLeft: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
    webBubbleBgRight: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    webTextLeft: { color: COLORS.primaryText, fontSize: 16 },
    webTextRight: { color: COLORS.brandBase, fontSize: 16 },
    webTime: { fontSize: 10, color: COLORS.secondaryText, marginTop: 4, alignSelf: 'flex-end' },
    webInputContainer: {
        flexDirection: 'row', padding: SPACING.sm, borderTopWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.background, alignItems: 'center'
    },
    webInput: {
        flex: 1, height: 44, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.md, color: COLORS.primaryText, marginRight: SPACING.sm,
        outlineStyle: 'none' as any, // web only
        fontSize: 16
    },
    webSendButton: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center'
    },

    // Modal / Drawer Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-end' },
    modalBackdrop: { flex: 1 },
    profileDrawer: {
        width: Platform.OS === 'web' ? 420 : '85%',
        height: '100%',
        backgroundColor: COLORS.background,
        ...SHADOWS.card
    },
    heroContainer: { height: 300, position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    closeButton: { position: 'absolute', top: 20, left: 20 },
    closeBlur: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.4)' }, // simplified gradient
    heroContent: { position: 'absolute', bottom: 20, left: 20 },
    heroName: { ...TYPOGRAPHY.h1, color: '#FFF' },
    matchBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
    matchBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    drawerSection: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText, marginBottom: SPACING.sm },
    bioText: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, lineHeight: 22 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    tagText: { color: COLORS.primaryText, fontSize: 14 },
    drawerActions: { padding: SPACING.lg },
    actionButton: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.pill, alignItems: 'center' },
    actionButtonText: { color: COLORS.brandBase, fontSize: 16, fontWeight: 'bold' },

    // New Styles for Loading/Error
    skeletonBlock: { backgroundColor: COLORS.border, borderRadius: RADIUS.sm },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
    errorText: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, textAlign: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
    retryButton: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
    retryText: { ...TYPOGRAPHY.bodyBase, fontWeight: '600', color: COLORS.primaryText }

});
