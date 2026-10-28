// Small DOM, icon, popover and toast helpers used by every view.
(function (root) {
  'use strict';

  // 24x24 stroke icons.
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    paperclip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  };

  function cx(...names) {
    return names.filter(Boolean).join(' ');
  }

  // h('button.icon-button', { onclick, 'aria-label': 'Close' }, icon('x'))
  // Keys with a dash (aria-*, data-*) and 'role' become attributes; everything else is a property.
  function h(tag, props, ...children) {
    const [name, ...classes] = tag.split('.');
    const el = document.createElement(name);
    if (classes.length) el.className = classes.join(' ');
    for (const [key, value] of Object.entries(props || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = cx(el.className, value);
      else if (key === 'style') el.style.cssText = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key.includes('-') || key === 'role') el.setAttribute(key, value === true ? '' : value);
      else el[key] = value;
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    for (const child of [children].flat(Infinity)) {
      if (child == null || child === false || child === '') continue;
      el.append(child instanceof Node ? child : String(child));
    }
  }

  function icon(name, className) {
    const tpl = document.createElement('template');
    tpl.innerHTML =
      `<svg class="${cx('icon', className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
    return tpl.content.firstChild;
  }

  // Swaps <span data-icon="name"> placeholders in static HTML for real icons.
  function hydrateIcons(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach((el) => el.replaceWith(icon(el.dataset.icon, el.className)));
  }

  // Replaces a container's contents, keeping keyboard focus on the matching control (by data-key)
  // so re-rendering after a click or key press doesn't throw the user's place away.
  function renderInto(container, children) {
    const active = document.activeElement;
    const key = active && container.contains(active) ? active.dataset.key : null;
    container.replaceChildren();
    append(container, children);
    if (key) container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
  }

  // True while the user is typing in a field inside `container` (re-rendering would interrupt them).
  function isEditing(container) {
    const active = document.activeElement;
    return Boolean(active && container.contains(active) && active.matches('textarea, input:not([type=checkbox]):not([type=file])'));
  }

  // Popovers: one open at a time, closed by an outside click, Escape, scrolling or resizing.
  let current = null;

  function openPopover(anchor, content, { align = 'start', className } = {}) {
    const toggledOff = current && current.anchor === anchor;
    closePopover();
    if (toggledOff) return null;

    const el = h('div', { class: cx('popover', className) }, content);
    document.body.append(el);
    current = { el, anchor };
    anchor.setAttribute('aria-expanded', 'true');
    place(el, anchor, align);

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return el;
  }

  function closePopover({ restoreFocus = false } = {}) {
    if (!current) return;
    const { el, anchor } = current;
    current = null;
    el.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (restoreFocus && anchor.isConnected) anchor.focus();
  }

  function onPointerDown(e) {
    if (current && !current.el.contains(e.target) && !current.anchor.contains(e.target)) closePopover();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closePopover({ restoreFocus: true });
  }

  function onScroll(e) {
    if (current && !current.el.contains(e.target)) closePopover();
  }

  function onResize() {
    closePopover();
  }

  function place(el, anchor, align) {
    const r = anchor.getBoundingClientRect();
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = r.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, r.top - height - 6);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  // A single-choice menu. Options: [{ value, label, dot?: 'css-class' }].
  function openMenu(anchor, options, selected, onSelect) {
    const items = options.map((o) =>
      h(
        'button.menu-item',
        {
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': String(o.value === selected),
          onclick: () => {
            closePopover({ restoreFocus: true });
            onSelect(o.value);
          },
        },
        o.dot ? h('span', { class: cx('dot', o.dot) }) : null,
        h('span.menu-label', null, o.label),
        o.value === selected ? icon('check', 'menu-check') : null
      )
    );
    const menu = h('div.menu', { role: 'menu', onkeydown: (e) => moveFocus(e, items) }, items);
    if (!openPopover(anchor, menu, { className: 'popover-menu' })) return;
    (items.find((i) => i.getAttribute('aria-checked') === 'true') || items[0]).focus();
  }

  function moveFocus(e, items) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const step = e.key === 'ArrowDown' ? 1 : items.length - 1;
    items[(i + step) % items.length].focus();
  }

  function toast(message, { action, onAction, duration = 6000 } = {}) {
    const region = document.getElementById('toasts');
    let timer;
    const el = h(
      'div.toast',
      null,
      h('span.toast-message', null, message),
      action
        ? h('button.toast-action', { type: 'button', onclick: () => { dismiss(); onAction(); } }, action)
        : null
    );
    function dismiss() {
      clearTimeout(timer);
      el.remove();
    }
    region.append(el);
    while (region.children.length > 3) region.firstElementChild.remove();
    timer = setTimeout(dismiss, duration);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function autosize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  root.UI = {
    cx, h, icon, hydrateIcons, renderInto, isEditing, openPopover, closePopover, openMenu, toast, formatSize, autosize,
  };
})(globalThis);
