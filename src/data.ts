import type { Listing } from './lib/listing-schema.ts';
import { readFile } from 'node:fs/promises';
import { categories, towns, seasons } from './config.ts';
import { applyOverrides, type Overrides } from './lib/overrides.ts';
export const slugify = (s: string) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const identity = (s: string) => slugify(s).replace(/-(llc|inc|idaho|driggs|victor)$/, '').replace(/-and-/g, '-').replace(/s-/g, '-');
async function readOverrides(): Promise<Overrides> {
    try {
        return JSON.parse(await readFile(new URL('../data/overrides.json', import.meta.url), 'utf8'));
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            throw error;
        return { listings: {}, removed: {} };
    }
}
export async function loadListings() {
    return (await loadDirectory()).listings;
}
export async function loadRemovedRedirects() {
    return (await loadDirectory()).removed;
}
async function loadDirectory() {
    let aliases: Record<string, string> = {};
    try {
        aliases = JSON.parse(await readFile(new URL('../data/aliases.json', import.meta.url), 'utf8'));
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            throw error;
    }
    const records: Listing[] = [];
    for (const file of ['tetonflats', 'directory', 'curated']) {
        try {
            records.push(...JSON.parse(await readFile(new URL(`../data/${file}.json`, import.meta.url), 'utf8')));
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
        }
    }
    const merged = new Map<string, Listing>();
    for (const item of records) {
        if (!item.name || !categories.some(c => c.id === item.category))
            throw new Error(`Invalid listing: ${item.name}`);
        const canonicalId = aliases[slugify(item.id)] || aliases[slugify(item.name)] || slugify(item.id || item.name);
        const key = identity(canonicalId);
        const old = merged.get(key);
        if (old) {
            old.sourceUrls = [...new Set([...old.sourceUrls, ...(item.sourceUrls || [])])];
            old.tags = [...new Set([...old.tags, ...(item.tags || [])])];
            for (const field of ['address', 'website', 'latitude', 'longitude', 'trail', 'imagePath'] as const)
                if (old[field] == null && item[field] != null)
                    Object.assign(old, { [field]: item[field] });
            if (old.description.length < 60 && item.description?.length > old.description.length)
                old.description = item.description;
            continue;
        }
        merged.set(key, { ...item, id: canonicalId, town: towns.includes(item.town) ? item.town : 'Nearby', seasons: (item.seasons || seasons).filter(s => seasons.includes(s)), tags: item.tags || [], sourceUrls: item.sourceUrls || [], sourceStatus: 'source-listed' });
    }
    const { listings, removed } = applyOverrides([...merged.values()], await readOverrides());
    const used = new Set();
    return { removed, listings: listings.map(item => {
        // Keep disputed street details out of the public guide until operator review.
        if (/wydaho-roasters|pearl-street-bagels|ameriasia|broulim|lula-wine|bronze-buffalo|(?:^|-)get-baked(?:-|$)|fireweed|yoga-source|barefoot-fitness|mountain-home-treasures|teton-river-supply|kasper|moose-creek-ranch|teton-teepee|teton-valley-resort|heron-glass|peak-printing|teton-technology/.test(item.id)) {
            delete item.address;
            item.addressStatus = 'source-conflict';
        }
        if (used.has(item.id))
            item.id += '-' + slugify(item.town);
        if (used.has(item.id))
            throw new Error(`Duplicate listing ID: ${item.id}`);
        used.add(item.id);
        return item;
    }).sort((a, b) => a.name.localeCompare(b.name)) };
}
