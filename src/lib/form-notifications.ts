interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface NotificationEnvironment {
  DB: { prepare(sql: string): Statement };
  FORMSPREE_FORM_ID?: string;
  FORMSPREE_HOUSING_FORM_ID?: string;
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
interface HousingInquiry {
  id: string;
  requester: 'individual' | 'employer';
  name: string;
  email: string;
  phone: string;
  company: string;
  units: number;
  bedrooms: string;
  move_in: string;
  stay_length: string;
  message: string;
  created_at: string;
}
interface DeliveryOptions {
  queue?: 'submissions' | 'housing';
  submissionId?: string;
  limit?: number;
  fetcher?: typeof fetch;
  now?: () => number;
}

const labels = { addition: 'New listing suggestion', correction: 'Listing correction', contact: 'Contact request' };
const maxAttempts = 8;

/** SQL identifiers come only from this table, never from request data. */
const queues = {
  submissions: { table: 'submissions', notifications: 'submission_notifications', idColumn: 'submission_id', formId: (env: NotificationEnvironment) => env.FORMSPREE_FORM_ID, payload: notificationPayload },
  housing: { table: 'housing_inquiries', notifications: 'housing_notifications', idColumn: 'inquiry_id', formId: (env: NotificationEnvironment) => env.FORMSPREE_HOUSING_FORM_ID, payload: housingPayload },
};

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

/** Housing inquiries are forwarded to their own Formspree form with only reviewed fields. */
export function housingPayload(row: HousingInquiry, siteUrl = 'https://tetoncounty.us') {
  return {
    subject: `TetonCounty.us: Housing inquiry — ${row.requester === 'employer' ? `employer · ${row.company}` : 'individual'}, ${row.units} unit(s) [${row.id.slice(0, 8)}]`,
    name: row.name,
    email: row.email, // Formspree uses this as Reply-To.
    phone: row.phone,
    company: row.company,
    requester: row.requester,
    units: row.units,
    bedrooms: row.bedrooms,
    moveIn: row.move_in,
    stayLength: row.stay_length,
    message: row.message,
    reference: row.id,
    submittedAt: row.created_at,
    source: `${siteUrl}/corporate-housing/`,
  };
}

/** Save-first delivery with a short lease to prevent concurrent requests/cron runs sending twice. */
export async function deliverNotifications(env: NotificationEnvironment, options: DeliveryOptions = {}) {
  const { queue = 'submissions', submissionId = '', limit = 10, fetcher = fetch, now = Date.now } = options;
  const { table, notifications, idColumn, formId, payload } = queues[queue];
  const form = formId(env);
  if (env.LOCAL_PREVIEW === true || env.ENVIRONMENT === 'development' || !form) return;
  if (!/^[a-zA-Z0-9]{6,32}$/.test(form)) throw new Error('Invalid Formspree form ID.');
  const endpoint = `https://formspree.io/f/${form}`;

  await env.DB.prepare(`UPDATE ${notifications} SET status = 'failed', last_error = 'attempts_exhausted' WHERE status = 'sending' AND attempts >= ? AND next_attempt_at <= ?`).bind(maxAttempts, now()).run();
  for (let index = 0; index < limit; index++) {
    const timestamp = now();
    const claimed = await env.DB.prepare(`UPDATE ${notifications}
      SET status = 'sending', attempts = attempts + 1, next_attempt_at = ?
      WHERE ${idColumn} = (SELECT ${idColumn} FROM ${notifications}
        WHERE status IN ('pending', 'sending') AND attempts < ? AND next_attempt_at <= ?
        AND (? = '' OR ${idColumn} = ?) ORDER BY next_attempt_at, ${idColumn} LIMIT 1)
      RETURNING ${idColumn} AS id, attempts`).bind(timestamp + 120_000, maxAttempts, timestamp, submissionId, submissionId)
      .first<{ id: string; attempts: number }>();
    if (!claimed) return;
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(claimed.id).first<Submission | HousingInquiry>();
    let error = 'missing_submission';
    let retryable = false;
    let accepted = false;
    if (row) {
      try {
        const body = payload(row as never, env.SITE_URL);
        const response = await fetcher(endpoint, {
          method: 'POST',
          // Formspree's domain restriction reads Origin/Referer, which a server-side request lacks; send the form page.
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: new URL(body.source).origin, Referer: body.source },
          body: JSON.stringify(body),
          // Workers reject redirect: 'error'; with 'manual' a redirect is a non-2xx status recorded as http_3xx.
          redirect: 'manual',
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
      await env.DB.prepare(`UPDATE ${notifications} SET status = 'sent', sent_at = ?, last_error = NULL WHERE ${idColumn} = ?`)
        .bind(new Date(now()).toISOString(), claimed.id).run();
    } else {
      const retry = retryable && claimed.attempts < maxAttempts;
      const delay = Math.min(300_000 * 2 ** (claimed.attempts - 1), 21_600_000);
      await env.DB.prepare(`UPDATE ${notifications} SET status = ?, next_attempt_at = ?, last_error = ? WHERE ${idColumn} = ?`)
        .bind(retry ? 'pending' : 'failed', now() + delay, error, claimed.id).run();
    }
  }
}
