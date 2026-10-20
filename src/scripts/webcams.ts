import { webcamAreas, type Webcam } from '../lib/webcams.ts';
import { isPlainClick, setUpLightbox } from './lightbox.ts';

const root = document.querySelector<HTMLElement>('[data-webcams]');
const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
const refreshMs = 5 * 60 * 1000;
let stamp = Math.floor(Date.now() / 60000);
const ordered: Webcam[] = [];

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// The bucket serves no-store images; a per-refresh query string defeats any intermediate cache.
const frameUrl = (camera: Webcam) => `${camera.imageUrl}?t=${stamp}`;

function meta(target: HTMLElement, camera: Webcam) {
  target.replaceChildren(camera.credit);
  if (camera.approximate) target.append(element('span', 'webcam-approximate', 'Approximate location'));
}

function card(camera: Webcam, index: number) {
  const figure = element('figure', 'webcam-card');
  const link = element('a', 'webcam-frame');
  link.href = camera.imageUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', `View the ${camera.name} image`);
  link.addEventListener('click', event => {
    if (!lightbox || !isPlainClick(event)) return;
    event.preventDefault();
    lightbox.show(index);
  });
  const image = element('img');
  image.src = frameUrl(camera);
  image.alt = `Latest image from the ${camera.name} camera`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.width = 640;
  image.height = 360;
  image.dataset.webcamImage = camera.imageUrl;
  image.addEventListener('error', () => figure.classList.add('is-unavailable'));
  // Feed images range from 4:3 to wide panoramas; size each frame to its image instead of cropping.
  image.addEventListener('load', () => {
    figure.classList.remove('is-unavailable');
    if (image.naturalWidth && image.naturalHeight) link.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  });
  link.append(image, element('span', 'webcam-unavailable', 'Camera temporarily unavailable'));
  const caption = element('figcaption');
  caption.append(element('span', 'webcam-name', camera.name));
  const details = element('span', 'webcam-meta');
  meta(details, camera);
  caption.append(details);
  figure.append(link, caption);
  return figure;
}

const lightbox = dialog && setUpLightbox(dialog, {
  length: () => ordered.length,
  render(index, parts) {
    const camera = ordered[index];
    parts.image.src = frameUrl(camera);
    parts.image.alt = `Latest image from the ${camera.name} camera`;
    parts.title.textContent = camera.name;
    parts.count.textContent = `${index + 1} of ${ordered.length} · ${webcamAreas.find(area => area.id === camera.area)!.name}`;
    meta(parts.meta, camera);
    parts.full.href = camera.imageUrl;
  },
  preload: index => { new Image().src = frameUrl(ordered[index]); },
  opener: index => root?.querySelectorAll<HTMLElement>('.webcam-frame')[index],
});

async function load() {
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-webcam-status]')!;
  const groups = root.querySelector<HTMLElement>('[data-webcam-groups]')!;
  let cameras: Webcam[];
  try {
    const response = await fetch('/api/webcams', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    cameras = (await response.json()).cameras;
  } catch {
    status.textContent = 'The cameras are unavailable right now. Please try again in a few minutes.';
    return;
  }
  for (const area of webcamAreas) {
    const inArea = cameras.filter(camera => camera.area === area.id);
    if (!inArea.length) continue;
    const section = element('section', 'webcam-group');
    section.id = area.id;
    section.setAttribute('aria-labelledby', `${area.id}-title`);
    const heading = element('h3', undefined, area.name);
    heading.id = `${area.id}-title`;
    const grid = element('div', 'webcam-grid');
    grid.append(...inArea.map(camera => card(camera, ordered.push(camera) - 1)));
    section.append(heading, grid);
    groups.append(section);
    root.querySelector<HTMLElement>(`[data-area-link="${area.id}"]`)!.hidden = false;
  }
  root.querySelector<HTMLElement>('[data-webcam-areas]')!.hidden = false;
  const updated = () => { status.textContent = `${cameras.length} cameras · images refresh every 5 minutes · last checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
  updated();
  // Refresh only while the tab is visible so background tabs don't keep pulling images.
  let last = Date.now();
  const refresh = () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < refreshMs) return;
    last = Date.now();
    stamp = Math.floor(last / 60000);
    for (const image of groups.querySelectorAll<HTMLImageElement>('[data-webcam-image]')) image.src = `${image.dataset.webcamImage}?t=${stamp}`;
    lightbox?.refresh();
    updated();
  };
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);
}

load();
