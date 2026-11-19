// Fake "System gehackt" prank, opened by typing "Zirbenschnaps" into the Extra field.
// It only shows text on the screen: the order, prices and everything else stay untouched.
// An ASCII Santa walks across the top of the terminal. At the end it reveals the joke.
// Esc closes it at any time.

(function () {
  const CSS = `
    .hack-overlay {
      position: fixed; inset: 0; z-index: 3000; overflow: hidden;
      background: #000; color: #33ff66;
      font-family: "Courier New", Courier, monospace;
      font-size: clamp(13px, 2.4vw, 18px);
    }
    .hack-overlay.hack-red { background: #1a0000; }
    .hack-overlay.hack-flash { background: #fff; }
    .hack-log {
      position: absolute; inset: 16px; top: calc(16px + 15em);
      display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
    }
    .hack-santa {
      position: absolute; top: 16px; left: 0; margin: 0;
      font: inherit; line-height: 1.1; white-space: pre;
      text-shadow: 0 0 6px #33ff66;
      animation: hack-walk 14s linear infinite;
    }
    .hack-red .hack-santa { color: #ff4d4d; text-shadow: 0 0 6px #ff0000; }
    .hack-flash .hack-santa { display: none; }
    @keyframes hack-walk {
      from { transform: translateX(-100%); }
      to { transform: translateX(100vw); }
    }
    .hack-line { margin: 2px 0; white-space: pre-wrap; word-break: break-all; text-shadow: 0 0 6px #33ff66; }
    .hack-line.hack-dim { opacity: 0.55; }
    .hack-cursor::after { content: "█"; animation: hack-blink 1s steps(1) infinite; }
    @keyframes hack-blink { 50% { opacity: 0; } }
    .hack-warning {
      position: absolute; left: 0; right: 0; top: 34%; padding: 0.4em 0;
      background: #0d0000; border-top: 2px solid #ff2a2a; border-bottom: 2px solid #ff2a2a;
      text-align: center; color: #ff2a2a; font-weight: bold;
      font-size: clamp(28px, 8vw, 72px); text-shadow: 0 0 14px #ff0000;
      animation: hack-flicker 0.25s infinite;
    }
    .hack-warning small { display: block; font-size: 0.4em; margin-top: 0.4em; }
    @keyframes hack-flicker {
      0%, 100% { opacity: 1; transform: translate(0, 0); }
      25% { opacity: 0.7; transform: translate(-4px, 2px); }
      50% { opacity: 1; transform: translate(4px, -2px); }
      75% { opacity: 0.8; transform: translate(-2px, -1px); }
    }
    .hack-shake { animation: hack-shake 0.2s infinite; }
    @keyframes hack-shake {
      0%, 100% { transform: translate(0, 0); }
      33% { transform: translate(-3px, 2px); }
      66% { transform: translate(3px, -2px); }
    }
    .hack-reveal {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(#0d2a4a, #5f7b8c); color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .hack-reveal-box {
      max-width: 88%; padding: 24px; text-align: center;
      background: #0d2a4a; border: 2px solid #f39a2b; border-radius: 14px;
    }
    .hack-reveal-box h2 { margin: 0 0 12px; color: #f39a2b; font-size: 34px; }
    .hack-reveal-box p { margin: 6px 0; font-size: 18px; }
    /* Laughing Nikolaus peeking up from the bottom, drawn as inline SVG (no image files needed) */
    .hack-nikolaus {
      position: absolute; bottom: -4px; left: 50%; width: min(85vw, 440px, 45vh);
      transform-origin: 50% 100%;
      animation: hack-rise 0.9s ease-out both, hack-laugh 1.4s ease-in-out 0.9s infinite;
    }
    @keyframes hack-rise {
      from { transform: translate(-50%, 100%); }
      to { transform: translate(-50%, 0); }
    }
    @keyframes hack-laugh {
      0%, 100% { transform: translate(-50%, 0) rotate(-3deg); }
      50% { transform: translate(-50%, -6px) rotate(3deg); }
    }
    .hack-hohoho {
      position: absolute; top: 6%; left: 0; right: 0; text-align: center;
      font-size: clamp(28px, 8vw, 48px); font-weight: 800; color: #f39a2b;
      animation: hack-laugh-text 1.4s ease-in-out infinite;
    }
    @keyframes hack-laugh-text {
      0%, 100% { transform: rotate(-2deg) scale(1); }
      50% { transform: rotate(2deg) scale(1.06); }
    }
    .hack-reveal-box { position: relative; z-index: 1; }
    /* Landscape tablets: move the box up so it doesn't cover the Nikolaus */
    @media (orientation: landscape) {
      .hack-reveal { align-items: flex-start; padding-top: 13vh; box-sizing: border-box; }
      .hack-hohoho { top: 2vh; }
    }
    .hack-reveal-box button {
      margin-top: 18px; padding: 12px 22px; font-size: 18px; font-weight: 700;
      color: #0d2a4a; background: #f39a2b; border: none; border-radius: 8px; cursor: pointer;
    }
  `;

  // ASCII Santa: the body stays the same, the legs and the "Ho Ho Ho!" change while walking
  const SANTA_BODY = [
    '       ___',
    '     /    `\\.o',
    '    /_______\\',
    '   {_________}',
    '    ( o   o )',
    '    (   >   )',
    '   ((~~~~~~~))',
    '    ((~~~~~))',
    '   /|  [=]  |\\',
    '    |_______|',
  ];
  const SANTA_LEGS = [
    ['    /   \\', '  _/     \\_'],
    ['     | |', '    _| |_'],
  ];

  let overlay, log, santa, santaTimer = 0, styleAdded = false, running = false, timers = [];

  function startSanta() {
    santa = document.createElement('pre');
    santa.className = 'hack-santa';
    overlay.appendChild(santa);
    let tick = 0;
    const draw = () => {
      const speech = tick % 16 < 6 ? '   Ho Ho Ho!' : ' ';
      santa.textContent = [speech, ...SANTA_BODY, ...SANTA_LEGS[tick % 2]].join('\n');
      tick++;
    };
    draw();
    santaTimer = setInterval(draw, 350);
  }

  function sleep(ms) {
    return new Promise(resolve => timers.push(setTimeout(resolve, ms)));
  }

  function addStyle() {
    if (styleAdded) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    styleAdded = true;
  }

  function newLine(className) {
    const line = document.createElement('div');
    line.className = 'hack-line' + (className ? ' ' + className : '');
    log.appendChild(line);
    return line;
  }

  async function type(text, speed = 26) {
    const line = newLine('hack-cursor');
    line.textContent = '> ';
    for (const char of text) {
      if (!running) return;
      line.textContent += char;
      await sleep(speed);
    }
    line.classList.remove('hack-cursor');
    await sleep(450);
  }

  // stepMs: how long each tenth of the bar takes (bigger = slower)
  // jitter: random extra time per step (0 = exact timing)
  async function progress(text, stepMs = 110, jitter = 1.2) {
    const line = newLine();
    for (let step = 0; step <= 10; step++) {
      if (!running) return;
      const percent = String(step * 10).padStart(3, ' ');
      line.textContent = `> ${text} [${'#'.repeat(step)}${'.'.repeat(10 - step)}] ${percent}%`;
      await sleep(stepMs + Math.random() * stepMs * jitter);
    }
    if (jitter > 0) await sleep(400);
  }

  async function hexDump(rows) {
    for (let i = 0; i < rows; i++) {
      if (!running) return;
      const address = (0x7f3a00 + i * 16).toString(16);
      const bytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
      newLine('hack-dim').textContent = `  0x${address}  ${bytes.join(' ')}`;
      await sleep(60);
    }
  }

  async function play() {
    // Made-up numbers that look real: a till balance and a game record
    let record = 0;
    try { record = Number(localStorage.getItem('christbahnl-highscore')) || 0; } catch (e) { /* not available */ }
    if (record === 0) record = 120 + Math.floor(Math.random() * 380);
    const euros = 1800 + Math.floor(Math.random() * 3200) + [0, 0.5, 0.2, 0.7][Math.floor(Math.random() * 4)];
    const total = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(euros);

    await type('Verbindung zu kasse.christbahnl wird aufgebaut ...');
    await type('Firewall umgangen ................ OK');
    await type('Root-Zugriff erhalten ............ OK');
    await hexDump(14);
    await type(`Kassenbestand gefunden: ${total}`);
    await type(`Rekord im Geschenkezug ausgelesen: ${record} Punkte`);
    await progress('Kopiere Rezept Glühwein');
    await progress('Kopiere Rezept Strudel ');
    await type('Passwörter gefunden: 23');
    await progress('Sende an Weihnachtsmann');
    await type('Empfänger: Nordpol ............ OK 🎅');
    await type('Setze alle Preise auf 0,00 € ...');
    await type('Bestelle 500 Liter Glühwein auf Rechnung ...');
    await type('Lösche Lebkuchen-Vorrat ...');
    await type('Lösche Fotos ...');
    await type('Lösche Kontakte ...');
    // The phone wipe bar takes exactly 8 seconds to fill from 0 to 100 %
    await progress('Handy wird gelöscht', 800, 0);
    await type('Handy gelöscht. Alle Daten entfernt.');
    await sleep(1500);
    if (!running) return;

    // "SYSTEM GEHACKT" stays at least 30 seconds: 27 s of changing messages, then a 3 s countdown
    overlay.classList.add('hack-red', 'hack-shake');
    const warning = document.createElement('div');
    warning.className = 'hack-warning';
    overlay.appendChild(warning);
    const messages = [
      'Alle Daten gehören jetzt dem Weihnachtsmann 🎅',
      'Kasse gesperrt',
      'Bitte Gerät NICHT ausschalten!',
      'Verbinde mit Nordpol-Support ...',
      'Lösegeld: 3 Glühwein und 1 Apfelstrudel',
      'Rentiere übernehmen die Kontrolle 🦌',
      'Wichtel kopieren deine Daten ...',
      'Warte auf Zahlung ...',
      'Kasse wird verschlüsselt ...',
    ];
    for (const message of messages) {
      if (!running) return;
      warning.innerHTML = `⚠ SYSTEM GEHACKT ⚠<small>${message}</small>`;
      await sleep(3000);
    }

    for (const n of [3, 2, 1]) {
      if (!running) return;
      warning.innerHTML = `⚠ SYSTEM GEHACKT ⚠<small>Selbstzerstörung in ${n} ...</small>`;
      await sleep(1000);
    }
    if (!running) return;

    overlay.classList.remove('hack-red', 'hack-shake');
    overlay.classList.add('hack-flash');
    warning.remove();
    log.innerHTML = '';
    await sleep(250);
    if (!running) return;

    overlay.classList.remove('hack-flash');
    reveal();
  }

  // A laughing Nikolaus with closed happy eyes, peeking up from the bottom of the screen
  const NIKOLAUS_SVG = `
    <svg class="hack-nikolaus" viewBox="0 0 200 200" aria-hidden="true">
      <path d="M8 200 Q16 158 60 160 L140 160 Q184 158 192 200 Z" fill="#c8102e"/>
      <path d="M92 160 L108 160 L108 200 L92 200 Z" fill="#fff"/>
      <path d="M42 82 Q60 18 128 20 Q168 22 176 58 L162 64 Q150 44 128 46 Q148 62 158 82 Z" fill="#d0202e"/>
      <circle cx="171" cy="66" r="13" fill="#fff"/>
      <circle cx="100" cy="110" r="48" fill="#f6c9a8"/>
      <rect x="36" y="72" width="128" height="24" rx="12" fill="#fff"/>
      <path d="M70 106 Q79 96 88 106" stroke="#3a2a20" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M112 106 Q121 96 130 106" stroke="#3a2a20" stroke-width="4" stroke-linecap="round" fill="none"/>
      <circle cx="68" cy="122" r="9" fill="#f08a8a" opacity="0.7"/>
      <circle cx="132" cy="122" r="9" fill="#f08a8a" opacity="0.7"/>
      <path d="M50 118 Q46 178 100 198 Q154 178 150 118 Q140 136 125 129 Q112 141 100 133 Q88 141 75 129 Q60 136 50 118 Z" fill="#fff"/>
      <path d="M82 140 Q100 166 118 140 Z" fill="#8b1e1e"/>
      <path d="M90 147 Q100 156 110 147 Q100 151 90 147 Z" fill="#e86a6a"/>
      <path d="M100 129 Q85 117 68 129 Q78 142 100 135 Q122 142 132 129 Q115 117 100 129 Z" fill="#fff" stroke="#e5e5e5" stroke-width="1"/>
      <ellipse cx="100" cy="121" rx="9" ry="7" fill="#e8957a"/>
    </svg>`;

  function reveal() {
    const screen = document.createElement('div');
    screen.className = 'hack-reveal';
    screen.innerHTML = `
      <div class="hack-hohoho">Ho Ho Ho!</div>
      ${NIKOLAUS_SVG}
      <div class="hack-reveal-box">
        <h2>Eini gfolln! 🎄</h2>
        <p>Bisch drschrockn, gell? 😄</p>
        <p>Wor lai spass, passiert isch nix!</p>
        <p>Kuan Passwort isch weg,</p>
        <p>und dei Handy isch a nou gonz.</p>
        <p>Iatz trink an Glühwein af'n Schreck!</p>
        <p>Frohe Weihnachtn!</p>
        <button type="button">Zrugg zur Kassa</button>
      </div>`;
    screen.querySelector('button').addEventListener('click', stop);
    overlay.appendChild(screen);
  }

  function onKey(event) {
    if (event.key === 'Escape') stop();
  }

  function start() {
    if (running) return;
    addStyle();
    if (document.activeElement) document.activeElement.blur();
    overlay = document.createElement('div');
    overlay.className = 'hack-overlay';
    log = document.createElement('div');
    log.className = 'hack-log';
    overlay.appendChild(log);
    document.body.appendChild(overlay);
    startSanta();
    window.addEventListener('keydown', onKey);
    running = true;
    play();
  }

  function stop() {
    running = false;
    timers.forEach(clearTimeout);
    timers = [];
    clearInterval(santaTimer);
    window.removeEventListener('keydown', onKey);
    if (overlay) overlay.remove();
    overlay = null;
  }

  window.startHackPrank = start;
})();
