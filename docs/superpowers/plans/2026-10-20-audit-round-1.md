# Audit Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the verified round-1 audit fixes (link removals and replacements, one merge, six listing removals, business phone numbers) through a new reviewed-overrides file that survives data re-imports.

**Architecture:** `data/overrides.json` is applied by a pure `applyOverrides()` after the merge in `loadListings`. It can set or clear fields and remove listings. Removed listings get 301s to their category page through the existing `_redirects` generator. Phone becomes a validated listing field, rendered on place pages and in JSON-LD.

**Tech Stack:** Astro 7, strict TypeScript, `node --test`, `astro/zod` schema.

**Spec:** `docs/superpowers/specs/2026-10-20-audit-round-1-design.md`. Its tables A–E are the exact data to apply; the plan doesn't repeat them.

## Global Constraints

- Never hand-edit `data/directory.json` or `data/tetonflats.json`. Every change to an imported record goes in `data/overrides.json`. The one exception is the `tributary` alias in `data/aliases.json`.
- Every override entry has `reason` (string) and `decidedAt: "2026-10-20"`.
- No hours. No addresses. Don't touch `addressStatus` or the `source-conflict` regex in `src/data.ts`.
- Don't change `sourceCheckedAt` or `reviewedDate`.
- No images from the audit's section 9.
- Keep the "Source-listed … Business-owner confirmation is still pending" framing and the operator fine print.
- `scripts/check.mjs` rules still hold: exactly 31 trail records, one H1, valid JSON-LD, no broken internal links, gzip budgets.
- Phone format stored: `^\d{3}-\d{3}-\d{4}$`. `tel:` href: `tel:+1` plus the digits.
- Don't edit `CLAUDE.md` (untracked, owner's file). Never stage `scratchpad/`, `site_updates.json`, or `CLAUDE.md`.

## Review Focus

1. **An override for an id that no longer exists** (the source renamed or dropped it) must fail the build loudly, not apply silently to nothing. Test in Task 1.
2. **`website: null` on a sponsor or tetonflats record** must remove the "Visit linked website" button, not render `href="null"`. Test in Task 3.
3. **A removed listing that other data still references**: its photo, the `listing-ids` allowlist for corrections, related-listing cards. The build has to stay green, and corrections to it are refused. Test in Task 4.
4. **The phone is shown only where one is set**, with no empty "Phone" row elsewhere, and the JSON-LD `telephone` matches the visible number. Test in Task 2.
5. **An alias merge must not change `tributary-formerly-huntsman-springs`'s category or photo**, since the earlier source (tetonflats) wins. Test in Task 4.

---

### Task 1: Overrides mechanism

**Files:**
- Create: `src/lib/overrides.ts`, `data/overrides.json`, `tests/overrides.test.mjs`
- Modify: `src/data.ts` (apply after the merge, before the address-conflict pass), `src/pages/[...resource].ts:18` (`_redirects`), `docs/EDITORIAL.md` (new "Reviewed overrides" section)

**Interfaces:**
- Produces: `data/overrides.json` shape:
  `{ "listings": { [id]: { website?: string | null, phone?: string, phoneSource?: string, reason: string, decidedAt: string } }, "removed": { [id]: { redirect: string, reason: string, decidedAt: string } } }`
- Produces: `export function applyOverrides(listings: Listing[], overrides: Overrides): { listings: Listing[]; removed: { id: string; redirect: string }[] }` in `src/lib/overrides.ts`. `null` deletes the field. It throws `Error('Override for unknown listing: <id>')` for any id absent from the input, and throws if a `redirect` doesn't match `^/categories/(outdoors|food-drink|arts-culture|shopping|wellness|stays|services)/$`.
- Produces: `export async function loadRemovedRedirects(): Promise<{ id: string; redirect: string }[]>` in `src/data.ts`, for `_redirects`.

- [ ] **Step 1: Write failing tests** in `tests/overrides.test.mjs` (pure function, fixture listings):
  - `applies field overrides and clears fields set to null`: `website: null` removes `website`; `phone` is set.
  - `removes listings and returns their redirects`
  - `throws on an override for an unknown listing`: `/Override for unknown listing: ghost/`
  - `throws on a redirect outside the category pages`: `{ redirect: '/elsewhere/' }`
  - `the shipped overrides file applies to the real listings`: `await loadListings()` doesn't throw, and `loadRemovedRedirects()` returns an array.
- [ ] **Step 2: Run** `node --test tests/overrides.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `applyOverrides`, wire it into `loadListings` (read `data/overrides.json`, missing file = `{listings:{},removed:{}}`), and append `/places/<id>/ <redirect> 301` lines to `_redirects` after the alias lines. Start `data/overrides.json` as `{"listings":{},"removed":{}}`.
- [ ] **Step 4: Document** in `docs/EDITORIAL.md`: what overrides are for, that every entry needs a reason and date, that unknown ids fail the build, and that removals 301 to the category page.
- [ ] **Step 5: Run** `npm run check`. Expected: PASS, with the same 458 listings and 31 trails.
- [ ] **Step 6: Commit** `git add src/lib/overrides.ts src/data.ts "src/pages/[...resource].ts" data/overrides.json tests/overrides.test.mjs docs/EDITORIAL.md && git commit -m "Add reviewed listing overrides that survive data re-imports"`

### Task 2: Phone field on listings

**Files:**
- Modify: `src/lib/listing-schema.ts`, `src/pages/places/[id].astro` (facts at :21, JSON-LD at :28, visit panel at :53–55)
- Test: `tests/site.test.mjs`

**Interfaces:**
- Consumes: Task 1 overrides (`phone`, `phoneSource`).
- Produces: `phone?: string` (regex `^\d{3}-\d{3}-\d{4}$`) and `phoneSource?: string` on `Listing`.

- [ ] **Step 1: Write failing tests** in `tests/site.test.mjs`:
  - `schema accepts a well-formed phone and rejects others`: `listingSchema` accepts `208-354-2344`, and rejects `(208) 354-2344` and `208-354-23`.
  - `listing pages show a phone only when one is set`: for every listing with `phone`, its page has `href="tel:+1<digits>"`, and the Place JSON-LD `telephone` equals the stored value. For every listing without one, there's no `tel:` link and no `<dt>Phone</dt>`. Until Task 5 adds data, no listing has a phone, so the test calls `t.skip('no phones until Task 5')` when the with-phone set is empty, and still checks the without-phone half.
- [ ] **Step 2: Run** `npm run build && node --test tests/site.test.mjs`. Expected: the schema test FAILS.
- [ ] **Step 3: Implement.**
  - Add the `phone` and `phoneSource` fields to the schema.
  - In `[id].astro`, push `['Phone', <a href=tel:…>]` into `facts` when set, and add a `<a class="button secondary" href="tel:…">Call {phone}</a>` in the visit panel above Maps.
  - Add `telephone: item.phone` to the Place JSON-LD when set.
  - Don't change the Place `@type`.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "Show business phone numbers on listing pages when a reviewed one exists"`

### Task 3: Link removals and replacements (spec tables A and B, plus the http sweep)

**Files:**
- Modify: `data/overrides.json`
- Create: `research/audit-2026-10-20.md` (verification evidence and the full Deferred list from the spec, the PR-notes source)
- Test: `tests/overrides.test.mjs`

**Interfaces:**
- Consumes: Task 1's `listings` override shape.

- [ ] **Step 1: Write failing tests:**
  - `audit spam and dead links are gone`: for every id in spec table A that is not also in table D, the merged listing has no `website`. Also, `rg -i "cryotherapyidaho|tetonfloors|threepeaksdinnertable|warbirdscafe"` finds no matches in `dist/` (built-page check).
  - `audit replacements are applied`: for each spec table B row (except `servpro`), `website` equals the new URL exactly.
  - `pages for listings without a website render no website button`: `dist/places/warbirds-cafe/index.html` lacks `listing_website` and contains no `href="null"`.
- [ ] **Step 2: Run** `node --test tests/overrides.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Add the overrides.**
  - Table A rows become `{ website: null, reason }`.
  - Table B rows become `{ website, reason }`. Reason text is the spec's "why", or "moved: <old> redirects here" / "https verified 2026-10-20".
- [ ] **Step 4: http sweep.**
  - Run a script against the merged listings (keep the script outside the repo) that lists every remaining `website` starting `http://`.
  - For each one, request the https version. Add an override only if it returns 2xx/3xx and the page title or body contains the listing name (case-insensitive, first significant word).
  - Record every switched and every skipped URL in `research/audit-2026-10-20.md`.
- [ ] **Step 5: Write `research/audit-2026-10-20.md`.**
  - What the audit claimed and what we verified, in the spec's findings in brief.
  - The applied tables, the http-sweep results, and the spec's Deferred and Rejected lists verbatim.
  - Note that the source files are untracked in `scratchpad/`.
- [ ] **Step 6: Run** `npm run check`. Expected: PASS.
- [ ] **Step 7: Commit** `git add data/overrides.json research/audit-2026-10-20.md tests/overrides.test.mjs && git commit -m "Remove spam and dead listing links and apply verified site moves"`

### Task 4: Merge and removals (spec tables C and D)

**Files:**
- Modify: `data/aliases.json`, `data/overrides.json`, `public/data/listing-images.json`, `research/listing-image-review.json`
- Delete: the `jackson-town-square` image files listed in that catalog entry's `variants`
- Test: `tests/overrides.test.mjs`

- [ ] **Step 1: Write failing tests:**
  - `removed listings are gone and redirect to their category`: the six table D ids are absent from `loadListings()`, absent from `src/listing-ids.mjs` (after prepare), and absent from `dist/places/`. Each line `/places/<id>/ /categories/<cat>/ 301` is in `dist/_redirects`.
  - `tributary merges into the tetonflats record`: no `tributary` listing exists, and `tributary-formerly-huntsman-springs` keeps category `outdoors` and its catalog photo. Its `sourceUrls` include the directory source. `dist/_redirects` contains `/places/tributary/ /places/tributary-formerly-huntsman-springs/ 301`.
  - `jackson-town-square photo is withdrawn, not orphaned`: no catalog entry; review decision `withdrawn`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Apply.**
  - Alias `"tributary": "tributary-formerly-huntsman-springs"`.
  - Six `removed` entries.
  - Withdraw the photo (the existing site test requires catalog == approved review items).
- [ ] **Step 4: Run** `npm run check && npm run check:dev`. Expected: PASS, with 451 listings (458 − 6 removed − 1 merged) and still 31 trails.
- [ ] **Step 5: Commit** `git add data/aliases.json data/overrides.json public/data/listing-images.json research/listing-image-review.json tests/overrides.test.mjs && git add -u public && git commit -m "Merge the Tributary duplicate and remove spam and out-of-area listings with redirects"`

### Task 5: Phone data (spec table E)

**Files:**
- Modify: `data/overrides.json`, `research/audit-2026-10-20.md`
- Test: `tests/site.test.mjs` (Task 2's test now runs for real)

- [ ] **Step 1: Generate entries** with a script kept outside the repo, reading `scratchpad/site_updates.json` `phone_hours_address`:
  - Normalize to `ddd-ddd-dddd`, and drop anything that won't normalize.
  - Drop every number used by 2+ rows.
  - Drop ids removed in Task 4.
  - Merge `{ phone, phoneSource: "Oct 18 directory CSV (research/directory-csv-review.json)" }` into existing override entries, using `reason: "phone from Oct 18 directory CSV; owner-unconfirmed"` for new ones.
  - Ignore `new_hours` and `new_address` entirely.
- [ ] **Step 2: Record** the counts (added, dropped as shared, dropped as malformed) and the shared numbers in `research/audit-2026-10-20.md`.
- [ ] **Step 3: Run** `npm run check`. Expected: PASS, and the Task 2 phone test is no longer skipped. Spot-check `dist/places/ace-hardware/index.html` for `tel:+12083542344`.
- [ ] **Step 4: Commit** `git add data/overrides.json research/audit-2026-10-20.md && git commit -m "Add owner-unconfirmed business phone numbers from the reviewed directory CSV"`

### Task 6: Verification and PR

- [ ] **Step 1:** `npm run check && npm run check:dev`. Both PASS.
- [ ] **Step 2:** `rg -i "cryotherapyidaho|tetonfloors|threepeaksdinnertable|warbirdscafe|rogtotomacau" src data dist` returns nothing. Report the `/explore/` HTML size before and after; it should shrink slightly from the removed listings.
- [ ] **Step 3:**
  - Push the `audit-round-1` branch, and open an `audit-round-1` → `dev` PR. This is staging: the owner tests on dev.tetoncounty.us after merging it.
  - The PR body lists every applied change by table, the http-sweep results, every deferred item (from `research/audit-2026-10-20.md`), and the check results.
  - Don't merge it, and don't open the `dev` → `main` PR, without the owner's go-ahead.
