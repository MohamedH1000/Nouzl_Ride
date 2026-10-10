import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { color, radius } from '@nouzl/theme';
import { AnimatedPressable, AnimatedView, Button, PressableCard, Skeleton } from '../index';
import { splitAnimatedStyles } from '../interop';
import { registerCss } from './registerCss';

/**
 * Regression tests for 2026-10-04: on iOS/Android every Button, PressableCard,
 * SocialButton and Skeleton rendered with no background, padding or corners.
 * NativeWind's interop flattened their style arrays, including the
 * useAnimatedStyle() handle, and Reanimated then kept only the animated
 * values. These run on the native code path (jest-expo iOS preset), which web
 * screenshots never exercise.
 */

registerCss(`
  .p-4 { padding: 16px }
  .bg-card { background-color: #ffffff }
  .rounded-card { border-radius: 18px }
  .flex-row { flex-direction: row }
`);

function styleOf(element: { props: { style?: unknown } }): ViewStyle {
  return StyleSheet.flatten(element.props.style as ViewStyle) ?? {};
}

describe('Button on native', () => {
  it('keeps its background, padding and corners next to the press animation', async () => {
    await render(<Button label="Sign in" onPress={() => undefined} />);
    const style = styleOf(screen.getByRole('button'));
    expect(style.backgroundColor).toBe(color.brand.DEFAULT);
    expect(style.paddingVertical).toBe(12);
    expect(style.paddingHorizontal).toBe(20);
    expect(style.borderRadius).toBe(radius.row);
    expect(style.transform).toEqual([{ scale: 1 }]);
  });

  it('shows its label in the on-brand text colour', async () => {
    await render(<Button label="Sign in" onPress={() => undefined} />);
    expect(styleOf(screen.getByText('Sign in')).color).toBe(color.neutral.onBrand);
  });

  it('uses the tint background for the secondary variant', async () => {
    await render(<Button label="More" variant="secondary" onPress={() => undefined} />);
    expect(styleOf(screen.getByRole('button')).backgroundColor).toBe(color.brand.tint);
  });

  it('calls onPress, and not when disabled or loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Go" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Button label="Go" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button'));
    expect(styleOf(screen.getByRole('button')).opacity).toBe(0.5);

    await rerender(<Button label="Go" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.queryByText('Go')).toBeNull();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('merges a caller style on top', async () => {
    await render(<Button label="Wide" onPress={() => undefined} style={{ marginTop: 8 }} />);
    const style = styleOf(screen.getByRole('button'));
    expect(style.marginTop).toBe(8);
    expect(style.backgroundColor).toBe(color.brand.DEFAULT);
  });
});

describe('PressableCard on native', () => {
  it('applies its classes, its inline styles and the press animation together', async () => {
    await render(
      <PressableCard className="flex-row" onPress={() => undefined} style={{ marginBottom: 4 }}>
        <></>
      </PressableCard>,
    );
    const style = styleOf(screen.getByRole('button'));
    expect(style.padding).toBe(16); // p-4
    expect(style.backgroundColor).toBe('#ffffff'); // bg-card
    expect(style.flexDirection).toBe('row'); // the caller's className
    expect(style.marginBottom).toBe(4); // the caller's style
    expect(style.transform).toEqual([{ scale: 1 }]); // the animated style
  });

  it('drops the padding when bare', async () => {
    await render(
      <PressableCard bare onPress={() => undefined}>
        <></>
      </PressableCard>,
    );
    expect(styleOf(screen.getByRole('button')).padding).toBeUndefined();
  });
});

describe('Skeleton on native', () => {
  it('keeps its size and colour while it pulses', async () => {
    await render(<Skeleton testID="sk" height={20} />);
    const style = styleOf(screen.getByTestId('sk', { includeHiddenElements: true }));
    expect(style.height).toBe(20);
    expect(style.backgroundColor).toBe(color.neutral.divider);
    expect(typeof style.opacity).toBe('number');
  });
});

describe('AnimatedView / AnimatedPressable', () => {
  it('AnimatedView applies className, plain and animated styles', async () => {
    function Pulse() {
      const animated = useAnimatedStyle(() => ({ opacity: 0.5 }));
      return <AnimatedView testID="v" className="p-4 bg-card" style={[{ margin: 2 }, animated]} />;
    }
    await render(<Pulse />);
    expect(styleOf(screen.getByTestId('v'))).toMatchObject({ padding: 16, backgroundColor: '#ffffff', margin: 2, opacity: 0.5 });
  });

  it('AnimatedPressable keeps a nested style array', async () => {
    function Pressed() {
      const animated = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 }] }));
      return <AnimatedPressable testID="p" className="rounded-card" style={[[{ padding: 3 }], animated]} />;
    }
    await render(<Pressed />);
    expect(styleOf(screen.getByTestId('p'))).toMatchObject({ borderRadius: 18, padding: 3, transform: [{ scale: 0.9 }] });
  });

  it('documents the bug: registering a Reanimated component directly loses its plain styles', async () => {
    const Broken = Animated.createAnimatedComponent(Pressable);
    cssInterop(Broken, { className: 'style' });
    function Probe() {
      const animated = useAnimatedStyle(() => ({ opacity: 1 }));
      return <Broken testID="broken" style={[{ backgroundColor: 'red', padding: 9 }, animated]} />;
    }
    await render(<Probe />);
    // If this starts failing, NativeWind/Reanimated fixed the interaction
    // upstream and interop.tsx's wrappers could be simplified.
    expect(styleOf(screen.getByTestId('broken')).backgroundColor).toBeUndefined();
  });
});

describe('splitAnimatedStyles', () => {
  it('separates Reanimated handles from plain styles, flattening nesting and skipping falsy items', () => {
    const handle = { viewDescriptors: {}, initial: { value: {} } };
    const plainA = { padding: 1 };
    const plainB = { margin: 2 };
    expect(splitAnimatedStyles([plainA, null, [false, plainB, handle], undefined])).toEqual({
      plain: [plainA, plainB],
      animated: [handle],
    });
    expect(splitAnimatedStyles(plainA)).toEqual({ plain: [plainA], animated: [] });
    expect(splitAnimatedStyles(undefined)).toEqual({ plain: [], animated: [] });
  });
});
