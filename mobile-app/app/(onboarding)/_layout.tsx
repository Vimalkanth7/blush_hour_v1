import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="name" />
            <Stack.Screen name="birthday" />
            <Stack.Screen name="gender" />
            <Stack.Screen name="mode" />
            <Stack.Screen name="intentions" />
            <Stack.Screen name="details" />
            <Stack.Screen name="interests" />
            <Stack.Screen name="values" />
            <Stack.Screen name="prompts" />
            <Stack.Screen name="photos" />
        </Stack>
    );
}
