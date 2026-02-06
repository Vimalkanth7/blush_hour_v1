import React, { useState } from 'react';
import { Platform, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/Theme';

interface InputProps extends TextInputProps {
    containerStyle?: StyleProp<ViewStyle>;
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
}

export function Input({
    containerStyle,
    leftSlot,
    rightSlot,
    style,
    onFocus,
    onBlur,
    ...props
}: InputProps) {
    const [focused, setFocused] = useState(false);

    const handleFocus = (event: any) => {
        setFocused(true);
        onFocus?.(event);
    };

    const handleBlur = (event: any) => {
        setFocused(false);
        onBlur?.(event);
    };

    const webRingStyle = Platform.OS === 'web'
        ? ({ boxShadow: `0 0 0 3px ${COLORS.focusRing}` } as ViewStyle)
        : {
            shadowColor: COLORS.primary,
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 2,
        };

    return (
        <View
            style={[
                styles.container,
                focused && styles.containerFocused,
                focused && webRingStyle,
                containerStyle
            ]}
        >
            {leftSlot ? <View style={styles.slotLeft}>{leftSlot}</View> : null}
            <TextInput
                {...props}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={[styles.input, style]}
                placeholderTextColor={props.placeholderTextColor || COLORS.disabledText}
            />
            {rightSlot ? <View style={styles.slotRight}>{rightSlot}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    containerFocused: {
        borderColor: COLORS.primary,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily,
        paddingVertical: 0,
    },
    slotLeft: {
        marginRight: SPACING.sm
    },
    slotRight: {
        marginLeft: SPACING.sm
    }
});
