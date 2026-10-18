# Deploy to GitHub and Cloudflare

This project uses **Cloudflare Workers with Static Assets**, with source at [monroeresidential/tetoncounty](https://github.com/monroeresidential/tetoncounty). The Sites service is not required.

Astro builds static HTML and hashed browser assets into `dist/`. Use Node 24 or newer. The existing Worker serves the submission API; an Astro Cloudflare server-rendering adapter is not needed. Framework upgrades do not require new D1 resources, DNS changes, or replacement Turnstile credentials.

## Production resources

- Canonical domain: `https://tetoncounty.us`.
- Worker: `tetoncounty-us`; diagnostic URL: `https://tetoncounty-us.0x3639.workers.dev`.
- D1: `tetonvalley-submissions`, bound as `DB`; initial migration applied.
- Turnstile: managed widget restricted to `tetoncounty.us`; public key in `wrangler.jsonc`, secret stored only in Cloudflare.
- Formspree: `https://formspree.io/f/meaedrjo`; the form ID is public and configured in `FORMSPREE_FORM_ID`. Notification recipients are managed in Formspree; the intended editor is `drew@monroeresidential.com`.
- Production configuration is checked into Git. Credentials, local submissions, and build output are ignored.

The setup steps below document provisioning and recovery. Do not create duplicate production resources when deploying updates.

## 1. GitHub

The repository is `monroeresidential/tetoncounty`, with production branch `main`. Commit reviewed source and push to the existing `origin`. Never commit `.local`, `.env`, `.dev.vars`, `.wrangler`, raw private submissions, or credentials. The included GitHub checks workflow runs on push and pull requests.

## 2. Cloudflare prerequisites

```sh
npm ci
npx wrangler login
npx wrangler d1 create tetonvalley-submissions
```

Copy the returned **database ID** into `wrangler.jsonc`. Preserve the `DB` binding. The database name is `tetonvalley-submissions`.

Create a Turnstile widget in the same Cloudflare account, allowing `tetoncounty.us` (and any intended preview host). Put its **public site key** in `vars.TURNSTILE_SITE_KEY` and save its **secret** using:

```sh
npx wrangler secret put TURNSTILE_SECRET
```

The public key is safe in Git; the secret is not. `SITE_URL` must match the live canonical origin exactly, without a trailing slash. The API checks both the submitted Origin and Turnstile hostname/action. Production has no local-preview bypass: `LOCAL_PREVIEW` is only a boolean supplied by the local Node server.

```sh
npm run db:migrate
npm run deploy
```

The deploy command validates the whole site, rejects placeholder configuration, and publishes static assets plus the Worker. The `run_worker_first` rule only selects `/api/*`; normal page delivery is static. A deployment with missing runtime secrets will keep forms disabled until they are configured.

## 3. GitHub build integration

Cloudflare Builds targets `monroeresidential/tetoncounty`, with validation and deployment on pushes to `main`. The repository is included in the existing Cloudflare Workers & Pages GitHub App's selected repositories. The existing account build token is reused; no credentials are stored in Git. Current settings in the `tetoncounty-us` Worker's Settings → Builds:

| Setting | Value |
| --- | --- |
| Build command | `npm run check && node scripts/preflight.mjs` |
| Deploy command | `npx wrangler deploy` |
| Root directory | repository root |
| Production branch | `main` |
| Node version | `NODE_VERSION=24` |
| Worker name | `tetoncounty-us` |

`TURNSTILE_SECRET` is already stored in the Worker's runtime secrets and persists across deploys. It is not a build variable. Keep migrations an explicit release step, separate from pull-request builds. Disable builds for non-production branches. Use a separate environment/database and appropriate origin/Turnstile hostname settings if adding previews later.

## 4. Domain

**tetoncounty.us** is configured as the Worker's custom domain in `wrangler.jsonc`, which provisions DNS and HTTPS on deployment. If adding `www.tetoncounty.us`, create a permanent redirect to the apex; the canonical site URL is `https://tetoncounty.us`. The `www` alias is not configured in the initial release.

Do not replace existing DNS records until their current use has been reviewed. Domain registration with Cloudflare does not itself deploy this Worker or grant this project account access.

## 5. Production acceptance

Astro migration validation: all 442 HTML paths, the 426-record public inventory, sitemap, alias redirects, and both LLM exports match the previous release. Strict type checking and 15 tests pass. Browser checks cover desktop and mobile navigation, search and filters, lazy map loading, and locally persisted addition, correction, and contact requests.

Initial deployment checks on October 18, 2026: HTTPS homepage, directory, Victor and Driggs pages, a category and listing, hiking guide, sitemap, both LLM text files, public JSON, API configuration, and a real 404 all passed. Canonical URLs and security headers were verified. The D1 schema is applied; the form API is enabled and rejects cross-origin requests and requests without Turnstile verification. The live widget renders. A successful production submission still needs a human Turnstile check; no test submission was inserted into production.

Verify the homepage, a listing, a category, `/hiking/`, `/sitemap.xml`, `/llms.txt`, `/data/listings.json`, and an unknown URL (real 404). Check CSP and local font/image delivery. Exercise a new listing, correction, and contact request on the live form; verify each row in D1 and check no contact information appears in public exports. Confirm spam verification and rate limits with separate controlled test data.

Formspree delivers editor notifications and maintains its own private inbox. D1 remains the durable review queue. The sender's `email` field supplies Formspree's Reply-To address; it does not choose the notification recipient. Confirm the recipient and email action in Formspree. No acknowledgement or marketing email is sent to visitors.

Before deploying the notification integration, run `npm run db:migrate` to apply `0002_submission_notifications.sql`. Its trigger atomically queues new saved requests; pre-existing records are not sent retroactively. The five-minute Worker cron retries temporary delivery errors. A row marked `sent` means Formspree accepted it, not that the recipient read it or that inbox delivery is independently confirmed. See `EDITORIAL.md` for failed-delivery recovery.

Cloudflare Turnstile remains the public form's spam check. If Formspree rejects forwarded requests because of additional CAPTCHA or domain rules, inspect the form's configuration and delivery error before changing protections. Do not bypass a CAPTCHA or publish a browser-facing administrative API key.

## References

- [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
