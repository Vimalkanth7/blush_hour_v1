import { registerGlobals } from '@livekit/react-native';

let hasRegistered = false;

export const ensureLiveKitGlobals = () => {
    if (hasRegistered) {
        return;
    }

    registerGlobals();
    hasRegistered = true;
};
