import { StyleSheet, type TextStyle } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import i18n from '@nouzl/i18n';
import { Text, TextInput } from '../Typography';

/**
 * Regression for 2026-10-08: Arabic labels sat on the LEFT of the sign-in
 * card on Android. A physical `textAlign: 'right'` lands on the left when the
 * layout is genuinely right-to-left, so Text now carries its own direction and
 * no physical alignment. Inputs keep a physical alignment (an empty field has
 * no script for the platform to go by).
 */

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as TextStyle) ?? {};

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

async function inArabic() {
  await act(async () => {
    await i18n.changeLanguage('ar');
  });
}

describe('Text direction', () => {
  it('in Arabic: right-to-left, with no physical textAlign', async () => {
    await inArabic();
    await render(<Text>أهلاً بعودتك</Text>);
    const style = styleOf(screen.getByText('أهلاً بعودتك'));
    expect(style.direction).toBe('rtl');
    expect(style.writingDirection).toBe('rtl');
    expect(style.textAlign).toBeUndefined();
  });

  it('in English: left-to-right, with no physical textAlign', async () => {
    await render(<Text>Welcome back</Text>);
    const style = styleOf(screen.getByText('Welcome back'));
    expect(style.direction).toBe('ltr');
    expect(style.textAlign).toBeUndefined();
  });

  it("keeps a caller's explicit alignment", async () => {
    await inArabic();
    await render(<Text className="text-center">مرحبا</Text>);
    const style = styleOf(screen.getByText('مرحبا'));
    expect(style.direction).toBeUndefined();
  });

  it('inputs keep the physical edge of the language', async () => {
    await inArabic();
    await render(<TextInput testID="field" />);
    const style = styleOf(screen.getByTestId('field'));
    expect(style.textAlign).toBe('right');
    expect(style.writingDirection).toBe('rtl');
  });
});
