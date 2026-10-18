import { getCollection } from 'astro:content';
import type { Listing } from './listing-schema.ts';
import { categories } from '../config.ts';
import { listingImageFor } from './listing-images.ts';
export async function getListings(): Promise<Listing[]> {
    return (await getCollection('places')).map(entry => entry.data).sort((a, b) => a.name.localeCompare(b.name));
}
export const category = (id: string) => categories.find(item => item.id === id) ?? categories[0];
export const tag = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
export function imageFor(item: Listing): string {
    return listingImageFor(item.id)?.src ?? '';
}
