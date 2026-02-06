import { View, Text, StyleSheet, Image, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height - 140; // Approx tab bar offset

interface SwipeCardProps {
    user: any;
    onTap?: () => void;
}

export const SwipeCard = ({ user, onTap }: SwipeCardProps) => {
    return (
        <View style={styles.cardContainer}>
            <ScrollView
                style={styles.scrollView}
                bounces={false}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section - Tappable */}
                <TouchableOpacity onPress={onTap} activeOpacity={0.9} style={styles.imageContainer}>
                    <Image source={{ uri: user.photos[0] }} style={styles.mainImage} />

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.gradient}
                    />

                    <View style={styles.overlayContent}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{user.name}, {user.age}</Text>
                            {user.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark" size={12} color="white" />
                                </View>
                            )}
                        </View>

                        <View style={styles.locationRow}>
                            <Ionicons name="location-sharp" size={16} color="#ddd" />
                            <Text style={styles.locationText}>{user.location} • {user.kmDistance}km away</Text>
                        </View>

                        {user.badges?.map((badge: any, i: number) => (
                            <View key={i} style={styles.commonBadge}>
                                <Ionicons name={badge.icon} size={14} color="#333" />
                                <Text style={styles.commonText}>{badge.text}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* Scrollable Body */}
                <View style={styles.body}>
                    {/* About Me Tags */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About Me</Text>
                        <View style={styles.chipContainer}>
                            {user.tags?.map((tag: string, i: number) => (
                                <View key={i} style={styles.chip}>
                                    <Text style={styles.chipText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Looking For */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>I'm looking for</Text>
                        <View style={styles.chipContainer}>
                            {user.lookingFor?.map((tag: string, i: number) => (
                                <View key={i} style={[styles.chip, styles.activeChip]}>
                                    <Text style={[styles.chipText, styles.activeChipText]}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Interests */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Interests</Text>
                        <View style={styles.chipContainer}>
                            {user.interests?.map((item: any, i: number) => (
                                <View key={i} style={styles.interestChip}>
                                    <Text style={styles.emoji}>{item.icon}</Text>
                                    <Text style={styles.interestText}>{item.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Prompts */}
                    {user.prompts?.map((prompt: any, i: number) => (
                        <View key={i} style={styles.promptCard}>
                            <Text style={styles.promptQuestion}>{prompt.question}</Text>
                            <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                        </View>
                    ))}

                    {/* Extra padding for scroll */}
                    <View style={{ height: 50 }} />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        width: width,
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    scrollView: {
        flex: 1,
    },
    imageContainer: {
        height: height * 0.75,
        width: '100%',
        position: 'relative',
    },
    mainImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '40%',
    },
    overlayContent: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    name: {
        fontSize: 32,
        fontWeight: '800',
        color: 'white',
        marginRight: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    verifiedBadge: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    locationText: {
        color: '#eee',
        fontSize: 14,
        marginLeft: 4,
        fontWeight: '500',
    },
    commonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginTop: 8,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    commonText: {
        color: '#333',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 6,
    },
    body: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        marginBottom: 12,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeChip: {
        backgroundColor: '#fff0f0',
        borderColor: '#ffc0c0',
    },
    chipText: {
        color: '#4b5563',
        fontSize: 14,
        fontWeight: '500',
    },
    activeChipText: {
        color: '#e11d48',
    },
    interestChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    emoji: {
        marginRight: 6,
        fontSize: 14,
    },
    interestText: {
        color: '#374151',
        fontSize: 14,
        fontWeight: '500',
    },
    promptCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#fcd34d', // Bumble yellow
    },
    promptQuestion: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginBottom: 8,
    },
    promptAnswer: {
        fontSize: 16,
        color: '#111',
        lineHeight: 24,
    },
});
