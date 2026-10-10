import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, CAIRO_FONT_FAMILIES } from '@nouzl/theme';

/** Rider mode tabs. Navigator labels skip @nouzl/ui's Text, so the font is named here. */
export default function RiderLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand.DEFAULT,
        tabBarInactiveTintColor: color.neutral.textMuted,
        tabBarLabelStyle: { fontFamily: CAIRO_FONT_FAMILIES.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: color.neutral.card, borderTopColor: color.neutral.border },
      }}
    >
      <Tabs.Screen
        name="ride"
        options={{
          title: t('ride.rider.rideTab'),
          tabBarIcon: ({ color: c, size }) => <Ionicons name="car-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('ride.rider.tripsTitle'),
          tabBarIcon: ({ color: c, size }) => <Ionicons name="time-outline" size={size} color={c} />,
        }}
      />
    </Tabs>
  );
}
