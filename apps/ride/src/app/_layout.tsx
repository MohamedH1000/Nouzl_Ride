import '../global.css';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider, type Theme as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import { DirectionProvider } from '@nouzl/ui';
import i18n, { syncNativeDirectionAtBoot } from '@nouzl/i18n';
import { color, CAIRO_FONT_FAMILIES } from '@nouzl/theme';
import { initRideI18n } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Fixed light theme, same as nouzl_mobile (no dark mode in Nouzl apps). */
const navigationTheme: NavigationTheme = {
  dark: false,
  colors: {
    primary: color.brand.DEFAULT,
    background: color.neutral.page,
    card: color.neutral.card,
    text: color.neutral.text,
    border: color.neutral.border,
    notification: color.status.danger,
  },
  fonts: {
    regular: { fontFamily: CAIRO_FONT_FAMILIES.regular, fontWeight: '400' },
    medium: { fontFamily: CAIRO_FONT_FAMILIES.medium, fontWeight: '500' },
    bold: { fontFamily: CAIRO_FONT_FAMILIES.bold, fontWeight: '700' },
    heavy: { fontFamily: CAIRO_FONT_FAMILIES.extraBold, fontWeight: '800' },
  },
};

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_500Medium, Cairo_700Bold, Cairo_800ExtraBold });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Direction must be settled before the first paint: forceRTL only takes
      // effect on the next bundle load (see @nouzl/i18n rtl.ts).
      const language = await syncNativeDirectionAtBoot();
      initRideI18n(language);
      if (!cancelled) setI18nReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = i18nReady && fontsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <DirectionProvider>
          <ThemeProvider value={navigationTheme}>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </DirectionProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
