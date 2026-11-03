/** Text-only creator menus, drawn outside the scrolling parchment panel. */
let closeOpenMenu = () => {};
let checkMenuAnchor = () => {};
let nextId = 0;

export function closeCreatorSelect() { closeOpenMenu(); }

document.addEventListener('pointerdown', event => {
  if (!(event.target instanceof Element) || !event.target.closest('.creator-select, .creator-select-menu')) closeCreatorSelect();
});
document.addEventListener('scroll', event => {
  if (!(event.target instanceof Element) || !event.target.closest('.creator-select-menu')) checkMenuAnchor();
}, true);
window.addEventListener('resize', closeCreatorSelect);
for (const event of ['brumaluz-creator-tab', 'brumaluz-creator-reset', 'brumaluz-language-change'])
  document.addEventListener(event, closeCreatorSelect);

export function styleCreatorSelect(select: HTMLSelectElement) {
  const id = `creator-select-${++nextId}`;
  const wrapper = document.createElement('div'); wrapper.className = 'creator-select';
  select.before(wrapper); wrapper.append(select); select.hidden = true; select.tabIndex = -1;
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'creator-select-trigger';
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', id);
  wrapper.append(trigger);
  const menu = document.createElement('div'); menu.id = id; menu.className = 'creator-select-menu'; menu.hidden = true;
  menu.setAttribute('role', 'listbox'); document.body.append(menu);
  let active = 0, query = '', queryAt = 0;
  const close = () => {
    menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
  };
  const highlight = () => {
    [...menu.children].forEach((option, index) => option.classList.toggle('focused', index === active));
    const option = menu.children[active];
    if (option instanceof HTMLElement) {
      trigger.setAttribute('aria-activedescendant', option.id);
      if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight)
        menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
    }
  };
  const choose = (index: number) => {
    const option = select.options[index];
    if (!option || option.disabled) return;
    close(); trigger.focus({ preventScroll: true });
    select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true }));
    refresh();
  };
  const open = () => {
    closeCreatorSelect(); closeOpenMenu = close;
    active = Math.max(0, select.selectedIndex); query = '';
    menu.replaceChildren(...[...select.options].map((option, index) => {
      const row = document.createElement('div'); row.id = `${id}-${index}`; row.setAttribute('role', 'option');
      row.setAttribute('aria-label', option.text);
      row.setAttribute('aria-selected', String(option.selected)); row.textContent = option.text;
      row.dataset.value = option.value; row.onclick = () => choose(index); return row;
    }));
    const bounds = trigger.getBoundingClientRect(), gap = 5;
    checkMenuAnchor = () => {
      const current = trigger.getBoundingClientRect();
      if (Math.abs(current.top - bounds.top) > .5 || Math.abs(current.left - bounds.left) > .5) close();
    };
    const below = innerHeight - bounds.bottom - 12, above = bounds.top - 12;
    const upwards = below < 160 && above > below, space = upwards ? above : below;
    menu.style.width = `${Math.min(bounds.width, innerWidth - 24)}px`;
    menu.style.maxHeight = `${Math.min(300, space - gap)}px`;
    menu.style.left = `${Math.max(12, Math.min(bounds.left, innerWidth - bounds.width - 12))}px`;
    menu.style.top = upwards ? 'auto' : `${bounds.bottom + gap}px`;
    menu.style.bottom = upwards ? `${innerHeight - bounds.top + gap}px` : 'auto';
    menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); highlight();
  };
  trigger.onclick = () => menu.hidden ? open() : close();
  trigger.onblur = close;
  menu.onpointerdown = event => event.preventDefault();
  trigger.onkeydown = event => {
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Escape') { if (!menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); } return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) { open(); return; }
      if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
      active = event.key === 'Home' ? 0 : event.key === 'End' ? select.length - 1
        : Math.max(0, Math.min(select.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
      highlight();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); if (menu.hidden) open();
      query = performance.now() - queryAt > 700 ? event.key : query + event.key; queryAt = performance.now();
      const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
      const index = [...select.options].findIndex(option => normalize(option.text).startsWith(normalize(query)));
      if (index >= 0) { active = index; highlight(); }
    }
  };
  function refresh() {
    trigger.textContent = select.selectedOptions[0]?.text ?? '';
    const label = select.getAttribute('aria-label') ?? '';
    trigger.setAttribute('aria-label', label); menu.setAttribute('aria-label', label);
    const description = select.getAttribute('aria-description');
    if (description) trigger.setAttribute('aria-description', description); else trigger.removeAttribute('aria-description');
    if (!menu.hidden) close();
  }
  select.addEventListener('change', refresh);
  return refresh;
}
