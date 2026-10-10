import { render, screen } from '@testing-library/react-native';
import { AuthScreen, EmptyState, Onboarding } from '../index';

/** Illustrations (2026-10-07): each shared surface shows the app's image when given one, and its icon otherwise. */

const PICTURE = { uri: 'test://illustration.png' };

type HostNode = { type: string; props: Record<string, any>; children: (HostNode | string)[] | null };

function hostImages(): HostNode[] {
  const out: HostNode[] = [];
  const walk = (n: HostNode | string | null) => {
    if (!n || typeof n === 'string') return;
    if (n.type === 'Image') out.push(n);
    (n.children ?? []).forEach(walk);
  };
  const tree = screen.toJSON() as unknown as HostNode | HostNode[];
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return out;
}

/** Ionicons glyphs, found by their icon font. */
function glyphs(): number {
  let count = 0;
  const walk = (n: HostNode | string | null) => {
    if (!n || typeof n === 'string') return;
    const style = [n.props.style].flat(Infinity) as { fontFamily?: string }[];
    if (n.type === 'Text' && style.some((s) => s?.fontFamily === 'ionicons')) count += 1;
    (n.children ?? []).forEach(walk);
  };
  const tree = screen.toJSON() as unknown as HostNode | HostNode[];
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return count;
}

const pictures = () => hostImages().filter((n) => JSON.stringify(n.props.source).includes('test://illustration.png'));

describe('EmptyState', () => {
  it('shows the illustration instead of the icon', async () => {
    await render(<EmptyState image={PICTURE} icon="calendar-outline" title="No trips yet" body="Soon" />);
    expect(pictures()).toHaveLength(1);
    expect(glyphs()).toBe(0);
    expect(screen.getByText('No trips yet')).toBeTruthy();
  });

  it('keeps the icon without an illustration', async () => {
    await render(<EmptyState icon="calendar-outline" title="No trips yet" />);
    expect(pictures()).toHaveLength(0);
    expect(glyphs()).toBe(1);
  });
});

describe('AuthScreen', () => {
  it('shows the hero illustration only when given one', async () => {
    const { rerender } = await render(<AuthScreen logo={null} title="Sign in" hero={PICTURE}>{null}</AuthScreen>);
    expect(pictures()).toHaveLength(1);
    await rerender(<AuthScreen logo={null} title="Sign in">{null}</AuthScreen>);
    expect(pictures()).toHaveLength(0);
  });
});

describe('Onboarding', () => {
  it('shows a slide illustration in place of the icon disc, and the icon for a slide without one', async () => {
    await render(
      <Onboarding
        slides={[
          { icon: 'search', title: 'A', body: 'a', image: PICTURE },
          { icon: 'gift', title: 'B', body: 'b' },
        ]}
        skipLabel="Skip"
        nextLabel="Next"
        getStartedLabel="Go"
        onDone={() => undefined}
      />,
    );
    expect(pictures()).toHaveLength(1);
    // Slide 1's glyph is replaced by its image; slide 2 keeps its gift glyph.
    expect(glyphs()).toBe(1);
  });
});
