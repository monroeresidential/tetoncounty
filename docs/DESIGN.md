# The Field Guide redesign

Implemented from the October 18, 2026 handoff, `Teton County website redesign.zip`. Its `README.md` and `Teton Valley Site.dc.html` are the visual references; prototype runtime code is not shipped.

## Design system

- `public/assets/styles.css` owns the Classical palette, typography, hairlines, photograph frames, and responsive layouts.
- Cormorant Garamond is the display face; Lora is the reading face. Latin WOFF2 files are self-hosted with the SIL Open Font License for each family. Google Fonts served identical normal files for weights 400 and 500, so each family shares one variable normal font file.
- Gold is used for outlines and decorative large text. Small text uses the darker `--color-accent-700`; secondary labels use `--color-neutral-700` for legibility.
- Photographs retain the existing provenance in `public/data/image-sources.json`; the frame applies the specified subtle sepia treatment.
- The 1100, 760, and 420px breakpoints progressively collapse grids, move sticky sidebars into flow, and expose the mobile navigation menu.
- Rise, image reveal, slow pan, and seasonal marquee animations run only when reduced motion is not requested. The marquee pauses on hover or keyboard focus. Category images also follow keyboard focus.

## Components and behavior

`Header`, `Footer`, and `SponsorCard` provide shared navigation and sponsor credits. Home adds the category photo index, live inventory counts, favorites, trail feature, towns, and seasonal links. `Directory` and `ListingCard` serve all categories, hiking, towns, and related records. Hiking filters support `difficulty=easy|moderate|hard`, combined with existing search, season, and map state in the URL. Card figures come from the curated inventory, not the prototype's sample data.

The request-type buttons update the existing hidden select. Addition, correction, and contact values, conditional validation, honeypot, Turnstile verification, Worker API, D1 review queue, and Formspree notifications are preserved. The form never turns suggestions into apartment leads. Analytics remains production-only and does not receive form fields.

## Validation

Run `npm run check` for types, generated pages, structured data, inventory consistency, submission/notification tests, links, and asset budgets. Browser QA covers every page template at the responsive breakpoints, keyboard menu controls, URL-based filtering, mapped results, correction deep links, request-type changes, and a local-only contact submission. Check real-device behavior and field performance after publication; no new Lighthouse baseline was established during this redesign.

## Font sources

- [Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond)
- [Lora](https://github.com/google/fonts/tree/main/ofl/lora)
