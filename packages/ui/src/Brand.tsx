import React, { useEffect } from 'react';
import { Text as RNText, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, CAIRO_FONT_FAMILIES } from '@nouzl/theme';

/**
 * The Nouzl mark, drawn from its GEOMETRY with plain Views — crisp at any
 * size, no bundled image, identical in both apps.
 *
 * Same numbers as scripts/generate-brand-assets.js (which renders the
 * launcher icons and the native splash image), so the JS splash lines up
 * pixel-for-pixel with the native one it replaces. Change both together.
 */
const MARK = {
  width: 554,
  top: 15,
  height: 738, // 753 - 15
  bar: 120,
  dot: 140,
  shapes: [
    { kind: 'bar', x: 0, y: 56 },
    { kind: 'dot', cx: 272, cy: 274 },
    { kind: 'bar', x: 212, y: 394 },
    { kind: 'dot', cx: 484, cy: 85 },
    { kind: 'bar', x: 424, y: 205 },
  ] as const,
  baseline: 753,
};

export type BrandTone = 'customer' | 'business';

/** The disc colour per app — business is the deeper plum its launcher icon uses. */
export function brandDiscColor(tone: BrandTone = 'customer') {
  return tone === 'business' ? color.brand.deep : color.brand.DEFAULT;
}

function Glyph({ height, fill }: { height: number; fill: string }) {
  const s = height / MARK.height;
  return (
    // The mark is a picture, not text: it must never mirror in RTL.
    <View style={{ width: MARK.width * s, height, direction: 'ltr' }}>
      {MARK.shapes.map((shape, i) =>
        shape.kind === 'bar' ? (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: shape.x * s,
              top: (shape.y - MARK.top) * s,
              width: MARK.bar * s,
              height: (MARK.baseline - shape.y) * s,
              borderRadius: (MARK.bar * s) / 2,
              backgroundColor: fill,
            }}
          />
        ) : (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (shape.cx - MARK.dot / 2) * s,
              top: (shape.cy - MARK.dot / 2 - MARK.top) * s,
              width: MARK.dot * s,
              height: MARK.dot * s,
              borderRadius: (MARK.dot * s) / 2,
              backgroundColor: fill,
            }}
          />
        ),
      )}
    </View>
  );
}

export interface BrandMarkProps {
  size: number;
  /** 'disc' = the round app mark; 'plain' = the glyph alone (for tinted surfaces). */
  variant?: 'disc' | 'plain';
  tone?: BrandTone;
  /** Glyph colour for the 'plain' variant. */
  fill?: string;
  /** For a brand-coloured background: a white disc with the mark in brand colour. */
  inverse?: boolean;
  style?: ViewStyle;
}

export function BrandMark({ size, variant = 'disc', tone = 'customer', fill, inverse = false, style }: BrandMarkProps) {
  if (variant === 'plain') {
    return (
      <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Glyph height={size} fill={fill ?? brandDiscColor(tone)} />
      </View>
    );
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Nouzl"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: inverse ? color.neutral.onBrand : brandDiscColor(tone),
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* 0.62 of the disc — the same ratio as the native splash image. */}
      <Glyph height={size * 0.62} fill={inverse ? brandDiscColor(tone) : color.neutral.onBrand} />
    </View>
  );
}

export interface BrandLogoProps {
  /** Height of the round mark; the wordmark scales with it. */
  height?: number;
  tone?: BrandTone;
  /** Shows the tagline under the name ("فنادق وأكثر" / "للأعمال"). */
  showTagline?: boolean;
  /** White lockup for brand-coloured backgrounds (the auth screens' gradient). */
  inverse?: boolean;
}

/**
 * The lockup: round mark + the Arabic wordmark, as on the website's logo.
 * Always laid out mark-on-the-right (it is Arabic brand artwork), whatever
 * the app language.
 */
export function BrandLogo({ height = 32, tone = 'customer', showTagline = true, inverse = false }: BrandLogoProps) {
  const tagline = tone === 'business' ? 'للأعمال' : 'فنادق وأكثر';
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={tone === 'business' ? 'Nouzl Business' : 'Nouzl'}
      style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: height * 0.28 }}
    >
      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <RNText
          allowFontScaling={false}
          style={{
            fontFamily: CAIRO_FONT_FAMILIES.extraBold,
            fontSize: height * (showTagline ? 0.62 : 0.72),
            lineHeight: height * (showTagline ? 0.8 : 0.95),
            color: inverse ? color.neutral.onBrand : brandDiscColor(tone),
            writingDirection: 'rtl',
          }}
        >
          نُزل
        </RNText>
        {showTagline ? (
          <RNText
            allowFontScaling={false}
            style={{
              fontFamily: CAIRO_FONT_FAMILIES.bold,
              fontSize: height * 0.3,
              lineHeight: height * 0.42,
              color: inverse ? color.neutral.onBrandMuted : color.neutral.textSecondary,
              writingDirection: 'rtl',
            }}
          >
            {tagline}
          </RNText>
        ) : null}
      </View>
      <BrandMark size={height} tone={tone} inverse={inverse} />
    </View>
  );
}

/** Three brand dots rising in turn — the app's one loading motion. */
export function BrandDots({ tint = color.brand.DEFAULT }: { tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, direction: 'ltr' }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} tint={tint} />
      ))}
    </View>
  );
}

function Dot({ delay, tint }: { delay: number; tint: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ translateY: -4 * v.value }],
  }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: tint }, style]} />;
}

/**
 * Full-screen "loading this screen" state: the mark plus the brand dots,
 * replacing a bare grey ActivityIndicator floating in the middle of nothing.
 * Fades in after a beat so a fast load never flashes it at all.
 */
export function ScreenLoader({ tone = 'customer', label }: { tone?: BrandTone; label?: string }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(180, withTiming(1, { duration: 240 }));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: color.neutral.page }, style]}
    >
      <BrandMark size={52} tone={tone} />
      <BrandDots tint={brandDiscColor(tone)} />
      {label ? (
        <RNText style={{ fontFamily: CAIRO_FONT_FAMILIES.medium, fontSize: 13, color: color.neutral.textSecondary }}>{label}</RNText>
      ) : null}
    </Animated.View>
  );
}
