// Christbahnl-Geschenkezug: a small hidden Christmas game.
// Opens when "christbahnl" is typed into the Extra field (see index.html).
// Steer the train with your finger, the mouse or the arrow keys.
// Catch presents, Lebkuchen and stars; every lump of coal costs a heart.

(function () {
  const ITEMS = [
    { emoji: '🎁', points: 1, weight: 60 },
    { emoji: '🍪', points: 2, weight: 22 },
    { emoji: '⭐', points: 5, weight: 6 },
    { emoji: '🪨', points: 0, weight: 18, bad: true },
  ];
  const TOTAL_WEIGHT = ITEMS.reduce((sum, item) => sum + item.weight, 0);
  const HIGHSCORE_KEY = 'christbahnl-highscore';
  const LIVES = 3;

  let overlay, canvas, ctx;
  let W = 0, H = 0, size = 48;
  let running = false, rafId = 0, lastTime = 0;
  let state = 'start';            // 'start' | 'play' | 'over'
  let player = { x: 0, y: 0, targetX: 0 };
  let items = [], popups = [], flakes = [];
  let score = 0, lives = LIVES, elapsed = 0, spawnTimer = 0, flash = 0, overDelay = 0;
  let highscore = 0;
  const keys = {};

  function loadHighscore() {
    try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; } catch (e) { return 0; }
  }

  function saveHighscore(value) {
    try { localStorage.setItem(HIGHSCORE_KEY, String(value)); } catch (e) { /* not available */ }
  }

  function build() {
    overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2000;background:linear-gradient(#0b1d3a,#3d5f7a);';

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';

    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Spiel schließen');
    close.style.cssText =
      'position:absolute;top:10px;right:10px;width:44px;height:44px;font-size:22px;border:none;' +
      'border-radius:22px;background:rgba(255,255,255,0.25);color:#fff;cursor:pointer;';
    close.addEventListener('click', stop);

    overlay.append(canvas, close);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');

    canvas.addEventListener('pointerdown', event => {
      if (state === 'start' || (state === 'over' && overDelay <= 0)) startRound();
      steer(event);
    });
    canvas.addEventListener('pointermove', steer);

    window.addEventListener('keydown', event => {
      if (!running) return;
      if (['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) event.preventDefault();
      if (event.key === 'Escape') return stop();
      if ((event.key === ' ' || event.key === 'Enter') && state !== 'play' && overDelay <= 0) startRound();
      keys[event.key] = true;
    });
    window.addEventListener('keyup', event => { keys[event.key] = false; });
    window.addEventListener('resize', () => { if (running) resize(); });
  }

  function steer(event) {
    if (state !== 'play') return;
    const rect = canvas.getBoundingClientRect();
    player.targetX = event.clientX - rect.left;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = Math.max(32, Math.min(64, Math.min(W, H) * 0.09));
    player.y = H - size * 1.1;
    player.x = Math.min(Math.max(player.x || W / 2, size / 2), W - size / 2);
    player.targetX = player.x;

    const count = Math.min(140, Math.round((W * H) / 7000));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 2.5,
      vy: 15 + Math.random() * 35,
      drift: Math.random() * Math.PI * 2,
    }));
  }

  function startRound() {
    state = 'play';
    score = 0;
    lives = LIVES;
    elapsed = 0;
    spawnTimer = 0.5;
    flash = 0;
    items = [];
    popups = [];
    player.x = player.targetX = W / 2;
  }

  function endRound() {
    state = 'over';
    overDelay = 0.8; // avoids starting a new round by accident while still steering
    if (score > highscore) {
      highscore = score;
      saveHighscore(highscore);
    }
  }

  function spawnItem() {
    let pick = Math.random() * TOTAL_WEIGHT;
    const type = ITEMS.find(item => (pick -= item.weight) < 0) || ITEMS[0];
    const speed = H * (0.28 + elapsed * 0.006);
    items.push({
      ...type,
      x: size / 2 + Math.random() * (W - size),
      y: -size,
      vy: speed * (0.85 + Math.random() * 0.3),
    });
  }

  function update(dt) {
    flakes.forEach(flake => {
      flake.drift += dt;
      flake.y += flake.vy * dt;
      flake.x += Math.sin(flake.drift) * 10 * dt;
      if (flake.y > H) { flake.y = -5; flake.x = Math.random() * W; }
    });

    if (overDelay > 0) overDelay -= dt;
    if (flash > 0) flash -= dt;
    popups = popups.filter(popup => {
      popup.y -= 50 * dt;
      popup.life -= dt;
      return popup.life > 0;
    });
    if (state !== 'play') return;

    elapsed += dt;
    if (keys.ArrowLeft) player.targetX -= W * 1.2 * dt;
    if (keys.ArrowRight) player.targetX += W * 1.2 * dt;
    player.targetX = Math.min(Math.max(player.targetX, size / 2), W - size / 2);
    player.x += (player.targetX - player.x) * Math.min(1, dt * 15);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = Math.max(0.3, 0.9 - elapsed * 0.012);
    }

    items = items.filter(item => {
      item.y += item.vy * dt;
      const caught = Math.abs(item.x - player.x) < size * 0.8 && Math.abs(item.y - player.y) < size * 0.7;
      if (caught) {
        if (item.bad) {
          lives--;
          flash = 0.3;
          popups.push({ text: '−❤️', x: item.x, y: item.y, life: 0.8 });
          if (lives <= 0) endRound();
        } else {
          score += item.points;
          popups.push({ text: `+${item.points}`, x: item.x, y: item.y, life: 0.8 });
        }
        return false;
      }
      return item.y < H + size;
    });
  }

  function centeredText(lines, top) {
    const fontSize = Math.max(16, Math.min(30, W * 0.05));
    ctx.fillStyle = 'rgba(11, 29, 58, 0.75)';
    const boxHeight = lines.length * fontSize * 1.6 + fontSize;
    ctx.fillRect(W * 0.08, top - fontSize, W * 0.84, boxHeight);
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 'bold ' : ''}${fontSize}px Arial, sans-serif`;
      ctx.fillText(line, W / 2, top + i * fontSize * 1.6);
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    flakes.forEach(flake => {
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Snowy ground
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, H - size * 0.45, W, size * 0.45);

    ctx.font = `${size}px sans-serif`;
    items.forEach(item => ctx.fillText(item.emoji, item.x, item.y));
    ctx.fillText('🚂', player.x, player.y);

    ctx.font = `bold ${size * 0.5}px Arial, sans-serif`;
    popups.forEach(popup => {
      ctx.globalAlpha = Math.max(0, popup.life / 0.8);
      ctx.fillStyle = popup.text.startsWith('+') ? '#ffd54a' : '#ff6b6b';
      ctx.fillText(popup.text, popup.x, popup.y);
    });
    ctx.globalAlpha = 1;

    // Score, hearts and record in the top left (the close button is top right)
    const hud = Math.max(16, Math.min(26, W * 0.045));
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${hud}px Arial, sans-serif`;
    ctx.fillText(`Punkte: ${score}`, 14, 30);
    ctx.font = `${hud * 0.8}px Arial, sans-serif`;
    ctx.fillText(`Rekord: ${highscore}`, 14, 30 + hud * 1.3);
    ctx.font = `${hud}px sans-serif`;
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), 14, 30 + hud * 2.6);
    ctx.textAlign = 'center';

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === 'start') {
      centeredText([
        'Christbahnl-Geschenkezug',
        'Fang 🎁 +1  🍪 +2  ⭐ +5',
        'Weich der Kohle 🪨 aus!',
        'Tippen zum Starten',
      ], H * 0.32);
    } else if (state === 'over') {
      centeredText([
        'Endstation! 🎄',
        `Punkte: ${score}`,
        `Rekord: ${highscore}`,
        'Tippen für eine neue Fahrt',
      ], H * 0.32);
    }
  }

  function loop(time) {
    if (!running) return;
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    if (!overlay) build();
    if (document.activeElement) document.activeElement.blur();
    overlay.style.display = 'block';
    highscore = loadHighscore();
    state = 'start';
    lives = LIVES;
    score = 0;
    items = [];
    popups = [];
    resize();
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    overlay.style.display = 'none';
    Object.keys(keys).forEach(key => { keys[key] = false; });
  }

  window.startChristmasGame = start;
})();
