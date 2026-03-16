import React, { useMemo } from 'react';

import { PassesBillingContext } from './PassesBillingContext';

export function PassesBillingProvider({ children }: { children: React.ReactNode }) {
    const value = useMemo(
        () => ({
            activePurchase: {
                message: null,
                productId: null,
                state: 'idle' as const,
            },
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
            productLoadMessage:
                'Paid pass purchases are available only in the Android app and require a native development build.',
            productLoadState: 'idle' as const,
            recoverPurchases: async () => { },
            recoveryMessage: '',
            requestPassPurchase: async () => { },
            storeProductsById: {},
            supportMessage:
                'Paid pass purchases are available only in the Android app and require a native development build.',
            supportState: 'unsupported' as const,
            syncCatalog: async () => { },
        }),
        [],
    );

    return (
        <PassesBillingContext.Provider value={value}>
            {children}
        </PassesBillingContext.Provider>
    );
}
