import { getCollection } from 'astro:content';
import type { Listing } from './listing-schema.ts';
import { categories } from '../config.ts';
export async function getListings(): Promise<Listing[]> {
    return (await getCollection('places')).map(entry => entry.data).sort((a, b) => a.name.localeCompare(b.name));
}
export const category = (id: string) => categories.find(item => item.id === id) ?? categories[0];
export const tag = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
export function imageFor(item: Listing): string {
    const name = item.name.toLowerCase();
    if (name.includes('grand teton brewing'))
        return '/images/brewery.webp';
    if (name.includes('butter caf'))
        return '/images/cafe.webp';
    if (name.includes('balloon rally'))
        return '/images/balloons.webp';
    if (name.includes('grand targhee'))
        return '/images/ski.webp';
    if (name.includes('music on main'))
        return '/images/music.webp';
    if (name.includes('aspen trail'))
        return '/images/trail.webp';
    return '';
}
