/* 조합 화면: 상품 목록. 겨울 옷 가게의 목록 페이지에 격자·스크롤 용어 11개를 엮는다 (recipes.json의 product-list)
   왼쪽 페이지(#pl-main)는 실제로 스크롤된다. 상품 목록은 "더 보기 단추"와 "무한 스크롤"을 바꿔 가며 견줄 수 있다
   오른쪽 앱 미리보기는 후기 12,480개를 보이는 줄만 그리고, 맨 위에서 당기거나 ↻ 단추로 새로고침한다
   UI.screens['product-list'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, PER = 8, TOTAL = 120, AUTO_MAX = 3, ROW = 56, BUF = 5, PULL = 72;
  var SLIDES = [['겨울 패딩 기획전', '12월 1일까지 최대 30%'], ['니트 30% 할인', '이번 주말까지'], ['첼시 부츠 새로 들어옴', '가죽·스웨이드 두 가지'], ['무료배송 주간', '모든 상품 무료배송'], ['장갑·비니 묶음', '둘 사면 20% 할인']];
  var BENTO = [['겨울 패딩 기획전', '가볍고 따뜻한 패딩 42종'], ['신상품', '이번 주 18종'], ['할인', '최대 30%'], ['무료배송', '오늘 주문하면 내일'], ['쿠폰', '첫 주문 5,000원']];
  var NAMES = ['겨울 패딩', '울 코트', '니트 가디건', '머플러', '첼시 부츠', '가죽 장갑', '비니', '후드티', '기모 바지', '플리스'];
  var COLORS = ['검정', '회색', '남색', '베이지', '갈색', '아이보리'];
  var MAS = [[120, '가볍고 따뜻해요', '민지 · 겨울 패딩'], [80, '색이 사진과 같아요', '준호 · 머플러'], [150, '한 치수 크게 샀어요', '서연 · 울 코트'], [96, '발이 편해요', '도윤 · 첼시 부츠'],
    [132, '보풀이 안 나요', '하은 · 니트 가디건'], [70, '선물했어요', '지우 · 가죽 장갑'], [110, '안감이 부드러워요', '태오 · 플리스'], [88, '세탁해도 그대로', '유나 · 후드티'], [126, '바람이 안 들어와요', '시우 · 겨울 패딩']];
  var WHO = ['민지', '준호', '서연', '도윤', '하은', '지우', '태오', '유나', '시우', '예린'];
  var SAY = ['따뜻해요', '사이즈가 딱 맞아요', '배송이 빨랐어요', '색이 예뻐요', '가벼워요', '한 치수 크게 사세요', '보풀이 조금 있어요', '두 번째 샀어요'];
  var NEW = [['예린', '방금 받았는데 따뜻해요'], ['태오', '오늘 도착했어요'], ['하은', '재구매했어요']];

  function ph(i, pct) { return 'color-mix(in srgb, ' + ['var(--u-accent)', 'var(--u-ok)', 'var(--u-warn)', 'var(--u-info)', 'var(--u-danger)'][i % 5] + ' ' + (pct || 24) + '%, var(--u-panel))'; }
  function won(n) { return n.toLocaleString('ko-KR') + '원'; }
  function good(i) { return '<a href="#" class="pl-good"><i style="background:' + ph(i) + '"></i><b>' + NAMES[i % 10] + ' ' + COLORS[(i * 7) % 6] + '</b><span>' + won(29000 + (i * 13 % 60) * 1000) + '</span></a>'; }
  function skel() { return '<div class="pl-good pl-sk" aria-hidden="true"><i class="u-skel"></i><i class="u-skel"></i><i class="u-skel" style="width:50%"></i></div>'; }

  UI.screens['product-list'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var st = { labels: false, mode: 'more', shown: PER, auto: 0, busy: false, slide: 0, added: 0, refreshes: 0, pulling: null }, timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function $(id) { return document.getElementById(id); }
    var grid0 = ''; for (var g = 0; g < PER; g++) grid0 += good(g);

    root.innerHTML =
      '<div class="u scr pl-scr">' +
        '<div class="pl-pane"><div class="pl-main" id="pl-main">' +
          '<header class="pl-top"><b class="pl-logo">겨울 상점</b><nav aria-label="분류">' + ['아우터', '니트', '신발', '소품'].map(function (n, i) { return '<a href="#"' + (i ? '' : ' aria-current="page"') + '>' + n + '</a>'; }).join('') + '</nav><span class="pl-cart">장바구니 2</span></header>' +
          '<div class="pl-wrap">' +
            '<section class="pl-car" data-term="carousel" aria-roledescription="carousel" aria-label="기획전">' +
              '<div class="pl-slides" id="pl-slides">' + SLIDES.map(function (s, i) {
                return '<div class="pl-slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + SLIDES.length + '" style="background:' + ph(i, 34) + '"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
              }).join('') + '</div>' +
              '<button type="button" class="pl-arr prev" id="pl-prev" aria-label="이전 기획전">‹</button><button type="button" class="pl-arr next" id="pl-next" aria-label="다음 기획전">›</button>' +
              '<div class="pl-dots">' + SLIDES.map(function (s, i) { return '<button type="button" data-dot="' + i + '" aria-label="' + (i + 1) + '번째 기획전"></button>'; }).join('') + '</div>' +
            '</section>' +
            '<h3 class="pl-h">이번 주 추천</h3>' +
            '<div class="pl-bento" data-term="bento-grid">' + BENTO.map(function (b, i) { return '<a href="#" class="pl-tile' + (i ? '' : ' big') + '" style="background:' + ph(i, i ? 16 : 30) + '"><b>' + b[0] + '</b><span>' + b[1] + '</span></a>'; }).join('') + '</div>' +
            '<div class="pl-hrow"><h3 class="pl-h">최근 본 상품</h3><span class="grow"></span><button type="button" class="u-btn pl-rb" data-row="-1" aria-label="최근 본 상품 앞으로">‹</button><button type="button" class="u-btn pl-rb" data-row="1" aria-label="최근 본 상품 뒤로">›</button></div>' +
            '<div class="pl-rwrap"><div class="pl-row" id="pl-row" data-term="scroll-snap">' + [3, 1, 5, 0, 8, 6, 2, 9].map(function (i) { return good(i); }).join('') + '</div><i class="pl-peek" data-term="peek" aria-hidden="true"></i></div>' +
            '<div class="pl-hrow"><h3 class="pl-h" id="pl-gh">겨울 아우터 · ' + TOTAL + '개</h3><span class="grow"></span>' +
              '<div class="pl-mode" role="group" aria-label="다음 상품 불러오는 법" data-term="infinite-scroll"><button type="button" data-mode="more" aria-pressed="true">더 보기 단추</button><button type="button" data-mode="inf" aria-pressed="false">무한 스크롤</button></div></div>' +
            '<div class="pl-grid" id="pl-grid" data-term="card-grid" aria-labelledby="pl-gh">' + grid0 + '</div>' +
            '<div class="pl-moreb"><p class="pl-cnt" id="pl-cnt"></p><button type="button" class="u-btn" id="pl-more" data-term="load-more">더 보기</button><p class="pl-st" id="pl-st" role="status"></p></div>' +
            '<h3 class="pl-h">사진 후기</h3>' +
            '<div class="pl-mas" id="pl-mas" data-term="masonry-grid">' + MAS.map(function (m, i) { return '<div class="pl-mc"><i style="height:' + m[0] + 'px;background:' + ph(i + 1, 22) + '"></i><b>★★★★★ ' + m[1] + '</b><span>' + m[2] + '</span></div>'; }).join('') + '</div>' +
          '</div>' +
          '<footer class="pl-foot">고객센터 1588-0000 · 배송 안내 · 교환·환불 · 이용약관</footer>' +
        '</div></div>' +
        '<aside class="pl-app" aria-label="앱 미리보기"><div class="pl-phone">' +
          '<div class="pl-ph"><b id="pl-vh">후기 12,480개</b><span class="pl-hint" data-term="pull-to-refresh">↓ 당겨서 새로고침</span><button type="button" class="pl-ref" id="pl-ref" aria-label="후기 새로고침">↻</button></div>' +
          '<div class="pl-ind" id="pl-ind" aria-hidden="true"><span id="pl-ia">↓</span> <span id="pl-it"></span></div>' +
          '<div class="pl-vwrap" data-term="overscroll-behavior"><div class="pl-vl" id="pl-vl" tabindex="0" role="list" aria-label="후기 목록" data-term="virtualized-list"><div class="pl-vsp" id="pl-vsp"></div></div></div>' +
          '<div class="pl-vf"><span id="pl-vn"></span><span class="pl-vs" id="pl-vs" role="status"></span></div>' +
        '</div></aside>' +
        '<div class="scr-labels" id="pl-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.pl-scr'), main = $('pl-main'), top = root.querySelector('.pl-top'), slides = $('pl-slides'), row = $('pl-row'), gridEl = $('pl-grid'), more = $('pl-more'), mas = $('pl-mas');
    var vl = $('pl-vl'), vsp = $('pl-vsp'), ind = $('pl-ind');
    function smooth() { return reduce ? 'auto' : 'smooth'; }

    /* ── Carousel: scroll-snap 줄을 화살표·점·←→ 키로 넘긴다. 자동으로 넘기지 않는다 ── */
    function goSlide(i) { i = Math.max(0, Math.min(SLIDES.length - 1, i)); slides.scrollTo({ left: i * slides.clientWidth, behavior: smooth() }); }
    function onSlides() {
      var i = Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
      st.slide = i;
      $('pl-prev').disabled = i === 0; $('pl-next').disabled = i === SLIDES.length - 1;
      root.querySelectorAll('[data-dot]').forEach(function (d, k) { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }
    root.querySelector('.pl-car').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); goSlide(st.slide + (e.key === 'ArrowRight' ? 1 : -1)); }
    });
    slides.addEventListener('scroll', onSlides);

    /* ── 상품 목록: 더 보기 단추 / 무한 스크롤(세 번 뒤 단추로) ── */
    function counts() {
      var all = st.shown >= TOTAL, autoNow = st.mode === 'inf' && st.auto < AUTO_MAX && !all;
      $('pl-cnt').textContent = all ? TOTAL + '개를 모두 봤어요' : TOTAL + '개 중 ' + st.shown + '개를 봤어요' + (st.mode === 'inf' && !autoNow ? ' · 세 번 불러온 뒤에는 단추로 바꿔 아래 안내에 닿게 했어요' : '');
      more.hidden = all || autoNow || st.busy && st.mode === 'inf';
      more.disabled = st.busy; more.textContent = st.busy ? '불러오는 중…' : '더 보기';
    }
    function load(by) {
      if (st.busy || st.shown >= TOTAL) return;
      st.busy = true; counts();
      var n = Math.min(PER, TOTAL - st.shown), sk = ''; for (var i = 0; i < n; i++) sk += skel();
      gridEl.insertAdjacentHTML('beforeend', sk);
      later(function () {
        gridEl.querySelectorAll('.pl-sk').forEach(function (s) { s.remove(); });
        var h = ''; for (var i = st.shown; i < st.shown + n; i++) h += good(i);
        gridEl.insertAdjacentHTML('beforeend', h);
        var first = gridEl.children[st.shown];
        st.shown += n; st.busy = false;
        if (by === 'auto') st.auto++;
        $('pl-st').textContent = n + '개를 더 불러왔어요' + (st.shown >= TOTAL ? '. 모두 봤어요' : '');
        if (by === 'click') first.focus({ preventScroll: false });
        counts(); checkAuto(); if (st.labels) drawLabels();
      }, 450);
    }
    // 무한 스크롤: 목록 끝이 화면 아래 200px 안에 들어오면 다음 묶음을 부른다
    function checkAuto() {
      if (st.mode !== 'inf' || st.auto >= AUTO_MAX || st.busy || st.shown >= TOTAL) return;
      if (gridEl.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom < 200) load('auto');
    }
    function setMode(m) {
      st.mode = m; st.auto = 0;
      root.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m)); });
      $('pl-st').textContent = m === 'inf' ? '끝에 닿으면 저절로 불러와요(세 번까지)' : '끝의 단추를 눌러 불러와요';
      counts(); checkAuto();
    }

    /* ── Masonry Grid: 가장 짧은 열 밑에 다음 카드. DOM 순서(=읽기 순서)는 1, 2, 3… 그대로 ── */
    function layoutMas() {
      var W = mas.clientWidth, n = W < 420 ? 2 : W < 640 ? 3 : 4, G = 10, cw = (W - G * (n - 1)) / n, col = [], k;
      for (k = 0; k < n; k++) col.push(0);
      [].forEach.call(mas.children, function (c) {
        c.style.width = cw + 'px';
        k = col.indexOf(Math.min.apply(null, col));
        c.style.transform = 'translate(' + k * (cw + G) + 'px,' + col[k] + 'px)';
        col[k] += c.offsetHeight + G;
      });
      mas.style.height = Math.max.apply(null, col) + 'px';
    }

    /* ── Virtualized List: 보이는 줄과 위아래 5줄만 그린다 ── */
    function count() { return 12480 + st.added; }
    function review(i) {
      if (i < st.added) { var nw = NEW[st.added - 1 - i]; return [nw[0], nw[1], true]; }
      var j = i - st.added; return [WHO[j % 10], NAMES[(j * 3) % 10] + ' · ' + SAY[(j * 7) % 8], false];
    }
    function renderVL() {
      var N = count(), y = vl.scrollTop, h = vl.clientHeight, a = Math.max(0, Math.floor(y / ROW) - BUF), b = Math.min(N - 1, Math.ceil((y + h) / ROW) + BUF), html = '';
      vsp.style.height = N * ROW + 'px';
      for (var i = a; i <= b; i++) {
        var r = review(i);
        html += '<div class="pl-vr' + (r[2] ? ' new' : '') + '" role="listitem" aria-setsize="' + N + '" aria-posinset="' + (i + 1) + '" style="top:' + i * ROW + 'px"><i style="background:' + ph(i, 30) + '">' + r[0][0] + '</i><span><b>' + r[0] + ' <small>★★★★' + (i % 4 ? '★' : '☆') + '</small></b>' + esc(r[1]) + '</span><em>' + (i + 1).toLocaleString('ko-KR') + '</em></div>';
      }
      vsp.innerHTML = html;
      $('pl-vh').textContent = '후기 ' + N.toLocaleString('ko-KR') + '개';
      $('pl-vn').textContent = '그린 줄 ' + (b - a + 1) + ' / ' + N.toLocaleString('ko-KR');
    }

    /* ── Pull to Refresh: 맨 위에서 72px 넘게 당겼다 놓으면 새로고침. ↻ 단추로도 된다 ── */
    function pullTo(d) {
      ind.style.height = d * 0.5 + 'px'; ind.classList.toggle('on', d > 0);
      $('pl-ia').style.transform = 'rotate(' + Math.min(180, d / PULL * 180) + 'deg)';
      $('pl-it').textContent = d >= PULL ? '놓으면 새로고침' : '당겨서 새로고침';
    }
    function refresh() {
      if (st.refreshing) return;
      st.refreshing = true; ind.classList.add('on', 'busy'); ind.style.height = '36px'; $('pl-ia').style.transform = ''; $('pl-it').textContent = '불러오는 중'; $('pl-ref').disabled = true;
      later(function () {
        var n = [2, 1, 0][Math.min(2, st.refreshes)];
        st.refreshes++; st.added += n; st.refreshing = false;
        ind.classList.remove('on', 'busy'); ind.style.height = '0px'; $('pl-ref').disabled = false;
        vl.scrollTop = 0; renderVL();
        $('pl-vs').textContent = n ? '새 후기 ' + n + '개' : '새 후기가 없어요';
      }, reduce ? 300 : 700);
    }
    function pullStart(y) { if (vl.scrollTop <= 0 && !st.refreshing) st.pulling = { y0: y, d: 0 }; }
    function pullMove(y) { if (!st.pulling) return false; var d = Math.max(0, y - st.pulling.y0); st.pulling.d = d; pullTo(d); return d > 0; }
    function pullEnd() { if (!st.pulling) return; var d = st.pulling.d; st.pulling = null; if (d >= PULL) refresh(); else { ind.style.height = '0px'; ind.classList.remove('on'); } }
    vl.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button === 0) { pullStart(e.clientY); if (st.pulling) vl.setPointerCapture(e.pointerId); } });
    vl.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') pullMove(e.clientY); });
    vl.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') pullEnd(); });
    vl.addEventListener('touchstart', function (e) { pullStart(e.touches[0].clientY); }, { passive: true });
    vl.addEventListener('touchmove', function (e) { if (pullMove(e.touches[0].clientY) && e.cancelable) e.preventDefault(); }, { passive: false });
    vl.addEventListener('touchend', pullEnd);
    vl.addEventListener('scroll', renderVL);

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button, a');
      if (!b || !root.contains(b)) return;
      if (b.closest('#pl-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.tagName === 'A') { e.preventDefault(); return; }
      if (b.id === 'pl-prev' || b.id === 'pl-next') goSlide(st.slide + (b.id === 'pl-next' ? 1 : -1));
      else if (b.hasAttribute('data-dot')) goSlide(+b.getAttribute('data-dot'));
      else if (b.hasAttribute('data-row')) { var c = row.firstElementChild; row.scrollBy({ left: +b.getAttribute('data-row') * (c.offsetWidth + 10), behavior: smooth() }); }
      else if (b.hasAttribute('data-mode')) setMode(b.getAttribute('data-mode'));
      else if (b === more) load('click');
      else if (b.id === 'pl-ref') refresh();
    });
    main.addEventListener('scroll', function () { checkAuto(); if (st.labels) drawLabels(); });
    [slides, row].forEach(function (x) { x.addEventListener('scroll', function () { if (st.labels) drawLabels(); }); });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('pl-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var hb = top.getBoundingClientRect().bottom;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) {
        return id === 'peek' || id === 'infinite-scroll' || id === 'pull-to-refresh' ? 'right' : id === 'load-more' || id === 'overscroll-behavior' ? 'below' : id === 'virtualized-list' ? 'in-bl' : '';
      }, function (el) { return main.contains(el) && !el.closest('.pl-top') && el.getBoundingClientRect().top < hb - 1; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { layoutMas(); renderVL(); slides.scrollLeft = st.slide * slides.clientWidth; onSlides(); drawLabels(); }
    window.addEventListener('resize', onResize);
    layoutMas(); renderVL(); onSlides(); counts();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      // 지금 화면에 없는 용어: 그 부품이 보이는 곳으로 왼쪽 페이지를 굴린다
      demo: function (id) {
        var sel = { 'carousel': '.pl-car', 'bento-grid': '.pl-bento', 'scroll-snap': '.pl-rwrap', 'peek': '.pl-rwrap', 'infinite-scroll': '.pl-mode', 'card-grid': '.pl-grid', 'load-more': '.pl-moreb', 'masonry-grid': '.pl-mas' }[id];
        if (sel) { var el = root.querySelector(sel); main.scrollTop += el.getBoundingClientRect().top - top.getBoundingClientRect().bottom - (id === 'load-more' ? 120 : 16); }
        later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
