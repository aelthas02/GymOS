import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { breakpoints, mediaQueries } from './breakpoints';

const scss = readFileSync(join(import.meta.dirname, '_breakpoints.scss'), 'utf8');

describe('breakpoints', () => {
  it('_breakpoints.scss e breakpoints.ts têm as mesmas larguras', () => {
    expect(scss).toContain(`$tablet: ${breakpoints.tablet}px;`);
    expect(scss).toContain(`$desktop: ${breakpoints.desktop}px;`);
  });

  it('mobile < 768, tablet 768–1279 e desktop ≥ 1280', () => {
    expect(mediaQueries).toEqual({
      mobile: '(max-width: 767.98px)',
      tablet: '(min-width: 768px) and (max-width: 1279.98px)',
      tabletUp: '(min-width: 768px)',
      desktop: '(min-width: 1280px)',
    });
  });
});
