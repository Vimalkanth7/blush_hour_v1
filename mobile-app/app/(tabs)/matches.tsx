import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../constants/Api';
import { useAuth } from '../../context/AuthContext';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const MATCH_QUEUE = [
    { id: '1', name: 'Sarah', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', isBlurred: true },
    { id: '2', name: 'Jessica', photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&q=80', isBlurred: true },
    { id: '3', name: 'Emily', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', isBlurred: false, expires: '18h' },
];

const CHATS = [
    {
        id: '101',
        name: 'Maya',
        photo: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=150&q=80',
        lastMessage: 'Haha, that is exactly what I was thinking!',
        time: '2m',
        unread: 1
    },
    {
        id: '102',
        name: 'Chloe',
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        lastMessage: 'When are you free?',
        time: '1h',
        unread: 0
    },
];

export default function MatchesScreen() {
    const router = useRouter();
    const { token, user } = useAuth();
    const [threads, setThreads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Using a simple interval for polling since we don't have sockets yet
    useEffect(() => {
        if (!token) return;

        const fetchThreads = async () => {
            try {
                // setIsLoading(true); // Don't show global loading on poll
                const response = await fetch(`${API_BASE_URL}/api/chat/threads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();

                    // Debug backend response
                    console.log("THREADS RESPONSE:", data);

                    const threadsList = data.threads || [];

                    // Map backend threads to UI shape
                    // Backend Thread item: { thread_id, partner: { id, first_name, photo_url }, last_message, unread_count, updated_at }
                    const mappedThreads = threadsList.map((t: any) => {
                        // Safe access to partner object
                        const partner = t.partner || {};
                        const name = partner.first_name || 'Unknown';
                        const photo = partner.photo_url || 'https://placeimg.com/150/150/people';

                        return {
                            id: t.thread_id, // Use thread_id for navigation
                            name: name,
                            photo: photo,
                            lastMessage: t.last_message || 'Start a conversation',
                            // Format time if present
                            time: t.updated_at ? new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                            unread: t.unread_count || 0
                        };
                    });
                    setThreads(mappedThreads);
                }
            } catch (error) {
                console.error("Failed to fetch threads", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchThreads();
        const interval = setInterval(fetchThreads, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [token, user]);

    const handleChatPress = (id: string, partner: any) => {
        router.push({
            pathname: '/chat/[id]',
            params: {
                id,
                partnerId: partner.id,
                partnerName: partner.name,
                partnerPhoto: partner.photo,
                partnerAge: partner.age || '25' // Fallback or pass if available in state
            }
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Matches</Text>
                <TouchableOpacity>
                    <Ionicons name="search" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Match Queue */}
                <View style={styles.queueSection}>
                    <Text style={styles.sectionTitle}>Match Queue</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.queueContainer}>
                        {/* Premium 'Who Likes You' Card */}
                        <View style={styles.goldCard}>
                            <View style={[styles.goldCircle, { borderColor: COLORS.primary }]}>
                                <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                                <Text style={styles.goldCount}>5</Text>
                            </View>
                            <Text style={styles.queueName}>Likes</Text>
                        </View>

                        {MATCH_QUEUE.map((match) => (
                            <TouchableOpacity key={match.id} style={styles.matchItem}>
                                <View style={styles.imageWrapper}>
                                    <Image source={{ uri: match.photo }} style={styles.matchImage} />
                                    {match.isBlurred && (
                                        <BlurView intensity={40} style={[StyleSheet.absoluteFill, styles.blur]} />
                                    )}
                                </View>
                                <Text style={styles.queueName}>{match.name}</Text>
                                {match.expires && (
                                    <View style={styles.timerBadge}>
                                        <Text style={styles.timerText}>{match.expires}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Conversations */}
                <View style={styles.chatSection}>
                    <Text style={styles.sectionTitle}>Conversations</Text>
                    {threads.length === 0 ? (
                        <Text style={{ color: COLORS.secondaryText, padding: 20 }}>No conversations yet.</Text>
                    ) : (
                        threads.map((chat) => (
                            <TouchableOpacity key={chat.id} style={styles.chatRow} onPress={() => handleChatPress(chat.id, chat)}>
                                <Image source={{ uri: chat.photo }} style={styles.chatImage} />
                                <View style={styles.chatContent}>
                                    <View style={styles.chatHeader}>
                                        <Text style={styles.chatName}>{chat.name}</Text>
                                        <Text style={styles.chatTime}>{chat.time}</Text>
                                    </View>
                                    <Text style={[styles.chatPreview, chat.unread > 0 && styles.unreadPreview]} numberOfLines={1}>
                                        {chat.lastMessage}
                                    </Text>
                                </View>
                                {chat.unread > 0 && (
                                    <View style={styles.unreadDot} />
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md
    },
    title: {
        ...TYPOGRAPHY.h1,
        color: COLORS.primaryText
    },
    queueSection: { marginBottom: SPACING.xxl },
    sectionTitle: {
        ...TYPOGRAPHY.h2,
        fontSize: 18,
        color: COLORS.secondaryText,
        marginLeft: SPACING.screen,
        marginBottom: SPACING.md
    },
    queueContainer: { paddingHorizontal: SPACING.screen, gap: SPACING.lg },
    goldCard: { alignItems: 'center', width: 70 },
    goldCircle: {
        width: 70, height: 70, borderRadius: 35, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        marginBottom: SPACING.sm, backgroundColor: COLORS.surface
    },
    goldCount: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
    matchItem: { alignItems: 'center', width: 70 },
    imageWrapper: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', marginBottom: SPACING.sm },
    matchImage: { width: '100%', height: '100%' },
    blur: { backgroundColor: 'rgba(255,255,0,0.2)' },
    queueName: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primaryText
    },
    timerBadge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 10, borderWidth: 1, borderColor: 'white'
    },
    timerText: { fontSize: 10, fontWeight: '700', color: COLORS.brandBase },
    chatSection: { paddingHorizontal: SPACING.screen },
    chatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl },
    chatImage: { width: 60, height: 60, borderRadius: 30, marginRight: SPACING.md },
    chatContent: { flex: 1, paddingRight: 10 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    chatName: {
        ...TYPOGRAPHY.bodyLarge,
        fontWeight: '700',
        color: COLORS.primaryText
    },
    chatTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText
    },
    chatPreview: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText
    },
    unreadPreview: { color: COLORS.primaryText, fontWeight: '600' },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }
});
