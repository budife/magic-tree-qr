import { buildQr, QUIET_ZONE } from '../scene/qr';
import type { Palette } from '../scene/palette';

export interface QrColors {
  dark: string;
  light: string;
}

export interface QrRaster {
  /** Width and height in pixels, quiet zone included. */
  width: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

const INK = '#5c4f3f';
const INK_FAINT = 'rgba(92, 79, 63, 0.55)';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Flat QR colours for the current palette: deepest leaf tone on the pale plot. */
export function shareColors(palette: Palette): QrColors {
  return { dark: palette.qrLeaf[0], light: palette.moduleLight };
}

/**
 * Rasterises `text` as a flat QR bitmap with the same encoding as the scene
 * (level H, four-module quiet zone). `scale` is pixels per module.
 */
export function rasterQr(text: string, colors: QrColors, scale = 1): QrRaster {
  const qr = buildQr(text);
  const width = (qr.size + QUIET_ZONE * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  const dark = hexToRgb(colors.dark);
  const light = hexToRgb(colors.light);

  for (let py = 0; py < width; py++) {
    const my = Math.floor(py / scale) - QUIET_ZONE;
    for (let px = 0; px < width; px++) {
      const mx = Math.floor(px / scale) - QUIET_ZONE;
      const inside = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size;
      const c = inside && qr.dark[my * qr.size + mx] ? dark : light;
      const o = (py * width + px) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  return { width, data };
}

/** Shortens `text` with an ellipsis until it fits `maxWidth` in the current font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > maxWidth) cut--;
  return `${text.slice(0, cut)}…`;
}

/**
 * Builds the PNG that gets shared: a flat, reliably scannable QR in the
 * palette's colours with the encoded link printed underneath.
 */
export function buildShareImage(text: string, palette: Palette): Promise<Blob> {
  const W = 1080;
  const H = 1280;
  const PAD = 90;
  const BOX = W - PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('2D canvas unavailable'));

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, W, H);

  // Draw at one pixel per module, then upscale by a whole number so every
  // module stays the same size and edges stay sharp.
  const raster = rasterQr(text, shareColors(palette));
  const tile = document.createElement('canvas');
  tile.width = raster.width;
  tile.height = raster.width;
  tile.getContext('2d')?.putImageData(new ImageData(raster.data, raster.width, raster.width), 0, 0);

  const size = Math.floor(BOX / raster.width) * raster.width;
  const x = Math.round((W - size) / 2);
  const y = Math.round(PAD + (BOX - size) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tile, x, y, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(fitText(ctx, text, BOX), W / 2, PAD + BOX + 80);
  ctx.fillStyle = INK_FAINT;
  ctx.font = `28px ${FONT}`;
  ctx.fillText('Magic Tree', W / 2, PAD + BOX + 140);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}
