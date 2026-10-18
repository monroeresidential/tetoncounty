/** Import public Gatsby listing data, with provenance and conservative normalization.
 * Run: node scripts/import-directory.mjs [--cache-dir /tmp]
 * The optional cache reads directory-<section>-<hash>.json downloaded from the URLs below.
 * This imports source-listed records; it does not certify current hours or opening status.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const checkedAt = '2026-10-18';
const sources = [
  ['eat', 'https://discovertetonvalley.com', '/eat', 'allPrismicEatListing'],
  ['play', 'https://discovertetonvalley.com', '/play', 'allPrismicPlayListing'],
  ['stay', 'https://discovertetonvalley.com', '/stay', 'allPrismicStayListing'],
  ['live', 'https://discovertetonvalley.com', '/live', 'allPrismicLiveListing'],
  ['driggs', 'https://downtowndriggs.org', '/maps-resources', 'allPrismicBusinessListings'],
];
const cacheAt = process.argv.indexOf('--cache-dir');
const cacheDir = cacheAt >= 0 ? process.argv[cacheAt + 1] : null;
const cachedHashes = { eat: '2339799868', play: '1488910771', stay: '1350336890', live: '1463826432', driggs: '1782297952' };
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return response.json();
}
async function sourceData([section, origin, path, key]) {
  if (cacheDir) return { data: JSON.parse(await readFile(join(cacheDir, `directory-${section}-${cachedHashes[section]}.json`), 'utf8')), datasetUrl: `${origin}/page-data/sq/d/${cachedHashes[section]}.json` };
  const page = await json(`${origin}/page-data${path}/page-data.json`);
  for (const hash of page.staticQueryHashes) {
    const datasetUrl = `${origin}/page-data/sq/d/${hash}.json`;
    const data = await json(datasetUrl);
    if (data.data?.[key]) return { data, datasetUrl };
  }
  throw new Error(`No listing query found for ${section}; source schema may have changed.`);
}
const clean = value => (value || '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const slug = value => clean(value).toLowerCase().replace(/&/g, ' and ').replace(/['®™]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aliases = new Map(Object.entries({
  'agave-mexian-restaurant': 'Agave Family Mexican Restaurant',
  'broulims-grocery': "Broulim's Fresh Foods",
  'davess-pubb': "Dave's Pubb",
  'get-baked': 'Get Baked Prepared Food Emporium',
  'maison': 'Maison Bottles & Bites',
  'orourkes-sports-bar-and-grill': "O'Rourke's Bar and Grille",
  'provisions': 'Provisions Local Kitchen',
  'the-royal-wolf': 'Royal Wolf',
  'three-peaks-restaurant-and-catering': 'Three Peaks Restaurant and Catering',
  'valle-del-sol': 'El Valle del Sol Restaurant',
  'heron-glass': 'Heron Glass & Studio',
  'mountain-treasures': 'Mountain Home Treasures',
  'three-river-ranch-outfitters-fly-shop': 'TRR Outfitters - Driggs Fly Shop',
  'fuze-av-home-technology-professionals': 'Fuze-av LLC',
  'driggs-health-clinic': 'Teton Valley Health: Driggs Clinic',
  'wai-mauna-sup-tours': 'Wai Mauna Paddleboard Rentals',
  'the-pines-motel': 'Pines Motel-Guest Haus',
  'super-8-driggs': 'Super 8 by Wyndham',
  'teton-west-motel': 'Teton West Hotel',
  'fin-and-feather-inn': 'The Fin and Feather Inn',
  'spitzer-realty-mark-thompson': 'Spitzer Realty',
  'transend-ideas': 'Transcend Ideas',
  'teton-peaks-resort': 'Teton Peaks Resort',
  'cryo-therapy-idaho': 'Cryo Therapy Idaho',
  'summit-self-storage-outdoor-storage-rv-vehicle-trailer-boat': 'Summit Self-Storage: Driggs Outdoor Storage',
}));
function canonicalName(name) {
  name = clean(name);
  if (name.startsWith('Teton Yoga Festival')) name = 'Teton Yoga Festival';
  if (name.startsWith('Farm Bureau Insurance,')) name = 'Farm Bureau Insurance - Matt Anderson';
  if (name.startsWith('Driggs Dreamshare')) name = 'Driggs Dreamshare';
  return aliases.get(slug(name)) || name;
}
const issues = [];
function website(value, name) {
  let url = clean(value);
  if (!url) return undefined;
  const original = url;
  // Repair only repeated protocols or omitted schemes in explicitly supplied domains.
  const lastScheme = url.lastIndexOf('https://');
  if (lastScheme > 0) url = url.slice(lastScheme);
  if (/^www\.|^[a-z0-9-]+\.[a-z]{2,}(?:\/|$)/i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.') || /^(?:https?|www)$/.test(parsed.hostname)) throw new Error('Malformed URL');
    for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|gclid$|gbraid$|gad_source$|CID$|iata$)/i.test(key)) parsed.searchParams.delete(key);
    // General aggregators and homepage-only booking authorities are not business websites.
    if (['www.loc8nearme.com', 'www.bestprosintown.com', 'www.recreation.gov', 'www.fs.usda.gov'].includes(parsed.hostname)) return undefined;
    if (url !== original) issues.push(`${name}: normalized supplied URL ${original} to ${url}.`);
    return parsed.href;
  } catch {
    issues.push(`${name}: omitted malformed source URL ${original}.`);
    return undefined;
  }
}
function location(city, address) {
  const knownCity = clean(city);
  if (knownCity === 'Victor' || knownCity === 'Driggs') return knownCity;
  if (knownCity === 'Tetonia') return 'Teton Valley';
  const value = clean(`${city || ''} ${address || ''}`);
  if (/\bAlta\b|\bWyoming\b|\bJackson\b|\bWilson\b|\bIdaho Falls\b/i.test(value)) return 'Nearby';
  if (/\bVictor\b/i.test(value)) return 'Victor';
  if (/\bDriggs\b/i.test(value)) return 'Driggs';
  return 'Teton Valley';
}
const custom = {
  'agave-family-mexican-restaurant': ['Mexican restaurant', 'Mexican cooking for lunch and dinner in Driggs.'],
  'alpine-air-cafe-and-roastery': ['Coffee & breakfast', 'Coffee, pastries and breakfast burritos on West Center Street in Victor.'],
  'alpine-air-coffee-hut-drive-thru': ['Drive-through coffee', 'Drive-through drinks and breakfast pastries in Victor.'],
  'ameriasia-bistro': ['Asian restaurant', 'Asian dishes and Korean barbecue in Victor.'],
  'badger-creek-cafe': ['Breakfast & lunch', 'A breakfast and lunch cafe in Tetonia.'],
  'bangkok-kitchen': ['Thai restaurant', 'A Thai restaurant on North Main Street in Driggs.'],
  'big-hole-bagel-and-bistro': ['Bagels & breakfast', 'Bagels, sandwiches and coffee in Driggs.'],
  'broulims-fresh-foods': ['Grocery market', 'A grocery store serving Driggs and the surrounding valley.'],
  'butter-cafe': ['Breakfast & lunch', 'A cafe serving morning and midday meals in Victor.'],
  'chiang-mai-thai-kitchen': ['Thai restaurant', 'Northern Thai dishes, beer and wine in Victor.'],
  'citizen-33-brewery': ['Brewery & restaurant', 'Beer brewed in Driggs, with a restaurant on North Main Street.'],
  'dog-west': ['Breakfast burritos', 'Breakfast burritos inside the Mobil convenience store in Victor.'],
  'daves-pubb': ['Bar & live music', 'A Tetonia bar with games and live music.'],
  'dominos-pizza': ['Pizza', 'Pizza pickup and delivery in Driggs.'],
  'dulce-baking-company': ['Bakery', 'A Driggs bakery with gluten-free and other dietary options.'],
  'el-guadalajara-mexican-food': ['Mexican restaurant', 'Mexican meals for breakfast, lunch and dinner in Victor.'],
  'el-valle-del-sol-restaurant': ['Mexican restaurant', 'Mexican food for dine-in or takeout in Driggs.'],
  'food-shed-idaho': ['Specialty food market', 'Specialty ingredients, local foods and edible gifts in Victor.'],
  'forage-bistro-and-lounge': ['Bistro', 'A Driggs bistro serving meals and drinks on Warbird Lane.'],
  'get-baked-prepared-food-emporium': ['Take-and-bake pizza', 'Pizza and prepared meals to finish at home in Driggs.'],
  'grand-teton-brewing': ['Brewery', 'Victor brewery with an on-site taproom.'],
  'grand-teton-distillery': ['Distillery', 'A Driggs producer of vodka and whiskey.'],
  'grand-view-general-store': ['Market & deli', 'A Tetonia convenience store with a deli and fuel.'],
  'guidepost-brewing-company': ['Brewery & restaurant', 'A Victor brewery with food, a bar and community events.'],
  'hacienda-cuajimalpa': ['Mexican restaurant', 'A family-run Mexican restaurant in Driggs.'],
  'highpoint-cider': ['Cidery & taproom', 'A hard-cider taproom in Victor.'],
  'kates-real-food': ['Outdoor food', 'A Jackson-based maker of organic snack bars.'],
  'king-sushi': ['Sushi restaurant', 'A sushi restaurant in Driggs.'],
  'knotty-pine': ['Restaurant & live music', 'A Victor restaurant and bar that hosts live music.'],
  'maison-bottles-and-bites': ['Wine & small plates', 'Wine and small plates in downtown Driggs.'],
  'monte-sinai': ['Mexican market', 'A Victor market selling Mexican ingredients and spices.'],
  'moonshine-liquor-beer-and-wine': ['Bottle shop', 'Beer, wine and spirits retail in Victor.'],
  'orourkes-bar-and-grille': ['Bar & grill', 'A Driggs sports bar serving American meals and drinks.'],
  'pinky-gs-pizza': ['Pizzeria', 'Pizza by the slice or whole pie in Victor.'],
  'pizzeria-alpino': ['Pizza & pasta', 'Pizza and pasta in Driggs.'],
  'provisions-local-kitchen': ['Breakfast & lunch', 'A downtown Driggs kitchen serving breakfast and lunch.'],
  'rise-coffee-house': ['Coffee house', 'Coffee and breakfast on Depot Street in Driggs.'],
  'royal-wolf': ['Bar & grill', 'A Driggs gathering place for food and drinks.'],
  'sergios-cocina-mexicana': ['Mexican restaurant', 'Mexican cooking and drinks in Victor.'],
  'tatanka-tavern': ['Pizza & craft beer', 'Pizza and beer with rooftop seating in Driggs.'],
  'teton-thai': ['Thai restaurant', 'Thai and other Asian dishes in downtown Driggs.'],
  'tetonia-club': ['Bar', 'A Tetonia bar serving beer, wine and spirits.'],
  'the-brakeman-american-grill': ['Burgers & grill', 'Burgers and American grill dishes in Victor.'],
  'the-grille-at-bronze-buffalo-ranch': ['Restaurant', 'Dining at Bronze Buffalo Ranch in the Teton Springs community near Victor.'],
  'three-peaks-restaurant-and-catering': ['Restaurant & catering', 'A Driggs restaurant that also offers catering.'],
  'victor-valley-market': ['Market & deli', 'A grocery market and deli at the center of Victor.'],
  'west-side-yard': ['Restaurant & bar', 'Food and drinks with a summer outdoor dining area in Victor.'],
  'wydaho-roasters-coffee-house': ['Coffee & pastries', 'Coffee drinks and house-made pastries in Driggs.'],
  'artisan-market': ['Artisan market', 'A market for locally made work at Driggs City Center Plaza. Check the organizer for this season’s dates.'],
  'barefoot-fitness-and-pilates': ['Fitness & Pilates', 'Gym access, group fitness and Pilates in Driggs.'],
  'borbay-studios-and-gallery': ['Art gallery', 'An artist studio and gallery in Victor.'],
  'citypass': ['Travel services', 'A Victor-based attraction-pass company. Its passes cover destinations beyond Teton Valley.'],
  'downtown-driggs-association': ['Community events', 'The local organization behind downtown Driggs arts, music and community events.'],
  'foxtrot-gallery': ['Art gallery', 'A fine-art gallery on East Little Avenue in Driggs.'],
  'grand-targhee-resort': ['Mountain resort', 'Skiing, mountain biking and mountain activities at Grand Targhee in Alta, Wyoming.'],
  'mountain-bike-the-tetons': ['Mountain biking', 'A local nonprofit supporting mountain-bike trails and riding resources.'],
  'mountain-high-mounted-shooters': ['Equestrian club', 'A mounted-shooting club listed in the regional directory. Contact the club for event locations.'],
  'mountain-home-treasures': ['Home & gifts', 'A Driggs shop for home furnishings, gifts and souvenirs.'],
  'peaked-sports': ['Outdoor gear & rentals', 'Outdoor equipment, clothing and ski, bicycle and boat rentals in Driggs.'],
  'pierres-theatre': ['Theatre & movies', 'A historic Victor venue for theatre, films and workshops.'],
  'sleigh-rides-at-double-diamond-bar-ranch': ['Horse-drawn rides', 'Carriage and sleigh outings at Double Diamond Bar Ranch in Alta, Wyoming.'],
  'targhee-village-golf-course': ['Golf', 'A golf course near Alta, Wyoming.'],
  'teton-gravity-research': ['Outdoor films', 'A Jackson-area action-sports media company with films and events.'],
  'teton-nordic-ski-school': ['Nordic ski lessons', 'Classic and skate-ski instruction serving the Driggs area.'],
  'teton-river-supply': ['River rentals', 'Raft, kayak and paddleboard rentals with Teton River shuttle options.'],
  'teton-valley-aquatics': ['Swimming', 'A local aquatics organization providing summer swimming opportunities. Check current pool access with the organizer.'],
  'teton-valley-rodeo': ['Rodeo', 'Rodeo events at the Teton County fairgrounds near Driggs. Confirm current event dates with the organizer.'],
  'teton-yoga-festival': ['Yoga festival', 'A yoga gathering listed for Victor. The source contains an undated past schedule; confirm any upcoming edition directly.'],
  'tribe-artist-collective': ['Art & makers', 'An artist collective and shop in Tetonia.'],
  'wai-mauna-paddleboard-rentals': ['Paddleboard rentals', 'Stand-up paddleboard rentals and Teton River shuttle services in Driggs.'],
  'wydaho-rendezvous-teton-bike-festival': ['Bike festival', 'A mountain-bike festival at Grand Targhee in Alta, Wyoming. Check the organizer for the next edition.'],
  'yellowstone-teton-tours': ['Guided tours', 'A regional guide service for Yellowstone and the Tetons.'],
  'westwell-media': ['Video production', 'A Teton Valley video-production business.'],
  'yellowstone-teton-territory': ['Regional visitor information', 'Regional visitor information covering eastern Idaho.'],
  'teton-valley-trails-and-pathways': ['Trails & pathways', 'A local nonprofit with trail maps, pathway information and Nordic grooming reports.'],
  'teton-valley-ski-education-foundation': ['Ski & snowboard programs', 'Local youth ski and snowboard programs.'],
  'summit-school-of-the-arts': ['Dance classes', 'Dance instruction for a range of ages and skill levels in Driggs.'],
  'valley-voices': ['Storytelling', 'Community storytelling events in Teton Valley.'],
  'valley-of-the-tetons-library': ['Library', 'Public library services and community programming in Driggs, Victor and Tetonia.'],
  'makerspace': ['Makerspace', 'Hands-on creative resources through Valley of the Tetons Library in Driggs.'],
  'teton-geo-center': ['Visitor center', 'Local visitor information and educational exhibits in downtown Driggs.'],
  'endopeaks-bike-rental': ['Bike rentals', 'Bicycle rentals in Driggs.'],
  'teton-rock-gym': ['Indoor climbing', 'An indoor climbing gym in Driggs.'],
  'teton-indoor-sports-academy': ['Indoor sports', 'An indoor sports facility in Driggs.'],
  'teton-valley-adventures': ['Adventure outfitter', 'An outdoor adventure business in Driggs. Contact the operator for available trips.'],
  'teton-aviation-center': ['Scenic flights', 'An aviation center in Driggs offering scenic flights and pilot services.'],
};
const categoryOverrides = {
  'citypass': 'services', 'westwell-media': 'services', 'yellowstone-teton-territory': 'services',
  'teton-valley-property-management': 'services', 'wydaho-property-management': 'services',
  '2nd-act-thrift-store': 'shopping', 'lucky-dog-thrift-store': 'shopping',
  'peaked-sports': 'shopping', 'heron-glass-and-studio': 'arts-culture',
  'the-yoga-source': 'wellness', 'idaho-teton-yoga-co-op-non-profit-inc': 'wellness',
  'cryotherapy-idaho': 'wellness', 'cryo-therapy-idaho': 'wellness', 'elements-of-health': 'wellness',
  'occupational-therapy-unlimited-llc': 'wellness', 'pelvic-floored-physical-therapy': 'wellness', 'targhee-athletics': 'wellness',
  'summit-school-of-the-arts': 'arts-culture', 'valley-voices': 'arts-culture',
  'valley-of-the-tetons-library': 'arts-culture', 'makerspace': 'arts-culture', 'teton-geo-center': 'arts-culture',
  'teton-valley-trails-and-pathways': 'outdoors', 'teton-valley-ski-education-foundation': 'outdoors',
  'teton-aviation-center': 'outdoors', 'teton-nordic-ski-school': 'outdoors',
  'pierres-theatre': 'arts-culture', 'tribe-artist-collective': 'arts-culture',
  'teton-yoga-festival': 'wellness', 'mountain-home-treasures': 'shopping',
  'fox-creek-heating': 'services', 'corner-drug': 'shopping', 'victor-drug': 'shopping',
  'daves-pubb': 'food-drink', 'barrels-and-bins-natural-market': 'food-drink',
  'grand-targhee-resort': 'outdoors',
};
function category(row) {
  const id = slug(row.name);
  if (categoryOverrides[id]) return categoryOverrides[id];
  const tags = row.tags.join(' ');
  if (row.section === 'eat') return 'food-drink';
  if (row.section === 'stay') return 'stays';
  if (row.section === 'driggs') return ({'unique-retail':'shopping','food-and-drink':'food-drink','services':'services','body-and-health':'wellness','banks':'services','adventure':'outdoors','lodging':'stays'})[row.group] || 'services';
  if (/arts & culture/.test(tags)) return 'arts-culture';
  if (/fitness|health & wellness|hair & salon/.test(tags)) return 'wellness';
  if (/retail|shopping/.test(tags)) return 'shopping';
  if (row.section === 'play') return 'outdoors';
  return 'services';
}
function subcategory(row, cat) {
  const tags = row.tags.join(' ');
  const name = row.name.toLowerCase();
  if (custom[slug(row.name)]) return custom[slug(row.name)][0];
  if (cat === 'stays') {
    if (/campground/.test(name)) return 'Campground';
    if (/bed & breakfast/.test(tags)) return 'Bed & breakfast';
    if (/motel/.test(tags) || /motel/.test(name)) return 'Motel';
    if (/short term rental/.test(tags) && !/resorts/.test(tags)) return 'Vacation rentals';
    if (/lodge/.test(tags)) return 'Lodge';
    return 'Lodging';
  }
  if (cat === 'services') {
    if (/bank|credit union/.test(name)) return 'Banking';
    if (/real estate/.test(tags)) return 'Real estate';
    if (/veterinary/.test(tags)) return 'Pet & animal services';
    if (/auto/.test(tags)) return 'Auto services';
    if (/city or library/.test(tags)) return 'Community resources';
    if (/non-profit/.test(tags)) return 'Community organization';
    return 'Local services';
  }
  if (cat === 'food-drink') return 'Food & drink';
  if (cat === 'wellness') return 'Health & wellness';
  if (cat === 'shopping') return 'Local shopping';
  if (cat === 'arts-culture') return 'Arts & culture';
  return 'Outdoor recreation';
}
function description(row, cat, sub) {
  if (custom[slug(row.name)]) return custom[slug(row.name)][1];
  const where = row.city && !['Victor','Driggs'].includes(row.city) ? row.city : row.town;
  return `${sub} ${where === 'Teton Valley' ? 'serving Teton Valley' : `in ${where}`}, listed by ${row.section === 'driggs' ? 'Downtown Driggs Association' : 'Discover Teton Valley'}.`;
}
function address(value) {
  const a = clean(value);
  if (!a || /@|coming soon|serving all|^po box|^p\.o\./i.test(a)) return undefined;
  return a;
}
function comparableAddress(a) {
  return clean(a).toLowerCase().replace(/\b(north|south|east|west)\b/g, x => x[0]).replace(/\b(street|avenue|road|highway|drive|lane|court)\b/g, x => ({street:'st',avenue:'ave',road:'rd',highway:'hwy',drive:'dr',lane:'ln',court:'ct'})[x]).replace(/\b(?:driggs|victor|tetonia|alta|idaho|wyoming|id|wy)\b.*$/, '').replace(/(?:,|suite|ste |#).*$/, '').replace(/[^a-z0-9 ]/g, '').trim();
}
const allRows=[];
const sourceCounts=[];
for (const source of sources) {
  const [section, origin, path, key] = source;
  const {data, datasetUrl}=await sourceData(source);
  const edges=data.data[key].edges;
  const rows=section === 'driggs' ? edges.flatMap(({node}) => node.data.listing.map(x=>({name:x.business_name,city:/\bVictor\b/i.test(x.business_address||'')?'Victor':/\bAlta\b/i.test(x.business_address||'')?'Alta':/\bTetonia\b/i.test(x.business_address||'')?'Tetonia':'Driggs',address:x.business_address,url:x.business_url?.url,tags:[node.uid.replaceAll('-',' ')],group:node.uid}))) : edges.map(({node:{data:x}})=>({name:x.listing_name,city:clean(x.listing_city),address:x.listing_street,url:x.listing_website?.url,tags:x.listing_tags.map(t=>clean(t.eat_listing_tags)).filter(Boolean)}));
  sourceCounts.push({section,count:rows.length,page:origin+path,datasetUrl});
  for (const row of rows) {
    row.name=canonicalName(row.name);
    row.section=section;
    row.sourceUrl=origin+path;
    row.town=location(row.city,row.address);
    allRows.push(row);
  }
}
const grouped=new Map();
for (const row of allRows) {
  const id=slug(row.name);
  if (!grouped.has(id)) grouped.set(id,[]);
  grouped.get(id).push(row);
}
const conflicts=[];
const records=[...grouped].map(([id,rows])=>{
  const row=rows[0];
  if (id === 'daves-pubb') row.name = "Dave's Pubb";
  const tags=[...new Set(rows.flatMap(x=>x.tags))].filter(t=>!['unique retail','food and drink','body and health','lodging','services','adventure','banks'].includes(t));
  row.tags=tags;
  const cat=category(row);
  const sub=subcategory(row,cat);
  const addresses=[...new Set(rows.map(r=>address(r.address)).filter(Boolean))];
  const normalized=[...new Set(addresses.map(comparableAddress))];
  let selectedAddress=addresses[0];
  if (normalized.length>1 && !normalized.every(a=>a.startsWith(normalized[0])||normalized[0].startsWith(a))) {
    conflicts.push({name:row.name,addresses});
    selectedAddress=undefined;
  }
  const urls=[...new Set(rows.map(r=>website(r.url,r.name)).filter(Boolean))];
  const preferredUrl=urls.find(u=>!/(?:facebook|instagram|shop\.rosieapp)\.com/.test(u)) || urls[0];
  let seasons=['spring','summer','fall','winter'];
  if (/campground|golf course/i.test(row.name)) seasons=['summer','fall'];
  if (/teton nordic/i.test(row.name)) seasons=['winter'];
  if (/artisan market|teton valley rodeo|teton valley aquatics/i.test(row.name)) seasons=['summer'];
  if (/wydaho rendezvous/i.test(row.name)) seasons=['summer','fall'];
  const record={id,slug:id,name:row.name,town:row.town,category:cat,subcategory:sub,description:description(row,cat,sub),...(selectedAddress?{address:selectedAddress}:{}),...(preferredUrl?{website:preferredUrl}:{}),sourceUrls:[...new Set(rows.map(r=>r.sourceUrl))],sourceCheckedAt:checkedAt,sourceStatus:'source-listed',seasons,tags};
  return record;
}).sort((a,b)=>a.name.localeCompare(b.name));
for (const record of records) {
  if (record.name==='Valley of the Tetons Library') record.town='Teton Valley';
  if (record.name==='Grand Targhee Resort') record.tags=[...new Set([...record.tags,'skiing','mountain biking'])];
}
await mkdir('data',{recursive:true});
await mkdir('research',{recursive:true});
await writeFile('data/directory.json',JSON.stringify(records,null,2)+'\n');
const counts=field=>[...new Set(records.map(r=>r[field]))].sort().map(value=>`- ${value}: ${records.filter(r=>r[field]===value).length}`).join('\n');
const report=`# Source-listed directory inventory\n\nChecked ${checkedAt}. Imported ${allRows.length} source rows and normalized them to **${records.length} listings**. This is a broad starting inventory, not a claim to include every operating business or attraction in the valley.\n\n## Sources and extraction\n\n${sourceCounts.map(s=>`- [${s.section}: ${s.count} rows](${s.page}) — [public Gatsby query JSON](${s.datasetUrl})`).join('\n')}\n\nThe source pages render their directories in JavaScript. The importer reads the same publicly delivered Gatsby page-data and static-query JSON used by those pages. It does not use credentials, private APIs, or bypass access restrictions. Names, towns, categories, addresses and supplied business links are factual directory fields. Descriptions are short original summaries or category-based descriptions, not copied marketing paragraphs. Source photographs are not imported.\n\n## Coverage\n\n### By town\n\n${counts('town')}\n\nAlta, Wyoming; Jackson; and Idaho Falls are labeled Nearby. Tetonia and records lacking a confirmed street location are grouped under Teton Valley. A mailing address is not presented as a visitor destination.\n\n### By category\n\n${counts('category')}\n\n## Verification limits\n\n- sourceCheckedAt records when the directory source was read, **not** an owner verification or confirmation that a business is open. Website links are the URLs supplied by the directory, normalized for safe HTTP/HTTPS syntax; individual destinations were not all independently checked.\n- Sources can contain closures, renamed businesses, old URLs and stale addresses. Confirm high-traffic listings with the operator before public launch, then add an owner-verification workflow. No opening hours, prices, upcoming event dates, or coordinates are inferred.\n- Seasonal tags support discovery; they do not guarantee operating dates or conditions. Campgrounds, golf, river activities, festivals and snow activities need direct operator or land-manager checks.\n- The Teton Yoga Festival source includes an undated September 8–10 schedule; the imported listing omits those dates and explicitly asks readers to confirm the next edition. No historical event has been presented as an upcoming event.\n- Discover's Stay query includes Westwell Media and Yellowstone Teton Territory; these are classified as services rather than lodging. Duplicate Peaked Sports, Pierre's Theatre, Get Baked, food pantry and technology-service records were merged. Alternate names were merged conservatively. Grand Targhee's activity listing and lodging offering remain distinct records because they represent different directory uses.\n- No coordinates are imported from map URL centers: those may be the map viewport, not the actual destination.\n- This file covers the two assigned directory sources. Teton Flats trail-map extraction is tracked separately.\n\n## Address conflicts requiring review\n\nConflicting street addresses are omitted from the public record until confirmed. Formatting-only differences are normalized.\n\n${conflicts.length?conflicts.map(c=>`- **${c.name}**: ${c.addresses.join(' / ')}`).join('\n'):'None.'}\n\n## URL normalization and omissions\n\n${[...new Set(issues)].map(x=>`- ${x}`).join('\n')}\n\n## Refresh\n\nRun \`node scripts/import-directory.mjs\` to retrieve current public query data. Review the diff and correction queue before publishing; source records are not treated as automatically verified. The recorded source-check date must be updated to the actual review date when refreshing. For reproducing this import from temporary source snapshots: \`node scripts/import-directory.mjs --cache-dir /tmp\`.\n`;
await writeFile('research/directory.md',report);
console.log(JSON.stringify({sourceRows:allRows.length,records:records.length,addressConflicts:conflicts.length,categories:Object.fromEntries([...new Set(records.map(r=>r.category))].map(c=>[c,records.filter(r=>r.category===c).length]))},null,2));
