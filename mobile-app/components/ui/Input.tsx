import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
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
    autoFocus = false,
    blurOnSubmit = false,
    editable = true,
    showSoftInputOnFocus = true,
    onFocus,
    onBlur,
    ...props
}: InputProps) {
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const handleFocus = (event: any) => {
        setFocused(true);
        onFocus?.(event);
    };

    const handleBlur = (event: any) => {
        setFocused(false);
        onBlur?.(event);
    };

    const handlePress = () => {
        if (!editable) {
            return;
        }

        inputRef.current?.focus();
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
        <Pressable
            accessible={false}
            onPress={handlePress}
            style={[
                styles.container,
                focused && styles.containerFocused,
                focused && webRingStyle,
                containerStyle
            ]}
        >
            {leftSlot ? <View style={styles.slotLeft}>{leftSlot}</View> : null}
            <TextInput
                ref={inputRef}
                {...props}
                autoFocus={autoFocus}
                blurOnSubmit={blurOnSubmit}
                disableFullscreenUI={Platform.OS === 'android'}
                editable={editable}
                onFocus={handleFocus}
                onBlur={handleBlur}
                showSoftInputOnFocus={showSoftInputOnFocus}
                style={[styles.input, style]}
                placeholderTextColor={props.placeholderTextColor || COLORS.disabledText}
                underlineColorAndroid="transparent"
            />
            {rightSlot ? <View style={styles.slotRight}>{rightSlot}</View> : null}
        </Pressable>
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
