import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type ComponentType,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  type RefAttributes,
} from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

/**
 * Animated components that also accept `className`.
 *
 * NativeWind only turns `className` into styles for components it has
 * registered — the core react-native ones, not Reanimated's animated wrappers —
 * so a `className` on a bare `Animated.View` or animated Pressable is silently
 * dropped on every platform. Registering them with `cssInterop()` fixes that,
 * but on iOS/Android it broke something worse (2026-10-04, reported from an
 * iOS simulator: every Button rendered with no background, padding or corners):
 *
 * the native interop flattens the WHOLE `style` array into one object, spreading
 * a `useAnimatedStyle()` handle into it. Reanimated then sees that object's
 * `viewDescriptors` key, takes the entire object for its animated style and
 * renders only the animated values — the transform/opacity — dropping every
 * plain style beside it (react-native-css-interop native-interop.js applyRules
 * → Reanimated PropsFilter.filterNonAnimatedProps). Web doesn't flatten, which
 * is why screenshots of the web build looked right.
 *
 * So the animated component itself is never registered. A registered inner
 * component takes `className` + the plain styles (safe to flatten), and the
 * animated handles bypass the interop and are appended after it.
 *
 * Use `AnimatedView` / `AnimatedPressable` from here whenever an animated
 * component needs `className`. A bare `Animated.View` is fine with `style`
 * only — never give it a `className`.
 */

type StyleItem = unknown;

function isAnimatedStyle(item: StyleItem): boolean {
  return !!item && typeof item === 'object' && !Array.isArray(item) && 'viewDescriptors' in item;
}

/** Splits a (possibly nested) style prop into plain styles and Reanimated handles. Exported for tests. */
export function splitAnimatedStyles(style: StyleItem): { plain: StyleItem[]; animated: StyleItem[] } {
  const plain: StyleItem[] = [];
  const animated: StyleItem[] = [];
  const walk = (item: StyleItem) => {
    if (Array.isArray(item)) item.forEach(walk);
    else if (isAnimatedStyle(item)) animated.push(item);
    else if (item) plain.push(item);
  };
  walk(style);
  return { plain, animated };
}

type WithClassName<C extends ComponentType<any>> = ForwardRefExoticComponent<
  PropsWithoutRef<Omit<ComponentProps<C>, 'className'> & { className?: string }> & RefAttributes<ComponentRef<C>>
>;

function withClassName<C extends ComponentType<any>>(Base: C, displayName: string): WithClassName<C> {
  const Component = Base as ComponentType<any>;

  // Receives what the interop produced: `style` = className + plain styles.
  const Inner = forwardRef<unknown, { style?: unknown; animatedStyles?: StyleItem[] }>(function Inner(
    { animatedStyles, style, ...rest },
    ref,
  ) {
    return <Component ref={ref} {...rest} style={animatedStyles?.length ? [style, ...animatedStyles] : style} />;
  });
  cssInterop(Inner, { className: 'style' });
  const Registered = Inner as ComponentType<any>;

  const Outer = forwardRef<unknown, { style?: unknown }>(function Outer({ style, ...rest }, ref) {
    const { plain, animated } = splitAnimatedStyles(style);
    return <Registered ref={ref} {...rest} style={plain} animatedStyles={animated.length ? animated : undefined} />;
  });
  Outer.displayName = displayName;
  return Outer as unknown as WithClassName<C>;
}

/** `Animated.View` that also takes `className` — see the note above. */
export const AnimatedView = withClassName(Animated.View, 'AnimatedView');

const BareAnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The one animated Pressable every package uses — Button, Card, SocialButton
 *  and the customer app's PropertyCard used to each create their own. */
export const AnimatedPressable = withClassName(BareAnimatedPressable, 'AnimatedPressable');
