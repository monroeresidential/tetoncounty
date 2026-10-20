import type { Listing } from './listing-schema.ts';
type Decision = { reason: string; decidedAt: string };
export type ListingOverride = Decision & { website?: string | null };
export type Overrides = { listings: Record<string, ListingOverride>; removed: Record<string, Decision & { redirect: string }> };
const overridableFields = ['website'] as const;
const categoryRedirect = /^\/categories\/(outdoors|food-drink|arts-culture|shopping|wellness|stays|services)\/$/;
const checkDecision = (id: string, entry: Decision) => {
    if (typeof entry.reason !== 'string' || !entry.reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.decidedAt))
        throw new Error(`Override for ${id} needs a reason and a decidedAt date`);
};
// Reviewed corrections to imported records; applied after the merge so a source refresh can't undo them.
export function applyOverrides(listings: Listing[], overrides: Overrides): { listings: Listing[]; removed: { id: string; redirect: string }[] } {
    const ids = new Set(listings.map(l => l.id));
    for (const id of [...Object.keys(overrides.listings), ...Object.keys(overrides.removed)])
        if (!ids.has(id))
            throw new Error(`Override for unknown listing: ${id}`);
    const edits = new Map(Object.entries(overrides.listings));
    for (const [id, entry] of edits) {
        checkDecision(id, entry);
        for (const field of Object.keys(entry))
            if (field !== 'reason' && field !== 'decidedAt' && !(overridableFields as readonly string[]).includes(field))
                throw new Error(`Override for ${id} sets unsupported field: ${field}`);
        if (entry.website !== undefined && entry.website !== null && typeof entry.website !== 'string')
            throw new Error(`Override for ${id} has an invalid website`);
    }
    const removed = Object.entries(overrides.removed).map(([id, entry]) => {
        checkDecision(id, entry);
        if (typeof entry.redirect !== 'string' || !categoryRedirect.test(entry.redirect))
            throw new Error(`Override for ${id} must redirect to a category page, not ${entry.redirect}`);
        return { id, redirect: entry.redirect };
    });
    const gone = new Set(removed.map(r => r.id));
    return {
        listings: listings.filter(l => !gone.has(l.id)).map(item => {
            const entry = edits.get(item.id);
            if (!entry)
                return item;
            const next = { ...item };
            for (const field of overridableFields) {
                if (entry[field] === null)
                    delete next[field];
                else if (entry[field] !== undefined)
                    next[field] = entry[field];
            }
            return next;
        }),
        removed,
    };
}
