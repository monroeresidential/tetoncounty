export const webcamFeedUrl = 'https://teton-flats-webcam.nyc3.cdn.digitaloceanspaces.com/cameras.geojson';
export const webcamImageOrigin = new URL(webcamFeedUrl).origin;

// Feed folders map to travel corridors; new folders fall back to the last group rather than failing.
export const webcamAreas = [
  { id: 'teton-valley', name: 'Teton Valley, Idaho', folders: ['Teton_Valley_ID'] },
  { id: 'teton-pass', name: 'Teton Pass & WY-22', folders: ['Idaho_State_Line', 'Teton_Pass', 'Wilson', 'WYO_22_and_WYO_390_Junction'] },
  { id: 'jackson', name: 'Jackson & Teton Village', folders: ['US_89_and_WYO_22_Junction', 'Teton_Village_JHMR', 'airport'] },
  { id: 'south', name: 'South of Jackson', folders: ['Hoback_Junction', 'Raymond'] },
  { id: 'more', name: 'More cameras', folders: [] },
] as const;
export type WebcamArea = typeof webcamAreas[number]['id'];

export interface Webcam {
  id: string;
  name: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  approximate: boolean;
  area: WebcamArea;
  credit: string;
}

function creditFor(source: unknown, folder: string, name: string) {
  if (source === 'wydot') return 'Wyoming Department of Transportation';
  if (folder === 'airport') return 'Jackson Hole Airport';
  if (folder === 'Teton_Village_JHMR') return 'Jackson Hole Mountain Resort';
  if (/^TetonCam\b/.test(name)) return 'TetonCam';
  return 'Camera operator';
}

/** Keeps only well-formed cameras whose images are served from the feed's own bucket. */
export function parseWebcams(feed: unknown): Webcam[] {
  if (!feed || typeof feed !== 'object' || (feed as { type?: unknown }).type !== 'FeatureCollection') throw new Error('Invalid webcam feed.');
  const features = (feed as { features?: unknown }).features;
  if (!Array.isArray(features)) throw new Error('Invalid webcam feed.');
  const cameras: Webcam[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const properties = feature?.properties;
    const [longitude, latitude] = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates ?? [] : [];
    if (typeof properties?.name !== 'string' || typeof properties.image_url !== 'string') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    let image: URL;
    try { image = new URL(properties.image_url); } catch { continue; }
    if (image.origin !== webcamImageOrigin || !/\.jpe?g$/i.test(image.pathname) || image.search) continue;
    const id = decodeURIComponent(image.pathname.slice(1));
    if (seen.has(id)) continue;
    seen.add(id);
    const folder = id.split('/')[0];
    const name = properties.name.trim().slice(0, 120);
    cameras.push({
      id, name, imageUrl: image.href, latitude, longitude,
      approximate: properties.approximate !== false,
      area: webcamAreas.find(area => (area.folders as readonly string[]).includes(folder))?.id ?? 'more',
      credit: creditFor(properties.source, folder, name),
    });
  }
  return cameras;
}
