'use strict';
// Plays Act I end-to-end and validates content. Run: node test/walkthrough.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const files = ['registry.js', 'content/world.js', 'content/items.js', 'content/home.js', 'content/work.js', 'content/costco.js', 'content/music.js', 'engine.js', 'graphics.js', 'audio.js'];
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), { filename: f });

const { Engine: E } = LSJ;
const VERBOSE = process.argv.includes('-v');
let failures = 0;

function check(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

function play(cmds) {
  const all = [];
  for (const c of cmds) {
    const out = E.exec(c);
    all.push(...out);
    if (VERBOSE) { console.log('> ' + c); out.forEach((o) => console.log('   ' + o.text.replace(/\n/g, '\n   '))); }
  }
  return all;
}

function checkArt() {
  const v = E.view();
  const lines = v.art.replace(/^\n/, '').split('\n');
  const wide = lines.filter((l) => l.length > 78);
  assert.ok(lines.length <= 16, `${v.title}: ${lines.length} lines of art`);
  assert.ok(!wide.length, `${v.title}: art line too wide (${wide[0] && wide[0].length}): "${wide[0]}"`);
}

function artAllRooms() {
  const s = E.state;
  const saveRoom = s.room;
  for (const id of Object.keys(LSJ.rooms)) { s.room = id; checkArt(); }
  s.room = saveRoom;
}

check('art fits 78x16 in initial state', () => { E.start(); artAllRooms(); });
check('title/death/end art fits', () => {
  for (const k of ['titleArt', 'deathArt', 'endArt']) {
    const lines = LSJ.config[k].replace(/^\n/, '').split('\n');
    assert.ok(lines.length <= 16, k + ' too tall: ' + lines.length);
    lines.forEach((l) => assert.ok(l.length <= 78, k + ' too wide: ' + l));
  }
});

check('soundtrack compiles; every destination has a theme', () => {
  for (const id of Object.keys(LSJ.music.songs)) LSJ.Audio.compile(id);
  for (const d of Object.values(LSJ.destinations)) {
    if (d.comingSoon) continue;
    assert.ok(LSJ.music.songs[LSJ.music.themes[d.id]], 'no theme song for destination ' + d.id);
  }
  ['points', 'death', 'fanfare', 'title'].forEach((id) => assert.ok(LSJ.music.songs[id], 'missing song ' + id));
});

check('EGA renderer covers every room and special screen in exactly 16 colors', () => {
  E.start();
  const G = LSJ.Graphics;
  assert.deepStrictEqual([...G.roomScenes].sort(), Object.keys(LSJ.rooms).sort());
  assert.deepStrictEqual([...G.palette], [
    '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
  ]);
  const before = JSON.stringify(E.state);
  const hashes = new Set();
  for (const scene of G.scenes) {
    const frame = G.render(scene, E.state);
    assert.ok(frame instanceof Uint8Array);
    assert.strictEqual(frame.length, 320 * 200, scene + ' dimensions');
    assert.ok(frame.every((color) => color < 16), scene + ' exceeds the EGA palette');
    assert.ok(new Set(frame).size >= 8, scene + ' lacks illustrated detail');
    assert.deepStrictEqual(frame, G.render(scene, E.state), scene + ' should be deterministic');
    hashes.add(require('crypto').createHash('sha256').update(frame).digest('hex'));
  }
  assert.strictEqual(hashes.size, G.scenes.length, 'every scene needs distinct artwork');
  assert.strictEqual(JSON.stringify(E.state), before, 'drawing must not alter gameplay');
  assert.throws(() => G.render('missing_scene', E.state), /Unknown graphics scene/);
  assert.throws(() => G.render('work_cubes'), /valid game state/);
});

check('EGA scene props follow gameplay flags and inventory', () => {
  E.start();
  const cases = [
    ['work_cubes', (s) => s.inventory.push('tps_report')],
    ['work_cubes', (s) => { s.flags.stapler_lent = true; }],
    ['work_cubes', (s) => { s.flags.stapler_lent = true; s.flags.stapler_returned = true; }, { stapler_lent: true }],
    ['work_break', (s) => { s.flags.printer_loaded = true; }],
    ['work_break', (s) => { s.flags.cover_in_tray = true; }],
    ['work_break', (s) => { s.flags.cake_taken = true; }],
    ['work_break', (s) => { s.flags.table_down = true; }],
    ['work_break', (s) => { s.flags.fridge_open_w = true; }],
    ['work_break', (s) => { s.flags.flair_taken = true; }],
    ['work_boss', (s) => { s.flags.report_given = true; }],
    ['home_living', (s) => { s.flags.messages_heard = true; }],
    ['home_living', (s) => { s.flags.home_fridge_open = true; }],
    ['home_bath', (s) => { s.flags.cabinet_open = true; }],
    ['home_bath', (s) => s.inventory.push('comb'), { cabinet_open: true }],
    ['home_bath', (s) => { s.flags.cologne_taken = true; }, { cabinet_open: true }],
    ['home_lot', (s) => { s.carAt = 'costco'; }],
    ['home_lot', (s) => { s.flags.hood_open = true; }],
    ['home_lot', (s) => { s.flags.car_fixed = true; }, { hood_open: true }],
    ['costco_lot', (s) => { s.carAt = 'costco'; }],
    ['costco_lot', (s) => s.inventory.push('cart')],
    ['costco_lot', (s) => { s.minutes = LSJ.config.costcoClose; }],
    ['costco_entrance', (s) => { s.flags.membership_valid = true; }],
    ['costco_aisles', (s) => { s.flags.sample_eaten = true; }],
    ['costco_aisles', (s) => { s.flags.pen_taken = true; }, { sample_eaten: true }],
    ['costco_tire', (s) => s.inventory.push('battery'), {}, ['cart']],
    ['work_cubes', (s) => { s.minutes = 19 * 60; }],
    ['home_lot', (s) => { s.minutes = 19 * 60; }],
  ];
  for (const [scene, change, flags = {}, inventory = []] of cases) {
    const state = JSON.parse(JSON.stringify(E.state));
    Object.assign(state.flags, flags);
    state.inventory.push(...inventory);
    const before = LSJ.Graphics.render(scene, state);
    change(state);
    assert.notDeepStrictEqual(LSJ.Graphics.render(scene, state), before, scene + ': state change should affect the picture');
  }
});

check('Canvas output uses opaque palette pixels without smoothing', () => {
  E.start();
  let painted;
  const ctx = {
    imageSmoothingEnabled: true,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image, x, y) => { assert.strictEqual(x, 0); assert.strictEqual(y, 0); painted = image.data; },
  };
  const canvas = { getContext: (type) => { assert.strictEqual(type, '2d'); return ctx; } };
  LSJ.Graphics.draw(canvas, 'work_cubes', E.state);
  assert.strictEqual(canvas.width, 320);
  assert.strictEqual(canvas.height, 200);
  assert.strictEqual(ctx.imageSmoothingEnabled, false);
  const frame = LSJ.Graphics.render('work_cubes', E.state);
  for (let i = 0; i < frame.length; i++) {
    const hex = LSJ.Graphics.palette[frame[i]];
    assert.strictEqual(painted[i * 4], parseInt(hex.slice(1, 3), 16));
    assert.strictEqual(painted[i * 4 + 1], parseInt(hex.slice(3, 5), 16));
    assert.strictEqual(painted[i * 4 + 2], parseInt(hex.slice(5, 7), 16));
    assert.strictEqual(painted[i * 4 + 3], 255);
  }
});

check('all score ids are reachable keys & exits valid', () => {
  for (const r of Object.values(LSJ.rooms)) for (const e of r.exits || []) {
    assert.ok(LSJ.rooms[e.to], `${r.id} exit -> ${e.to}`);
    if (e.sfx) assert.ok(LSJ.Audio.effects.includes(e.sfx), `${r.id} exit sfx ${e.sfx}`);
  }
});

const walkthrough = [
  'look', 'read memo', 'take report', 'use computer',
  'kick printer', 'go to break room', 'kick printer', 'open fridge', 'take paper', 'put paper in printer', 'take cover sheet',
  'take cake', 'take flair', 'wear flair', 'go cubicles', 'take stapler', 'give cake to merv', 'staple report',
  'give stapler to merv', 'go to brumley\'s office', 'talk to brumley', 'give report to brumley',
  'go lobby', 'talk to peggy', 'talk to todds',
  'take bus home', 'search dumpster', 'open hood', 'go apartment', 'listen to messages', 'search couch', 'sleep',
  'go bathroom', 'look in mirror', 'open cabinet', 'take cologne', 'take comb', 'wear cologne', 'comb hair',
  'go to costco', 'take cart', 'enter', 'go aisles', 'renew membership', 'talk to gus', 'go aisles',
  'stare at tvs', 'talk to sample lady', 'eat weenie', 'take pen', 'clean suit with pen',
  'go tire center', 'buy battery', 'go entrance', 'go food court', 'buy hot dog', 'eat hot dog',
  'take bus home', 'put battery in car', 'drive to work', 'drive home', 'inventory', 'score', 'go apartment', 'sleep in waterbed',
];

check('Act I walkthrough completes', () => {
  E.start();
  const out = play(walkthrough);
  const fx = out.filter((o) => o.type === 'sfx').map((o) => o.text);
  fx.forEach((n) => assert.ok(LSJ.Audio.effects.includes(n), 'unknown sound effect: ' + n));
  assert.ok(['printer', 'stapler', 'cash', 'bus', 'car', 'slosh'].every((n) => fx.includes(n)), 'missing sfx in walkthrough: ' + fx.join(','));
  const s = E.state;
  ['paid', 'tps_stapled', 'stapler_returned', 'membership_valid', 'car_fixed', 'suit_clean', 'combed', 'cologne'].forEach((f) => assert.ok(s.flags[f], 'flag missing: ' + f));
  assert.ok(s.ended, 'act did not end');
  assert.ok(!s.dead, 'jeff died');
  const missed = Object.keys(LSJ.scores).filter((k) => !s.scored[k]);
  console.log(`     score ${s.score}/${E.view().maxScore}, money ${E.view().money}, time ${E.view().time}, missed: ${missed.join(', ') || 'none'}`);
  assert.ok(!out.some((o) => /undefined|\[object/.test(o.text)), 'output contains undefined/[object]');
  artAllRooms();
});

check('art fits in end-state for all rooms', () => { E.state.ended = null; artAllRooms(); });

check('EGA artwork renders every scene with the completed game state', () => {
  for (const scene of LSJ.Graphics.scenes) {
    const frame = LSJ.Graphics.render(scene, E.state);
    assert.strictEqual(frame.length, 64000);
    assert.ok(frame.every((color) => color < 16), scene + ' end-state palette');
  }
});

check('sleep before done does not end act', () => {
  E.start();
  play(['go to home', 'go apartment', 'sleep']);
  assert.ok(!E.state.ended);
});

check('cannot renew without money; Gus blocks aisles', () => {
  E.start();
  play(['take bus to costco', 'go entrance', 'renew membership', 'go aisles']);
  assert.ok(!E.state.flags.membership_valid);
  assert.strictEqual(E.state.room, 'costco_entrance');
});

check('battery requires a cart', () => {
  E.start();
  E.state.money = 50000;
  E.state.flags.membership_valid = true;
  play(['go to costco', 'go entrance', 'go aisles', 'go tire center', 'buy battery']);
  assert.ok(!E.state.inventory.includes('battery'));
});

check('death by yogurt, then undo', () => {
  E.start();
  play(['go break room', 'open fridge', 'eat yogurt']);
  assert.ok(E.state.dead);
  play(['look']);
  assert.ok(E.state.dead, 'commands blocked while dead');
  play(['undo']);
  assert.ok(!E.state.dead);
});

check('costco closes at 8:30 and kicks you out', () => {
  E.start();
  E.state.money = 50000;
  E.state.flags.membership_valid = true;
  play(['go to costco', 'go entrance', 'go aisles']);
  E.state.minutes = 20 * 60 + 29;
  play(['look']);
  assert.strictEqual(E.state.room, 'costco_lot');
  play(['go entrance']);
  assert.ok(E.state.dead, 'should die at closed costco without battery');
});

check('save / restore / restart', () => {
  E.start();
  play(['take report', 'save t1', 'drop report', 'restart', 'restore t1']);
  assert.ok(E.state.inventory.includes('tps_report'));
});

check('parser variety', () => {
  E.start();
  const out = play(['x memo', 'pick up the tps report', 'turn on the computer', 'walk to the break room', 'grab ream', 'load paper into printer', 'get cover', 'hello', 'blorf', 'go to walmart', 'go to gym', 'map', 'hint', 'help', 'costco']);
  assert.ok(E.state.inventory.includes('cover_sheet'), 'got cover sheet via synonyms');
  assert.strictEqual(E.state.room, 'costco_lot', 'bare destination name travels');
});

check('time display', () => {
  assert.strictEqual(E.fmtTime(16 * 60 + 30), 'Fri 4:30 PM');
  assert.strictEqual(E.fmtTime(1440 + 9 * 60 + 5), 'Sat 9:05 AM');
});

check('manual covers every point without spelling out solutions', () => {
  const html = fs.readFileSync(path.join(root, 'manual.html'), 'utf8');
  assert.ok(html.includes('href="./"'), 'manual needs a play-now link');
  const covered = new Set();
  for (const m of html.matchAll(/data-covers="([^"]+)"/g)) m[1].split(/\s+/).forEach((id) => {
    assert.ok(LSJ.scores[id], 'unknown score id in manual: ' + id);
    covered.add(id);
  });
  const missing = Object.keys(LSJ.scores).filter((id) => !covered.has(id));
  assert.deepStrictEqual(missing, [], 'manual misses: ' + missing.join(', '));
  const total = Object.values(LSJ.scores).reduce((a, s) => a + s.pts, 0);
  const areas = [...html.matchAll(/data-pts="(\d+)"/g)].map((m) => +m[1]);
  assert.strictEqual(areas.reduce((a, b) => a + b, 0), total, 'area points do not add up to ' + total);
  const sections = html.split(/(?=<[^>]+data-pts=")/).slice(1);
  sections.forEach((sec) => {
    const want = +sec.match(/data-pts="(\d+)"/)[1];
    const ids = [...sec.matchAll(/data-covers="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
    const got = ids.reduce((a, id) => a + LSJ.scores[id].pts, 0);
    assert.strictEqual(got, want, 'section worth ' + want + ' covers ' + got + ' (' + ids.join(' ') + ')');
  });
  E.start();
  const forbidden = [];
  for (const c of [...walkthrough.slice(0, 4), 'play solitaire', ...walkthrough.slice(4)]) {
    const before = E.state.score;
    E.exec(c);
    if (E.state.score > before && !/^(go|drive|take bus)\b/.test(c)) forbidden.push(c.toUpperCase());
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').toUpperCase();
  const leaks = forbidden.filter((c) => text.includes(c));
  assert.deepStrictEqual(leaks, [], 'manual spoils exact commands: ' + leaks.join(', '));
});

console.log(failures ? `\n${failures} FAILED` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);
