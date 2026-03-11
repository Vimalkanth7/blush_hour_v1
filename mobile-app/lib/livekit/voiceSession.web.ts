export interface VoiceSessionConnectParams {
    url: string;
    token: string;
    muted: boolean;
}

export interface VoiceSessionCallbacks {
    onConnected: () => void;
    onDisconnected: () => void;
    onError: (message: string) => void;
}

export interface VoiceSessionController {
    connect: (params: VoiceSessionConnectParams) => Promise<void>;
    setMuted: (muted: boolean) => Promise<void>;
    disconnect: () => Promise<void>;
    isConnected: () => boolean;
}

export const createVoiceSession = (_callbacks: VoiceSessionCallbacks): VoiceSessionController => {
    return {
        connect: async () => {
            throw new Error('Voice is not supported on web/dev.');
        },
        setMuted: async () => {
            return;
        },
        disconnect: async () => {
            return;
        },
        isConnected: () => false,
    };
};
