import {readFile} from 'node:fs/promises';
const source=await readFile('wrangler.jsonc','utf8');
if(source.includes('REPLACE_WITH_D1_DATABASE_ID')||source.includes('"TURNSTILE_SITE_KEY": ""')){
  console.error('Deployment setup is incomplete. Configure the D1 database ID and Turnstile public key in wrangler.jsonc, set the Turnstile secret, and follow docs/DEPLOYMENT.md.');
  process.exit(1);
}
