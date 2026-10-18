# Deploy to GitHub and Cloudflare

This project targets **Cloudflare Workers with Static Assets**, using GitHub for source. The Sites service is not required. No Cloudflare resources or public deployment have been created by this initial build.

## 1. GitHub

Create or select the user's chosen repository. From this project, initialize Git if needed, commit reviewed source, set the supplied remote, and push. Never commit `.local`, `.env`, `.dev.vars`, `.wrangler`, raw private submissions, or credentials. The included checks workflow runs on push and pull requests.

## 2. Cloudflare prerequisites

```sh
npm ci
npx wrangler login
npx wrangler d1 create tetonvalley-submissions
```

Copy the returned **database ID** into `wrangler.jsonc`. Preserve the `DB` binding. The database name is `tetonvalley-submissions`.

Create a Turnstile widget in the same Cloudflare account, allowing `tetonvalley.us` (and any intended preview host). Put its **public site key** in `vars.TURNSTILE_SITE_KEY` and save its **secret** using:

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

In Cloudflare Workers & Pages, import the selected GitHub repository as a Worker project. Set:

| Setting | Value |
| --- | --- |
| Build command | `npm run check && node scripts/preflight.mjs` |
| Deploy command | `npx wrangler deploy` |
| Root directory | repository root |
| Node version | 24 LTS |
| Worker name | `tetonvalley-us` |

Set `TURNSTILE_SECRET` in the Worker's secrets. Keep migrations an explicit release step, separate from pull-request builds. Production bindings should not be reused for a public preview that accepts form submissions; use a separate environment/database and appropriate origin/Turnstile hostname settings if adding previews.

## 4. Domain

Add **tetonvalley.us** as the Worker's custom domain in Cloudflare. The domain must be in the same accessible account. Allow Cloudflare to provision HTTPS. If adding `www.tetonvalley.us`, create a permanent redirect to the apex; the canonical site URL is `https://tetonvalley.us`.

Do not replace existing DNS records until their current use has been reviewed. Domain registration with Cloudflare does not itself deploy this Worker or grant this project account access.

## 5. Production acceptance

Verify the homepage, a listing, a category, `/hiking/`, `/sitemap.xml`, `/llms.txt`, `/data/listings.json`, and an unknown URL (real 404). Check CSP and local font/image delivery. Exercise a new listing, correction, and contact request on the live form; verify each row in D1 and check no contact information appears in public exports. Confirm spam verification and rate limits with separate controlled test data.

No email is sent by the current form handler. D1 is the review queue. Establish an editor and follow `EDITORIAL.md` before advertising the contact form publicly.

## References

- [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
