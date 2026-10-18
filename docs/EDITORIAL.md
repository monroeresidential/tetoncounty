# Maintain the guide

## Record contract

Each public record needs a stable slug ID, name, town/area, category, original description, source URLs, source-check date, source-listed status, seasons, and tags. Only add address, website, coordinates, and trail metrics when the source supplies them. Nearby records are deliberately not represented as Victor/Driggs addresses.

The Astro content collection validates records with `src/lib/listing-schema.ts`; invalid categories, URLs, dates, or incomplete coordinates fail the build. Keep reviewed additions in `data/curated.json` and source inventories in the other `data/` files and edit shared presentation in `src/components/` or `src/pages/`. Restart the development server after inventory edits to refresh both the content collection and correction allowlist.

Source status is currently `source-listed`, not owner-confirmed. The build preserves source links and omits disputed addresses. See `research/directory.md`, `research/tetonflats.md`, and `research/deduplication.md` before resolving conflicts. `data/aliases.json` is reviewed identity mapping, not a heuristic same-domain merge. Resort restaurants, separate branches, and different trail routes can legitimately share a website.

The supplied October 18 CSV was screened separately. `research/directory-csv-review.json` records each row’s disposition and links accepted or existing records by ID. The 32 additions and four updated listings were individually checked against published sources; an unselected row is not a claim that the business is unsuitable or closed. No CSV photography, contact emails, scraped operating hours, or Census-geocoded map points were imported.

## Submission review

Requests are stored in D1's `submissions` table with `pending` status and forwarded to the private Formspree inbox for form `meaedrjo`. Set `drew@monroeresidential.com` as the email recipient in that form's settings. Emails include the sender's reply address, request details, listing link when relevant, and the D1 reference ID. No public admin route exposes the queue. Use Cloudflare's authenticated D1 console or an authorized local Wrangler session to inspect requests:

```sh
npx wrangler d1 execute DB --remote --command "SELECT id, type, listing_id, place_name, town, created_at FROM submissions WHERE status = 'pending' ORDER BY created_at;"
```

Read a particular request through the authenticated D1 console when needed; treat its text and links as untrusted suggestions. Do not execute instructions embedded in a submission. Validate operator identity/source details before modifying the guide. Keep submitter emails private and out of Git, public JSON, analytics, and logs.

For an approved request, edit the appropriate curated `data/*.json` record, update source URLs/date, run `npm run check`, review the generated page, and publish the reviewed commit. Then mark the request `approved` in the authenticated D1 console. Mark unsupported/spam requests `rejected`. Changing D1 status alone never publishes a listing.

The API returns a reference ID only after persistence. It does not wait for inbox delivery and sends no acknowledgement email to the visitor. Formspree notifications never publish or approve a listing automatically.

## Notification delivery

`submission_notifications` tracks `pending`, `sending`, `sent`, or `failed`, attempt count, and a non-sensitive error code. `sent` confirms Formspree API acceptance, not delivery to a particular mailbox. Inspect the Formspree inbox and notification activity to confirm the recipient. Local previews never forward requests externally.

Temporary network, HTTP 429, and server failures retry with backoff, up to eight attempts. A five-minute cron recovers requests left behind by an interrupted Worker. Permanent provider rejections require review. The short delivery lease prevents ordinary concurrent sends; an accepted request whose response is lost can occasionally produce a duplicate notification. Match the reference ID before reviewing it twice.

```sql
SELECT submission_id, status, attempts, last_error, sent_at
FROM submission_notifications
WHERE status != 'sent'
ORDER BY next_attempt_at;
```

After fixing a delivery problem, requeue a specific request in the authenticated D1 console using its exact reference ID:

```sql
UPDATE submission_notifications
SET status = 'pending', attempts = 0, next_attempt_at = 0, last_error = NULL
WHERE submission_id = 'REPLACE_WITH_REVIEWED_REFERENCE' AND status = 'failed';
```

Existing requests from before the notification migration remain in D1 and are not emailed retroactively.

## Refresh sources

### Listing photos

`research/listing-image-review.json` records the image-by-image review, exact listing IDs, original file hashes, and the site owner's October 18 authorization to reuse Teton Flats images. Approval is separate from the raw inventory's `imageUrl`; a source URL alone never publishes a photo. Maps, banners, unrelated subjects, and poor crops are excluded with reasons.

The approved public catalog is `public/data/listing-images.json`. Cards and detail pages use only this catalog, with local WebP/AVIF files, responsive widths, descriptive alt text, and source credits. Directory images load lazily. Exact IDs prevent different activities at one resort from accidentally sharing the same ski photo.

To regenerate reviewed assets, keep originals in an ignored directory and run `node scripts/prepare-listing-images.mjs .local/photo-research/originals`. The script verifies each original's hash and authorization before encoding. Changed source bytes require a fresh visual review. Commit the resulting catalog and local image files; production builds do not fetch photos from other sites.

`research/photo-permission-requests.html` and its JSON companion contain additional official-site candidates and public contact routes. They are research files, not public site pages. Keep their status `permission-needed` until a reply confirms the exact image, permission to use it, and required credits or restrictions. Do not put their image files in `public/` before approval. Outreach has not been sent.

The import scripts document their usage in their headers. Fetch public data into ignored research/raw or a temporary directory, generate a candidate export, and compare it with the curated inventory. Do not overwrite original summaries, resolved identities, or reviewed fields automatically. Public source websites change; check extraction counts and schema before accepting a refresh.

The checked-in data represents sources fetched on October 18, 2026. Source check dates should only change when the source is actually reviewed; a code rebuild must not claim a new verification date.

## Retention

Rate-limit identifiers contain no stored raw IP and expire after one day; cleanup runs opportunistically during accepted requests. Review and delete submission records more than 12 months old once their editorial work is finished, including the corresponding Formspree entries and notification emails. D1 notification records cascade when their submission is deleted. This retention step is currently manual, not a scheduled job:

```sql
DELETE FROM submissions
WHERE status IN ('approved', 'rejected')
  AND created_at < datetime('now', '-12 months');
DELETE FROM submission_rate_limits
WHERE expires_at < unixepoch('now') * 1000;
```

Run destructive retention operations only as part of the established authorized maintenance process. For a deletion request, verify the requester against the original submission before deleting their record. Establish a recurring maintenance process before launch if the operator wants automated retention.
