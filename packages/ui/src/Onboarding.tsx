import { useRef, useState } from 'react';
import { I18nManager, Image, Pressable, ScrollView, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { Text } from './Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, radius, shadow } from '@nouzl/theme';
import { Button } from './Button';
import { BrandMark } from './Brand';

/** Reanimated ships a purpose-built animated ScrollView. Wrapping RN's own
 *  `ScrollView` in `createAnimatedComponent()` instead silently dropped
 *  every child: the content container mounted EMPTY, so no slide rendered
 *  at all — which looked like an invisible-icon styling bug rather than
 *  the missing-children bug it actually was. */
const AnimatedScrollView = Animated.ScrollView;

export interface OnboardingSlide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  /** Two-stop gradient for this slide's hero. Defaults to brand purple, so
   *  a caller that doesn't care still gets something on-brand. */
  gradient?: readonly [string, string];
  /** Illustration shown in place of the icon disc (a transparent PNG from
   *  the app's assets/images/illustrations). The icon stays as the fallback. */
  image?: ImageSourcePropType;
}

export interface OnboardingProps {
  slides: OnboardingSlide[];
  skipLabel: string;
  nextLabel: string;
  getStartedLabel: string;
  onDone: () => void;
}

const DEFAULT_GRADIENT = [color.brand.deep, color.brand.DEFAULT] as const;

/**
 * Shared first-launch onboarding for both apps — swipeable, skippable,
 * shown once per install. Content arrives already translated rather than
 * as i18n keys, so this component stays free of an i18n dependency; each
 * app resolves its own `t()` calls first. The caller owns the "seen" flag
 * and whether to render this at all.
 *
 * Motion is scroll-DRIVEN rather than triggered on slide change: the hero
 * gradients cross-fade, and each slide's icon scales and drifts, as a
 * direct function of finger position (`useAnimatedScrollHandler` on the
 * UI thread). A swipe that stops halfway shows a real halfway state and
 * follows the finger back — which is what separates motion that feels
 * native from motion that merely animates after the fact.
 */
export function Onboarding({ slides, skipLabel, nextLabel, getStartedLabel, onDone }: OnboardingProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const isLast = activeIndex === slides.length - 1;

  /**
   * Arabic pages from right to left: slide 0 sits at the right end of the
   * pager and the next slide comes in from the left.
   *
   * The pager itself is always laid out left-to-right (`direction: 'ltr'`
   * below) and the order is reversed here, in JS. Letting the native layer
   * mirror it did not work: what a mirrored horizontal ScrollView reports
   * as `contentOffset.x` differs between iOS and Android, and between a
   * launch where the native RTL flag is already applied and the first
   * launch where it is not (2026-10-07, Android emulator: the copy showed
   * slide 1 while the background and icon showed the last slide; elsewhere
   * every layer faded to 0, leaving the white "Skip" and logo on white).
   * With a fixed left-to-right pager, offset x always means the same thing.
   */
  const maxOffset = Math.max(0, (slides.length - 1) * windowWidth);
  const isRtl = I18nManager.isRTL;

  /** Raw scroll offset that puts slide `index` on screen. */
  function offsetForIndex(index: number) {
    return isRtl ? maxOffset - index * windowWidth : index * windowWidth;
  }
  /** Raw offset → left-to-right slide progress. */
  function normalize(x: number) {
    'worklet';
    return isRtl ? maxOffset - x : x;
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = normalize(e.contentOffset.x);
    },
  });

  function goNext() {
    if (isLast) {
      onDone();
      return;
    }
    scrollRef.current?.scrollTo({ x: offsetForIndex(activeIndex + 1), animated: true });
  }

  return (
    <View className="flex-1 bg-page">
      {/* A still copy of the first slide's gradient under the animated ones,
          so the hero is never blank white behind the white "Skip" and logo,
          even for a frame before the first scroll event. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '76%' }}>
        <LinearGradient
          colors={slides[0]?.gradient ?? DEFAULT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>
      {/* One gradient per slide, stacked and cross-faded by scroll position.
          LinearGradient's `colors` isn't an animatable style prop, so
          opacity on stacked layers is how a colour transition is actually
          achieved here. */}
      {slides.map((slide, i) => (
        <GradientLayer key={i} index={i} scrollX={scrollX} width={windowWidth} colors={slide.gradient ?? DEFAULT_GRADIENT} />
      ))}

      {/* Hero icons are absolutely-positioned SIBLINGS of the gradients
          rather than children of the pager. A horizontal ScrollView's
          content container hugs its children on the cross axis, so nothing
          inside it can reliably fill the hero's height — `flex: 1`,
          `alignSelf: 'stretch'` and an onLayout-measured height were all
          tried and all collapsed the slide to zero height. Positioning
          them here, driven by the same `scrollX` as the gradients (which
          demonstrably works), sidesteps content sizing altogether: the
          ScrollView below is left as a pure gesture/paging surface whose
          children only need a WIDTH. */}
      {slides.map((slide, i) => (
        <IconLayer key={i} index={i} scrollX={scrollX} width={windowWidth} icon={slide.icon} image={slide.image} />
      ))}

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="h-12 flex-row items-center justify-between px-5 pt-1">
          {/* The brand on the very first screen a new user sees. */}
          <BrandMark size={26} variant="plain" fill={color.neutral.onBrandMuted} />
          {!isLast ? (
            <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel={skipLabel}>
              <Text className="text-sm font-bold text-on-brand/90">{skipLabel}</Text>
            </Pressable>
          ) : null}
        </View>

        <AnimatedScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setActiveIndex(Math.round(normalize(e.nativeEvent.contentOffset.x) / windowWidth))}
          // Starts on slide 0, which is the right end in Arabic (see above).
          contentOffset={{ x: offsetForIndex(0), y: 0 }}
          style={{ flex: 1, direction: 'ltr' }}
        >
          {/* Width-only spacers: these exist purely to give the pager
              something to page over. The visible hero lives above. */}
          {slides.map((_, i) => (
            <View key={i} style={{ width: windowWidth }} />
          ))}
        </AnimatedScrollView>

        {/* Content sheet — lifts the copy off the gradient and gives the
            controls a stable, high-contrast surface regardless of which
            slide's colours are behind it. */}
        <View
          className="mx-4 mb-2 gap-5 bg-card p-6"
          style={[{ borderRadius: radius.cardLg }, shadow(4)]}
        >
          <View className="gap-2">
            <Text className="text-center text-xl font-extrabold text-text">{slides[activeIndex]?.title}</Text>
            <Text className="text-center text-sm leading-6 text-text-secondary">{slides[activeIndex]?.body}</Text>
          </View>

          <View className="flex-row items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} width={windowWidth} />
            ))}
          </View>

          <Button label={isLast ? getStartedLabel : nextLabel} onPress={goNext} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** One full-screen gradient, visible only while its slide is centred. */
function GradientLayer({
  index,
  scrollX,
  width,
  colors,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  colors: readonly [string, string];
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    // Tall enough that the content card below always overlaps it — at 62% a
    // band of plain page colour showed between the hero and the card.
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: '76%' }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/**
 * One slide's hero icon: concentric rings behind a white disc, sitting in
 * the top gradient area. Absolutely positioned (see the call site) and
 * driven entirely by `scrollX`, so it needs no layout from the pager.
 */
function IconLayer({
  index,
  scrollX,
  width,
  icon,
  image,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  icon: OnboardingSlide['icon'];
  image?: ImageSourcePropType;
}) {
  const imageSize = Math.min(width * 0.92, 420);
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, inputRange, [0.6, 1, 0.6], Extrapolation.CLAMP) },
        // Drifts slower than the finger, so the icon reads as sitting
        // "behind" the page rather than glued to it.
        {
          translateX: interpolate(
            scrollX.value,
            inputRange,
            [width * 0.3, 0, -width * 0.3],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, height: image ? '70%' : '58%', alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {image ? (
        <>
          {/* A soft light pool behind the illustration lifts it off the gradient. */}
          <View
            className="absolute rounded-full bg-on-brand/15"
            style={{ width: imageSize * 0.78, height: imageSize * 0.78 }}
          />
          <Image source={image} resizeMode="contain" style={{ width: imageSize, height: imageSize }} accessibilityIgnoresInvertColors />
        </>
      ) : (
        <>
          {/* Two translucent rings — depth without another asset to ship. */}
          <View className="absolute h-56 w-56 rounded-full bg-on-brand/10" />
          <View className="absolute h-44 w-44 rounded-full bg-on-brand/20" />
          <View className="h-32 w-32 items-center justify-center rounded-full bg-on-brand" style={shadow(3)}>
            <Ionicons name={icon} size={56} color={color.brand.DEFAULT} />
          </View>
        </>
      )}
    </Animated.View>
  );
}

/** Pill indicator that widens as its slide comes into view. */
function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, inputRange, [6, 24, 6], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color.brand.DEFAULT }, style]} />;
}
