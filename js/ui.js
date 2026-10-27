(function () {
  'use strict';
  const E = LSJ.Engine;
  const $ = (id) => document.getElementById(id);
  const log = $('log');
  const cmd = $('cmd');
  const history = [];
  let hIdx = 0;
  let onTitle = true;

  function print(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    while (log.childNodes.length > 300) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function printAll(outputs) {
    for (const o of outputs) if (o.type !== 'sfx') print(o.text, o.type === 'text' ? '' : o.type);
  }

  // ------------------------------------------------------------- sound
  const A = LSJ.Audio;
  const themeFor = (dest) => LSJ.music.themes[dest] || 'title';
  const songName = () => (A.playing && LSJ.music.songs[A.playing] ? LSJ.music.songs[A.playing].name : null);

  function soundtrack(outputs) {
    for (const o of outputs) if (o.type === 'sfx') A.sfx(o.text);
    const has = (t) => outputs.some((o) => o.type === t);
    const v = E.view();
    if (v.dead) { if (has('death')) A.playMusic('death', { loop: false }); return; }
    if (v.ended) { if (has('end')) A.playMusic('fanfare', { loop: false, then: 'title' }); return; }
    if (has('intro')) A.playMusic('title', { loop: false, then: themeFor(v.dest) });
    else A.playMusic(themeFor(v.dest));
    if (has('score')) A.jingle('points');
  }

  function updateSoundButton() {
    const on = A.settings.music || A.settings.sfx;
    const b = $('snd');
    b.textContent = on ? '\u266A ON' : '\u266A OFF';
    b.classList.toggle('off', !on);
  }

  function audioCommand(input) {
    const m = /^\s*(music|sfx|sound|sounds|volume|vol)\b\s*(.*)$/i.exec(input);
    if (!m) return false;
    const what = m[1].toLowerCase();
    const arg = m[2].trim().toLowerCase();
    const on = arg === 'on' ? true : arg === 'off' ? false : null;
    if (arg && on === null && !what.startsWith('vol')) return false;
    print('> ' + input.toUpperCase(), 'echo');
    A.unlock();
    if (what.startsWith('vol')) {
      const n = parseInt(arg, 10);
      if (!isNaN(n)) A.setVolume(n);
      print(`Volume: ${A.settings.volume} of 10.${isNaN(n) ? ' Type VOLUME 0-10 to change it.' : ''}`, 'system');
    } else if (what === 'music') {
      const v = on === null ? !A.settings.music : on;
      A.setMusic(v);
      print(v ? 'Music on.' + (songName() ? ` \u266A Now playing: "${songName()}"` : '') : 'Music off. Jeff hums to himself instead.', 'system');
    } else if (what === 'sfx') {
      const v = on === null ? !A.settings.sfx : on;
      A.setSfx(v);
      print(v ? 'Sound effects on.' : 'Sound effects off.', 'system');
    } else {
      const v = on === null ? !(A.settings.music || A.settings.sfx) : on;
      A.setMusic(v);
      A.setSfx(v);
      print(v ? 'Sound on. Bow-chicka-bow-bow.' : 'Sound off. The silence is deafening.', 'system');
    }
    updateSoundButton();
    return true;
  }

  function chip(label, onClick) {
    const s = document.createElement('span');
    s.className = 'chip';
    s.textContent = label;
    s.addEventListener('click', onClick);
    return s;
  }

  function fillChips(el, items, labelOf, onClick) {
    el.innerHTML = '';
    if (!items.length) { el.textContent = '(nothing)'; return; }
    items.forEach((it, i) => {
      if (i) el.appendChild(document.createTextNode(', '));
      el.appendChild(chip(labelOf(it), () => onClick(it)));
    });
  }

  function insertNoun(name) {
    const n = name.replace(/\s*\(.*\)$/, '');
    cmd.value = cmd.value.trim() ? cmd.value.trimEnd() + ' ' + n : 'look at ' + n;
    cmd.focus();
  }

  function render() {
    const v = E.view();
    $('st-score').textContent = `Score: ${v.score} of ${v.maxScore}`;
    $('st-right').textContent = `${v.time}  ${v.money}`;
    const scene = v.dead ? 'death' : v.ended ? 'ending' : E.state.room;
    const description = v.dead ? 'GAME OVER: ' + v.dead.title : v.ended ? v.ended.title : v.title;
    LSJ.Graphics.draw($('art'), scene, E.state);
    $('art').setAttribute('aria-label', description + '. Scene details, objects, and exits are listed below.');
    $('loc').textContent = v.dead ? '*** GAME OVER ***' : v.title;
    fillChips($('see'), v.objects, (o) => o.name, (o) => insertNoun(o.name));
    fillChips($('exits'), v.exits, (e) => e.label, (e) => run('go ' + e.label.replace(/\s*\(.*\)$/, '')));
    fillChips($('travel'), v.travel, (t) => t.name, (t) => run('go to ' + t.name.toLowerCase()));
  }

  function showTitle() {
    onTitle = true;
    LSJ.Graphics.draw($('art'), 'title');
    $('art').setAttribute('aria-label', 'Title screen: Jeff in his powder-blue leisure suit at his desk late at night, under a neon JEFF sign.');
    $('loc').textContent = 'A Polyester Software Production';
    $('see').textContent = '';
    $('exits').textContent = '';
    $('travel').textContent = '';
    $('st-score').textContent = '';
    $('st-right').textContent = '';
    print('Press ENTER to begin a new game, or type RESTORE to load your quick-save.', 'system');
    print('This game has an AdLib soundtrack. Type SOUND OFF (or click \u266A) to mute it.', 'system');
  }

  function run(input) {
    if (audioCommand(input)) return;
    if (onTitle) {
      onTitle = false;
      log.innerHTML = '';
      const out = E.start();
      if (/^\s*(restore|load)\b/i.test(input)) out.push(...E.exec(input));
      printAll(out);
      render();
      soundtrack(out);
      return;
    }
    if (!input.trim()) return;
    print('> ' + input.toUpperCase(), 'echo');
    const out = E.exec(input);
    printAll(out);
    render();
    soundtrack(out);
  }

  function wake() {
    A.unlock();
    if (onTitle && !A.playing) A.playMusic('title');
  }
  document.addEventListener('pointerdown', wake);

  $('snd').addEventListener('click', () => {
    A.unlock();
    const v = !(A.settings.music || A.settings.sfx);
    A.setMusic(v);
    A.setSfx(v);
    if (v && onTitle) A.playMusic('title');
    updateSoundButton();
    cmd.focus();
  });

  cmd.addEventListener('keydown', (e) => {
    wake();
    if (e.key === 'Enter') {
      const v = cmd.value;
      cmd.value = '';
      if (v.trim()) { history.push(v); hIdx = history.length; }
      run(v);
    } else if (e.key === 'ArrowUp') {
      if (hIdx > 0) { hIdx -= 1; cmd.value = history[hIdx]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (hIdx < history.length - 1) { hIdx += 1; cmd.value = history[hIdx]; } else { hIdx = history.length; cmd.value = ''; }
      e.preventDefault();
    }
  });

  document.addEventListener('click', (e) => {
    if (!window.getSelection().toString() && !e.target.classList.contains('chip')) cmd.focus();
  });

  showTitle();
  updateSoundButton();
  cmd.focus();
})();
