import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const photos = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.webp', { eager: true });
export const heroSizes = '(max-width: 760px) calc(100vw - 60px), (max-width: 1100px) 420px, 520px';
export const columnSizes = '(max-width: 760px) calc(100vw - 44px), (max-width: 1100px) 45vw, 640px';
export const cardSizes = '(max-width: 760px) calc(50vw - 44px), (max-width: 1100px) 44vw, 300px';

// Astro creates content-addressed files at build time; no image server or client JS.
export async function imageSources(path: string) {
  const name = path.split('/').pop();
  const source = photos[`../assets/photos/${name}`]?.default;
  if (!source) throw new Error(`Unknown photograph: ${path}`);
  // Crop the hero before encoding so a narrow portrait does not download and
  // then enlarge a lower-resolution landscape image behind object-fit: cover.
  const portrait = name === 'hero.webp';
  const maxWidth = portrait ? Math.min(source.width, Math.floor(source.height * .8)) : source.width;
  const dimensions = portrait ? { width: maxWidth, height: Math.round(maxWidth * 1.25), fit: 'cover' as const } : { width: Math.min(1024, source.width) };
  const widths = [...new Set([320, 480, 640, 768, 1024, 1440, maxWidth].filter(width => width <= maxWidth))].sort((a, b) => a - b);
  const [avif, webp] = await Promise.all([
    getImage({ src: source, widths, ...dimensions, format: 'avif', quality: portrait ? 62 : 52 }),
    getImage({ src: source, widths, ...dimensions, format: 'webp', quality: portrait ? 82 : 72 }),
  ]);
  return { avif, webp, width: portrait ? maxWidth : source.width, height: portrait ? dimensions.height! : source.height };
}
