const controls = document.querySelector<HTMLFormElement>('[data-rent-controls]');
if (controls) {
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-rent-panel]'));
  const announcement = document.querySelector<HTMLElement>('[data-rent-announcement]');
  const bed = controls.elements.namedItem('plan') as RadioNodeList;
  const group = controls.elements.namedItem('group') as HTMLSelectElement;
  const apply = (writeUrl: boolean) => {
    for (const panel of panels) panel.hidden = panel.dataset.plan !== bed.value || panel.dataset.group !== group.value;
    if (announcement) announcement.textContent = `Showing ${bed.value === '1x1' ? 'one bedroom, one bathroom' : 'two bedrooms, two bathrooms'} · ${group.selectedOptions[0].textContent}. Undated rent snapshot.`;
    if (writeUrl) {
      const url = new URL(location.href);
      url.searchParams.set('plan', bed.value);
      url.searchParams.set('group', group.value);
      history.replaceState(null, '', url);
    }
  };
  const params = new URLSearchParams(location.search);
  const requestedPlan = params.get('plan');
  if (requestedPlan === '1x1' || requestedPlan === '2x2') bed.value = requestedPlan;
  const requestedGroup = params.get('group');
  if (requestedGroup === 'communities' || requestedGroup === 'all-direct') group.value = requestedGroup;
  controls.hidden = false;
  controls.addEventListener('change', () => apply(true));
  controls.addEventListener('submit', event => event.preventDefault());
  apply(false);
}
