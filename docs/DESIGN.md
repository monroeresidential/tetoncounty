# The Field Guide redesign

Implemented from the October 18, 2026 handoff, `Teton County website redesign.zip`. Its `README.md` and `Teton Valley Site.dc.html` are the visual references; prototype runtime code is not shipped.

## Design system

- `public/assets/styles.css` owns the Classical palette, typography, hairlines, photograph frames, and responsive layouts.
- The shared layout includes the approximately 8 KB compressed stylesheet in the HTML, eliminating a render-blocking network request and keeping styles synchronized with each deployed page.
- Cormorant Garamond is the display face; Lora is the reading face. Latin WOFF2 files are self-hosted with the SIL Open Font License for each family. Google Fonts served identical normal files for weights 400 and 500, so each family shares one variable normal font file.
- Gold is used for outlines and decorative large text. Small text uses the darker `--color-accent-700`; secondary labels use `--color-neutral-700` for legibility.
- Photographs retain the existing provenance in `public/data/image-sources.json`; the frame applies the specified subtle sepia treatment.
- The 1100, 760, and 420px breakpoints progressively collapse grids, move sticky sidebars into flow, and expose the mobile navigation menu.
- Hero content appears immediately, without reveal delays or continuous image panning. The seasonal marquee respects reduced motion. The marquee pauses on hover or keyboard focus. Category images follow keyboard focus; hidden photos load only when selected.

## Components and behavior

`Header`, `Footer`, and `SponsorCard` provide shared navigation and sponsor credits. Home adds the category photo index, live inventory counts, favorites, trail feature, towns, and seasonal links. `Directory` and `ListingCard` serve all categories, hiking, towns, and related records. Hiking filters support `difficulty=easy|moderate|hard`, combined with existing search, season, and map state in the URL. Card figures come from the curated inventory, not the prototype's sample data.

The request-type buttons update the existing hidden select. Addition, correction, and contact values, conditional validation, honeypot, Turnstile verification, Worker API, D1 review queue, and Formspree notifications are preserved. The form never turns suggestions into apartment leads. Analytics remains production-only and does not receive form fields. Page-view setup is queued immediately; the Google library downloads at low priority after the load event, using idle time with a bounded fallback.

## Validation

Run `npm run check` for types, generated pages, structured data, inventory consistency, submission/notification tests, links, and asset budgets. Browser QA covers every page template at the responsive breakpoints, keyboard menu controls, URL-based filtering, mapped results, correction deep links, request-type changes, and a local-only contact submission. The October 18 mobile Google PageSpeed baseline was 82 performance, 100 accessibility, 92 best practices, and 100 SEO, with a 4.8-second LCP. The performance pass adds responsive AVIF/WebP images, immediate hero rendering, versioned font caching, and the existing Cloudflare analytics host to CSP. Raw before/after reports stay in the ignored `.local/` directory; the API key is never part of the website or Git repository.

## Font sources

- [Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond)
- [Lora](https://github.com/google/fonts/tree/main/ofl/lora)

## Image delivery and sharing

`src/assets/photos` contains the build inputs for Astro’s image service. `Photo.astro` emits AVIF sources, responsive WebP fallbacks, accurate intrinsic dimensions, and explicit loading priority. The homepage preloads the same responsive AVIF candidates used by its hero. Generated assets have content hashes and immutable cache headers. Original public image URLs remain available for older links and provenance records. Update the build inputs when changing photography. Fonts use the versioned `/assets/fonts/v1/` directory; increment the directory version when replacing font files.

The shared layout provides Open Graph and Twitter metadata in static HTML, with each page’s own title and description and a 1200 × 630 JPEG card. `scripts/social-card.html` is the editable design source: preview the repository with a local static server, render at 1200 × 630 after the fonts load, and export to `public/images/social/teton-valley-v1.jpg`. Use a new filename when changing the card so social platforms can fetch a fresh image. Its regional NPS photo attribution is in `public/data/image-sources.json`.

To repeat Google’s mobile lab test, set `PAGESPEED_API_KEY` in the process environment and run `node scripts/pagespeed.mjs https://tetoncounty.us/ after`. Never add that key to client code or tracked files. Scores vary by run; compare the same URL and mobile settings, and distinguish lab results from real-user Core Web Vitals.
