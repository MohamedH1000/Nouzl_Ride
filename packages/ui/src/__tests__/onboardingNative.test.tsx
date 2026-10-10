import { I18nManager, StyleSheet, type ViewStyle } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Onboarding } from '../Onboarding';

/**
 * Regression tests for 2026-10-07: in Arabic the welcome screen showed the
 * first slide's text over the LAST slide's background and icon (Android
 * emulator), or no background, icon or dots at all, leaving the white "Skip"
 * and logo on white. The pager read the native scroll offset as if it
 * always started at a known end, which a mirrored (RTL) ScrollView does not
 * guarantee. It now starts at an offset it sets itself.
 */

const SLIDES = [
  { icon: 'search', title: 'Discover', body: 'a', gradient: ['#111111', '#222222'] },
  { icon: 'card', title: 'Pay', body: 'b', gradient: ['#333333', '#444444'] },
  { icon: 'gift', title: 'Rewards', body: 'c', gradient: ['#555555', '#666666'] },
] as const;

function renderOnboarding() {
  return render(
    <Onboarding
      slides={SLIDES.map((s) => ({ ...s }))}
      skipLabel="Skip"
      nextLabel="Next"
      getStartedLabel="Start"
      onDone={() => undefined}
    />,
  );
}

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as ViewStyle) ?? {};

type HostNode = { type: string; props: Record<string, any>; children: (HostNode | string)[] | null };

function walk(node: HostNode | string | null, visit: (n: HostNode, parent: HostNode | null) => void, parent: HostNode | null = null) {
  if (!node || typeof node === 'string') return;
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, visit, node);
}

function hostTree(): HostNode {
  return screen.toJSON() as unknown as HostNode;
}

function pager(): HostNode {
  let found: HostNode | null = null;
  walk(hostTree(), (n) => {
    if (n.type === 'RCTScrollView' && n.props.horizontal) found = n;
  });
  if (!found) throw new Error('no pager');
  return found;
}

/** Each gradient's colours (as the native view gets them) and its wrapper's opacity, in render order. */
function gradients() {
  const out: { colors: string; opacity: unknown }[] = [];
  walk(hostTree(), (n, parent) => {
    if (n.type.includes('LinearGradient')) out.push({ colors: JSON.stringify(n.props.colors), opacity: parent ? flat(parent).opacity : undefined });
  });
  return out;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each([
  ['left-to-right', false],
  ['right-to-left', true],
])('Onboarding pager, %s', (_name, rtl) => {
  beforeEach(() => {
    jest.replaceProperty(I18nManager, 'isRTL', rtl);
  });

  it('is laid out left-to-right and starts on slide 1', async () => {
    await renderOnboarding();
    const scroll = pager();
    expect(flat(scroll).direction).toBe('ltr');
    // 750 is the test window width; in Arabic slide 1 is the right end.
    expect(scroll.props.contentOffset).toEqual({ x: rtl ? 2 * 750 : 0, y: 0 });
    expect(screen.getByText('Discover')).toBeTruthy();
  });

  it('shows slide 1 colours, never the last slide, before any scroll', async () => {
    await renderOnboarding();
    const all = gradients();
    // A still copy of slide 1 first, then one animated layer per slide.
    expect(all).toHaveLength(4);
    expect(all[0].opacity).toBeUndefined();
    const visible = all.slice(1).filter((g) => g.opacity === 1);
    expect(visible).toHaveLength(1);
    expect(visible[0].colors).toBe(all[0].colors);
    expect(all[3].opacity).toBe(0);
  });
});
