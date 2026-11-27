/* 조합 화면: 연락처 목록. 연락처와 주고받은 사진에 스크롤 막대·색인 용어 8개를 엮는다 (recipes.json의 contacts)
   목록과 사진 격자는 브라우저 막대 대신 직접 그린 막대를 쓴다: 목록은 겹쳐 뜨는 얇은 막대, 사진은 끌면 날짜 말풍선이 뜨는 큰 손잡이
   UI.screens['contacts'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, GROUPS = ['회사', '가족', '거래처', '동호회', '학교'];
  var CHIPS = ['전체', '즐겨찾기', '최근 통화', '회사', '가족', '거래처', '동호회', '학교'];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  UI.screens['contacts'] = function (root, opt) {
    var people = UI.contacts(320).map(function (n, i) { return { n: n, g: GROUPS[i % 5], fav: i % 9 === 0, recent: i % 7 === 0, k: UI.cho(n) }; });
    // 사진: 2026년 11월부터 거꾸로 24달, 합 1,820장
    var MONTHS = [], left = 1820;
    for (var i = 0; i < 24; i++) { var mo = 11 - i, yr = 2026; while (mo < 1) { mo += 12; yr--; } var c = i === 23 ? left : 40 + (i * 37) % 70; left -= c; MONTHS.push([yr + '년 ' + mo + '월', c]); }
    var st = { labels: false, chip: '전체', sel: people[0].n }, timers = [], hideBar = null, hideHd = null;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function $(id) { return document.getElementById(id); }
    function ph(i) { return 'color-mix(in srgb, ' + ['var(--u-accent)', 'var(--u-ok)', 'var(--u-warn)', 'var(--u-info)', 'var(--u-danger)'][i % 5] + ' 26%, var(--u-panel))'; }

    root.innerHTML =
      '<div class="u scr ct-scr">' +
        '<section class="ct-pane" aria-labelledby="ct-h">' +
          '<div class="ct-head"><h2 id="ct-h">연락처 <small id="ct-n"></small></h2></div>' +
          '<div class="ct-chips"><button type="button" class="ct-arr" id="ct-cl" aria-label="필터 앞으로">‹</button>' +
            '<div class="ct-cvp" id="ct-cvp" data-term="hidden-scrollbar"><div class="ct-crow" role="group" aria-label="연락처 필터" data-term="chip-group">' +
              CHIPS.map(function (c) { return '<button type="button" data-chip="' + c + '" aria-pressed="' + (c === '전체') + '">' + c + '</button>'; }).join('') + '</div></div>' +
            '<i class="ct-sh l" id="ct-shl" aria-hidden="true"></i><i class="ct-sh r" id="ct-shr" aria-hidden="true" data-term="scroll-shadow"></i>' +
            '<button type="button" class="ct-arr" id="ct-cr" aria-label="필터 뒤로">›</button></div>' +
          '<div class="ct-body"><div class="ct-wrap" id="ct-wrap"><div class="ct-list" id="ct-list" tabindex="0" aria-label="연락처 목록"></div>' +
            '<div class="ct-track" id="ct-track" aria-hidden="true" data-term="overlay-scrollbar"><b id="ct-thumb"></b></div><b class="ct-bub" id="ct-bub" aria-hidden="true"></b></div>' +
            '<nav class="ct-index" id="ct-index" aria-label="초성 색인" data-term="section-index"></nav></div>' +
        '</section>' +
        '<section class="ct-photos" aria-labelledby="ct-ph"><div class="ct-head"><h2 id="ct-ph"></h2></div>' +
          '<div class="ct-gwrap"><div class="ct-grid" id="ct-grid" tabindex="0" aria-label="주고받은 사진">' +
            MONTHS.map(function (m, i) { return '<h3 data-m="' + i + '">' + m[0] + ' <small>' + m[1] + '장</small></h3><div class="ct-cells">' + new Array(m[1] + 1).join('<i style="background:' + ph(i) + '"></i>') + '</div>'; }).join('') + '</div>' +
            '<div class="ct-ftrack" id="ct-ftrack" aria-hidden="true" data-term="fast-scroller"><b id="ct-handle"></b><span id="ct-date"></span></div></div></section>' +
        '<div class="scr-labels" id="ct-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.ct-scr'), list = $('ct-list'), track = $('ct-track'), thumb = $('ct-thumb'), cvp = $('ct-cvp'), grid = $('ct-grid'), ftrack = $('ct-ftrack'), handle = $('ct-handle');

    /* ── 목록: 초성별 구역, 구역 제목은 위에 붙는다 ── */
    function shown() {
      return people.filter(function (p) { return st.chip === '전체' || (st.chip === '즐겨찾기' ? p.fav : st.chip === '최근 통화' ? p.recent : p.g === st.chip); });
    }
    function drawList() {
      var ps = shown(), by = {};
      ps.forEach(function (p) { (by[p.k] = by[p.k] || []).push(p); });
      $('ct-n').textContent = ps.length + '명';
      var first = true;
      list.innerHTML = '<div class="ct-groups" data-term="grouped-list">' + UI.INDEX_KO.filter(function (k) { return by[k]; }).map(function (k) {
        var h = '<section class="ct-sec" aria-labelledby="ct-s-' + k + '"><h3 id="ct-s-' + k + '"' + (first ? ' data-term="sticky-section-header"' : '') + '>' + k + '</h3><ul>' +
          by[k].map(function (p) { return '<li><button type="button" data-who="' + esc(p.n) + '"' + (p.n === st.sel ? ' aria-current="true"' : '') + '><i style="background:' + ph(p.n.charCodeAt(0)) + '">' + p.n[0] + '</i><span>' + esc(p.n) + '</span><small>' + p.g + (p.fav ? ' · ★' : '') + '</small></button></li>'; }).join('') + '</ul></section>';
        first = false; return h;
      }).join('') + '</div>';
      $('ct-index').innerHTML = UI.INDEX_KO.map(function (k) { return by[k] ? '<a href="#ct-s-' + k + '" data-k="' + k + '">' + k + '</a>' : '<a aria-disabled="true" data-k="' + k + '">' + k + '</a>'; }).join('');
      list.scrollTop = 0; drawBar(false);
    }
    function goLetter(k, bubble) {
      var h = $('ct-s-' + k);
      if (!h) return false;
      list.scrollTop = h.parentNode.offsetTop;
      if (bubble) { var b = $('ct-bub'); b.textContent = k; b.classList.add('on'); }
      return true;
    }

    /* ── 겹쳐 뜨는 막대: 스크롤할 때 나타나 1초 뒤 흐려지고, 올리면 굵어지고, 끌 수 있다 ── */
    function drawBar(show) {
      var H = track.clientHeight, sh = list.scrollHeight, ch = list.clientHeight, h = Math.max(24, ch / sh * H);
      thumb.style.height = h + 'px'; thumb.style.transform = 'translateY(' + (sh > ch ? list.scrollTop / (sh - ch) * (H - h) : 0) + 'px)';
      track.hidden = sh <= ch;
      if (show) { track.classList.add('on'); clearTimeout(hideBar); hideBar = later(function () { if (!track.matches(':hover') && !st.barDrag) track.classList.remove('on'); }, 1000); }
    }
    list.addEventListener('scroll', function () { drawBar(true); if (st.labels) drawLabels(); });
    $('ct-wrap').addEventListener('pointermove', function (e) { var r = this.getBoundingClientRect(); if (r.right - e.clientX < 18) drawBar(true); });
    thumb.addEventListener('pointerdown', function (e) {
      st.barDrag = { y: e.clientY, top: list.scrollTop }; thumb.setPointerCapture(e.pointerId); track.classList.add('on'); e.preventDefault();
    });
    thumb.addEventListener('pointermove', function (e) {
      if (!st.barDrag) return;
      var H = track.clientHeight, h = thumb.offsetHeight, k = (list.scrollHeight - list.clientHeight) / Math.max(1, H - h);
      list.scrollTop = st.barDrag.top + (e.clientY - st.barDrag.y) * k;
    });
    thumb.addEventListener('pointerup', function () { st.barDrag = null; drawBar(true); });

    /* ── 색인: 누르면 그 구역으로, 끌면 손가락 밑 글자마다 옮기며 큰 글자 말풍선 ── */
    var ix = $('ct-index');
    function letterAt(y) { var el = document.elementFromPoint(ix.getBoundingClientRect().left + ix.clientWidth / 2, y); return el && el.getAttribute && el.getAttribute('data-k'); }
    ix.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; st.ixDrag = true; ix.setPointerCapture(e.pointerId); var k = letterAt(e.clientY); if (k) goLetter(k, true); e.preventDefault(); });
    ix.addEventListener('pointermove', function (e) { if (!st.ixDrag) return; var k = letterAt(e.clientY); if (k) { var b = $('ct-bub'); b.textContent = k; b.classList.add('on'); goLetter(k, true); } });
    ix.addEventListener('pointerup', function () { st.ixDrag = false; later(function () { $('ct-bub').classList.remove('on'); }, 300); });
    ix.addEventListener('click', function (e) { var a = e.target.closest('a'); if (!a) return; e.preventDefault(); if (a.getAttribute('aria-disabled') !== 'true') { goLetter(a.getAttribute('data-k')); $('ct-s-' + a.getAttribute('data-k')).setAttribute('tabindex', '-1'); $('ct-s-' + a.getAttribute('data-k')).focus({ preventScroll: true }); } });

    /* ── 칩 줄: 막대는 숨기고 끝 그림자와 ‹ › 단추로 더 있다는 것을 알린다 ── */
    function onChips() {
      var m = cvp.scrollWidth - cvp.clientWidth;
      $('ct-shl').style.opacity = Math.min(1, cvp.scrollLeft / 20); $('ct-shr').style.opacity = Math.min(1, Math.max(0, m - cvp.scrollLeft) / 20);
      $('ct-cl').disabled = cvp.scrollLeft <= 0; $('ct-cr').disabled = cvp.scrollLeft >= m - 1;
    }
    cvp.addEventListener('scroll', onChips);

    /* ── 사진: 큰 손잡이. 스크롤할 때 나타나고, 끄는 동안 날짜 말풍선, 놓으면 1.5초 뒤 숨는다 ── */
    var heads = [].slice.call(grid.querySelectorAll('h3'));
    function drawHandle(show) {
      var H = ftrack.clientHeight, hh = 48, max = grid.scrollHeight - grid.clientHeight, y = max > 0 ? grid.scrollTop / max * (H - hh) : 0;
      handle.style.transform = 'translateY(' + y + 'px)';
      var mi = 0; heads.forEach(function (h, i) { if (h.offsetTop <= grid.scrollTop + 8) mi = i; });
      var d = $('ct-date'); d.textContent = MONTHS[mi][0]; d.style.transform = 'translateY(' + (y + hh / 2) + 'px) translateY(-50%)';
      if (show) { ftrack.classList.add('on'); clearTimeout(hideHd); hideHd = later(function () { if (!st.hdDrag) ftrack.classList.remove('on'); }, 1500); }
    }
    grid.addEventListener('scroll', function () { drawHandle(true); if (st.labels) drawLabels(); });
    handle.addEventListener('pointerdown', function (e) { st.hdDrag = { y: e.clientY, top: grid.scrollTop }; handle.setPointerCapture(e.pointerId); ftrack.classList.add('on', 'drag'); e.preventDefault(); });
    handle.addEventListener('pointermove', function (e) {
      if (!st.hdDrag) return;
      var k = (grid.scrollHeight - grid.clientHeight) / Math.max(1, ftrack.clientHeight - 48);
      grid.scrollTop = st.hdDrag.top + (e.clientY - st.hdDrag.y) * k;
    });
    handle.addEventListener('pointerup', function () { st.hdDrag = null; ftrack.classList.remove('drag'); drawHandle(true); });
    function title() { $('ct-ph').innerHTML = esc(st.sel) + ' 님과 주고받은 사진 <small>1,820장</small>'; }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.closest('#ct-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.hasAttribute('data-chip')) {
        st.chip = b.getAttribute('data-chip');
        root.querySelectorAll('[data-chip]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        drawList();
      } else if (b.id === 'ct-cl' || b.id === 'ct-cr') cvp.scrollBy({ left: (b.id === 'ct-cr' ? 1 : -1) * cvp.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
      else if (b.hasAttribute('data-who')) {
        st.sel = b.getAttribute('data-who'); list.querySelectorAll('[aria-current]').forEach(function (x) { x.removeAttribute('aria-current'); }); b.setAttribute('aria-current', 'true'); title(); grid.scrollTop = 0;
      }
      if (st.labels) later(drawLabels, 30);
    });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var Lb = $('ct-labels');
      Lb.hidden = !st.labels;
      if (!st.labels) return;
      var top = list.getBoundingClientRect().top;
      var seen = UI.termLabels(scr, Lb, opt.termName, function (id) {
        return id === 'overlay-scrollbar' || id === 'fast-scroller' || id === 'hidden-scrollbar' ? 'right' : id === 'section-index' || id === 'scroll-shadow' ? 'below' : id === 'grouped-list' ? 'in-bl' : '';
      }, function (el) { return list.contains(el) && el !== list && el.getBoundingClientRect().top < top - 1; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { onChips(); drawBar(false); drawHandle(false); drawLabels(); }
    window.addEventListener('resize', onResize);
    drawList(); title(); onChips(); drawHandle(false);

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        if (id === 'sticky-section-header') list.scrollTop = 40;
        later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
