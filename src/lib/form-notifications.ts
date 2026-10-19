interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface NotificationEnvironment {
  DB: { prepare(sql: string): Statement };
  FORMSPREE_FORM_ID?: string;
  SITE_URL?: string;
  LOCAL_PREVIEW?: boolean;
  ENVIRONMENT?: string;
}
interface Submission {
  id: string;
  type: 'addition' | 'correction' | 'contact';
  listing_id: string | null;
  name: string;
  email: string;
  place_name: string;
  town: string;
  website: string;
  message: string;
  created_at: string;
}
interface DeliveryOptions {
  submissionId?: string;
  limit?: number;
  fetcher?: typeof fetch;
  now?: () => number;
}

const labels = { addition: 'New listing suggestion', correction: 'Listing correction', contact: 'Contact request' };
const maxAttempts = 8;

/** Only forwards reviewed fields to the configured Formspree endpoint; never public request options. */
export function notificationPayload(row: Submission, siteUrl = 'https://tetoncounty.us') {
  return {
    subject: `TetonCounty.us: ${labels[row.type]} [${row.id.slice(0, 8)}]`,
    name: row.name,
    email: row.email, // Formspree uses this as Reply-To; the recipient lives in Formspree settings.
    message: row.message,
    requestType: labels[row.type],
    reference: row.id,
    submittedAt: row.created_at,
    source: `${siteUrl}/suggest/`,
    ...(row.type === 'addition' ? { placeName: row.place_name, town: row.town, website: row.website } : {}),
    ...(row.type === 'correction' ? { listingUrl: `${siteUrl}/places/${row.listing_id}/` } : {}),
    reviewStatus: 'Pending review. This request has not been published.',
  };
}

/** Save-first delivery with a short lease to prevent concurrent requests/cron runs sending twice. */
export async function deliverNotifications(env: NotificationEnvironment, options: DeliveryOptions = {}) {
  if (env.LOCAL_PREVIEW === true || env.ENVIRONMENT === 'development' || !env.FORMSPREE_FORM_ID) return;
  if (!/^[a-zA-Z0-9]{6,32}$/.test(env.FORMSPREE_FORM_ID)) throw new Error('Invalid Formspree form ID.');
  const { submissionId = '', limit = 10, fetcher = fetch, now = Date.now } = options;
  const endpoint = `https://formspree.io/f/${env.FORMSPREE_FORM_ID}`;

  await env.DB.prepare("UPDATE submission_notifications SET status = 'failed', last_error = 'attempts_exhausted' WHERE status = 'sending' AND attempts >= ? AND next_attempt_at <= ?").bind(maxAttempts, now()).run();
  for (let index = 0; index < limit; index++) {
    const timestamp = now();
    const claimed = await env.DB.prepare(`UPDATE submission_notifications
      SET status = 'sending', attempts = attempts + 1, next_attempt_at = ?
      WHERE submission_id = (SELECT submission_id FROM submission_notifications
        WHERE status IN ('pending', 'sending') AND attempts < ? AND next_attempt_at <= ?
        AND (? = '' OR submission_id = ?) ORDER BY next_attempt_at, submission_id LIMIT 1)
      RETURNING submission_id, attempts`).bind(timestamp + 120_000, maxAttempts, timestamp, submissionId, submissionId)
      .first<{ submission_id: string; attempts: number }>();
    if (!claimed) return;
    const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(claimed.submission_id).first<Submission>();
    let error = 'missing_submission';
    let retryable = false;
    let accepted = false;
    if (row) {
      try {
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(notificationPayload(row, env.SITE_URL)),
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const result = await response.json() as { ok?: boolean };
          accepted = result.ok === true;
          error = 'provider_not_accepted';
        } else {
          error = `http_${response.status}`;
          retryable = response.status === 429 || response.status >= 500;
        }
      } catch {
        error = 'network_or_response_error';
        retryable = true;
      }
    }
    if (accepted) {
      await env.DB.prepare("UPDATE submission_notifications SET status = 'sent', sent_at = ?, last_error = NULL WHERE submission_id = ?")
        .bind(new Date(now()).toISOString(), claimed.submission_id).run();
    } else {
      const retry = retryable && claimed.attempts < maxAttempts;
      const delay = Math.min(300_000 * 2 ** (claimed.attempts - 1), 21_600_000);
      await env.DB.prepare('UPDATE submission_notifications SET status = ?, next_attempt_at = ?, last_error = ? WHERE submission_id = ?')
        .bind(retry ? 'pending' : 'failed', now() + delay, error, claimed.submission_id).run();
    }
  }
}
