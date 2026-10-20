# Corporate Housing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/corporate-housing/` page that presents Teton Flats as contract-length housing for Jackson workers, with live commute times, photos, floor plans, and an inquiry form that emails Formspree `xkjoayyr`.

**Architecture:** Housing inquiries get their own D1 tables (`housing_inquiries`, `housing_notifications`) and Worker route (`POST /api/housing-inquiries`) that share the existing origin/Turnstile/honeypot/rate-limit guards, and a generalized `deliverNotifications` that drains both queues to their own Formspree form. The page reuses the pass status/drive-time renderer (split out of `pass.ts`) and a Turnstile helper (split out of `app.ts`).

**Tech Stack:** Astro 7, strict TypeScript, Cloudflare Worker + D1, node:sqlite tests (`node --test`), sharp for one-off image conversion.

**Spec:** `docs/superpowers/specs/2026-10-20-corporate-housing-design.md`

## Global Constraints

- Housing inquiries go only to Formspree `xkjoayyr` via Worker var `FORMSPREE_HOUSING_FORM_ID`; suggestions go only to `meaedrjo` (`FORMSPREE_FORM_ID`). `env.dev` sets `FORMSPREE_HOUSING_FORM_ID: ""`.
- Never imply units are furnished. Interior captions include: "Staged model — apartments are leased unfurnished."
- Headline promise, verbatim in substance: flexible lease terms that match your contract length. No minimum lease length, price, discount, rent, unit count available, pets or parking claims.
- Pass rules: unknown ≠ open; closed shows `closedWarning`; closed/unknown withhold drive times; stale rows get no "vs. usual".
- No inline `<script>`; page JS is an external module. Gzip budget: scripts any one page loads < 9000 B (today `/teton-pass/` is 6927 B); `public/assets/styles.css` < 12000 B — put page CSS in `src/styles/housing.css`.
- Every tetonflats.com link via `SponsorLink`/`sponsorLink` (campaign becomes `tetoncounty_corporate_housing`); every body-text "Teton Flats" is linked. JSON-LD has no UTMs and no prices.
- Copy is original — do not paste prose from tetonflats.com `/workforce-housing`, `/teton-county-employer-housing`, or `/victor-to-jackson-commute`.
- Retention: housing inquiries deleted 12 months after receipt.
- Code style: match the file being edited (worker.mjs is dense one-liners; TS files are formatted).

## Review Focus

1. **Turnstile action crossover** — a token minted for `suggest` must not be accepted by `/api/housing-inquiries` and vice versa. Test in Task 1.
2. **Queue crossover** — a housing row must never reach `meaedrjo`, and with `FORMSPREE_HOUSING_FORM_ID` empty, housing rows stay pending while suggestions still send. Test in Task 2.
3. **Employer without company / individual with 40 units** — employer requires company; units must be an integer 1–50; individuals are capped at 2 units. Test in Task 1.
4. **Pass data unavailable on the housing page** — `/api/pass` 503 must show the "can't reach" message and no drive times, without throwing because the chart/route/weather elements are absent. Test in Task 4.
5. **Separate rate-limit buckets** — five suggestions in an hour must not block a housing inquiry (and vice versa). Test in Task 1.

---

### Task 1: Housing inquiry storage, validation, and endpoint

**Files:**
- Create: `migrations/0003_housing_inquiries.sql`
- Modify: `src/worker.mjs`
- Test: `tests/housing.test.mjs`

**Interfaces:**
- Produces: tables `housing_inquiries(id TEXT PK, requester TEXT CHECK IN ('individual','employer'), name, email, phone DEFAULT '', company DEFAULT '', units INTEGER CHECK 1..50, bedrooms TEXT CHECK IN ('1','2','either'), move_in TEXT (YYYY-MM-DD), stay_length TEXT, message TEXT DEFAULT '', created_at TEXT)` and `housing_notifications` (same columns as `submission_notifications`, `submission_id` → `inquiry_id REFERENCES housing_inquiries(id) ON DELETE CASCADE`), with an AFTER INSERT trigger like `queue_submission_notification`.
- Produces: `export function validateHousingInquiry(body): string|null` in `src/worker.mjs`; route `POST /api/housing-inquiries` returning `{ok:true,id}` 201.
- Request body fields: `requester, name, email, phone, company, units, bedrooms, moveIn, stayLength, message, consent:'yes', companyUrl (honeypot), turnstileToken`. `units` arrives as a string from FormData.

- [ ] **Step 1: Write failing tests** in `tests/housing.test.mjs`, fixture via `migrateLocal` on `:memory:` (as `notifications.test.mjs`). Valid body: `{requester:'employer',name:'HR Tester',email:'hr@example.com',phone:'',company:'Test Resort',units:'4',bedrooms:'either',moveIn:'2026-12-01',stayLength:'Ski season, about 5 months',message:'',consent:'yes',companyUrl:''}`.
  - `stores a valid employer inquiry and queues a notification` → 201, row in `housing_inquiries` with `units===4`, one `housing_notifications` row `status==='pending'`, no row in `submissions`.
  - `rejects invalid inquiries without storage` → 400 for each patch: `{requester:'agency'}`, `{company:''}` (employer), `{requester:'individual',units:'3'}`, `{units:'0'}`, `{units:'51'}`, `{units:'2.5'}`, `{bedrooms:'3'}`, `{moveIn:'next week'}`, `{stayLength:''}`, `{email:'nope'}`, `{consent:'no'}`, `{companyUrl:'spam'}`, `{phone:'x'.repeat(41)}`; count stays 0.
  - `individual inquiry without company is accepted` → `{requester:'individual',company:'',units:'1'}` 201.
  - `production requires the housing Turnstile action` → stub `fetch` returning `action:'suggest'` → 400; `action:'housing'` → 201. Mirror the existing hostname test.
  - `suggestion and housing rate limits are independent` → 5 suggestions 201 then housing 201; 5 housing then 6th housing 429.
  - `cross-origin and non-JSON housing requests are refused` → 403 / 415 / GET 405.
- [ ] **Step 2: Run** `node --test tests/housing.test.mjs` — Expected: FAIL (404 from unknown route / missing tables).
- [ ] **Step 3: Write the migration** with the schema above. Field limits: name 1–100, email 3–254, phone 0–40, company 0–120 (required 1+ for employer), stayLength 1–120, message 0–2000.
- [ ] **Step 4: Implement in `src/worker.mjs`.** Extract the shared guard from `handleApi` into `async function acceptForm(request,env,action)` that returns either `{response}` (error) or `{body,now,ip}`; it performs origin, enabled, content-type, `readBoundedJson`, honeypot, Turnstile with `result.action!==action`. Rate-limit bucket hash input becomes `` `${action}|${secret}|${hour}|${ip}` `` so buckets are per form (existing suggestion buckets simply roll over within the hour). Route `/api/submissions` keeps its behavior with action `'suggest'`; add `/api/housing-inquiries` with `'housing'` and `validateHousingInquiry`. After insert, deliver with `deliverNotifications(env,{queue:'housing',submissionId:id,limit:1})` gated on `env.FORMSPREE_HOUSING_FORM_ID` (Task 2 adds the option; until then call nothing).
- [ ] **Step 5: Run** `node --test tests/housing.test.mjs tests/submissions.test.mjs tests/notifications.test.mjs` — Expected: PASS. (`submissions.test.mjs` applies only 0001; it must still pass.)
- [ ] **Step 6: Commit** `git add migrations/0003_housing_inquiries.sql src/worker.mjs tests/housing.test.mjs && git commit -m "Accept housing inquiries in their own table and endpoint"`

### Task 2: Route housing notifications to their own Formspree form

**Files:**
- Modify: `src/lib/form-notifications.ts`, `src/worker.mjs` (call site + `scheduled`), `wrangler.jsonc`, `scripts/preflight.mjs`
- Test: `tests/housing.test.mjs`, `tests/notifications.test.mjs`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `DeliveryOptions.queue?: 'submissions' | 'housing'` (default `'submissions'`); `NotificationEnvironment.FORMSPREE_HOUSING_FORM_ID?: string`; `export function housingPayload(row: HousingInquiry, siteUrl?: string)` returning labeled fields: `subject` = `` `TetonCounty.us: Housing inquiry — ${employer ? company : 'individual'}, ${units} unit(s) [${id.slice(0,8)}]` ``, `name, email, phone, company, requester, units, bedrooms, moveIn, stayLength, message, reference, submittedAt, source: `${siteUrl}/corporate-housing/``.
- `scheduled` runs `deliverNotifications(env)` then `deliverNotifications(env,{queue:'housing'})`.

- [ ] **Step 1: Write failing tests** (stub `fetcher` records URLs/bodies):
  - `housing rows are delivered only to the housing form` → env with both IDs; insert one suggestion and one inquiry; run both queues; URLs are exactly `https://formspree.io/f/meaedrjo` once and `https://formspree.io/f/xkjoayyr` once; housing body has `units`, `company`, `moveIn`, `subject` matching `/^TetonCounty\.us: Housing inquiry — Test Resort, 4 unit\(s\)/`.
  - `an empty housing form ID leaves inquiries pending and still sends suggestions` → `FORMSPREE_HOUSING_FORM_ID:''`; housing notification stays `pending`, attempts 0.
  - `invalid housing form ID throws` → `'https://elsewhere.example/'` rejects.
  - `development never forwards housing inquiries` → `ENVIRONMENT:'development'`, fetcher not called.
- [ ] **Step 2: Run** `node --test tests/housing.test.mjs tests/notifications.test.mjs` — Expected: FAIL.
- [ ] **Step 3: Implement.** Map `queue` to `{table, notificationTable, idColumn, formId, payload}` constants (never user input) and use them in the existing SQL; behavior for `'submissions'` unchanged. Wire the Worker call from Task 1 and `scheduled`.
- [ ] **Step 4: Config.** `wrangler.jsonc`: production `"FORMSPREE_HOUSING_FORM_ID": "xkjoayyr"`, `env.dev` `""`. `preflight.mjs` dev branch: `assert.equal(target.vars.FORMSPREE_HOUSING_FORM_ID, '', 'Development housing email delivery must be disabled.')`; production branch: `assert.equal(target.vars.FORMSPREE_HOUSING_FORM_ID, 'xkjoayyr')`.
- [ ] **Step 5: Run** `npm test` (after `npm run build` if dist is stale) and `node scripts/preflight.mjs --env dev` against a `npm run build:dev` — Expected: PASS.
- [ ] **Step 6: Commit** `git commit -am "Send housing inquiries to their own Formspree form"` (include the test file).

### Task 3: Property photos and floor plans

**Files:**
- Create: `src/assets/photos/teton-flats-{exterior-1..4,unit-1br-1..6,unit-1br-8}.webp`, `src/assets/photos/floorplan-{2-bed-2-bath,1-bed-1-bath,1-bed-1-bath-duplex}.webp` (`unit-1br-7` already exists as `teton-flats-interior.webp`)
- Modify: `public/data/image-sources.json`
- Test: `tests/site.test.mjs`

**Interfaces:**
- Produces: photo paths usable as `<Photo src="/images/<name>.webp">` (resolved by `imageSources` by basename).

- [ ] **Step 1: Write failing test** `every corporate-housing photo has a source record` → read `public/data/image-sources.json`; for each basename above, a record with `file:'/images/<name>.webp'`, `source` starting `https://tetonflats.com/images/`, `credit:'Teton Flats'`, and `note` containing `"Reuse authorized by the site owner"`; every `unit-1br-*` record's note also contains `"unfurnished"`.
- [ ] **Step 2: Run** `node --test --test-name-pattern="corporate-housing photo" tests/site.test.mjs` — Expected: FAIL.
- [ ] **Step 3: Fetch and convert.** Download originals (URLs in the spec's Facts section) into `.local/photo-research/corporate-housing/` (git-ignored), view each one, convert with sharp to WebP at source width capped at 2000 px, quality 82. Floor plans: keep full width (they must stay legible), quality 90. Add records; `depicts` describes what is shown (e.g. "Staged one-bedroom model kitchen"), notes say "Reuse authorized by the site owner on 2026-10-18. Staged model; apartments are leased unfurnished." for interiors.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/assets/photos public/data/image-sources.json tests/site.test.mjs && git commit -m "Add Teton Flats photos and floor plans for the corporate housing page"`

### Task 4: Split the pass status renderer so other pages can embed it

**Files:**
- Create: `src/scripts/pass-status.ts`
- Modify: `src/scripts/pass.ts`
- Test: `tests/pass.test.mjs`

**Interfaces:**
- Produces: `export function mountPassStatus(root: HTMLElement): { load(): Promise<PassReport | null> }` in `pass-status.ts`. It renders into `[data-pass-banner]`, `[data-pass-state]`, `[data-pass-warning]`, `[data-pass-detail]`, `[data-pass-advisories]`, `[data-pass-withheld]`, `[data-pass-directions]`, `[data-pass-times="eb"|"wb"]`, `[data-pass-updated]`; `[data-pass-weather]` is optional (skip when absent). Also an optional `data-pass-routes="victor-jackson,victor-tetonvillage"` attribute on root filters which routes render (prefix match on slug before `-eb`/`-wb`); absent = all.
- `pass.ts` keeps the chart, route select, refresh loop, and imports `mountPassStatus`.

- [ ] **Step 1: Write failing test** in `tests/pass.test.mjs`: `pass status renderer tolerates a page without chart or weather` → import `src/scripts/pass-status.ts` is DOM-bound, so test the pure piece instead: export `visibleTimes(report: PassReport | null, routes: string[] | null): TravelTime[]` from `pass-status.ts` and assert: closed → `[]`; unknown → `[]`; `null` → `[]`; open with routes `['victor-jackson']` → only `victor-jackson-eb`/`-wb` rows.
- [ ] **Step 2: Run** `node --test tests/pass.test.mjs` — Expected: FAIL (module missing).
- [ ] **Step 3: Move `element`, `sublabel`, `timeRow`, `renderStatus`, `getJson`** into `pass-status.ts`; `renderStatus` uses `visibleTimes`. `/teton-pass/` behavior and markup unchanged.
- [ ] **Step 4: Run** `npm run build && node --test tests/pass.test.mjs` — Expected: PASS, including the existing `/teton-pass/` HTML tests.
- [ ] **Step 5: Commit** `git commit -am "Split pass status rendering into a reusable module"` (add the new file).

### Task 5: Shared form service and the housing form client

**Files:**
- Create: `src/scripts/form-service.ts`, `src/scripts/housing.ts`
- Modify: `src/scripts/app.ts`

**Interfaces:**
- Produces: `export async function connectFormService(options: { action: 'suggest' | 'housing'; container: string; onToken(token: string): void; show(message: string, kind?: string): void }): Promise<FormConfig>` — fetches `/api/config`, shows the local/dev/not-connected messages already in `initSuggestion`, loads Turnstile explicitly, renders with `action`, returns config; plus `resetToken()` behavior via returned widget id (`{config, widget}`).
- `housing.ts` mounts on `#housing-form`: toggles `[data-employer-only]` fields (company required + units max 50) vs individual (units max 2, company disabled) from the `requester` radio; submits JSON to `/api/housing-inquiries`; success message `Thanks — your inquiry is in. Reference: ${id}. We'll reply by email.` (dev/local variants say no email was sent, as suggestions do); calls `mountPassStatus(document.querySelector('[data-pass]'))` and `.load()` once (no interval).
- Move `type FormConfig` from `app.ts` into `form-service.ts` and export it.
- On success, fire GA4 event `housing_inquiry` with params `{requester}` only: `window.gtag?.('event', 'housing_inquiry', { requester })`. `analytics.ts` exports nothing and only defines `gtag` on the production host, so the optional call is the production-only guard.

- [ ] **Step 1: Refactor `initSuggestion`** to use `connectFormService({action:'suggest', container:'#turnstile', …})`. No behavior change.
- [ ] **Step 2: Run** `npm run build && npm test` — Expected: PASS (suggest page unchanged).
- [ ] **Step 3: Write `housing.ts`** per the interface.
- [ ] **Step 4: Commit** `git add src/scripts && git commit -m "Share the Turnstile form service and add the housing form client"`

### Task 6: The `/corporate-housing/` page, nav, sitemap, and llms.txt

**Files:**
- Create: `src/pages/corporate-housing.astro`, `src/styles/housing.css`
- Modify: `src/components/Header.astro`, `src/components/Footer.astro`, `src/pages/[...resource].ts`
- Test: `tests/housing.test.mjs` (built-page tests; require `dist/`)

**Interfaces:**
- Consumes: photos (Task 3), `mountPassStatus` markup contract (Task 4), `housing.ts` (Task 5), `SponsorLink`, `Photo`, `trackedLink`.
- Page title: "Corporate & contract housing near Jackson"; description ≤ 160 chars naming traveling nurses, contractors, employers, Victor, and lease terms matched to contract length.

- [ ] **Step 1: Write failing built-page tests:**
  - `corporate housing page is public, linked, and in the sitemap` → `dist/corporate-housing/index.html` exists; header contains `<a aria-current="page" href="/corporate-housing/">Corporate housing</a>`; `dist/sitemap.xml` includes `/corporate-housing/</loc>`; `dist/llms.txt` includes `/corporate-housing/` and no longer contains "Apartment lead generation is not part of this release."; production build has no `noindex` meta on the page.
  - `corporate housing never implies furnished units` → page HTML contains "leased unfurnished" at least once per interior photo figure; lowercase text contains no `"furnished apartment"`/`"fully furnished"`.
  - `corporate housing shows no prices or invented terms` → page text has no `$` followed by a digit and no `/mo`.
  - `corporate housing form posts to its own endpoint` → contains `id="housing-form"`, `name="companyUrl"` honeypot, `name="consent"`, `id="housing-turnstile"`, and no `/api/submissions`.
  - `commute block withholds times without JavaScript` → `[data-pass-directions]` element is rendered with `hidden`; a `<noscript>` mentions Wyoming 511.
- [ ] **Step 2: Run** `npm run build && node --test tests/housing.test.mjs` — Expected: FAIL.
- [ ] **Step 3: Build the page** in spec section order: intro (breadcrumb, H1, lede, exterior hero `priority`), lease terms by audience + "Units are leased unfurnished." + CTA `#inquire`, commute (`<section data-pass data-pass-routes="victor-jackson,victor-tetonvillage">` with the Task 4 markup, minus chart/weather; static facts: 25 mi via WY-22, 8,431 ft summit, snow tires/AWD Nov–Apr, closure detour ~85 mi via Pine Creek Pass/Swan Valley/US-26, START bus link to `https://www.startbus.com/`, link to `/teton-pass/`), apartments (three floor plans with sq ft + features, each image linking to its full-size file; exterior grid; interior grid with captions), form `#inquire`, optional FAQ. JSON-LD: `WebPage` + `ApartmentComplex` (name, address "100 Homestead Road, Victor, ID", `numberOfAccommodationUnits: 72`, `url: https://tetonflats.com/`) — no UTMs, no prices. Link tetonflats.com availability/floor plans/virtual tour via `SponsorLink` with placements `hero_cta`, `availability_link`, `floorplans_link`, `tour_link`, `inline_text`.
- [ ] **Step 4: Nav and lists.** Header: add "Corporate housing" after "Live here". Footer: add the same link. `[...resource].ts`: add `'/corporate-housing/'` after `'/teton-pass/'` in `routes`; in `llms.txt` add `- [Corporate housing](${siteUrl}/corporate-housing/): contract-length apartment leases at Teton Flats, the guide's sponsor.` and replace the "Apartment lead generation…" sentence with "Housing inquiries are limited to /corporate-housing/ and are separate from listing submissions."
- [ ] **Step 5: Mobile check.** With the header now holding 8 links + CTA, confirm the menu toggle still covers ≤ 760 px and the desktop nav doesn't wrap at 1100 px; tighten nav spacing in `styles.css` only if it wraps, keeping it < 12000 B gzip.
- [ ] **Step 6: Run** `npm run check` — Expected: PASS, including sponsor-link tests (every "Teton Flats" linked), JSON-LD validity, one H1, script budget < 9000 B on `/corporate-housing/`.
- [ ] **Step 7: Commit** `git add -A src tests && git commit -m "Add the corporate housing page and link it from the nav"`

### Task 7: Privacy page and docs

**Files:**
- Modify: `src/pages/privacy.astro`, `docs/EDITORIAL.md`, `docs/DEPLOYMENT.md`, `docs/DESIGN.md`, `CLAUDE.md` (if it is committed by then; otherwise skip)
- Test: `tests/housing.test.mjs`

- [ ] **Step 1: Write failing test** `privacy page covers housing inquiries` → `dist/privacy/index.html` contains "housing inquir", "phone", "12 months", and "Teton Flats".
- [ ] **Step 2: Privacy copy.** New section "When you ask about housing": fields collected (requester type, name, email, optional phone, company, units, bedrooms, move-in, stay length, message); stored privately and sent to a separate private Formspree inbox; used only to reply about renting at Teton Flats, the guide's sponsor (linked via `SponsorLink`); not added to a marketing list; deleted within 12 months of receipt. Update "Last updated" to October 20, 2026.
- [ ] **Step 3: Docs.** EDITORIAL: housing queue tables, how to inspect (`SELECT … FROM housing_inquiries`), failed-delivery recovery for `housing_notifications`, 12-month deletion. DEPLOYMENT: `xkjoayyr`, `FORMSPREE_HOUSING_FORM_ID`, run `npm run db:migrate` and `npm run db:migrate:dev` for `0003`, the Formspree settings check. DESIGN: amend "The form never turns suggestions into apartment leads" to note housing inquiries use a separate form, endpoint, queue, and inbox.
- [ ] **Step 4: Run** `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "Document housing inquiries in the privacy policy and ops docs"`

### Task 8: Full verification and release prep

- [ ] **Step 1:** `npm run check && npm run check:dev` — both PASS; note the `/corporate-housing/` JS bytes from check output.
- [ ] **Step 2:** `npm run dev`, open `/corporate-housing/`, submit one individual and one employer inquiry; confirm rows in `.local/submissions.sqlite` `housing_inquiries` and that nothing was emailed. Screenshot at 390 px and 1280 px.
- [ ] **Step 3:** Report to the owner the remaining manual steps (not done by the agent): confirm Formspree `xkjoayyr` has no reCAPTCHA/domain restriction; `npm run db:migrate:dev` before the dev deploy and `npm run db:migrate` before production; after the production release, send one real inquiry and confirm it arrives at drew@monroeresidential.com.
