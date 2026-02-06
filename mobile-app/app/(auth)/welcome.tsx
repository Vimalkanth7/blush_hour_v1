import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
    const router = useRouter();

    const handlePhoneLogin = () => {
        router.push('/phone-login');
    };

    return (
        <View style={styles.container}>
            {/* Background (Placeholder Image for now, Video ready) */}
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1621609764180-2ca554a9d6f2?q=80&w=1974&auto=format&fit=crop' }}
                style={styles.background}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradient}
                />

                <View style={styles.content}>
                    <Text style={styles.title}>Blush Hour</Text>
                    <Text style={styles.subtitle}>Make the first move.</Text>

                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/login')}>
                        <Text style={styles.primaryButtonText}>Log In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/phone-login')}>
                        <Text style={styles.secondaryButtonText}>Create Account</Text>
                    </TouchableOpacity>

                    {/* <TouchableOpacity style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Continue with Google</Text>
                    </TouchableOpacity> */}

                    <Link href="/(tabs)/discovery" asChild>
                        <TouchableOpacity style={{ marginTop: 20 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)' }}>Dev Bypass: Go to App</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { flex: 1, justifyContent: 'flex-end' },
    gradient: {
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: height * 0.6,
    },
    content: {
        padding: SPACING.screen,
        paddingBottom: SPACING.display,
        alignItems: 'center',
        width: '100%',
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primary,
        marginBottom: SPACING.sm,
    },
    subtitle: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.background, // White on dark gradient
        marginBottom: SPACING.display,
        fontWeight: '600',
    },
    primaryButton: {
        width: '100%',
        backgroundColor: COLORS.primary,
        padding: SPACING.lg,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    primaryButtonText: {
        color: COLORS.brandBase,
        fontWeight: 'bold',
        fontSize: TYPOGRAPHY.bodyBase.fontSize,
    },
    secondaryButton: {
        width: '100%',
        backgroundColor: COLORS.background,
        padding: SPACING.lg,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    secondaryButtonText: {
        color: COLORS.brandBase,
        fontWeight: '600',
        fontSize: TYPOGRAPHY.bodyBase.fontSize,
    },
});
