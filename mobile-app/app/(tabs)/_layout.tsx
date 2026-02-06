import { COLORS, SPACING, SHADOWS } from '../../constants/Theme';
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.secondaryText,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          height: 90,
          paddingTop: SPACING.sm,
          ...SHADOWS.card, // Nice shadow for tab bar
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
          marginBottom: 5
        }
      }}
    >
      <Tabs.Screen
        name="discovery"
        options={{
          title: 'Discovery',
          tabBarIcon: ({ color }) => <Ionicons name="albums" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat-night"
        options={{
          title: 'Chat Night',
          tabBarIcon: ({ color }) => <Ionicons name="moon" size={28} color={color} />,
          tabBarLabel: 'Chat Night'
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}

