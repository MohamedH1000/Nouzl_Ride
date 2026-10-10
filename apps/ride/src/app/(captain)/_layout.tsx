import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, CAIRO_FONT_FAMILIES } from '@nouzl/theme';

/** Captain mode tabs. Navigator labels skip @nouzl/ui's Text, so the font is named here. */
export default function CaptainLayout() {
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
        name="drive"
        options={{
          title: t('ride.captain.driveTab'),
          tabBarIcon: ({ color: c, size }) => <Ionicons name="speedometer-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('ride.captain.earningsTitle'),
          tabBarIcon: ({ color: c, size }) => <Ionicons name="wallet-outline" size={size} color={c} />,
        }}
      />
    </Tabs>
  );
}
