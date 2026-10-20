// Shared behavior for the Lightbox.astro dialog: wraparound stepping, arrow keys, swipe, backdrop close,
// and returning focus to the thumbnail that opened it. Each page supplies how to render one item.
export interface LightboxParts {
  image: HTMLImageElement;
  title: HTMLElement;
  count: HTMLElement;
  meta: HTMLElement;
  full: HTMLAnchorElement;
}

interface LightboxOptions {
  length(): number;
  render(index: number, parts: LightboxParts): void;
  preload(index: number): void;
  opener(index: number): HTMLElement | undefined;
}

/** Modified clicks keep the browser's open-in-new-tab behavior; only plain clicks open the lightbox. */
export const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function setUpLightbox(dialog: HTMLDialogElement, options: LightboxOptions) {
  const part = <T extends HTMLElement>(name: string) => dialog.querySelector<T>(`[data-lightbox-${name}]`)!;
  const parts: LightboxParts = { image: part('image'), title: part('title'), count: part('count'), meta: part('meta'), full: part('full') };
  let current = -1;

  function show(index: number) {
    const length = options.length();
    if (!length) return;
    current = (index + length) % length;
    dialog.classList.remove('is-unavailable');
    options.render(current, parts);
    for (const step of [-1, 1]) options.preload((current + step + length) % length);
    if (!dialog.open) dialog.showModal();
  }

  parts.image.addEventListener('error', () => dialog.classList.add('is-unavailable'));
  parts.image.addEventListener('load', () => dialog.classList.remove('is-unavailable'));
  part('close').addEventListener('click', () => dialog.close());
  for (const button of dialog.querySelectorAll<HTMLElement>('[data-lightbox-step]')) button.addEventListener('click', () => show(current + Number(button.dataset.lightboxStep)));
  // A click on the backdrop lands on the dialog itself rather than its contents.
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
  let touchX: number | null = null;
  dialog.addEventListener('touchstart', event => { touchX = event.touches.length === 1 ? event.touches[0].clientX : null; }, { passive: true });
  dialog.addEventListener('touchend', event => {
    if (touchX === null) return;
    const distance = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(distance) > 50) show(current + (distance < 0 ? 1 : -1));
  });
  dialog.addEventListener('close', () => options.opener(current)?.focus());

  return { show, refresh: () => { if (dialog.open) show(current); } };
}
