import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ar from './locales/ar.json';

/**
 * Every string exists in both languages. A key added to one file only shows
 * the raw key ("experiences.title") to half the users — the kind of slip that
 * passes typecheck and review. Arabic legitimately has more plural forms
 * (zero/two/few/many), so plural suffixes are compared by base key.
 */
function keys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix + k;
    if (v && typeof v === 'object') keys(v as Record<string, unknown>, `${path}.`).forEach((x) => out.add(x));
    else out.add(path.replace(/_(zero|one|two|few|many|other)$/, ''));
  }
  return out;
}

describe('locales', () => {
  it('Arabic and English define the same keys', () => {
    const a = keys(ar as Record<string, unknown>);
    const e = keys(en as Record<string, unknown>);
    expect([...e].filter((k) => !a.has(k))).toEqual([]);
    expect([...a].filter((k) => !e.has(k))).toEqual([]);
  });

  it('no string is left empty', () => {
    const empty: string[] = [];
    const walk = (obj: Record<string, unknown>, lang: string, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object') walk(v as Record<string, unknown>, lang, `${prefix}${k}.`);
        else if (typeof v === 'string' && !v.trim()) empty.push(`${lang}:${prefix}${k}`);
      }
    };
    walk(en as Record<string, unknown>, 'en');
    walk(ar as Record<string, unknown>, 'ar');
    expect(empty).toEqual([]);
  });
});
