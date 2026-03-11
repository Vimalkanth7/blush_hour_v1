import { AudioSession } from '@livekit/react-native';
import { ConnectionState, Room, RoomEvent } from 'livekit-client';

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

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Voice connection failed.';
};

export const createVoiceSession = (callbacks: VoiceSessionCallbacks): VoiceSessionController => {
    let room: Room | null = null;
    let audioSessionStarted = false;

    const disconnect = async () => {
        const activeRoom = room;
        room = null;

        if (activeRoom) {
            activeRoom.removeAllListeners();
            try {
                await activeRoom.disconnect();
            } catch {
                // Ignore disconnect failures during cleanup.
            }
        }

        if (audioSessionStarted) {
            audioSessionStarted = false;
            try {
                await AudioSession.stopAudioSession();
            } catch {
                // Ignore audio teardown failures during cleanup.
            }
        }
    };

    const connect = async ({ url, token, muted }: VoiceSessionConnectParams) => {
        await disconnect();
        await AudioSession.startAudioSession();
        audioSessionStarted = true;

        const nextRoom = new Room();
        nextRoom.on(RoomEvent.Connected, callbacks.onConnected);
        nextRoom.on(RoomEvent.Disconnected, callbacks.onDisconnected);
        nextRoom.on(RoomEvent.MediaDevicesError, (error) => {
            callbacks.onError(error.message || 'Microphone access failed.');
        });

        room = nextRoom;

        try {
            await nextRoom.connect(url, token);
            await nextRoom.localParticipant.setMicrophoneEnabled(!muted);
        } catch (error) {
            callbacks.onError(getErrorMessage(error));
            await disconnect();
            throw error;
        }
    };

    const setMuted = async (muted: boolean) => {
        if (!room || room.state !== ConnectionState.Connected) {
            return;
        }

        await room.localParticipant.setMicrophoneEnabled(!muted);
    };

    const isConnected = () => {
        return room?.state === ConnectionState.Connected;
    };

    return {
        connect,
        setMuted,
        disconnect,
        isConnected,
    };
};
