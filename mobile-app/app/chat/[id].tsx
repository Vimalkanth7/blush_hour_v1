import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, handleApiError } from '../../constants/Api';
import { useAuth } from '../../context/AuthContext';
import { BlurView } from 'expo-blur';
import PartnerProfileView, { PartnerProfile } from '../../components/profile/PartnerProfileView';

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

const { width, height } = Dimensions.get('window');

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
    const { id, partnerId, partnerName, partnerPhoto, partnerAge } = useLocalSearchParams();
    const router = useRouter();
    const { user, token, refreshProfile, signOut } = useAuth();
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [webInputText, setWebInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [partnerProfile, setPartnerProfile] = useState<any>(null); // Store full profile
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const pName = (partnerName as string) || 'Match';
    const pPhoto = (partnerPhoto as string) || 'https://placeimg.com/150/150/people';
    const pAge = (partnerAge as string) || '24'; // default fallback

    const fetchPartnerProfile = async () => {
        if (!token || !id) return;
        setLoadingProfile(true);
        setProfileError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/threads/${id}/partner`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPartnerProfile(data.partner ?? data);
            } else {
                setProfileError("Profile unavailable. Please try again.");
            }
        } catch (error) {
            console.error("Failed to fetch partner profile", error);
            setProfileError("Network error. Please try again.");
        } finally {
            setLoadingProfile(false);
        }
    };

    const fetchMessages = async (cursor?: string | null) => {
        if (!token || !id) return;
        try {
            const url = cursor
                ? `${API_BASE_URL}/api/chat/threads/${id}/messages?limit=50&before=${cursor}`
                : `${API_BASE_URL}/api/chat/threads/${id}/messages?limit=50`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

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
                if (cursor || !nextCursor) {
                    setNextCursor(newCursor);
                }
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
        } finally {
            setIsLoading(false);
        }
    };

    const markRead = async () => {
        if (!token || !id) return;
        try {
            await fetch(`${API_BASE_URL}/api/chat/threads/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Failed to mark read", e);
        }
    };

    useEffect(() => {
        fetchMessages();
        fetchPartnerProfile();
        markRead();

        const interval = setInterval(() => fetchMessages(), 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [id, token]);


    const handleWebSend = async () => {
        if (!webInputText.trim() || !token) return;

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

            if (await handleApiError(response, signOut)) return;

            if (response.ok) {
                // Success: remove temp message and fetch real ones
                // Although polling does this, immediate fetch is better
                setMessages(prev => prev.filter(m => m._id !== tempId));
                fetchMessages();
            } else {
                console.error("Send failed");
                // Optional: mark error, but for now just leave temp or remove? 
                // Requirement said "minimal required is ok". 
                // Let's remove temp on definite failure to avoid stuck state if not implementing full retry UI.
                setMessages(prev => prev.filter(m => m._id !== tempId));
                alert("Failed to send message");
            }
        } catch (error) {
            console.error("Send error", error);
            // Remove temp on network error
            setMessages(prev => prev.filter(m => m._id !== tempId));
            alert("Failed to send message: Network error");
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileHeader} onPress={() => setIsProfileOpen(true)}>
                    <Image source={{ uri: pPhoto }} style={styles.headerAvatar} />
                    <View>
                        <Text style={styles.headerName}>{pName}</Text>
                        <Text style={styles.headerStatus}>Online</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.infoButton} onPress={() => setIsProfileOpen(true)}>
                    <Ionicons name="information-circle-outline" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {isLoading && messages.length === 0 ? (
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
                                        profile={partnerProfile || {}}
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
    infoButton: { padding: SPACING.sm },

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
