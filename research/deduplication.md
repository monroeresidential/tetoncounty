# Cross-source identity review

Reviewed `data/tetonflats.json` (225 records) and `data/directory.json` (271 records) on 2026-10-18. This review uses the already-scraped factual records and their source links; it does not claim new operator verification.

`data/aliases.json` maps alternate record IDs and name slugs to a canonical ID that exists in `data/directory.json`. The loader should resolve **both** an alias and its target to that canonical ID, preserve all source URLs and useful tags, and preserve the richer descriptive/image fields. Do not make automatic same-domain merges: a resort's restaurants, trails, events and lodging may legitimately share a host. All mappings are one hop with no cycles.

The review found **25 additional clear identity groups** beyond exact-name matching, plus spelling-only ID variants for already matched names. Exact-name/ID overlap remains suitable for the existing loader. Grand Teton Brewing already has the same name and ID in both input files; no extra alias is needed.

## Additional identity groups

| Teton Flats listing | Canonical directory listing | Evidence |
|---|---|---|
| Knotty Pine Supper Club | Knotty Pine | Same official domain and 58 S Main address. |
| Victor Valley Market & Cafe | Victor Valley Market | Same named market and 5 S Main address; cafe/deli is part of the market. |
| King Sushi Driggs | King Sushi | Same official domain and 98 E Little address; directory record is explicitly Driggs. |
| The Royal Wolf | Royal Wolf | Same official domain and 63 Depot address. |
| O'Rourke's Sports Bar and Grill | O'Rourke's Bar and Grille | Same named Driggs bar and 42 E Little address. |
| Maison | Maison Bottles & Bites | Same official domain and 85 E Little address. |
| Big Hole Bagels and Bistro | Big Hole Bagel & Bistro | Same Facebook business page and 285 N Main address. |
| Wydaho Roasters | Wydaho Roasters Coffee House | Same official domain; street-number conflict needs resolution (see below). |
| La Conchita Restaurant & Bakery | La Conchita Bakery | Same named Driggs bakery/restaurant and 285 E Little address. |
| Lula Wine Bar & Bistro | Lula Wine Bar | Same official domain; source street addresses conflict (see below). |
| El Valle Restaurante (Valle del Sol) | El Valle del Sol Restaurant | Explicit alternate name in the Teton Flats record; same 220 N Main address. |
| Monte Sinai Mexican Market | Monte Sinai | Same named Victor market and 149 S Main address. |
| Pinky G's Pizzeria | Pinky G's Pizza | Same official domain and 37 S Main location. |
| The Bronze Buffalo Grille | The Grille at Bronze Buffalo Ranch | Identical official dining URL and same ranch restaurant. |
| Barrels & Bins Community Market | Barrels & Bins Natural Market | Same official domain and 36 S Main address. |
| Broulim's Driggs | Broulim's Fresh Foods | Same official chain domain and Driggs store identity; earlier address conflict remains unresolved. |
| The Tetonia Club | Tetonia Club | Same named Tetonia bar and 6266 S Main address. |
| Yostmark Mountain Equipment | Yostmark | Same official domain; directory short name and full retailer name. |
| Habitat / High Altitude Provisions | Habitat | Same ridethetetons.com website; short and full retailer name. |
| Wai Mauna Teton River SUP (Paddleboard Driggs) | Wai Mauna Paddleboard Rentals | Same paddleboarddriggs.com business website and activity. |
| Teton Aviation Center Scenic Flights | Teton Aviation Center | Same operator website; both records specifically describe scenic flights. |
| Teton Valley Welcome Center (Teton Geo Center) | Teton Geo Center | Teton Flats explicitly names Teton Geo Center as the alternate name; same downtown visitor-center role. |
| Valley of the Tetons Library & Makerspace | Valley of the Tetons Library | Both descriptions refer to the multi-branch library system; its individual Makerspace remains separately listed. |
| The Local Galleria | Local Galleria | Same official website; only leading article differs. |
| Teton Valley Rodeo (Friday Night Rodeo) | Teton Valley Rodeo | Same official rodeo website and Driggs fairgrounds activity. |

## Address concerns when merging

Merging identities is not permission to select a conflicting address arbitrarily. Suppress a disputed address until checked with the operator, or retain it privately with source-level provenance. In particular, first-source-wins can reintroduce addresses deliberately omitted from `directory.json`.

- **Wydaho Roasters:** Teton Flats has **495 S Main Street**; Discover and Downtown Driggs have **465 S Main Street**. Same official website confirms identity, not the current street number.
- **Pearl Street Bagels:** Teton Flats has **80 W Main Street**; Downtown Driggs has **80 N Main Street**. Names match, but the direction differs.
- **AmeriAsia Bistro:** Teton Flats has **185 W Center Street**; Discover has malformed **185 West E Center Street**. Use direct operator confirmation for address cleanup.
- **Broulim's Driggs:** Teton Flats and Discover say **240 S Main Street**; Downtown Driggs lists **180 ID-33**. The directory record deliberately has no address; do not silently regard the Teton Flats address as resolution.
- **Lula Wine Bar:** Teton Flats has **75 W Little Avenue, Suite 103**; Downtown Driggs has **75 W Bates Road, Suite F**. Same official website supports one business identity, but the street is unresolved.
- **Bronze Buffalo Grille:** Teton Flats has **5 Headwaters Drive**; Discover has **10 Headwaters Drive**. The official dining URL is identical; confirm the visitor entrance/address.
- **Get Baked:** Teton Flats provides **37 N Main Street**, while one Discover entry lacks the direction. This is likely incomplete source formatting, but the directory had suppressed it conservatively.
- **Moose Creek Ranch:** the directory suppressed **2735 E 10800 S** versus **2733 E 10800 S**. The Teton Flats record has no address, so retain the omission.
- **Teton Valley Resort:** the directory suppressed an incomplete highway description versus **1208 ID-31**. The Teton Flats record has no address, so retain the omission pending confirmation.
- Additional internal directory address conflicts remain in `research/directory.md` and are not resolved by these aliases.

## Intentionally separate

- Alpine Air Cafe & Roastery and Alpine Air Coffee Hut Drive Thru share a brand/domain but have different street addresses.
- Grand Targhee Resort, its lodging, restaurants, Nordic trails, bike park, disc golf and other specific activities remain separate discoverable offerings.
- Corner Drug Soda Fountain and Corner Drug pharmacy remain separate experiences/categories at the same address; their relationship can be modeled as `containedInPlace` later.
- Tributary's golf experience and its residential real-estate listing remain separate uses.
- Valley of the Tetons Library is the system; the Driggs Makerspace is a specific facility.
- Reunion Flat Group Campground versus Reunion Flat Campground needs confirmation of booking-unit boundaries before merging. Similar names alone are insufficient.
- Table Mountain routes, Moose Creek route variants, Grove/Drake routes, Sherman Park trails versus park, and Teton Canyon activity versus campground remain separate. No hiking routes were aliased by name similarity.
- Linn Canyon Ranch and its winter sleigh-dinner activity, and Moose Creek Ranch and its trail rides, remain separate experiences.

## Validation

All alias targets exist, no self-mappings or cycles are present, and all 25 manually reviewed identities have source evidence in the paired input records. No original source data or application code was changed by this review.
