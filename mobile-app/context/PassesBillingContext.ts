import { createContext, useContext } from 'react';

import type { PassCatalogProduct, PassesMeResponse } from '../constants/Api';

export type BillingSupportState = 'unsupported' | 'initializing' | 'ready' | 'error';
export type BillingProductLoadState = 'idle' | 'loading' | 'ready' | 'error';
export type BillingPurchaseState =
    | 'idle'
    | 'launching'
    | 'pending'
    | 'validating'
    | 'success'
    | 'cancelled'
    | 'error';

export interface StorePassProduct {
    currency: string;
    description: string;
    displayPrice: string;
    price: number | null;
    productId: string;
    title: string;
}

export interface BillingPurchaseSnapshot {
    message: string | null;
    productId: string | null;
    state: BillingPurchaseState;
}

export interface BillingNotice {
    kind: 'error' | 'info' | 'success';
    message: string;
    orderId?: string | null;
    productId?: string;
}

export interface PassesBillingContextValue {
    activePurchase: BillingPurchaseSnapshot;
    clearNotice: () => void;
    isAndroidBilling: boolean;
    isConnected: boolean;
    isProductSyncing: boolean;
    isRecoveryInProgress: boolean;
    lastNotice: BillingNotice | null;
    lastWalletRefresh: PassesMeResponse | null;
    lastWalletRefreshAt: number;
    mappedProductIds: string[];
    missingProductIds: string[];
    productLoadMessage: string;
    productLoadState: BillingProductLoadState;
    recoverPurchases: () => Promise<void>;
    recoveryMessage: string;
    requestPassPurchase: (productId: string) => Promise<void>;
    storeProductsById: Record<string, StorePassProduct>;
    supportMessage: string;
    supportState: BillingSupportState;
    syncCatalog: (
        products: PassCatalogProduct[],
        providerMode: string | null,
        platform: string | null,
    ) => Promise<void>;
}

const DEFAULT_PURCHASE: BillingPurchaseSnapshot = {
    message: null,
    productId: null,
    state: 'idle',
};

const noopAsync = async () => { };

const defaultValue: PassesBillingContextValue = {
    activePurchase: DEFAULT_PURCHASE,
    clearNotice: () => { },
    isAndroidBilling: false,
    isConnected: false,
    isProductSyncing: false,
    isRecoveryInProgress: false,
    lastNotice: null,
    lastWalletRefresh: null,
    lastWalletRefreshAt: 0,
    mappedProductIds: [],
    missingProductIds: [],
    productLoadMessage: '',
    productLoadState: 'idle',
    recoverPurchases: noopAsync,
    recoveryMessage: '',
    requestPassPurchase: noopAsync,
    storeProductsById: {},
    supportMessage: 'Paid pass purchases are available only on Android.',
    supportState: 'unsupported',
    syncCatalog: noopAsync,
};

export const PassesBillingContext = createContext<PassesBillingContextValue>(defaultValue);

export const usePassesBilling = () => useContext(PassesBillingContext);
