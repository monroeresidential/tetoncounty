# Teton Flats source inventory

Source checked: October 18, 2026. Output: `data/tetonflats.json`.

The public Teton Flats site contains structured, browser-delivered activity, dining, and hiking datasets. I fetched the rendered guide pages and their linked data bundles, parsed the literal data without executing remote JavaScript, and wrote short original descriptions. The resulting directory has **225 reconciled records**, including **all 31 points in the hiking map**. This is a substantial starting inventory, not a claim that every local business or activity has been identified or is currently operating.

## Source pages

- [Victor hiking guide and interactive map](https://tetonflats.com/victor-id-hiking-guide): 31 hiking records, including coordinates and source-reported route metrics.
- [Things to do in Victor](https://tetonflats.com/things-to-do-victor-idaho) and [things to do in Driggs](https://tetonflats.com/things-to-do-driggs-idaho): a shared bundle with 151 activity records.
- [Victor restaurants](https://tetonflats.com/victor-idaho-restaurants) and [Driggs restaurants](https://tetonflats.com/driggs-idaho-restaurants): a shared bundle with 70 dining records.

The public bundles observed during this extraction were [trails-Cx0a_7jD.js](https://tetonflats.com/assets/trails-Cx0a_7jD.js), [activities-Bjleg3Rl.js](https://tetonflats.com/assets/activities-Bjleg3Rl.js), and [restaurants-CPl9bVB8.js](https://tetonflats.com/assets/restaurants-CPl9bVB8.js). Their hashes will change with future source deployments; rediscover them from the public pages instead of treating these asset paths as permanent APIs.

## Coverage

| Area | Records |
| --- | ---: |
| Victor | 54 |
| Driggs | 64 |
| Teton Valley | 27 |
| Nearby destinations | 80 |
| Total | 225 |

| Category | Records |
| --- | ---: |
| Outdoors | 122 |
| Food and drink | 68 |
| Arts and culture | 14 |
| Stays and camping | 9 |
| Shopping | 6 |
| Wellness | 6 |

The 252 original records became 225 after merging 27 duplicate representations. Examples include the two Victor Valley Market entries; businesses appearing in both dining and activity guides; the same Snowscapes festival listed twice; repeated Grand Targhee Nordic activities; and several trails shared by the hiking and activities guides. Distinct routes and separately bookable experiences remain separate. For example, Table Mountain's Face Trail, Face/North Teton loop, and North Teton approach are distinct records. The valley totals include Tetonia-area listings; Alta, Jackson, Island Park, Swan Valley, and other regional trips are labeled Nearby.

## Data meaning and publishing limits

- Every record has `sourceStatus: "source-listed"`. This means the source listed it on the checked date. It does not mean the operator confirmed the entry, a phone call was made, or hours, pricing, operating status, website ownership, or bookings were independently verified.
- `website` is the exact outbound URL provided by Teton Flats. Some entries point to a social profile, Google Maps, AllTrails, an agency page, or another guide instead of a business's own domain. Do not label all these links “official website.”
- `sourceUrls` provides the readable guide page(s). `sourceCheckedAt` is the extraction date, not the date of the source's own fact checking.
- `imagePath` and `imageUrl` record public source assets for reference. The dataset does not make a rights or licensing claim for those images. Descriptions were rewritten, and source ratings, reviews, promotional superlatives, precise opening hours, dated festival schedules, and prices were deliberately excluded.
- Seasons are broad discovery filters derived from source activity seasons and editorial classification. They are not opening dates, safe-travel advice, or a guarantee of access. Dining venues generally use all four filters unless the source specifically describes a seasonal stand or market.
- Town labels group places for browsing; a nearby trail labeled Victor may start outside city limits. `locationLabel` retains the source's more precise regional wording for activity entries.

## Hiking map details

All 31 trail points retain the latitude and longitude supplied by the source map. `coordinateRole: "source-map-point"` makes clear these have not been independently checked as parking lots, legal access points, or exact trailhead locations. No restaurant coordinates were inferred or geocoded.

Route distances and elevation gains come from the source's hiking bundle. Missing elevation gains remain absent. `trail.distanceLabel` preserves qualifiers such as “4.4 mi one-way” and “~1 mi”; the numeric `distanceMiles` field alone must not be presented as a universal round-trip distance. `routeType` is included only when the source explicitly describes a one-way route or names a loop. These measures can differ from an operator or land manager's preferred itinerary.

Useful access notes are retained without asserting present conditions:

- Teton Creek Corridor: the source reports a December 1–May 1 wildlife closure. Verify with the managing organization before presenting current access.
- Spud Drive-In: the source describes a rebuilding project after damage to the screen. The listing describes the landmark and does not promise movie screenings.
- Upper Mesa Falls: the source reports renovation-related access disruption in 2026. Visitors should consult current Forest Service notices.
- Tributary: private club access is limited to members and guests.

The source sometimes supplies different distances for the same general mountain destination because it describes different routes. The import preserves the hiking-map itinerary instead of combining incompatible measurements. Alpine routes are discovery content, not navigation instructions or assertions that a route is currently safe or open.

## Follow-up inventory work

Cross-check business operating status and outbound links with owners or primary websites, then reconcile with Downtown Driggs resources and other local organizations. Give owners a way to submit corrections. Expand accommodations, independent retail, services, accessibility details, and clearly scoped recurring events. A complete market inventory needs ongoing maintenance beyond this source snapshot.

## Refresh helper and validation

`scripts/import-tetonflats.mjs` rediscovers the current public bundle paths from the Teton Flats homepage, parses static literals without executing remote code, and writes a candidate snapshot to stdout. It intentionally leaves the curated dataset untouched so aliases, original descriptions, and review notes are preserved until an editor reconciles changes. It omits source marketing prose and ratings from the candidate output.

```sh
node scripts/import-tetonflats.mjs > /tmp/tetonflats-candidates.json
```

The parser was checked against the downloaded bundles with `--from-dir /tmp`: 31 trails, 151 activities, and 70 restaurants. The curated output passed JSON parsing, allowed town/category checks, description-length checks, unique-ID checks (225/225), and coordinate checks for every hiking-map point (31/31).
