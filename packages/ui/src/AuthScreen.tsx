import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, View, type ImageSourcePropType } from 'react-native';
import { Text } from './Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { AnimatedView } from './interop';
import { color, radius, shadow } from '@nouzl/theme';

export interface AuthScreenProps {
  /** Each app passes its own <Logo /> — the asset is bundled per-app via a
   *  static require(), so it can't live in this shared package. */
  logo: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered under the card, outside its padding — sign-up prompts,
   *  "back to sign in" links and the like. */
  footer?: ReactNode;
  /** Illustration (transparent PNG) under the logo, over the gradient. */
  hero?: ImageSourcePropType;
}

/**
 * The shared visual shell behind every auth screen in both apps: a brand
 * gradient hero holding the logo, with the form on a white card that
 * overlaps it.
 *
 * Before this, each auth screen was a bare centred `ScrollView` on the flat
 * page background — functional, but visually the weakest surface in either
 * app, and the FIRST thing a partner or guest ever sees. Consolidating it
 * here also means the customer and business apps stop drifting apart: they
 * previously shared no auth layout code at all, which is how the business
 * sign-in ended up using raw `TextInput`s while the customer app used the
 * shared `Input`.
 *
 * The gradient is painted behind the status bar (`edges` omits 'top') so
 * the hero runs to the physical top of the screen rather than starting
 * below a white strip.
 */
export function AuthScreen({ logo, title, subtitle, children, footer, hero }: AuthScreenProps) {
  return (
    <View className="flex-1 bg-page">
      <LinearGradient
        // Deep → brand → light: enough range to read as a real gradient at
        // phone width, where a two-stop ramp looks almost flat.
        colors={[color.brand.deep, color.brand.DEFAULT, color.brand.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        // Taller with a hero image, so the form card still overlaps the gradient.
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: hero ? 400 : 300 }}
      />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView
            contentContainerClassName="grow justify-center px-5 py-10"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* style, not className: the classes on this Animated.View were not applied on web, so the logo stretched to the full width instead of centring. */}
            <AnimatedView entering={FadeIn.duration(500)} style={{ marginBottom: 24, alignItems: 'center', gap: 12 }}>
              {logo}
              {hero ? (
                <Image source={hero} resizeMode="contain" style={{ width: 176, height: 176, marginBottom: -8 }} accessibilityIgnoresInvertColors />
              ) : null}
            </AnimatedView>

            <AnimatedView
              entering={FadeInDown.duration(420).springify().damping(18)}
              className="gap-4 bg-card p-6"
              style={[{ borderRadius: radius.cardLg }, shadow(4)]}
            >
              <View className="gap-1">
                <Text className="text-xl font-extrabold text-text">{title}</Text>
                {subtitle ? <Text className="text-sm text-text-secondary">{subtitle}</Text> : null}
              </View>
              {children}
            </AnimatedView>

            {footer ? (
              <AnimatedView entering={FadeInDown.delay(120).duration(420)} className="mt-5 items-center">
                {footer}
              </AnimatedView>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** "──── or ────" separator above the social buttons. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-divider" />
      <Text className="text-xs font-semibold uppercase text-text-muted">{label}</Text>
      <View className="h-px flex-1 bg-divider" />
    </View>
  );
}
