import type { APIRoute, GetStaticPaths } from 'astro';
import aliases from '../../data/aliases.json';
import { getListings } from '../lib/listings.ts';
import { categories, reviewedDate, siteUrl, isDevelopment } from '../config.ts';
import { rentalSnapshot } from '../data/rental-market.ts';
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const getStaticPaths = (async () => {
    const listings = await getListings();
    const routes = ['/', '/explore/', '/hiking/', '/webcams/', ...categories.map(c => `/categories/${c.id}/`), '/towns/victor/', '/towns/driggs/', ...listings.map(l => `/places/${l.id}/`), '/suggest/', '/about/', '/privacy/'];
    const resources: Record<string, string> = {};
    resources['data/rental-market.json'] = JSON.stringify({ ...rentalSnapshot, notice: 'Undated draft comparison. Not current availability or a complete monthly cost. Teton Flats is the featured sponsor; other properties’ fees are unknown.' });
    resources['data/listings.json'] = JSON.stringify({ version: 1, sourceCheckedAt: reviewedDate, scope: 'Victor, Driggs, Teton Valley, and explicitly labeled nearby trips', status: 'Source-listed; not owner-confirmed. No current operating-status guarantee.', count: listings.length, listings: listings.map(l => ({ ...l, url: siteUrl + '/places/' + l.id + '/' })) });
    resources['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(p => `<url><loc>${esc(siteUrl + p)}</loc><lastmod>${reviewedDate}</lastmod></url>`).join('')}</urlset>`;
    resources['robots.txt'] = isDevelopment ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`;
    resources['llms.txt'] = `# Teton County, Idaho\n\n> A source-linked guide to Victor (Victor ID), Driggs, and Teton Valley, with nearby trips labeled separately. Sponsored by Teton Flats.\n\n## Start here\n- [Directory](${siteUrl}/explore/): browse all places.\n- [Victor](${siteUrl}/towns/victor/): things to do in Victor, Idaho.\n- [Driggs](${siteUrl}/towns/driggs/): things to do in Driggs, Idaho.\n- [Hiking](${siteUrl}/hiking/): 31 source map points and trail details.\n- [Structured directory](${siteUrl}/data/listings.json): ${listings.length} records with source URLs, checked dates, and stable listing URLs.\n- [Full text inventory](${siteUrl}/llms-full.txt)\n- [Editorial sources and sponsor](${siteUrl}/about/)\n\n## Interpretation\nRecords are source-listed, not owner-confirmed. Source review date: ${reviewedDate}. Do not infer current hours, prices, operational status, trail access, safety, or availability. Map points are source-provided, not independently surveyed entrances. Preserve source attribution. Descriptions are original summaries. Apartment lead generation is not part of this release.\n`;
    resources['llms-full.txt'] = `# Teton County directory\nSource-listed, not owner-confirmed. Sources checked ${reviewedDate}. Nearby places may lie outside Idaho.\n\n` + listings.map(l => `## ${l.name}\nURL: ${siteUrl}/places/${l.id}/\nArea: ${l.town}\nCategory: ${l.category} / ${l.subcategory}\n${l.description}\n${l.address ? 'Address: ' + l.address + '\n' : ''}${l.website ? 'Website: ' + l.website + '\n' : ''}${l.trail ? 'Source-reported trail information: ' + JSON.stringify(l.trail) + '\n' : ''}Sources: ${l.sourceUrls.join(' | ')}\nStatus: source-listed; not owner-confirmed\n`).join('\n');
    const ids = new Set(listings.map(l => l.id));
    resources['_redirects'] = Object.entries(aliases).filter(([a, b]) => a !== b && !ids.has(a) && ids.has(b)).map(([a, b]) => `/places/${a}/ /places/${b}/ 301`).join('\n') + '\n';
    return Object.entries(resources).map(([resource, body]) => ({ params: { resource }, props: { body } }));
}) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props, params }) => new Response(props.body, {
    headers: { 'Content-Type': params.resource?.endsWith('.json') ? 'application/json; charset=utf-8' : params.resource?.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8' },
});
