/* ShaadiGifts wishlist and Shopify contact-form helpers; no cart or checkout behavior. */
(() => {
  'use strict';

  const STORAGE_KEY = 'sg_wishlist';
  const LEGACY_STORAGE_KEY = 'sg_wishlist_v1';
  let toastTimer;

  function normalizeWishlistQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return 1 + Math.round((parsed - 1) / 5) * 5;
  }

  function normalizeWishlistItems(items) {
    return items
      .filter((item) => item && item.id !== undefined)
      .map((item) => {
        const savedQuantity = item.quantity ?? item.qty;
        // The previous storefront defaulted every new item to 25; migrate that default to 1.
        const quantity = Number(savedQuantity) === 25 ? 1 : normalizeWishlistQuantity(savedQuantity);
        return {
          ...item,
          id: String(item.id),
          quantity,
          note: item.note || '',
        };
      });
  }

  function readWishlist() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? normalizeWishlistItems(parsed) : [];
      }

      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy)) {
          const migrated = normalizeWishlistItems(parsedLegacy.filter((item) => item && item.id !== undefined).map((item) => ({
            ...item,
            handle: item.handle || '',
            title: item.title || String(item.id),
            url: item.url || '',
            image: item.image || '',
            price: item.price || '',
            quantity: item.quantity ?? item.qty ?? 1,
          })));
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
      type: button.getAttribute('data-product-type') || '',
      category: button.getAttribute('data-product-category') || '',
      quantity: 1,
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
      const quantity = normalizeWishlistQuantity(item.quantity ?? item.qty);
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
    const title = document.createElement(safeUrl ? 'a' : 'h2');
    title.className = 'sg-wishlist-item__title';
    title.textContent = item.title || item.handle || `Saved gift ${index + 1}`;
    if (safeUrl) title.href = safeUrl;
    details.append(title);

    const metaParts = [];
    if (item.category || item.type) metaParts.push(item.category || item.type);
    if (item.price) metaParts.push(`Starting from ${item.price}`);
    if (metaParts.length) {
      const meta = document.createElement('p');
      meta.className = 'sg-wishlist-item__meta';
      meta.textContent = metaParts.join('  |  ');
      details.append(meta);
    }

    const controls = document.createElement('div');
    controls.className = 'sg-wishlist-item__controls';

    const quantityGroup = document.createElement('div');
    quantityGroup.className = 'sg-wishlist-item__quantity-group';
    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'sg-wishlist-item__label';
    const quantityInput = document.createElement('input');
    const quantityId = `sg-wishlist-quantity-${productId}`;
    quantityLabel.htmlFor = quantityId;
    quantityLabel.textContent = 'Quantity';
    quantityInput.id = quantityId;
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.step = '5';
    quantityInput.inputMode = 'numeric';
    quantityInput.value = String(normalizeWishlistQuantity(item.quantity ?? item.qty));
    quantityInput.setAttribute('aria-label', `Quantity for ${item.title || 'saved gift'}`);
    quantityInput.dataset.sgWishlistQuantity = '';

    const quantityStepper = document.createElement('div');
    quantityStepper.className = 'sg-wishlist-item__quantity-stepper';
    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.className = 'sg-wishlist-item__quantity-step';
    decrement.setAttribute('aria-label', `Decrease ${item.title || 'saved gift'} quantity by five`);
    decrement.dataset.sgWishlistQuantityStep = '-5';
    decrement.textContent = '−';
    const increment = document.createElement('button');
    increment.type = 'button';
    increment.className = 'sg-wishlist-item__quantity-step';
    increment.setAttribute('aria-label', `Increase ${item.title || 'saved gift'} quantity by five`);
    increment.dataset.sgWishlistQuantityStep = '5';
    increment.textContent = '+';
    quantityStepper.append(decrement, quantityInput, increment);
    quantityGroup.append(quantityLabel, quantityStepper);

    const noteLabel = document.createElement('label');
    noteLabel.className = 'sg-wishlist-item__note';
    const noteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    noteIcon.setAttribute('viewBox', '0 0 24 24');
    noteIcon.setAttribute('fill', 'none');
    noteIcon.setAttribute('stroke', 'currentColor');
    noteIcon.setAttribute('stroke-width', '1.8');
    noteIcon.setAttribute('stroke-linecap', 'round');
    noteIcon.setAttribute('stroke-linejoin', 'round');
    noteIcon.setAttribute('aria-hidden', 'true');
    const notePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    notePath.setAttribute('d', 'm14 5 5 5M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z');
    noteIcon.append(notePath);
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.value = item.note || '';
    noteInput.placeholder = 'Add a note (optional)';
    noteInput.setAttribute('aria-label', `Note for ${item.title || 'saved gift'}`);
    noteInput.dataset.sgWishlistNote = '';
    noteLabel.append(noteIcon, noteInput);

    controls.append(quantityGroup, noteLabel);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'sg-wishlist-item__remove';
    remove.setAttribute('aria-label', `Remove ${item.title || 'saved gift'} from wishlist`);
    remove.dataset.sgWishlistRemove = '';
    const removeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    removeIcon.setAttribute('viewBox', '0 0 24 24');
    removeIcon.setAttribute('fill', 'none');
    removeIcon.setAttribute('stroke', 'currentColor');
    removeIcon.setAttribute('stroke-width', '1.8');
    removeIcon.setAttribute('stroke-linecap', 'round');
    removeIcon.setAttribute('stroke-linejoin', 'round');
    removeIcon.setAttribute('aria-hidden', 'true');
    const removePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    removePath.setAttribute('d', 'M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5');
    removeIcon.append(removePath);
    const removeText = document.createElement('span');
    removeText.className = 'sg-visually-hidden';
    removeText.textContent = 'Remove';
    remove.append(removeIcon, removeText);

    article.append(media, details, controls, remove);
    return article;
  }

  function updateWishlistContactPayload(items) {
    const form = document.querySelector('#SGWishlistContactForm');
    if (!form) return;

    const summary = formatWishlist(items);
    const selectionField = form.querySelector('[data-sg-wishlist-summary-field]');
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

  function updateWishlistSummary(items = readWishlist()) {
    const summary = document.querySelector('[data-sg-wishlist-summary]');
    const actions = document.querySelector('[data-sg-wishlist-actions]');
    if (summary) summary.hidden = items.length === 0;
    if (actions) actions.hidden = items.length === 0;

    const productCount = document.querySelector('[data-sg-wishlist-products-count]');
    if (productCount) productCount.textContent = String(items.length);
    const totalQuantity = document.querySelector('[data-sg-wishlist-total-quantity]');
    if (totalQuantity) {
      totalQuantity.textContent = String(items.reduce((total, item) => total + normalizeWishlistQuantity(item.quantity ?? item.qty), 0));
    }
  }

  function renderWishlistPage(items = readWishlist()) {
    const list = document.querySelector('[data-sg-wishlist-items]');
    if (!list) return;
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'sg-wishlist-empty';
      const heading = document.createElement('h2');
      heading.textContent = 'Your wishlist is empty';
      const message = document.createElement('p');
      message.textContent = list.getAttribute('data-empty-message') || 'Browse our collections and save the gifts you like.';
      const link = document.createElement('a');
      link.className = 'sg-button sg-button--primary';
      link.href = safeSameOriginUrl(list.getAttribute('data-collections-url')) || '/collections';
      link.textContent = 'Explore Collections';
      empty.append(heading, message, link);
      list.append(empty);
    } else {
      items.forEach((item, index) => list.append(createWishlistItem(item, index)));
    }

    const count = document.createElement('span');
    count.className = 'sg-visually-hidden';
    count.setAttribute('data-sg-wishlist-count', '');
    count.textContent = String(items.length);
    list.append(count);
    updateWishlistSummary(items);
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
    updateWishlistSummary(items);
    updatePlannerWishlistSummary();
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
    const wishlistForm = document.querySelector('#SGWishlistContactForm');
    if (wishlistForm && wishlistForm.dataset.sgInitialized !== 'true') {
      wishlistForm.dataset.sgInitialized = 'true';
      wishlistForm.addEventListener('input', () => updateWishlistContactPayload(readWishlist()));
      wishlistForm.addEventListener('submit', () => updateWishlistContactPayload(readWishlist()));
    }

    document.querySelectorAll('[data-sg-wishlist-dialog]').forEach((dialog) => {
      if (dialog.dataset.sgInitialized === 'true') return;
      dialog.dataset.sgInitialized = 'true';
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog && typeof dialog.close === 'function') dialog.close();
      });
      if (dialog.hasAttribute('data-sg-auto-open')) {
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
        else dialog.setAttribute('open', '');
      }
    });
  }

  function formatPlannerWishlist(items) {
    return items.length ? formatWishlist(items) : 'No gifts have been added to the wishlist yet.';
  }

  function updatePlannerWishlistSummary() {
    const summary = document.querySelector('[data-sg-planner-wishlist]');
    const list = summary && summary.querySelector('[data-sg-planner-wishlist-items]');
    if (!summary || !list) return;
    const items = readWishlist();
    list.replaceChildren();

    if (items.length) {
      const itemList = document.createElement('ul');
      items.forEach((item) => {
        const row = document.createElement('li');
        const quantity = normalizeWishlistQuantity(item.quantity ?? item.qty);
        row.textContent = `${item.title || item.handle || item.id} — qty ${quantity}${item.note ? ` · ${item.note}` : ''}`;
        itemList.append(row);
      });
      list.append(itemList);
      const editLink = document.createElement('a');
      editLink.className = 'sg-planner-wishlist__link';
      editLink.href = safeSameOriginUrl(summary.getAttribute('data-wishlist-url')) || '/pages/wishlist';
      editLink.textContent = 'Edit wishlist';
      list.append(editLink);
    } else {
      const emptyCopy = document.createElement('p');
      emptyCopy.textContent = 'No wishlist items yet. You can browse collections or submit your plan and we will help curate your gifts.';
      const browseLink = document.createElement('a');
      browseLink.className = 'sg-planner-wishlist__link';
      browseLink.href = safeSameOriginUrl(summary.getAttribute('data-collections-url')) || '/collections';
      browseLink.textContent = 'Browse collections';
      list.append(emptyCopy, browseLink);
    }
  }


  function initPlannerForm() {
    const form = document.querySelector('#SGPlannerContactForm');
    if (!form) return;
    const plannerPage = form.closest('[data-sg-planner-page]');
    const steps = Array.from(form.querySelectorAll('[data-sg-planner-step]'));
    if (!plannerPage || !steps.length) {
      if (form.querySelector('[data-sg-planner-success]')) {
        try { window.localStorage.removeItem('sg_planner_draft_v1'); } catch (error) { /* ignore blocked storage */ }
      }
      return;
    }
    if (form.dataset.sgInitialized === 'true') return;
    form.dataset.sgInitialized = 'true';
    form.noValidate = true;
    plannerPage.classList.add('is-enhanced');

    const draftKey = 'sg_planner_draft_v1';
    const navigation = form.querySelector('[data-sg-planner-navigation]');
    const fallbackSubmit = form.querySelector('[data-sg-planner-fallback-submit]');
    const previousButton = form.querySelector('[data-sg-planner-previous]');
    const nextButton = form.querySelector('[data-sg-planner-next]');
    const submitButton = form.querySelector('[data-sg-planner-submit]');
    const nextLabel = form.querySelector('[data-sg-planner-next-label]');
    const stepIndicators = Array.from(form.querySelectorAll('[data-sg-planner-stepper] li'));
    const progress = form.querySelector('[data-sg-planner-progress]');
    let currentStep = 0;

    function restoreDraft() {
      try {
        const draft = JSON.parse(window.localStorage.getItem(draftKey) || 'null');
        if (!draft || !Array.isArray(draft.controls)) return false;
        draft.controls.forEach((saved) => {
          const matching = Array.from(form.elements).filter((control) => {
            if (control.name !== saved.name) return false;
            if (control.type === 'checkbox' || control.type === 'radio') return control.value === saved.value;
            return true;
          });
          matching.forEach((control) => {
            if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(saved.checked);
            else if (saved.value !== undefined) control.value = saved.value;
          });
        });
        return true;
      } catch (error) {
        return false;
      }
    }

    const restored = restoreDraft();
    if (navigation) navigation.hidden = false;
    if (fallbackSubmit) fallbackSubmit.hidden = true;

    function firstInvalidInStep(index) {
      const step = steps[index];
      for (const field of step.querySelectorAll('[required]')) {
        if (field.closest('[data-sg-min-one]')) continue;
        const wrapper = field.closest('.sg-form-field');
        const valid = field.checkValidity();
        if (wrapper) wrapper.classList.toggle('has-error', !valid);
        if (valid) field.removeAttribute('aria-invalid');
        else field.setAttribute('aria-invalid', 'true');
        if (!valid) return field;
      }

      for (const group of step.querySelectorAll('[data-sg-min-one]')) {
        const hasSelection = Boolean(group.querySelector('input:checked'));
        group.classList.toggle('has-error', !hasSelection);
        const error = group.querySelector('[data-sg-choice-error]');
        if (error) error.hidden = hasSelection;
        if (!hasSelection) return group.querySelector('input');
      }
      return null;
    }

    function focusInvalid(field) {
      if (!field) return;
      field.focus();
      if (typeof field.reportValidity === 'function' && field.matches('[required]')) field.reportValidity();
    }

    function showStep(index, shouldFocus = false) {
      currentStep = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        const active = stepIndex === currentStep;
        step.hidden = !active;
        step.classList.toggle('is-active', active);
      });
      stepIndicators.forEach((indicator, stepIndex) => {
        indicator.classList.toggle('is-active', stepIndex === currentStep);
        indicator.classList.toggle('is-complete', stepIndex < currentStep);
        if (stepIndex === currentStep) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
      });
      if (progress) {
        const label = stepIndicators[currentStep] && stepIndicators[currentStep].querySelector('span:last-child');
        progress.textContent = `Step ${currentStep + 1} of ${steps.length}${label ? ` · ${label.textContent.trim()}` : ''}`;
      }
      if (previousButton) previousButton.hidden = currentStep === 0;
      if (nextButton) nextButton.hidden = currentStep === steps.length - 1;
      if (submitButton) submitButton.hidden = currentStep !== steps.length - 1;
      if (nextLabel) nextLabel.textContent = ['Next: Gifting Needs', 'Next: Budget', 'Next: Preferences'][currentStep] || 'Next';
      if (currentStep === steps.length - 1) updatePlannerWishlistSummary();
      if (shouldFocus) {
        const heading = steps[currentStep].querySelector('h2');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus();
        }
        steps[currentStep].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function saveDraft(showNotice = true) {
      const controls = Array.from(form.elements)
        .filter((control) => control.name && control.name.startsWith('contact[') && !['contact[body]', 'contact[subject]'].includes(control.name) && !['submit', 'button'].includes(control.type))
        .map((control) => ({
          name: control.name,
          value: control.value,
          checked: control.type === 'checkbox' || control.type === 'radio' ? control.checked : undefined,
        }));
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ controls, savedAt: Date.now() }));
        if (showNotice) createToast('Plan saved', 'Your answers are saved in this browser. Continue whenever you are ready.', '');
      } catch (error) {
        if (showNotice) createToast('Could not save plan', 'Browser storage is unavailable. Keep this page open to continue.', '');
      }
    }

    function updatePayload() {
      const wishlistField = form.querySelector('[data-sg-planner-wishlist-field]');
      if (wishlistField) wishlistField.value = formatPlannerWishlist(readWishlist());
      updateContactBody(form, '[data-sg-planner-body]', 'Wedding gifting planner enquiry');
    }

    if (navigation) {
      navigation.addEventListener('click', (event) => {
        const next = event.target.closest('[data-sg-planner-next]');
        if (next) {
          const invalid = firstInvalidInStep(currentStep);
          if (invalid) {
            focusInvalid(invalid);
            return;
          }
          showStep(currentStep + 1, true);
          return;
        }
        const previous = event.target.closest('[data-sg-planner-previous]');
        if (previous) {
          showStep(currentStep - 1, true);
          return;
        }
        if (event.target.closest('[data-sg-planner-save]')) saveDraft();
      });
    }

    form.addEventListener('input', (event) => {
      const field = event.target;
      const wrapper = field.closest('.sg-form-field');
      if (wrapper && field.checkValidity()) {
        wrapper.classList.remove('has-error');
        field.removeAttribute('aria-invalid');
      }
    });
    form.addEventListener('change', (event) => {
      const group = event.target.closest('[data-sg-min-one]');
      if (group && group.querySelector('input:checked')) {
        group.classList.remove('has-error');
        const error = group.querySelector('[data-sg-choice-error]');
        if (error) error.hidden = true;
      }
    });
    form.addEventListener('submit', (event) => {
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        const invalid = firstInvalidInStep(stepIndex);
        if (invalid) {
          event.preventDefault();
          showStep(stepIndex, false);
          focusInvalid(invalid);
          return;
        }
      }
      updatePayload();
      saveDraft(false);
    });

    let resumeAt = 0;
    if (restored) {
      steps.forEach((step, stepIndex) => {
        const hasAnswer = Array.from(step.querySelectorAll('input, select, textarea')).some((field) => {
          if (field.type === 'checkbox' || field.type === 'radio') return field.checked;
          return Boolean(String(field.value || '').trim());
        });
        if (hasAnswer) resumeAt = stepIndex;
      });
    }
    showStep(resumeAt, false);
    updatePlannerWishlistSummary();
  }

  function initCollectionsPage() {
    const root = document.querySelector('[data-sg-collections-page]');
    if (!root || root.dataset.sgInitialized === 'true') return;
    const collectionFilter = root.querySelector('[data-sg-filter-collection]');
    const priceFilter = root.querySelector('[data-sg-filter-price]');
    const typeFilter = root.querySelector('[data-sg-filter-type]');
    const sortFilter = root.querySelector('[data-sg-filter-sort]');
    const categories = root.querySelector('[data-sg-collections-categories]');
    const productSection = root.querySelector('[data-sg-collections-products]');
    const productGrid = root.querySelector('[data-sg-collections-product-grid]');
    const productCards = Array.from(root.querySelectorAll('[data-sg-collection-product]'));
    const collectionCards = Array.from(root.querySelectorAll('[data-sg-collection-card]'));
    const results = root.querySelector('[data-sg-collections-results]');
    const resultCount = root.querySelector('[data-sg-collections-count]');
    const emptyState = root.querySelector('[data-sg-collections-empty]');
    const allCollectionLink = root.querySelector('[data-sg-collection-view-all]');
    const clearButton = root.querySelector('[data-sg-filter-clear]');
    const heading = root.querySelector('[data-sg-collections-heading]');
    const description = root.querySelector('[data-sg-collections-description]');
    const baseCrumb = root.querySelector('[data-sg-collections-base-crumb]');
    const parentCrumb = root.querySelector('[data-sg-collections-parent-crumb]');
    const selectedSeparator = root.querySelector('[data-sg-collections-selected-separator]');
    const selectedCrumb = root.querySelector('[data-sg-collections-selected-crumb]');
    if (!collectionFilter || !categories || !productSection || !productGrid) return;
    root.dataset.sgInitialized = 'true';
    root.classList.add('is-enhanced');

    const baseHeading = root.getAttribute('data-base-heading') || (heading ? heading.textContent : 'Collections');
    const baseDescription = root.getAttribute('data-base-description') || (description ? description.textContent : '');
    const filteredDescription = root.getAttribute('data-filtered-description') || baseDescription;

    function priceValueFromQuery(value) {
      if (!value) return '';
      const map = {
        '100-999': '10000-99999',
        '1000-1999': '100000-199999',
        '2000-2999': '200000-299999',
        '3000-99999': '300000-',
        '1000-2000': '100000-199999',
        '2000-3000': '200000-299999',
      };
      return map[value] || value;
    }

    function restoreFiltersFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const collectionValue = params.get('collection') || params.get('cat') || '';
      collectionFilter.value = Array.from(collectionFilter.options).some((option) => option.value === collectionValue) ? collectionValue : '';
      if (priceFilter) {
        const priceValue = priceValueFromQuery(params.get('price') || params.get('pr') || '');
        priceFilter.value = Array.from(priceFilter.options).some((option) => option.value === priceValue) ? priceValue : '';
      }
      if (typeFilter) {
        const requestedType = params.get('type') || '';
        typeFilter.value = Array.from(typeFilter.options).some((option) => option.value === requestedType) ? requestedType : '';
      }
      if (sortFilter) {
        const requestedSort = params.get('sort') || 'featured';
        sortFilter.value = ['featured', 'price-ascending', 'price-descending', 'title-ascending'].includes(requestedSort)
          ? requestedSort
          : 'featured';
      }
    }

    function updateUrl() {
      const url = new URL(window.location.href);
      ['collection', 'cat', 'price', 'pr', 'type', 'sort'].forEach((key) => url.searchParams.delete(key));
      if (collectionFilter.value) url.searchParams.set('collection', collectionFilter.value);
      if (priceFilter && priceFilter.value) url.searchParams.set('pr', priceFilter.value);
      if (typeFilter && typeFilter.value) url.searchParams.set('type', typeFilter.value);
      if (sortFilter && sortFilter.value !== 'featured') url.searchParams.set('sort', sortFilter.value);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function updateCollectionHeading(selectedHandle) {
      const selectedCard = collectionCards.find((card) => card.getAttribute('data-collection-handle') === selectedHandle);
      const selectedTitle = selectedCard ? selectedCard.getAttribute('data-collection-title') : '';
      const hasSelectedCollection = Boolean(selectedHandle && selectedTitle);
      root.classList.toggle('is-collection-selected', hasSelectedCollection);
      if (heading) heading.textContent = hasSelectedCollection ? selectedTitle : baseHeading;
      if (description) description.textContent = hasSelectedCollection ? filteredDescription : baseDescription;
      if (baseCrumb) baseCrumb.hidden = hasSelectedCollection;
      if (parentCrumb) parentCrumb.hidden = !hasSelectedCollection;
      if (selectedSeparator) selectedSeparator.hidden = !hasSelectedCollection;
      if (selectedCrumb) {
        selectedCrumb.hidden = !hasSelectedCollection;
        selectedCrumb.textContent = hasSelectedCollection ? selectedTitle : '';
      }
      collectionCards.forEach((card) => card.classList.toggle('is-current', card === selectedCard));
      if (allCollectionLink) {
        allCollectionLink.hidden = !hasSelectedCollection;
        const link = allCollectionLink.querySelector('a');
        const label = allCollectionLink.querySelector('[data-sg-collection-view-all-label]');
        if (link && selectedCard) link.href = selectedCard.getAttribute('href') || link.href;
        if (label) label.textContent = hasSelectedCollection ? `View all ${selectedTitle} gifts` : '';
      }
    }

    function renderResults() {
      const selectedCollection = collectionFilter.value;
      const selectedPrice = priceFilter && priceFilter.value ? priceFilter.value.split('-') : [];
      const minimumPrice = selectedPrice.length && selectedPrice[0] !== '' ? Number(selectedPrice[0]) : null;
      const maximumPrice = selectedPrice.length > 1 && selectedPrice[1] !== '' ? Number(selectedPrice[1]) : null;
      const selectedType = typeFilter ? typeFilter.value : '';
      const selectedSort = sortFilter && ['featured', 'price-ascending', 'price-descending', 'title-ascending'].includes(sortFilter.value)
        ? sortFilter.value
        : 'featured';
      const hasActiveFilter = Boolean(selectedCollection || (priceFilter && priceFilter.value) || selectedType || selectedSort !== 'featured');
      const seenProductIds = new Set();
      const visibleCards = [];

      productCards.forEach((card) => {
        const cardCollection = card.getAttribute('data-collection-handle') || '';
        const cardType = card.getAttribute('data-product-type') || '';
        const cardPrice = Number(card.getAttribute('data-product-price-cents')) || 0;
        const productId = card.getAttribute('data-product-id') || '';
        let matches = !selectedCollection || cardCollection === selectedCollection;
        if (matches && selectedType) matches = cardType === selectedType;
        if (matches && minimumPrice !== null) matches = cardPrice >= minimumPrice;
        if (matches && maximumPrice !== null) matches = cardPrice <= maximumPrice;
        if (matches && !selectedCollection && seenProductIds.has(productId)) matches = false;
        if (matches) {
          visibleCards.push(card);
          seenProductIds.add(productId);
        }
        card.hidden = true;
      });

      if (selectedSort === 'price-ascending') visibleCards.sort((a, b) => Number(a.dataset.productPriceCents) - Number(b.dataset.productPriceCents));
      if (selectedSort === 'price-descending') visibleCards.sort((a, b) => Number(b.dataset.productPriceCents) - Number(a.dataset.productPriceCents));
      if (selectedSort === 'title-ascending') visibleCards.sort((a, b) => (a.dataset.productTitle || '').localeCompare(b.dataset.productTitle || ''));
      visibleCards.forEach((card) => {
        card.hidden = false;
        productGrid.append(card);
      });

      categories.hidden = hasActiveFilter;
      productSection.hidden = !hasActiveFilter;
      if (results) results.hidden = !hasActiveFilter;
      if (emptyState) emptyState.hidden = !hasActiveFilter || visibleCards.length > 0;
      if (resultCount) resultCount.textContent = selectedCollection
        ? `${visibleCards.length} ${visibleCards.length === 1 ? 'Product' : 'Products'}`
        : `${visibleCards.length} Gifts Found`;
      updateCollectionHeading(selectedCollection);
    }

    function applyFilters(updateBrowserUrl = false) {
      renderResults();
      if (updateBrowserUrl) updateUrl();
    }

    restoreFiltersFromUrl();
    applyFilters(false);
    collectionFilter.addEventListener('change', () => applyFilters(true));
    if (priceFilter) priceFilter.addEventListener('change', () => applyFilters(true));
    if (typeFilter) typeFilter.addEventListener('change', () => applyFilters(true));
    if (sortFilter) sortFilter.addEventListener('change', () => applyFilters(true));
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        collectionFilter.value = '';
        if (priceFilter) priceFilter.value = '';
        if (typeFilter) typeFilter.value = '';
        if (sortFilter) sortFilter.value = 'featured';
        applyFilters(true);
      });
    }
    root.addEventListener('click', (event) => {
      const card = event.target.closest('[data-sg-collection-card]');
      if (!card || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      collectionFilter.value = card.getAttribute('data-collection-handle') || '';
      applyFilters(true);
      if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.addEventListener('popstate', () => {
      restoreFiltersFromUrl();
      applyFilters(false);
    });
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
    const openButton = event.target.closest('[data-sg-open-wishlist-dialog]');
    if (openButton) {
      const dialog = document.querySelector('[data-sg-wishlist-dialog]');
      if (dialog) {
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
        else dialog.setAttribute('open', '');
        const firstField = dialog.querySelector('input:not([type="hidden"]), textarea');
        if (firstField) firstField.focus();
      }
      return;
    }
    const closeButton = event.target.closest('[data-sg-close-wishlist-dialog]');
    if (closeButton) {
      const dialog = closeButton.closest('dialog');
      if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
      else if (dialog) dialog.removeAttribute('open');
      return;
    }
    const quantityStep = event.target.closest('[data-sg-wishlist-quantity-step]');
    if (quantityStep) {
      const item = quantityStep.closest('.sg-wishlist-item');
      if (!item) return;
      const items = readWishlist();
      const savedItem = items.find((entry) => String(entry.id) === item.dataset.productId);
      if (!savedItem) return;
      const delta = Number(quantityStep.getAttribute('data-sg-wishlist-quantity-step')) || 0;
      savedItem.quantity = normalizeWishlistQuantity(Number(savedItem.quantity || 1) + delta);
      const quantityInput = item.querySelector('[data-sg-wishlist-quantity]');
      if (quantityInput) quantityInput.value = String(savedItem.quantity);
      saveWishlist(items, { renderItems: false });
      return;
    }
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
      savedItem.quantity = normalizeWishlistQuantity(event.target.value);
      event.target.value = String(savedItem.quantity);
      saveWishlist(items, { renderItems: false });
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

  function init() {
    initContactForms();
    initPlannerForm();
    initCollectionsPage();
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
    initContactForms();
    initPlannerForm();
    initCollectionsPage();
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
