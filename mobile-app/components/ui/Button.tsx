import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/Theme';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}

export function Button({
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    style,
    textStyle
}: ButtonProps) {
    const isPrimary = variant === 'primary';
    const baseTextColor = isPrimary ? COLORS.brandBase : COLORS.primaryText;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed, hovered }) => [
                styles.base,
                isPrimary ? styles.primary : styles.secondary,
                hovered && !disabled && !loading && (isPrimary ? styles.primaryHover : styles.secondaryHover),
                pressed && !disabled && !loading && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
                (disabled || loading) && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={baseTextColor} />
            ) : (
                <Text style={[styles.text, { color: baseTextColor }, textStyle]}>{label}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.xl,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.small,
        ...Platform.select({ web: { cursor: 'pointer' as const } })
    },
    text: {
        ...TYPOGRAPHY.bodyBase,
        fontWeight: 'bold'
    },
    primary: {
        backgroundColor: COLORS.primary
    },
    primaryHover: {
        backgroundColor: COLORS.primaryHover
    },
    primaryPressed: {
        backgroundColor: COLORS.primaryPressed
    },
    secondary: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    secondaryHover: {
        backgroundColor: COLORS.surface
    },
    secondaryPressed: {
        backgroundColor: COLORS.border
    },
    disabled: {
        opacity: 0.6
    }
});
