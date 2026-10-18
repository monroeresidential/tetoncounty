# Source-listed directory inventory

Checked 2026-10-18. Imported 339 source rows and normalized them to **271 listings**. This is a broad starting inventory, not a claim to include every operating business or attraction in the valley.

## Sources and extraction

- [eat: 49 rows](https://discovertetonvalley.com/eat) — [public Gatsby query JSON](https://discovertetonvalley.com/page-data/sq/d/2339799868.json)
- [play: 26 rows](https://discovertetonvalley.com/play) — [public Gatsby query JSON](https://discovertetonvalley.com/page-data/sq/d/1488910771.json)
- [stay: 30 rows](https://discovertetonvalley.com/stay) — [public Gatsby query JSON](https://discovertetonvalley.com/page-data/sq/d/1350336890.json)
- [live: 117 rows](https://discovertetonvalley.com/live) — [public Gatsby query JSON](https://discovertetonvalley.com/page-data/sq/d/1463826432.json)
- [driggs: 117 rows](https://downtowndriggs.org/maps-resources) — [public Gatsby query JSON](https://downtowndriggs.org/page-data/sq/d/1782297952.json)

The source pages render their directories in JavaScript. The importer reads the same publicly delivered Gatsby page-data and static-query JSON used by those pages. It does not use credentials, private APIs, or bypass access restrictions. Names, towns, categories, addresses and supplied business links are factual directory fields. Descriptions are short original summaries or category-based descriptions, not copied marketing paragraphs. Source photographs are not imported.

## Coverage

### By town

- Driggs: 179
- Nearby: 12
- Teton Valley: 20
- Victor: 60

Alta, Wyoming; Jackson; and Idaho Falls are labeled Nearby. Tetonia and records lacking a confirmed street location are grouped under Teton Valley. A mailing address is not presented as a visitor destination.

### By category

- arts-culture: 14
- food-drink: 57
- outdoors: 17
- services: 93
- shopping: 31
- stays: 28
- wellness: 31

## Verification limits

- sourceCheckedAt records when the directory source was read, **not** an owner verification or confirmation that a business is open. Website links are the URLs supplied by the directory, normalized for safe HTTP/HTTPS syntax; individual destinations were not all independently checked.
- Sources can contain closures, renamed businesses, old URLs and stale addresses. Confirm high-traffic listings with the operator before public launch, then add an owner-verification workflow. No opening hours, prices, upcoming event dates, or coordinates are inferred.
- Seasonal tags support discovery; they do not guarantee operating dates or conditions. Campgrounds, golf, river activities, festivals and snow activities need direct operator or land-manager checks.
- The Teton Yoga Festival source includes an undated September 8–10 schedule; the imported listing omits those dates and explicitly asks readers to confirm the next edition. No historical event has been presented as an upcoming event.
- Discover's Stay query includes Westwell Media and Yellowstone Teton Territory; these are classified as services rather than lodging. Duplicate Peaked Sports, Pierre's Theatre, Get Baked, food pantry and technology-service records were merged. Alternate names were merged conservatively. Grand Targhee's activity listing and lodging offering remain distinct records because they represent different directory uses.
- No coordinates are imported from map URL centers: those may be the map viewport, not the actual destination.
- This file covers the two assigned directory sources. Teton Flats trail-map extraction is tracked separately.

## Address conflicts requiring review

Conflicting street addresses are omitted from the public record until confirmed. Formatting-only differences are normalized.

- **Broulim's Fresh Foods**: 240 S Main Street / 180 ID-33
- **Get Baked Prepared Food Emporium**: 37 Main Street / 37 N Main Street / 37 N Main St Driggs, ID
- **Barefoot Fitness & Pilates**: 53 Depot Rd / 53 Depot St, Driggs, ID 83422
- **Mountain Home Treasures**: 275 E Little Ave. / 47 South Main Street
- **Teton River Supply**: Corner of E. Howard and N. Main, Driggs / Corner of N. Main St. and, E Howard Ave, Driggs, ID 83422
- **Kasper's Kountryside Inn**: South 1000 West / 9165 S 1000 W Victor, ID 83455
- **Moose Creek Ranch**: 2735 E 10800 S / 2733 E 10800 S Victor, ID
- **Teton Teepee Lodge**: 440 W Alta Ski Hill Rd / 440 Ski Hill Rd Alta, WY
- **Teton Valley Resort**: West State Highway 31 / 1208 ID-31 Victor, ID
- **Fireweed Shop & Studios**: 85 S Main Street #1 / 160 East Little Avenue
- **Heron Glass & Studio**: 246 N 5th E / 246 N 5th Street E Furthest Back Building Driggs, ID 83422
- **Peak Printing**: 76 S 1st E / 76 South 1st St E
- **Teton Technology Solutions**: 74 N Main St / 4 N Main St
- **The Yoga Source**: 89 North Main Street / 105 Depot Street Driggs, ID. 83422

## URL normalization and omissions

- Dave's Pubb: omitted malformed source URL https://http//:www.davestetonia.com.
- Domino's Pizza: normalized supplied URL www.dominospizza.com to https://www.dominospizza.com.
- Get Baked Prepared Food Emporium: normalized supplied URL getbakedemporium.com to https://getbakedemporium.com.
- Guidepost Brewing Company: normalized supplied URL www.guidepostbrewing.com to https://www.guidepostbrewing.com.
- King Sushi: normalized supplied URL www.kingsushijh.com to https://www.kingsushijh.com.
- Maison Bottles & Bites: normalized supplied URL www.maisondriggs.com to https://www.maisondriggs.com.
- Pinky G's Pizza: normalized supplied URL www.pinkygs.com to https://www.pinkygs.com.
- Provisions Local Kitchen: normalized supplied URL www.provisionskitchen.net to https://www.provisionskitchen.net.
- Royal Wolf: normalized supplied URL www.theroyalwolf.com to https://www.theroyalwolf.com.
- Tatanka Tavern: normalized supplied URL www.tatankatavern.com to https://www.tatankatavern.com.
- The Brakeman American Grill: normalized supplied URL www.brakemangrill.com to https://www.brakemangrill.com.
- Three Peaks Restaurant and Catering: normalized supplied URL www.threepeaksdinnertable.com to https://www.threepeaksdinnertable.com.
- Targhee Village Golf Course: normalized supplied URL https://https:/https://www.targheegolf.com/ to https://www.targheegolf.com/.
- Cobblestone Hotel & Suites: normalized supplied URL https://https://www.staycobblestone.com/id/victor/ to https://www.staycobblestone.com/id/victor/.
- Cirque Online: normalized supplied URL www.cirque.online to https://www.cirque.online.
- Das Optics: normalized supplied URL dasoptics.net to https://dasoptics.net.
- Food For Good by CRCTV: normalized supplied URL https://https://crctv.org/food-resources/what-is-food-for-good/ to https://crctv.org/food-resources/what-is-food-for-good/.
- Fuze-av LLC: normalized supplied URL fuze-av.co to https://fuze-av.co.
- Second Home Sidekick: normalized supplied URL www.secondhomesidekick.com to https://www.secondhomesidekick.com.
- GrandView Blind & Design: normalized supplied URL www.grandviewblindanddesign.com to https://www.grandviewblindanddesign.com.
- Pine Needle Embroidery: normalized supplied URL https:///https://www.pineneedleembroidering.com/ to https://www.pineneedleembroidering.com/.
- Figgie's Deli & Market: normalized supplied URL www.figgiesdeli.com to https://www.figgiesdeli.com.
- Lula Wine Bar: normalized supplied URL lulawinebar.com to https://lulawinebar.com.

## Refresh

Run `node scripts/import-directory.mjs` to retrieve current public query data. Review the diff and correction queue before publishing; source records are not treated as automatically verified. The recorded source-check date must be updated to the actual review date when refreshing. For reproducing this import from temporary source snapshots: `node scripts/import-directory.mjs --cache-dir /tmp`.
