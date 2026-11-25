/* 조합 화면: 덱. recipes.json에서 slides가 있는 항목마다 UI.screens[id]로 등록한다 (UI.deckScreens(recipes))
   장 목록 → slides.js 배치 함수 → SVG 미리보기. 같은 도형 목록으로 .pptx를 내려받는다(slides-pptx.js)
   UI.screens[id](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, S = UI.slide;

  function deck(r, root, opt) {
    var th = S.themes.paper, mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var st = { i: 0, labels: false }, built = [], raf = null, tm = null, alive = true;
    var D = { id: r.id, name: r.name, slides: r.slides };
    root.innerHTML =
      '<div class="u dk">' +
        '<div class="dk-side" id="dk-side"><p class="dk-wait">글꼴을 불러오는 중</p></div>' +
        '<div class="dk-main">' +
          '<div class="dk-bar"><button type="button" class="u-btn" data-act="prev" aria-label="이전 장">‹ 이전</button><span class="num" id="dk-num" aria-live="polite"></span>' +
            '<button type="button" class="u-btn" data-act="next" aria-label="다음 장">다음 ›</button><span style="flex:1"></span>' +
            '<button type="button" class="u-btn" data-act="json">입력 JSON 복사</button><button type="button" class="u-btn primary" data-act="pptx">.pptx 내려받기</button></div>' +
          '<p class="dk-bar"><span class="st" id="dk-st" role="status"></span></p>' +
          '<div class="dk-stage" id="dk-stage"></div>' +
          '<div class="dk-notes" data-term="speaker-notes"><b>발표자 노트 · 청중에게는 안 보임</b><p id="dk-notes"></p></div>' +
        '</div>' +
        '<div class="scr-labels" id="dk-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); }, scr = root.querySelector('.dk');
    function status(msg, bad) { var e = $('dk-st'); e.textContent = msg; e.classList.toggle('bad', !!bad); }
    function noTerm(svg) { return svg.replace(/ data-term="[^"]*"/g, ''); }

    // 마스터: 이 덱의 장이 물려받는 바탕과 제목 자리 표시자(slides-pptx.js의 defineSlideMaster와 같은 자리)
    function masterSVG() {
      var t = built[1] ? built[1].prims.filter(function (p) { return p.ph; })[0] : null;
      var P = [{ k: 'rect', x: 0, y: 0, w: S.W, h: S.H, fill: th.bg }];
      if (t) P.push({ k: 'rect', x: t.x - 10, y: t.y - 8, w: t.w + 20, h: t.h + 16, stroke: th.muted, sw: 4, dash: true, term: 'placeholder' },
        { k: 'text', x: t.x + 14, y: t.y, w: 600, h: t.h, text: '제목', size: 30, weight: 400, color: th.muted, align: 'left', valign: 'middle', lh: th.lh, lines: ['제목'] });
      return S.svg(P);
    }
    function side() {
      $('dk-side').innerHTML = '<div class="dk-master" data-term="slide-master"><h4>슬라이드 마스터</h4>' + masterSVG() +
        '<p>모든 장이 물려받는 바탕과 제목 자리. 제목은 이 자리 표시자에 들어갑니다.</p></div><h4>장 ' + built.length + '개</h4>' +
        built.map(function (b, i) {
          return '<button type="button" class="dk-th" data-i="' + i + '" aria-current="' + (i === st.i) + '">' + noTerm(S.svg(b.prims)) +
            '<span' + (i === st.i ? ' data-term="slide-layout"' : '') + '>' + (i + 1) + ' · 레이아웃 ' + esc(r.slides[i].layout) + '</span></button>';
        }).join('');
    }
    function stop() { cancelAnimationFrame(raf); clearTimeout(tm); raf = tm = null; }
    // 장을 바꾸면 step 차례로 나타난다. 동작 줄이기면 바로 다 보인다
    function show(i, still) {
      stop();
      st.i = Math.max(0, Math.min(built.length - 1, i));
      var b = built[st.i], el = $('dk-stage');
      $('dk-num').textContent = (st.i + 1) + ' / ' + built.length;
      $('dk-notes').textContent = r.slides[st.i].notes || '';
      root.querySelectorAll('.dk-th').forEach(function (t, j) {
        t.setAttribute('aria-current', String(j === st.i));
        var cap = t.querySelector('span'); if (j === st.i) cap.setAttribute('data-term', 'slide-layout'); else cap.removeAttribute('data-term');
      });
      if (still || mq.matches) { el.innerHTML = S.svg(b.prims); drawLabels(); return; }
      var start = performance.now();
      (function step() {
        stop();
        if (!alive) return;
        var p = Math.min(1, (performance.now() - start) / 1400);
        el.innerHTML = S.svg(b.prims, p < 1 ? p : undefined);
        if (p < 1) { raf = requestAnimationFrame(step); tm = setTimeout(step, 50); } else drawLabels();
      })();
    }

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('dk-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'speaker-notes' || id === 'two-column-comparison' ? 'in-br' : ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }

    root.addEventListener('click', function (e) {
      var el = e.target.closest('button');
      if (!el || !root.contains(el)) return;
      if (el.closest('#dk-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.hasAttribute('data-i')) { show(+el.getAttribute('data-i')); return; }
      switch (el.getAttribute('data-act')) {
        case 'prev': show(st.i - 1); break;
        case 'next': show(st.i + 1); break;
        case 'json':
          var txt = JSON.stringify(D, null, 2);
          (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
            .then(function () { status('입력 JSON을 복사했습니다. 장 내용을 바꿔 AI에게 넘기거나 같은 꼴로 덱을 만드세요.'); }, function () { status('복사하지 못했습니다. 브라우저가 클립보드를 막았습니다.', true); });
          break;
        case 'pptx':
          status('.pptx를 만드는 중');
          S.pptx(D, th).then(function () { status('내려받았습니다: ' + D.id + '.pptx (장 ' + built.length + '개, 발표자 노트 포함)'); }, function (err) {
            status(Array.isArray(err) ? '제한을 넘은 칸이 있어 만들지 않았습니다: ' + err.map(function (x) { return x.slide + '장 ' + x.slot + ' ' + x.msg; }).join(' · ') : err.message, true);
          });
          break;
      }
    });
    function onResize() { drawLabels(); }
    window.addEventListener('resize', onResize);

    S.ready(D, th).then(function () {
      if (!alive) return;
      built = r.slides.map(function (s, i) { return S.build(s, i, th); });
      var errs = [].concat.apply([], built.map(function (b) { return b.errors; }));
      if (errs.length) status('제한을 넘은 칸 ' + errs.length + '곳: ' + errs.map(function (x) { return x.slide + '장 ' + x.slot; }).join(', '), true);
      side();
      show(0);
    });

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      // 지금 장에 없는 용어: 그 용어가 처음 나오는 장으로 간다
      demo: function (id) {
        for (var i = 0; i < built.length; i++) if (built[i].prims.some(function (p) { return p.term === id; })) { show(i, true); return; }
        drawLabels();
      },
      destroy: function () { alive = false; stop(); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  }

  UI.deckScreens = function (recipes) {
    recipes.forEach(function (r) { if (r.slides) UI.screens[r.id] = function (root, opt) { return deck(r, root, opt); }; });
  };
})();
