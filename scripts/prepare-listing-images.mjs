#!/usr/bin/env node
// Encode only the reviewed, authorized images. Builds use the committed outputs
// and never fetch third-party images. Originals are kept outside the public tree.
// Usage: node scripts/prepare-listing-images.mjs .local/photo-research/originals
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadListings } from '../src/data.ts';

const originalDir = process.argv[2];
if (!originalDir) throw new Error('Pass the directory containing the reviewed originals.');
const review = JSON.parse(await readFile('research/listing-image-review.json', 'utf8'));
const ids = new Set((await loadListings()).map(item => item.id));
const output = 'public/images/listings';
await mkdir(output, { recursive: true });
const approved = review.items.filter(item => item.decision === 'approved');
const images = [];
const queue = [...approved];
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let item; (item = queue.shift());) {
    if (!ids.has(item.listingId) || !item.rightsBasis || !item.alt || new URL(item.sourceUrl).hostname !== 'tetonflats.com') {
      throw new Error(`Unreviewed image: ${item.listingId}`);
    }
    const original = await readFile(join(originalDir, `${item.listingId}.jpg`));
    if (createHash('sha256').update(original).digest('hex') !== item.sourceSha256) {
      throw new Error(`Source changed; review again: ${item.listingId}`);
    }
    const oriented = await sharp(original).rotate().toBuffer();
    const metadata = await sharp(oriented).metadata();
    const maxWidth = Math.min(960, metadata.width);
    const widths = [...new Set([320, 640, maxWidth].filter(width => width <= maxWidth))].sort((a, b) => a - b);
    const variants = [];
    for (const width of widths) {
      const variant = { width, height: Math.round(metadata.height * width / metadata.width) };
      for (const format of ['webp', 'avif']) {
        const encoded = await sharp(oriented).resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality: format === 'avif' ? 49 : 76, effort: 4 }).toBuffer();
        const hash = createHash('sha256').update(encoded).digest('hex').slice(0, 10);
        const filename = `${item.listingId}-${width}-${hash}.${format}`;
        await writeFile(join(output, filename), encoded);
        variant[format] = `/images/listings/${filename}`;
        variant[`${format}Bytes`] = encoded.length;
      }
      variants.push(variant);
    }
    const largest = variants.at(-1);
    images.push({ listingId: item.listingId, status: 'approved', src: largest.webp,
      alt: item.alt, width: largest.width, height: largest.height,
      sourceUrl: item.sourceUrl, sourcePage: item.sourcePage, credit: 'Teton Flats',
      rightsBasis: item.rightsBasis, checkedAt: item.checkedAt, variants });
  }
}));
images.sort((a, b) => a.listingId.localeCompare(b.listingId));
await writeFile('public/data/listing-images.json', JSON.stringify({ images }, null, 2) + '\n');
const allVariants = images.flatMap(item => item.variants);
const total = allVariants.reduce((sum, item) => sum + item.avifBytes + item.webpBytes, 0);
console.log(`Prepared ${images.length} approved listing images, ${allVariants.length * 2} responsive files, ${(total / 1048576).toFixed(2)} MB total.`);
