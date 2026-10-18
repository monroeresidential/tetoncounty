import { defineCollection } from 'astro:content';
import { loadListings } from './data.ts';
import { listingSchema } from './lib/listing-schema.ts';
const places = defineCollection({
    loader: async () => loadListings(),
    schema: listingSchema,
});
export const collections = { places };
