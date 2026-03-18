import * as Crypto from 'expo-crypto';
import {
    ErrorCode,
    endConnection,
    fetchProducts,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    type Product,
    type Purchase,
} from 'expo-iap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
    getMyPasses,
    getPassesCatalog,
    isApiRequestError,
    type PassCatalogProduct,
    type PassesCatalogResponse,
    type PassesMeResponse,
    validateGooglePassPurchase,
} from '../constants/Api';
import { useAuth } from './AuthContext';
import {
    PassesBillingContext,
    type BillingNotice,
    type BillingPurchaseSnapshot,
    type BillingSupportState,
    type StorePassProduct,
} from './PassesBillingContext';

type PurchaseErrorLike = {
    code?: ErrorCode;
    message: string;
    productId?: string | null;
};

const DEFAULT_PURCHASE: BillingPurchaseSnapshot = {
    message: null,
    productId: null,
    state: 'idle',
};

const NATIVE_BUILD_REQUIRED_MESSAGE =
    'Google Play billing requires an Android development build or installed Android app. Expo Go is not supported.';

const sortActiveProducts = (products: PassCatalogProduct[]) => {
    return [...products]
        .filter((product) => product.active !== false)
        .sort((left, right) => left.sort_order - right.sort_order);
};

const getCatalogErrorMessage = (error: unknown, fallback: string) => {
    if (isApiRequestError(error)) {
        if (error.status === 0) {
            return 'Network error while reaching the backend.';
        }
        if (error.status === 503) {
            return 'Passes are currently unavailable.';
        }
        return error.detail || fallback;
    }

    return error instanceof Error && error.message ? error.message : fallback;
};

const getValidationErrorMessage = (error: unknown) => {
    if (isApiRequestError(error)) {
        if (error.status === 0) {
            return 'Network error while validating your purchase.';
        }
        if (error.status === 503) {
            return 'Purchase validation is temporarily unavailable.';
        }
        return error.detail || 'Unable to validate your purchase right now.';
    }

    return error instanceof Error && error.message
        ? error.message
        : 'Unable to validate your purchase right now.';
};

const isMappedProductReady = (product: Product) => {
    return !('productStatusAndroid' in product) || !product.productStatusAndroid || product.productStatusAndroid === 'ok';
};

const toStorePassProduct = (product: Product): StorePassProduct => ({
    currency: product.currency,
    description: product.description,
    displayPrice: product.displayPrice,
    price: typeof product.price === 'number' ? product.price : null,
    productId: product.id,
    title: product.title,
});

const toPurchaseError = (error: unknown): PurchaseErrorLike | null => {
    if (!error || typeof error !== 'object') {
        return null;
    }

    const candidate = error as Partial<PurchaseErrorLike>;
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
        return {
            code: candidate.code as ErrorCode,
            message: candidate.message,
            productId: candidate.productId ?? null,
        };
    }

    return null;
};

const getPurchaseErrorNotice = (error: PurchaseErrorLike) => {
    switch (error.code) {
        case ErrorCode.UserCancelled:
            return {
                kind: 'info' as const,
                message: 'Purchase cancelled.',
                purchaseState: 'cancelled' as const,
            };
        case ErrorCode.Pending:
            return {
                kind: 'info' as const,
                message: 'Purchase is still pending in Google Play.',
                purchaseState: 'pending' as const,
            };
        case ErrorCode.NetworkError:
            return {
                kind: 'error' as const,
                message: 'Network error while contacting Google Play.',
                purchaseState: 'error' as const,
            };
        case ErrorCode.ItemUnavailable:
        case ErrorCode.SkuNotFound:
            return {
                kind: 'error' as const,
                message: 'This pass pack is not available in Google Play right now.',
                purchaseState: 'error' as const,
            };
        case ErrorCode.BillingUnavailable:
        case ErrorCode.FeatureNotSupported:
        case ErrorCode.IapNotAvailable:
        case ErrorCode.InitConnection:
        case ErrorCode.ServiceDisconnected:
            return {
                kind: 'error' as const,
                message: NATIVE_BUILD_REQUIRED_MESSAGE,
                purchaseState: 'error' as const,
            };
        default:
            return {
                kind: 'error' as const,
                message: error.message || 'Google Play could not complete the purchase.',
                purchaseState: 'error' as const,
            };
    }
};

export function PassesBillingProvider({ children }: { children: React.ReactNode }) {
    const { signOut, token, user } = useAuth();

    const [supportState, setSupportState] = useState<BillingSupportState>('initializing');
    const [supportMessage, setSupportMessage] = useState('Connecting to Google Play billing.');
    const [isConnected, setIsConnected] = useState(false);
    const [productLoadState, setProductLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [productLoadMessage, setProductLoadMessage] = useState('');
    const [recoveryMessage, setRecoveryMessage] = useState('');
    const [isProductSyncing, setIsProductSyncing] = useState(false);
    const [isRecoveryInProgress, setIsRecoveryInProgress] = useState(false);
    const [storeProductsById, setStoreProductsById] = useState<Record<string, StorePassProduct>>({});
    const [mappedProductIds, setMappedProductIds] = useState<string[]>([]);
    const [missingProductIds, setMissingProductIds] = useState<string[]>([]);
    const [activePurchase, setActivePurchase] = useState<BillingPurchaseSnapshot>(DEFAULT_PURCHASE);
    const [lastNotice, setLastNotice] = useState<BillingNotice | null>(null);
    const [lastWalletRefresh, setLastWalletRefresh] = useState<PassesMeResponse | null>(null);
    const [lastWalletRefreshAt, setLastWalletRefreshAt] = useState(0);

    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const activePurchaseRef = useRef(activePurchase);
    const announcedSuccessTokensRef = useRef(new Set<string>());
    const catalogProductsRef = useRef<PassCatalogProduct[]>([]);
    const catalogRequestIdRef = useRef(0);
    const connectedRef = useRef(false);
    const lastRequestedProductIdRef = useRef<string | null>(null);
    const obfuscatedAccountHashRef = useRef<string | null>(null);
    const obfuscatedAccountUserIdRef = useRef<string | null>(null);
    const platformRef = useRef<string | null>(null);
    const providerModeRef = useRef<string | null>(null);
    const recoveryPromiseRef = useRef<Promise<void> | null>(null);
    const signOutRef = useRef(signOut);
    const tokenRef = useRef<string | null>(token);
    const userIdRef = useRef<string | null>(null);
    const validationInFlightRef = useRef(new Set<string>());

    useEffect(() => {
        activePurchaseRef.current = activePurchase;
    }, [activePurchase]);

    useEffect(() => {
        connectedRef.current = isConnected;
    }, [isConnected]);

    useEffect(() => {
        signOutRef.current = signOut;
    }, [signOut]);

    useEffect(() => {
        tokenRef.current = token;
        if (!token) {
            providerModeRef.current = null;
            platformRef.current = null;
            catalogProductsRef.current = [];
            lastRequestedProductIdRef.current = null;
            validationInFlightRef.current.clear();
            announcedSuccessTokensRef.current.clear();
            setProductLoadState('idle');
            setProductLoadMessage('');
            setRecoveryMessage('');
            setStoreProductsById({});
            setMappedProductIds([]);
            setMissingProductIds([]);
            setActivePurchase(DEFAULT_PURCHASE);
            setLastNotice(null);
            setLastWalletRefresh(null);
            setLastWalletRefreshAt(0);
        }
    }, [token]);

    useEffect(() => {
        const resolvedUserId =
            typeof user?.id === 'string'
                ? user.id
                : typeof user?._id === 'string'
                    ? user._id
                    : null;

        userIdRef.current = resolvedUserId;

        if (obfuscatedAccountUserIdRef.current !== resolvedUserId) {
            obfuscatedAccountUserIdRef.current = resolvedUserId;
            obfuscatedAccountHashRef.current = null;
        }
    }, [user]);

    const getObfuscatedAccountId = useCallback(async () => {
        if (!userIdRef.current) {
            return null;
        }

        if (
            obfuscatedAccountUserIdRef.current === userIdRef.current
            && obfuscatedAccountHashRef.current
        ) {
            return obfuscatedAccountHashRef.current;
        }

        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `blush-hour:${userIdRef.current}`,
        );

        obfuscatedAccountUserIdRef.current = userIdRef.current;
        obfuscatedAccountHashRef.current = hash;
        return hash;
    }, []);

    const applyWalletRefresh = useCallback((walletResponse: PassesMeResponse) => {
        setLastWalletRefresh(walletResponse);
        setLastWalletRefreshAt(Date.now());
    }, []);

    const syncCatalog = useCallback(
        async (
            products: PassCatalogProduct[],
            providerMode: string | null,
            platform: string | null,
        ) => {
            const activeProducts = sortActiveProducts(products);
            const activeProductIds = activeProducts.map((product) => product.product_id);

            catalogProductsRef.current = activeProducts;
            providerModeRef.current = providerMode;
            platformRef.current = platform;

            if (providerMode !== 'google') {
                setStoreProductsById({});
                setMappedProductIds([]);
                setMissingProductIds(activeProductIds);
                setProductLoadState('idle');
                setProductLoadMessage('Google Play billing is not enabled for this environment.');
                return;
            }

            if (platform !== 'android') {
                setStoreProductsById({});
                setMappedProductIds([]);
                setMissingProductIds(activeProductIds);
                setProductLoadState('idle');
                setProductLoadMessage('This paid pass catalog is not configured for Android.');
                return;
            }

            if (activeProductIds.length === 0) {
                setStoreProductsById({});
                setMappedProductIds([]);
                setMissingProductIds([]);
                setProductLoadState('ready');
                setProductLoadMessage('');
                return;
            }

            if (!connectedRef.current) {
                setProductLoadState('loading');
                setProductLoadMessage('Connecting to Google Play billing.');
                return;
            }

            const requestId = ++catalogRequestIdRef.current;
            setIsProductSyncing(true);
            setProductLoadState('loading');
            setProductLoadMessage('Loading prices from Google Play.');

            try {
                const storeProducts = await fetchProducts({
                    skus: activeProductIds,
                    type: 'in-app',
                });

                if (requestId !== catalogRequestIdRef.current) {
                    return;
                }

                const nextProductsById: Record<string, StorePassProduct> = {};

                for (const product of storeProducts ?? []) {
                    if (product.type !== 'in-app') {
                        continue;
                    }

                    if (!isMappedProductReady(product)) {
                        continue;
                    }

                    nextProductsById[product.id] = toStorePassProduct(product);
                }

                const nextMappedIds = activeProductIds.filter((productId) => Boolean(nextProductsById[productId]));
                const nextMissingIds = activeProductIds.filter((productId) => !nextProductsById[productId]);

                setStoreProductsById(nextProductsById);
                setMappedProductIds(nextMappedIds);
                setMissingProductIds(nextMissingIds);
                setProductLoadState('ready');
                setProductLoadMessage(
                    nextMissingIds.length > 0
                        ? 'Some pass packs are not currently available in Google Play.'
                        : '',
                );
            } catch (error) {
                if (requestId !== catalogRequestIdRef.current) {
                    return;
                }

                setStoreProductsById({});
                setMappedProductIds([]);
                setMissingProductIds(activeProductIds);
                setProductLoadState('error');
                setProductLoadMessage(
                    getCatalogErrorMessage(error, 'Could not load Google Play product details.'),
                );
            } finally {
                if (requestId === catalogRequestIdRef.current) {
                    setIsProductSyncing(false);
                }
            }
        },
        [],
    );

    const refreshCatalogFromBackend = useCallback(async (): Promise<PassesCatalogResponse | null> => {
        if (!tokenRef.current) {
            return null;
        }

        try {
            const catalogResponse = await getPassesCatalog(tokenRef.current);
            await syncCatalog(
                catalogResponse.products ?? [],
                catalogResponse.provider_mode ?? null,
                catalogResponse.platform ?? null,
            );
            return catalogResponse;
        } catch (error) {
            if (isApiRequestError(error) && error.status === 401) {
                await signOutRef.current();
                return null;
            }

            setProductLoadState(error && isApiRequestError(error) && error.status === 503 ? 'idle' : 'error');
            setProductLoadMessage(
                getCatalogErrorMessage(error, 'Could not load the paid passes catalog.'),
            );
            return null;
        }
    }, [syncCatalog]);

    const validatePurchase = useCallback(
        async (purchase: Purchase, source: 'listener' | 'recovery') => {
            if (!tokenRef.current) {
                return;
            }

            const isKnownProduct = catalogProductsRef.current.some(
                (product) => product.product_id === purchase.productId,
            );

            if (!isKnownProduct) {
                return;
            }

            const purchaseToken = purchase.purchaseToken?.trim();
            const shouldTrackPurchase = (
                activePurchaseRef.current.productId === purchase.productId
                || lastRequestedProductIdRef.current === purchase.productId
            );

            if (!purchaseToken) {
                const message = 'Google Play did not return a purchase token for this pass pack.';

                if (shouldTrackPurchase) {
                    setActivePurchase({
                        message,
                        productId: purchase.productId,
                        state: 'error',
                    });
                }

                setLastNotice({
                    kind: 'error',
                    message,
                    productId: purchase.productId,
                });
                return;
            }

            if (validationInFlightRef.current.has(purchaseToken)) {
                return;
            }

            validationInFlightRef.current.add(purchaseToken);

            if (shouldTrackPurchase) {
                setActivePurchase({
                    message: 'Validating your purchase with Blush Hour.',
                    productId: purchase.productId,
                    state: 'validating',
                });
            }

            try {
                const validationResponse = await validateGooglePassPurchase({
                    orderId: purchase.transactionId ?? undefined,
                    productId: purchase.productId,
                    purchaseToken,
                    token: tokenRef.current,
                });

                let walletRefreshSucceeded = false;

                try {
                    const walletResponse = await getMyPasses(tokenRef.current);
                    applyWalletRefresh(walletResponse);
                    walletRefreshSucceeded = true;
                } catch (walletError) {
                    if (isApiRequestError(walletError) && walletError.status === 401) {
                        await signOutRef.current();
                        return;
                    }
                }

                const successMessage = walletRefreshSucceeded
                    ? validationResponse.already_granted
                        ? 'Purchase already applied. Wallet refreshed.'
                        : 'Purchase validated. Wallet refreshed.'
                    : validationResponse.already_granted
                        ? 'Purchase was already applied. Refresh the wallet to confirm the latest balance.'
                        : 'Purchase validated. Refresh the wallet to confirm the latest balance.';

                if (shouldTrackPurchase) {
                    setActivePurchase({
                        message: successMessage,
                        productId: purchase.productId,
                        state: 'success',
                    });
                }

                if (
                    (source === 'listener' || shouldTrackPurchase)
                    && !announcedSuccessTokensRef.current.has(purchaseToken)
                ) {
                    setLastNotice({
                        kind: walletRefreshSucceeded ? 'success' : 'info',
                        message: successMessage,
                        orderId: validationResponse.purchase.order_id,
                        productId: purchase.productId,
                    });
                    announcedSuccessTokensRef.current.add(purchaseToken);
                }

                lastRequestedProductIdRef.current = null;
            } catch (error) {
                if (isApiRequestError(error) && error.status === 401) {
                    await signOutRef.current();
                    return;
                }

                const message = getValidationErrorMessage(error);

                if (shouldTrackPurchase) {
                    setActivePurchase({
                        message,
                        productId: purchase.productId,
                        state: 'error',
                    });
                }

                setLastNotice({
                    kind: 'error',
                    message,
                    productId: purchase.productId,
                });
            } finally {
                validationInFlightRef.current.delete(purchaseToken);
            }
        },
        [applyWalletRefresh],
    );

    const recoverPurchases = useCallback(async () => {
        if (!tokenRef.current || !connectedRef.current) {
            return;
        }

        if (providerModeRef.current !== 'google' || platformRef.current !== 'android') {
            return;
        }

        if (recoveryPromiseRef.current) {
            return recoveryPromiseRef.current;
        }

        const recoveryPromise = (async () => {
            const relevantProductIds = new Set(
                catalogProductsRef.current.map((product) => product.product_id),
            );

            setIsRecoveryInProgress(true);
            setRecoveryMessage('');

            try {
                const purchases = await getAvailablePurchases();
                let foundPendingPurchase = false;

                for (const purchase of purchases) {
                    if (!relevantProductIds.has(purchase.productId)) {
                        continue;
                    }

                    if (purchase.purchaseState === 'pending') {
                        foundPendingPurchase = true;

                        if (
                            activePurchaseRef.current.productId === purchase.productId
                            || lastRequestedProductIdRef.current === purchase.productId
                        ) {
                            setActivePurchase({
                                message: 'Purchase is still pending in Google Play.',
                                productId: purchase.productId,
                                state: 'pending',
                            });
                        }

                        continue;
                    }

                    if (purchase.purchaseState !== 'purchased') {
                        continue;
                    }

                    await validatePurchase(purchase, 'recovery');
                }

                if (foundPendingPurchase) {
                    setRecoveryMessage(
                        'A Google Play purchase is still pending. Finish or cancel it in Google Play, then reopen the app.',
                    );
                } else {
                    setRecoveryMessage('');
                }
            } catch (error) {
                setRecoveryMessage(
                    getCatalogErrorMessage(error, 'Could not recover existing Google Play purchases.'),
                );
            } finally {
                setIsRecoveryInProgress(false);
                recoveryPromiseRef.current = null;
            }
        })();

        recoveryPromiseRef.current = recoveryPromise;
        return recoveryPromise;
    }, [validatePurchase]);

    const bootstrapBilling = useCallback(async () => {
        if (!tokenRef.current || !connectedRef.current) {
            return;
        }

        const catalogResponse = await refreshCatalogFromBackend();
        if (catalogResponse?.provider_mode === 'google' && catalogResponse.platform === 'android') {
            await recoverPurchases();
        }
    }, [recoverPurchases, refreshCatalogFromBackend]);

    const handlePurchaseError = useCallback((error: PurchaseErrorLike) => {
        if (!connectedRef.current && error.code === ErrorCode.InitConnection) {
            return;
        }

        const notice = getPurchaseErrorNotice(error);
        const productId = error.productId ?? lastRequestedProductIdRef.current ?? activePurchaseRef.current.productId;

        setActivePurchase({
            message: notice.message,
            productId: productId ?? null,
            state: notice.purchaseState,
        });

        setLastNotice({
            kind: notice.kind,
            message: notice.message,
            productId: productId ?? undefined,
        });

        if (notice.purchaseState !== 'pending') {
            lastRequestedProductIdRef.current = null;
        }
    }, []);

    const handlePurchaseUpdated = useCallback(
        async (purchase: Purchase) => {
            if (!purchase.productId) {
                return;
            }

            if (purchase.purchaseState === 'pending') {
                lastRequestedProductIdRef.current = purchase.productId;
                setActivePurchase({
                    message: 'Purchase is pending in Google Play.',
                    productId: purchase.productId,
                    state: 'pending',
                });
                setLastNotice({
                    kind: 'info',
                    message: 'Purchase is pending in Google Play. Validation will resume after Google confirms it.',
                    productId: purchase.productId,
                });
                return;
            }

            if (purchase.purchaseState !== 'purchased') {
                return;
            }

            await validatePurchase(purchase, 'listener');
        },
        [validatePurchase],
    );

    const requestPassPurchase = useCallback(
        async (productId: string) => {
            if (!tokenRef.current) {
                setLastNotice({
                    kind: 'error',
                    message: 'Sign in again to purchase pass packs.',
                    productId,
                });
                return;
            }

            if (providerModeRef.current !== 'google' || platformRef.current !== 'android') {
                setActivePurchase({
                    message: 'Google Play billing is not enabled for this environment.',
                    productId,
                    state: 'error',
                });
                setLastNotice({
                    kind: 'error',
                    message: 'Google Play billing is not enabled for this environment.',
                    productId,
                });
                return;
            }

            if (!connectedRef.current) {
                setActivePurchase({
                    message: NATIVE_BUILD_REQUIRED_MESSAGE,
                    productId,
                    state: 'error',
                });
                setLastNotice({
                    kind: 'error',
                    message: NATIVE_BUILD_REQUIRED_MESSAGE,
                    productId,
                });
                return;
            }

            if (!storeProductsById[productId]) {
                setActivePurchase({
                    message: 'This pass pack is not available in Google Play right now.',
                    productId,
                    state: 'error',
                });
                setLastNotice({
                    kind: 'error',
                    message: 'This pass pack is not available in Google Play right now.',
                    productId,
                });
                return;
            }

            if (
                activePurchaseRef.current.state === 'launching'
                || activePurchaseRef.current.state === 'validating'
            ) {
                setLastNotice({
                    kind: 'info',
                    message: 'A purchase is already in progress.',
                    productId: activePurchaseRef.current.productId ?? productId,
                });
                return;
            }

            setLastNotice(null);
            setRecoveryMessage('');
            setActivePurchase({
                message: 'Opening Google Play.',
                productId,
                state: 'launching',
            });
            lastRequestedProductIdRef.current = productId;

            try {
                const obfuscatedAccountId = await getObfuscatedAccountId();
                const googleRequest: {
                    obfuscatedAccountId?: string;
                    skus: string[];
                } = {
                    skus: [productId],
                };

                if (obfuscatedAccountId) {
                    googleRequest.obfuscatedAccountId = obfuscatedAccountId;
                }

                await requestPurchase({
                    request: {
                        google: googleRequest,
                    },
                    type: 'in-app',
                });
            } catch (error) {
                const purchaseError = toPurchaseError(error);
                if (purchaseError) {
                    handlePurchaseError(purchaseError);
                    return;
                }

                const message = error instanceof Error && error.message
                    ? error.message
                    : 'Google Play could not start the purchase flow.';

                setActivePurchase({
                    message,
                    productId,
                    state: 'error',
                });
                setLastNotice({
                    kind: 'error',
                    message,
                    productId,
                });
                lastRequestedProductIdRef.current = null;
            }
        },
        [getObfuscatedAccountId, handlePurchaseError, storeProductsById],
    );

    useEffect(() => {
        let isMounted = true;

        const purchaseUpdateSubscription = purchaseUpdatedListener((purchase) => {
            void handlePurchaseUpdated(purchase);
        });
        const purchaseErrorSubscription = purchaseErrorListener((error) => {
            handlePurchaseError(error);
        });

        const connect = async () => {
            setSupportState('initializing');
            setSupportMessage('Connecting to Google Play billing.');

            try {
                const connected = await initConnection();
                if (!isMounted) {
                    return;
                }

                if (!connected) {
                    setIsConnected(false);
                    setSupportState('error');
                    setSupportMessage(NATIVE_BUILD_REQUIRED_MESSAGE);
                    return;
                }

                setIsConnected(true);
                setSupportState('ready');
                setSupportMessage('');
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setIsConnected(false);
                setSupportState('error');
                setSupportMessage(
                    error instanceof Error && error.message
                        ? error.message
                        : NATIVE_BUILD_REQUIRED_MESSAGE,
                );
            }
        };

        void connect();

        return () => {
            isMounted = false;
            purchaseUpdateSubscription.remove();
            purchaseErrorSubscription.remove();
            void endConnection();
            setIsConnected(false);
        };
    }, [handlePurchaseError, handlePurchaseUpdated]);

    useEffect(() => {
        if (token && isConnected) {
            void bootstrapBilling();
        }
    }, [bootstrapBilling, isConnected, token]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;

            if (
                (previousState === 'background' || previousState === 'inactive')
                && nextState === 'active'
                && tokenRef.current
                && connectedRef.current
            ) {
                void bootstrapBilling();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [bootstrapBilling]);

    const value = useMemo(
        () => ({
            activePurchase,
            clearNotice: () => setLastNotice(null),
            isAndroidBilling: true,
            isConnected,
            isProductSyncing,
            isRecoveryInProgress,
            lastNotice,
            lastWalletRefresh,
            lastWalletRefreshAt,
            mappedProductIds,
            missingProductIds,
            productLoadMessage,
            productLoadState,
            recoverPurchases,
            recoveryMessage,
            requestPassPurchase,
            storeProductsById,
            supportMessage,
            supportState,
            syncCatalog,
        }),
        [
            activePurchase,
            isConnected,
            isProductSyncing,
            isRecoveryInProgress,
            lastNotice,
            lastWalletRefresh,
            lastWalletRefreshAt,
            mappedProductIds,
            missingProductIds,
            productLoadMessage,
            productLoadState,
            recoverPurchases,
            recoveryMessage,
            requestPassPurchase,
            storeProductsById,
            supportMessage,
            supportState,
            syncCatalog,
        ],
    );

    return (
        <PassesBillingContext.Provider value={value}>
            {children}
        </PassesBillingContext.Provider>
    );
}
