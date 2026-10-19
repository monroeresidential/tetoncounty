# Live here preview

`/live/` features Teton Flats with an interactive rent comparison. It is released to the private `dev` environment first. Keep it out of the production sitemap and keep its noindex tag while rent evidence is incomplete. Production deployment requires the normal reviewed merge to `main`.

## Current data

`data/rental-market.json` is a validated **undated draft** imported from the supplied `teton_flats_vs_market.csv`. The source does not include observation timestamps, primary listing URLs, lease terms, or competitors’ fee schedules. Its import timestamp is provenance, never an “as of” date. No daily scraper or schedule is connected yet.

The page uses the source's supplied medians and sample counts. Group A (apartment communities) and group B (all current direct, as named in the file) stay separate. They overlap and must not be summed. Only `1x1` and `2x2` town-level rows are used; `2BR (all)`, all-town aggregates, and group C stale snippets are excluded. Missing Driggs community `2x2` data remains missing. Example property/price strings are incomplete illustrations, not unit-level data from which to recalculate medians or infer availability.

Teton Flats is visibly disclosed as the sponsor. Price differences use base rent on both sides; the supplied $216.50 CAM is shown separately. Base plus CAM is not labeled all-in. Unknown competitor charges are not treated as zero. Higher sponsor rents must be displayed honestly if a future snapshot changes the comparison.

## Updating a draft snapshot

```sh
npm run rents:import -- /absolute/path/to/updated-market.csv
npm run check:dev
```

The importer rejects missing prices, conflicting sponsor data, duplicate summaries, invalid ranges, and invalid sample counts before replacing the JSON. Review the data diff, commit to `dev`, and Cloudflare rebuilds the preview. Reimporting the same data does not establish freshness. Do not manually convert a draft to current; the validator rejects that change.

## Daily collection next

Have Grok (or another collector) produce unit-level observations with property ID, unit/plan ID, town, beds, baths, square feet, base rent, mandatory recurring fees with unknown values preserved, concessions, lease term, availability, primary source URL, observation timestamp, and evidence. Prefer the Teton Flats leasing feed already used by its availability page. Dedupe by property + unit + lease term; do not merge advertised floor-plan ranges with unit quotes.

Collect into a private review queue with a dedicated service identity; never give a bot production publishing credentials. Validate schema, source hostnames, freshness, duplicate identities, and unusual price changes. A reviewer approves a dated snapshot; a scheduled build can then publish it. Failed refreshes preserve the last reviewed data with its original timestamp, mark it stale, and never advance the date or imply fresh availability. Define the fee coverage and lease-term normalization before adding total-cost or annual-savings claims.

## Sources and photographs

Apartment features and layouts were reviewed on October 18, 2026 from https://tetonflats.com/ and https://tetonflats.com/floorplans. Availability and tour buttons route to the official leasing site; no new lead form or submission is created here. Referral links identify development traffic separately.

The user authorized reuse of Teton Flats photography:

- `src/assets/photos/teton-flats-exterior.webp`: https://tetonflats.com/images/hero/teton-flats-exterior.jpg
- `src/assets/photos/teton-flats-interior.webp`: https://tetonflats.com/images/gallery/unit-1br-7.jpg

These are real building/model photos, locally optimized and emitted by Astro as responsive AVIF/WebP. Model furnishings do not imply furnished leases.
