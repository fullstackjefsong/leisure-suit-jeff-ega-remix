(function () {
  'use strict';

  const WIDTH = 320;
  const HEIGHT = 200;
  // IBM's 16-color EGA palette; every painted pixel is a palette index.
  const palette = Object.freeze([
    '#000000', '#0000aa', '#00aa00', '#00aaaa',
    '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff',
    '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
  ]);
  const rgb = palette.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

  class Picture {
    constructor() { this.pixels = new Uint8Array(WIDTH * HEIGHT); }

    rect(x, y, w, h, color) {
      const left = Math.max(0, Math.round(x));
      const top = Math.max(0, Math.round(y));
      const right = Math.min(WIDTH, Math.round(x + w));
      const bottom = Math.min(HEIGHT, Math.round(y + h));
      if (right <= left || bottom <= top) return;
      for (let row = top; row < bottom; row++) this.pixels.fill(color, row * WIDTH + left, row * WIDTH + right);
    }

    line(x0, y0, x1, y1, color) {
      x0 = Math.round(x0); y0 = Math.round(y0);
      x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        this.rect(x0, y0, 1, 1, color);
        if (x0 === x1 && y0 === y1) break;
        const twice = 2 * error;
        if (twice >= dy) { error += dy; x0 += sx; }
        if (twice <= dx) { error += dx; y0 += sy; }
      }
    }

    poly(points, color) {
      const top = Math.max(0, Math.ceil(Math.min(...points.map((p) => p[1]))));
      const bottom = Math.min(HEIGHT - 1, Math.floor(Math.max(...points.map((p) => p[1]))));
      for (let y = top; y <= bottom; y++) {
        const crossings = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
            crossings.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
        }
        crossings.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const left = Math.ceil(crossings[i]);
          this.rect(left, y, Math.floor(crossings[i + 1]) - left + 1, 1, color);
        }
      }
    }

    ellipse(x, y, rx, ry, color) {
      for (let row = Math.ceil(y - ry); row <= Math.floor(y + ry); row++) {
        const span = rx * Math.sqrt(Math.max(0, 1 - ((row - y) / ry) ** 2));
        this.rect(Math.ceil(x - span), row, Math.floor(x + span) - Math.ceil(x - span) + 1, 1, color);
      }
    }

    dither(x, y, w, h, a, b) {
      this.rect(x, y, w, h, a);
      for (let row = y; row < y + h; row++) {
        for (let col = x + (row % 2); col < x + w; col += 2) this.rect(col, row, 1, 1, b);
      }
    }
  }

  function box(g, x, y, w, h, color) {
    g.rect(x, y, w, h, 0);
    g.rect(x + 1, y + 1, w - 2, h - 2, color);
    g.line(x + 1, y + 1, x + w - 2, y + 1, 15);
    g.line(x + 1, y + 1, x + 1, y + h - 2, 7);
    g.line(x + 2, y + h - 2, x + w - 2, y + h - 2, 8);
  }

  const digits = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    ':': ['0', '1', '0', '1', '0'],
    '.': ['0', '0', '0', '0', '1'],
  };

  Object.assign(digits, {
    E: ['111', '100', '110', '100', '111'],
    F: ['111', '100', '110', '100', '100'],
    G: ['111', '100', '101', '101', '111'],
    J: ['001', '001', '001', '101', '111'],
    N: ['110', '101', '101', '101', '101'],
    R: ['110', '101', '110', '101', '101'],
    S: ['111', '100', '111', '001', '111'],
    X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '111', '010', '010'],
  });

  function number(g, text, x, y, scale, color) {
    for (const ch of text) {
      const glyph = digits[ch];
      if (!glyph) throw new Error('Unsupported pixel digit: ' + ch);
      glyph.forEach((row, dy) => Array.from(row).forEach((bit, dx) => {
        if (bit === '1') g.rect(x + dx * scale, y + dy * scale, scale, scale, color);
      }));
      x += (glyph[0].length + 1) * scale;
    }
  }

  function clock(g, x, y, minutes) {
    box(g, x, y, 44, 13, 0);
    const time = String(Math.floor(minutes / 60) % 24).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    number(g, time, x + 6, y + 4, 1, 10);
  }

  function interior(g, wall = 7, floor = 8) {
    g.rect(0, 0, WIDTH, HEIGHT, wall);
    g.dither(0, 0, WIDTH, 14, 8, 7);
    g.poly([[0, 14], [18, 30], [18, 126], [0, 146]], 8);
    g.poly([[320, 14], [303, 30], [303, 126], [320, 146]], 8);
    g.rect(18, 123, 285, 4, 0);
    g.rect(0, 127, 320, 73, floor);
    for (let x = -160; x < 500; x += 44) g.line(160, 113, x, 200, 0);
    for (const y of [138, 158, 187]) g.line(0, y, 320, y, 0);
    for (const x of [42, 212]) {
      g.rect(x, 6, 65, 5, 0);
      g.rect(x + 2, 7, 61, 2, 15);
    }
  }

  function windowView(g, x, y, w, h, night) {
    box(g, x, y, w, h, 0);
    g.rect(x + 3, y + 3, w - 6, h - 6, night ? 1 : 9);
    g.rect(x + 3, y + h / 2, w - 6, h / 2 - 3, night ? 5 : 11);
    g.ellipse(x + w - 15, y + 13, 5, 5, night ? 15 : 14);
    for (let i = 0; i < Math.floor((w - 6) / 13); i++) {
      const bx = x + 3 + i * 13, bh = 10 + (i * 11 % Math.max(12, Math.floor(h / 2)));
      g.rect(bx, y + h - 4 - bh, 12, bh, night ? 0 : 8);
      for (let wy = y + h - bh; wy < y + h - 7; wy += 7) {
        for (let wx = bx + 2; wx < bx + 10; wx += 5) g.rect(wx, wy, 2, 3, night ? 14 : 11);
      }
    }
    g.rect(x + w / 2 - 1, y + 2, 3, h - 4, 7);
    g.rect(x + 2, y + h / 2, w - 4, 2, 7);
  }

  function door(g, x, y, w, h, open = true) {
    box(g, x, y, w, h, 8);
    g.rect(x + 4, y + 3, w - 8, h - 5, open ? 1 : 6);
    if (open) g.poly([[x + 4, y + 3], [x + 13, y + 9], [x + 13, y + h - 5], [x + 4, y + h - 2]], 3);
    else g.rect(x + w - 10, y + h / 2, 3, 2, 14);
    g.rect(x + 4, y + h - 3, w - 8, 2, 7);
  }

  function arrow(g, x, y, right = true, color = 14) {
    const d = right ? 1 : -1;
    g.rect(x - 5, y - 1, 11, 3, color);
    g.line(x + 5 * d, y, x + d, y - 4, color);
    g.line(x + 5 * d, y, x + d, y + 4, color);
  }

  function desk(g, x, y, w, color = 6) {
    g.ellipse(x + w / 2, y + 34, w / 2, 7, 0);
    g.rect(x + 5, y + 6, 5, 34, 0);
    g.rect(x + w - 11, y + 6, 5, 34, 0);
    g.poly([[x, y], [x + 9, y - 8], [x + w - 7, y - 8], [x + w, y], [x + w, y + 6], [x, y + 6]], color);
    g.line(x + 10, y - 7, x + w - 8, y - 7, 14);
    g.line(x, y + 6, x + w, y + 6, 0);
    g.rect(x + 3, y + 1, w - 6, 2, 8);
  }

  function monitor(g, x, y, scale = 1, screen = 2) {
    const r = (a, b, w, h, c) => g.rect(x + a * scale, y + b * scale, w * scale, h * scale, c);
    r(5, 3, 48, 34, 0); r(0, 0, 49, 32, 7);
    r(2, 1, 44, 2, 15); r(3, 4, 39, 23, 8); r(5, 6, 35, 18, 0);
    for (let i = 0; i < 5; i++) {
      r(7, 8 + i * 3, 4 + (i * 7 % 23), 1, screen);
      r(12 + (i * 5 % 12), 8 + i * 3, 3, 1, screen === 2 ? 10 : 11);
    }
    r(40, 28, 3, 1, 10); r(17, 32, 13, 5, 8); r(10, 37, 29, 3, 7);
  }

  function keyboard(g, x, y, scale = 1) {
    g.poly([[x + 3 * scale, y], [x + 39 * scale, y], [x + 44 * scale, y + 8 * scale], [x, y + 8 * scale]], 7);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 10; col++) g.rect(x + (4 + col * 3) * scale, y + (1 + row * 2) * scale, 2 * scale, scale, 8);
    }
  }

  function paper(g, x, y, w = 17, h = 12) {
    g.rect(x + 1, y + 2, w, h, 0);
    g.rect(x, y, w, h, 15);
    for (let row = 3; row < h - 1; row += 3) g.rect(x + 3, y + row, w - 6, 1, 9);
  }

  function cup(g, x, y, color = 15) {
    g.ellipse(x + 10, y + 4, 4, 4, color);
    g.ellipse(x + 10, y + 4, 2, 2, 0);
    g.rect(x, y, 9, 10, color);
    g.rect(x + 1, y, 7, 2, 6);
    g.line(x + 2, y - 4, x + 4, y - 6, 7);
    g.line(x + 4, y - 6, x + 3, y - 8, 7);
  }

  function plant(g, x, y, wilted = false) {
    g.poly([[x - 8, y], [x + 8, y], [x + 5, y + 12], [x - 5, y + 12]], 6);
    g.line(x, y, x, y - 31, 2);
    for (const [dx, dy] of [[-11, -23], [12, -30], [-9, -38], [9, -16]]) {
      g.line(x, y - 19, x + dx, y + dy + (wilted ? 15 : 0), 2);
      g.ellipse(x + dx, y + dy + (wilted ? 15 : 0), 6, 3, wilted ? 6 : 10);
    }
  }

  function person(g, x, y, scale = 1, options = {}) {
    const shirt = options.hero ? 11 : options.shirt === undefined ? 9 : options.shirt;
    const r = (a, b, w, h, c) => g.rect(x + a * scale, y + b * scale, w * scale, h * scale, c);
    const e = (a, b, rx, ry, c) => g.ellipse(x + a * scale, y + b * scale, rx * scale, ry * scale, c);
    const l = (a, b, c, d, color) => g.line(x + a * scale, y + b * scale, x + c * scale, y + d * scale, color);
    const p = (points, c) => g.poly(points.map(([a, b]) => [x + a * scale, y + b * scale]), c);
    e(17, 58, 18, 3, 0);
    const pants = options.hero ? 11 : 1;
    r(7, 43, 9, 14, pants); r(20, 43, 9, 14, pants);
    if (options.hero) { r(15, 45, 1, 12, 3); r(20, 45, 1, 12, 3); r(5, 53, 12, 2, 11); r(20, 53, 13, 2, 11); }
    r(5, 55, 12, 4, 0); r(20, 55, 13, 4, 0);
    p([[5, 26], [13, 22], [23, 22], [30, 27], [31, 45], [5, 45]], shirt);
    r(1, 29, 6, 17, shirt); r(29, 29, 6, 17, shirt);
    r(1, 44, 6, 6, 14); r(29, 44, 6, 6, 14);
    if (options.hero) {
      // Powder-blue leisure suit: open white collar, gold chain, wide lapels.
      p([[14, 23], [22, 23], [18, 35]], 15);
      p([[13, 23], [8, 30], [17, 38], [18, 35]], 3);
      p([[23, 23], [28, 30], [19, 38], [18, 35]], 3);
      l(14, 26, 18, 30, 14); l(22, 26, 18, 30, 14);
      r(4, 29, 2, 15, 3); r(30, 29, 2, 15, 3);
      r(18, 38, 1, 7, 3); r(16, 40, 1, 1, 15); r(16, 43, 1, 1, 15);
      if (!options.clean) { p([[21, 37], [26, 36], [27, 40], [24, 42], [21, 41]], 6); }
      if (options.flair) { e(10, 33, 2, 2, 14); }
    } else {
      p([[15, 25], [21, 25], [19, 39], [17, 39]], options.apron ? 15 : 4);
      if (options.apron) r(9, 34, 19, 11, 15);
    }
    r(14, 20, 9, 6, 6);
    e(17, 13, 11, 12, 0);
    e(17, 14, 10, 10, 14);
    r(7, 12, 3, 9, 6); r(27, 11, 2, 8, 6);
    r(9, 2, 17, 3, options.elder ? 7 : 0);
    if (!options.hero || options.combed) r(10, 4, 13, 2, options.elder ? 7 : 0);
    else { r(8, 3, 3, 6, 0); r(24, 3, 3, 5, 0); }
    if (options.woman) { r(5, 5, 4, 17, 6); r(27, 6, 4, 17, 6); }
    if (options.hero) {
      r(11, 9, 5, 1, 6); r(21, 9, 5, 1, 6);
      r(12, 11, 3, 3, 15); r(22, 11, 3, 3, 15);
      r(13, 12, 2, 2, 0); r(23, 12, 2, 2, 0);
      r(8, 6, 2, 9, 6); r(27, 6, 2, 9, 6);
    } else {
      r(10, 10, 7, 6, 0); r(20, 10, 7, 6, 0); r(17, 11, 3, 1, 0);
      r(11, 11, 5, 3, 11); r(21, 11, 5, 3, 11);
      r(13, 12, 2, 3, 0); r(22, 12, 2, 3, 0);
    }
    r(17, 15, 3, 3, 6); r(14, 20, 9, 1, 6);
    r(12, 18, 1, 1, 6); r(24, 19, 1, 1, 6);
  }

  function jeff(g, x, y, state, scale = 1) {
    person(g, x, y, scale, {
      hero: true, clean: state.flags.suit_clean, combed: state.flags.combed, flair: state.flags.flair_worn,
    });
  }

  function battery(g, x, y, color = 10) {
    g.rect(x + 3, y - 2, 4, 3, 4); g.rect(x + 15, y - 2, 4, 3, 8);
    box(g, x, y, 23, 14, 0);
    g.rect(x + 3, y + 4, 17, 6, color);
    g.line(x + 5, y + 7, x + 9, y + 7, 0); g.line(x + 7, y + 5, x + 7, y + 9, 0);
    g.line(x + 14, y + 7, x + 18, y + 7, 0);
  }

  function car(g, x, y, state) {
    g.ellipse(x + 48, y + 35, 51, 7, 0);
    g.poly([[x, y + 14], [x + 20, y + 12], [x + 34, y], [x + 68, y], [x + 80, y + 13], [x + 100, y + 18], [x + 98, y + 31], [x + 2, y + 31]], 9);
    g.poly([[x + 35, y + 3], [x + 49, y + 3], [x + 49, y + 13], [x + 25, y + 13]], 11);
    g.poly([[x + 53, y + 3], [x + 66, y + 3], [x + 76, y + 13], [x + 53, y + 13]], 3);
    g.line(x + 49, y + 16, x + 49, y + 28, 1);
    g.rect(x + 39, y + 18, 6, 2, 15); g.rect(x + 2, y + 25, 97, 3, 1);
    for (const wx of [22, 77]) { g.ellipse(x + wx, y + 31, 10, 9, 0); g.ellipse(x + wx, y + 31, 5, 5, 7); }
    g.rect(x + 1, y + 17, 7, 4, 12); g.rect(x + 93, y + 20, 6, 4, 14);
    if (state.flags.hood_open) {
      g.poly([[x + 76, y + 14], [x + 88, y - 17], [x + 100, y - 12], [x + 98, y + 18]], 1);
      g.line(x + 88, y - 17, x + 100, y - 12, 11);
      battery(g, x + 73, y + 15, state.flags.car_fixed ? 10 : 6);
    }
  }

  function cart(g, x, y, loaded) {
    g.line(x, y, x + 8, y + 2, 15);
    g.poly([[x + 8, y + 3], [x + 41, y + 3], [x + 36, y + 23], [x + 13, y + 23]], 8);
    for (let col = 12; col < 40; col += 5) g.line(x + col, y + 4, x + col, y + 22, 7);
    for (const row of [8, 14, 20]) g.line(x + 10, y + row, x + 37, y + row, 15);
    g.line(x + 13, y + 25, x + 38, y + 25, 7);
    g.ellipse(x + 15, y + 29, 3, 3, 0); g.ellipse(x + 36, y + 29, 3, 3, 0);
    if (loaded) battery(g, x + 16, y + 6);
  }

  function refrigerator(g, x, y, open) {
    box(g, x, y, 38, 73, 7);
    g.rect(x + 3, y + 22, 32, 1, 8);
    if (open) {
      g.rect(x + 5, y + 26, 26, 41, 0);
      for (const row of [38, 53]) g.rect(x + 5, y + row, 26, 2, 15);
      g.rect(x + 12, y + 42, 8, 10, 13);
      g.poly([[x + 33, y + 25], [x + 47, y + 19], [x + 47, y + 65], [x + 33, y + 71]], 3);
    } else {
      g.rect(x + 28, y + 29, 2, 15, 0);
      paper(g, x + 8, y + 30, 12, 12);
      g.rect(x + 12, y + 28, 3, 3, 4);
    }
  }

  function living(g, state, sleeping) {
    interior(g, 6, 5);
    for (let x = 25; x < 300; x += 16) g.line(x, 16, x, 121, 8);
    box(g, 25, 26, 66, 42, 0);
    g.dither(29, 30, 58, 34, 1, 5);
    for (const x of [38, 58, 77]) {
      g.ellipse(x, 42, 5, 5, 6); g.rect(x - 4, 47, 8, 12, 7);
      g.rect(x - 6, 39, 3, 5, 6); g.rect(x + 3, 39, 3, 5, 6);
    }
    g.poly([[35, 56], [77, 56], [85, 63], [31, 63]], 2);
    monitor(g, 132, 57, 0.9, 11);
    g.line(150, 56, 141, 45, 0); g.line(150, 56, 163, 45, 0);
    desk(g, 128, 99, 60);
    refrigerator(g, 251, 33, state.flags.home_fridge_open);
    door(g, 294, 75, 24, 63);
    arrow(g, 303, 151, true);
    g.poly([[15, 139], [29, 116], [113, 116], [133, 140], [130, 178], [16, 178]], 0);
    g.poly([[20, 139], [32, 122], [110, 122], [126, 140], [124, 167], [20, 167]], 9);
    g.dither(22, 142, 100, 23, 9, 11);
    g.rect(28, 126, 29, 13, 15);
    for (let i = 0; i < 6; i++) g.line(61 + i * 9, 136, 66 + i * 9, 138, 1);
    g.rect(165, 111, 76, 35, 0); g.rect(169, 114, 68, 24, 2);
    g.rect(159, 130, 11, 26, 6); g.rect(236, 130, 10, 26, 6);
    g.rect(170, 140, 66, 15, 2);
    for (let x = 174; x < 237; x += 10) g.rect(x, 115, 2, 39, 10);
    for (const y of [122, 132, 145]) g.rect(170, y, 66, 2, 10);
    desk(g, 220, 100, 29);
    box(g, 224, 85, 19, 10, 8);
    g.rect(226, 86, 13, 3, 0);
    g.rect(239, 91, 2, 2, state.flags.messages_heard ? 8 : 12);
    g.rect(228, 82, 12, 3, 0);
    g.rect(106, 84, 9, 24, 5); g.ellipse(111, 82, 5, 9, 13);
    g.ellipse(111, 79, 2, 3, 12); g.rect(102, 108, 18, 4, 0);
    arrow(g, 145, 180, false);
    if (sleeping) {
      g.ellipse(43, 134, 10, 7, 14); g.rect(34, 129, 5, 8, 0);
      g.line(45, 132, 49, 132, 0); g.line(52, 136, 55, 136, 6);
      g.ellipse(55, 114, 3, 3, 15); g.ellipse(62, 103, 2, 2, 15);
    } else jeff(g, 130, 130, state);
  }

  const rooms = {
    work_lobby(g, state) {
      interior(g, 3, 7);
      box(g, 25, 25, 100, 26, 1);
      number(g, 'SYNERGEX', 44, 32, 2, 14);
      door(g, 148, 36, 44, 87, false);
      g.line(170, 40, 170, 119, 8);
      g.rect(195, 74, 4, 8, 6); g.rect(196, 75, 2, 2, 14);
      g.rect(161, 29, 19, 5, 0); arrow(g, 170, 31, true, 12);
      box(g, 222, 28, 60, 33, 15);
      g.poly([[232, 53], [239, 40], [250, 51], [260, 37], [275, 53]], 2);
      person(g, 54, 65, 0.9, { shirt: 5, woman: true });
      desk(g, 22, 116, 113, 6); monitor(g, 81, 87, 0.6); cup(g, 34, 103);
      g.rect(209, 113, 88, 27, 1); g.rect(204, 132, 98, 13, 9);
      person(g, 214, 86, 0.8, { shirt: 8 }); person(g, 259, 86, 0.8, { shirt: 8 });
      paper(g, 221, 122, 12, 15); paper(g, 267, 122, 12, 15);
      plant(g, 29, 171);
      jeff(g, 142, 135, state); arrow(g, 168, 130, true);
    },

    work_cubes(g, state) {
      interior(g);
      clock(g, 142, 22, state.minutes);
      windowView(g, 29, 27, 84, 38, state.minutes % 1440 >= 1080);
      door(g, 270, 37, 29, 81);
      g.rect(13, 81, 218, 48, 8);
      for (const x of [14, 89, 164, 230]) {
        g.rect(x, 73, 5, 77, 7); g.rect(x + 1, 74, 2, 74, 15);
      }
      desk(g, 21, 124, 64); monitor(g, 25, 88, 0.8); keyboard(g, 28, 121, 0.8);
      if (!state.inventory.includes('tps_report') && !state.flags.report_given) paper(g, 63, 117, 17, 12);
      paper(g, 72, 81, 10, 15);
      person(g, 105, 80, 0.85, { shirt: 15 });
      desk(g, 95, 124, 62); cup(g, 140, 111, 14);
      if (!state.flags.stapler_lent || state.flags.stapler_returned) {
        g.rect(108, 118, 17, 4, 0); g.poly([[108, 116], [122, 113], [125, 117], [108, 120]], 12);
      }
      desk(g, 174, 124, 50); plant(g, 198, 111, true);
      g.line(168, 76, 187, 94, 15); g.line(187, 76, 168, 94, 15);
      arrow(g, 20, 170, false); arrow(g, 299, 155, true);
      jeff(g, 128, 137, state);
    },

    work_break(g, state) {
      interior(g, 3, 7);
      g.rect(24, 24, 179, 17, 5);
      for (let x = 30; x < 193; x += 20) {
        g.poly([[x, 26], [x + 12, 26], [x + 6, 37]], x % 40 ? 14 : 13);
      }
      box(g, 169, 49, 49, 36, 6);
      paper(g, 175, 55, 15, 16); paper(g, 197, 54, 14, 12);
      if (!state.flags.flair_taken) g.ellipse(200, 76, 4, 4, 14);
      refrigerator(g, 244, 45, state.flags.fridge_open_w);
      box(g, 22, 82, 58, 44, 7);
      g.rect(27, 76, 48, 9, 8); g.rect(31, 79, 38, 3, 0);
      g.rect(29, 92, 26, 9, 1);
      g.rect(59, 94, 5, 3, state.flags.printer_loaded ? 10 : 12);
      g.rect(29, 110, 41, 5, 0);
      if (state.flags.cover_in_tray) paper(g, 37, 111, 26, 13);
      desk(g, 100, 113, 114);
      if (!state.flags.cake_taken) {
        g.ellipse(133, 105, 18, 5, 15); g.rect(118, 95, 30, 10, 13);
        g.ellipse(133, 94, 15, 4, 15); g.rect(132, 87, 2, 7, 12); g.rect(132, 84, 2, 3, 14);
      } else {
        for (let i = 0; i < 8; i++) g.rect(121 + i * 3, 105 + i % 3, 2, 1, 13);
      }
      cup(g, 187, 100, 0); g.rect(186, 98, 10, 2, 6);
      if (state.flags.table_down) {
        g.poly([[206, 155], [256, 150], [273, 164], [219, 171]], 6);
        g.line(225, 169, 244, 181, 0); g.line(264, 162, 281, 175, 0);
      } else {
        desk(g, 221, 148, 60); paper(g, 266, 181, 16, 7);
      }
      jeff(g, 83, 134, state); arrow(g, 21, 170, false);
    },

    work_boss(g, state) {
      interior(g, 6, 2);
      windowView(g, 27, 24, 100, 56, state.minutes % 1440 >= 1080);
      box(g, 247, 24, 43, 39, 14);
      person(g, 257, 30, 0.45, { shirt: 15 });
      g.rect(179, 67, 45, 60, 0); g.rect(184, 70, 35, 42, 6);
      person(g, 183, 64, 1, { shirt: 15 });
      g.line(195, 91, 195, 105, 4); g.line(207, 91, 207, 105, 4);
      desk(g, 147, 132, 151, 6); cup(g, 263, 115, 15);
      if (state.flags.report_given) paper(g, 170, 119, 29, 13);
      else paper(g, 225, 120, 21, 10);
      g.rect(41, 109, 17, 46, 1); g.line(48, 112, 62, 66, 7); g.line(60, 66, 71, 66, 15);
      g.rect(240, 150, 44, 19, 6); g.rect(257, 157, 8, 2, 14);
      jeff(g, 87, 135, state); arrow(g, 28, 177, false);
    },

    home_living(g, state) { living(g, state, false); },

    home_bath(g, state) {
      interior(g, 2, 3);
      for (let y = 16; y < 124; y += 14) g.line(18, y, 302, y, 10);
      for (let x = 18; x < 303; x += 18) g.line(x, 16, x, 124, 10);
      box(g, 52, 26, 73, 56, 11);
      g.poly([[57, 30], [73, 30], [119, 69], [119, 77], [106, 77]], 15);
      jeff(g, 78, 40, state, 0.6);
      g.ellipse(87, 107, 39, 11, 0); g.ellipse(87, 103, 37, 9, 15);
      g.ellipse(87, 104, 26, 5, 3); g.rect(81, 111, 12, 26, 15);
      g.rect(83, 91, 4, 12, 7); g.rect(83, 91, 11, 3, 15);
      box(g, 173, 28, 57, 55, state.flags.cabinet_open ? 0 : 11);
      if (state.flags.cabinet_open) {
        g.rect(178, 53, 47, 2, 7);
        if (!state.flags.cologne_taken && !state.inventory.includes('cologne')) {
          g.rect(184, 42, 9, 10, 2); g.rect(187, 38, 4, 4, 14);
        }
        if (!state.inventory.includes('comb')) {
          g.rect(203, 47, 17, 2, 7);
          for (let x = 203; x < 220; x += 3) g.rect(x, 49, 1, 4, 7);
        }
        g.poly([[230, 29], [245, 20], [245, 76], [230, 83]], 3);
      } else g.rect(218, 51, 3, 7, 7);
      box(g, 253, 95, 34, 32, 15);
      g.rect(256, 99, 6, 2, 7);
      g.ellipse(270, 136, 24, 12, 15); g.ellipse(270, 134, 15, 6, 3);
      g.rect(261, 143, 17, 19, 15);
      jeff(g, 132, 135, state); arrow(g, 24, 175, false);
    },

    home_lot(g, state) {
      const night = state.minutes % 1440 >= 1080;
      g.rect(0, 0, 320, 200, night ? 1 : 9);
      g.rect(0, 40, 184, 100, 6);
      for (let y = 43; y < 131; y += 9) {
        g.line(0, y, 184, y, 8);
        for (let x = (y % 2) * 8; x < 184; x += 19) g.line(x, y, x, y + 8, 8);
      }
      for (const y of [53, 85]) for (const x of [13, 48, 83, 118, 153]) {
        box(g, x, y, 22, 22, 0); g.rect(x + 3, y + 3, 16, 16, x === 153 && y === 53 ? 14 : night ? 1 : 11);
        g.rect(x + 10, y + 2, 2, 18, 7);
      }
      door(g, 76, 110, 29, 31);
      g.rect(0, 141, 320, 59, 8); g.rect(0, 138, 320, 4, 7);
      for (let x = 0; x < 320; x += 50) g.line(x, 196, x + 21, 157, 15);
      box(g, 214, 107, 43, 28, 2); g.rect(211, 103, 49, 5, 0);
      g.line(217, 101, 250, 101, 10);
      g.rect(293, 72, 3, 75, 7); box(g, 280, 47, 29, 28, 15);
      number(g, '42', 287, 55, 2, 1);
      if (state.carAt === 'home') car(g, 24, 148, state);
      else { g.rect(35, 169, 62, 2, 14); number(g, '14', 53, 175, 2, 14); }
      jeff(g, 166, 137, state); arrow(g, 105, 127, true); arrow(g, 297, 170, true);
    },

    costco_lot(g, state) {
      g.rect(0, 0, 320, 200, state.minutes % 1440 >= 1080 ? 1 : 9);
      g.rect(4, 39, 312, 89, 7);
      for (let x = 7; x < 317; x += 6) g.line(x, 41, x, 124, 15);
      g.rect(4, 39, 312, 18, 1); g.rect(4, 58, 312, 5, 4);
      box(g, 113, 41, 94, 18, 1); number(g, '10:00', 120, 47, 1, 15); number(g, '20:30', 164, 47, 1, 15);
      const minute = state.minutes % 1440;
      door(g, 118, 79, 55, 49, minute >= 600 && minute < LSJ.config.costcoClose);
      g.line(145, 82, 145, 124, 7);
      g.rect(238, 76, 66, 10, 4); g.rect(242, 87, 58, 35, 0);
      g.rect(251, 95, 38, 3, 14); g.rect(251, 102, 26, 3, 12);
      g.rect(0, 128, 320, 72, 8);
      for (let x = -60; x < 330; x += 70) g.line(x, 199, x + 32, 143, 15);
      if (state.carAt === 'costco') car(g, 24, 148, state);
      g.rect(225, 129, 87, 3, 7); g.rect(225, 131, 2, 26, 7); g.rect(310, 131, 2, 26, 7);
      if (!state.inventory.includes('cart')) { cart(g, 234, 133, false); cart(g, 253, 131, false); }
      jeff(g, 169, 136, state); arrow(g, 146, 136, true); arrow(g, 276, 130, true);
    },

    costco_entrance(g, state) {
      interior(g, 7, 3);
      g.rect(17, 25, 285, 15, 1); g.rect(17, 40, 285, 3, 4);
      for (let x = 30; x < 295; x += 25) g.rect(x, 29, 13, 4, 15);
      door(g, 29, 48, 58, 78);
      g.rect(31, 50, 54, 4, 10); arrow(g, 58, 69, true);
      person(g, 97, 69, 0.95, { shirt: 4, elder: true });
      g.rect(84, 123, 6, 28, 7); g.rect(140, 123, 6, 28, 7);
      g.rect(85, state.flags.membership_valid ? 116 : 128, 59, 4, state.flags.membership_valid ? 10 : 4);
      box(g, 190, 53, 91, 19, 1);
      g.rect(198, 59, 18, 8, 15); g.rect(201, 60, 4, 5, 9);
      person(g, 227, 77, 0.8, { shirt: 9 });
      desk(g, 179, 129, 121, 1); monitor(g, 253, 96, 0.65);
      paper(g, 196, 114, 22, 12);
      g.rect(220, 118, 8, 5, state.flags.membership_valid ? 10 : 12);
      jeff(g, 42, 137, state); arrow(g, 279, 174, true); arrow(g, 19, 175, false);
    },

    costco_aisles(g, state) {
      interior(g, 8, 7);
      for (const x of [185, 251]) {
        g.rect(x, 23, 4, 106, 4); g.rect(x + 57, 23, 4, 106, 4);
        for (const y of [54, 89, 122]) {
          g.rect(x, y, 61, 4, 12);
          for (let col = 0; col < 3; col++) {
            box(g, x + 7 + col * 16, y - 24, 13, 23, col % 2 ? 15 : 6);
            g.rect(x + 10 + col * 16, y - 17, 7, 5, 1);
          }
        }
      }
      for (const x of [21, 69, 117]) {
        box(g, x, 46, 45, 36, 0);
        g.rect(x + 3, 49, 39, 28, 1);
        g.poly([[x + 3, 73], [x + 15, 55], [x + 27, 67], [x + 42, 57], [x + 42, 77]], 2);
        g.rect(x + 18, 56, 5, 21, 11); g.rect(x + 16, 70, 10, 7, 15);
      }
      for (const x of [27, 67, 106]) person(g, x, 84, 0.7, { shirt: 1 });
      person(g, 137, 95, 0.85, { shirt: 13, woman: true, apron: true });
      desk(g, 120, 145, 67, 15);
      g.ellipse(143, 137, 15, 4, 7);
      if (!state.flags.sample_eaten) {
        for (let x = 133; x < 153; x += 6) { g.rect(x, 134, 5, 3, 12); g.line(x + 2, 130, x + 2, 134, 14); }
      }
      if (state.flags.sample_eaten && !state.flags.pen_taken) g.rect(170, 132, 3, 11, 13);
      g.ellipse(264, 94, 12, 5, 14); g.rect(253, 94, 23, 22, 15);
      g.rect(257, 100, 15, 9, 9); g.rect(252, 90, 25, 4, 14);
      g.ellipse(209, 110, 10, 6, 6); g.ellipse(209, 107, 6, 4, 14);
      g.rect(290, 109, 8, 17, 2); g.rect(292, 104, 4, 5, 15);
      jeff(g, 195, 137, state);
      if (state.inventory.includes('cart')) cart(g, 240, 156, state.inventory.includes('battery'));
      arrow(g, 21, 177, false); arrow(g, 303, 143, true);
    },

    costco_tire(g, state) {
      interior(g, 7, 8);
      g.rect(23, 26, 268, 16, 1);
      number(g, '89.99', 168, 31, 1, 14);
      for (const x of [37, 69, 101]) for (const y of [65, 85, 105]) {
        g.ellipse(x, y, 13, 12, 0); g.ellipse(x, y, 8, 7, 8); g.ellipse(x, y, 4, 4, 0);
        g.line(x - 10, y - 7, x - 5, y - 10, 7);
      }
      for (const y of [72, 105]) {
        g.rect(134, y + 13, 155, 4, 4);
        for (const x of [144, 178, 212, 246]) battery(g, x, y);
      }
      person(g, 211, 90, 0.9, { shirt: 1, elder: true });
      desk(g, 180, 143, 115, 4); paper(g, 262, 132, 23, 11);
      g.rect(281, 80, 17, 46, 4);
      for (let y = 85; y < 122; y += 10) g.rect(284, y, 10, 2, 7);
      jeff(g, 55, 135, state);
      if (state.inventory.includes('cart')) cart(g, 107, 158, state.inventory.includes('battery'));
      arrow(g, 20, 177, false);
    },

    costco_food(g, state) {
      interior(g, 7, 3);
      box(g, 23, 23, 274, 41, 1);
      for (const x of [110, 200]) g.line(x, 26, x, 59, 15);
      g.ellipse(52, 37, 20, 6, 14); g.rect(35, 35, 35, 4, 12); g.line(39, 35, 65, 37, 14);
      g.poly([[137, 29], [169, 43], [134, 44]], 14); g.rect(143, 35, 3, 3, 12); g.rect(152, 38, 3, 3, 12);
      g.rect(230, 35, 35, 5, 6); g.line(230, 35, 264, 35, 14);
      number(g, '1.50', 48, 50, 1, 15); number(g, '1.99', 145, 50, 1, 15); number(g, '1.00', 238, 50, 1, 15);
      person(g, 72, 77, 0.85, { shirt: 4, apron: true });
      desk(g, 23, 130, 137, 4); box(g, 118, 103, 28, 20, 7);
      g.rect(122, 106, 20, 8, 0); number(g, '1.50', 123, 108, 1, 10);
      desk(g, 235, 113, 66, 7);
      for (const [x, c] of [[245, 4], [262, 14], [279, 2]]) {
        g.rect(x, 97, 9, 10, c); g.rect(x + 3, 93, 3, 5, 15);
      }
      for (const [x, y] of [[229, 153], [283, 179]]) {
        g.rect(x - 2, y, 4, 23, 0); g.ellipse(x, y, 26, 9, 4);
        g.line(x - 16, y - 4, x + 12, y - 4, 12);
        g.ellipse(x - 25, y + 16, 9, 4, 4); g.ellipse(x + 25, y + 16, 9, 4, 4);
      }
      jeff(g, 165, 133, state); arrow(g, 20, 176, false); arrow(g, 304, 135, true);
    },
  };

  function title(g) {
    interior(g, 1, 8);
    g.dither(18, 15, 285, 108, 1, 0);
    windowView(g, 151, 19, 151, 94, true);
    box(g, 24, 24, 78, 30, 5); number(g, 'JEFF', 40, 31, 3, 14);
    clock(g, 246, 8, 21 * 60);
    person(g, 101, 47, 2.2, { hero: true });
    desk(g, 8, 159, 304, 6);
    monitor(g, 20, 86, 1.65); keyboard(g, 23, 150, 1.4);
    g.rect(193, 124, 89, 5, 0); g.line(198, 123, 267, 123, 7);
    g.line(199, 110, 199, 123, 0); g.line(273, 109, 273, 124, 0);
    paper(g, 209, 149, 43, 9); paper(g, 214, 139, 43, 9); paper(g, 218, 130, 43, 9);
    cup(g, 276, 142, 15);
    g.rect(117, 144, 14, 7, 14); g.rect(165, 144, 14, 7, 14);
    g.rect(18, 185, 284, 2, 9);
    for (let x = 28; x < 300; x += 11) g.rect(x, 191, 4, 1, 8);
  }

  function death(g) {
    g.rect(0, 0, 320, 200, 1);
    windowView(g, 218, 21, 78, 74, true);
    g.poly([[149, 20], [66, 180], [255, 180]], 8);
    g.rect(0, 180, 320, 20, 0);
    g.rect(145, 0, 2, 14, 7); g.ellipse(146, 17, 12, 4, 14);
    g.ellipse(158, 177, 64, 8, 0);
    g.ellipse(158, 87, 39, 34, 7); g.rect(119, 86, 79, 83, 7);
    g.rect(124, 88, 3, 76, 15); g.rect(191, 89, 4, 76, 8);
    for (const x of [137, 164]) { box(g, x, 89, 21, 14, 0); g.line(x + 4, 94, x + 16, 98, 7); }
    g.line(157, 94, 164, 94, 0);
    g.line(145, 119, 171, 119, 0);
    g.line(143, 135, 156, 148, 1); g.line(174, 135, 161, 148, 1);
    paper(g, 153, 146, 13, 16);
    plant(g, 65, 175, true); monitor(g, 239, 134, 1, 4);
    g.rect(111, 169, 96, 6, 8);
  }

  const roomScenes = Object.freeze(Object.keys(rooms));
  const scenes = Object.freeze(['title', ...roomScenes, 'death', 'ending']);

  function render(scene, state) {
    if (!scenes.includes(scene)) throw new Error('Unknown graphics scene: ' + scene);
    if (scene !== 'title' && (!state || !state.flags || !Array.isArray(state.inventory) || !Number.isFinite(state.minutes))) {
      throw new Error('A valid game state is required to paint ' + scene);
    }
    const g = new Picture();
    if (scene === 'title') title(g);
    else if (scene === 'death') death(g);
    else if (scene === 'ending') {
      living(g, state, true);
      windowView(g, 131, 22, 56, 26, true);
    } else rooms[scene](g, state);
    return g.pixels;
  }

  function draw(canvas, scene, state) {
    const pixels = render(scene, state);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create the EGA canvas; this browser does not support Canvas.');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx.imageSmoothingEnabled = false;
    const image = ctx.createImageData(WIDTH, HEIGHT);
    for (let i = 0; i < pixels.length; i++) {
      const color = rgb[pixels[i]];
      image.data[i * 4] = color[0];
      image.data[i * 4 + 1] = color[1];
      image.data[i * 4 + 2] = color[2];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  LSJ.Graphics = Object.freeze({ width: WIDTH, height: HEIGHT, palette, roomScenes, scenes, render, draw });
})();
