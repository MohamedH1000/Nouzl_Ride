import { describe, expect, it } from 'vitest';
import { autoDirectionStyle, formatRange, textDirectionOf } from './bidi';

describe('textDirectionOf (dir="auto" for user text)', () => {
  it('takes the direction of the first strong letter', () => {
    expect(textDirectionOf('Yes, free parking is available.')).toBe('ltr');
    expect(textDirectionOf('هل يتوفر موقف سيارات؟')).toBe('rtl');
    expect(textDirectionOf('2026 — شكراً')).toBe('rtl');
    expect(textDirectionOf('123 Main St, الرياض')).toBe('ltr');
  });
  it('has no opinion on text without letters', () => {
    expect(textDirectionOf('12:30')).toBeNull();
    expect(textDirectionOf(null)).toBeNull();
    expect(autoDirectionStyle('')).toBeUndefined();
  });
  it('aligns to the leading edge of that direction', () => {
    expect(autoDirectionStyle('hello')).toEqual({ writingDirection: 'ltr', textAlign: 'left' });
    expect(autoDirectionStyle('مرحبا')).toEqual({ writingDirection: 'rtl', textAlign: 'right' });
  });
});

describe('formatRange', () => {
  it('points the arrow the way the line reads', () => {
    expect(formatRange('a', 'b', false)).toContain('→');
    expect(formatRange('a', 'b', true)).toContain('←');
  });
});
