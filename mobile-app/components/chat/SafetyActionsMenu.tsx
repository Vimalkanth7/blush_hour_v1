import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/Theme';
import {
    SAFETY_REPORT_OPTIONS,
    type SafetyActionKind,
    type SafetyReportCategory,
} from '../../constants/Api';

type MenuStep = 'menu' | 'report' | 'block';

interface SafetyActionsMenuProps {
    visible: boolean;
    onClose: () => void;
    onMute: () => void | Promise<void>;
    onBlock: () => void | Promise<void>;
    onReport: (category: SafetyReportCategory) => void | Promise<void>;
    busyAction: SafetyActionKind | null;
    targetName?: string;
}

interface ActionRowProps {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    destructive?: boolean;
    loading?: boolean;
    disabled?: boolean;
    testID?: string;
}

function ActionRow({
    icon,
    label,
    onPress,
    destructive = false,
    loading = false,
    disabled = false,
    testID,
}: ActionRowProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.88}
            accessibilityLabel={label}
            accessibilityRole="button"
            disabled={disabled || loading}
            onPress={onPress}
            testID={testID}
            style={[
                styles.actionRow,
                destructive && styles.actionRowDestructive,
                (disabled || loading) && styles.actionRowDisabled,
            ]}
        >
            <View style={styles.actionRowContent}>
                <Ionicons
                    name={icon}
                    size={18}
                    color={destructive ? COLORS.destructive : COLORS.primaryText}
                />
                <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>
                    {label}
                </Text>
            </View>
            {loading ? (
                <ActivityIndicator color={destructive ? COLORS.destructive : COLORS.primary} size="small" />
            ) : (
                <Ionicons name="chevron-forward" size={16} color={COLORS.secondaryText} />
            )}
        </TouchableOpacity>
    );
}

export default function SafetyActionsMenu({
    visible,
    onClose,
    onMute,
    onBlock,
    onReport,
    busyAction,
    targetName,
}: SafetyActionsMenuProps) {
    const [step, setStep] = useState<MenuStep>('menu');

    useEffect(() => {
        if (!visible) {
            setStep('menu');
        }
    }, [visible]);

    const closeDisabled = busyAction !== null;
    const subtitle = targetName ? `For ${targetName}` : 'Keep this interaction private and controlled.';

    return (
        <Modal
            animationType="fade"
            onRequestClose={closeDisabled ? undefined : onClose}
            transparent
            visible={visible}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    activeOpacity={1}
                    disabled={closeDisabled}
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.sheetWrap}>
                    <View style={styles.sheet}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.title}>
                                    {step === 'menu'
                                        ? 'Safety actions'
                                        : step === 'report'
                                            ? 'Report user'
                                            : 'Block user'}
                                </Text>
                                <Text style={styles.subtitle}>{subtitle}</Text>
                            </View>

                            <TouchableOpacity
                                disabled={closeDisabled}
                                accessibilityLabel={step === 'menu' ? 'Close safety actions' : 'Back to safety actions'}
                                onPress={step === 'menu' ? onClose : () => setStep('menu')}
                                style={styles.closeButton}
                            >
                                <Ionicons
                                    name={step === 'menu' ? 'close' : 'arrow-back'}
                                    size={18}
                                    color={COLORS.primaryText}
                                />
                            </TouchableOpacity>
                        </View>

                        {step === 'menu' ? (
                            <View style={styles.body}>
                                <ActionRow
                                    icon="flag-outline"
                                    label="Report user"
                                    loading={busyAction === 'report'}
                                    onPress={() => setStep('report')}
                                    testID="safety-action-report"
                                />
                                <ActionRow
                                    icon="volume-mute-outline"
                                    label="Mute user"
                                    loading={busyAction === 'mute'}
                                    onPress={() => void onMute()}
                                    testID="safety-action-mute"
                                />
                                <ActionRow
                                    destructive
                                    icon="ban-outline"
                                    label="Block user"
                                    loading={busyAction === 'block'}
                                    onPress={() => setStep('block')}
                                    testID="safety-action-block"
                                />
                            </View>
                        ) : null}

                        {step === 'report' ? (
                            <View style={styles.body}>
                                <Text style={styles.helpText}>Choose a reason to submit.</Text>
                                {SAFETY_REPORT_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        activeOpacity={0.88}
                                        accessibilityLabel={option.label}
                                        accessibilityRole="button"
                                        disabled={busyAction !== null}
                                        onPress={() => void onReport(option.value)}
                                        testID={`safety-report-${option.value}`}
                                        style={[styles.reasonChip, busyAction !== null && styles.actionRowDisabled]}
                                    >
                                        <Text style={styles.reasonChipText}>{option.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}

                        {step === 'block' ? (
                            <View style={styles.body}>
                                <Text style={styles.helpText}>
                                    Block this user? This connection will no longer be available.
                                </Text>
                                <View style={styles.confirmRow}>
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        accessibilityLabel="Cancel block"
                                        accessibilityRole="button"
                                        disabled={busyAction !== null}
                                        onPress={() => setStep('menu')}
                                        style={[styles.secondaryButton, busyAction !== null && styles.actionRowDisabled]}
                                    >
                                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        accessibilityLabel="Confirm block user"
                                        accessibilityRole="button"
                                        disabled={busyAction !== null}
                                        onPress={() => void onBlock()}
                                        testID="safety-confirm-block"
                                        style={[styles.destructiveButton, busyAction !== null && styles.actionRowDisabled]}
                                    >
                                        {busyAction === 'block' ? (
                                            <ActivityIndicator color={COLORS.primaryText} size="small" />
                                        ) : (
                                            <Text style={styles.destructiveButtonText}>Block user</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 10, 20, 0.72)',
        justifyContent: 'flex-end',
    },
    sheetWrap: {
        paddingHorizontal: SPACING.screen,
        paddingBottom: SPACING.screen,
    },
    sheet: {
        width: '100%',
        maxWidth: Platform.OS === 'web' ? 420 : 999,
        alignSelf: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.lg,
        ...SHADOWS.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
        marginTop: SPACING.xs,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    body: {
        gap: SPACING.sm,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    actionRowDestructive: {
        borderColor: 'rgba(225, 29, 72, 0.35)',
    },
    actionRowDisabled: {
        opacity: 0.6,
    },
    actionRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        flexShrink: 1,
    },
    actionLabel: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primaryText,
        fontWeight: '600',
    },
    actionLabelDestructive: {
        color: COLORS.destructive,
    },
    helpText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
    },
    reasonChip: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    reasonChipText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primaryText,
        fontWeight: '600',
    },
    confirmRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    secondaryButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.background,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primaryText,
        fontWeight: '600',
    },
    destructiveButton: {
        flex: 1,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.destructive,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    destructiveButtonText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primaryText,
        fontWeight: '700',
    },
});
