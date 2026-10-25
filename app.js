(() => {
  const config = window.OURS_CONFIG;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));

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

  const dayDiff = (a, b) => Math.floor((a.getTime() - b.getTime()) / 86400000);

  function updateTime() {
    const today = startOfToday();
    const start = parseLocalDate(config.relationshipStart);
    const days = Math.max(1, dayDiff(today, start) + 1);
    document.querySelector('#daysNumber').textContent = String(days);
    document.querySelector('#togetherDays').textContent = `DAY ${days}`;
    document.querySelector('#startDateLabel').textContent = formatDate(start);
    document.querySelector('#todayLabel').textContent = formatDate(today);

    const now = new Date();
    let birthday = new Date(now.getFullYear(), config.birthday.month - 1, config.birthday.day);
    if (birthday < today) birthday = new Date(now.getFullYear() + 1, config.birthday.month - 1, config.birthday.day);
    document.querySelector('#birthdayDays').textContent = String(Math.max(0, dayDiff(birthday, today)));
    document.querySelector('#birthdayDateLabel').textContent = `${formatDate(birthday)} · 生日倒计时`;
  }  function renderMemories() {
    document.querySelector('#memoryGrid').innerHTML = config.memories.map((memory) => `
      <article class="memory-card">
        <img src="${escapeHTML(memory.src)}" alt="${escapeHTML(memory.title)}" loading="lazy" />
        <div class="memory-content">
          <p>${escapeHTML(memory.date)} / ${escapeHTML(memory.location)}</p>
          <h3>${escapeHTML(memory.title)}</h3>
          <span>${escapeHTML(memory.text)}</span>
        </div>
      </article>
    `).join('');
  }

  const WISH_KEY = 'ours-public-wishes-v1';
  let wishes = [];

  function loadWishes() {
    try {
      const saved = JSON.parse(localStorage.getItem(WISH_KEY));
      if (Array.isArray(saved)) {
        return saved.filter((wish) => wish && wish.id && wish.title).map((wish) => ({
          id: String(wish.id), title: String(wish.title), done: Boolean(wish.done),
        }));
      }
    } catch {}
    return config.wishes.map((wish) => ({ ...wish, done: false }));
  }

  function saveWishes() {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(wishes)); } catch {}
  }

  function renderWishes() {
    const list = document.querySelector('#wishList');
    const completed = wishes.filter((wish) => wish.done).length;
    document.querySelector('#wishProgress').textContent = `${completed} / ${wishes.length}`;
    document.querySelector('#wishBar').style.width = `${wishes.length ? (completed / wishes.length) * 100 : 0}%`;
    list.innerHTML = wishes.map((wish) => `
      <div class="wish-item ${wish.done ? 'is-done' : ''}" data-id="${escapeHTML(wish.id)}">
        <button type="button" aria-label="${wish.done ? '标记为未完成' : '标记为已完成'}">✓</button>
        <span>${escapeHTML(wish.title)}</span>
        <small>${wish.done ? '已点亮' : '等待一起完成'}</small>
      </div>
    `).join('');
  }  function bindWishlist() {
    document.querySelector('#wishList').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const item = button.closest('.wish-item');
      const wish = wishes.find((entry) => entry.id === item.dataset.id);
      if (!wish) return;
      wish.done = !wish.done;
      saveWishes();
      renderWishes();
    });

    document.querySelector('#wishForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.querySelector('#wishInput');
      const title = input.value.trim();
      if (!title) return;
      wishes.push({ id: `wish-${Date.now()}`, title, done: false });
      input.value = '';
      saveWishes();
      renderWishes();
      input.focus();
    });
  }

  const HEART_KEY = 'ours-public-heart-v1';

  function bindHeart() {
    const button = document.querySelector('#heartButton');
    const count = document.querySelector('#heartCount');
    let value = 0;
    try { value = Number(localStorage.getItem(HEART_KEY) || 0) || 0; } catch {}
    count.textContent = String(value);
    button.addEventListener('click', () => {
      value += 1;
      count.textContent = String(value);
      button.classList.remove('is-pulsing');
      void button.offsetWidth;
      button.classList.add('is-pulsing');
      try { localStorage.setItem(HEART_KEY, String(value)); } catch {}
    });
  }  const GAME_ICONS = config.gamePairs.map((pair) => pair.symbol);
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
    gameDeck = shuffle([...GAME_ICONS, ...GAME_ICONS]);
    gameFlipped = [];
    gameMatched = 0;
    gameMoves = 0;
    gameLocked = false;
  }

  function renderGame() {
    document.querySelector('#gameMoves').textContent = `${gameMoves} 步`;
    document.querySelector('#gamePairs').textContent = `${gameMatched / 2} / ${GAME_ICONS.length} 对`;
    document.querySelector('#gameResult').textContent = gameMatched === gameDeck.length && gameDeck.length
      ? `全部找到了。你看，散落的回忆最后还是会回到一起。`
      : '';
    document.querySelector('#gameGrid').innerHTML = gameDeck.map((symbol, index) => `
      <button class="game-card" type="button" data-index="${index}" data-symbol="${escapeHTML(symbol)}" aria-label="第 ${index + 1} 张回忆卡">
        <span class="game-card-inner">
          <span class="game-card-face game-card-back" aria-hidden="true">✦</span>
          <span class="game-card-face game-card-front" aria-hidden="true">${escapeHTML(symbol)}</span>
        </span>
      </button>
    `).join('');
  }  function bindGame() {
    const grid = document.querySelector('#gameGrid');
    const restart = document.querySelector('#restartGame');

    grid.addEventListener('click', (event) => {
      const card = event.target.closest('.game-card');
      if (!card || gameLocked || card.disabled || card.classList.contains('is-flipped')) return;

      card.classList.add('is-flipped');
      card.setAttribute('aria-pressed', 'true');
      gameFlipped.push(card);

      if (gameFlipped.length < 2) return;

      gameMoves += 1;
      const [first, second] = gameFlipped;
      document.querySelector('#gameMoves').textContent = `${gameMoves} 步`;

      if (first.dataset.symbol === second.dataset.symbol) {
        first.classList.add('is-matched');
        second.classList.add('is-matched');
        first.disabled = true;
        second.disabled = true;
        gameMatched += 2;
        gameFlipped = [];
        document.querySelector('#gamePairs').textContent = `${gameMatched / 2} / ${GAME_ICONS.length} 对`;
        if (gameMatched === gameDeck.length) renderGame();
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
      }, reducedMotion ? 50 : 720);
    });

    restart.addEventListener('click', () => {
      createGame();
      renderGame();
    });
  }  const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

  async function decryptVault(passphrase) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
    );
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
    const form = document.querySelector('#vaultForm');
    const passphrase = document.querySelector('#passphrase');
    const error = document.querySelector('#vaultError');
    const letter = document.querySelector('#vaultLetter');
    const content = document.querySelector('#vaultContent');
    const submit = form.querySelector('button');
    document.querySelector('.vault-form small').textContent = config.vault.hint;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!passphrase.value.trim()) return;
      error.textContent = '';
      submit.disabled = true;
      submit.textContent = '正在打开…';
      try {
        content.textContent = await decryptVault(passphrase.value.trim());
        form.hidden = true;
        letter.hidden = false;
        letter.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      } catch {
        error.textContent = '暗号不对，再想想我们之间的那串数字。';
        passphrase.select();
      } finally {
        submit.disabled = false;
        submit.textContent = '打开';
      }
    });
  }  function createStarfield() {
    const canvas = document.querySelector('#starfield');
    const context = canvas.getContext('2d');
    if (!context) return;
    let stars = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(180, Math.max(70, Math.round((width * height) / 9000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.25 + 0.25,
        alpha: Math.random() * 0.55 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.45 + 0.12,
      }));
      draw(0);
    };

    const draw = (timestamp) => {
      context.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        const twinkle = reducedMotion ? 1 : 0.68 + Math.sin(timestamp * 0.001 * star.speed + star.phase) * 0.32;
        const drift = reducedMotion ? 0 : Math.sin(timestamp * 0.00008 + star.phase) * 2;
        context.beginPath();
        context.fillStyle = `rgba(249, 243, 250, ${star.alpha * twinkle})`;
        context.arc(star.x + drift, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      });
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    window.addEventListener('resize', () => {
      window.cancelAnimationFrame(animationFrame);
      resize();
    }, { passive: true });

    resize();
  }  function init() {
    document.title = `OURS — 给${config.herName}`;
    updateTime();
    renderMemories();
    wishes = loadWishes();
    renderWishes();
    bindWishlist();
    bindHeart();
    createGame();
    renderGame();
    bindGame();
    bindVault();
    createStarfield();
    window.setInterval(updateTime, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();