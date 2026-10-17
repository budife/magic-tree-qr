import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { rasterQr, shareColors } from '../qrImage';
import { SEASONS, SEASON_ORDER, BLOSSOM_SWATCHES } from '../../scene/palette';

const LINKS = [
  'https://example.com',
  'https://instagram.com/username',
  'https://a-much-longer-example-domain.co.uk/path/to/page?ref=magic-tree',
];

// Every dark tone a module can take, against that season's pale plot.
const COMBOS = [
  ...SEASON_ORDER.flatMap((id) =>
    SEASONS[id].qrLeaf.map((dark) => ({ name: `${id} ${dark}`, dark, light: SEASONS[id].moduleLight })),
  ),
  ...BLOSSOM_SWATCHES.flatMap((s) =>
    s.qr.map((dark) => ({ name: `spring/${s.id} ${dark}`, dark, light: SEASONS.spring.moduleLight })),
  ),
];

describe('rasterQr', () => {
  it.each(COMBOS)('decodes with $name', ({ dark, light }) => {
    for (const link of LINKS) {
      const { width, data } = rasterQr(link, { dark, light }, 4);
      expect(jsQR(data, width, width)?.data).toBe(link);
    }
  });

  it('includes the four-module quiet zone', () => {
    const { width, data } = rasterQr('https://example.com', shareColors(SEASONS.winter), 1);
    // Top-left pixel sits in the quiet zone, so it must be the light colour.
    expect([data[0], data[1], data[2]]).toEqual([0xf5, 0xfa, 0xfe]);
    expect(width).toBeGreaterThanOrEqual(21 + 8);
  });
});
