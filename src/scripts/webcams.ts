import { webcamAreas, type Webcam } from '../lib/webcams.ts';

const root = document.querySelector<HTMLElement>('[data-webcams]');
const lightbox = document.querySelector<HTMLDialogElement>('[data-webcam-lightbox]');
const refreshMs = 5 * 60 * 1000;
let stamp = Math.floor(Date.now() / 60000);
let ordered: Webcam[] = [];
let current = -1;

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
  // Modified clicks keep the browser's open-in-new-tab behavior; plain clicks open the lightbox.
  link.addEventListener('click', event => {
    if (!lightbox || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show(index);
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

function show(index: number) {
  if (!lightbox || !ordered.length) return;
  current = (index + ordered.length) % ordered.length;
  const camera = ordered[current];
  const image = lightbox.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
  lightbox.classList.remove('is-unavailable');
  image.src = frameUrl(camera);
  image.alt = `Latest image from the ${camera.name} camera`;
  lightbox.querySelector<HTMLElement>('[data-lightbox-title]')!.textContent = camera.name;
  lightbox.querySelector<HTMLElement>('[data-lightbox-count]')!.textContent = `${current + 1} of ${ordered.length} · ${webcamAreas.find(area => area.id === camera.area)!.name}`;
  meta(lightbox.querySelector<HTMLElement>('[data-lightbox-meta]')!, camera);
  lightbox.querySelector<HTMLAnchorElement>('[data-lightbox-full]')!.href = camera.imageUrl;
  for (const step of [-1, 1]) new Image().src = frameUrl(ordered[(current + step + ordered.length) % ordered.length]);
  if (!lightbox.open) lightbox.showModal();
}

function setUpLightbox() {
  if (!lightbox) return;
  const image = lightbox.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
  image.addEventListener('error', () => lightbox.classList.add('is-unavailable'));
  image.addEventListener('load', () => lightbox.classList.remove('is-unavailable'));
  lightbox.querySelector('[data-lightbox-close]')!.addEventListener('click', () => lightbox.close());
  for (const button of lightbox.querySelectorAll<HTMLElement>('[data-lightbox-step]')) button.addEventListener('click', () => show(current + Number(button.dataset.lightboxStep)));
  // A click on the backdrop lands on the dialog itself rather than its contents.
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
  let touchX: number | null = null;
  lightbox.addEventListener('touchstart', event => { touchX = event.touches.length === 1 ? event.touches[0].clientX : null; }, { passive: true });
  lightbox.addEventListener('touchend', event => {
    if (touchX === null) return;
    const distance = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(distance) > 50) show(current + (distance < 0 ? 1 : -1));
  });
  lightbox.addEventListener('close', () => root?.querySelectorAll<HTMLElement>('.webcam-frame')[current]?.focus());
}

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
  setUpLightbox();
  const updated = () => { status.textContent = `${cameras.length} cameras · images refresh every 5 minutes · last checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
  updated();
  // Refresh only while the tab is visible so background tabs don't keep pulling images.
  let last = Date.now();
  const refresh = () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < refreshMs) return;
    last = Date.now();
    stamp = Math.floor(last / 60000);
    for (const image of groups.querySelectorAll<HTMLImageElement>('[data-webcam-image]')) image.src = `${image.dataset.webcamImage}?t=${stamp}`;
    if (lightbox?.open) show(current);
    updated();
  };
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);
}

load();
