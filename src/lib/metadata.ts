import type { Listing } from './listing-schema.ts';

// Keep full source names in the H1 and directory; use concise labels in search and shares.
const searchNames: Record<string, string> = {
    'big-springs-national-recreation-water-trail-float-to-mack-s-inn': "Big Springs Float to Mack's Inn — Island Park",
    'birding-the-teton-river-idaho-birding-trail-teton-valley-subloop': 'Birding the Teton River',
};

export function listingTitle(item: Listing): string {
    const name = searchNames[item.id] ?? item.name;
    // "Nearby" is a directory filter, not a useful location in a search result.
    const showTown = item.town !== 'Nearby' && !name.toLowerCase().includes(item.town.toLowerCase());
    return showTown ? `${name} — ${item.town}` : name;
}

export function listingDescription(item: Listing): string {
    // Imported summaries sometimes describe only a category and town. Include the
    // place identity without inventing services, hours, ratings, or other details.
    const summary = item.description.trim();
    return summary.toLowerCase().includes(item.name.toLowerCase()) ? summary : `${item.name}: ${summary}`;
}
