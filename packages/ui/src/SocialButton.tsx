import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from './Typography';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AnimatedPressable } from './interop';
import { color, radius, motion } from '@nouzl/theme';


/**
 * Google's official four-colour "G". Drawn as SVG rather than taken from
 * an icon font because Google's branding guidelines require the mark's
 * exact colours and geometry — a monochrome glyph tinted brand-purple
 * would be a guideline violation, and is also the kind of detail that
 * makes a sign-in screen look counterfeit.
 */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export interface SocialButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * White, bordered Google button — the treatment Google's own guidelines
 * specify, and deliberately NOT the brand-purple `Button`: a social
 * provider button that adopts the host app's colour reads as a fake.
 * Shares `Button`'s spring-scale + iOS haptic press feel so it doesn't
 * feel like a foreign control next to it.
 */
export function GoogleButton({ label, onPress, loading, disabled }: SocialButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: motion.easeSpring.damping, stiffness: motion.easeSpring.stiffness });
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: motion.easeSpring.damping, stiffness: motion.easeSpring.stiffness });
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: color.neutral.card,
          borderWidth: 1,
          borderColor: color.neutral.border,
          borderRadius: radius.row,
          paddingVertical: 12,
          opacity: isDisabled ? 0.6 : 1,
        },
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color.neutral.text} />
      ) : (
        <>
          <GoogleMark />
          {/* See Button.tsx — a bare fontWeight can't bold a static Cairo TTF. */}
          <Text className="font-bold" style={{ color: color.neutral.text, fontSize: 15 }}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}
