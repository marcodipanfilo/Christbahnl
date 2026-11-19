// Rittner Christbahnl: a small hidden Christmas game.
// Opens when "christbahnl" is typed into the Extra field (see index.html).
// Steer the gingerbread tram with your finger, the mouse or the arrow keys.
// Catch Christbahnl mugs, Lebkuchen hearts and stars; every lump of coal costs a heart.
// Everything is drawn in code, so the game needs no images and works offline.

(function () {
  // Colours from the printed Christbahnl menu and mugs
  const C = {
    navy: '#0d2a4a',
    blue: '#5f7b8c',
    orange: '#f39a2b',
    icing: '#ffffff',
    gingerbread: '#c27c3e',
    gingerbreadDark: '#9a5b28',
    almond: '#f3dcb5',
    candy: '#8b1e1e',
    ribbon: '#d0202e',
    mugs: ['#c8102e', '#f39a2b', '#1b1b1b'],
  };

  const ITEMS = [
    { kind: 'mug', points: 1, weight: 58 },
    { kind: 'heart', points: 2, weight: 22 },
    { kind: 'star', points: 5, weight: 6 },
    { kind: 'coal', points: 0, weight: 18, bad: true },
  ];
  const TOTAL_WEIGHT = ITEMS.reduce((sum, item) => sum + item.weight, 0);
  const HIGHSCORE_KEY = 'christbahnl-highscore';
  const LIVES = 3;

  // Mountain silhouette (x 0..1 across, y 0..1 up), loosely like the Schlern seen from the Ritten
  const MOUNTAINS = [
    [0, 0.35], [0.08, 0.5], [0.15, 0.42], [0.22, 0.62], [0.27, 0.55], [0.3, 0.95], [0.33, 0.7],
    [0.36, 0.8], [0.58, 0.82], [0.62, 0.72], [0.7, 0.6], [0.78, 0.68], [0.86, 0.45], [0.93, 0.55], [1, 0.4],
  ];

  let overlay, canvas, ctx;
  let W = 0, H = 0, size = 48, groundY = 0;
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

  // ---------- Drawing helpers (unit coordinates, scaled by the caller) ----------

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function starPath(outer, inner) {
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = k % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (k * Math.PI) / 8;
      ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function withTransform(x, y, scale, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    draw();
    ctx.restore();
  }

  // The player: the Rittner tram as a gingerbread biscuit (like the one on the menu)
  function drawTram(x, y) {
    withTransform(x, y, size * 0.6, () => {
      ctx.lineJoin = 'round';

      // Red ribbon loop on top
      ctx.strokeStyle = C.ribbon;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.ellipse(0, -1.38, 0.16, 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Biscuit body with icing outline
      ctx.beginPath();
      ctx.moveTo(-1, 0.95);
      ctx.lineTo(-1, -0.5);
      ctx.quadraticCurveTo(-1, -1.15, 0, -1.18);
      ctx.quadraticCurveTo(1, -1.15, 1, -0.5);
      ctx.lineTo(1, 0.95);
      ctx.closePath();
      ctx.fillStyle = C.gingerbread;
      ctx.fill();
      ctx.strokeStyle = C.icing;
      ctx.lineWidth = 0.09;
      ctx.stroke();

      // Three windows with almonds
      [-0.6, 0, 0.6].forEach(cx => {
        roundedRect(cx - 0.22, -0.82, 0.44, 0.72, 0.2);
        ctx.fillStyle = C.almond;
        ctx.fill();
        ctx.strokeStyle = C.icing;
        ctx.lineWidth = 0.07;
        ctx.stroke();
      });

      // Icing line under the windows
      ctx.beginPath();
      ctx.moveTo(-0.92, 0.02);
      ctx.lineTo(0.92, 0.02);
      ctx.stroke();

      // Grille on both sides
      ctx.lineWidth = 0.06;
      [-0.78, -0.64, -0.5, 0.5, 0.64, 0.78].forEach(gx => {
        ctx.beginPath();
        ctx.moveTo(gx, 0.18);
        ctx.lineTo(gx, 0.78);
        ctx.stroke();
      });

      // Candy in the middle
      ctx.beginPath();
      ctx.arc(0, 0.45, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = C.candy;
      ctx.fill();
      ctx.stroke();

      // Wheels
      ctx.fillStyle = C.gingerbreadDark;
      roundedRect(-0.75, 0.92, 0.32, 0.25, 0.08);
      ctx.fill();
      roundedRect(0.43, 0.92, 0.32, 0.25, 0.08);
      ctx.fill();
    });
  }

  // A Christbahnl mug in red, orange or black
  function drawMug(x, y, color) {
    withTransform(x, y, size * 0.5, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.arc(0.62, 0.05, 0.32, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      roundedRect(-0.65, -0.75, 1.25, 1.55, 0.18);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 0.06;
      ctx.stroke();

      // Steam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 0.08;
      [-0.3, 0.2].forEach(sx => {
        ctx.beginPath();
        ctx.moveTo(sx, -0.9);
        ctx.quadraticCurveTo(sx - 0.15, -1.1, sx, -1.3);
        ctx.stroke();
      });

      // Star on the mug
      ctx.save();
      ctx.translate(-0.03, 0.02);
      starPath(0.38, 0.16);
      ctx.fillStyle = color === C.orange ? C.icing : C.orange;
      ctx.fill();
      ctx.restore();
    });
  }

  // Lebkuchen heart with icing
  function drawHeart(x, y) {
    withTransform(x, y, size * 0.5, () => {
      ctx.beginPath();
      ctx.moveTo(0, 0.85);
      ctx.bezierCurveTo(-1.2, 0, -0.95, -1, 0, -0.4);
      ctx.bezierCurveTo(0.95, -1, 1.2, 0, 0, 0.85);
      ctx.closePath();
      ctx.fillStyle = C.gingerbread;
      ctx.fill();
      ctx.strokeStyle = C.icing;
      ctx.lineWidth = 0.09;
      ctx.stroke();
      ctx.fillStyle = C.icing;
      [[-0.35, -0.2], [0.35, -0.2], [0, 0.25]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  // Orange eight-pointed star like on the menu
  function drawStar(x, y) {
    withTransform(x, y, size * 0.55, () => {
      starPath(1, 0.42);
      ctx.fillStyle = C.orange;
      ctx.fill();
    });
  }

  function drawCoal(x, y) {
    withTransform(x, y, size * 0.45, () => {
      ctx.beginPath();
      [[-0.9, 0.2], [-0.6, -0.6], [0.1, -0.85], [0.8, -0.45], [0.95, 0.3], [0.4, 0.8], [-0.5, 0.75]]
        .forEach(([px, py], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](px, py));
      ctx.closePath();
      ctx.fillStyle = '#262626';
      ctx.fill();
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 0.1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(-0.2, -0.3, 0.18, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawItem(item) {
    if (item.kind === 'mug') drawMug(item.x, item.y, item.color);
    else if (item.kind === 'heart') drawHeart(item.x, item.y);
    else if (item.kind === 'star') drawStar(item.x, item.y);
    else drawCoal(item.x, item.y);
  }

  function drawScenery() {
    // Mountains
    const base = groundY;
    const height = H * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, base);
    MOUNTAINS.forEach(([mx, my]) => ctx.lineTo(mx * W, base - my * height));
    ctx.lineTo(W, base);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13, 42, 74, 0.55)';
    ctx.fill();

    // Snow on the ridge
    ctx.beginPath();
    MOUNTAINS.forEach(([mx, my], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](mx * W, base - my * height));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Snowy ground with the track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(0, base, W, H - base);
    const sleeperY = base + Math.min(10, (H - base) * 0.3);
    ctx.fillStyle = '#8a6a4a';
    for (let sx = 6; sx < W; sx += 26) ctx.fillRect(sx, sleeperY - 3, 14, 6);
    ctx.fillStyle = '#55606a';
    ctx.fillRect(0, sleeperY - 1.5, W, 3);
  }

  function panel(lines, top) {
    const fontSize = Math.max(16, Math.min(28, W * 0.05));
    const lineHeight = fontSize * 1.55;
    const boxHeight = lines.length * lineHeight + fontSize;
    const boxWidth = Math.min(W * 0.86, 520);
    const left = (W - boxWidth) / 2;

    ctx.fillStyle = 'rgba(13, 42, 74, 0.9)';
    roundedRect(left, top - fontSize, boxWidth, boxHeight, 14);
    ctx.fill();
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Little stars in the top corners, like on the menu
    withTransform(left + 18, top - fontSize + 18, 9, () => { starPath(1, 0.42); ctx.fillStyle = C.orange; ctx.fill(); });
    withTransform(left + boxWidth - 18, top - fontSize + 18, 9, () => { starPath(1, 0.42); ctx.fillStyle = C.orange; ctx.fill(); });

    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? C.orange : C.icing;
      ctx.font = `${i === 0 ? '800 ' : ''}${i === 0 ? fontSize * 1.1 : fontSize}px Arial, sans-serif`;
      ctx.fillText(line, W / 2, top + i * lineHeight);
    });
  }

  // ---------- Game ----------

  function build() {
    overlay = document.createElement('div');
    overlay.style.cssText =
      `position:fixed;inset:0;z-index:2000;background:linear-gradient(${C.navy},${C.blue});`;

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
    player.y = H - size * 1.25;
    groundY = player.y + size * 0.7;
    player.x = Math.min(Math.max(player.x || W / 2, size * 0.6), W - size * 0.6);
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
      color: C.mugs[Math.floor(Math.random() * C.mugs.length)],
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
    player.targetX = Math.min(Math.max(player.targetX, size * 0.6), W - size * 0.6);
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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    drawScenery();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    flakes.forEach(flake => {
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    });

    items.forEach(drawItem);
    drawTram(player.x, player.y);

    ctx.font = `bold ${size * 0.5}px Arial, sans-serif`;
    popups.forEach(popup => {
      ctx.globalAlpha = Math.max(0, popup.life / 0.8);
      ctx.fillStyle = popup.text.startsWith('+') ? C.orange : '#ff6b6b';
      ctx.fillText(popup.text, popup.x, popup.y);
    });
    ctx.globalAlpha = 1;

    // Score, record and hearts in the top left (the close button is top right)
    const hud = Math.max(16, Math.min(26, W * 0.045));
    ctx.textAlign = 'left';
    ctx.fillStyle = C.icing;
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
      panel([
        'Rittner Christbahnl',
        'Fang Tassen (+1),',
        'Lebkuchen (+2) und Sterne (+5)!',
        'Weich der Kohle aus.',
        'Tippen zum Starten',
      ], H * 0.22);
    } else if (state === 'over') {
      panel([
        'Endstation Klobenstein!',
        `Punkte: ${score}`,
        `Rekord: ${highscore}`,
        'Tippen für eine neue Fahrt',
      ], H * 0.22);
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
