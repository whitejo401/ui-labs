/* 조합 화면: 코드 열람기. 긴 코드 파일 한 편에 스크롤 막대 용어 7개를 엮는다 (recipes.json의 code-viewer)
   찾기 칸에 치면 찾은 곳이 코드·스크롤바 옆 눈금·미니맵에 같이 표시된다. 아래 문제 칸은 스크롤바 자리 비우기를 켜고 끄며 견준다
   UI.screens['code-viewer'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, N = 400, ERR = [13, 46, 212], CHG = [4, 5, 32, 60, 139, 140, 141, 299];
  var PROB = [['오류', '세미콜론이 없어요', 14], ['오류', 'refunded가 정의되지 않았어요', 47], ['오류', '반환 꼴이 달라요', 213]];
  var WARN = [['경고', '쓰지 않는 변수 fee', 17], ['경고', '비동기 함수에 await가 없어요', 64], ['경고', 'log 인자가 하나 남아요', 98], ['경고', '같은 이름을 두 번 가져와요', 121], ['경고', '쓰지 않는 import', 241]];

  UI.screens['code-viewer'] = function (root, opt) {
    var L = UI.codeLines(N), st = { labels: false, q: 'refund', hits: [], cur: 0, warn: false, stable: true }, timers = [], drag = null;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function $(id) { return document.getElementById(id); }

    root.innerHTML =
      '<div class="u scr cv-scr">' +
        '<div class="cv-top"><nav class="cv-crumb" aria-label="파일 위치" data-term="breadcrumb"><a href="#">결제</a><span aria-hidden="true">›</span><a href="#">src</a><span aria-hidden="true">›</span><b aria-current="page">refund.js</b></nav>' +
          '<span class="grow"></span><div class="cv-find" role="search"><input id="cv-q" type="search" value="' + st.q + '" aria-label="파일에서 찾기" autocomplete="off" data-term="search-bar"><span class="cv-cnt" id="cv-cnt" role="status"></span>' +
          '<button type="button" class="u-btn" id="cv-prev" aria-label="앞 찾은 곳">↑</button><button type="button" class="u-btn" id="cv-next" aria-label="다음 찾은 곳">↓</button></div></div>' +
        '<div class="cv-tip">' + UI.calloutHTML('팁', true, '여기서 찾으면 찾은 곳이 스크롤바 옆 눈금과 오른쪽 미니맵에 같이 표시돼요. 눈금이나 미니맵을 누르면 그 자리로 가요.', ' data-term="callout"') +
          '<div class="cv-legend" aria-hidden="true"><span><i class="hit"></i>찾은 곳</span><span><i class="err"></i>오류(왼쪽)</span><span><i class="chg"></i>바뀐 줄(오른쪽)</span></div></div>' +
        '<div class="cv-ed"><div class="cv-code" id="cv-code" tabindex="0" role="region" aria-label="refund.js 코드" data-term="custom-scrollbar"><div id="cv-lines"></div></div>' +
          '<div class="cv-ruler" id="cv-ruler" aria-hidden="true" data-term="scrollbar-markers"></div>' +
          '<div class="cv-mm" id="cv-mm" aria-hidden="true" data-term="minimap"><canvas id="cv-cv"></canvas><b class="cv-box" id="cv-box"></b></div></div>' +
        '<div class="cv-prob"><div class="cv-ph"><b>문제 <span id="cv-pn"></span></b><span class="grow"></span>' +
          '<label><button type="button" class="u-switch" role="switch" aria-checked="false" id="cv-warn"><i></i></button>경고도 보기</label>' +
          '<label><button type="button" class="u-switch" role="switch" aria-checked="true" id="cv-stable"><i></i></button>자리 비워 두기</label></div>' +
          '<ul class="cv-pl" id="cv-pl" data-term="scrollbar-gutter"></ul></div>' +
        '<div class="scr-labels" id="cv-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.cv-scr'), code = $('cv-code'), lines = $('cv-lines'), ruler = $('cv-ruler'), mm = $('cv-mm'), cv = $('cv-cv'), box = $('cv-box');

    /* ── 코드와 찾기 ── */
    function drawCode() {
      var q = st.q.trim(), low = q.toLowerCase();
      st.hits = [];
      lines.innerHTML = L.map(function (l, i) {
        var t = esc(l);
        if (q.length >= 2 && l.toLowerCase().indexOf(low) >= 0) {
          st.hits.push(i);
          t = t.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
        }
        var cls = (ERR.indexOf(i) >= 0 ? ' err' : '') + (CHG.indexOf(i) >= 0 ? ' chg' : '');
        return '<div class="cv-ln' + cls + '" data-i="' + i + '"><i>' + (i + 1) + '</i><span>' + (t || ' ') + '</span></div>';
      }).join('');
      st.cur = Math.min(st.cur, Math.max(0, st.hits.length - 1));
      drawRuler(); drawMap(); mark(false);
    }
    function mark(scroll) {
      lines.querySelectorAll('.cv-ln.on').forEach(function (x) { x.classList.remove('on'); });
      var n = st.hits.length;
      $('cv-cnt').textContent = st.q.trim().length < 2 ? '두 글자부터' : n ? (st.cur + 1) + ' / ' + n : '없음';
      if (!n) return;
      var el = lines.children[st.hits[st.cur]];
      el.classList.add('on');
      if (scroll) code.scrollTop = el.offsetTop - code.clientHeight / 2;
    }
    function step(d) { if (!st.hits.length) return; st.cur = (st.cur + d + st.hits.length) % st.hits.length; mark(true); }

    /* ── 스크롤바 옆 눈금: 줄 위치를 칸 높이로 환산해 종류마다 자리를 나눠 찍는다 ── */
    function drawRuler() {
      var H = ruler.clientHeight - 3;
      function tk(i, cls) { return '<i class="' + cls + '" style="top:' + (i / N * H).toFixed(1) + 'px"></i>'; }
      ruler.innerHTML = st.hits.map(function (i) { return tk(i, 'hit'); }).join('') + ERR.map(function (i) { return tk(i, 'err'); }).join('') + CHG.map(function (i) { return tk(i, 'chg'); }).join('');
    }
    ruler.addEventListener('click', function (e) {
      var r = ruler.getBoundingClientRect();
      code.scrollTop = (e.clientY - r.top) / r.height * code.scrollHeight - code.clientHeight / 2;
    });

    /* ── 미니맵: canvas에 줄마다 글 길이만큼 가는 막대. 보이는 부분 틀을 끌거나 빈 곳을 눌러 옮긴다 ── */
    function css(v) { return getComputedStyle(scr).getPropertyValue(v).trim(); }
    function drawMap() {
      var W = mm.clientWidth, H = mm.clientHeight, dpr = window.devicePixelRatio || 1, g = cv.getContext('2d'), lh = H / N;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var muted = css('--u-muted'), warn = css('--u-warn'), bad = css('--u-danger');
      L.forEach(function (l, i) {
        var ind = l.length - l.trimStart().length, len = l.trim().length;
        if (!len) return;
        var hit = st.hits.indexOf(i) >= 0, er = ERR.indexOf(i) >= 0;
        g.globalAlpha = hit || er ? 1 : 0.45; g.fillStyle = er ? bad : hit ? warn : muted;
        g.fillRect(6 + ind * 1.2, i * lh, Math.min(W - 12, len * 1.2), Math.max(0.8, lh * 0.7));
      });
      g.globalAlpha = 1; drawBox();
    }
    function drawBox() {
      var H = mm.clientHeight, sh = code.scrollHeight;
      box.style.top = code.scrollTop / sh * H + 'px'; box.style.height = Math.max(8, code.clientHeight / sh * H) + 'px';
    }
    function mmTo(y, off) { var H = mm.clientHeight; code.scrollTop = (y - off) / H * code.scrollHeight; }
    mm.addEventListener('pointerdown', function (e) {
      var r = mm.getBoundingClientRect(), y = e.clientY - r.top, b = box.getBoundingClientRect(), inBox = e.clientY >= b.top && e.clientY <= b.bottom;
      drag = { off: inBox ? e.clientY - b.top : b.height / 2 };
      mmTo(y, drag.off); mm.setPointerCapture(e.pointerId); e.preventDefault();
    });
    mm.addEventListener('pointermove', function (e) { if (drag) mmTo(e.clientY - mm.getBoundingClientRect().top, drag.off); });
    mm.addEventListener('pointerup', function () { drag = null; });

    /* ── 문제 칸: 경고를 켜면 항목이 늘어 막대가 생긴다. 자리 비워 두기를 끄면 그때 글이 밀린다 ── */
    function drawProb() {
      var list = PROB.concat(st.warn ? WARN : []);
      $('cv-pn').textContent = list.length + '개';
      var pl = $('cv-pl');
      pl.classList.toggle('stable', st.stable);
      pl.innerHTML = list.map(function (p) { return '<li><i class="' + (p[0] === '오류' ? 'e' : 'w') + '" aria-hidden="true">' + (p[0] === '오류' ? '×' : '!') + '</i><span class="sr">' + p[0] + '</span><button type="button" data-go="' + (p[2] - 1) + '">' + esc(p[1]) + '</button><em>refund.js:' + p[2] + '</em></li>'; }).join('');
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button, a');
      if (!b || !root.contains(b)) return;
      if (b.closest('#cv-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.tagName === 'A') { e.preventDefault(); return; }
      if (b.id === 'cv-next') step(1);
      else if (b.id === 'cv-prev') step(-1);
      else if (b.id === 'cv-warn' || b.id === 'cv-stable') {
        var on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on));
        if (b.id === 'cv-warn') st.warn = on; else st.stable = on;
        drawProb(); if (st.labels) drawLabels();
      } else if (b.hasAttribute('data-go')) { var el = lines.children[+b.getAttribute('data-go')]; code.scrollTop = el.offsetTop - code.clientHeight / 2; el.classList.add('flash'); later(function () { el.classList.remove('flash'); }, 900); }
    });
    $('cv-q').addEventListener('input', function () { st.q = this.value; st.cur = 0; drawCode(); });
    $('cv-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } });
    code.addEventListener('scroll', drawBox);

    /* ── 용어 보기 ── */
    function drawLabels() {
      var Lb = $('cv-labels');
      Lb.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, Lb, opt.termName, function (id) {
        return id === 'custom-scrollbar' ? 'in-br' : id === 'scrollbar-markers' || id === 'search-bar' ? 'right' : id === 'minimap' ? 'in-br' : '';
      });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { drawRuler(); drawMap(); drawLabels(); }
    window.addEventListener('resize', onResize);
    drawCode(); drawProb();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function () { later(drawLabels, 60); },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
