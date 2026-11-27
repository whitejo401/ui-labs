/* 슬라이드 생성기: 덱 JSON의 장 하나 → 배치 함수 → 도형 목록(1280×720) → SVG
   .pptx 출력은 slides-pptx.js가 같은 도형 목록을 읽는다
   도형: rect, ellipse, can, line, text. 색은 16진수, 글자 크기는 pt(SVG에서 4/3을 곱한다)
   UI.slide.layouts[id] = { slots, build(slide, theme) → { prims, errors } }
   UI.slide.diagrams[용어 id](data, box, theme) → { prims, errors } */
(function () {
  var UI = window.UI = window.UI || {};
  var S = UI.slide = {};
  S.W = 1280; S.H = 720;
  var PX = 4 / 3;                 // 1pt = 4/3 무대 단위(1/96인치)

  // 테마: 시안마다 하나. 글꼴은 Noto Sans KR 하나
  S.themes = {
    paper: {
      name: '도감 밝음', font: 'Noto Sans KR',
      bg: '#ffffff', ink: '#1d1f22', muted: '#6a6e74', line: '#e4e4df', panel: '#f4f4f1',
      accent: '#2f5d8a', accentSoft: '#e5edf5',
      sets: ['#2a78d6', '#eb6834', '#1baf7a'],
      c4: { person: '#22466b', main: '#2f5d8a', app: '#4a78a6', ext: '#6b7077' },   // 흰 글자와 대비 4.5:1 이상
      lh: 1.3,                    // 줄 간격(글자 크기의 배수). .pptx에도 같은 값을 pt로 적는다
      slack: 0.9                  // 제한 검사는 이 비율로 좁힌 폭으로 한다(맑은 고딕으로 바뀌어도 들어가게)
    },
    // 보고서: 블라인드 비교 2회차에서 이긴 꼴(화면으로 읽기). 머리말·한 줄 제목·짙은 결론 띠 틀, 흰 상자와 선, 강조색 하나
    report: {
      name: '보고서', font: 'Noto Sans KR',
      bg: '#ffffff', ink: '#111827', muted: '#4b5563', line: '#d9dee5', panel: '#f3f5f8',
      accent: '#1d4ed8', accentSoft: '#e6edfc', band: '#0f1e3d',
      sets: ['#6b7280', '#1d4ed8', '#b45309'],
      c4: { person: '#22466b', main: '#2f5d8a', app: '#4a78a6', ext: '#6b7077' },
      light: true,                // 상자를 흰 바탕과 선으로(looks)
      frame: { eyebrow: 11.25, title: 22.5 },   // 머리말 15px, 제목 30px 한 줄
      node: { name: 13.5, tech: 12, label: 12 }, // 상자 이름 18px, 기술·화살표 글 16px
      scale: 0.82,                // 벤 글자를 이만큼 줄인다
      head: 11,                   // 화살촉 길이(px). 없으면 선 굵기의 3배
      chart: '#8b93a1',           // 강조하지 않는 막대·선(회색)
      warn: '#b45309',            // 판 제목 tone: 'warn'(못 하는 것, 위험)
      body: 13.5,                 // 표·판·층 칸의 본문 값 18px(블라인드 9회차: 글자 크기는 2판이 낫다). 없으면 12(16px)
      lh: 1.3, slack: 0.9
    }
  };

  /* ───── 글자 폭 ───── */
  var ctx = null;
  function font(size, weight, fam) { return (weight || 400) + ' ' + (size * PX) + 'px "' + (fam || 'Noto Sans KR') + '"'; }
  // 기준 크기 150pt(200px)에서 재고 비례로 줄인다. 작은 크기에서 재면 브라우저가 글자 폭을 정수 픽셀로
  // 반올림해 PowerPoint와 크기마다 -1~+6% 어긋났다. 이렇게 재면 PowerPoint 16이 줄을 바꾸는 폭과
  // ±0.2% 안에서 맞는다(2026-11-25 보정 덱, 11~40pt, 400·700)
  var REF = 150;
  S.measure = function (text, size, weight, fam) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font(REF, weight, fam);
    return ctx.measureText(text).width * size / REF;
  };
  // 어절 단위로 줄을 나눈다. 한 어절이 폭보다 길면 글자 단위로 자른다(PowerPoint 16과 같은 방식)
  // 숫자와 단위(4,800만 원, 330시간 등) 사이 빈칸에서는 줄을 바꾸지 않는다(줄 안에서는 빈칸 그대로 보임)
  // .pptx에도 같은 묶음 빈칸(NBSP)을 넣어 PowerPoint가 그 자리에서 줄을 바꾸지 않게 한다
  var UNIT = /(\d[\d,.]*(?:만|억|천)?) (원|건|명|시간|초|주|개|장|점|배)/g;
  S.glue = function (text) { return String(text).replace(UNIT, '$1\u00a0$2'); };
  S.wrap = function (text, w, size, weight, fam) {
    var lines = [], cur = '';
    S.glue(text).split(/[ \t\n\r]+/).filter(Boolean).forEach(function (word) {
      var next = cur ? cur + ' ' + word : word;
      if (S.measure(next, size, weight, fam) <= w) { cur = next; return; }
      if (cur) lines.push(cur);
      cur = '';
      Array.from(word).forEach(function (ch) {
        if (cur && S.measure(cur + ch, size, weight, fam) > w) { lines.push(cur); cur = ''; }
        cur += ch;
      });
    });
    if (cur) lines.push(cur);
    return lines.map(function (l) { return l.replace(/\u00a0/g, ' '); });
  };
  // 글꼴 파일은 글자 범위별로 나뉘어 있어 쓰는 글자를 먼저 불러야 폭이 맞는다
  S.ready = function (deck, theme) {
    var texts = [];
    (function walk(v) {
      if (typeof v === 'string') texts.push(v);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(deck);
    var all = texts.join(' ') + '0123456789';
    var fam = (theme || S.themes.paper).font;
    return Promise.all([400, 500, 700].map(function (wt) { return document.fonts.load(font(20, wt, fam), all); }))
      .then(function () { return document.fonts.ready; });
  };

  /* ───── 글상자 하나를 만들고 줄 제한을 검사한다 ─────
     o: { x, y, w, text, size, weight, color, align, valign, max(줄), h(없으면 max 줄 높이) }
     errors에 { slot, msg }를 더한다 */
  S.textBox = function (o, theme, errors, slot) {
    var max = o.max || 1;
    var lines = S.wrap(o.text, o.w, o.size, o.weight, theme.font);
    var tight = S.wrap(o.text, o.w * theme.slack, o.size, o.weight, theme.font);
    if (tight.length > max) {
      var keep = tight.slice(0, max).join('').replace(/\s/g, '').length;
      var over = String(o.text).replace(/\s/g, '').length - keep;
      errors.push({ slot: slot, msg: max + '줄까지인데 ' + tight.length + '줄입니다(약 ' + over + '자 넘음)' });
    }
    var lhpx = o.size * theme.lh * PX;
    return {
      k: 'text', x: o.x, y: o.y, w: o.w, h: o.h || Math.ceil(max * lhpx), text: String(o.text), size: o.size, weight: o.weight || 400,
      color: o.color || theme.ink, align: o.align || 'left', valign: o.valign || 'top', lh: theme.lh, lines: lines, max: max,
      ph: o.ph, term: o.term, step: o.step
    };
  };
  // 개수 제한 검사
  function count(list, min, max, slot, errors) {
    var n = (list || []).length;
    if (n < min || n > max) errors.push({ slot: slot, msg: min + '~' + max + '개여야 하는데 ' + n + '개입니다' });
  }
  S.count = count;

  /* ───── 다이어그램 ───── */
  S.diagrams = {};

  // 벤: 집합 2~3개, 크기에 뜻 없음. 이름(한 줄)과 한 줄 설명은 겹치지 않는 쪽에, 겹침 글은 가운데
  S.diagrams['venn-diagram'] = function (d, box, th) {
    var errors = [], prims = [];
    var sets = d.sets || [];
    count(sets, 2, 3, 'sets', errors);
    if (sets.length < 2) return { prims: prims, errors: errors };
    var three = sets.length === 3;
    // 셋일 때 세 원을 합친 높이는 지름의 1.47배. 그 가운데가 상자 가운데에 오게 sy만큼 올린다
    // small(둘일 때): 겹침을 작게 그려 "겹치는 부분은 작다"는 주장과 맞춘다. 겹침 글은 원 위에 두고 선으로 가리킨다
    var sm = !three && d.small, top0 = sm ? 44 : 0;
    var D = three ? Math.min(box.h / 1.47, box.w / 1.9) : Math.min(box.h - top0, box.w / (sm ? 1.9 : 1.75));
    var R = D / 2, cx = box.x + box.w / 2, cy = box.y + top0 + (box.h - top0) / 2;
    var off = three ? R * 0.62 : R * (sm ? 0.9 : 0.68);     // 가운데에서 원 중심까지
    var sy = three ? -off * 0.25 : 0;
    var cs = three
      ? [[cx - off * 0.87, cy - off * 0.5 + sy], [cx + off * 0.87, cy - off * 0.5 + sy], [cx, cy + off + sy]]
      : [[cx - off, cy], [cx + off, cy]];
    // 이름을 놓을 자리: 원 중심에서 바깥쪽으로 민 곳
    var push = three ? 0.38 : 0.42;
    var lw = three ? R * 0.95 : R * 1.05;
    sets.slice(0, 3).forEach(function (s, i) {
      var c = cs[i], col = th.sets[i];
      prims.push({ k: 'ellipse', x: c[0] - R, y: c[1] - R, w: D, h: D, fill: col, alpha: 0.16, stroke: col, sw: 2.5, term: i ? undefined : 'venn-diagram', step: i });
      var dx = c[0] - cx, dy = c[1] - cy, len = Math.hypot(dx, dy) || 1;
      var px = c[0] + dx / len * R * push, py = c[1] + dy / len * R * push;
      var k = th.scale || 1, nameSize = (three ? 18 : 22) * k, oneSize = (three ? 13 : 15) * k;
      var nh = nameSize * th.lh * PX + (th.light ? 4 : 0), oh = s.one ? oneSize * th.lh * PX * 2 : 0;
      var top = py - (nh + oh) / 2;
      prims.push(S.textBox({ x: px - lw / 2, y: top, w: lw, text: s.name, size: nameSize, weight: 700, color: col, align: 'center', step: i }, th, errors, 'sets[' + i + '].name'));
      if (s.one) prims.push(S.textBox({ x: px - lw / 2, y: top + nh, w: lw, text: s.one, size: oneSize, color: th.ink, align: 'center', max: 2, step: i }, th, errors, 'sets[' + i + '].one'));
      if (s.tag) prims.push(S.textBox({ x: px - lw / 2, y: top + nh + oh + 8, w: lw, text: s.tag, size: oneSize, weight: 700, color: th.accent, align: 'center', step: i }, th, errors, 'sets[' + i + '].tag'));
    });
    if (d.overlap && sm) {
      var ly = cy - Math.sqrt(Math.max(0, R * R - off * off));   // 겹침 맨 위
      prims.push(S.textBox({ x: cx - box.w * 0.3, y: box.y, w: box.w * 0.6, h: 26, text: d.overlap, size: 12, color: th.ink, align: 'center', valign: 'middle', step: sets.length }, th, errors, 'overlap'));
      prims.push({ k: 'line', x1: cx, y1: box.y + 28, x2: cx, y2: ly + 6, stroke: th.muted, sw: 1.5, arrow: 'end', head: th.head, step: sets.length });
    } else if (d.overlap) {
      var ow = three ? R * 0.62 : (2 * R - 2 * off) * 0.86;
      var osz = (three ? 13 : 15) * (th.scale || 1);
      var ocy = cy + sy;
      var oh2 = osz * th.lh * PX * 3;
      prims.push(S.textBox({ x: cx - ow / 2, y: ocy - oh2 / 2, w: ow, h: oh2, text: d.overlap, size: osz, weight: 700, align: 'center', valign: 'middle', max: 3, step: sets.length }, th, errors, 'overlap'));
    }
    return { prims: prims, errors: errors };
  };

  // 층 구조: 위에서 아래로 층 3~5개. 위층이 바로 아래층만 부른다(층 사이 화살표)
  S.diagrams['layered-architecture-diagram'] = function (d, box, th) {
    var errors = [], prims = [];
    var layers = d.layers || [];
    count(layers, 3, 5, 'layers', errors);
    if (d.head) return layerTable(d, layers, box, th, errors);
    var n = Math.max(1, layers.length), gap = 30;
    var lh = (box.h - gap * (n - 1)) / n;
    var nameW = 300, pad = 28;
    layers.forEach(function (L, i) {
      var y = box.y + i * (lh + gap);
      prims.push({ k: 'rect', x: box.x, y: y, w: box.w, h: lh, r: 10, fill: i === 0 ? th.accentSoft : th.panel, stroke: th.line, sw: 1.5, term: i ? undefined : 'layered-architecture-diagram', step: i });
      prims.push({ k: 'rect', x: box.x, y: y, w: 8, h: lh, fill: th.accent, alpha: 1 - i / (n + 1), step: i });
      prims.push(S.textBox({ x: box.x + pad, y: y, w: nameW - pad, h: lh, text: L.name, size: 20, weight: 700, valign: 'middle', step: i }, th, errors, 'layers[' + i + '].name'));
      prims.push(S.textBox({ x: box.x + nameW, y: y, w: box.w - nameW - pad, h: lh, text: L.one || '', size: 16, color: th.muted, valign: 'middle', max: lh > 90 ? 2 : 1, step: i }, th, errors, 'layers[' + i + '].one'));
      if (i < n - 1) {
        var ax = box.x + nameW / 2;
        prims.push({ k: 'line', x1: ax, y1: y + lh + 4, x2: ax, y2: y + lh + gap - 4, stroke: th.muted, sw: 2, arrow: 'end', step: i + 1 });
      }
    });
    return { prims: prims, errors: errors };
  };

  // 층 구조 표: 층마다 한 줄, 칸은 head(첫 칸은 층 이름). 층 사이 화살표 옆에 call(부르는 방식). mark면 강조 줄
  // { head: ['층', '하는 일', ...], widths: [비율...], call, layers: [{ name, cells: [...], mark }] }
  function layerTable(d, layers, box, th, errors) {
    // card: 마지막 열을 줄 바탕 밖 따로 흰 카드로(강조 층은 강조 카드, 가운데 굵은 글)
    var prims = [], n = Math.max(1, layers.length), hh = 30, gap = 28, pad = 20, cg = d.card ? 16 : 0, last = d.head.length - 1;
    var ws = d.widths || d.head.map(function () { return 1; }), tot = ws.reduce(function (a, b) { return a + b; }, 0), xs = [box.x];
    ws.forEach(function (v) { xs.push(xs[xs.length - 1] + box.w * v / tot); });
    var rh = (box.h - hh - gap * (n - 1)) / n;
    d.head.forEach(function (t, j) { prims.push(S.textBox({ x: xs[j] + pad, y: box.y, w: xs[j + 1] - xs[j] - 2 * pad, h: hh, text: t, size: 12, color: th.muted, valign: 'middle' }, th, errors, 'head[' + j + ']')); });
    layers.forEach(function (L, i) {
      var y = box.y + hh + i * (rh + gap), sl = 'layers[' + i + ']';
      prims.push({ k: 'rect', x: box.x, y: y, w: (d.card ? xs[last] - cg : box.x + box.w) - box.x, h: rh, r: 6, fill: L.mark ? th.accentSoft : th.panel, stroke: L.mark ? th.accent : undefined, sw: 1.5, step: i, term: i ? undefined : 'layered-architecture-diagram' });
      if (d.card) prims.push({ k: 'rect', x: xs[last], y: y, w: xs[last + 1] - xs[last], h: rh, r: 6, fill: L.mark ? th.accentSoft : th.bg, stroke: L.mark ? th.accent : th.line, sw: L.mark ? 1.5 : 1, step: i });
      [L.name].concat(L.cells || []).forEach(function (t, j) {
        if (j >= d.head.length) return;
        var cd = d.card && j === last;
        prims.push(S.textBox({ x: xs[j] + pad - (cd ? cg : 0), y: y, w: xs[j + 1] - xs[j] - 2 * pad + (cd ? cg : 0), h: rh, text: t, size: j ? th.body || 12 : 13.5, weight: !j || (cd && L.mark) ? 700 : 400, color: L.mark && j === last ? th.accent : cd ? th.muted : th.ink, align: cd ? 'center' : undefined, valign: 'middle', max: j ? 2 : 1, step: i }, th, errors, j ? sl + '.cells[' + (j - 1) + ']' : sl + '.name'));
      });
      if (i < n - 1) {
        var ax = box.x + 40;
        prims.push({ k: 'line', x1: ax, y1: y + rh + 3, x2: ax, y2: y + rh + gap - 3, stroke: th.muted, sw: 1.5, arrow: 'end', head: th.head, step: i + 1 });
        if (d.call) prims.push(S.textBox({ x: ax + 12, y: y + rh, w: 400, h: gap, text: d.call, size: 12, color: th.muted, valign: 'middle', step: i + 1 }, th, errors, 'call'));
      }
    });
    return { prims: prims, errors: errors };
  }

  /* ───── 상자·화살표·범례 공통 ─────
     상자 꼴(look): plain 보통, mark 강조(점선 테두리), main C4 내 시스템, app C4 컨테이너, store 저장소(원통), ext 바깥 시스템, person 사람 */
  function looks(th) {
    var c = th.c4;
    if (th.light) return {
      plain: { fill: th.bg, stroke: th.line, ink: th.ink, sub: th.muted },
      mark: { fill: th.accentSoft, stroke: th.accent, ink: th.ink, sub: th.muted },
      main: { fill: th.accentSoft, stroke: th.accent, ink: th.ink, sub: th.muted },
      app: { fill: th.bg, stroke: th.accent, ink: th.ink, sub: th.muted },
      store: { fill: th.panel, stroke: th.muted, ink: th.ink, sub: th.muted },
      ext: { fill: th.panel, stroke: th.line, ink: th.ink, sub: th.muted },
      person: { fill: th.bg, stroke: th.ink, ink: th.ink, sub: th.muted }
    };
    return {
      plain: { fill: th.panel, stroke: th.line, ink: th.ink, sub: th.muted },
      mark: { fill: th.accentSoft, stroke: th.accent, ink: th.ink, sub: th.muted, dash: true },
      main: { fill: c.main, stroke: c.main, ink: '#ffffff', sub: '#ffffff' },
      app: { fill: c.app, stroke: c.app, ink: '#ffffff', sub: '#ffffff' },
      store: { fill: c.app, stroke: c.app, ink: '#ffffff', sub: '#ffffff' },
      ext: { fill: c.ext, stroke: c.ext, ink: '#ffffff', sub: '#ffffff' },
      person: { fill: c.person, stroke: c.person, ink: '#ffffff', sub: '#ffffff' }
    };
  }
  // 글상자의 높이를 예측한 줄 수에 맞춘다(세로 가운데 맞춤을 손으로 할 때)
  function fitH(p, th) { p.h = Math.ceil(Math.max(1, p.lines.length) * p.size * th.lh * PX); return p; }
  // 자리를 잡은 뒤 상자 높이를 최대 줄 수로 늘린다. 맑은 고딕으로 바뀌어 줄이 늘어도 상자 안에 든다
  function roomy(list, th) { list.forEach(function (p) { p.h = Math.max(p.h, Math.ceil(p.max * p.size * th.lh * PX)); }); return list; }
  // 상자 하나: 이름(한 줄), [기술](한 줄), 설명(두 줄)을 세로 가운데에 쌓는다
  function nodeBox(n, x, y, w, h, th, errors, slot, step, term) {
    var lk = looks(th)[n.look || 'plain'] || looks(th).plain, prims = [], top = y, pad = 12;
    if (n.look === 'store' || n.can) {
      prims.push({ k: 'can', x: x, y: y, w: w, h: h, fill: lk.fill, stroke: lk.stroke, sw: 1.5, step: step, term: term });
      top = y + Math.min(w, h) / 4;
    } else {
      prims.push({ k: 'rect', x: x, y: y, w: w, h: h, r: n.look === 'person' ? 22 : 8, fill: lk.fill, stroke: lk.stroke, sw: lk.dash ? 2 : 1.5, dash: lk.dash, step: step, term: term });
      if (n.look === 'person' && !th.light) { prims.push({ k: 'ellipse', x: x + w / 2 - 16, y: y - 26, w: 32, h: 32, fill: lk.fill, stroke: th.bg, sw: 3, step: step }); top = y + 6; }
    }
    var ns = th.node || { name: 16, tech: 11 };
    var parts = [S.textBox({ x: x + pad, y: 0, w: w - 2 * pad, text: n.name, size: ns.name, weight: 700, color: lk.ink, align: 'center', step: step }, th, errors, slot + '.name')];
    if (n.tech) parts.push(S.textBox({ x: x + pad, y: 0, w: w - 2 * pad, text: '[' + n.tech + ']', size: ns.tech, color: lk.sub, align: 'center', step: step }, th, errors, slot + '.tech'));
    if (n.one) parts.push(S.textBox({ x: x + pad, y: 0, w: w - 2 * pad, text: n.one, size: 12, color: lk.sub, align: 'center', max: 2, step: step }, th, errors, slot + '.one'));
    // 세로 가운데는 최대 줄 수로 잡는다. 글꼴이 바뀌어 설명이 두 줄이 돼도 상자 안에 든다
    var total = roomy(parts.map(function (p) { p.h = 0; return p; }), th).reduce(function (a, p) { return a + p.h; }, 0) + 2 * (parts.length - 1), cy = top + (y + h - top - total) / 2;
    if (n.parts) cy = top + 16;     // 안쪽 줄이 있으면 이름은 위에 붙인다
    parts.forEach(function (p) { p.y = cy; cy += p.h + 2; prims.push(p); });
    // 안쪽 구성 요소: 이름(왼쪽)과 기술(오른쪽) 한 줄씩 흰 칸에. 칸은 남은 높이를 나눠 채운다(칸 높이 40~58)
    var np = (n.parts || []).length, pg = np ? Math.max(48, Math.min(66, (y + h - 16 - cy - 14 + 8) / np)) : 0, ph = pg - 8;
    (n.parts || []).forEach(function (q, i) {
      var ry = cy + 14 + i * pg, sl = slot + '.parts[' + i + ']';
      prims.push({ k: 'rect', x: x + 16, y: ry, w: w - 32, h: ph, r: 4, fill: th.bg, stroke: th.line, sw: 1, step: step });
      prims.push(S.textBox({ x: x + 28, y: ry, w: (w - 56) * 0.63, h: ph, text: q.name, size: 12, valign: 'middle' }, th, errors, sl + '.name'));
      if (q.tech) prims.push(S.textBox({ x: x + 28 + (w - 56) * 0.63, y: ry, w: (w - 56) * 0.37, h: ph, text: q.tech, size: 12, color: th.muted, align: 'right', valign: 'middle' }, th, errors, sl + '.tech'));
    });
    return prims;
  }
  // 화살표 글: 선 가운데에 바탕색 띠를 깔고 얹는다. above면 선 위, 'below'면 선 아래에 놓는다
  function linkLabel(text, mx, my, w, above, th, errors, slot, step) {
    var ls = th.node ? th.node.label : 11;
    var p = fitH(S.textBox({ x: mx - w / 2, y: 0, w: w, text: text, size: ls, color: th.muted, align: 'center', max: 2, step: step }, th, errors, slot), th);
    p.y = above === 'below' ? my + 6 : above ? my - 6 - p.h : my - p.h / 2;
    var lw = Math.min(w, Math.max.apply(null, p.lines.map(function (l) { return S.measure(l, ls, 400, th.font); }))) + 12;
    return [{ k: 'rect', x: mx - lw / 2, y: p.y - 2, w: lw, h: p.h + 4, fill: th.bg, step: step }, roomy([p], th)[0]];
  }
  // 상자 중심에서 상대 쪽으로 그은 선이 상자 테두리(+틈)와 만나는 점
  function edge(c, o, hw, hh) {
    var dx = o[0] - c[0], dy = o[1] - c[1];
    var s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [c[0] + dx * s, c[1] + dy * s];
  }
  // 격자 배치: 상자마다 col·row(소수 가능)를 받아 칸 가운데에 놓고, 이름으로 이은 화살표를 긋는다
  // o: { w, h(상자 최대), gapX, gapY, slot, linkSlot, term, horiz(가로로만 잇기), flush(첫·끝 열을 상자 영역 양끝에 붙임) }
  // 상자 칸 w(폭, 없으면 공통), 화살표 칸 loop(상자 아래로 돌아 잇기), below(글을 선 아래에)
  function graph(nodes, links, box, th, errors, o) {
    var prims = [], pos = {}, cols = 1, rows = 1;
    nodes.forEach(function (n) { cols = Math.max(cols, Math.ceil((n.col || 0) + 1)); rows = Math.max(rows, Math.ceil((n.row || 0) + (n.span || 1))); });
    var cw = box.w / cols, ch = box.h / rows;
    // colw: 열마다 너비 비율(넓은 상자가 있는 열을 넓게). 없으면 같은 너비
    var cx0 = null;
    if (o.colw) { var ct = o.colw.reduce(function (a, b) { return a + b; }, 0), acc = 0; cx0 = o.colw.map(function (v) { var c = box.x + (acc + v / 2) / ct * box.w; acc += v; return c; }); }
    var w = Math.min(cw - (o.gapX || 90), o.w || 260), h = Math.min(ch - (o.gapY || 70), o.h || 110);
    nodes.forEach(function (n, i) {
      var nh = n.span ? n.span * ch - (o.gapY || 70) : h, nw = n.w || w;
      var cx = cx0 ? cx0[n.col || 0] : box.x + ((n.col || 0) + 0.5) * cw, cy = box.y + ((n.row || 0) + (n.span || 1) / 2) * ch;
      if (o.flush && !n.col) cx = box.x + nw / 2; else if (o.flush && n.col === cols - 1) cx = box.x + box.w - nw / 2;
      pos[n.name] = { cx: cx, cy: cy, i: i, x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh, look: n.look };
      prims = prims.concat(nodeBox(n, cx - nw / 2, cy - nh / 2, nw, nh, th, errors, o.slot + '[' + i + ']', i, i ? undefined : o.term));
    });
    // 화살표는 직각으로만 꺾는다. 같은 줄이면 가로 직선, 줄이 겹치지 않으면 세로-가로-세로, 아니면 가로-세로-가로
    var L = [], side = {};
    (links || []).forEach(function (l, i) {
      var a = pos[l.from], b = pos[l.to], slot = (o.linkSlot || 'links') + '[' + i + ']';
      if (!a || !b) { errors.push({ slot: slot, msg: '없는 상자 이름: ' + (a ? l.to : l.from) }); return; }
      if (l.loop) {
        // 두 상자 아래로 내려가 가로로 건너 올라간다. 글은 가로 선 위
        var ly = Math.max(a.y + a.h, b.y + b.h) + 34, st = Math.max(a.i, b.i), lp = [[a.cx, a.y + a.h + 8], [a.cx, ly], [b.cx, ly], [b.cx, b.y + b.h + 8]];
        for (var j = 0; j < 3; j++) prims.push({ k: 'line', x1: lp[j][0], y1: lp[j][1], x2: lp[j + 1][0] + (j < 2 ? Math.sign(lp[j + 1][0] - lp[j][0]) : 0), y2: lp[j + 1][1] + (j < 2 ? Math.sign(lp[j + 1][1] - lp[j][1]) : 0), stroke: th.muted, sw: 2, dash: l.dash, arrow: j === 2 ? 'end' : undefined, head: th.head, step: st });
        if (l.label) prims = prims.concat(linkLabel(l.label, (a.cx + b.cx) / 2, ly, 300, true, th, errors, slot + '.label', st).slice(1));
        return;
      }
      var v = !o.horiz && Math.abs(a.cy - b.cy) >= 1 && (a.y + a.h <= b.y || b.y + b.h <= a.y);
      var q = { l: l, a: a, b: b, slot: slot, v: v, flat: Math.abs(a.cy - b.cy) < 1 };
      q.sa = v ? (b.cy > a.cy ? 'b' : 't') : (b.cx > a.cx ? 'r' : 'l');
      q.sb = { b: 't', t: 'b', r: 'l', l: 'r' }[q.sa];
      [[a, q.sa, b], [b, q.sb, a]].forEach(function (e) { var k = e[0].i + e[1]; (side[k] = side[k] || []).push({ q: q, other: e[2], me: e[0] === a }); });
      L.push(q);
    });
    // 한 변에 닿는 선이 여럿이면 닿는 점을 변 길이의 k/(N+1)에 나눠 둔다(상대 상자 순서대로, 선끼리 겹치지 않게)
    Object.keys(side).forEach(function (k) {
      var list = side[k], s = k.slice(-1), tb = s === 't' || s === 'b';
      list.sort(function (m, n) { return tb ? m.other.cx - n.other.cx : m.other.cy - n.other.cy; });
      list.forEach(function (e, j) {
        var n = e.me ? e.q.a : e.q.b, t = list.length > 1 ? (j + 1) / (list.length + 1) : 0.5;
        e.q[e.me ? 'ta' : 'tb'] = tb ? n.x + n.w * t : n.y + n.h * t;
        e.q[e.me ? 'na' : 'nb'] = list.length;
      });
    });
    L.forEach(function (q) {
      var a = q.a, b = q.b, l = q.l, step = Math.max(a.i, b.i), pts, mid;
      // 같은 높이라도 밝은 테마에서 두 변 모두 선이 여럿이면(왕복 화살표 등) 나눠 둔 점으로 긋는다
      if (q.flat && !(th.light && q.na > 1 && q.nb > 1)) {
        var p1 = edge([a.cx, a.cy], [b.cx, b.cy], a.w / 2 + 8, a.h / 2 + 8), p2 = edge([b.cx, b.cy], [a.cx, a.cy], b.w / 2 + 8, b.h / 2 + 8);
        prims.push({ k: 'line', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: th.muted, sw: 2, dash: l.dash, arrow: 'end', head: th.head, step: step });
        if (l.label) prims = prims.concat(linkLabel(l.label, (p1[0] + p2[0]) / 2, p1[1], Math.abs(p2[0] - p1[0]) - 4, l.below ? 'below' : true, th, errors, q.slot + '.label', step));
        return;
      }
      var ta = q.ta, tb = q.tb;
      // 곧게 닿을 수 있으면 꺾지 않는다: 한쪽 끝이 상대 변 위에 있거나, 두 상자가 겹치는 폭 안에서 긋는다
      function straight(lo, hi) {
        var s = Math.max(lo[0], hi[0]) + 16, e = Math.min(lo[1], hi[1]) - 16;
        if (q.nb === 1 && ta >= hi[0] + 16 && ta <= hi[1] - 16) tb = ta; else if (q.na === 1 && tb >= lo[0] + 16 && tb <= lo[1] - 16) ta = tb;
        // 겹치는 폭 안에서는 작은 상자 쪽에 나눠 둔 점을 쓴다(큰 상자 쪽 점은 잘려 서로 겹칠 수 있다)
        else if (s <= e) ta = tb = Math.min(e, Math.max(s, q.nb > 1 && (q.na === 1 || (hi[1] - hi[0]) <= (lo[1] - lo[0])) ? tb : ta));
      }
      if (q.v) {
        straight([a.x, a.x + a.w], [b.x, b.x + b.w]);
        var gap = function (n, s) { return s === 't' && n.look === 'person' && !th.light ? 30 : 8; };
        var y1 = q.sa === 'b' ? a.y + a.h + gap(a, 'b') : a.y - gap(a, 't'), y2 = q.sb === 't' ? b.y - gap(b, 't') : b.y + b.h + gap(b, 'b'), my = (y1 + y2) / 2;
        pts = Math.abs(ta - tb) < 1 ? [[ta, y1], [ta, y2]] : [[ta, y1], [ta, my], [tb, my], [tb, y2]];
      } else {
        straight([a.y, a.y + a.h], [b.y, b.y + b.h]);
        var x1 = q.sa === 'r' ? a.x + a.w + 8 : a.x - 8, x2 = q.sb === 'l' ? b.x - 8 : b.x + b.w + 8, mx = (x1 + x2) / 2;
        pts = Math.abs(ta - tb) < 1 ? [[x1, ta], [x2, ta]] : [[x1, ta], [mx, ta], [mx, tb], [x2, tb]];
      }
      // 꺾이는 곳은 앞 선을 굵기 절반만큼 늘려 바깥 모서리 홈을 메운다. 화살촉은 마지막 선에만
      for (var j = 0; j < pts.length - 1; j++) {
        var s0 = pts[j], s1 = pts[j + 1], last = j === pts.length - 2, ex = last ? 0 : 1;
        var ux = Math.sign(s1[0] - s0[0]), uy = Math.sign(s1[1] - s0[1]);
        prims.push({ k: 'line', x1: s0[0], y1: s0[1], x2: s1[0] + ux * ex, y2: s1[1] + uy * ex, stroke: th.muted, sw: 2, dash: l.dash, arrow: last ? 'end' : undefined, head: th.head, step: step });
      }
      // 글은 가운데 선분 위에 바탕색 띠를 깔고 얹는다
      // 밝은 테마에서 곧은 가로선이면 선을 끊지 않고 위(below면 아래)에 놓는다
      mid = pts.length === 2 ? [pts[0], pts[1]] : [pts[1], pts[2]];
      var flatOn = th.light && pts.length === 2 && !q.v, lw2 = flatOn ? Math.abs(pts[1][0] - pts[0][0]) - 8 : 170;
      if (l.label) prims = prims.concat(linkLabel(l.label, (mid[0][0] + mid[1][0]) / 2, (mid[0][1] + mid[1][1]) / 2, lw2, flatOn ? (l.below ? 'below' : true) : false, th, errors, q.slot + '.label', step));
    });
    return { prims: prims, pos: pos };
  }
  // 범례: 오른쪽 끝(right)에 맞춰 가로로 늘어놓는다. items [{look, name}] 또는 [{line: 'dash', name}]
  function legend(items, right, y, th, errors, slot, step) {
    var prims = [], lk = looks(th), x = 0, parts = [];
    items.forEach(function (it, i) {
      var tw = Math.min(260, S.measure(it.name, 12, 400, th.font) / th.slack + 4);
      parts.push({ it: it, tw: tw, x: x }); x += 34 + tw + 24;
    });
    var w = x - 24 + 28, x0 = right - w;
    prims.push({ k: 'rect', x: x0, y: y, w: w, h: 40, r: 6, fill: th.bg, stroke: th.line, sw: 1, step: step, term: 'legend' });
    parts.forEach(function (q, i) {
      var sx = x0 + 14 + q.x, it = q.it, l = lk[it.look] || lk.plain;
      if (it.line) prims.push({ k: 'line', x1: sx, y1: y + 20, x2: sx + 28, y2: y + 20, stroke: th.muted, sw: 2, dash: it.line === 'dash', arrow: 'end', step: step });
      else if (it.look === 'store') prims.push({ k: 'can', x: sx + 6, y: y + 8, w: 18, h: 24, fill: l.fill, stroke: l.stroke, sw: 1, step: step });
      else prims.push({ k: 'rect', x: sx, y: y + 10, w: 28, h: 20, r: it.look === 'person' ? 10 : 4, fill: l.fill, stroke: l.stroke, sw: l.dash ? 1.5 : 1, dash: l.dash, step: step });
      prims.push(S.textBox({ x: sx + 34, y: y + 10, w: q.tw, text: it.name, size: 12, color: th.ink, step: step }, th, errors, slot + '[' + i + ']'));
    });
    return prims;
  }

  // 오일러: 존재하는 관계만 그린다. 바깥 집합 하나 안에 겹치지 않는 안쪽 집합 1~2개, 떨어진 집합 하나(없어도 됨)
  S.diagrams['euler-diagram'] = function (d, box, th) {
    var errors = [], prims = [], inner = d.inner || [];
    count(inner, 1, 2, 'inner', errors);
    if (!d.outer) { errors.push({ slot: 'outer', msg: '바깥 집합이 없습니다' }); return { prims: prims, errors: errors }; }
    var Do = Math.min(box.h, box.w * 0.6), Ro = Do / 2, Ra = Ro * 0.5, gap = 70;
    var total = Do + (d.apart ? gap + 2 * Ra : 0), ox = box.x + (box.w - total) / 2 + Ro, oy = box.y + box.h / 2;
    var col = th.sets;
    prims.push({ k: 'ellipse', x: ox - Ro, y: oy - Ro, w: Do, h: Do, fill: col[0], alpha: 0.1, stroke: col[0], sw: 2.5, step: 0, term: 'euler-diagram' });
    prims.push(S.textBox({ x: ox - Ro * 0.6, y: oy - Ro * 0.74, w: Ro * 1.2, text: d.outer.name, size: 20, weight: 700, color: col[0], align: 'center', step: 0 }, th, errors, 'outer.name'));
    if (d.outer.one) prims.push(S.textBox({ x: ox - Ro * 0.6, y: oy - Ro * 0.74 + 36, w: Ro * 1.2, text: d.outer.one, size: 13, color: th.ink, align: 'center', step: 0 }, th, errors, 'outer.one'));
    var Ri = Ro * 0.42, two = inner.length === 2;
    inner.slice(0, 2).forEach(function (s, i) {
      var cx = ox + (two ? (i ? 1 : -1) * Ri * 1.1 : 0), cy = oy + Ro * 0.25;
      prims.push({ k: 'ellipse', x: cx - Ri, y: cy - Ri, w: 2 * Ri, h: 2 * Ri, fill: col[1], alpha: 0.16, stroke: col[1], sw: 2.5, step: 1 });
      prims = prims.concat(circleText(s, cx, cy, Ri, col[1], th, errors, 'inner[' + i + ']', 1));
    });
    if (d.apart) {
      var ax = ox + Ro + gap + Ra;
      prims.push({ k: 'ellipse', x: ax - Ra, y: oy - Ra, w: 2 * Ra, h: 2 * Ra, fill: col[2], alpha: 0.16, stroke: col[2], sw: 2.5, step: 2 });
      prims = prims.concat(circleText(d.apart, ax, oy, Ra, col[2], th, errors, 'apart', 2));
    }
    return { prims: prims, errors: errors };
  };
  // 원 안 가운데에 이름(한 줄)과 설명(두 줄)
  function circleText(s, cx, cy, R, color, th, errors, slot, step) {
    var w = R * 1.5, a = fitH(S.textBox({ x: cx - w / 2, y: 0, w: w, text: s.name, size: 16, weight: 700, color: color, align: 'center', step: step }, th, errors, slot + '.name'), th);
    var b = s.one ? fitH(S.textBox({ x: cx - w / 2, y: 0, w: w, text: s.one, size: 12, color: th.ink, align: 'center', max: 2, step: step }, th, errors, slot + '.one'), th) : null;
    var tot = a.h + (b ? b.h + 4 : 0);
    a.y = cy - tot / 2; if (b) b.y = a.y + a.h + 4;
    return roomy(b ? [a, b] : [a], th);
  }

  // 상자와 화살표: 정해진 기호 규칙이 없으니 꼴마다 뜻을 범례로 밝힌다
  // { boxes: [{ name, one, col, row, look: plain|mark }], arrows: [{ from, to, label, dash, loop }], legend: [{ look, name }], gapX(상자 사이, 없으면 80) }
  S.diagrams['box-and-arrow-diagram'] = function (d, box, th) {
    var errors = [], boxes = d.boxes || [];
    count(boxes, 2, 8, 'boxes', errors);
    var area = d.legend ? { x: box.x, y: box.y, w: box.w, h: box.h - 52 } : box, loop = (d.arrows || []).some(function (a) { return a.loop; });
    if (loop) area = { x: area.x, y: area.y, w: area.w, h: area.h - 44 };   // 아래로 도는 화살표 자리
    var g = graph(boxes, d.arrows, area, th, errors, { slot: 'boxes', linkSlot: 'arrows', term: 'box-and-arrow-diagram', w: 220, h: 104, gapX: d.gapX || 80, gapY: loop ? 16 : undefined, colw: d.colw });
    var prims = g.prims;
    if (d.legend) prims = prims.concat(legend(d.legend, box.x + box.w, box.y + box.h - 40, th, errors, 'legend', boxes.length));
    return { prims: prims, errors: errors };
  };

  // C4 1단계 System Context: 위에 사람, 가운데 내 시스템 하나, 아래에 바깥 시스템. 화살표마다 하는 일을 적는다
  // { people: [{ name, one, uses, back }], system: { name, one }, externals: [{ name, one, rel, back, in, can }] }
  // back은 거꾸로 돌아오는 화살표 글, in이면 바깥에서 들어오는 쪽, can이면 원통(저장소). dir: 'lr'이면 열 이름(사람, 바깥 시스템)을 위에
  S.diagrams['c4-system-context'] = function (d, box, th) {
    var errors = [], people = d.people || [], ext = d.externals || [];
    count(people, 1, 3, 'people', errors); count(ext, 1, 4, 'externals', errors);
    if (!d.system) { errors.push({ slot: 'system', msg: '내 시스템이 없습니다' }); return { prims: [], errors: errors }; }
    var cols = Math.max(people.length, ext.length, 1), nodes = [], links = [], lr = d.dir === 'lr';
    // lr: 사람은 왼쪽 열, 내 시스템은 가운데 열을 세로로 다 차지(parts로 안쪽 구성 요소), 바깥 시스템은 오른쪽 열
    function row(list, r, look, tech) { list.forEach(function (n, i) { nodes.push(lr ? { name: n.name, one: n.one, look: look, can: n.can, w: 230, col: r, row: (cols - list.length) / 2 + i } : { name: n.name, one: n.one, tech: tech, look: look, row: r, col: (cols - list.length) / 2 + i }); }); }
    row(people, 0, 'person', '사람');
    nodes.push(lr ? { name: d.system.name, one: d.system.one, look: 'main', col: 1, row: 0, span: cols, parts: d.system.parts, w: 340 }
      : { name: d.system.name, one: d.system.one, tech: '소프트웨어 시스템', look: 'main', row: 1, col: (cols - 1) / 2 });
    row(ext, 2, 'ext', '바깥 시스템');
    // 화살표 칸 이름(오류를 입력 칸 기준으로 알린다)
    var lslot = [];
    people.forEach(function (p, i) { links.push({ from: p.name, to: d.system.name, label: p.uses }); lslot.push('people[' + i + '].uses'); });
    ext.forEach(function (x, i) { links.push(x.in ? { from: x.name, to: d.system.name, label: x.rel } : { from: d.system.name, to: x.name, label: x.rel }); lslot.push('externals[' + i + '].rel'); });
    people.concat(ext).forEach(function (n, i) {
      if (!n.back) return;
      var f = i < people.length || n.in ? d.system.name : n.name, t = f === n.name ? d.system.name : n.name;
      links.push({ from: f, to: t, label: n.back, below: true }); lslot.push((i < people.length ? 'people[' + i : 'externals[' + (i - people.length)) + '].back');
    });
    var prims = [], area = box;
    if (lr) {
      [['사람', 0], ['바깥 시스템', 1]].forEach(function (h) { prims.push(S.textBox({ x: h[1] ? box.x + box.w - 230 : box.x, y: box.y, w: 230, text: h[0], size: 12, color: th.muted, step: 0 }, th, errors, 'head')); });
      area = { x: box.x, y: box.y + 28, w: box.w, h: box.h - 28 };
    }
    var g = lr ? graph(nodes, links, area, th, errors, { slot: 'nodes', term: 'c4-system-context', w: 230, h: 100, gapX: 120, gapY: 24, horiz: true, flush: true })
      : graph(nodes, links, { x: box.x, y: box.y + 16, w: box.w, h: box.h - 16 }, th, errors, { slot: 'nodes', term: 'c4-system-context', w: 250, h: 104, gapX: 60, gapY: 40 });
    // 칸 이름을 입력 칸 기준으로 고친다(people[0], system, externals[1])
    errors.forEach(function (e) {
      e.slot = e.slot.replace(/^nodes\[(\d+)\]/, function (m, k) { k = +k; return k < people.length ? 'people[' + k + ']' : k === people.length ? 'system' : 'externals[' + (k - people.length - 1) + ']'; })
        .replace(/^links\[(\d+)\]\.label$/, function (m, k) { return lslot[+k]; });
    });
    return { prims: prims.concat(g.prims), errors: errors };
  };

  // C4 2단계 Container: 내 시스템 경계(점선) 안의 앱·저장소와 바깥 시스템. 범례는 쓰인 꼴만
  // { system, nodes: [{ name, tech, one, look: app|store|ext|person, col, row }], links: [{ from, to, label }] }
  var LEGEND_NAME = { app: '앱·서버', store: '데이터 저장소', ext: '바깥 시스템', person: '사람' };
  S.diagrams['c4-container'] = function (d, box, th) {
    var errors = [], nodes = d.nodes || [], prims = [];
    count(nodes, 3, 8, 'nodes', errors);
    var area = { x: box.x, y: box.y, w: box.w, h: box.h - 52 };
    var g = graph(nodes, d.links, area, th, errors, { slot: 'nodes', term: 'c4-container', w: 250, h: 108, gapX: 110, gapY: 92 });
    // 경계: 안쪽 상자를 모두 감싸고 아래에 시스템 이름
    var ins = Object.keys(g.pos).map(function (k) { return g.pos[k]; }).filter(function (p) { return p.look === 'app' || p.look === 'store'; });
    if (ins.length && d.system) {
      var x1 = Math.min.apply(null, ins.map(function (p) { return p.x; })) - 22, y1 = Math.min.apply(null, ins.map(function (p) { return p.y; })) - 22;
      var x2 = Math.max.apply(null, ins.map(function (p) { return p.x + p.w; })) + 22, y2 = Math.max.apply(null, ins.map(function (p) { return p.y + p.h; })) + 40;
      prims.push({ k: 'rect', x: x1, y: y1, w: x2 - x1, h: y2 - y1, r: 6, stroke: th.muted, sw: 1.5, dash: true, step: 0 });
      prims.push(S.textBox({ x: x1 + 14, y: y2 - 30, w: x2 - x1 - 28, text: d.system + ' [소프트웨어 시스템]', size: 12, weight: 700, color: th.muted, step: 0 }, th, errors, 'system'));
    }
    prims = prims.concat(g.prims);
    var seen = [];
    nodes.forEach(function (n) { if (LEGEND_NAME[n.look] && seen.indexOf(n.look) < 0) seen.push(n.look); });
    if (d.legend !== false) prims = prims.concat(legend(seen.map(function (k) { return { look: k, name: LEGEND_NAME[k] }; }), box.x + box.w, box.y + box.h - 40, th, errors, 'legend', nodes.length));
    return { prims: prims, errors: errors };
  };

  // 파이프라인: 단계 3~6개를 왼쪽에서 오른쪽으로, 끝에 결과가 쌓이는 저장소(원통). 설명은 상자 아래
  // { steps: [{ name, one, mark }], store: { name, one } }. 밝은 테마는 설명을 상자 안에 넣고 mark인 단계만 강조한다
  S.diagrams['pipeline-diagram'] = function (d, box, th) {
    var errors = [], prims = [], steps = d.steps || [];
    count(steps, 3, 6, 'steps', errors);
    var all = steps.concat(d.store ? [d.store] : []), n = Math.max(1, all.length), gap = 52;
    if (th.light) {
      var lw = (box.w - gap * (n - 1)) / n, lh = Math.min(box.h, 112), ly = box.y + (box.h - lh) / 2;
      all.forEach(function (s, i) {
        var x = box.x + i * (lw + gap), last = d.store && i === n - 1, slot = last ? 'store' : 'steps[' + i + ']';
        prims = prims.concat(nodeBox({ name: s.name, one: s.one, look: last ? 'store' : s.mark ? 'mark' : 'plain', can: last }, x, ly, lw, lh, th, errors, slot, i, i ? undefined : 'pipeline-diagram'));
        if (i < n - 1) prims.push({ k: 'line', x1: x + lw + 6, y1: ly + lh / 2, x2: x + lw + gap - 6, y2: ly + lh / 2, stroke: th.muted, sw: 2, arrow: 'end', head: th.head, step: i + 1 });
      });
      return { prims: prims, errors: errors };
    }
    var w = (box.w - gap * (n - 1)) / n, bh = 96, oneH = Math.ceil(13 * th.lh * PX * 3);
    var y0 = box.y + (box.h - (bh + 14 + oneH)) / 2, mid = y0 + bh / 2;
    all.forEach(function (s, i) {
      var x = box.x + i * (w + gap), last = d.store && i === n - 1, slot = last ? 'store' : 'steps[' + i + ']';
      if (last) prims.push({ k: 'can', x: x, y: y0 - 18, w: w, h: bh + 36, fill: th.accentSoft, stroke: th.accent, sw: 2, step: i });
      else prims.push({ k: 'rect', x: x, y: y0, w: w, h: bh, r: 10, fill: th.panel, stroke: th.line, sw: 1.5, step: i, term: i ? undefined : 'pipeline-diagram' });
      prims.push(S.textBox({ x: x + 10, y: last ? y0 + 8 : y0, w: w - 20, h: last ? bh - 8 : bh, text: s.name, size: 17, weight: 700, color: last ? th.accent : th.ink, align: 'center', valign: 'middle', max: 2, step: i }, th, errors, slot + '.name'));
      if (s.one) prims.push(S.textBox({ x: x, y: y0 + bh + 14 + (last ? 18 : 0), w: w, text: s.one, size: 13, color: th.muted, align: 'center', max: 3, step: i }, th, errors, slot + '.one'));
      if (i < n - 1) prims.push({ k: 'line', x1: x + w + 8, y1: mid, x2: x + w + gap - 8, y2: mid, stroke: th.muted, sw: 2.5, arrow: 'end', head: th.head, step: i + 1 });
    });
    return { prims: prims, errors: errors };
  };

  // 시퀀스: 참여자를 위에 늘어놓고 세로 점선(생명선), 메시지를 위에서 아래로 시간 순서대로. 돌려주는 답은 점선
  // { actors: [{ name, look }], messages: [{ from, to, text, back }], mark: { from, to, text } }
  // 밝은 테마는 참여자를 회색 상자(look: 'person'이면 흰 상자와 짙은 선)로. mark는 메시지 from~to번(0부터)을 강조 띠로 묶고 오른쪽 아래에 글
  S.diagrams['sequence-diagram'] = function (d, box, th) {
    var errors = [], prims = [], actors = d.actors || [], msgs = d.messages || [], at = {};
    count(actors, 2, 5, 'actors', errors); count(msgs, 2, 8, 'messages', errors);
    var n = Math.max(1, actors.length), cw = box.w / n, aw = Math.min(cw - 24, th.light ? 176 : 210), ah = th.light ? 48 : 50;
    actors.forEach(function (a, i) { at[a.name] = box.x + (i + 0.5) * cw; });
    var top = box.y + ah + 8, sh = (box.h - ah - 8) / Math.max(1, msgs.length), mk = d.mark;
    if (mk && msgs[mk.from] && msgs[mk.to]) {
      var xs = msgs.slice(mk.from, mk.to + 1).map(function (m) { return Math.min(at[m.from], at[m.to]); }).filter(function (v) { return v != null; });
      var bx1 = Math.min.apply(null, xs) + 12, by1 = top + (mk.from + 1) * sh - 10 - 32, by2 = top + (mk.to + 1) * sh - 10 + 22 + (mk.text ? 4 : 0);
      prims.push({ k: 'rect', x: bx1, y: by1, w: box.x + box.w - bx1, h: by2 - by1, r: 4, fill: th.accentSoft, step: mk.from + 1 });
      if (mk.text) prims.push(S.textBox({ x: bx1, y: by2 - 24, w: box.x + box.w - bx1 - 12, h: 22, text: mk.text, size: 12, weight: 700, color: th.accent, align: 'right', valign: 'middle', step: mk.from + 1 }, th, errors, 'mark.text'));
    }
    actors.forEach(function (a, i) {
      var cx = at[a.name], lk = th.light ? looks(th)[a.look === 'person' ? 'person' : 'ext'] : { fill: th.accentSoft, stroke: th.accent };
      prims.push({ k: 'rect', x: cx - aw / 2, y: box.y, w: aw, h: ah, r: 8, fill: lk.fill, stroke: lk.stroke, sw: 1.5, step: 0, term: i ? undefined : 'sequence-diagram' });
      prims.push(S.textBox({ x: cx - aw / 2 + 8, y: box.y, w: aw - 16, h: ah, text: a.name, size: 15, weight: 700, align: 'center', valign: 'middle', step: 0 }, th, errors, 'actors[' + i + '].name'));
      prims.push(th.light ? { k: 'line', x1: cx, y1: box.y + ah, x2: cx, y2: box.y + box.h, stroke: th.muted, sw: 1, dash: true, step: 0 }
        : { k: 'line', x1: cx, y1: box.y + ah, x2: cx, y2: box.y + box.h, stroke: th.line, sw: 2, dash: true, step: 0 });
    });
    // 밝은 테마: 받은 뒤 되돌려 보내는 참여자는 그동안 활성 막대(폭 12). 강조 구간 안이면 강조색
    var bars = {}, my = function (i) { return top + (i + 1) * sh - 10; };
    if (th.light) actors.forEach(function (a) {
      var f = -1, l = -1;
      msgs.forEach(function (m, i) { if (m.to === a.name && f < 0) f = i; if (m.from === a.name && m.back) l = i; });
      if (f < 0 || l <= f) return;
      bars[a.name] = [f, l];
      var hot = mk && f >= mk.from && l <= mk.to;
      prims.push({ k: 'rect', x: at[a.name] - 6, y: my(f) - 4, w: 12, h: my(l) - my(f) + 8, r: 2, fill: hot ? th.accent : th.bg, stroke: hot ? th.accent : th.muted, sw: 1, step: f + 1 });
    });
    var off = function (name, i) { var b = bars[name]; return b && i >= b[0] && i <= b[1] ? 6 : 0; };
    msgs.forEach(function (m, i) {
      var x1 = at[m.from], x2 = at[m.to], slot = 'messages[' + i + ']';
      if (x1 == null || x2 == null) { errors.push({ slot: slot, msg: '없는 참여자: ' + (x1 == null ? m.from : m.to) }); return; }
      if (x1 === x2) { errors.push({ slot: slot, msg: '보내는 쪽과 받는 쪽이 같습니다' }); return; }
      var y = top + (i + 1) * sh - 10, dir = x2 > x1 ? 1 : -1;
      prims.push({ k: 'line', x1: x1 + dir * (3 + off(m.from, i)), y1: y, x2: x2 - dir * (3 + off(m.to, i)), y2: y, stroke: m.back ? th.muted : th.ink, sw: 2, dash: !!m.back, arrow: 'end', head: th.head, step: i + 1 });
      var w = Math.abs(x2 - x1) - 16, p = fitH(S.textBox({ x: Math.min(x1, x2) + 8, y: 0, w: w, text: m.text, size: 12, color: m.back ? th.muted : th.ink, align: 'center', step: i + 1 }, th, errors, slot + '.text'), th);
      p.y = y - 5 - p.h; prims.push(p);
    });
    return { prims: prims, errors: errors };
  };

  // 타임라인: 가로축 위에 시점, 아래에 이름과 설명. now(번호)가 있으면 그 단계까지 채운 점, 뒤는 빈 점
  // { stages: [{ when, name, one }], now }
  S.diagrams['timeline-diagram'] = function (d, box, th) {
    var errors = [], prims = [], st = d.stages || [];
    count(st, 3, 6, 'stages', errors);
    var n = Math.max(1, st.length), cw = box.w / n, ay = box.y + box.h * 0.36;
    prims.push({ k: 'line', x1: box.x, y1: ay, x2: box.x + box.w, y2: ay, stroke: th.line, sw: 4, arrow: 'end', step: 0, term: 'timeline-diagram' });
    st.forEach(function (s, i) {
      var cx = box.x + (i + 0.5) * cw, done = d.now == null || i <= d.now, cur = d.now === i, r = cur ? 15 : 11;
      prims.push({ k: 'ellipse', x: cx - r, y: ay - r, w: 2 * r, h: 2 * r, fill: done ? th.accent : th.bg, stroke: th.accent, sw: 3, step: i });
      prims.push(S.textBox({ x: cx - cw / 2 + 10, y: ay - 32 - 14 * th.lh * PX, w: cw - 20, text: s.when, size: 14, weight: 700, color: done ? th.accent : th.muted, align: 'center', step: i }, th, errors, 'stages[' + i + '].when'));
      prims.push(S.textBox({ x: cx - cw / 2 + 10, y: ay + 30, w: cw - 20, text: s.name, size: 18, weight: 700, color: done ? th.ink : th.muted, align: 'center', step: i }, th, errors, 'stages[' + i + '].name'));
      if (s.one) prims.push(S.textBox({ x: cx - cw / 2 + 10, y: ay + 30 + 18 * th.lh * PX + 8, w: cw - 20, text: s.one, size: 13, color: th.muted, align: 'center', max: 3, step: i }, th, errors, 'stages[' + i + '].one'));
      if (cur) prims.push(S.textBox({ x: cx - 60, y: ay - 32 - 14 * th.lh * PX - 26, w: 120, text: '지금', size: 11, weight: 700, color: th.accent, align: 'center', step: i }, th, errors, 'now'));
    });
    return { prims: prims, errors: errors };
  };

  // 순환: 단계 3~6개를 타원 위에 놓고 다음 단계로 화살표, 마지막은 처음으로. 가운데에 주기(없어도 됨)
  // { steps: [{ name, one }], center }
  S.diagrams['cycle-diagram'] = function (d, box, th) {
    var errors = [], prims = [], st = d.steps || [];
    count(st, 3, 6, 'steps', errors);
    var n = Math.max(1, st.length), hasOne = st.some(function (s) { return s.one; });
    var w = Math.min(230, box.w / 3.2), h = hasOne ? 84 : 56;
    var ry = box.h / 2 - h / 2 - 6, rx = box.w / 2 - w / 2 - 6, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var P = st.map(function (s, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
    st.forEach(function (s, i) {
      var p = P[i];
      prims.push({ k: 'rect', x: p[0] - w / 2, y: p[1] - h / 2, w: w, h: h, r: h / 2, fill: i ? th.panel : th.accentSoft, stroke: i ? th.line : th.accent, sw: 1.5, step: i, term: i ? undefined : 'cycle-diagram' });
      prims = prims.concat(nodeText(s, p[0] - w / 2 + 14, p[1] - h / 2, w - 28, h, th, errors, 'steps[' + i + ']', i));
    });
    st.forEach(function (s, i) {
      var a = P[i], b = P[(i + 1) % n], p1 = edge(a, b, w / 2 + 6, h / 2 + 6), p2 = edge(b, a, w / 2 + 6, h / 2 + 6);
      prims.push({ k: 'line', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: th.accent, sw: 2.5, arrow: 'end', step: i === n - 1 ? n : i + 1 });
    });
    if (d.center) prims.push(S.textBox({ x: cx - rx * 0.45, y: cy - 30, w: rx * 0.9, h: 60, text: d.center, size: 15, weight: 700, color: th.muted, align: 'center', valign: 'middle', max: 2, step: n }, th, errors, 'center'));
    return { prims: prims, errors: errors };
  };
  // 둥근 상자 안 이름(한 줄)과 설명(두 줄)을 세로 가운데에
  function nodeText(s, x, y, w, h, th, errors, slot, step) {
    var a = fitH(S.textBox({ x: x, y: 0, w: w, text: s.name, size: 15, weight: 700, align: 'center', step: step }, th, errors, slot + '.name'), th);
    var b = s.one ? fitH(S.textBox({ x: x, y: 0, w: w, text: s.one, size: 12, color: th.muted, align: 'center', max: 2, step: step }, th, errors, slot + '.one'), th) : null;
    var tot = a.h + (b ? b.h + 2 : 0);
    a.y = y + (h - tot) / 2; if (b) b.y = a.y + a.h + 2;
    return roomy(b ? [a, b] : [a], th);
  }

  // 간트: 할 일마다 한 줄, 가로는 기간 칸(span은 칸 너비 비율). 막대는 from~to 칸(0부터)
  // now는 지금 하는 일(강조 막대), dash는 아직 일정에 없는 일(점선 막대), note는 막대 오른쪽 글
  // solid: 이름 칸 바탕 없이, 막대를 바탕색으로 채우고 높게, 글은 왼쪽 맞춤, 열 머리는 보통 굵기
  // { cols: ['1~2주', ...], span: [2, 4, ...], rows: [{ name, one, from, to, text, note, now, dash }], solid }
  S.diagrams['gantt-chart'] = function (d, box, th) {
    var errors = [], prims = [], cols = d.cols || [], rows = d.rows || [];
    count(cols, 2, 8, 'cols', errors); count(rows, 2, 6, 'rows', errors);
    var span = d.span || cols.map(function () { return 1; }), tot = span.reduce(function (a, b) { return a + b; }, 0) || 1;
    var nw = 220, hh = 30, gx = box.x + nw, gw = box.w - nw, xs = [gx];
    span.forEach(function (v) { xs.push(xs[xs.length - 1] + gw * v / tot); });
    var rh = (box.h - hh) / Math.max(1, rows.length);
    var so = d.solid;
    prims.push({ k: 'rect', x: box.x, y: box.y, w: nw - 16, h: box.h, r: 6, fill: so ? th.bg : th.panel, term: 'gantt-chart' });
    cols.forEach(function (c, i) {
      prims.push(S.textBox({ x: xs[i], y: box.y, w: xs[i + 1] - xs[i], h: hh, text: c, size: 12, weight: so ? 400 : 700, color: th.muted, align: 'center', valign: 'middle' }, th, errors, 'cols[' + i + ']'));
    });
    xs.forEach(function (x) { prims.push({ k: 'line', x1: x, y1: box.y + hh, x2: x, y2: box.y + box.h, stroke: th.line, sw: 1 }); });
    rows.forEach(function (r, i) {
      var y = box.y + hh + i * rh, sl = 'rows[' + i + ']';
      if (i) prims.push({ k: 'line', x1: gx, y1: y, x2: box.x + box.w, y2: y, stroke: th.line, sw: 1, dash: true });
      prims = prims.concat(nodeTextLeft(r, box.x + (so ? 0 : 20), y, nw - 52, rh, r.now && !so ? th.accent : th.muted, th, errors, sl, i));
      if (r.from == null) return;
      var to = r.to == null ? r.from : r.to;
      if (r.from < 0 || to >= cols.length || to < r.from) { errors.push({ slot: sl, msg: '칸 범위가 맞지 않습니다' }); return; }
      var x1 = xs[r.from] + (so ? 0 : 8), x2 = xs[to + 1] - (so ? 0 : 8), bh = Math.min(so ? 64 : 40, rh - 18), by = y + (rh - bh) / 2;
      prims.push({ k: 'rect', x: x1, y: by, w: x2 - x1, h: bh, r: 4, fill: r.now ? th.accent : so ? th.panel : th.bg, stroke: r.now ? th.accent : r.dash || so ? th.muted : th.line, sw: so ? 1 : 1.5, dash: r.dash, step: i });
      if (r.text) prims.push(S.textBox({ x: x1 + (so ? 16 : 10), y: by, w: x2 - x1 - (so ? 32 : 20), h: bh, text: r.text, size: so ? 13.5 : 12, weight: r.now && !so ? 700 : 400, color: r.now ? th.bg : th.ink, align: so ? 'left' : 'center', valign: 'middle', step: i }, th, errors, sl + '.text'));
      if (r.note) prims.push(S.textBox({ x: x2 + 14, y: by, w: box.x + box.w - x2 - 14, h: bh, text: r.note, size: 12, valign: 'middle', step: i }, th, errors, sl + '.note'));
    });
    return { prims: prims, errors: errors };
  };
  // 이름(한 줄)과 설명(한 줄)을 왼쪽 맞춤으로 세로 가운데에
  function nodeTextLeft(s, x, y, w, h, oneColor, th, errors, slot, step) {
    var a = fitH(S.textBox({ x: x, y: 0, w: w, text: s.name, size: 13.5, weight: 700, step: step }, th, errors, slot + '.name'), th);
    var b = s.one ? fitH(S.textBox({ x: x, y: 0, w: w, text: s.one, size: 12, color: oneColor, step: step }, th, errors, slot + '.one'), th) : null;
    var tot = a.h + (b ? b.h + 2 : 0);
    a.y = y + (h - tot) / 2; if (b) b.y = a.y + a.h + 2;
    return roomy(b ? [a, b] : [a], th);
  }

  /* ───── 차트·표 (보고서 덱) ─────
     강조(mark) 하나만 강조색, 나머지는 회색(th.chart). 값 글자는 글자색을 쓴다. 칸이 모자라면 줄 제한 오류로 알린다 */
  function num(v, unit) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (unit || ''); }
  function gray(th) { return th.chart || th.muted; }
  function tb(o, th, errors, slot) { return fitH(S.textBox(o, th, errors, slot), th); }

  // 큰 숫자 칸: items를 dir('row' 기본, 'col')로 늘어놓는다. ops가 있으면 칸 사이에 기호(÷, = 등). size는 숫자 크기(pt, 기본 30)
  // first: 'value'면 숫자를 설명(label)보다 위에. 칸의 lines(문단 1~3개)는 선 아래에 쓰고, 그 칸은 위에서부터 채운다
  // bar: 칸 왼쪽 강조색 띠. scale: { value, max }면 숫자 아래에 0~max 눈금 막대. inline: sub를 숫자 오른쪽에 한 줄로
  // { items: [{ label, value, sub, mark, lines, scale }], dir, ops, size, first, bar, inline }
  S.diagrams['kpi-card'] = function (d, box, th) {
    var errors = [], prims = [], it = d.items || [], n = Math.max(1, it.length), col = d.dir === 'col';
    count(it, 1, 4, 'items', errors);
    var g = col ? 16 : d.ops ? 48 : 20, vs = d.size || 30;
    var w = col ? box.w : (box.w - g * (n - 1)) / n, h = col ? (box.h - g * (n - 1)) / n : box.h;
    var blocks = it.map(function (k, i) {
      var x = col ? box.x : box.x + i * (w + g), y = col ? box.y + i * (h + g) : box.y, sl = 'items[' + i + ']', ps = [];
      var lb = k.label ? tb({ x: x + 24, y: 0, w: w - 48, text: k.label, size: 12, color: th.muted, step: i }, th, errors, sl + '.label') : null;
      if (lb && d.first !== 'value') ps.push(lb);
      var vb = tb({ x: x + 24, y: 0, w: w - 48, text: k.value, size: vs, weight: 700, color: k.mark ? th.accent : th.ink, step: i }, th, errors, sl + '.value');
      ps.push(vb);
      var vw = S.measure(k.value, vs, 700, th.font), ib = k.sub && d.inline ? tb({ x: x + 24 + vw + 12, y: 0, w: w - 60 - vw, text: k.sub, size: 12, color: th.muted, step: i }, th, errors, sl + '.sub') : null;
      if (ib) vb.inl = ib;
      if (lb && d.first === 'value') ps.push(lb);
      if (k.scale) ps.push({ k: 'scale', x: x + 24, y: 0, w: w - 48, h: 52, sc: k.scale, mark: k.mark });
      if (k.sub && !ib) ps.push(tb({ x: x + 24, y: 0, w: w - 48, text: k.sub, size: 12, color: th.muted, max: 2, step: i }, th, errors, sl + '.sub'));
      // 문단은 선(위아래 14px) 아래에 8px 사이로
      var ls = (k.lines || []).map(function (t, j) { return tb({ x: x + 24, y: 0, w: w - 48, text: t, size: 13.5, max: 3, step: i }, th, errors, sl + '.lines[' + j + ']'); });
      return { x: x, y: y, ps: ps, ls: ls, top: ls.length > 0, tot: ps.reduce(function (a, p) { return a + p.h; }, 0) + 4 * (ps.length - 1) };
    });
    // 가로로 늘어놓으면 글 시작 높이를 칸마다 맞춘다(가장 긴 칸 기준 세로 가운데)
    var most = Math.max.apply(null, blocks.map(function (b) { return b.tot; }).concat([0]));
    blocks.forEach(function (b, i) {
      var k = it[i], x = b.x, y = b.y, cy = b.top ? y + 28 : y + (h - (col ? b.tot : most)) / 2;
      prims.push({ k: 'rect', x: x, y: y, w: w, h: h, r: 6, fill: k.mark ? th.accentSoft : th.panel, step: i, term: i ? undefined : 'kpi-card' });
      if (d.bar) prims.push({ k: 'rect', x: x, y: y, w: 4, h: h, fill: th.accent, step: i });
      b.ps.forEach(function (p) { p.y = cy; cy += p.h + 4; });
      // 숫자 옆 설명은 숫자 글줄 아래쪽에 맞춘다
      b.ps = b.ps.reduce(function (a, p) { a.push(p); if (p.inl) { p.inl.y = p.y + p.h - p.inl.h - 4; a.push(p.inl); delete p.inl; } return a; }, []);
      // 눈금 막대: 바탕 막대 위에 값만큼 채우고, 아래에 0~max 정수 눈금 글
      b.ps = b.ps.reduce(function (a, p) {
        if (p.k !== 'scale') return a.concat([p]);
        var by = p.y + 8, mx = p.sc.max, fw = p.w * p.sc.value / mx;
        a.push({ k: 'rect', x: p.x, y: by, w: p.w, h: 16, fill: th.line, step: i }, { k: 'rect', x: p.x, y: by, w: fw, h: 16, fill: p.mark ? th.accent : gray(th), step: i });
        for (var t = 0; t <= mx; t++) a.push(S.textBox({ x: p.x + p.w * t / mx - 20, y: by + 20, w: 40, h: 22, text: String(t), size: 12, color: th.muted, align: t ? t === mx ? 'right' : 'center' : 'left', step: i }, th, errors, 'scale'));
        a[a.length - 1].x -= 20; a[a.length - 1 - mx].x += 20;
        return a;
      }, []);
      if (b.ls.length) { cy += 10; prims.push({ k: 'line', x1: x + 24, y1: cy, x2: x + w - 24, y2: cy, stroke: k.mark ? th.accent : th.line, sw: 1, step: i }); cy += 14; }
      b.ls.forEach(function (p) { p.y = cy; cy += p.h + 8; });
      if (cy - (b.ls.length ? 8 : 4) > y + h - 8) errors.push({ slot: 'items[' + i + ']', msg: '칸 높이를 약 ' + Math.ceil(cy - y - h + 8) + 'px 넘습니다' });
      prims = prims.concat(b.ps, b.ls);
      if (d.ops && d.ops[i] && i < n - 1) prims.push(S.textBox({ x: x + w, y: y, w: g, h: h, text: d.ops[i], size: 18, color: th.muted, align: 'center', valign: 'middle', step: i + 1 }, th, errors, 'ops[' + i + ']'));
    });
    return { prims: prims, errors: errors };
  };

  // 막대: dir 'v'(세로, 기본) 또는 'h'(가로). bars: [{ name, value, text(값 글을 바꿀 때), mark, cells(가로 막대 오른쪽 칸들), segs: [{ value, text }] }]
  // 세로: rows [[이름, 막대마다 값...]]는 아래 표, delta { from, to, text }는 두 막대 높이 차를 점선과 괄호로. 가로: head [이름 칸 머리, 오른쪽 칸 머리...], total [이름, 오른쪽 칸 값...]. unit, max
  S.diagrams['bar-chart'] = function (d, box, th) {
    var errors = [], prims = [], bars = d.bars || [], n = Math.max(1, bars.length);
    count(bars, 1, 8, 'bars', errors);
    var max = d.max || Math.max.apply(null, bars.map(function (b) { return b.segs ? b.segs.reduce(function (a, s) { return a + s.value; }, 0) : b.value || 0; }).concat([1]));
    var label = function (b) { return b.text != null ? b.text : num(b.value, d.unit); };
    if (d.dir !== 'h') {
      var rows = d.rows || [], rh = 32, lw = rows.length ? 130 : 0, tTop = box.y + box.h - rows.length * rh;
      var base = tTop - 34 - (rows.length ? 8 : 0), top = box.y + 34, slot = (box.w - lw) / n, bw = Math.min(96, slot * 0.58);
      bars.forEach(function (b, i) {
        var cx = box.x + lw + (i + 0.5) * slot, bh = (base - top) * (b.value || 0) / max, sl = 'bars[' + i + ']';
        prims.push({ k: 'rect', x: cx - bw / 2, y: base - bh, w: bw, h: bh, r: 3, fill: b.mark ? th.accent : gray(th), step: i, term: i ? undefined : 'bar-chart' });
        prims.push(S.textBox({ x: cx - slot / 2, y: base - bh - 30, w: slot, h: 26, text: label(b), size: 13.5, weight: 700, color: b.mark ? th.accent : th.ink, align: 'center', valign: 'bottom', step: i }, th, errors, sl + '.text'));
        prims.push(S.textBox({ x: cx - slot / 2, y: base + 6, w: slot, h: 26, text: b.name, size: 12, color: th.muted, align: 'center', valign: 'middle', step: i }, th, errors, sl + '.name'));
      });
      prims.push({ k: 'line', x1: box.x + lw, y1: base, x2: box.x + box.w, y2: base, stroke: th.muted, sw: 1.5 });
      if (d.delta) {
        var Y = function (k) { return base - (base - top) * (bars[k].value || 0) / max; }, X = function (k) { return box.x + lw + (k + 0.5) * slot; };
        var bx2 = X(d.delta.to) + bw / 2 + 16, y1 = Y(d.delta.from), y2 = Y(d.delta.to);
        prims.push({ k: 'line', x1: X(d.delta.from) + bw / 2, y1: y1, x2: bx2, y2: y1, stroke: th.muted, sw: 1, dash: true });
        prims.push({ k: 'line', x1: bx2, y1: y1, x2: bx2, y2: y2, stroke: th.muted, sw: 1 });
        prims.push({ k: 'line', x1: X(d.delta.to) + bw / 2, y1: y2, x2: bx2, y2: y2, stroke: th.muted, sw: 1 });
        prims.push(S.textBox({ x: bx2 + 8, y: (y1 + y2) / 2 - 13, w: box.x + box.w - bx2 - 8, h: 26, text: d.delta.text, size: 13.5, weight: 700, valign: 'middle' }, th, errors, 'delta.text'));
      }
      rows.forEach(function (r, j) {
        var y = tTop + j * rh, sl = 'rows[' + j + ']';
        if (!j) prims.push({ k: 'line', x1: box.x, y1: y - 4, x2: box.x + box.w, y2: y - 4, stroke: th.line, sw: 1 });
        prims.push(S.textBox({ x: box.x, y: y, w: lw - 8, h: rh, text: r[0], size: 12, color: th.muted, valign: 'middle' }, th, errors, sl + '[0]'));
        r.slice(1).forEach(function (t, i) { prims.push(S.textBox({ x: box.x + lw + i * slot, y: y, w: slot, h: rh, text: t, size: 12, align: 'center', valign: 'middle' }, th, errors, sl + '[' + (i + 1) + ']')); });
      });
      return { prims: prims, errors: errors };
    }
    // 가로 막대
    var head = d.head, cn = head ? head.length - 1 : 0, cw = d.colW || 96, nw = d.nameW || 190, hh = head ? 34 : 0, trh = d.total ? 44 : 0;
    var ax = box.x + nw, aw = box.w - nw - cn * cw - (cn ? 24 : 130), y0 = box.y + hh;
    var rh2 = Math.min(68, (box.h - hh - trh) / n), th2 = Math.min(40, rh2 * 0.62);
    if (head) {
      head.forEach(function (t, j) { prims.push(S.textBox({ x: j ? box.x + box.w - (cn - j + 1) * cw : box.x, y: box.y, w: j ? cw : nw, h: hh - 6, text: t, size: 12, color: th.muted, align: j ? 'right' : 'left', valign: 'middle' }, th, errors, 'head[' + j + ']')); });
      prims.push({ k: 'line', x1: box.x, y1: y0, x2: box.x + box.w, y2: y0, stroke: th.line, sw: 1 });
    }
    bars.forEach(function (b, i) {
      var cy = y0 + (i + 0.5) * rh2, sl = 'bars[' + i + ']', x = ax, segs = b.segs || [{ value: b.value || 0 }];
      prims.push(S.textBox({ x: box.x, y: cy - rh2 / 2, w: nw - 16, h: rh2, text: b.name, size: 13.5, valign: 'middle', step: i }, th, errors, sl + '.name'));
      segs.forEach(function (s, k) {
        var w = aw * s.value / max, fill = k ? th.accentSoft : b.mark ? th.accent : gray(th);
        if (w > 0) prims.push({ k: 'rect', x: x, y: cy - th2 / 2, w: Math.max(1, w - (k < segs.length - 1 ? 2 : 0)), h: th2, r: 3, fill: fill, step: i, term: i || k ? undefined : 'bar-chart' });
        if (b.segs && s.text) prims.push(S.textBox({ x: x + 12, y: cy - th2 / 2, w: Math.max(10, w - 16), h: th2, text: s.text, size: 12, color: k ? th.accent : th.bg, valign: 'middle', step: i }, th, errors, sl + '.segs[' + k + '].text'));
        x += w;
      });
      if (!cn) prims.push(S.textBox({ x: x + 12, y: cy - rh2 / 2, w: 118, h: rh2, text: label(b), size: 13.5, weight: b.mark ? 700 : 400, valign: 'middle', step: i }, th, errors, sl + '.text'));
      (b.cells || []).slice(0, cn).forEach(function (t, j) {
        prims.push(S.textBox({ x: box.x + box.w - (cn - j) * cw, y: cy - rh2 / 2, w: cw, h: rh2, text: t, size: j ? 12 : 13.5, weight: j ? 400 : 700, color: j ? th.muted : th.ink, align: 'right', valign: 'middle', step: i }, th, errors, sl + '.cells[' + j + ']'));
      });
    });
    prims.push({ k: 'line', x1: ax, y1: y0 + 6, x2: ax, y2: y0 + n * rh2 - 6, stroke: th.muted, sw: 1.5 });
    if (d.total) {
      var ty = y0 + n * rh2;
      prims.push({ k: 'line', x1: box.x, y1: ty, x2: box.x + box.w, y2: ty, stroke: th.line, sw: 1 });
      d.total.forEach(function (t, j) { prims.push(S.textBox({ x: j ? box.x + box.w - (cn - j + 1) * cw : box.x, y: ty, w: j ? cw : nw, h: trh, text: t, size: j === 1 ? 13.5 : 12, weight: j === 1 ? 700 : 400, color: j > 1 ? th.muted : th.ink, align: j ? 'right' : 'left', valign: 'middle' }, th, errors, 'total[' + j + ']')); });
    }
    return { prims: prims, errors: errors };
  };

  // 꺾은선: { x: [..], series: [{ name, values, mark }], min, max, step, target: { value, text } }
  // 점마다 값을 적는다(위 계열은 점 위, 아래 계열은 점 아래). 계열 이름은 선 끝에 바로
  S.diagrams['line-chart'] = function (d, box, th) {
    var errors = [], prims = [], xs = d.x || [], ser = d.series || [], lo = d.min || 0, hi = d.max || 100, st = d.step || 10;
    count(ser, 1, 3, 'series', errors);
    var px = box.x + 44, pw = box.w - 44 - 96, py = box.y + 12, ph = box.h - 12 - 36, slot = pw / Math.max(1, xs.length);
    var Y = function (v) { return py + ph * (1 - (v - lo) / (hi - lo)); }, X = function (i) { return px + (i + 0.5) * slot; };
    for (var v = lo; v <= hi + 1e-9; v += st) {
      prims.push({ k: 'line', x1: px, y1: Y(v), x2: px + pw, y2: Y(v), stroke: v === lo ? th.muted : th.line, sw: v === lo ? 1.5 : 1 });
      prims.push(S.textBox({ x: box.x, y: Y(v) - 12, w: 36, h: 24, text: num(v), size: 12, color: th.muted, align: 'right', valign: 'middle' }, th, errors, 'y'));
    }
    xs.forEach(function (t, i) { prims.push(S.textBox({ x: X(i) - slot / 2, y: py + ph + 8, w: slot, h: 26, text: t, size: 12, color: th.muted, align: 'center', valign: 'middle' }, th, errors, 'x[' + i + ']')); });
    if (d.target) {
      prims.push({ k: 'line', x1: px, y1: Y(d.target.value), x2: px + pw, y2: Y(d.target.value), stroke: th.ink, sw: 1.5, dash: true, term: d.target.text ? undefined : 'reference-line' });
      // 용어 보기는 높이 0인 가로선을 못 감싸므로 글이 있으면 글에 붙인다
      if (d.target.text) prims.push(tb({ x: px + 8, y: Y(d.target.value) - 26, w: 160, text: d.target.text, size: 12, term: 'reference-line' }, th, errors, 'target.text'));
    }
    var ends = [];
    ser.forEach(function (s, k) {
      var c = s.mark ? th.accent : gray(th), vs = s.values || [];
      for (var i = 0; i < vs.length - 1; i++) prims.push({ k: 'line', x1: X(i), y1: Y(vs[i]), x2: X(i + 1), y2: Y(vs[i + 1]), stroke: c, sw: 3, step: k, term: i || k ? undefined : 'line-chart' });
      vs.forEach(function (v, i) {
        prims.push({ k: 'ellipse', x: X(i) - 6, y: Y(v) - 6, w: 12, h: 12, fill: c, stroke: th.bg, sw: 2, step: k });
        // 같은 x의 다른 계열보다 크면(같으면 앞 계열이) 위에, 작으면 아래에
        var up = ser.every(function (o, m) { var ov = (o.values || [])[i]; return m === k || ov == null || v > ov || (v === ov && k < m); });
        prims.push(S.textBox({ x: X(i) - 40, y: up ? Y(v) - 32 : Y(v) + 8, w: 80, h: 24, text: num(v), size: 12, weight: s.mark && i === vs.length - 1 ? 700 : 400, color: s.mark ? th.ink : th.muted, align: 'center', valign: 'middle', step: k }, th, errors, 'series[' + k + '].values[' + i + ']'));
      });
      if (vs.length) ends.push({ y: Y(vs[vs.length - 1]), s: s, k: k });
    });
    // 끝 이름이 겹치지 않게 22px 이상 띄운다
    ends.sort(function (a, b) { return a.y - b.y; });
    ends.forEach(function (e, i) { if (i && e.y - ends[i - 1].y < 22) e.y = ends[i - 1].y + 22; });
    ends.forEach(function (e) { prims.push(S.textBox({ x: px + pw + 12, y: e.y - 12, w: 84, h: 24, text: e.s.name, size: 12, weight: e.s.mark ? 700 : 400, color: e.s.mark ? th.ink : th.muted, valign: 'middle', step: e.k }, th, errors, 'series[' + e.k + '].name')); });
    return { prims: prims, errors: errors };
  };

  // 한 줄 구성 막대: 전체를 조각으로 나눠 비율대로. 조각 안에 글, 아래에 note
  // { segs: [{ value, text, note, mark, tone('dark'면 짙은 회색) }], h }
  S.diagrams['stacked-bar-chart'] = function (d, box, th) {
    var errors = [], prims = [], segs = d.segs || [], tot = segs.reduce(function (a, s) { return a + s.value; }, 0) || 1, bh = d.h || 52, x = box.x;
    count(segs, 2, 4, 'segs', errors);
    segs.forEach(function (s, i) {
      var w = box.w * s.value / tot, last = i === segs.length - 1, sl = 'segs[' + i + ']';
      var fill = s.mark ? th.accent : s.tone === 'dark' ? th.ink : s.tone === 'gray' ? gray(th) : th.line, light = fill === th.line;
      prims.push({ k: 'rect', x: x, y: box.y, w: w - (last ? 0 : 4), h: bh, r: 3, fill: fill, step: i, term: i ? undefined : 'stacked-bar-chart' });
      if (s.text) prims.push(S.textBox({ x: x + 16, y: box.y, w: Math.max(10, w - 28), h: bh, text: s.text, size: 12, color: light ? th.ink : th.bg, valign: 'middle', step: i }, th, errors, sl + '.text'));
      if (s.note) {
        var nb = tb({ x: x + 12, y: box.y + bh + 14, w: Math.max(10, w - 28), text: s.note, size: 12, max: 3, step: i }, th, errors, sl + '.note');
        prims.push({ k: 'line', x1: x + 1, y1: box.y + bh + 14, x2: x + 1, y2: box.y + bh + 14 + nb.h, stroke: s.mark ? th.accent : th.line, sw: 2, step: i });
        prims.push(nb);
      }
      x += w;
    });
    return { prims: prims, errors: errors };
  };

  // 표: { head: [...], rows: [[...]], widths(비율), mark(강조 열 번호), tag(강조 열 머리 뒤 강조색 글), bold(굵게 쓸 열), right([오른쪽 맞춤 열...]), hl(굵은 열을 강조색으로 쓸 줄) }. 첫 열은 회색
  S.diagrams['data-table'] = function (d, box, th) {
    var errors = [], prims = [], head = d.head || [], rows = d.rows || [], ws = d.widths || head.map(function () { return 1; });
    count(rows, 1, 8, 'rows', errors);
    var tot = ws.reduce(function (a, b) { return a + b; }, 0), xs = [box.x];
    ws.forEach(function (v) { xs.push(xs[xs.length - 1] + box.w * v / tot); });
    var hh = 52, rh = Math.min(56, (box.h - hh) / Math.max(1, rows.length)), m = d.mark;
    if (m != null) prims.push({ k: 'rect', x: xs[m], y: box.y, w: xs[m + 1] - xs[m], h: hh + rows.length * rh, fill: th.accentSoft, term: 'data-table' });
    head.forEach(function (t, j) {
      var rt = (d.right || []).indexOf(j) >= 0;
      var hb = S.textBox({ x: xs[j] + 16, y: box.y, w: xs[j + 1] - xs[j] - (rt ? 32 : 24), h: hh, text: t, size: j ? 13.5 : 12, weight: j ? 700 : 400, color: j ? th.ink : th.muted, align: rt ? 'right' : 'left', valign: 'middle' }, th, errors, 'head[' + j + ']');
      prims.push(hb);
      if (j === m && d.tag) prims.push(S.textBox({ x: xs[j] + 16 + S.measure(t, 13.5, 700, th.font) + 16, y: box.y, w: 80, h: hh, text: d.tag, size: 13.5, weight: 700, color: th.accent, valign: 'middle' }, th, errors, 'tag'));
    });
    prims.push({ k: 'line', x1: box.x, y1: box.y + hh, x2: box.x + box.w, y2: box.y + hh, stroke: th.ink, sw: 1.5 });
    rows.forEach(function (r, i) {
      var y = box.y + hh + i * rh;
      r.forEach(function (t, j) {
        var b = j === d.bold, rt = (d.right || []).indexOf(j) >= 0;
        prims.push(S.textBox({ x: xs[j] + 16, y: y, w: xs[j + 1] - xs[j] - (rt ? 32 : 24), h: rh, text: t, size: b ? 13.5 : j ? th.body || 12 : 12, weight: b ? 700 : 400, color: b && i === d.hl ? th.accent : j ? th.ink : th.muted, align: rt ? 'right' : 'left', valign: 'middle', max: rh > 44 ? 2 : 1, step: i }, th, errors, 'rows[' + i + '][' + j + ']'));
      });
      prims.push({ k: 'line', x1: box.x, y1: y + rh, x2: box.x + box.w, y2: y + rh, stroke: th.line, sw: 1 });
    });
    return { prims: prims, errors: errors };
  };

  /* ───── 레이아웃 ───── */
  var M = 64;                       // 좌우 여백
  S.layouts = {};

  S.layouts.title = {
    slots: { title: '2줄', sub: '2줄', by: '1줄', notes: '자유' },
    build: function (s, th) {
      var errors = [], prims = [];
      prims.push({ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg });
      prims.push({ k: 'rect', x: M, y: 226, w: 10, h: 218, fill: th.accent });
      prims.push(S.textBox({ x: M + 40, y: 220, w: 980, text: s.title, size: 40, weight: 700, max: 2, ph: 'title' }, th, errors, 'title'));
      if (s.sub) prims.push(S.textBox({ x: M + 40, y: 376, w: 900, text: s.sub, size: 20, color: th.muted, max: 2 }, th, errors, 'sub'));
      if (s.by) prims.push(S.textBox({ x: M + 40, y: 600, w: 900, text: s.by, size: 14, color: th.muted }, th, errors, 'by'));
      return { prims: prims, errors: errors };
    }
  };

  // 내용 장의 틀: 제목 띠(Action Title, 두 줄까지) + 본문 상자 + 쪽 번호
  function frame(s, th, page, errors) {
    if (th.frame) return reportFrame(s, th, page, errors);
    var prims = [{ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg }];
    prims.push(S.textBox({ x: M, y: 40, w: S.W - 2 * M, text: s.title, size: 26, weight: 700, max: 2, ph: 'title', term: 'action-title' }, th, errors, 'title'));
    prims.push({ k: 'line', x1: M, y1: 150, x2: S.W - M, y2: 150, stroke: th.line, sw: 1.5 });
    if (page) prims.push(S.textBox({ x: S.W - M - 80, y: 676, w: 80, text: String(page), size: 11, color: th.muted, align: 'right' }, th, errors, 'page'));
    return { prims: prims, body: { x: M, y: 176, w: S.W - 2 * M, h: 480 } };
  }
  // 보고서 틀: 머리말(eyebrow) · 한 줄 제목 · 줄 · 본문 · 짙은 결론 띠(takeaway, 한 줄) · 쪽 번호
  function reportFrame(s, th, page, errors) {
    var F = th.frame, prims = [{ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg }], bottom = 650;
    if (s.eyebrow) prims.push(S.textBox({ x: M, y: 38, w: S.W - 2 * M, text: s.eyebrow, size: F.eyebrow, weight: 500, color: th.muted }, th, errors, 'eyebrow'));
    prims.push(S.textBox({ x: M, y: 64, w: S.W - 2 * M, text: s.title, size: F.title, weight: 700, max: 1, ph: 'title', term: 'action-title' }, th, errors, 'title'));
    prims.push({ k: 'line', x1: M, y1: 122, x2: S.W - M, y2: 122, stroke: th.line, sw: 1 });
    if (s.takeaway) {
      prims.push({ k: 'rect', x: M, y: 592, w: S.W - 2 * M, h: 56, r: 6, fill: th.band });
      prims.push(S.textBox({ x: M + 24, y: 592, w: S.W - 2 * M - 48, h: 56, text: s.takeaway, size: 13.5, color: th.bg, valign: 'middle' }, th, errors, 'takeaway'));
      bottom = 572;
    }
    if (page) prims.push(S.textBox({ x: S.W - M - 80, y: 658, w: 80, text: String(page), size: F.eyebrow, color: th.muted, align: 'right' }, th, errors, 'page'));
    return { prims: prims, body: { x: M, y: 146, w: S.W - 2 * M, h: bottom - 146 } };
  }
  function diagramLayout(termId, keys) {
    var slots = { title: '2줄', notes: '자유' };
    keys.forEach(function (k) { slots[k] = '다이어그램 칸'; });
    return {
      slots: slots,
      build: function (s, th, page) {
        var errors = [];
        var f = frame(s, th, page, errors);
        var d = S.diagrams[termId](s, f.body, th);
        return { prims: f.prims.concat(d.prims), errors: errors.concat(d.errors) };
      }
    };
  }
  S.layouts.venn = diagramLayout('venn-diagram', ['sets', 'overlap']);
  S.layouts['layered-architecture'] = diagramLayout('layered-architecture-diagram', ['layers']);
  S.layouts.euler = diagramLayout('euler-diagram', ['outer', 'inner', 'apart']);
  S.layouts['box-and-arrow'] = diagramLayout('box-and-arrow-diagram', ['boxes', 'arrows', 'legend']);
  S.layouts['c4-context'] = diagramLayout('c4-system-context', ['people', 'system', 'externals']);
  S.layouts['c4-container'] = diagramLayout('c4-container', ['system', 'nodes', 'links']);
  S.layouts.pipeline = diagramLayout('pipeline-diagram', ['steps', 'store']);
  S.layouts.sequence = diagramLayout('sequence-diagram', ['actors', 'messages']);
  S.layouts.timeline = diagramLayout('timeline-diagram', ['stages', 'now']);
  S.layouts.cycle = diagramLayout('cycle-diagram', ['steps', 'center']);

  // 위에 상자와 화살표 흐름(요청마다), 아래에 순환(주기마다). 칸마다 짧은 머리글
  // { flow: { label, boxes, arrows, legend }, cycle: { label, steps, center } }
  function shift(prims, by) { prims.forEach(function (p) { if (p.step != null) p.step += by; }); return prims; }
  function tag(errors, pre) { errors.forEach(function (e) { e.slot = pre + '.' + e.slot; }); return errors; }
  S.layouts['flow-and-cycle'] = {
    slots: { title: '2줄', flow: '상자 2~8개, 머리글 1줄', cycle: '단계 3~6개, 머리글 1줄', notes: '자유' },
    build: function (s, th, page) {
      var errors = [], f = frame(s, th, page, errors), b = f.body, prims = f.prims, fl = s.flow || {}, cy = s.cycle || {};
      var e1 = [], e2 = [];
      if (fl.label) prims.push(S.textBox({ x: b.x, y: b.y, w: 600, text: fl.label, size: 14, weight: 700, color: th.muted }, th, e1, 'label'));
      var a = S.diagrams['box-and-arrow-diagram']({ boxes: fl.boxes, arrows: fl.arrows }, { x: b.x, y: b.y + 44, w: b.w, h: 170 }, th);
      prims = prims.concat(a.prims); e1 = e1.concat(a.errors);
      var n = (fl.boxes || []).length;
      if (fl.legend) prims = prims.concat(legend(fl.legend, b.x + b.w, b.y - 8, th, e1, 'legend', n));
      prims.push({ k: 'line', x1: b.x, y1: b.y + 232, x2: b.x + b.w, y2: b.y + 232, stroke: th.line, sw: 1, dash: true });
      if (cy.label) prims.push(S.textBox({ x: b.x, y: b.y + 246, w: 600, text: cy.label, size: 14, weight: 700, color: th.muted, step: n + 1 }, th, e2, 'label'));
      var c = S.diagrams['cycle-diagram']({ steps: cy.steps, center: cy.center }, { x: b.x + 160, y: b.y + 262, w: b.w - 320, h: 218 }, th);
      prims = prims.concat(shift(c.prims, n + 1)); e2 = e2.concat(c.errors);
      return { prims: prims, errors: errors.concat(tag(e1, 'flow'), tag(e2, 'cycle')) };
    }
  };

  // 2단 비교: 왼쪽과 오른쪽을 같은 틀로. 줄은 양쪽이 같은 높이로 나란히 선다. 아래에 한 줄(없어도 됨)
  // { left: { head, items }, right: { head, items }, foot }
  S.layouts['two-column'] = {
    slots: { title: '2줄', left: '머리 1줄, 항목 1~5개(2줄씩)', right: '왼쪽과 같음', foot: '1줄', notes: '자유' },
    build: function (s, th, page) {
      var errors = [], f = frame(s, th, page, errors), b = f.body, prims = f.prims, gap = 48;
      var cw = (b.w - gap) / 2, L = s.left || {}, R = s.right || {}, rows = Math.max((L.items || []).length, (R.items || []).length);
      var rh = 72, hh = 58, top = b.y + (s.foot ? 0 : 10);
      [['left', L, 0], ['right', R, 1]].forEach(function (c) {
        var key = c[0], col = c[1], x = b.x + c[2] * (cw + gap);
        count(col.items, 1, 5, key + '.items', errors);
        prims.push({ k: 'rect', x: x, y: top, w: cw, h: hh + rows * rh + 12, r: 10, fill: th.panel, step: 0, term: c[2] ? undefined : 'two-column-comparison' });
        prims.push({ k: 'rect', x: x, y: top, w: cw, h: 6, fill: c[2] ? th.muted : th.accent, step: 0 });
        prims.push(S.textBox({ x: x + 24, y: top + 6, w: cw - 48, h: hh - 6, text: col.head || '', size: 19, weight: 700, color: c[2] ? th.ink : th.accent, valign: 'middle', step: 0 }, th, errors, key + '.head'));
        (col.items || []).forEach(function (it, i) {
          var y = top + hh + i * rh;
          prims.push({ k: 'line', x1: x + 24, y1: y, x2: x + cw - 24, y2: y, stroke: th.line, sw: 1, step: i + 1 });
          prims.push({ k: 'ellipse', x: x + 26, y: y + rh / 2 - 4, w: 8, h: 8, fill: c[2] ? th.muted : th.accent, step: i + 1 });
          prims.push(S.textBox({ x: x + 48, y: y, w: cw - 72, h: rh, text: it, size: 16, valign: 'middle', max: 2, step: i + 1 }, th, errors, key + '.items[' + i + ']'));
        });
      });
      if (s.foot) prims.push(S.textBox({ x: b.x, y: top + hh + rows * rh + 40, w: b.w, text: s.foot, size: 15, weight: 700, step: rows + 1 }, th, errors, 'foot'));
      return { prims: prims, errors: errors };
    }
  };

  // 표지(보고서): 위는 짙은 띠에 머리말·작성자·제목·부제, 아래는 순서 묶음 2~4개
  // { eyebrow, by, title, sub, agenda: [{ key, head, items: [1~4개] }] }
  S.layouts.cover = {
    slots: { eyebrow: '1줄', by: '1줄', title: '2줄', sub: '2줄', agenda: '묶음 2~4개(머리 1줄, 항목 1~4개)', notes: '자유' },
    build: function (s, th) {
      var errors = [], top = 400, ag = s.agenda || [], light = th.line;
      var prims = [{ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg }, { k: 'rect', x: 0, y: 0, w: S.W, h: top, fill: th.band || th.ink }];
      if (s.eyebrow) prims.push(S.textBox({ x: M, y: 56, w: 760, text: s.eyebrow, size: 11.25, weight: 500, color: light }, th, errors, 'eyebrow'));
      if (s.by) prims.push(S.textBox({ x: S.W - M - 360, y: 56, w: 360, text: s.by, size: 11.25, color: light, align: 'right' }, th, errors, 'by'));
      prims.push(S.textBox({ x: M, y: 140, w: 920, text: s.title, size: 30, weight: 700, color: th.bg, max: 2, ph: 'title' }, th, errors, 'title'));
      if (s.sub) prims.push(S.textBox({ x: M, y: 300, w: 1000, text: s.sub, size: 13.5, color: light, max: 2 }, th, errors, 'sub'));
      count(ag, 2, 4, 'agenda', errors);
      var gap = 24, n = Math.max(1, ag.length), cw = (S.W - 2 * M - gap * (n - 1)) / n, y0 = top + 32;
      ag.forEach(function (a, i) {
        var x = M + i * (cw + gap), sl = 'agenda[' + i + ']';
        count(a.items, 1, 4, sl + '.items', errors);
        prims.push({ k: 'rect', x: x, y: y0, w: cw, h: S.H - 40 - y0, r: 6, fill: th.panel });
        if (a.key) prims.push(S.textBox({ x: x + 24, y: y0 + 20, w: cw - 48, text: a.key, size: 12, color: th.muted }, th, errors, sl + '.key'));
        prims.push(S.textBox({ x: x + 24, y: y0 + 44, w: cw - 48, text: a.head, size: 13.5, weight: 700 }, th, errors, sl + '.head'));
        (a.items || []).slice(0, 4).forEach(function (t, j) {
          var y = y0 + 86 + j * 36;
          prims.push({ k: 'line', x1: x + 24, y1: y, x2: x + cw - 24, y2: y, stroke: th.line, sw: 1 });
          prims.push(S.textBox({ x: x + 24, y: y, w: cw - 48, h: 36, text: t, size: 12, valign: 'middle' }, th, errors, sl + '.items[' + j + ']'));
        });
      });
      return { prims: prims, errors: errors };
    }
  };

  // 조각 배치: 본문을 비율 상자(at: [x, y, w, h], 0~1)로 나눠 조각 1~6개를 놓는다
  // 조각은 다이어그램({ diagram: 용어 id, 그 다이어그램 칸..., bg, label: { name, one }, cap(위 설명 한 줄) }) 또는 판({ panel })
  // panel: { key(머리 위 작은 글), head, one, big(one을 인용처럼 크게), mark, tone('warn'이면 제목을 주의색), bar, plain, bare, flow(항목 사이 화살표),
  //   items: [글 | { name, one, mark }], rows: [[이름, 값...]], cols(값 열 머리), boldVal, split, note }
  S.layouts.parts = {
    slots: { eyebrow: '1줄', title: '1줄', takeaway: '1줄', parts: '조각 1~6개', notes: '자유' },
    build: function (s, th, page) {
      var errors = [], f = frame(s, th, page, errors), b = f.body, prims = f.prims;
      count(s.parts, 1, 6, 'parts', errors);
      (s.parts || []).forEach(function (p, i) {
        var a = p.at || [0, 0, 1, 1], bx = { x: b.x + a[0] * b.w, y: b.y + a[1] * b.h, w: a[2] * b.w, h: a[3] * b.h }, e = [];
        prims = prims.concat(p.panel ? panel(p.panel, bx, th, e) : partDiagram(p, bx, th, e));
        errors = errors.concat(tag(e, 'parts[' + i + ']'));
      });
      return { prims: prims, errors: errors };
    }
  };
  function partDiagram(p, bx, th, e) {
    var out = [], box = bx, D = S.diagrams[p.diagram];
    if (p.bg) { out.push({ k: 'rect', x: bx.x, y: bx.y, w: bx.w, h: bx.h, r: 6, fill: th.panel }); box = { x: bx.x + 20, y: bx.y + 16, w: bx.w - 40, h: bx.h - 32 }; }
    if (p.cap) { out.push(S.textBox({ x: box.x, y: box.y, w: box.w, text: p.cap, size: 12, color: th.muted }, th, e, 'cap')); box = { x: box.x, y: box.y + 30, w: box.w, h: box.h - 30 }; }
    if (p.label) {
      var lw = 150, a = fitH(S.textBox({ x: box.x, y: 0, w: lw, text: p.label.name, size: 13.5, weight: 700 }, th, e, 'label.name'), th);
      var c = p.label.one ? fitH(S.textBox({ x: box.x, y: 0, w: lw, text: p.label.one, size: 12, color: th.muted, max: 3 }, th, e, 'label.one'), th) : null;
      a.y = box.y + (box.h - a.h - (c ? c.h + 4 : 0)) / 2; if (c) c.y = a.y + a.h + 4;
      out = out.concat(roomy(c ? [a, c] : [a], th));
      box = { x: box.x + lw + 20, y: box.y, w: box.w - lw - 20, h: box.h };
    }
    if (!p.diagram) return out;   // bg나 cap만 쓰는 조각
    if (!D) { e.push({ slot: 'diagram', msg: '없는 다이어그램 ' + p.diagram }); return out; }
    var r = D(p, box, th);
    e.push.apply(e, r.errors);
    // 용어 보기: 다이어그램에 그 용어 표시가 없으면 첫 도형에 붙인다
    if (r.prims[0] && !r.prims[0].term && !r.prims.some(function (q) { return q.term === p.diagram; })) r.prims[0].term = p.diagram;
    return out.concat(r.prims);
  }
  function panel(o, bx, th, e) {
    // plain: 항목·줄을 흰 칸 없이 글과 가는 선으로. bare: 판 바탕 없이 위에 선 하나(plain 포함). bar: 왼쪽 세로 띠(warn이면 주의색)
    var plain = o.plain || o.bare, pad = o.bare ? 0 : 20;
    var out = [], mk = o.mark, x = bx.x + pad, w = bx.w - 2 * pad, y = bx.y + (o.bare ? 14 : 18), sm = 12 * th.lh * PX;
    if (o.bare) out.push({ k: 'line', x1: bx.x, y1: bx.y, x2: bx.x + bx.w, y2: bx.y, stroke: th.line, sw: 1 });
    else out.push({ k: 'rect', x: bx.x, y: bx.y, w: bx.w, h: bx.h, r: 6, fill: mk ? th.accentSoft : th.panel, stroke: mk ? th.accent : undefined, sw: 1.5 });
    if (o.bar) out.push({ k: 'rect', x: bx.x, y: bx.y, w: 4, h: bx.h, fill: o.tone === 'warn' && th.warn ? th.warn : th.accent });
    if (o.key) { var kb = tb({ x: x, y: y, w: w, text: o.key, size: 12, color: th.muted }, th, e, 'key'); out.push(kb); y += kb.h + 2; }
    if (o.head) { var hb = fitH(S.textBox({ x: x, y: y, w: w, text: o.head, size: 13.5, weight: 700, color: mk ? th.accent : o.tone === 'warn' && th.warn ? th.warn : th.ink, max: 2 }, th, e, 'head'), th); out.push(hb); y += hb.h + 4; }
    // 강조 판의 one은 판이 묻는 질문이라 크게 쓴다(big이어도)
    var bg1 = mk || o.big;
    if (o.one) { var ob = fitH(S.textBox({ x: x, y: y + (bg1 ? 6 : 0), w: w, text: o.one, size: bg1 ? 15 : 12, weight: bg1 ? 700 : 400, color: bg1 || o.bare ? th.ink : th.muted, max: o.bare ? 3 : 2 }, th, e, 'one'), th); if (plain && o.items) { ob.y += 8; y += 8; } out.push(ob); y += ob.h + (bg1 ? 12 : 0); }
    y += plain ? 8 : 12;
    var noteH = o.note ? Math.ceil(2 * (o.noteKey ? 13.5 * th.lh * PX : sm)) + 12 + (o.noteKey ? Math.ceil(sm) + 2 : 0) : 0, bottom = bx.y + bx.h - (o.bare ? 0 : 18) - noteH;
    if (o.items && plain) {
      // 글 목록: 설명(one)이 있으면 항목 사이에 선, 없으면 줄만 쌓는다
      var lined = o.items.some(function (it) { return it.one; });
      o.items.forEach(function (it, i) {
        it = typeof it === 'string' ? { name: it } : it;
        var sl = 'items[' + i + ']';
        if (lined) { out.push({ k: 'line', x1: x, y1: y, x2: x + w, y2: y, stroke: th.line, sw: 1 }); y += 12; }
        var a = tb({ x: x, y: y, w: w, text: it.name, size: 13.5, weight: lined || it.mark ? 700 : 400, color: it.mark ? th.accent : th.ink, max: 2 }, th, e, sl + '.name');
        out.push(a); y += a.h;
        if (it.one) { var c = tb({ x: x, y: y + 2, w: w, text: it.one, size: 12, color: th.muted, max: 2 }, th, e, sl + '.one'); out.push(c); y += c.h + 2; }
        y += lined ? 12 : 8;
      });
      var end = y - (lined ? 12 : 8);   // 마지막 글 끝
      if (end > bottom) e.push({ slot: 'items', msg: '판 높이를 약 ' + Math.ceil(end - bottom) + 'px 넘습니다' });
    } else if (o.items) {
      var n = o.items.length, g = o.flow ? 24 : th.light ? 16 : 10, ih = Math.min(o.flow ? 66 : th.light ? 76 : 52, (bottom - y - g * (n - 1)) / n);
      o.items.forEach(function (it, i) {
        it = typeof it === 'string' ? { name: it } : it;
        var iy = y + i * (ih + g), sl = 'items[' + i + ']', big = o.flow || it.one, bold = it.one || it.mark;
        out.push({ k: 'rect', x: x, y: iy, w: w, h: ih, r: 4, fill: it.mark ? th.accentSoft : th.bg, stroke: it.mark ? th.accent : th.line, sw: 1 });
        if (it.one) out = out.concat(nodeText({ name: it.name, one: it.one }, x + 12, iy, w - 24, ih, th, e, sl));
        else out.push(S.textBox({ x: x + 16, y: iy, w: w - 32, h: ih, text: it.name, size: big ? 13.5 : 12, weight: bold ? 700 : 400, align: o.flow ? 'center' : 'left', valign: 'middle' }, th, e, sl));
        if (o.flow && i < n - 1) out.push({ k: 'line', x1: x + w / 2, y1: iy + ih + 3, x2: x + w / 2, y2: iy + ih + g - 3, stroke: th.muted, sw: 1.5, arrow: 'end', head: th.head });
      });
    } else if (o.rows) {
      // cols: 값 열 머리(첫 칸은 비움). 줄의 값이 둘 이상이면 남은 너비를 나눠 쓴다
      // boldKey: 이름 칸을 굵은 글로. rightVal: 값을 오른쪽 맞춤. from: 줄의 마지막 값은 칸 밖 오른쪽 글이고 화살표로 칸을 가리킨다
      var rows = o.cols ? [o.cols].concat(o.rows) : o.rows, fw = o.from ? 104 : 0, ww = w - fw;
      var rh = Math.min(plain ? 46 : th.light ? 60 : 44, (bottom - y) / Math.max(1, rows.length)), kw = w * (o.split || 0.36);
      rows.forEach(function (r, i) {
        var ry = y + i * rh, sl = o.cols ? (i ? 'rows[' + (i - 1) + ']' : 'cols') : 'rows[' + i + ']', ch = rh, ci = 0, hd = o.cols && !i;
        // 밝은 테마는 줄마다 흰 칸(사이 8px), 아니면(plain 포함) 줄 위에 선
        var mr = o.markRow === (o.cols ? i - 1 : i);   // markRow: 위 그림의 강조와 짝지을 줄(같은 강조 테두리)
        if (th.light && !plain) { ch = rh - 8; ci = 14; out.push({ k: 'rect', x: x, y: ry, w: ww, h: ch, r: 4, fill: mr ? th.accentSoft : th.bg, stroke: mr ? th.accent : th.line, sw: mr ? 1.5 : 1 }); }
        else if (i || !plain) out.push({ k: 'line', x1: x, y1: ry, x2: x + ww, y2: ry, stroke: th.line, sw: 1 });
        out.push(S.textBox({ x: x + ci, y: ry, w: kw - 12 - ci, h: ch, text: r[0], size: o.boldKey ? 13.5 : 12, weight: o.boldKey ? 700 : 400, color: o.boldKey ? th.ink : th.muted, valign: 'middle' }, th, e, sl + '[0]'));
        var vals = o.from ? r.slice(1, -1) : r.slice(1), vw = (ww - kw - ci - (o.rightVal ? ci : 0)) / vals.length;
        if (o.from) {
          out.push({ k: 'line', x1: x + ww + 40, y1: ry + ch / 2, x2: x + ww + 6, y2: ry + ch / 2, stroke: th.muted, sw: 1.5, arrow: 'end', head: th.head });
          out.push(S.textBox({ x: x + ww + 48, y: ry, w: fw - 48, h: ch, text: r[r.length - 1], size: 12, color: th.ink, valign: 'middle' }, th, e, sl + '[' + (r.length - 1) + ']'));
        }
        vals.forEach(function (t, j) { out.push(S.textBox({ x: x + kw + j * vw, y: ry, w: vw - (vals.length > 1 ? 8 : 0), h: ch, align: o.rightVal ? 'right' : undefined, text: t, size: hd ? 12 : plain ? 13.5 : th.body || 12, weight: o.boldVal && !hd ? 700 : 400, color: hd ? th.muted : th.ink, valign: 'middle', max: ch > (plain ? 56 : 40) ? 2 : 1 }, th, e, sl + '[' + (j + 1) + ']')); });
      });
    }
    if (o.note) {
      var ny = bx.y + bx.h - (o.bare ? 0 : 18) - noteH + 12;
      out.push({ k: 'line', x1: x, y1: ny - 8, x2: x + w, y2: ny - 8, stroke: th.line, sw: 1 });
      // noteKey가 있으면 작은 머리 아래에 note를 본문 글로
      if (o.noteKey) { out.push(S.textBox({ x: x, y: ny, w: w, text: o.noteKey, size: 12, color: th.muted }, th, e, 'noteKey')); ny += Math.ceil(sm) + 2; }
      out.push(S.textBox({ x: x, y: ny, w: w, text: o.note, size: o.noteKey ? 13.5 : 12, color: o.noteKey ? th.ink : th.muted, max: 2 }, th, e, 'note'));
    }
    return out;
  }

  S.layouts.gantt = diagramLayout('gantt-chart', ['cols', 'span', 'rows']);

  // 덱의 장 하나를 만든다. 오류에는 몇째 장인지 붙인다
  S.build = function (slide, i, theme) {
    var L = S.layouts[slide.layout];
    if (!L) return { prims: [], errors: [{ slide: i + 1, slot: 'layout', msg: '없는 레이아웃 ' + slide.layout }] };
    if (slide.body) theme = Object.assign({}, theme, { body: slide.body });   // 장마다 본문 값 크기를 덮어쓴다(pt)
    var r = L.build(slide, theme, i + 1);
    r.errors.forEach(function (e) { e.slide = i + 1; });
    return r;
  };
  // 장 틀 안의 본문 상자. 문서 출력(slides-doc.js)이 장 그림을 이 칸으로 자른다
  S.bodyBox = function (slide, theme) { return frame(slide, theme, 0, []).body; };

  /* ───── 도형 목록 → SVG ─────
     t(0~1)가 있으면 step이 붙은 도형이 차례로 나타난다. 없으면 다 보인다 */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n2(v) { return Math.round(v * 100) / 100; }
  S.svg = function (prims, t) {
    var steps = 0;
    prims.forEach(function (p) { if (p.step != null) steps = Math.max(steps, p.step + 1); });
    function vis(p) {
      if (t == null || p.step == null) return 1;
      return Math.max(0, Math.min(1, (t * (steps + 0.5) - p.step) / 0.5));
    }
    var out = [];
    prims.forEach(function (p) {
      var o = vis(p);
      if (o <= 0) return;
      var g = (o < 1 ? ' opacity="' + n2(o) + '"' : '') + (p.term ? ' data-term="' + p.term + '"' : '');
      var paint = ' fill="' + (p.fill || 'none') + '"' + (p.fill && p.alpha != null ? ' fill-opacity="' + p.alpha + '"' : '') +
        (p.stroke ? ' stroke="' + p.stroke + '" stroke-width="' + (p.sw || 1) + '"' + (p.dash ? ' stroke-dasharray="' + (p.sw || 1) * 3 + ' ' + (p.sw || 1) * 2 + '"' : '') : '');
      if (p.k === 'rect') out.push('<rect x="' + n2(p.x) + '" y="' + n2(p.y) + '" width="' + n2(p.w) + '" height="' + n2(p.h) + '"' + (p.r ? ' rx="' + p.r + '"' : '') + paint + g + '/>');
      else if (p.k === 'ellipse') out.push('<ellipse cx="' + n2(p.x + p.w / 2) + '" cy="' + n2(p.y + p.h / 2) + '" rx="' + n2(p.w / 2) + '" ry="' + n2(p.h / 2) + '"' + paint + g + '/>');
      else if (p.k === 'can') {
        // PowerPoint 원통(can)의 기본값: 윗면 타원 높이 = 짧은 변의 1/4
        var ry = Math.min(p.w, p.h) / 8, x = p.x, y = p.y, w = p.w, h = p.h;
        out.push('<g' + g + '><path d="M' + n2(x) + ' ' + n2(y + ry) + 'V' + n2(y + h - ry) + 'A' + n2(w / 2) + ' ' + n2(ry) + ' 0 0 0 ' + n2(x + w) + ' ' + n2(y + h - ry) + 'V' + n2(y + ry) + '"' + paint + '/>' +
          '<ellipse cx="' + n2(x + w / 2) + '" cy="' + n2(y + ry) + '" rx="' + n2(w / 2) + '" ry="' + n2(ry) + '"' + paint + '/></g>');
      } else if (p.k === 'line') {
        var sw = p.sw || 1, head = '';
        var heads = p.arrow === 'both' ? [[p.x1, p.y1, p.x2, p.y2], [p.x2, p.y2, p.x1, p.y1]] : p.arrow === 'end' ? [[p.x1, p.y1, p.x2, p.y2]] : [];
        heads.forEach(function (a) {
          // 화살촉: 선 굵기의 3배(PowerPoint 중간 크기와 같은 비율로 잡음). 도형에 head가 있으면 그 길이
          var ang = Math.atan2(a[3] - a[1], a[2] - a[0]), L = p.head || Math.max(sw * 3, 6), W = L / 2;
          var bx = a[2] - Math.cos(ang) * L, by = a[3] - Math.sin(ang) * L;
          head += '<path d="M' + n2(a[2]) + ' ' + n2(a[3]) + 'L' + n2(bx - Math.sin(ang) * W) + ' ' + n2(by + Math.cos(ang) * W) + 'L' + n2(bx + Math.sin(ang) * W) + ' ' + n2(by - Math.cos(ang) * W) + 'Z" fill="' + p.stroke + '"/>';
        });
        out.push('<g' + g + '><line x1="' + n2(p.x1) + '" y1="' + n2(p.y1) + '" x2="' + n2(p.x2) + '" y2="' + n2(p.y2) + '" stroke="' + p.stroke + '" stroke-width="' + sw + '"' +
          (p.dash ? ' stroke-dasharray="' + sw * 3 + ' ' + sw * 2 + '"' : '') + '/>' + head + '</g>');
      } else if (p.k === 'text') {
        var fs = p.size * PX, lhpx = fs * p.lh, lines = p.lines || [p.text];
        var bh = lines.length * lhpx;
        var top = p.valign === 'middle' ? p.y + (p.h - bh) / 2 : p.valign === 'bottom' ? p.y + p.h - bh : p.y;
        var tx = p.align === 'center' ? p.x + p.w / 2 : p.align === 'right' ? p.x + p.w : p.x;
        var anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
        out.push('<text font-family="Noto Sans KR" font-size="' + n2(fs) + '" font-weight="' + p.weight + '" fill="' + p.color + '" text-anchor="' + anchor + '"' + g + '>' +
          lines.map(function (ln, i) { return '<tspan x="' + n2(tx) + '" y="' + n2(top + (i + 0.5) * lhpx) + '" dominant-baseline="central">' + esc(ln) + '</tspan>'; }).join('') + '</text>');
      }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + S.W + ' ' + S.H + '" role="img">' + out.join('') + '</svg>';
  };

  /* ───── 용어 예시 장면 ─────
     UI.scenes[용어 id](무대, 조절판 값) → { ms, rest, at(t) }. parts.js가 UI.scenes를 새로 만들므로 그 뒤에 불러야 한다
     장면은 덱과 같은 배치 함수로 장을 만들고 t에 따라 step 차례로 보인다 */
  var SC = UI.scenes = UI.scenes || {};
  var TH = S.themes.paper;
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function inner(svg) { return svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')); }
  function canvas(body) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img">' + body + '</svg>'; }
  // 작은 장 하나: 1280×720 장을 (x, y)에 폭 w로 줄여 놓는다. hi면 강조 테두리
  function mini(prims, x, y, w, o) {
    o = o || {};
    var h = w * 9 / 16, op = o.op == null ? 1 : o.op;
    if (op <= 0) return '';
    return '<g' + (op < 1 ? ' opacity="' + n2(op) + '"' : '') + '><svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + n2(h) + '" viewBox="0 0 1280 720">' + inner(S.svg(prims, o.t)) + '</svg>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + n2(h) + '" fill="none" stroke="' + (o.hi ? TH.accent : '#b9bab3') + '" stroke-width="' + (o.hi ? 5 : 2) + '"/></g>';
  }
  // 바깥 캔버스의 이름표. 색은 무대 글자색(currentColor)을 따라 밝은·어두운 화면 모두에서 읽힌다
  function label(text, x, y, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="Noto Sans KR" font-size="' + (o.size || 32) + '" font-weight="' + (o.weight || 700) + '" fill="currentColor"' +
      (o.op != null ? ' opacity="' + n2(o.op) + '"' : '') + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' + esc(text) + '</text>';
  }
  // 무대에 그린다. make(th) → f(t) → { svg, info }. 글꼴 조각이 다 불리면 다시 만든다(줄바꿈이 바뀔 수 있어서)
  function paint(st, data, make, ms) {
    st.innerHTML = '<div class="u-slidebox"></div>';
    var box = st.firstChild, last = 0, f = make(TH);
    function draw(t) { last = t; var r = f(t); box.innerHTML = r.svg; return r.info; }
    S.ready(data, TH).then(function () { if (box.isConnected) { f = make(TH); draw(last); } });
    return { ms: ms || 4200, rest: 0.96, at: draw };
  }
  // 장 하나에 테두리를 둘러 무대에 꽉 차게
  function framed(svg) { return svg.replace(/<\/svg>$/, '<rect x="1" y="1" width="1278" height="718" fill="none" stroke="#b9bab3" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>'); }
  // op만큼 흐리게 묶는다. 0이면 그리지 않는다
  function fadeG(op, prims, t) { return op <= 0 ? '' : '<g' + (op < 1 ? ' opacity="' + n2(op) + '"' : '') + '>' + inner(S.svg(prims, t)) + '</g>'; }
  // 자리 표시자 안내 문구(한 줄, 회색)
  function hint(x, y, w, h, text, size) { return { k: 'text', x: x, y: y, w: w, h: h, text: text, size: size, weight: 400, color: TH.muted, align: 'left', valign: 'middle', lh: TH.lh, lines: [text] }; }
  function stepsOf(prims) { var n = 0; prims.forEach(function (p) { if (p.step != null) n = Math.max(n, p.step + 1); }); return n; }
  // 다이어그램 용어: 조절판 값으로 장을 고르고(make), step 차례로 나타낸다. names는 step마다 장면 이름
  function slideScene(make, names) {
    return function (st, c) {
      var slide = make(c);
      return paint(st, slide, function (th) {
        var prims = S.layouts[slide.layout].build(slide, th).prims, n = stepsOf(prims);
        return function (t) {
          var tt = clamp(t / 0.8), k = Math.min(n - 1, Math.floor(tt * (n + 0.5)));
          return { svg: framed(S.svg(prims, tt)), info: typeof names === 'function' ? names(k, n, c) : names[Math.min(k, names.length - 1)] };
        };
      });
    };
  }

  // 예시 내용: 덱(사내 문서 질의응답)과 같은 이야기를 조절판에 맞게 줄이거나 늘린다
  var EX = {
    venn2: { layout: 'venn', title: '모델이 아는 것과 회사만 아는 것은 거의 겹치지 않는다', sets: [{ name: '모델이 아는 것', one: '공개된 일반 지식, 언어, 추론' }, { name: '회사만 아는 것', one: '사내 규정, 제품 문서, 지난 결정' }], overlap: '공개된 회사 정보' },
    venn3: { layout: 'venn', title: '좋은 제품은 기획·디자인·개발이 겹치는 곳에서 나온다', sets: [{ name: '기획', one: '왜 만드는지' }, { name: '디자인', one: '보이는 꼴' }, { name: '개발', one: '돌아가는 코드' }], overlap: '좋은 제품' },
    layers: [{ name: '화면', one: '채팅 창, 답 아래에 출처 문서 표시' }, { name: 'API 관문', one: '로그인 확인과 요청 수 제한' }, { name: '오케스트레이터', one: '질문을 받아 검색을 부르고 프롬프트를 묶어 모델에 보냄' }, { name: '검색', one: '문서 색인에서 질문과 가까운 조각 상위 5개를 찾음' }, { name: '데이터', one: '문서 수집, 쪼개기, 임베딩, 색인 저장' }],
    people: [{ name: '직원', one: '규정과 제품을 묻는 사람', uses: '질문하고 답을 받음' }, { name: '문서 담당자', one: '규정과 제품 문서를 고치는 사람', uses: '검색할 문서 범위를 정함' }],
    externals: [{ name: '문서 저장소', one: '사내 규정과 제품 문서', rel: '바뀐 문서를 가져옴' }, { name: '언어 모델 API', one: '바깥 모델 서비스', rel: '답을 만들게 함' }, { name: '사내 계정', one: '직원 로그인', rel: '누가 묻는지 확인' }],
    pipe: [{ name: '가져오기', one: '문서 저장소에서 바뀐 문서만 밤마다' }, { name: '중복 거르기', one: '같은 내용의 옛 판을 뺌' }, { name: '쪼개기', one: '한 가지 내용씩 조각으로 나눔' }, { name: '보강', one: '조각마다 제목, 요약, 키워드를 붙임' }, { name: '임베딩', one: '조각을 뜻이 담긴 숫자 벡터로 바꿈' }],
    stages: [{ when: '1~2주', name: '질문 모으기', one: '자주 묻는 질문 100개와 답할 문서 범위' }, { when: '3~4주', name: '색인 만들기', one: '규정 문서를 쪼개 색인에 넣기' }, { when: '5~6주', name: '시범 열기', one: '한 팀에만 열기' }, { when: '7~8주', name: '평가', one: '근거성과 관련성 점수 재기' }, { when: '9~10주', name: '고침', one: '조각 크기와 프롬프트 고치기' }, { when: '11~12주', name: '전사 공개', one: '제품 문서를 더하고 사용 기록 살피기' }],
    cycle: [{ name: '평가 질문 돌리기', one: '질문 100개를 매주 같은 순서로' }, { name: '점수 보기', one: '근거성과 관련성' }, { name: '원인 찾기', one: '틀린 답의 검색 결과를 읽음' }, { name: '프롬프트 고치기', one: '조각 크기와 지시문' }, { name: '내보내기', one: '고친 판을 시범 팀에 배포' }]
  };
  function pick(list, idx) { return idx.map(function (i) { return list[i]; }); }

  SC['venn-diagram'] = slideScene(function (c) {
    var s = JSON.parse(JSON.stringify(c.sets === '3개' ? EX.venn3 : EX.venn2));
    if (c.labels === '이름만') s.sets.forEach(function (x) { delete x.one; });
    return s;
  }, function (k, n) { return k < n - 1 ? '원 ' + (k + 1) + ' · 크기와 겹친 넓이에 뜻 없음' : '겹친 곳에 공통점'; });

  SC['euler-diagram'] = slideScene(function (c) {
    var s = { layout: 'euler', title: '검색 대상은 규정과 제품 문서이고, 개인 메일은 들어가지 않는다', outer: { name: '검색 대상 문서', one: '색인에 들어가는 문서' },
      inner: [{ name: '규정', one: '인사·보안 규정' }, { name: '제품 문서', one: '사용 설명과 정책' }] };
    if (c.inner === '1개') s.inner = s.inner.slice(0, 1);
    if (c.apart === '떨어진 집합 있음') s.apart = { name: '개인 메일', one: '검색하지 않음' };
    return s;
  }, ['바깥 집합', '안에 포함된 집합 · 서로 겹치지 않음', '떨어진 집합 · 겹침을 그리지 않음']);

  SC['layered-architecture-diagram'] = slideScene(function (c) {
    var n = parseInt(c.layers, 10), L = n === 5 ? EX.layers : n === 3 ? [EX.layers[0], { name: '서비스', one: '검색을 부르고 모델에 질문을 보냄' }, EX.layers[4]] : pick(EX.layers, [0, 2, 3, 4]);
    L = JSON.parse(JSON.stringify(L));
    if (c.desc === '이름만') L.forEach(function (x) { delete x.one; });
    return { layout: 'layered-architecture', title: '시스템은 위층이 바로 아래층만 부르는 ' + n + '개 층으로 나뉜다', layers: L };
  }, function (k) { return k ? '층 ' + (k + 1) + ' · 위층은 바로 아래층만 부름' : '맨 위층: 사람이 만나는 곳'; });

  SC['box-and-arrow-diagram'] = slideScene(function (c) {
    var two = c.layout === '두 줄', s = { layout: 'box-and-arrow', title: '요청은 검사 두 곳을 지나야 답이 된다' };
    s.boxes = two
      ? [{ name: '질문', col: 0, row: 0 }, { name: '입력 검사', one: '개인 정보와 금지 주제를 거름', look: 'mark', col: 1, row: 0 }, { name: '답 쓰기', one: '검색한 조각으로', col: 2, row: 0 },
         { name: '출력 검사', one: '출처 없는 문장을 지움', look: 'mark', col: 2, row: 1 }, { name: '답', col: 1, row: 1 }, { name: '대화 기록', one: '평가에 다시 씀', col: 0, row: 1 }]
      : [{ name: '질문', col: 0, row: 0 }, { name: '입력 검사', one: '개인 정보와 금지 주제를 거름', look: 'mark', col: 1, row: 0 }, { name: '답 쓰기', one: '검색한 조각으로', col: 2, row: 0 },
         { name: '출력 검사', one: '출처 없는 문장을 지움', look: 'mark', col: 3, row: 0 }, { name: '답', col: 4, row: 0 }];
    s.arrows = [{ from: '질문', to: '입력 검사' }, { from: '입력 검사', to: '답 쓰기' }, { from: '답 쓰기', to: '출력 검사' }, { from: '출력 검사', to: '답' }];
    if (two) s.arrows.push({ from: '답', to: '대화 기록', label: '저장' }, { from: '입력 검사', to: '답', label: '걸리면 안내 문구', dash: true });
    if (c.legend === '범례 있음') s.legend = [{ look: 'mark', name: '검사' }, { look: 'plain', name: '처리 단계' }].concat(two ? [{ line: 'dash', name: '걸렸을 때' }] : []);
    return s;
  }, function (k, n, c) { return k < n - 1 || c.legend !== '범례 있음' ? '상자 ' + (k + 1) + ' · 꼴과 선마다 뜻을 정함' : '범례: 꼴과 선의 뜻'; });

  SC['c4-system-context'] = slideScene(function (c) {
    return { layout: 'c4-context', title: '시스템은 직원의 질문을 받아 사내 문서와 바깥 언어 모델 사이를 잇는다',
      people: EX.people.slice(0, c.people === '1명' ? 1 : 2), system: { name: '사내 질의응답', one: '문서를 찾아 근거와 함께 답함' },
      externals: c.externals === '2개' ? EX.externals.slice(0, 2) : EX.externals };
  }, function (k, n, c) { var p = c.people === '1명' ? 1 : 2; return k < p ? '사람' : k === p ? '내 시스템 하나 · 안쪽은 안 그림' : '바깥 시스템 · 화살표마다 하는 일'; });

  SC['c4-container'] = slideScene(function (c) {
    var four = c.size !== '컨테이너 3개';
    var nodes = [{ name: '채팅 화면', tech: '웹 앱', one: '질문을 받고 답과 출처를 보임', look: 'app', col: 0, row: 0 }, { name: '오케스트레이터', tech: 'API 서버', one: '검색과 모델 호출을 차례로 부름', look: 'app', col: 1, row: 0 },
      { name: '언어 모델 API', tech: '바깥 서비스', one: '프롬프트를 받아 답을 씀', look: 'ext', col: 2, row: 0 }, { name: '검색 색인', tech: '벡터 DB', one: '문서 조각과 벡터', look: 'store', col: four ? 0 : 1, row: 1 }];
    var links = [{ from: '채팅 화면', to: '오케스트레이터', label: '질문' }, { from: '오케스트레이터', to: '언어 모델 API', label: '프롬프트' }, { from: '오케스트레이터', to: '검색 색인', label: '비슷한 조각 찾기' }];
    if (four) {
      nodes.push({ name: '수집 작업', tech: '예약 작업', one: '바뀐 문서를 쪼개고 임베딩', look: 'app', col: 1, row: 1 }, { name: '문서 저장소', tech: '바깥 시스템', one: '사내 규정과 제품 문서', look: 'ext', col: 2, row: 1 });
      links.push({ from: '수집 작업', to: '검색 색인', label: '조각 저장' }, { from: '수집 작업', to: '문서 저장소', label: '바뀐 문서 읽기' });
    }
    return { layout: 'c4-container', title: '질문은 오케스트레이터 하나가 처리하고, 색인은 ' + (four ? '수집 작업이 따로 만든다' : '미리 만들어 둔다'), system: '사내 질의응답', nodes: nodes, links: links, legend: c.legend !== '범례 없음' };
  }, function (k, n, c) { return k < n - 1 ? '컨테이너 ' + (k + 1) + ' · 이름, [기술], 하는 일' : '점선 경계 = 내 시스템' + (c.legend !== '범례 없음' ? ' · 범례' : ''); });

  SC['pipeline-diagram'] = slideScene(function (c) {
    var n = parseInt(c.steps, 10), st = n === 5 ? EX.pipe : n === 3 ? pick(EX.pipe, [0, 2, 4]) : pick(EX.pipe, [0, 2, 3, 4]);
    var s = { layout: 'pipeline', title: '문서는 ' + n + '단계를 거쳐 ' + (c.store === '끝에 저장소' ? '검색 색인에 들어간다' : '검색할 수 있는 조각이 된다'), steps: st };
    if (c.store === '끝에 저장소') s.store = { name: '검색 색인', one: '조각과 벡터를 함께 저장' };
    return s;
  }, function (k, n, c) { return k === n - 1 && c.store === '끝에 저장소' ? '끝에 결과가 쌓이는 저장소' : '단계 ' + (k + 1) + ' · 왼쪽에서 오른쪽으로'; });

  SC['sequence-diagram'] = slideScene(function (c) {
    var five = c.actors === '5개', s = { layout: 'sequence', title: '질문 하나는 검색 한 번과 모델 호출 한 번을 거쳐 돌아온다' };
    s.actors = five ? [{ name: '직원' }, { name: '채팅 화면' }, { name: '오케스트레이터' }, { name: '검색 색인' }, { name: '언어 모델' }] : [{ name: '채팅 화면' }, { name: '오케스트레이터' }, { name: '언어 모델' }];
    s.messages = five
      ? [{ from: '직원', to: '채팅 화면', text: '질문 입력' }, { from: '채팅 화면', to: '오케스트레이터', text: '질문과 직원 정보' }, { from: '오케스트레이터', to: '검색 색인', text: '비슷한 조각 찾기' },
         { from: '검색 색인', to: '오케스트레이터', text: '조각 상위 5개', back: true }, { from: '오케스트레이터', to: '언어 모델', text: '질문과 조각을 묶어 보냄' }, { from: '언어 모델', to: '오케스트레이터', text: '답 초안', back: true },
         { from: '오케스트레이터', to: '채팅 화면', text: '답과 출처 목록', back: true }, { from: '채팅 화면', to: '직원', text: '답 아래에 출처 표시', back: true }]
      : [{ from: '채팅 화면', to: '오케스트레이터', text: '질문' }, { from: '오케스트레이터', to: '언어 모델', text: '질문과 검색한 조각' }, { from: '언어 모델', to: '오케스트레이터', text: '답 초안', back: true }, { from: '오케스트레이터', to: '채팅 화면', text: '답과 출처', back: true }];
    if (c.reply === '답 화살표 생략') s.messages = s.messages.filter(function (m) { return !m.back; });
    return s;
  }, function (k) { return k ? '메시지 ' + k + ' · 위에서 아래로 시간 순서' : '참여자와 생명선'; });

  SC['timeline-diagram'] = slideScene(function (c) {
    var six = c.stages === '6단계';
    var st = six ? EX.stages : [EX.stages[0], { when: '3~6주', name: '시범 열기', one: '규정 문서만으로 한 팀에 열기' }, { when: '7~10주', name: '평가와 고침', one: '근거성과 관련성 점수가 기준을 넘을 때까지' }, EX.stages[5]];
    var s = { layout: 'timeline', title: '12주 안에 한 팀 시범에서 전사 공개까지 간다', stages: st };
    if (c.now === '지금 표시') s.now = 1;
    return s;
  }, function (k, n, c) { return c.now === '지금 표시' && k === 1 ? '지금 단계: 앞은 채운 점, 뒤는 빈 점' : '시점 ' + (k + 1) + ' · 위에 언제, 아래에 무엇'; });

  SC['cycle-diagram'] = slideScene(function (c) {
    var n = parseInt(c.steps, 10), st = n === 5 ? EX.cycle : n === 3 ? pick(EX.cycle, [0, 2, 3]) : EX.cycle.slice(0, 4);
    var s = { layout: 'cycle', title: '답의 질은 매주 평가하고 고치는 고리로 올린다', steps: st };
    if (c.center === '가운데 글') s.center = '매주 평가 고리';
    return s;
  }, function (k, n) { return k < n - 1 ? '단계 ' + (k + 1) + ' → 다음 단계' : '마지막 단계에서 처음으로 · 끝이 없음'; });

  SC['two-column-comparison'] = slideScene(function (c) {
    var n = c.rows === '4줄' ? 4 : 3, s;
    if (c.pair === '지금 · 바꾼 뒤') s = { layout: 'two-column', title: '질의응답을 들이면 규정 질문의 답을 하루가 아니라 몇 초 만에 받는다',
      left: { head: '지금', items: ['담당자에게 메신저로 물어봄', '답을 받기까지 평균 하루', '담당자마다 답이 조금씩 다름', '어느 문서가 근거인지 남지 않음'] },
      right: { head: '바꾼 뒤', items: ['채팅 창에 물으면 바로 답', '답을 받기까지 10초 안팎', '같은 문서를 근거로 같은 답', '답 아래에 근거 문서 링크'] } };
    else s = { layout: 'two-column', title: '규정에 적힌 것은 답하지만, 판단이 필요한 질문은 아직 사람에게 넘긴다',
      left: { head: '할 수 있는 것', items: ['규정과 제품 문서에 있는 내용 답하기', '답마다 근거 문서 보여 주기', '문서에 없으면 모른다고 답하기', '여러 문서를 모아 요약하기'] },
      right: { head: '아직 못 하는 것', items: ['문서끼리 다를 때 어느 쪽이 맞는지 판단하기', '표와 그림 안의 내용 읽기', '직원 권한에 따라 다른 답 주기', '옛 판과 새 판 문서 가리기'] } };
    s.left.items = s.left.items.slice(0, n); s.right.items = s.right.items.slice(0, n);
    return s;
  }, function (k) { return k ? ['첫째', '둘째', '셋째', '넷째', '다섯째'][k - 1] + ' 줄 · 양쪽이 같은 높이로' : '같은 틀의 두 단'; });

  /* 슬라이드 틀 용어: 장 여러 개를 한 캔버스에 놓는다 */
  // 자리 표시자(점선 상자)만 있는 장. kind: master, title, content, two
  function placeholders(kind, band, page) {
    var P = [{ k: 'rect', x: 0, y: 0, w: 1280, h: 720, fill: TH.bg }, { k: 'rect', x: 0, y: 0, w: 1280, h: 18, fill: band }];
    function ph(x, y, w, h, txt, size) {
      P.push({ k: 'rect', x: x, y: y, w: w, h: h, stroke: TH.muted, sw: 3, dash: true });
      P.push(hint(x + 24, y, w - 48, h, txt, size));
    }
    if (kind === 'title') { ph(104, 220, 980, 150, '제목', 44); ph(104, 400, 900, 90, '부제', 26); }
    else ph(64, 36, 1152, 100, kind === 'master' ? '마스터 제목 스타일' : '제목', 32);
    if (kind === 'master' || kind === 'content') ph(64, 170, 1152, 470, kind === 'master' ? '마스터 텍스트 스타일' : '본문', 26);
    if (kind === 'two') { ph(64, 170, 552, 470, '왼쪽', 26); ph(664, 170, 552, 470, '오른쪽', 26); }
    if (page) P.push({ k: 'text', x: 1100, y: 664, w: 116, h: 36, text: '‹#›', size: 18, weight: 700, color: TH.muted, align: 'right', valign: 'middle', lh: TH.lh, lines: ['‹#›'] });
    return P;
  }
  var KINDS = [['title', '제목 장'], ['content', '내용 장'], ['two', '2단 비교']];

  SC['slide-master'] = function (st, c) {
    var NEW = '#b4579a', color = c.change === '띠 색';
    return paint(st, {}, function () {
      return function (t) {
        var mOn = t >= 0.55, out = label('슬라이드 마스터', 40, 172, { op: clamp(t / 0.1) });
        out += mini(placeholders('master', color && mOn ? NEW : TH.accent, !color && mOn), 40, 196, 560, { op: clamp(t / 0.12), hi: t >= 0.5 && t < 0.66 });
        KINDS.forEach(function (k, i) {
          var y = 40 + i * 232, op = clamp((t - 0.18 - i * 0.09) / 0.1), on = t >= 0.66 + i * 0.07;
          out += '<line x1="600" y1="353" x2="720" y2="' + (y + 98) + '" stroke="currentColor" stroke-opacity="' + n2(0.35 * op) + '" stroke-width="3"/>';
          out += label('레이아웃: ' + k[1], 740, y - 6, { size: 26, op: op });
          out += mini(placeholders(k[0], color && on ? NEW : TH.accent, !color && on), 740, y + 6, 330, { op: op });
        });
        var info = t < 0.18 ? '마스터: 모든 장이 물려받는 바탕, 색, 글꼴, 고정 요소' : t < 0.5 ? '레이아웃이 마스터를 물려받음' : t < 0.66 ? '마스터 한 곳만 고침(' + (color ? '띠 색' : '쪽 번호') + ')' : '모든 레이아웃이 함께 바뀜';
        return { svg: canvas(out), info: info };
      };
    }, 5200);
  };

  var DECKS = {
    title: { layout: 'title', title: '사내 문서 질의응답은 어떻게 만들어지나', sub: '회사 문서를 검색해 근거와 함께 답하는 AI 시스템의 구성', by: '플랫폼팀 · 2026년 11월' },
    content: { layout: 'layered-architecture', title: '시스템은 위층이 바로 아래층만 부르는 4개 층으로 나뉜다', layers: pick(EX.layers, [0, 2, 3, 4]) },
    two: { layout: 'two-column', title: '규정에 적힌 것은 답하지만, 판단이 필요한 질문은 아직 사람에게 넘긴다',
      left: { head: '할 수 있는 것', items: ['규정과 제품 문서에 있는 내용 답하기', '답마다 근거 문서 보여 주기', '문서에 없으면 모른다고 답하기'] },
      right: { head: '아직 못 하는 것', items: ['문서끼리 다를 때 어느 쪽이 맞는지 판단하기', '표와 그림 안의 내용 읽기', '직원 권한에 따라 다른 답 주기'] } }
  };
  SC['slide-layout'] = function (st, c) {
    var ki = c.layout === '제목 장' ? 0 : c.layout === '2단 비교' ? 2 : 1, slide = DECKS[KINDS[ki][0]];
    return paint(st, slide, function (th) {
      var prims = S.layouts[slide.layout].build(slide, th).prims;
      return function (t) {
        var out = '', pickT = t >= 0.3, op2 = clamp((t - 0.42) / 0.1);
        KINDS.forEach(function (k, i) {
          var x = 50 + i * 425, op = clamp((t - i * 0.07) / 0.1);
          out += label(k[1], x, 40, { size: 28, op: op * (pickT && i !== ki ? 0.45 : 1) });
          out += mini(placeholders(k[0], TH.accent, false), x, 56, 330, { op: op * (pickT && i !== ki ? 0.45 : 1), hi: pickT && i === ki });
        });
        var cx = 50 + ki * 425 + 165;
        out += '<line x1="' + cx + '" y1="250" x2="640" y2="318" stroke="' + TH.accent + '" stroke-width="4" opacity="' + n2(op2) + '"/>';
        out += mini(prims, 340, 330, 600, { op: op2, t: clamp((t - 0.45) / 0.4) });
        var info = t < 0.3 ? '레이아웃: 자리 표시자를 미리 놓은 틀 ' + KINDS.length + '개' : t < 0.42 ? '"' + KINDS[ki][1] + '" 레이아웃을 고름' : '내용을 넣으면 자리대로 놓임';
        return { svg: canvas(out), info: info };
      };
    }, 4600);
  };

  SC['placeholder'] = function (st, c) {
    var slide = JSON.parse(JSON.stringify(DECKS.content));
    if (c.fill === '짧은 제목') slide.title = '시스템은 4개 층으로 나뉜다';
    return paint(st, slide, function (th) {
      var prims = S.layouts[slide.layout].build(slide, th).prims, title = prims.filter(function (p) { return p.ph; })[0];
      var rest = prims.filter(function (p) { return p !== title && p.step == null; }), body = prims.filter(function (p) { return p.step != null; });
      var box = { x: title.x - 12, y: title.y - 8, w: title.w + 24, h: title.h + 16 };
      return function (t) {
        var fill = clamp((t - 0.25) / 0.12), dash = 1 - clamp((t - 0.5) / 0.1), bop = clamp((t - 0.6) / 0.1);
        var out = inner(S.svg(rest)) +
          fadeG(dash, [{ k: 'rect', x: box.x, y: box.y, w: box.w, h: box.h, stroke: fill > 0 ? TH.accent : TH.muted, sw: 3, dash: true }]) +
          fadeG(1 - fill, [hint(box.x + 20, box.y, box.w - 40, box.h, '제목을 입력하려면 클릭', 26)]) + fadeG(fill, [title]) +
          fadeG(1 - bop, [{ k: 'rect', x: 64, y: 176, w: 1152, h: 480, stroke: TH.muted, sw: 3, dash: true }, hint(88, 176, 1100, 480, '내용을 넣으려면 클릭', 22)]) +
          fadeG(bop, body, clamp((t - 0.6) / 0.3));
        var info = t < 0.25 ? '레이아웃의 빈 자리(점선)와 안내 문구' : t < 0.5 ? '글을 넣으면 자리의 위치·크기·글꼴을 따름' + (title.lines.length > 1 ? ' · 두 줄도 자리 안에서' : '') : t < 0.6 ? '점선은 편집할 때만 보임' : '본문 자리에 다이어그램';
        return { svg: framed(canvas(out)), info: info };
      };
    }, 4600);
  };

  SC['action-title'] = function (st, c) {
    var venn = c.body === '벤', slide = venn ? EX.venn2 : DECKS.content, topic = venn ? '모델과 회사 지식' : '시스템 구조';
    var other = JSON.parse(JSON.stringify(slide)); other.title = topic;
    return paint(st, slide, function (th) {
      var A = S.layouts[slide.layout].build(slide, th).prims, B = S.layouts[other.layout].build(other, th).prims;
      var tA = A.filter(function (p) { return p.ph; })[0], tB = B.filter(function (p) { return p.ph; })[0];
      var rest = A.filter(function (p) { return p !== tA; });
      return function (t) {
        var strike = clamp((t - 0.3) / 0.1), gone = clamp((t - 0.45) / 0.1), come = clamp((t - 0.55) / 0.12);
        var out = inner(S.svg(rest));
        if (gone < 1) {
          var w = S.measure(topic, tB.size, tB.weight, th.font), y = tB.y + tB.size * PX * th.lh / 2;
          out += '<g opacity="' + n2(1 - gone) + '">' + inner(S.svg([tB])) + '<line x1="' + tB.x + '" y1="' + n2(y) + '" x2="' + n2(tB.x + w * strike) + '" y2="' + n2(y) + '" stroke="#c4321f" stroke-width="4"/></g>';
          if (strike > 0) out += '<text x="' + n2(tB.x + w + 24) + '" y="' + n2(y) + '" dominant-baseline="central" font-family="Noto Sans KR" font-size="22" fill="#c4321f" opacity="' + n2(strike) + '">무엇에 대한 장인지만 말함</text>';
        }
        out += fadeG(come, [tA]);
        var info = t < 0.3 ? '주제어 제목: "' + topic + '"' : t < 0.55 ? '주제어는 이 장에서 기억할 말을 주지 않음' : 'Action Title: 이 장의 주장을 한 문장으로' + (tA.lines.length > 1 ? ' · 두 줄까지' : '');
        return { svg: framed(canvas(out)), info: info };
      };
    }, 4600);
  };

  SC['speaker-notes'] = function (st, c) {
    var slide = EX.venn2, notes = '모델은 학습 때 본 공개 자료만 압니다. 직원이 묻는 것은 대부분 오른쪽에 있어서, 질문할 때마다 회사 문서를 찾아 붙여 줘야 합니다. 원 크기는 양을 뜻하지 않습니다.';
    var presenter = c.view === '발표자 보기';
    return paint(st, { s: slide, n: notes }, function (th) {
      var prims = S.layouts[slide.layout].build(slide, th).prims, next = S.layouts[DECKS.content.layout].build(DECKS.content, th).prims, e = [];
      var nb = presenter ? S.textBox({ x: 820, y: 380, w: 420, text: notes, size: 15, color: '#f1f1ee', max: 8 }, th, e, 'notes')
        : S.textBox({ x: 214, y: 572, w: 852, text: notes, size: 14, color: th.ink, max: 4 }, th, e, 'notes');
      return function (t) {
        var k = Math.floor(clamp((t - 0.3) / 0.5) * nb.lines.length + 0.999), shown = Object.assign({}, nb, { lines: nb.lines.slice(0, k) }), out;
        if (presenter) {
          out = '<rect width="1280" height="720" fill="#25272b"/>' + '<text x="30" y="56" font-family="Noto Sans KR" font-size="30" font-weight="700" fill="#f1f1ee">0:03:12</text>' +
            mini(prims, 30, 90, 760) + '<text x="820" y="76" font-family="Noto Sans KR" font-size="22" fill="#b9bab3">다음 슬라이드</text>' + mini(next, 820, 90, 420) +
            '<text x="820" y="350" font-family="Noto Sans KR" font-size="22" fill="#b9bab3">노트</text>' + inner(S.svg([shown])) +
            '<text x="30" y="600" font-family="Noto Sans KR" font-size="22" fill="#b9bab3">청중 화면에는 왼쪽 장만 보임</text>';
        } else {
          out = '<rect width="1280" height="720" fill="#e9e8e3"/>' + mini(prims, 190, 24, 900) +
            '<rect x="190" y="556" width="900" height="146" fill="#ffffff" stroke="#b9bab3" stroke-width="2"/>' + inner(S.svg([shown]));
          if (!k) out += '<text x="214" y="600" font-family="Noto Sans KR" font-size="22" fill="#9a9c98">노트를 입력하려면 클릭</text>';
        }
        var info = t < 0.3 ? (presenter ? '발표자 보기: 현재 장, 다음 장, 노트, 시간' : '장 아래 노트 창') : '말할 내용을 노트에 · 청중에게는 안 보임';
        return { svg: canvas(out), info: info };
      };
    }, 4600);
  };
})();
