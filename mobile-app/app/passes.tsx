import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import {
    getMyPasses,
    getPassesCatalog,
    isApiRequestError,
    PassCatalogProduct,
} from '../constants/Api';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/Theme';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';

type ScreenState = 'loading' | 'ready' | 'error' | 'disabled';

const noop = () => { };

const formatUnitsLabel = (units: number) => {
    return `${units} ${units === 1 ? 'pass credit' : 'pass credits'} per purchase`;
};

const formatPlatformLabel = (platform: string | null) => {
    if (!platform) {
        return '';
    }

    return platform.charAt(0).toUpperCase() + platform.slice(1);
};

const getPassesErrorMessage = (error: unknown) => {
    if (!isApiRequestError(error)) {
        return error instanceof Error ? error.message : 'Unable to load passes right now.';
    }

    if (error.status === 0) {
        return 'Network error. Check your connection and try again.';
    }

    if (error.status === 503) {
        return 'Passes are currently unavailable.';
    }

    return error.detail || 'Unable to load passes right now.';
};

export default function PassesScreen() {
    const router = useRouter();
    const { token, signOut } = useAuth();
    const signOutRef = useRef(signOut);

    const [screenState, setScreenState] = useState<ScreenState>('loading');
    const [products, setProducts] = useState<PassCatalogProduct[]>([]);
    const [paidCredits, setPaidCredits] = useState(0);
    const [walletMissing, setWalletMissing] = useState(false);
    const [providerMode, setProviderMode] = useState<string | null>(null);
    const [platform, setPlatform] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        signOutRef.current = signOut;
    }, [signOut]);

    const loadPasses = useCallback(async () => {
        if (!token) {
            return;
        }

        setScreenState('loading');
        setStatusMessage('');

        try {
            const [catalogResponse, walletResponse] = await Promise.all([
                getPassesCatalog(token),
                getMyPasses(token),
            ]);

            const sortedProducts = [...(catalogResponse.products ?? [])]
                .filter((product) => product.active !== false)
                .sort((left, right) => left.sort_order - right.sort_order);

            setProducts(sortedProducts);
            setPaidCredits(walletResponse.wallet?.paid_pass_credits ?? 0);
            setWalletMissing(!walletResponse.wallet);
            setProviderMode(walletResponse.provider_mode || catalogResponse.provider_mode || null);
            setPlatform(catalogResponse.platform || null);
            setScreenState('ready');
        } catch (error) {
            if (isApiRequestError(error) && error.status === 401) {
                await signOutRef.current();
                return;
            }

            setStatusMessage(getPassesErrorMessage(error));
            setScreenState(
                isApiRequestError(error) && error.status === 503 ? 'disabled' : 'error',
            );
        }
    }, [token]);

    useEffect(() => {
        if (!token) {
            return;
        }

        void loadPasses();
    }, [token, loadPasses]);

    const handleBack = () => {
        router.replace('/(tabs)/profile');
    };

    const renderStateCard = (
        iconName: React.ComponentProps<typeof Ionicons>['name'],
        title: string,
        body: string,
        buttonLabel: string,
    ) => (
        <Card style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
                <Ionicons name={iconName} size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.stateTitle}>{title}</Text>
            <Text style={styles.stateBody}>{body}</Text>
            <Button
                label={buttonLabel}
                onPress={() => {
                    void loadPasses();
                }}
                variant="secondary"
                style={styles.stateButton}
            />
        </Card>
    );

    const renderLoading = () => (
        <>
            <Card style={styles.walletCard}>
                <Skeleton width="40%" height={16} style={{ marginBottom: SPACING.md }} />
                <Skeleton width="30%" height={54} style={{ marginBottom: SPACING.md }} />
                <Skeleton width="90%" height={14} style={{ marginBottom: SPACING.sm }} />
                <Skeleton width="75%" height={14} />
            </Card>

            <View style={styles.sectionHeader}>
                <Skeleton width="36%" height={24} style={{ marginBottom: SPACING.sm }} />
                <Skeleton width="54%" height={14} />
            </View>

            {[0, 1, 2].map((index) => (
                <Card key={index} style={styles.productCard}>
                    <Skeleton width="48%" height={20} style={{ marginBottom: SPACING.md }} />
                    <Skeleton width="40%" height={14} style={{ marginBottom: SPACING.lg }} />
                    <Skeleton width="100%" height={48} borderRadius={RADIUS.pill} />
                </Card>
            ))}
        </>
    );

    const renderWallet = () => (
        <Card style={styles.walletCard}>
            <LinearGradient
                colors={['rgba(255,107,157,0.18)', 'rgba(255,107,157,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.walletTopRow}>
                <View style={styles.walletCopy}>
                    <Text style={styles.walletLabel}>Paid pass credits</Text>
                    <Text style={styles.walletSubLabel}>Free daily passes are used first.</Text>
                </View>

                <View style={styles.walletChip}>
                    <Ionicons name="ticket" size={16} color={COLORS.primary} />
                    <Text style={styles.walletChipText}>Wallet</Text>
                </View>
            </View>

            <Text style={styles.walletBalance}>{paidCredits}</Text>

            <View style={styles.ruleList}>
                <View style={styles.ruleRow}>
                    <Ionicons name="ellipse" size={8} color={COLORS.primary} />
                    <Text style={styles.ruleText}>Free daily passes stay separate from paid credits.</Text>
                </View>
                <View style={styles.ruleRow}>
                    <Ionicons name="ellipse" size={8} color={COLORS.primary} />
                    <Text style={styles.ruleText}>Paid credits are spent only after your free daily passes run out.</Text>
                </View>
                <View style={styles.ruleRow}>
                    <Ionicons name="ellipse" size={8} color={COLORS.primary} />
                    <Text style={styles.ruleText}>Extensions are phase 2 and not active here yet.</Text>
                </View>
            </View>

            {walletMissing ? (
                <View style={styles.inlineNotice}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.secondaryText} />
                    <Text style={styles.inlineNoticeText}>Wallet data was missing, so the balance is shown as 0.</Text>
                </View>
            ) : null}

            {providerMode === 'stub' ? (
                <View style={styles.providerBadge}>
                    <Ionicons name="flask-outline" size={14} color={COLORS.secondaryText} />
                    <Text style={styles.providerBadgeText}>
                        Test mode
                        {platform ? ` / ${formatPlatformLabel(platform)}` : ''}
                    </Text>
                </View>
            ) : null}
        </Card>
    );

    const renderCatalog = () => {
        if (products.length === 0) {
            return (
                <Card style={styles.stateCard}>
                    <View style={styles.stateIconWrap}>
                        <Ionicons name="albums-outline" size={28} color={COLORS.primary} />
                    </View>
                    <Text style={styles.stateTitle}>No pass packs available</Text>
                    <Text style={styles.stateBody}>The paid catalog is empty right now. Your wallet balance is still shown above.</Text>
                </Card>
            );
        }

        return products.map((product) => (
            <Card key={product.product_id} style={styles.productCard}>
                <View style={styles.productHeader}>
                    <View style={styles.productCopy}>
                        <Text style={styles.productTitle}>{product.title}</Text>
                        <Text style={styles.productMeta}>{formatUnitsLabel(product.units_per_purchase)}</Text>
                    </View>
                    <View style={styles.productUnitsBadge}>
                        <Text style={styles.productUnitsText}>+{product.units_per_purchase}</Text>
                    </View>
                </View>

                <Text style={styles.productHint}>
                    Purchase flow coming soon. This button stays disabled until Google Play billing is wired in.
                </Text>

                <Button
                    label="Coming soon"
                    onPress={noop}
                    disabled
                    variant="secondary"
                    style={styles.productButton}
                />
            </Card>
        ));
    };

    if (!token) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
                    </TouchableOpacity>

                    <View style={styles.headerCopy}>
                        <Text style={styles.headerEyebrow}>Wallet</Text>
                        <Text style={styles.headerTitle}>Passes</Text>
                        <Text style={styles.headerSubtitle}>Manage paid pass credits without touching the free daily pass flow.</Text>
                    </View>
                </View>

                {screenState === 'loading' ? renderLoading() : null}
                {screenState === 'disabled'
                    ? renderStateCard(
                        'pause-circle-outline',
                        'Passes unavailable',
                        statusMessage || 'Passes are turned off right now. Free daily passes remain separate when this feature comes back.',
                        'Check again',
                    )
                    : null}
                {screenState === 'error'
                    ? renderStateCard(
                        'cloud-offline-outline',
                        'Could not load passes',
                        statusMessage || 'Unable to load passes right now.',
                        'Try again',
                    )
                    : null}

                {screenState === 'ready' ? (
                    <>
                        {renderWallet()}

                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Available pass packs</Text>
                            <Text style={styles.sectionSubtitle}>Each pack adds paid credits. Free daily passes still go first.</Text>
                        </View>

                        {renderCatalog()}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: SPACING.screen,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.display,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.xl,
        gap: SPACING.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.round,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCopy: {
        flex: 1,
        paddingTop: SPACING.xs,
    },
    headerEyebrow: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.xs,
    },
    headerTitle: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs,
    },
    headerSubtitle: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
    },
    walletCard: {
        marginBottom: SPACING.xl,
        overflow: 'hidden',
        borderColor: 'rgba(255,107,157,0.3)',
    },
    walletTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    walletCopy: {
        flex: 1,
    },
    walletLabel: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs,
    },
    walletSubLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
    },
    walletChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        backgroundColor: 'rgba(13,10,20,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,157,0.35)',
    },
    walletChipText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primaryText,
    },
    walletBalance: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        fontSize: 54,
        lineHeight: 60,
        marginBottom: SPACING.md,
    },
    ruleList: {
        gap: SPACING.sm,
    },
    ruleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
    },
    ruleText: {
        ...TYPOGRAPHY.caption,
        flex: 1,
        color: COLORS.secondaryText,
    },
    inlineNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(245,240,255,0.08)',
    },
    inlineNoticeText: {
        ...TYPOGRAPHY.caption,
        flex: 1,
        color: COLORS.secondaryText,
    },
    providerBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        backgroundColor: 'rgba(245,240,255,0.04)',
    },
    providerBadgeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
    },
    sectionHeader: {
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs,
    },
    sectionSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
    },
    productCard: {
        marginBottom: SPACING.md,
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    productCopy: {
        flex: 1,
    },
    productTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs,
    },
    productMeta: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
    },
    productUnitsBadge: {
        minWidth: 58,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,157,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,157,0.3)',
    },
    productUnitsText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        fontWeight: '700',
    },
    productHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
        marginBottom: SPACING.lg,
    },
    productButton: {
        width: '100%',
    },
    stateCard: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    stateIconWrap: {
        width: 56,
        height: 56,
        borderRadius: RADIUS.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,107,157,0.12)',
        marginBottom: SPACING.md,
    },
    stateTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    stateBody: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    stateButton: {
        minWidth: 160,
    },
});
