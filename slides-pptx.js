/* 슬라이드 생성기의 .pptx 출력: slides.js가 만든 도형 목록 → PptxGenJS
   UI.slide.pptx(deck, theme) → Promise. 제한을 넘은 칸이 있으면 만들지 않고 오류 목록으로 거절한다
   PptxGenJS 묶음 파일(vendor/pptxgen.bundle.js, 약 460KB)은 처음 부를 때만 불러온다 */
(function () {
  var S = window.UI.slide;
  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var IN = 96;                                  // 무대 1 = 1/96인치
  function hex(c) { return c.replace('#', '').toUpperCase(); }
  function inch(v) { return Math.round(v / IN * 10000) / 10000; }

  var loading = null;
  function load() {
    if (window.PptxGenJS) return Promise.resolve();
    return loading || (loading = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = BASE + 'vendor/pptxgen.bundle.js';
      s.onload = ok;
      s.onerror = function () { loading = null; no(new Error('pptxgen.bundle.js를 불러오지 못했습니다')); };
      document.head.appendChild(s);
    }));
  }

  function isBg(p) { return p.k === 'rect' && !p.x && !p.y && p.w === S.W && p.h === S.H; }
  // 글상자 옵션. 줄바꿈은 PowerPoint에 맡기고(wrap) 여백 0, 줄 간격은 pt로 정해 둔다
  function textOpts(p, theme) {
    return {
      x: inch(p.x), y: inch(p.y), w: inch(p.w), h: inch(p.h),
      fontFace: theme.font, fontSize: p.size, bold: p.weight >= 600, color: hex(p.color),
      align: p.align, valign: p.valign, margin: 0, lineSpacing: Math.round(p.size * p.lh * 10) / 10,
      wrap: true, lang: 'ko-KR'
    };
  }
  function paint(p) {
    return {
      fill: p.fill ? { color: hex(p.fill), transparency: p.alpha != null ? Math.round((1 - p.alpha) * 100) : 0 } : { type: 'none' },
      line: p.stroke ? { color: hex(p.stroke), width: (p.sw || 1) * 0.75 } : { type: 'none' }
    };
  }
  function add(pptx, slide, p, theme) {
    var o;
    if (p.k === 'text') {
      if (p.ph) return slide.addText(p.text, Object.assign(textOpts(p, theme), { placeholder: p.ph }));
      return slide.addText(p.text, textOpts(p, theme));
    }
    if (p.k === 'line') {
      return slide.addShape(pptx.ShapeType.line, {
        x: inch(Math.min(p.x1, p.x2)), y: inch(Math.min(p.y1, p.y2)), w: inch(Math.abs(p.x2 - p.x1)), h: inch(Math.abs(p.y2 - p.y1)),
        flipH: p.x2 < p.x1, flipV: p.y2 < p.y1,
        line: { color: hex(p.stroke), width: (p.sw || 1) * 0.75, dashType: p.dash ? 'dash' : 'solid',
          endArrowType: p.arrow ? 'triangle' : undefined, beginArrowType: p.arrow === 'both' ? 'triangle' : undefined }
      });
    }
    o = Object.assign({ x: inch(p.x), y: inch(p.y), w: inch(p.w), h: inch(p.h) }, paint(p));
    if (p.k === 'rect') {
      if (p.r) o.rectRadius = inch(p.r);
      return slide.addShape(p.r ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, o);
    }
    if (p.k === 'ellipse') return slide.addShape(pptx.ShapeType.ellipse, o);
    if (p.k === 'can') return slide.addShape(pptx.ShapeType.can, o);
  }

  // 덱 → PptxGenJS 객체. 마스터는 레이아웃마다 하나(배경 + 제목 자리 표시자)
  S.pptxDeck = function (deck, theme) {
    var built = deck.slides.map(function (s, i) { return S.build(s, i, theme); });
    var errors = [].concat.apply([], built.map(function (b) { return b.errors; }));
    if (errors.length) return Promise.reject(errors);
    return load().then(function () {
      var pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = deck.name || '';
      var masters = {};
      deck.slides.forEach(function (s, i) {
        var prims = built[i].prims, bg = prims.filter(isBg)[0], ph = prims.filter(function (p) { return p.ph; })[0];
        if (!masters[s.layout]) {
          masters[s.layout] = true;
          pptx.defineSlideMaster({
            title: s.layout,
            background: { color: hex(bg ? bg.fill : theme.bg) },
            objects: ph ? [{ placeholder: { options: Object.assign(textOpts(ph, theme), { name: ph.ph, type: ph.ph }), text: '' } }] : []
          });
        }
        var slide = pptx.addSlide({ masterName: s.layout });
        prims.forEach(function (p) { if (p !== bg) add(pptx, slide, p, theme); });
        if (s.notes) slide.addNotes(s.notes);
      });
      return pptx;
    });
  };
  // 내려받기
  S.pptx = function (deck, theme) {
    return S.pptxDeck(deck, theme).then(function (pptx) { return pptx.writeFile({ fileName: (deck.id || 'deck') + '.pptx' }); });
  };
})();
