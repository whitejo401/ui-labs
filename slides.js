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
      lh: 1.3,                    // 줄 간격(글자 크기의 배수). .pptx에도 같은 값을 pt로 적는다
      slack: 0.9                  // 제한 검사는 이 비율로 좁힌 폭으로 한다(맑은 고딕으로 바뀌어도 들어가게)
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
  S.wrap = function (text, w, size, weight, fam) {
    var lines = [], cur = '';
    String(text).split(/\s+/).filter(Boolean).forEach(function (word) {
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
    return lines;
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
      color: o.color || theme.ink, align: o.align || 'left', valign: o.valign || 'top', lh: theme.lh, lines: lines,
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
    var D = three ? Math.min(box.h / 1.47, box.w / 1.9) : Math.min(box.h, box.w / 1.75);
    var R = D / 2, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var off = three ? R * 0.62 : R * 0.68;     // 가운데에서 원 중심까지
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
      var nameSize = three ? 18 : 22, oneSize = three ? 13 : 15;
      var nh = nameSize * th.lh * PX, oh = s.one ? oneSize * th.lh * PX * 2 : 0;
      var top = py - (nh + oh) / 2;
      prims.push(S.textBox({ x: px - lw / 2, y: top, w: lw, text: s.name, size: nameSize, weight: 700, color: col, align: 'center', step: i }, th, errors, 'sets[' + i + '].name'));
      if (s.one) prims.push(S.textBox({ x: px - lw / 2, y: top + nh, w: lw, text: s.one, size: oneSize, color: th.ink, align: 'center', max: 2, step: i }, th, errors, 'sets[' + i + '].one'));
    });
    if (d.overlap) {
      var ow = three ? R * 0.62 : (2 * R - 2 * off) * 0.86;
      var osz = three ? 13 : 15;
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
    var prims = [{ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg }];
    prims.push(S.textBox({ x: M, y: 40, w: S.W - 2 * M, text: s.title, size: 26, weight: 700, max: 2, ph: 'title', term: 'action-title' }, th, errors, 'title'));
    prims.push({ k: 'line', x1: M, y1: 150, x2: S.W - M, y2: 150, stroke: th.line, sw: 1.5 });
    if (page) prims.push(S.textBox({ x: S.W - M - 80, y: 676, w: 80, text: String(page), size: 11, color: th.muted, align: 'right' }, th, errors, 'page'));
    return { prims: prims, body: { x: M, y: 176, w: S.W - 2 * M, h: 480 } };
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

  // 덱의 장 하나를 만든다. 오류에는 몇째 장인지 붙인다
  S.build = function (slide, i, theme) {
    var L = S.layouts[slide.layout];
    if (!L) return { prims: [], errors: [{ slide: i + 1, slot: 'layout', msg: '없는 레이아웃 ' + slide.layout }] };
    var r = L.build(slide, theme, i + 1);
    r.errors.forEach(function (e) { e.slide = i + 1; });
    return r;
  };

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
        (p.stroke ? ' stroke="' + p.stroke + '" stroke-width="' + (p.sw || 1) + '"' : '');
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
          // 화살촉: 선 굵기의 3배(PowerPoint 중간 크기와 같은 비율로 잡음)
          var ang = Math.atan2(a[3] - a[1], a[2] - a[0]), L = Math.max(sw * 3, 6), W = L / 2;
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
})();
