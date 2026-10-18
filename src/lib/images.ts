import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const photos = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.webp', { eager: true });
export const heroSizes = '(max-width: 760px) calc(100vw - 56px), (max-width: 1100px) calc(100vw - 92px), (max-width: 1440px) calc(100vw - 156px), 1284px';
export const columnSizes = '(max-width: 760px) calc(100vw - 56px), (max-width: 1100px) 45vw, 600px';
export const cardSizes = '(max-width: 760px) calc(100vw - 56px), (max-width: 1100px) 44vw, 300px';

// Astro creates content-addressed files at build time; no image server or client JS.
export async function imageSources(path: string) {
  const name = path.split('/').pop();
  const source = photos[`../assets/photos/${name}`]?.default;
  if (!source) throw new Error(`Unknown photograph: ${path}`);
  const widths = [...new Set([480, 640, 768, 1024, 1440, source.width].filter(width => width <= source.width))].sort((a, b) => a - b);
  const [avif, webp] = await Promise.all([
    getImage({ src: source, widths, width: Math.min(1024, source.width), format: 'avif', quality: 52 }),
    getImage({ src: source, widths, width: Math.min(1024, source.width), format: 'webp', quality: 72 }),
  ]);
  return { avif, webp, width: source.width, height: source.height };
}
