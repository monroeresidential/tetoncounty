import { z } from 'astro/zod';
import { seasons, towns } from '../config.ts';
const publicUrl = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL');
export const listingSchema = z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1),
    town: z.enum(towns),
    category: z.enum(['outdoors', 'food-drink', 'arts-culture', 'shopping', 'wellness', 'stays', 'services']),
    subcategory: z.string(),
    description: z.string().min(1).max(600),
    note: z.string().max(120).optional(),
    sourceUrls: z.array(publicUrl).min(1),
    sourceCheckedAt: z.iso.date(),
    sourceStatus: z.literal('source-listed'),
    seasons: z.array(z.enum(seasons)),
    tags: z.array(z.string()),
    address: z.string().optional(),
    addressStatus: z.literal('source-conflict').optional(),
    website: publicUrl.optional(),
    latitude: z.number().min(40).max(46).optional(),
    longitude: z.number().min(-115).max(-108).optional(),
    trail: z.object({
        distanceMiles: z.number().nonnegative().optional(),
        difficulty: z.string().optional(),
        elevationFeet: z.number().nonnegative().optional(),
        routeType: z.string().optional(),
        distanceLabel: z.string().optional(),
    }).optional(),
    slug: z.string().optional(),
    imagePath: z.string().optional(),
    imageUrl: publicUrl.optional(),
    metricsSource: z.string().optional(),
    coordinateRole: z.string().optional(),
    accessNote: z.string().optional(),
    locationLabel: z.string().optional(),
}).refine(item => (item.latitude === undefined) === (item.longitude === undefined), 'Coordinates must include both latitude and longitude');
export type Listing = z.infer<typeof listingSchema>;
