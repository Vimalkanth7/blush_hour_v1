import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../constants/Theme';

interface CardProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

export function Card({ style, children }: CardProps) {
    return (
        <View style={[styles.card, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surfaceElevated || COLORS.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card
    }
});
