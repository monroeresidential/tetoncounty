// Teton Pass data comes from tetonpasscam.com. Its display rules are mirrored here so the two sites never disagree:
// status never defaults to open, closed and unknown withhold drive times, and stale rows get no "vs. usual" claim.
export const passSite = 'https://tetonpasscam.com';
export const passStatusUrl = `${passSite}/api/status`;
export const passHistoryUrl = (slug: string) => `${passSite}/api/history?route=${slug}`;
export const wyoming511 = 'https://www.wyoroad.info/highway/conditions/RoadClosures.html';
// Verbatim from tetonpasscam.com: a closed Wyoming road is a legal prohibition, never a recommendation.
export const closedWarning = 'Do not attempt. A closed Wyoming road is illegal — up to $750.';

export const passRouteSlug = /^(victor|driggs)-(jackson|tetonvillage|airport)-(eb|wb)$/;
export type PassStatus = 'open' | 'restricted' | 'closed' | 'unknown';

export interface TravelTime { slug: string; name: string; durationSec: number; typicalSec: number | null; capturedAt: string; stale: boolean }
export interface PassReport {
  status: PassStatus;
  isStale: boolean;
  lastConfirmed: { status: string; at: string } | null;
  wydotReportTime: string | null;
  advisories: string[];
  restrictions: string[];
  travelTimes: TravelTime[];
  weather: { airF: number | null; surfaceF: number | null; windGustMph: number | null; visibilityFt: number | null; reportedAt: string | null } | null;
  weatherStale: boolean;
}
export interface PassTypical { weekdayClass: 'weekday' | 'weekend'; season: 'winter' | 'summer'; hour: number; medianSec: number; p25Sec: number; p75Sec: number }
export interface PassHistory { route: { slug: string; name: string }; typicals: PassTypical[]; today: { capturedAt: string; durationSec: number }[] }

const text = (value: unknown, max = 160) => (typeof value === 'string' ? value.trim().slice(0, max) : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const time = (value: unknown) => { const t = text(value, 40); return t && !Number.isNaN(Date.parse(t)) ? t : null; };
const texts = (value: unknown) => (Array.isArray(value) ? value.map(item => text(item, 80)).filter((item): item is string => !!item).slice(0, 6) : []);

/** Keeps only the fields this site shows; anything malformed degrades to unknown rather than open. */
export function parsePassStatus(input: unknown): PassReport {
  const data = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const raw = ['open', 'restricted', 'closed', 'unknown'].includes(data.status) ? data.status as PassStatus : 'unknown';
  const weather = data.weather && typeof data.weather === 'object' ? data.weather : null;
  return {
    status: data.pollerDead === false ? raw : 'unknown',
    isStale: data.isStale !== false,
    lastConfirmed: data.lastConfirmed && time(data.lastConfirmed.at) ? { status: text(data.lastConfirmed.status, 20) ?? 'unknown', at: time(data.lastConfirmed.at)! } : null,
    wydotReportTime: time(data.wydotReportTime),
    advisories: texts(data.advisories),
    restrictions: texts(data.restrictions),
    travelTimes: (Array.isArray(data.travelTimes) ? data.travelTimes : []).flatMap((row: any): TravelTime[] => {
      const slug = text(row?.slug, 40), name = text(row?.name, 60), durationSec = number(row?.durationSec), capturedAt = time(row?.capturedAt);
      if (!slug || !passRouteSlug.test(slug) || !name || durationSec === null || durationSec <= 0 || !capturedAt) return [];
      return [{ slug, name, durationSec, typicalSec: number(row.typicalSec), capturedAt, stale: row.stale !== false }];
    }),
    weather: weather ? { airF: number(weather.airF), surfaceF: number(weather.surfaceF), windGustMph: number(weather.windGustMph), visibilityFt: number(weather.visibilityFt), reportedAt: time(weather.reportedAt) } : null,
    weatherStale: data.weatherStale !== false,
  };
}

export function parsePassHistory(input: unknown, slug: string): PassHistory {
  const data = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  if (data.route?.slug !== slug) throw new Error('Unexpected route.');
  return {
    route: { slug, name: text(data.route.name, 60) ?? slug },
    typicals: (Array.isArray(data.typicals) ? data.typicals : []).flatMap((row: any): PassTypical[] => {
      const values = [row?.hour, row?.medianSec, row?.p25Sec, row?.p75Sec].map(number);
      if (values.some(value => value === null) || !['weekday', 'weekend'].includes(row.weekdayClass) || !['winter', 'summer'].includes(row.season)) return [];
      const [hour, medianSec, p25Sec, p75Sec] = values as number[];
      return [{ weekdayClass: row.weekdayClass, season: row.season, hour, medianSec, p25Sec, p75Sec }];
    }),
    today: (Array.isArray(data.today) ? data.today : []).flatMap((row: any) => {
      const capturedAt = time(row?.capturedAt), durationSec = number(row?.durationSec);
      return capturedAt && durationSec !== null && durationSec > 0 ? [{ capturedAt, durationSec }] : [];
    }),
  };
}

/** tetonpasscam.com's wording: within five minutes either way is "about usual". */
export function deltaCopy(row: TravelTime): { text: string; tone: 'faster' | 'slower' | 'usual' } | null {
  if (row.stale || row.typicalSec === null) return null;
  const diff = row.durationSec - row.typicalSec;
  if (diff <= -300) return { text: `${-Math.round(diff / 60)} min faster than usual`, tone: 'faster' };
  if (diff >= 300) return { text: `${Math.round(diff / 60)} min slower than usual`, tone: 'slower' };
  return { text: 'about usual', tone: 'usual' };
}

/** Typical-day bucket for a moment in Jackson's time zone, matching tetonpasscam.com's aggregation. */
export function denverDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'numeric' }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const month = Number(parts.find(p => p.type === 'month')?.value ?? '1');
  return { weekdayClass: weekday === 'Sat' || weekday === 'Sun' ? 'weekend' as const : 'weekday' as const, season: month >= 11 || month <= 4 ? 'winter' as const : 'summer' as const };
}

export function denverHour(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0) + Number(parts.find(p => p.type === 'minute')?.value ?? 0) / 60;
}
