import { COLORS, SPACING, SHADOWS } from '../../constants/Theme';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const router = useRouter();
  const renderTabIcon =
    (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View style={styles.iconContainer}>
        <View style={[styles.activeIndicator, !focused && styles.activeIndicatorHidden]} />
        <Ionicons name={name} size={28} color={color} />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.disabledText,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
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
          tabBarIcon: renderTabIcon('albums'),
        }}
      />
      <Tabs.Screen
        name="chat-night"
        options={{
          title: 'Chat Night',
          tabBarIcon: renderTabIcon('moon'),
          tabBarLabel: 'Chat Night'
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: renderTabIcon('chatbubbles'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: renderTabIcon('person'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 18,
    height: 6,
    borderRadius: 999,
    marginBottom: 6,
    backgroundColor: COLORS.primary,
    opacity: 0.15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 2,
  },
  activeIndicatorHidden: {
    opacity: 0,
  },
});
