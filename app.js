(() => {
  const config = window.OURS_CONFIG;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));

  const money = (value) => `¥ ${Number(value).toLocaleString('zh-CN')}`;

  const parseLocalDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const formatDate = (date) => new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);

  const dateSerial = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const dayDiff = (a, b) => dateSerial(a) - dateSerial(b);

  function updateDates() {
    const today = startOfToday();
    const start = parseLocalDate(config.relationshipStart);
    const days = Math.max(1, dayDiff(today, start) + 1);
    const now = new Date();
    let birthday = new Date(now.getFullYear(), config.birthday.month - 1, config.birthday.day);
    if (birthday < today) birthday = new Date(now.getFullYear() + 1, config.birthday.month - 1, config.birthday.day);

    $('#togetherDays').textContent = `DAY ${days}`;
    $('#todayLabel').textContent = formatDate(today);
    $('#daysNumber').textContent = String(days);
    $('#birthdayDays').textContent = String(Math.max(0, dayDiff(birthday, today)));
    $('#startDateLabel').textContent = `从 ${formatDate(start)} 开始`;
    $('#birthdayDateLabel').textContent = `${formatDate(birthday)} · 生日倒计时`;
  }

  function updateClock() {
    const now = new Date();
    $('#liveTime').textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  let toastTimer = 0;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }
  let audioContext = null;
  let ambientGain = null;
  let soundOn = false;

  async function toggleSound() {
    const button = $('#soundToggle');
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        ambientGain = audioContext.createGain();
        ambientGain.gain.value = 0.0001;
        ambientGain.connect(audioContext.destination);
        [82.41, 123.47, 164.81].forEach((frequency, index) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = index === 1 ? 'triangle' : 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.value = index === 2 ? 0.28 : 0.4;
          oscillator.connect(gain);
          gain.connect(ambientGain);
          oscillator.start();
        });
      }
      await audioContext.resume();
      soundOn = !soundOn;
      const now = audioContext.currentTime;
      ambientGain.gain.cancelScheduledValues(now);
      ambientGain.gain.exponentialRampToValueAtTime(soundOn ? 0.018 : 0.0001, now + 0.8);
      button.classList.toggle('is-on', soundOn);
      button.setAttribute('aria-pressed', String(soundOn));
      button.innerHTML = `SOUND <i></i>`;
    } catch {
      showToast('当前浏览器暂时不能播放环境音。');
    }
  }  function initPointerEffects() {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;

    const dot = $('#cursorDot');
    const ring = $('#cursorRing');
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;

    let cursorFrame = 0;
    const renderCursor = () => {
      ringX += (pointerX - ringX) * 0.16;
      ringY += (pointerY - ringY) * 0.16;
      dot.style.transform = `translate(${pointerX}px, ${pointerY}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      if (!document.hidden) cursorFrame = window.requestAnimationFrame(renderCursor);
    };
    renderCursor();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        window.cancelAnimationFrame(cursorFrame);
        renderCursor();
      }
    });

    document.addEventListener('pointermove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      document.documentElement.style.setProperty('--mx', `${event.clientX}px`);
      document.documentElement.style.setProperty('--my', `${event.clientY}px`);
    }, { passive: true });

    document.addEventListener('pointerover', (event) => {
      if (event.target.closest('a, button, .dish-card, .memory-card')) {
        document.body.classList.add('cursor-active');
      }
    });

    document.addEventListener('pointerout', (event) => {
      if (event.target.closest('a, button, .dish-card, .memory-card')) {
        document.body.classList.remove('cursor-active');
      }
    });

    $$('.magnetic').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
        element.style.transform = `translate(${x}px, ${y}px)`;
      });
      element.addEventListener('pointerleave', () => {
        element.style.transform = '';
      });
    });

    const hero = $('.hero');
    const stage = $('#heroStage');
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty('--tilt-x', `${x * 8}deg`);
      stage.style.setProperty('--tilt-y', `${y * -8}deg`);
      stage.style.setProperty('--shift-x', `${x * 16}px`);
      stage.style.setProperty('--shift-y', `${y * 16}px`);
    });
    hero.addEventListener('pointerleave', () => {
      stage.style.setProperty('--tilt-x', '0deg');
      stage.style.setProperty('--tilt-y', '0deg');
      stage.style.setProperty('--shift-x', '0px');
      stage.style.setProperty('--shift-y', '0px');
    });
  }
  function initPageMotion() {
    const revealElements = $$('.reveal, [data-reveal]');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealElements.forEach((element) => observer.observe(element));
    }

    const progress = $('#scrollProgress');
    const header = $('#siteHeader');
    const orderFab = $('#orderFab');
    let ticking = false;

    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      if (window.scrollY > window.innerHeight * 0.72 || getCartCount() > 0) {
        orderFab.classList.add('is-visible');
      } else {
        orderFab.classList.remove('is-visible');
      }
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateScroll);
      }
    }, { passive: true });
    updateScroll();
  }

  function bindNavigation() {
    const toggle = $('#menuToggle');
    const menu = $('#mobileMenu');
    const setOpen = (open) => {
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
    };
    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('menu-open')));
    $$('a', menu).forEach((link) => link.addEventListener('click', () => setOpen(false)));
  }
  const CART_KEY = 'ours-supper-cart-v2';
  const LAST_ORDER_KEY = 'ours-supper-last-order-v2';
  const CUSTOM_DISH_KEY = 'ours-custom-dishes-v1';
  let activeCategory = '全部';
  let activeDishId = null;
  let modalQuantity = 1;
  let cart = loadCart();
  let customDishes = loadCustomDishes();
  let editingDishId = null;
  let pendingDishImage = '';
  let deleteConfirmTimer = 0;

  function loadCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY));
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {}
    return {};
  }

  function loadCustomDishes() {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_DISH_KEY));
      if (Array.isArray(saved)) {
        return saved.filter((dish) => dish && dish.id && dish.name && dish.category).map((dish) => ({
          ...dish,
          custom: true,
          price: Math.max(0, Number(dish.price) || 0),
          ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : [],
          steps: Array.isArray(dish.steps) ? dish.steps : [],
        }));
      }
    } catch {}
    return [];
  }

  function saveCustomDishes() {
    try {
      localStorage.setItem(CUSTOM_DISH_KEY, JSON.stringify(customDishes));
      return true;
    } catch {
      return false;
    }
  }

  function getBuiltInDishes() {
    const extra = Array.isArray(window.OURS_EXTRA_MENU) ? window.OURS_EXTRA_MENU : [];
    return [...config.menu, ...extra];
  }

  function getAllDishes() {
    return [...getBuiltInDishes(), ...customDishes];
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  function getCartCount() {
    return Object.values(cart).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  }

  function getCartTotal() {
    return Object.entries(cart).reduce((sum, [id, quantity]) => {
      const dish = getAllDishes().find((item) => item.id === id);
      return sum + (dish ? dish.price * quantity : 0);
    }, 0);
  }

  function renderDishes() {
    const filtered = activeCategory === '全部'
      ? getAllDishes()
      : getAllDishes().filter((dish) => dish.category === activeCategory);

    $('#dishGrid').innerHTML = filtered.map((dish) => `
      <article class="dish-card ${dish.custom ? 'is-custom' : ''}" data-dish-id="${escapeHTML(dish.id)}">
        <button class="dish-open" type="button" data-action="recipe" aria-label="查看${escapeHTML(dish.name)}的菜谱">
          <span class="dish-visual">
            <img src="${escapeHTML(dish.image)}" alt="${escapeHTML(dish.name)}" loading="lazy" />
            <span class="dish-number">${escapeHTML(dish.number)}</span>
            <span class="dish-badge">${escapeHTML(dish.badge)}</span>
          </span>
          <span class="dish-copy">
            <span class="dish-en">${escapeHTML(dish.en)}</span>
            <span class="dish-title-row"><strong>${escapeHTML(dish.name)}</strong><i>${money(dish.price)}</i></span>
            <span class="dish-desc">${escapeHTML(dish.desc)}</span>
            <span class="dish-foot"><small>${escapeHTML(dish.time)} · ${escapeHTML(dish.flavor)}</small><b>查看菜谱 ↗</b></span>
          </span>
        </button>
        <button class="dish-add" type="button" data-action="add" aria-label="把${escapeHTML(dish.name)}加入今晚的桌">＋</button>
      </article>
    `).join('');

    $$('.dish-card', $('#dishGrid')).forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (reducedMotion) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--card-rx', `${y * -5}deg`);
        card.style.setProperty('--card-ry', `${x * 5}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--card-rx', '0deg');
        card.style.setProperty('--card-ry', '0deg');
      });
    });
  }
  document.dispatchEvent(new CustomEvent("ours:dishes-rendered"));

  function openLayer(layer, panel) {
    layer.hidden = false;
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => {
      layer.classList.add('is-open');
      panel?.classList.add('is-open');
      panel?.setAttribute('aria-hidden', 'false');
      const focusTarget = panel?.querySelector('.close-button, button, input');
      focusTarget?.focus({ preventScroll: true });
    });
  }

  function closeLayer(layer, panel) {
    layer.classList.remove('is-open');
    panel?.classList.remove('is-open');
    panel?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    window.setTimeout(() => { layer.hidden = true; }, reducedMotion ? 0 : 320);
  }

  function openDish(id) {
    const dish = getAllDishes().find((item) => item.id === id);
    if (!dish) return;
    activeDishId = id;
    modalQuantity = 1;
    $('#dishModalImage').src = dish.image;
    $('#dishModalImage').alt = dish.name;
    $('#dishModalCategory').textContent = dish.category;
    $('#dishModalNumber').textContent = dish.number;
    $('#dishModalTitle').textContent = dish.name;
    $('#dishModalTitle').dataset.dishId = id;
    $('#dishModalDesc').textContent = dish.desc;
    $('#dishModalTime').textContent = dish.time;
    $('#dishModalServes').textContent = `SERVES ${dish.serves}`;
    $('#dishModalFlavor').textContent = dish.flavor;
    $('#dishModalIngredients').innerHTML = dish.ingredients.map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    $('#dishModalSteps').innerHTML = dish.steps.map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    $('#modalQuantity').textContent = '1';
    $('#editDish').hidden = !dish.custom;
    openLayer($('#dishLayer'), $('#dishDialog'));
    document.dispatchEvent(new CustomEvent('ours:dish-opened', { detail: { id } }));
  }

  function closeDish() {
    closeLayer($('#dishLayer'), $('#dishDialog'));
    activeDishId = null;
  }

  function addToCart(id, quantity = 1) {
    const dish = getAllDishes().find((item) => item.id === id);
    if (!dish) return;
    cart[id] = Number(cart[id] || 0) + quantity;
    saveCart();
    renderCart();
    $('#orderFab').classList.add('is-visible', 'is-popping');
    window.setTimeout(() => $('#orderFab').classList.remove('is-popping'), 420);
    showToast(`${dish.name} 已加入今晚的桌`);
  }
  function setActiveCategory(category) {
    activeCategory = category;
    $$('button[data-category]', $('#menuFilters')).forEach((button) => {
      const selected = button.dataset.category === category;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    renderDishes();
  }

  function splitRecipeLines(value) {
    return value.split(/\r?\n|；|;/).map((item) => item.trim()).filter(Boolean);
  }

  function openDishEditor(id = null) {
    const dish = id ? customDishes.find((item) => item.id === id) : null;
    const form = $('#dishEditorForm');
    form.reset();
    editingDishId = dish ? dish.id : null;
    pendingDishImage = dish?.image || '';
    $('#dishEditorTitle').textContent = dish ? '编辑我们的菜谱' : '自定义菜品';
    $('#dishName').value = dish?.name || '';
    $('#dishCategory').value = dish?.category || '主菜';
    $('#dishPrice').value = String(dish?.price ?? 68);
    $('#dishEn').value = dish?.en || '';
    $('#dishTime').value = dish?.time || '';
    $('#dishFlavor').value = dish?.flavor || '';
    $('#dishDesc').value = dish?.desc || '';
    $('#dishEditorIngredients').value = (dish?.ingredients || []).join('\n');
    $('#dishEditorSteps').value = (dish?.steps || []).join('\n');
    $('#dishImagePreview').src = dish?.image || 'assets/dish-custom.svg';
    $('#dishSourceUrl').value = dish?.sourceUrl || '';
    $('#dishSourcePlatform').value = dish?.sourcePlatform || '';
    $('#recipeImportText').value = '';
    $('#recipeImportStatus').textContent = dish?.sourceUrl ? `已保存来源：${dish.sourcePlatform || '外部链接'}` : '等待粘贴内容';
    $('#openRecipeSource').hidden = !dish?.sourceUrl;
    $('#dishImage').value = '';
    const deleteButton = $('#deleteCustomDish');
    deleteButton.hidden = !dish;
    deleteButton.classList.remove('is-confirming');
    deleteButton.textContent = '删除这道菜';
    window.clearTimeout(deleteConfirmTimer);
    openLayer($('#dishEditorLayer'), $('#dishEditor'));
  }

  function closeDishEditor() {
    closeLayer($('#dishEditorLayer'), $('#dishEditor'));
    editingDishId = null;
    pendingDishImage = '';
    window.clearTimeout(deleteConfirmTimer);
  }

  function compressDishImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('请选择图片文件。'));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('照片太大了，请选择 8MB 以内的图片。'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('照片读取失败。'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('这张照片暂时无法处理。'));
        image.onload = () => {
          const maxSide = 1100;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#11120f';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function saveDishFromForm(event) {
    event.preventDefault();
    const name = $('#dishName').value.trim();
    const category = $('#dishCategory').value;
    const ingredients = splitRecipeLines($('#dishEditorIngredients').value);
    const steps = splitRecipeLines($('#dishEditorSteps').value);
    if (!name || !ingredients.length || !steps.length) {
      showToast('菜名、食材和做法都要写一点点。');
      return;
    }

    const existing = editingDishId ? customDishes.find((dish) => dish.id === editingDishId) : null;
    const id = existing?.id || `custom-${Date.now()}`;
    const dish = {
      id,
      number: existing?.number || `C${customDishes.length + 1}`,
      category,
      name,
      en: $('#dishEn').value.trim().toUpperCase() || 'OUR CUSTOM RECIPE',
      price: Math.max(0, Number($('#dishPrice').value) || 0),
      image: pendingDishImage || existing?.image || 'assets/dish-custom.svg',
      time: $('#dishTime').value.trim() || '随心',
      serves: '2',
      flavor: $('#dishFlavor').value.trim() || '我们的味道',
      badge: '我们的菜谱',
      desc: $('#dishDesc').value.trim() || '这是我们自己写进菜单里的一道菜。',
      sourceUrl: $('#dishSourceUrl').value.trim(),
      sourcePlatform: $('#dishSourcePlatform').value.trim(),
      ingredients,
      steps,
      custom: true,
    };

    const snapshot = JSON.stringify(customDishes);
    if (existing) {
      const index = customDishes.findIndex((item) => item.id === existing.id);
      customDishes[index] = dish;
    } else {
      customDishes.push(dish);
    }

    if (!saveCustomDishes()) {
      customDishes = JSON.parse(snapshot);
      showToast('保存失败，可能是照片占用的空间太大了。');
      return;
    }

    setActiveCategory('全部');
    renderCart();
    closeDishEditor();
    showToast(existing ? '菜谱已经更新。' : '新菜已经写进我们的菜单。');
    window.setTimeout(() => openDish(id), reducedMotion ? 0 : 360);
  }

  function deleteEditingDish() {
    if (!editingDishId) return;
    const id = editingDishId;
    const dishesSnapshot = JSON.stringify(customDishes);
    const cartSnapshot = JSON.stringify(cart);
    customDishes = customDishes.filter((dish) => dish.id !== id);
    delete cart[id];
    if (!saveCustomDishes()) {
      customDishes = JSON.parse(dishesSnapshot);
      cart = JSON.parse(cartSnapshot);
      showToast('删除失败，请稍后再试。');
      return;
    }
    saveCart();
    setActiveCategory('全部');
    renderCart();
    closeDishEditor();
    closeDish();
    showToast('这道菜已经从我们的菜单里拿掉了。');
  }

  function bindDishEditor() {
    $('#addCustomDish').addEventListener('click', () => openDishEditor());
    $('#editDish').addEventListener('click', () => {
      const id = activeDishId;
      if (!id) return;
      closeDish();
      window.setTimeout(() => openDishEditor(id), reducedMotion ? 0 : 350);
    });
    $('#closeDishEditor').addEventListener('click', closeDishEditor);
    $('#cancelDishEditor').addEventListener('click', closeDishEditor);
    $('#editorBackdrop').addEventListener('click', closeDishEditor);
    $('#dishEditorForm').addEventListener('submit', saveDishFromForm);

    $('#dishImage').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const preview = $('#dishImagePreview');
      preview.classList.add('is-loading');
      try {
        pendingDishImage = await compressDishImage(file);
        preview.src = pendingDishImage;
        showToast('照片已经准备好。');
      } catch (error) {
        pendingDishImage = '';
        showToast(error.message || '照片处理失败。');
      } finally {
        preview.classList.remove('is-loading');
      }
    });

    $('#deleteCustomDish').addEventListener('click', (event) => {
      const button = event.currentTarget;
      if (button.classList.contains('is-confirming')) {
        deleteEditingDish();
        return;
      }
      button.classList.add('is-confirming');
      button.textContent = '再点一次确认删除';
      window.clearTimeout(deleteConfirmTimer);
      deleteConfirmTimer = window.setTimeout(() => {
        button.classList.remove('is-confirming');
        button.textContent = '删除这道菜';
      }, 2600);
    });
  }
  function bindMenu() {
    $('#menuFilters').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-category]');
      if (!button) return;
      activeCategory = button.dataset.category;
      $$('button', $('#menuFilters')).forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      renderDishes();
    });

    $('#dishGrid').addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      const card = event.target.closest('.dish-card');
      if (!action || !card) return;
      if (action.dataset.action === 'add') {
        addToCart(card.dataset.dishId);
      } else {
        openDish(card.dataset.dishId);
      }
    });

    const pickRandomDish = () => {
      const allDishes = getAllDishes();
      const dish = allDishes[Math.floor(Math.random() * allDishes.length)];
      openDish(dish.id);
    };
    $('#chefPick').addEventListener('click', pickRandomDish);
    $('#surpriseHero')?.addEventListener('click', pickRandomDish);
    $('#herPick')?.addEventListener('click', pickRandomDish);

    $('#closeDish').addEventListener('click', closeDish);
    $('#dishBackdrop').addEventListener('click', closeDish);
    $('#modalMinus').addEventListener('click', () => {
      modalQuantity = Math.max(1, modalQuantity - 1);
      $('#modalQuantity').textContent = String(modalQuantity);
    });
    $('#modalPlus').addEventListener('click', () => {
      modalQuantity = Math.min(9, modalQuantity + 1);
      $('#modalQuantity').textContent = String(modalQuantity);
    });
    $('#modalAddDish').addEventListener('click', () => {
      if (!activeDishId) return;
      addToCart(activeDishId, modalQuantity);
      closeDish();
    });
  }
  function renderCart() {
    const entries = Object.entries(cart)
      .map(([id, quantity]) => ({ dish: getAllDishes().find((item) => item.id === id), quantity: Number(quantity) }))
      .filter((entry) => entry.dish && entry.quantity > 0);

    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = entries.reduce((sum, entry) => sum + entry.dish.price * entry.quantity, 0);
    $('#orderFabCount').textContent = String(count);
    $('#orderFab').classList.toggle('has-items', count > 0);
    $('#orderEmpty').hidden = entries.length > 0;
    $('#orderLines').innerHTML = entries.map(({ dish, quantity }) => `
      <div class="order-line" data-cart-id="${escapeHTML(dish.id)}">
        <img src="${escapeHTML(dish.image)}" alt="" />
        <div class="order-line-copy"><strong>${escapeHTML(dish.name)}</strong><small>${money(dish.price)} · ${escapeHTML(dish.category)}</small></div>
        <div class="line-quantity"><button type="button" data-cart-action="minus" aria-label="减少一份">−</button><span>${quantity}</span><button type="button" data-cart-action="plus" aria-label="增加一份">＋</button></div>
        <button class="line-remove" type="button" data-cart-action="remove" aria-label="移除${escapeHTML(dish.name)}">×</button>
      </div>
    `).join('');
    $('#orderTotal').textContent = money(total);
    $('#orderSummary').hidden = entries.length === 0;
    return { entries, count, total };
  }

  function resetOrderView() {
    $('#orderBody').hidden = false;
    $('#orderSummary').hidden = Object.keys(cart).length === 0;
    $('#orderSuccess').hidden = true;
  }

  function openOrder() {
    resetOrderView();
    renderCart();
    openLayer($('#orderLayer'), $('#orderDrawer'));
  }

  function closeOrder() {
    closeLayer($('#orderLayer'), $('#orderDrawer'));
  }

  function updateCartItem(id, action) {
    if (!cart[id]) return;
    if (action === 'plus') cart[id] += 1;
    if (action === 'minus') cart[id] -= 1;
    if (action === 'remove' || cart[id] <= 0) delete cart[id];
    saveCart();
    renderCart();
  }
  function buildOrderText(items, note, total, number) {
    const lines = items.map(({ dish, quantity }) => `${dish.name} × ${quantity}`).join('\n');
    return `OURS · 今晚的桌\n订单 ${number}\n\n${lines}\n\n${note ? `备注：${note}\n` : ''}合计：${money(total)}\n\n今晚，等你入席。`;
  }

  function submitOrder() {
    const { entries, total } = renderCart();
    if (!entries.length) return;
    const note = $('#orderNote').value.trim();
    const number = `NO. ${String(Date.now()).slice(-4)}`;
    const order = {
      number, note, total, items: entries.map(({ dish, quantity }) => ({ id: dish.id, name: dish.name, quantity, price: dish.price })),
      createdAt: new Date().toISOString(),
    };
    try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch {}
    $('#orderNumber').textContent = number;
    $('#orderSuccessCopy').textContent = buildOrderText(entries, note, total, number);
    $('#orderBody').hidden = true;
    $('#orderSummary').hidden = true;
    $('#orderSuccess').hidden = false;
    $('#orderDrawer').classList.add('is-success');
    burstConfetti(window.innerWidth - 90, window.innerHeight - 100);
  }

  async function copyOrder() {
    const text = $('#orderSuccessCopy').textContent;
    try {
      await navigator.clipboard.writeText(text);
      showToast('点菜单已复制，可以发给厨房了。');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showToast('点菜单已复制。');
    }
  }

  function bindOrder() {
    $('#orderFab').addEventListener('click', openOrder);
    $('#closeOrder').addEventListener('click', closeOrder);
    $('#orderBackdrop').addEventListener('click', closeOrder);
    $('#emptyOrderBack').addEventListener('click', () => {
      closeOrder();
      $('#menu').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
    $('#orderLines').addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-action]');
      const line = event.target.closest('.order-line');
      if (!button || !line) return;
      updateCartItem(line.dataset.cartId, button.dataset.cartAction);
    });
    $('#submitOrder').addEventListener('click', submitOrder);
    $('#copyOrder').addEventListener('click', copyOrder);
    $('#newOrder').addEventListener('click', () => {
      cart = {};
      saveCart();
      $('#orderDrawer').classList.remove('is-success');
      $('#orderNote').value = '';
      resetOrderView();
      renderCart();
      closeOrder();
      window.setTimeout(() => $('#menu').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), 180);
    });
  }
  function renderMemories() {
    $('#memoryGrid').innerHTML = config.memories.map((memory, index) => `
      <button class="memory-card reveal" type="button" data-memory-index="${index}" aria-label="打开回忆：${escapeHTML(memory.title)}">
        <span class="memory-image"><img src="${escapeHTML(memory.src)}" alt="${escapeHTML(memory.title)}" loading="lazy" /><i>0${index + 1}</i></span>
        <span class="memory-copy">
          <small>${escapeHTML(memory.date)} · ${escapeHTML(memory.location)}</small>
          <strong>${escapeHTML(memory.title)}</strong>
          <span>${escapeHTML(memory.text)}</span>
          <b>打开这一刻 ↗</b>
        </span>
      </button>
    `).join('');
    $$('.memory-card', $('#memoryGrid')).forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (reducedMotion) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--memory-rx', `${y * -3}deg`);
        card.style.setProperty('--memory-ry', `${x * 3}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--memory-rx', '0deg');
        card.style.setProperty('--memory-ry', '0deg');
      });
    });
  }

  function openMemory(index) {
    const memory = config.memories[index];
    if (!memory) return;
    $('#memoryModalImage').src = memory.src;
    $('#memoryModalImage').alt = memory.title;
    $('#memoryModalMeta').textContent = `${memory.date} / ${memory.location}`;
    $('#memoryModalTitle').textContent = memory.title;
    $('#memoryModalText').textContent = memory.text;
    openLayer($('#memoryLayer'), $('#memoryDialog'));
  }

  function closeMemory() {
    closeLayer($('#memoryLayer'), $('#memoryDialog'));
  }

  function bindMemories() {
    $('#memoryGrid').addEventListener('click', (event) => {
      const card = event.target.closest('[data-memory-index]');
      if (card) openMemory(Number(card.dataset.memoryIndex));
    });
    $('#memoryBackdrop').addEventListener('click', closeMemory);
    $('#closeMemory').addEventListener('click', closeMemory);
  }
  function burstConfetti(x, y) {
    if (reducedMotion) return;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const colors = ['#d9b36f', '#efe2c7', '#8b322c', '#6f7c63'];
    for (let index = 0; index < 26; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${x}px`);
      piece.style.setProperty('--y', `${y}px`);
      piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 320}px`);
      piece.style.setProperty('--dy', `${-60 - Math.random() * 220}px`);
      piece.style.setProperty('--r', `${Math.random() * 540}deg`);
      piece.style.background = colors[index % colors.length];
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    window.setTimeout(() => layer.remove(), 1800);
  }

  const WISH_KEY = 'ours-supper-wishes-v2';
  let wishes = [];

  function loadWishes() {
    try {
      const saved = JSON.parse(localStorage.getItem(WISH_KEY));
      if (Array.isArray(saved)) return saved.filter((wish) => wish && wish.id && wish.title);
    } catch {}
    return config.wishes.map((wish) => ({ ...wish, done: false }));
  }

  function saveWishes() {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(wishes)); } catch {}
  }

  function renderWishes() {
    const complete = wishes.filter((wish) => wish.done).length;
    $('#wishProgress').textContent = `${String(complete).padStart(2, '0')} / ${String(wishes.length).padStart(2, '0')}`;
    $('#wishBar').style.width = `${wishes.length ? (complete / wishes.length) * 100 : 0}%`;
    $('#wishList').innerHTML = wishes.map((wish) => `
      <div class="wish-item ${wish.done ? 'is-done' : ''}" data-wish-id="${escapeHTML(wish.id)}">
        <button type="button" aria-label="${wish.done ? '标记为未完成' : '标记为已完成'}"><span>✓</span></button>
        <p>${escapeHTML(wish.title)}</p>
        <small>${wish.done ? 'DONE' : 'TO DO'}</small>
      </div>
    `).join('');
  }

  function bindWishes() {
    $('#wishList').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const item = event.target.closest('[data-wish-id]');
      if (!button || !item) return;
      const wish = wishes.find((entry) => entry.id === item.dataset.wishId);
      if (!wish) return;
      wish.done = !wish.done;
      saveWishes();
      renderWishes();
      if (wish.done) {
        burstConfetti(event.clientX, event.clientY);
        showToast('又点亮一件想一起做的事。');
      }
    });

    $('#wishForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('#wishInput');
      const title = input.value.trim();
      if (!title) return;
      wishes.push({ id: `wish-${Date.now()}`, title, done: false });
      input.value = '';
      saveWishes();
      renderWishes();
      showToast('已经放进我们的待办清单。');
    });
  }
  const HEART_KEY = 'ours-supper-heart-v2';

  function bindHeart() {
    const button = $('#heartButton');
    const count = $('#heartCount');
    let value = 0;
    try { value = Number(localStorage.getItem(HEART_KEY) || 0) || 0; } catch {}
    count.textContent = String(value);
    button.addEventListener('click', (event) => {
      value += 1;
      count.textContent = String(value);
      button.classList.remove('is-pulsing');
      void button.offsetWidth;
      button.classList.add('is-pulsing');
      try { localStorage.setItem(HEART_KEY, String(value)); } catch {}
      burstConfetti(event.clientX, event.clientY);
    });
  }
  const GAME_SYMBOLS = config.gamePairs.map((pair) => pair.symbol);
  let gameDeck = [];
  let gameFlipped = [];
  let gameMatched = 0;
  let gameMoves = 0;
  let gameLocked = false;

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function createGame() {
    gameDeck = shuffle([...GAME_SYMBOLS, ...GAME_SYMBOLS]);
    gameFlipped = [];
    gameMatched = 0;
    gameMoves = 0;
    gameLocked = false;
  }

  function renderGame() {
    $('#gameMoves').textContent = `${gameMoves} 步`;
    $('#gamePairs').textContent = `${gameMatched / 2} / ${GAME_SYMBOLS.length} 对`;
    $('#gameResult').textContent = gameMatched === gameDeck.length && gameDeck.length ? '找到了。散落的回忆，最后还是坐回同一张桌。' : '';
    $('#gameGrid').innerHTML = gameDeck.map((symbol, index) => `
      <button class="game-card" type="button" data-index="${index}" data-symbol="${escapeHTML(symbol)}" aria-label="第 ${index + 1} 张菜谱卡" aria-pressed="false">
        <span class="game-card-inner"><span class="game-card-face game-card-back">✦</span><span class="game-card-face game-card-front">${escapeHTML(symbol)}</span></span>
      </button>
    `).join('');
  }
  function bindGame() {
    const grid = $('#gameGrid');
    grid.addEventListener('click', (event) => {
      const card = event.target.closest('.game-card');
      if (!card || gameLocked || card.disabled || card.classList.contains('is-flipped')) return;
      card.classList.add('is-flipped');
      card.setAttribute('aria-pressed', 'true');
      gameFlipped.push(card);
      if (gameFlipped.length < 2) return;

      gameMoves += 1;
      const [first, second] = gameFlipped;
      $('#gameMoves').textContent = `${gameMoves} 步`;

      if (first.dataset.symbol === second.dataset.symbol) {
        first.classList.add('is-matched');
        second.classList.add('is-matched');
        first.disabled = true;
        second.disabled = true;
        gameMatched += 2;
        gameFlipped = [];
        $('#gamePairs').textContent = `${gameMatched / 2} / ${GAME_SYMBOLS.length} 对`;
        if (gameMatched === gameDeck.length) {
          $('#gameResult').textContent = '找到了。散落的回忆，最后还是坐回同一张桌。';
          burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
          showToast('全部配对成功。今晚的回忆都到齐了。');
        }
        return;
      }

      gameLocked = true;
      window.setTimeout(() => {
        first.classList.remove('is-flipped');
        second.classList.remove('is-flipped');
        first.setAttribute('aria-pressed', 'false');
        second.setAttribute('aria-pressed', 'false');
        gameFlipped = [];
        gameLocked = false;
      }, reducedMotion ? 40 : 720);
    });

    $('#restartGame').addEventListener('click', () => {
      createGame();
      renderGame();
    });
  }
  const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

  async function decryptVault(passphrase) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromBase64(config.vault.salt), iterations: config.vault.iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(config.vault.iv) },
      key,
      fromBase64(config.vault.ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  }

  function bindVault() {
    const form = $('#vaultForm');
    const passphrase = $('#passphrase');
    const error = $('#vaultError');
    const letter = $('#vaultLetter');
    const submit = form.querySelector('button');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!passphrase.value.trim()) return;
      error.textContent = '';
      submit.disabled = true;
      submit.innerHTML = '正在开封…';
      try {
        $('#vaultContent').textContent = await decryptVault(passphrase.value.trim());
        form.hidden = true;
        letter.hidden = false;
        window.requestAnimationFrame(() => letter.classList.add('is-open'));
        showToast('信纸打开了。');
      } catch {
        error.textContent = '暗号不对，再想想我们之间的那串数字。';
        passphrase.select();
      } finally {
        submit.disabled = false;
        submit.innerHTML = '开封 <span>↗</span>';
      }
    });

    $('#closeLetter').addEventListener('click', () => {
      letter.classList.remove('is-open');
      letter.hidden = true;
      form.hidden = false;
      passphrase.value = '';
    });
  }
  let deferredInstallPrompt = null;

  function openInstallSheet() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    $('#installCopy').textContent = isIOS
      ? '在 Safari 底部点“分享”，再选择“添加到主屏幕”。以后从桌面就能直接回到我们的餐厅。'
      : '在浏览器菜单中选择“安装应用”或“添加到主屏幕”。安装后支持离线打开。';
    openLayer($('#installLayer'), $('.install-sheet'));
  }

  function bindInstall() {
    const handleInstall = async () => {
      if (!deferredInstallPrompt) {
        openInstallSheet();
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('#installLayer').hidden = true;
    };

    $('#installApp').addEventListener('click', handleInstall);
    $('#installAppFooter').addEventListener('click', handleInstall);
    $('#installNow').addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        openInstallSheet();
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      closeLayer($('#installLayer'), $('.install-sheet'));
    });
    $('#closeInstall').addEventListener('click', () => closeLayer($('#installLayer'), $('.install-sheet')));
    $('#installBackdrop').addEventListener('click', () => closeLayer($('#installLayer'), $('.install-sheet')));

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $('#installApp').classList.add('is-ready');
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showToast('OURS 已经放进手机了。');
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI)).catch(() => {});
    });
  }
  function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!$('#dishEditorLayer').hidden) closeDishEditor();
      else if (!$('#dishLayer').hidden) closeDish();
      else if (!$('#memoryLayer').hidden) closeMemory();
      else if (!$('#orderLayer').hidden) closeOrder();
      else if (!$('#installLayer').hidden) closeLayer($('#installLayer'), $('.install-sheet'));
      else if (document.body.classList.contains('menu-open')) $('#menuToggle').click();
    });
  }

  function init() {
    document.title = `OURS — 给${config.herName}`;
    updateDates();
    updateClock();
    renderMemories();
    wishes = loadWishes();
    renderWishes();
    renderDishes();
    renderCart();
    createGame();
    renderGame();
    bindNavigation();
    bindMenu();
    bindDishEditor();
    bindOrder();
    bindMemories();
    bindWishes();
    bindHeart();
    bindGame();
    bindVault();
    bindInstall();
    bindKeyboard();
    initPageMotion();
    initPointerEffects();
    registerServiceWorker();
    $('#soundToggle').addEventListener('click', toggleSound);
    window.setInterval(updateDates, 60000);
    window.setInterval(updateClock, 30000);
    window.OURS_APP = {
      getAllDishes,
      getCart: () => ({ ...cart }),
      showToast,
      renderDishes,
      openDish,
      saveCart,
    };
    document.dispatchEvent(new CustomEvent('ours:ready'));
    window.addEventListener('load', () => document.body.classList.add('is-loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
