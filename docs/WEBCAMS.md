# Webcams

`/webcams/` shows the latest image from each camera in the Teton Flats webcam feed, grouped by travel corridor. It is public: linked from the header and footer, listed in the sitemap, and indexable.

## How it works

- Feed: `https://teton-flats-webcam.nyc3.cdn.digitaloceanspaces.com/cameras.geojson`, a GeoJSON `FeatureCollection` of points with `name`, `image_url`, `approximate`, `source` (`wydot`, `faa`, or `direct`), and `site` or `camera_id`.
- The bucket's CORS policy admits only `https://tetoncounty.us`, so browsers on `dev.tetoncounty.us` and localhost cannot read the feed directly. The Worker serves `GET /api/webcams`, fetches the feed with a 60-second edge cache, and returns validated cameras. Local `npm run dev` uses the same handler.
- `src/lib/webcams.ts#parseWebcams` keeps only HTTPS JPEG images on the feed's own bucket, skips malformed points and duplicates, and assigns each camera an area from its folder name, keeping each folder's cameras together (the FAA KJAC cameras sit with the airport parking cameras). Unknown folders appear under "More cameras" instead of failing.
- `src/scripts/webcams.ts` renders the cards with DOM text nodes (no HTML from the feed) and reloads images every five minutes while the tab is visible. Each frame takes its image's own aspect ratio (FAA images are 4:3 with a timestamp bar on top; JHMR Roundshots are wide panoramas), and failed images show “Camera temporarily unavailable.”
- Clicking an image opens a `<dialog>` lightbox that steps through every camera in page order (arrow buttons, ←/→ keys, or swipe; Esc or the backdrop closes it and returns focus to the card). Modified clicks still open the full-size image in a new tab, and the lightbox image refreshes with the cards. Images load directly from the bucket; `public/_headers` allows that origin in `img-src` only.
- The feed has no capture timestamps and the images are served without CORS, so the page cannot show when each frame was taken. It says "last checked," not "updated at." WYDOT frames carry their own burned-in time.

## Open items

1. Keep reuse rights and credit wording current for WYDOT, Jackson Hole Airport, Jackson Hole Mountain Resort (Roundshot), and TetonCam images.
2. Decide whether Raymond (about 140 miles south) and the airport parking cameras belong in a Teton Valley guide.
3. Optional: add a per-image capture time to the feed so cards can flag stale frames, and show camera points on the existing Leaflet map.
