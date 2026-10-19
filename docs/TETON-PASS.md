# Teton Pass page

`/teton-pass/` shows Teton Pass (WY-22) status, drive times between Victor/Driggs and Jackson, Teton Village, and the airport in both directions, summit weather, and a "When should you leave?" chart. The data comes from [tetonpasscam.com](https://tetonpasscam.com) (source: `monroeresidential/tetonpasscam`), which polls WYDOT and Google Routes about every 10 minutes.

## How it works

- tetonpasscam.com's API sends no CORS headers, so the Worker proxies it: `GET /api/pass` → `/api/status` (60 s edge cache) and `GET /api/pass-history?route=<slug>` → `/api/history` (300 s). Route slugs are allowlisted (`victor|driggs` × `jackson|tetonvillage|airport` × `eb|wb`).
- `src/lib/pass.ts` passes through only the fields the page shows. Malformed data, a missing or dead poller, or any fetch failure becomes `unknown`, never `open`.
- `src/scripts/pass.ts` renders the page and refreshes every five minutes while visible. The chart compares today's samples with the typical median and 25th–75th percentile range for the current weekday/weekend and summer/winter bucket in Mountain time.

## Display rules (mirrored from tetonpasscam.com)

- Closed uses tetonpasscam.com's exact warning: "Do not attempt. A closed Wyoming road is illegal — up to $750." Never soften it or estimate a reopening.
- Closed or unknown withholds drive times, and the chart note says earlier readings are history.
- "About usual" is within ±5 minutes of typical; stale rows show no comparison.
- Typical winter data starts accruing in November. Until then the chart shows today's line with a "still being collected" note.

If tetonpasscam.com changes these rules or its API, update `src/lib/pass.ts` and `tests/pass.test.mjs` to match.
