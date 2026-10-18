# Product plan: TetonCounty.us

## Purpose and positioning

Build the most useful, fast, source-linked guide for discovering things to do and local life in Victor and Driggs. Support natural language searches for both “Victor Idaho” and “Victor ID” through readable page titles and copy; avoid duplicate keyword pages. Make the guide useful on its own, with Teton Flats visibly credited as the sponsor.

Visual direction: a mountain field guide, warm paper colors, deep green, restrained orange, generous typography, real regional photography, and simple navigation. Keep essential content in HTML and load optional features only when requested.

## Phase 1 — implemented and deployed

1. **Inventory:** extract facts from Discover Teton Valley, Downtown Driggs, and Teton Flats, including its hiking, dining, and activity data. Maintain original short descriptions, source URLs, check dates, and review status. Merge clear identities with explicit aliases; preserve separate trail variants and distinct experiences.
2. **Discovery:** searchable directory with town, category, and season filters; dedicated town/category pages; individual listing URLs; source-based trail details and interactive map.
3. **Community updates:** addition, correction, and contact forms. Save submissions privately, validate at the server, and require moderation before publication.
4. **Search and AI access:** real HTML at every URL, stable canonicals, breadcrumbs and Place/ItemList schema, sitemap, robots.txt, JSON inventory, and LLM reading files. These improve accessibility to crawlers; they do not guarantee rankings or AI inclusion.
5. **Hosting:** GitHub repository and checks; static assets on Cloudflare Workers with a small Worker API and D1 for requests.

Initial scope: 426 records, including 31 trail points. Categories cover outdoors, food and drink, arts and culture, shopping, wellness, stays, and practical local services. Nearby trips are clearly separated from Victor and Driggs.

## Phase 2 — launch and close coverage gaps

- GitHub source, the Cloudflare Worker, D1, Turnstile, and the `tetoncounty.us` domain binding are configured. A canonical redirect from `www` can be added if desired.
- Verify high-traffic businesses directly with operators. Resolve conflicting addresses, confirm current business names, identify closures, and establish permission/ownership for sponsor photography.
- Audit category-by-town coverage against the two public regional directories. Record unlisted candidates rather than silently dropping them. Add directly submitted businesses after review.
- Confirm map coordinates, distinguish trailheads from approximate source map points, and add route lengths with clear one-way/loop/round-trip semantics.
- Add a weekly editorial review habit for new submissions; periodically refresh public source data into candidate files and review changes before replacing curated records.
- Verify mobile usability, accessibility, forms, real Cloudflare headers, and production Core Web Vitals. Connect Search Console if desired; submit the generated sitemap.
- Define a review owner and retention process. Requests are stored in D1 and forwarded to the Formspree inbox for editor notifications. An authenticated review interface can be added later; review status in D1 remains authoritative.

“Everything in the market” is an ongoing coverage objective. Current listings are source-listed, not a completeness or operating-status guarantee. The initial guide deliberately omits unverified opening hours, ticket prices, upcoming event dates, and live trail-condition claims.

## Phase 3 — deeper local utility

- Owner-confirmed updates, visible verification dates, hours and accessibility details.
- Events only from authoritative feeds with actual dates, recurrence, cancellation handling, and Event schema.
- More original town guides and itineraries, links to land managers, seasonal access notes, and better independent photography.
- Additional quality controls: stale-record reports, external-link checks with safe request limits, duplicate suggestions, geocoding review, and change logs.
- Google Analytics (`G-W6SWY98HLR`) measures live guide traffic. Future custom events can answer product questions such as searches with no results and source-link clicks; keep contact details and message text out of analytics.

## Phase 4 — Teton Flats rental leads

- Add genuinely useful relocation content: living in Victor versus Driggs, neighborhood orientation, commuting resources, and apartment-planning guides.
- Introduce clearly labeled sponsor placements and a separate opt-in rental inquiry path to Teton Flats.
- Measure referrals with first-party event names and explicit privacy disclosure. Keep listing-correction emails separate from rental leads and marketing consent.
- Integrate availability and tour requests only after a reliable owner-approved data source exists. Do not copy stale pricing or imply inventory is live when it is not.

## Architecture decision

Astro with strict TypeScript provides reusable pages and components while generating ready-to-read HTML. A content collection validates the curated inventory against a shared schema before building. Small TypeScript enhancements handle search and forms; Leaflet and map tiles load only on demand. Cloudflare serves static pages from its edge. The existing Worker runs for `/api/*` requests and uses D1 for private submissions. No server rendering adapter or React runtime is required. A CMS or isolated React component can be added later as editorial or interaction needs grow, while preserving the data schema and public URLs.

GitHub is the source of truth. `data/` contains curated records. Source importers create candidate exports; they do not automatically overwrite edited content or publish unreviewed submissions.
