import { Stack } from 'expo-router';
import { RegistrationProvider } from '../context/RegistrationContext';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RegistrationProvider>
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="admin" />
            <Stack.Screen
              name="modal/filter"
              options={{
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom'
              }}
            />
            {/* 
              FIX: 'presentation: modal' in Expo Router / React Navigation often requires
              unique handling on Android or specific versions.
              Ensuring the file exists at correct path: app/modal/edit-profile.tsx
            */}
            <Stack.Screen
              name="modal/edit-profile"
              options={{
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen
              name="modal/preview-profile"
              options={{
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom'
              }}
            />
          </Stack>
          <StatusBar style="dark" />
        </RegistrationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
