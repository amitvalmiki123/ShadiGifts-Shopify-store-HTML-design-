/* ShaadiGifts wishlist and Shopify contact-form helpers; no cart or checkout behavior. */
(() => {
  'use strict';

  const STORAGE_KEY = 'sg_wishlist';
  const LEGACY_STORAGE_KEY = 'sg_wishlist_v1';
  let toastTimer;

  function readWishlist() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((item) => item && item.id !== undefined) : [];
      }

      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy)) {
          const migrated = parsedLegacy
            .filter((item) => item && item.id !== undefined)
            .map((item) => ({
              id: String(item.id),
              handle: item.handle || '',
              title: item.title || String(item.id),
              url: item.url || '',
              image: item.image || '',
              price: item.price || '',
              quantity: Math.max(1, Number(item.quantity || item.qty) || 25),
              note: item.note || '',
            }));
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (error) {
      // Continue without wishlist persistence if browser storage is blocked.
    }
    return [];
  }

  function containsProduct(id, items = readWishlist()) {
    return items.some((item) => String(item.id) === String(id));
  }

  function saveWishlist(items, options = {}) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      // Continue without persistence if browser storage is blocked or full.
    }
    updateWishlistUI({ renderItems: options.renderItems !== false });
    document.dispatchEvent(new CustomEvent('sg:wishlist:change', { detail: { items } }));
  }

  function safeSameOriginUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function safeImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function createToast(title, message, wishlistUrl) {
    let toast = document.querySelector('[data-sg-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'sg-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
      toast.setAttribute('data-sg-toast', '');
      document.body.appendChild(toast);
    }

    toast.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'sg-toast__check';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✓';

    const copy = document.createElement('span');
    copy.className = 'sg-toast__copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const detail = document.createElement('span');
    detail.textContent = message;
    copy.append(strong, detail);
    toast.append(icon, copy);

    const safeWishlistUrl = safeSameOriginUrl(wishlistUrl);
    if (safeWishlistUrl) {
      const link = document.createElement('a');
      link.className = 'sg-toast__link';
      link.href = safeWishlistUrl;
      link.textContent = 'View wishlist';
      toast.append(link);
    }

    const close = document.createElement('button');
    close.className = 'sg-toast__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '×';
    close.addEventListener('click', () => toast.classList.remove('is-visible'), { once: true });
    toast.append(close);

    requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4600);
  }

  function toggleProduct(button) {
    const productId = button.getAttribute('data-product-id');
    if (!productId) return;

    const items = readWishlist();
    const existingIndex = items.findIndex((item) => String(item.id) === String(productId));
    const wishlistUrl = button.getAttribute('data-sg-wishlist-url') || '';

    if (existingIndex !== -1) {
      const [removed] = items.splice(existingIndex, 1);
      saveWishlist(items);
      createToast('Removed from your wishlist', removed.title || 'This gift has been removed.', wishlistUrl);
      return;
    }

    const title = button.getAttribute('data-product-title') || 'Wedding gift';
    items.push({
      id: String(productId),
      handle: button.getAttribute('data-product-handle') || '',
      title,
      url: button.getAttribute('data-product-url') || '',
      image: button.getAttribute('data-product-image') || '',
      price: button.getAttribute('data-product-price') || '',
      quantity: 25,
      note: '',
    });
    saveWishlist(items);
    createToast('Added to your wishlist', title, wishlistUrl);
  }

  function updateWishlistButtons(items) {
    document.querySelectorAll('[data-sg-wishlist-toggle]').forEach((button) => {
      const saved = containsProduct(button.getAttribute('data-product-id'), items);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved
        ? (button.getAttribute('data-sg-label-remove') || 'Remove from wishlist')
        : (button.getAttribute('data-sg-label-add') || 'Add to wishlist'));
      button.classList.toggle('is-saved', saved);
      const label = button.querySelector('[data-sg-wishlist-button-label]');
      if (label) label.textContent = saved ? 'Saved to Wishlist' : 'Add to Wishlist';
    });
  }

  function formatWishlist(items) {
    if (!items.length) return 'No gifts have been added to the wishlist yet.';
    return items.map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity || item.qty) || 25);
      const details = [`${index + 1}. ${item.title || item.handle || item.id}`, `Quantity: ${quantity}`];
      if (item.price) details.push(`Indicative price: ${item.price}`);
      if (item.note) details.push(`Note: ${item.note}`);
      if (item.url) details.push(`Product: ${item.url}`);
      return details.join(' | ');
    }).join('\n');
  }

  function createWishlistItem(item, index) {
    const productId = String(item.id);
    const article = document.createElement('article');
    article.className = 'sg-wishlist-item';
    article.dataset.productId = productId;

    const media = document.createElement('div');
    media.className = 'sg-wishlist-item__media';
    const imageUrl = safeImageUrl(item.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = item.title || 'Saved wedding gift';
      image.loading = 'lazy';
      media.append(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'sg-wishlist-item__placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = '✦';
      media.append(placeholder);
    }

    const details = document.createElement('div');
    details.className = 'sg-wishlist-item__details';
    const safeUrl = safeSameOriginUrl(item.url);
    const title = document.createElement(safeUrl ? 'a' : 'span');
    title.className = 'sg-wishlist-item__title';
    title.textContent = item.title || item.handle || `Saved gift ${index + 1}`;
    if (safeUrl) title.href = safeUrl;
    details.append(title);
    if (item.price) {
      const price = document.createElement('span');
      price.className = 'sg-wishlist-item__price';
      price.textContent = `Indicative price: ${item.price}`;
      details.append(price);
    }

    const controls = document.createElement('div');
    controls.className = 'sg-wishlist-item__controls';
    const quantityLabel = document.createElement('label');
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.inputMode = 'numeric';
    quantityInput.value = String(Math.max(1, Number(item.quantity || item.qty) || 25));
    quantityInput.setAttribute('aria-label', `Quantity for ${item.title || 'saved gift'}`);
    quantityInput.dataset.sgWishlistQuantity = '';
    quantityLabel.append(quantityInput);

    const noteLabel = document.createElement('label');
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.value = item.note || '';
    noteInput.placeholder = 'Add a note (optional)';
    noteInput.setAttribute('aria-label', `Note for ${item.title || 'saved gift'}`);
    noteInput.dataset.sgWishlistNote = '';
    noteLabel.append(noteInput);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'sg-wishlist-item__remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${item.title || 'saved gift'} from wishlist`);
    remove.dataset.sgWishlistRemove = '';

    controls.append(quantityLabel, noteLabel, remove);
    article.append(media, details, controls);
    return article;
  }

  function updateWishlistContactPayload(items) {
    const form = document.querySelector('#SGWishlistContactForm');
    if (!form) return;

    const summary = formatWishlist(items);
    const selectionField = form.querySelector('[data-sg-wishlist-summary]');
    const bodyField = form.querySelector('[data-sg-wishlist-body]');
    if (selectionField) selectionField.value = summary;

    if (bodyField) {
      const contactLines = [];
      const grouped = new Map();
      new FormData(form).forEach((value, name) => {
        if (!name.startsWith('contact[') || name === 'contact[body]' || name === 'contact[subject]' || name === 'contact[Wishlist selection]') return;
        if (name === 'contact[Additional notes]') return;
        const fieldName = name.replace(/^contact\[/, '').replace(/\](?:\[\])?$/, '');
        const values = grouped.get(fieldName) || [];
        values.push(String(value));
        grouped.set(fieldName, values);
      });
      grouped.forEach((values, fieldName) => contactLines.push(`${fieldName}: ${values.join(', ')}`));
      const noteField = form.querySelector('[data-sg-wishlist-notes]');
      const note = noteField ? noteField.value.trim() : '';
      bodyField.value = [
        'ShaadiGifts personalised quote request',
        '',
        ...contactLines,
        '',
        'Wishlist selection:',
        summary,
        note ? `\nAdditional notes: ${note}` : '',
      ].filter(Boolean).join('\n');
    }
  }

  function renderWishlistPage(items = readWishlist()) {
    const list = document.querySelector('[data-sg-wishlist-items]');
    if (!list) return;
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'sg-wishlist-empty';
      empty.textContent = list.getAttribute('data-empty-message') || 'Your wishlist is empty.';
      list.append(empty);
    } else {
      items.forEach((item, index) => list.append(createWishlistItem(item, index)));
    }

    const count = document.createElement('span');
    count.className = 'sg-visually-hidden';
    count.setAttribute('data-sg-wishlist-count', '');
    count.textContent = String(items.length);
    list.append(count);
    updateWishlistContactPayload(items);
  }

  function updateWishlistUI(options = {}) {
    const items = readWishlist();
    const count = items.length;
    document.querySelectorAll('[data-sg-wishlist-count]').forEach((element) => {
      element.textContent = String(count);
    });
    updateWishlistButtons(items);
    updateWishlistContactPayload(items);
    if (options.renderItems !== false) renderWishlistPage(items);
  }

  function updateContactBody(form, bodySelector, heading) {
    const bodyField = form.querySelector(bodySelector);
    if (!bodyField) return;
    const grouped = new Map();
    new FormData(form).forEach((value, name) => {
      if (!name.startsWith('contact[') || name === 'contact[body]' || name === 'contact[subject]') return;
      const fieldName = name.replace(/^contact\[/, '').replace(/\](?:\[\])?$/, '');
      const values = grouped.get(fieldName) || [];
      values.push(String(value));
      grouped.set(fieldName, values);
    });
    bodyField.value = [heading, '', ...Array.from(grouped, ([key, values]) => `${key}: ${values.join(', ')}`)].join('\n');
  }

  function initContactForms() {
    const plannerForm = document.querySelector('#SGPlannerContactForm');
    if (plannerForm && plannerForm.dataset.sgInitialized !== 'true') {
      plannerForm.dataset.sgInitialized = 'true';
      plannerForm.querySelectorAll('[data-sg-choice-group][data-sg-min-one]').forEach((group) => {
        group.addEventListener('change', () => {
          if (group.querySelector('input:checked')) {
            group.classList.remove('has-error');
            const error = group.querySelector('[data-sg-choice-error]');
            if (error) error.hidden = true;
          }
        });
      });
      plannerForm.addEventListener('submit', (event) => {
        let valid = true;
        plannerForm.querySelectorAll('[data-sg-choice-group][data-sg-min-one]').forEach((group) => {
          const hasSelection = Boolean(group.querySelector('input:checked'));
          group.classList.toggle('has-error', !hasSelection);
          const error = group.querySelector('[data-sg-choice-error]');
          if (error) error.hidden = hasSelection;
          if (!hasSelection) valid = false;
        });
        if (!valid) {
          event.preventDefault();
          const firstInvalid = plannerForm.querySelector('.sg-choice-group.has-error input');
          if (firstInvalid) firstInvalid.focus();
          return;
        }
        updateContactBody(plannerForm, '[data-sg-planner-body]', 'Wedding gifting planner enquiry');
      });
    }

    const wishlistForm = document.querySelector('#SGWishlistContactForm');
    if (wishlistForm && wishlistForm.dataset.sgInitialized !== 'true') {
      wishlistForm.dataset.sgInitialized = 'true';
      wishlistForm.addEventListener('input', () => updateWishlistContactPayload(readWishlist()));
      wishlistForm.addEventListener('submit', () => updateWishlistContactPayload(readWishlist()));
    }
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-sg-wishlist-toggle]');
    if (!button) return;
    event.preventDefault();
    toggleProduct(button);
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-sg-wishlist-remove]');
    if (!button) return;
    const item = button.closest('.sg-wishlist-item');
    if (!item) return;
    saveWishlist(readWishlist().filter((entry) => String(entry.id) !== item.dataset.productId));
    createToast('Removed from your wishlist', 'The gift has been removed from your selection.', '');
  });

  document.addEventListener('change', (event) => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest('.sg-wishlist-item');
    if (!item) return;
    const items = readWishlist();
    const savedItem = items.find((entry) => String(entry.id) === item.dataset.productId);
    if (!savedItem) return;
    if (event.target.matches('[data-sg-wishlist-quantity]')) {
      savedItem.quantity = Math.max(1, parseInt(event.target.value, 10) || 1);
      event.target.value = String(savedItem.quantity);
      saveWishlist(items);
    }
  });

  document.addEventListener('input', (event) => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest('.sg-wishlist-item');
    if (!item || !event.target.matches('[data-sg-wishlist-note]')) return;
    const items = readWishlist();
    const savedItem = items.find((entry) => String(entry.id) === item.dataset.productId);
    if (!savedItem) return;
    savedItem.note = event.target.value;
    saveWishlist(items, { renderItems: false });
  });

  function initHeaderNavigation() {
    const openButton = document.querySelector('[data-sg-menu-open]');
    const drawer = document.querySelector('[data-sg-header-drawer]');
    if (!openButton || !drawer || openButton.dataset.sgBound === 'true') return;

    openButton.dataset.sgBound = 'true';
    openButton.addEventListener('click', () => {
      if (!drawer.open) drawer.showModal();
    });

    const closeButton = drawer.querySelector('[data-sg-menu-close]');
    if (closeButton) closeButton.addEventListener('click', () => drawer.close());

    drawer.addEventListener('click', (event) => {
      if (event.target === drawer) drawer.close();
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (drawer.open) drawer.close();
      });
    });
  }

  function init() {
    initHeaderNavigation();
    initContactForms();
    const wishlistSuccess = document.querySelector('[data-sg-wishlist-page] [data-sg-contact-success]');
    if (wishlistSuccess && readWishlist().length) saveWishlist([]);
    else updateWishlistUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', () => {
    initHeaderNavigation();
    initContactForms();
    updateWishlistUI();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) updateWishlistUI();
  });

  window.SGWishlist = {
    key: STORAGE_KEY,
    read: readWishlist,
    save: saveWishlist,
    has: (id) => containsProduct(id),
    updateUI: updateWishlistUI,
  };
})();
