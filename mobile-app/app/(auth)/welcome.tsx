import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';

const { height } = Dimensions.get('window');

export default function LandingScreen() {
    const router = useRouter();

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

                    <Button
                        label="Log In"
                        onPress={() => router.push('/login')}
                        style={styles.primaryButton}
                    />

                    <Button
                        label="Create Account"
                        onPress={() => router.push('/phone-login')}
                        variant="secondary"
                        style={styles.secondaryButton}
                    />

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
        marginBottom: SPACING.md,
    },
    secondaryButton: {
        width: '100%',
        marginBottom: SPACING.md,
    },
});
