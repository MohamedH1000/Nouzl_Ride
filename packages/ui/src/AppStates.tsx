import React from 'react';
import { Image, ScrollView, Text as RNText, View, type ImageSourcePropType } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { color, CAIRO_FONT_FAMILIES } from '@nouzl/theme';
import { BrandMark, brandDiscColor, type BrandTone } from './Brand';
import { Button } from './Button';

/**
 * Full-screen states the router shows when a screen cannot: a crash
 * (expo-router's `ErrorBoundary` export) and an unknown link (`+not-found`).
 *
 * Before these existed a render error left a blank white screen with no way
 * out, and a stale deep link showed the router's own unstyled page.
 *
 * Deliberately built from raw RN Text with explicit Cairo families and an
 * explicit direction: an error boundary can render when providers above it
 * are the thing that broke, so it must not depend on them to look right.
 */
function StateScreen({
  tone,
  badge,
  badgeTint,
  title,
  body,
  primary,
  secondary,
  detail,
  image,
}: {
  tone: BrandTone;
  badge: React.ComponentProps<typeof Ionicons>['name'];
  badgeTint: string;
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  detail?: string;
  /** Illustration (bundled by the app) shown instead of the brand mark + badge. */
  image?: ImageSourcePropType;
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.neutral.page, direction: isRtl ? 'rtl' : 'ltr' }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}
    >
      {image ? (
        <Image source={image} resizeMode="contain" style={{ width: 200, height: 200, marginBottom: 16 }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ marginBottom: 28 }}>
          <BrandMark size={84} tone={tone} />
          <View
            style={{
              position: 'absolute',
              bottom: -6,
              end: -6,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: color.neutral.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <Ionicons name={badge} size={19} color={badgeTint} />
          </View>
        </View>
      )}
      <RNText
        style={{ fontFamily: CAIRO_FONT_FAMILIES.extraBold, fontSize: 20, lineHeight: 28, color: color.neutral.text, textAlign: 'center' }}
      >
        {title}
      </RNText>
      <RNText
        style={{
          fontFamily: CAIRO_FONT_FAMILIES.regular,
          fontSize: 14,
          lineHeight: 22,
          color: color.neutral.textSecondary,
          textAlign: 'center',
          marginTop: 8,
          maxWidth: 320,
        }}
      >
        {body}
      </RNText>
      <View style={{ marginTop: 28, gap: 10, alignSelf: 'center', width: '100%', maxWidth: 320 }}>
        <Button label={primary.label} onPress={primary.onPress} />
        {secondary ? <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} /> : null}
      </View>
      {detail ? (
        <RNText
          selectable
          style={{ fontFamily: CAIRO_FONT_FAMILIES.regular, fontSize: 11, color: color.neutral.textMuted, marginTop: 24, textAlign: 'center' }}
        >
          {detail}
        </RNText>
      ) : null}
    </ScrollView>
  );
}

export interface AppErrorScreenProps {
  error: Error;
  retry: () => Promise<void> | void;
  onHome?: () => void;
  tone?: BrandTone;
  /** Illustration from the app's assets, shown instead of the brand mark. */
  image?: ImageSourcePropType;
}

/** Use as `export function ErrorBoundary(props) { return <AppErrorScreen {...props} /> }`. */
export function AppErrorScreen({ error, retry, onHome, tone = 'customer', image }: AppErrorScreenProps) {
  const { t } = useTranslation();
  return (
    <StateScreen
      tone={tone}
      badge="alert"
      badgeTint={color.status.danger}
      title={t('appState.errorTitle', { defaultValue: 'Something went wrong' })}
      body={t('appState.errorBody', {
        defaultValue: "This screen hit a problem. Your bookings and data are safe — try again, or go back to the start.",
      })}
      primary={{ label: t('common.retry', { defaultValue: 'Try again' }), onPress: () => void retry() }}
      secondary={onHome ? { label: t('appState.goHome', { defaultValue: 'Go to home' }), onPress: onHome } : undefined}
      // Only in development: a guest never needs a stack message, a developer always does.
      detail={__DEV__ ? error?.message : undefined}
      image={image}
    />
  );
}

export function NotFoundScreen({ onHome, tone = 'customer' }: { onHome: () => void; tone?: BrandTone }) {
  const { t } = useTranslation();
  return (
    <StateScreen
      tone={tone}
      badge="help"
      badgeTint={brandDiscColor(tone)}
      title={t('appState.notFoundTitle', { defaultValue: "This page isn't here" })}
      body={t('appState.notFoundBody', {
        defaultValue: 'The link may be old or the page may have moved.',
      })}
      primary={{ label: t('appState.goHome', { defaultValue: 'Go to home' }), onPress: onHome }}
    />
  );
}
