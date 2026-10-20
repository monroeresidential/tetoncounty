# Corporate housing page — design

Date: 2026-10-20 · Status: draft for review

## Intent

A public, searchable page on tetoncounty.us for people who work in Jackson and need housing for a fixed stretch: traveling nurses (often ~13-week contracts), contractors on multi-month projects, and Jackson employers (a resort, for example) placing several employees at once. The page soft-sells Teton Flats in Victor as the housing option, makes the Victor → Jackson commute concrete and honest, and ends in an inquiry form that emails the owner.

**The one thing an employer should leave with:** Teton Flats offers flexible lease terms that match the length of their contract.

It should read like the rest of the guide — a community resource that happens to know a good option — not a standalone landing page. Teton Flats is the only housing option on the page.

## Goals

- Rank for searches like "corporate housing Jackson Hole", "traveling nurse housing Jackson WY", "employee housing Victor Idaho".
- Turn those visitors into inquiries via a form that emails the owner through Formspree form `xkjoayyr`.
- Show the property: exterior photos, the three floor plans, interior photos.
- Show commute times to Jackson using the site's existing live Teton Pass data.

## Non-goals

- Listing other housing providers or a housing directory.
- Live unit availability or rents on this page (link to tetonflats.com/availability instead).
- Online applications, payments, or booking.
- A visitor acknowledgement email or CRM integration.

## Anti-goals (failure even if it works)

- **Implying units are furnished.** They are not. The interior photos show a staged, furnished model; captions and copy must say so.
- **Overselling the commute.** No "always 35 minutes." Closed/unknown pass states withhold drive times exactly as `/teton-pass/` does.
- **Inventing terms.** No specific minimum lease length, price, discount, corporate rate, or unit count beyond what tetonflats.com publishes or the owner states. "Flexible lease terms that match your contract length" is the owner's statement and may be used as written.
- **Duplicating tetonflats.com.** tetonflats.com already has `/workforce-housing`, `/teton-county-employer-housing`, and `/victor-to-jackson-commute`. This page must not copy their prose; write original copy (the site already rewrites rather than copies sponsor text).
- **Mixing leads into the editorial queue.** `docs/DESIGN.md`: "The form never turns suggestions into apartment leads." Housing inquiries must stay separate from additions/corrections/contact.

## Facts available (source: tetonflats.com, checked 2026-10-20)

- 72 new 1 & 2 bedroom apartments, finished 2025, at 100 Homestead Road, Victor, ID; four buildings.
- Floor plans: 2 bed / 2 bath 980 sq ft; 1 bed / 1 bath 640 sq ft (virtual tour at `/floorplans/1bd-1ba/tour`); 1 bed / 1 bath duplex 622 sq ft (ground-floor entry).
- Features: quartz counters, stainless appliances, in-unit washer/dryer, A/C, 9' ceilings, dedicated secure storage, Teton views, 1 Gbps fiber internet included.
- Commute: 25 mi over WY-22 / Teton Pass (8,431 ft, 10% grade WY side); snow tires/AWD standard Nov–Apr; closures detour via Pine Creek Pass / Swan Valley / US-26, ~85 mi; START Teton Valley Commuter bus runs weekday mornings/evenings (link startbus.com, no schedule claims).
- 0.5 mi to downtown Victor; 8 mi to Driggs & Teton Valley Hospital (relevant for nurses).
- Images (the site owner's 2026-10-18 authorization covers images on tetonflats.com generally; `research/listing-image-review.json` records only listing images so far, so add records for these gallery/floor-plan files citing that authorization; `unit-1br-7` is already used via `public/data/image-sources.json`): `images/gallery/exterior-1..4.jpg`, `unit-1br-1..8.jpg`, `images/floorplans/teton-flats-{2-bedroom-2-bath,1-bedroom-1-bath,1-bedroom-1-bath-duplex}-floor-plan-v3.jpg`.

Owner statements (2026-10-20): flexible lease terms matching contract length; units are unfurnished; inquiries go to Formspree `xkjoayyr`; page is public, indexed, and in the main nav.

## Page

**URL:** `/corporate-housing/` *(my call)*. **Nav label:** "Corporate housing", placed after "Live here" *(my call)*. Included in the sitemap, `llms.txt`, and indexed.

**Sections, in order** *(order and copy are the builder's; content is fixed)*:

1. **Intro** — breadcrumb, H1 (e.g. "Corporate & contract housing near Jackson"), one-paragraph lede naming the three audiences and the lease-length promise. Hero: Teton Flats exterior photo.
2. **Lease terms that fit the contract** — the headline message. Short copy for each audience: nurse/contractor (one lease for your assignment), employer (several units, terms aligned to your season or project). States plainly: units are leased unfurnished. Primary CTA scrolls to the form.
3. **The commute** — embeds the live pass status + Victor → Jackson / Teton Village drive times from the existing `/api/pass` data (reuse `pass.ts` rendering rules: unknown ≠ open, closed shows the verbatim warning, closed/unknown withhold times, stale rows get no "vs. usual"). Static, sourced context alongside: distance, winter driving, closure detour, START bus link. Link to `/teton-pass/` for full detail. Must degrade cleanly with no JS (noscript note like `/teton-pass/`).
4. **The apartments** — the three floor plans with sq ft and features (image + click to enlarge), exterior photos, interior gallery captioned "Staged model — apartments are leased unfurnished." Reuse the webcam lightbox pattern if it fits budget; otherwise plain links to full-size images.
5. **Inquiry form** — see below.
6. **Small FAQ** *(optional, builder's call)* — furnished? (no), lease length? (flexible to match contract), pets/parking only if sourced. No invented answers.

Every tetonflats.com link goes through `SponsorLink` / `sponsorLink` (campaign `tetoncounty_corporate_housing`, distinct `utm_content` per placement). Every body-text "Teton Flats" must be linked or the build fails (`tests/sponsor-links.test.mjs`). JSON-LD (e.g. `WebPage` plus an `ApartmentComplex` with address and floor sizes) carries no UTMs and no prices.

Images go through `Photo.astro` (local AVIF/WebP, no hot-linking). Originals are fetched once, hashed, and recorded like listing images; production builds never fetch from tetonflats.com.

## Inquiry form

**Fields:** I am (individual / employer) · name · email · phone (optional) · company (shown/required for employer) · number of units · bedroom preference (1 bed, 2 bed, either; multi-select for employers) · desired move-in date · approximate stay length (free text or months) · message (optional) · honeypot · Turnstile.

**Pipeline:** browser → Worker `handleApi` (same origin check, Turnstile, honeypot, rate limits, size limits as the suggestion form) → saved to D1 → forwarded to Formspree `xkjoayyr` with retries and the existing 5-minute cron recovery.

- New Worker var `FORMSPREE_HOUSING_FORM_ID`: `"xkjoayyr"` in production, `""` in `env.dev`. `scripts/preflight.mjs` asserts dev is empty, as it does for `FORMSPREE_FORM_ID`.
- Housing inquiries must never be sent to `meaedrjo`, and suggestions never to `xkjoayyr`.
- Turnstile action distinct from `suggest` (e.g. `housing`), checked server-side.
- Storage shape is the builder's call: a new migration (new table, or rebuilding `submissions` to widen the `type` CHECK) — but the structured fields must arrive in the email as labeled fields, not one blob.
- Email subject identifies it as a housing inquiry and includes individual/employer and unit count.
- Success state shows a reference ID like the suggestion form; no acknowledgement email.
- Local dev (`scripts/local-api.mjs`) accepts and stores inquiries without emailing, like suggestions.
- Analytics: a GA4 event on successful submit with no form field values *(my call)*.
- **Release step:** before production, confirm in Formspree that `xkjoayyr` accepts server-side POSTs like `meaedrjo` (no reCAPTCHA, no domain restriction that blocks the Worker), and send one real test inquiry end-to-end. Failed deliveries use the existing recovery process in `docs/EDITORIAL.md`; no new alerting *(my call)*.
- **Retention:** housing inquiries are deleted 12 months after receipt (there is no review step), from D1 and the `xkjoayyr` inbox. No status field is needed beyond notification tracking *(my call)*.

**Privacy page:** update `/privacy/` to cover housing inquiries — fields collected (incl. phone, company), that they go to a separate private Formspree inbox and are used only to reply about Teton Flats apartments, retention of 12 months from receipt, and that the sender isn't added to a marketing list. Recipient (owner, 2026-10-20): `drew@monroeresidential.com`, the same person who edits the guide, so no third party receives inquiries. Wording is the builder's, but it must say plainly that a housing inquiry is about renting at Teton Flats, the guide's sponsor. The current sentence "Your email is not … added to a rental marketing list" stays true but must not be contradicted.

## Constraints (from the repo)

- No inline `<script>` (CSP); page JS goes in a new external script or extends `app.ts`.
- Gzip budgets from `scripts/check.mjs`: scripts any one page loads < 9000 B; `styles.css` < 12000 B. Pass rendering already exists in `pass.ts`; avoid loading it twice.
- `check.mjs` page rules apply: one H1, canonical, description, OG tags, valid JSON-LD, no broken internal links.
- Dev builds stay noindex; production indexes.
- Content rules (`docs/EDITORIAL.md`): no invented hours, prices, or conditions; "source-listed" framing for facts drawn from tetonflats.com.

## Tests the builder should add

- Worker: housing inquiry validation (required fields per I am type, size limits, honeypot, Turnstile action), stored, routed to `xkjoayyr` only; suggestions still routed to `meaedrjo` only; dev env never forwards.
- Preflight: dev `FORMSPREE_HOUSING_FORM_ID` must be empty.
- Built page: in sitemap, in nav, sponsor links tagged, interior captions include "unfurnished", no drive time rendered for closed/unknown fixtures.

## Left to the builder

Exact copy, section layout and visual treatment within the Trailhead design, storage schema, JS structure, lightbox reuse, FAQ inclusion.

## Decisions marked as my call (for owner review)

- URL `/corporate-housing/` and nav label "Corporate housing" after "Live here".
- Don't show rents on this page; link to live availability.
- Interior photo caption wording: "Staged model — apartments are leased unfurnished."
- Data stored in D1 before emailing, like existing forms.
- Count-only GA4 event on submit.
