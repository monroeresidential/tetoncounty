import { siteUrl } from '../config.ts';

export const sponsorHome = 'https://tetonflats.com/';
// Templated sections share one campaign; the specific page goes in utm_term.
const templatedSections = new Set(['places', 'categories', 'towns']);

export const isSponsorUrl = (url: string) => {
  try { const host = new URL(url).hostname; return host === 'tetonflats.com' || host.endsWith('.tetonflats.com'); } catch { return false; }
};

/** Campaign names the guide page; tetonflats.com only receives our origin as referrer, so UTMs carry the page. */
export function sponsorCampaign(pathname: string) {
  const [section = 'home', slug] = pathname.replace(/\.html$/, '').split('/').filter(Boolean);
  return { campaign: `tetoncounty_${section.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`, term: templatedSections.has(section) ? slug : undefined };
}

/** Adds the shared UTM set to Teton Flats URLs and leaves every other URL untouched. */
export function sponsorLink(url: string, pathname: string, placement: string) {
  return isSponsorUrl(url) ? trackedLink(url, pathname, placement) : url;
}

/** The same UTM set for partner sites we link to deliberately, such as tetonpasscam.com. */
export function trackedLink(url: string, pathname: string, placement: string) {
  const link = new URL(url);
  const { campaign, term } = sponsorCampaign(pathname);
  link.searchParams.set('utm_source', new URL(siteUrl).host);
  link.searchParams.set('utm_medium', 'referral');
  link.searchParams.set('utm_campaign', campaign);
  link.searchParams.set('utm_content', placement);
  if (term) link.searchParams.set('utm_term', term);
  return link.href;
}
