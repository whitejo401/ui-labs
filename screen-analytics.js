/* 조합 화면: 작업함 분석·보고서. 차트 용어 32개를 한 화면에 엮는다 (recipes.json의 analytics)
   UI.screens['analytics'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy }
   차트는 라이브러리 없이 SVG·Canvas로 그리고, 마우스 반응은 화면 하나에서 위임으로 받는다 */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, fmt = UI.fmt, C = UI.chart, CC = C.CC, PATN = 0;
  var RANGES = { '7': '7일', '30': '30일', '90': '90일' };
  var TODAY = new Date(2026, 10, 25), MON = ['일', '월', '화', '수', '목', '금', '토'];
  function rnd(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  function back(n) { var d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
  function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  function T(x, y, s, a, cls, st) { return '<text x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + s + '</text>'; }
  function L(x1, y1, x2, y2, st) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" style="' + st + '"/>'; }
  var GRID = 'stroke:var(--u-muted);stroke-opacity:.3;stroke-dasharray:2 3', BASE = 'stroke:var(--u-muted);stroke-opacity:.6';
  function sw(c) { return '<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + c + '"></i>'; }

  /* ── 기간별 데이터(가상) ── */
  var TEAMS = { '7': [['결제팀', 11], ['정산팀', 14], ['앱팀', 9], ['운영팀', 6]], '30': [['결제팀', 42], ['정산팀', 31], ['앱팀', 27], ['운영팀', 18]], '90': [['결제팀', 118], ['정산팀', 97], ['앱팀', 104], ['운영팀', 51]] };
  var MEMBERS = { '결제팀': [['민지', 0.36], ['준호', 0.29], ['서연', 0.21], ['도윤', 0.14]], '정산팀': [['하은', 0.45], ['지후', 0.33], ['수아', 0.22]], '앱팀': [['예준', 0.31], ['하린', 0.27], ['시우', 0.24], ['유나', 0.18]], '운영팀': [['건우', 0.6], ['서윤', 0.4]] };
  function makeData(p) {
    var N = +p, k = { '7': 1, '30': 2, '90': 3 }[p], s = { '7': 0.28, '30': 1, '90': 2.8 }[p], d = { N: N, s: s, open: [], closed: [], prog: [], rev: [], wait: [], days: [] };
    for (var i = 0; i < N; i++) {
      var f = N > 1 ? i / (N - 1) : 1;
      d.open.push(Math.round(32 + 18 * f + 4 * Math.sin(i / 2.5 + k) + rnd(i, k) * 4));
      d.closed.push(Math.round(20 + 23 * f + 3 * Math.sin(i / 3 + k * 2) + rnd(i, k + 5) * 3));
      d.prog.push(Math.round(10 + 6 * f + 2 * Math.sin(i / 2 + k) + rnd(i, k + 9) * 2)); d.rev.push(Math.round(6 + 4 * f + rnd(i, k + 11) * 3)); d.wait.push(Math.round(8 + 2 * Math.sin(i / 4) + rnd(i, k + 13) * 3));
      d.days.push(back(N - 1 - i));
    }
    var np = { '7': 7, '30': 5, '90': 6 }[p];
    d.per = []; d.stack = [];
    for (i = 0; i < np; i++) {
      d.per.push(p === '7' ? md(back(np - 1 - i)) : p === '30' ? (i + 1) + '주' : (i * 2 + 1) + '–' + (i * 2 + 2) + '주');
      var m = p === '7' ? 1 : p === '30' ? 6 : 12;
      d.stack.push([Math.round((6 + i * 1.6 + rnd(i, k + 20) * 3) * m), Math.round((4 + rnd(i, k + 21) * 3) * m), Math.round((2 + rnd(i, k + 22) * 2) * m), Math.round((3 - i * 0.3 + rnd(i, k + 23) * 2) * m)]);
    }
    d.teams = TEAMS[p];
    d.funnel = [['접수', 120], ['분류', 96], ['진행', 71], ['검토', 52], ['완료', 44]].map(function (x, i) { return [x[0], Math.round(x[1] * s * (1 + (rnd(i, k + 30) - 0.5) * 0.06))]; });
    d.prio = [['보통', 34], ['높음', 21], ['낮음', 18], ['긴급', 9], ['기타', 8]].map(function (x, i) { return [x[0], Math.max(1, Math.round(x[1] * s * (1 + (rnd(i, k + 40) - 0.5) * 0.3)))]; });
    d.samples = []; var ns = Math.round(240 * s);
    for (i = 0; i < ns; i++) d.samples.push(Math.min(14.99, Math.exp(Math.log(3) + (rnd(i, k + 50) + rnd(i, k + 51) + rnd(i, k + 52) - 1.5) * 1.1)));
    d.heat = MON.map(function (x, r) { return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (j) { var h = j * 2, wd = r >= 1 && r <= 5; return Math.round((Math.exp(-Math.pow((h - 14) / 5, 2)) * 20 * (wd ? 1 : 0.25) + rnd(r * 12 + j, k + 60) * 4) * s); }); });
    d.weeks = { '7': 4, '30': 6, '90': 13 }[p];
    d.kpi = { done: { '7': 46, '30': 198, '90': 571 }[p], avg: { '7': 2.8, '30': 3.4, '90': 3.9 }[p], fresh: { '7': 52, '30': 231, '90': 640 }[p] };
    d.gauge = { '7': 58, '30': 72, '90': 81 }[p];
    return d;
  }
  // 1년 치 분 단위 응답 시간(가상): 원본 2만 점을 LTTB로 300점만 남긴다
  var RAW = []; for (var ri = 0; ri < 20000; ri++) RAW.push([ri, 180 + 40 * Math.sin(ri / 1800) + (rnd(ri, 70) - 0.5) * 60 + (Math.abs(ri - 13207) <= 2 ? 260 : 0)]);
  var REDUCED = C.lttb(RAW, 300);
  // 산점도 3천 점: 댓글 수와 처리 일수
  var SCAT = []; for (var si = 0; si < 3000; si++) { var cx = rnd(si, 80) * 38 + 1; SCAT.push([cx, Math.max(0.2, Math.min(19.8, 1.5 + cx * 0.32 + (rnd(si, 81) - 0.5) * 7 + (rnd(si, 82) > 0.97 ? 6 : 0)))]); }
  // 분기별 담당자 처리 누적(순위 레이스)
  var RACE_N = ['민지', '준호', '서연', '도윤', '하은', '지후', '수아', '예준'], RACE_Q = ['1분기', '2분기', '3분기', '4분기', '5분기', '6분기', '7분기', '8분기'];
  var RACE = RACE_N.map(function (n, i) { var a = 0, r = []; for (var q = 0; q < 8; q++) { a += 4 + rnd(i, 90 + q) * 9 + (i % 3 === 0 ? q * 1.2 : 0); r.push(Math.round(a)); } return r; });

  UI.screens['analytics'] = function (root, opt) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var st = { p: '30', labels: false, calm: mq.matches, off: [false, false, false, false], table: false, team: -1, zoom: null, live: true, raceQ: 7, racePlay: false, loading: true, first: true };
    var D = makeData(st.p), prevTeams = null, timers = [], ints = [], offs = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function every(fn, ms) { var id = setInterval(fn, ms); ints.push(id); return id; }
    function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); offs.push(function () { el.removeEventListener(ev, fn, o); }); }
    function card(id, title, body, extra, wide) { return '<section class="db-card' + (wide ? ' wide' : '') + '"><div class="an-ch"><h3>' + title + '</h3><span class="grow"></span>' + (extra || '') + '</div><div id="' + id + '">' + body + '</div></section>'; }
    var SK = '<div class="an-skel">' + [80, 64, 72, 50].map(function (w, i) { return '<span class="u-skel shim run" style="width:' + w + '%"' + (i ? '' : ' data-term="skeleton"') + '></span>'; }).join('') + '</div>';

    root.innerHTML =
      '<div class="u scr an' + (st.calm ? ' calm' : '') + '">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '분석', '설정'].map(function (n, i) { return '<li><a href="#"' + (i === 2 ? ' aria-current="page"' : '') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="db-main" id="an-main">' +
          '<div class="db-head"><h2>분석</h2><span class="an-ch" data-term="range-selector"><span class="u-seg" role="group" aria-label="기간" id="an-seg" data-term="segmented-control"><span class="u-seg-ind"></span>' +
            Object.keys(RANGES).map(function (p) { return '<button type="button" data-p="' + p + '" aria-pressed="' + (p === st.p) + '">' + RANGES[p] + '</button>'; }).join('') + '</span><span class="an-sub" id="an-period"></span></span>' +
            '<span style="flex:1"></span><label class="db-calm" data-term="reduced-motion"><input type="checkbox" id="an-calm"' + (st.calm ? ' checked' : '') + '> 동작 줄이기</label></div>' +
          '<div class="db-grid">' +
            ['처리한 이슈', '평균 처리 일수', '새 이슈'].map(function (n, i) { return '<div class="kpi"' + (i ? '' : ' data-term="kpi-card"') + '><span class="lb">' + n + '</span><b class="v" id="an-k' + i + '"' + (i ? '' : ' data-term="number-ticker"') + '>–</b><div class="sp" id="an-s' + i + '"' + (i ? '' : ' data-term="sparkline"') + '></div></div>'; }).join('') +
            '<div class="kpi" data-term="gauge-ring"><span class="lb">스프린트 완료율</span><div id="an-gauge"></div></div>' +
          '</div>' +
          '<div class="db-row">' +
            card('an-trend', '이슈 추이', SK, '<button type="button" class="tbtn" id="an-reset" hidden>↺ 전체 보기</button>', true) +
            card('an-stack', '상태별 구성', SK, '<button type="button" class="tbtn" id="an-tbl" aria-pressed="false" data-term="data-table-view">표로 보기</button>') +
            card('an-area', '쌓인 작업량', SK) +
            card('an-team', '담당자별 처리', SK, '<span class="an-crumb" id="an-crumb"></span>') +
            card('an-funnel', '처리 단계', SK) +
            card('an-donut', '우선순위', SK) +
            card('an-hist', '처리 일수 분포', SK) +
            card('an-heat', '요일·시간대별 등록', SK) +
            card('an-cal', '하루 처리량', SK, '<span class="an-sub" id="an-calsub"></span>') +
            card('an-scat', '댓글 수와 처리 일수', SK, '<span class="an-badge" data-term="renderer-choice">Canvas · 점 3,000개</span>') +
            card('an-down', '응답 시간(ms, 1년 분 단위)', SK, '<span class="an-badge" data-term="downsampling">원본 20,000점 → 300점(LTTB)</span>') +
            card('an-live', '지금 들어오는 이슈', SK, '<button type="button" class="tbtn" id="an-lpz" aria-pressed="false"></button>') +
            card('an-race', '분기별 처리 순위', SK, '<button type="button" class="tbtn" id="an-rpl"></button>') +
          '</div>' +
        '</div>' +
        '<div class="u-tip sd-tip off" id="an-tip" role="tooltip" data-term="chart-tooltip"></div>' +
        '<div class="scr-labels" id="an-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr'), main = $('an-main'), tip = $('an-tip');

    /* ── 공통: 툴팁, 축 ── */
    function showTip(cx, cy, html) {
      var r = scr.getBoundingClientRect(); tip.innerHTML = html; tip.classList.remove('off');
      var w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(4, Math.min(r.width - w - 4, cx - r.left - w / 2)) + 'px'; tip.style.top = Math.max(4, cy - r.top - h - 12) + 'px';
    }
    function hideTip() { tip.classList.add('off'); }
    function svgPt(svg, e, W) { var r = svg.getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; }
    function toClient(svg, W, x, y) { var r = svg.getBoundingClientRect(), k = r.width / W; return [r.left + x * k, r.top + y * k]; }
    function axis(b, max, term) {
      var g = '', a = '';
      for (var i = 0; i <= 4; i++) { var y = b.y + b.h - b.h * i / 4, v = max * i / 4; if (i) g += L(b.x, y, b.x + b.w, y, GRID); a += T(b.x - 6, y + 4, fmt(v, true, Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0), 'end'); }
      return '<g' + (term ? ' data-term="gridlines"' : '') + '>' + g + '</g><g' + (term ? ' data-term="axis"' : '') + '>' + a + L(b.x, b.y + b.h, b.x + b.w, b.y + b.h, BASE) + '</g>';
    }
    function grow(el) { if (st.calm) return; later(function () { el.querySelectorAll('.an-grow, .an-draw').forEach(function (x) { x.classList.remove('an-grow', 'an-draw'); }); }, 1300); }

    /* ── 이슈 추이: Line Chart + Crosshair + Reference Line + Line Draw + Brush & Zoom + Chart Summary ── */
    var TW = 760, TB = { x: 36, y: 12, w: 640, h: 170 }, TARGET = 35;
    function trendDomain() { return st.zoom || [0, D.N - 1]; }
    function renderTrend(draw) {
      // 좁은 화면에서는 좌표 너비를 줄여 글자가 작아지지 않게
      var narrow = $('an-trend').clientWidth < 520; TW = narrow ? 440 : 760; TB = { x: 36, y: 12, w: TW - 120, h: narrow ? 150 : 170 };
      var dm = trendDomain(), max = C.niceMax(Math.max.apply(null, D.open) * 1.1), X = function (i) { return TB.x + (i - dm[0]) / Math.max(1, dm[1] - dm[0]) * TB.w; }, Y = function (v) { return TB.y + TB.h - v / max * TB.h; };
      var S = [['열린 이슈', D.open, CC[0]], ['닫힌 이슈', D.closed, CC[1]]], s = '<svg viewBox="0 0 ' + TW + ' ' + (TB.h + 44) + '" id="an-tsvg" data-hov="trend">' + axis(TB, max, true);
      var step = Math.max(1, Math.ceil((dm[1] - dm[0] + 1) / 7));
      for (var i = dm[0]; i <= dm[1]; i += step) s += T(X(i), TB.y + TB.h + 16, md(D.days[i]), 'middle');
      s += '<g data-term="reference-line">' + L(TB.x, Y(TARGET), TB.x + TB.w, Y(TARGET), 'stroke:var(--c2);stroke-width:1.5;stroke-dasharray:6 4') + T(TB.x + TB.w + 6, Y(TARGET) + 4, '목표 ' + TARGET, '', 'vl') + '</g>';
      S.forEach(function (x, j) {
        var pts = []; for (var i = dm[0]; i <= dm[1]; i++) pts.push(X(i).toFixed(1) + ',' + Y(x[1][i]).toFixed(1));
        s += '<polyline data-term="' + (j ? 'line-draw' : 'line-chart') + '" pathLength="1" class="' + (draw && !st.calm ? 'an-draw' : '') + '" points="' + pts.join(' ') + '" style="fill:none;stroke:' + x[2] + ';stroke-width:2;stroke-linejoin:round"/>' +
          T(TB.x + TB.w + 6, Y(x[1][dm[1]]) + 4 + (j ? 8 : -6), x[0], '', 'vl');
      });
      s += '<g id="an-xh" data-term="crosshair" style="display:none"><line id="an-xl" y1="' + TB.y + '" y2="' + (TB.y + TB.h) + '" style="stroke:var(--u-ink);stroke-dasharray:3 3;opacity:.5"/>' + S.map(function (x) { return '<circle r="4.5" style="fill:' + x[2] + ';stroke:var(--u-panel);stroke-width:2"/>'; }).join('') + '</g></svg>';
      // 미니맵: 전체 기간을 옅게, 고른 구간은 반투명 사각형
      var MW = TW, mb = { x: 36, y: 4, w: TB.w, h: 30 }, mx = function (i) { return mb.x + i / Math.max(1, D.N - 1) * mb.w; }, my = function (v) { return mb.y + mb.h - v / max * mb.h; };
      s += '<div data-term="brush-zoom"><svg viewBox="0 0 ' + MW + ' 40" id="an-mini" style="cursor:col-resize;touch-action:none"><rect x="' + mb.x + '" y="' + mb.y + '" width="' + mb.w + '" height="' + mb.h + '" rx="4" style="fill:none;stroke:var(--u-line)"/>' +
        '<polyline points="' + D.open.map(function (v, i) { return mx(i).toFixed(1) + ',' + my(v).toFixed(1); }).join(' ') + '" style="fill:none;stroke:var(--u-muted);stroke-width:1"/>' +
        '<rect id="an-sel" y="' + mb.y + '" height="' + mb.h + '" x="' + (st.zoom ? mx(st.zoom[0]) : 0) + '" width="' + (st.zoom ? mx(st.zoom[1]) - mx(st.zoom[0]) : 0) + '" style="fill:var(--c1);fill-opacity:.15;stroke:var(--c1)"/>' + T(TB.x + TB.w + 6, 24, '끌어서 확대', '') + '</svg></div>';
      var o = D.open, c = D.closed, a0 = dm[0], a1 = dm[1], pct = Math.round((o[a1] - o[a0]) / o[a0] * 100);
      $('an-trend').innerHTML = '<p class="an-sum" data-term="chart-summary"><b>요약</b> ' + md(D.days[a0]) + '–' + md(D.days[a1]) + ' 열린 이슈 ' + o[a0] + '→' + o[a1] + '건(' + (pct >= 0 ? '+' : '') + pct + '%), 닫힌 이슈 ' + c[a0] + '→' + c[a1] + '건. ' + (c[a1] >= TARGET ? '닫힌 이슈가 목표(' + TARGET + ')를 넘었다.' : '닫힌 이슈는 아직 목표(' + TARGET + ') 아래.') + '</p>' + s;
      $('an-reset').hidden = !st.zoom;
      if (draw) grow($('an-trend'));
      TRX = { X: X, Y: Y, dm: dm, S: S, mx: mx, mb: mb };
    }
    var TRX = null;
    function hoverTrend(i, cx, cy) {
      var svg = $('an-tsvg'), xh = $('an-xh'), g = TRX;
      if (i == null) { xh.style.display = 'none'; return; }
      xh.style.display = ''; $('an-xl').setAttribute('x1', g.X(i)); $('an-xl').setAttribute('x2', g.X(i));
      [].slice.call(xh.querySelectorAll('circle')).forEach(function (cc, j) { cc.setAttribute('cx', g.X(i)); cc.setAttribute('cy', g.Y(g.S[j][1][i])); });
      var p = toClient(svg, TW, g.X(i), g.Y(Math.max(D.open[i], D.closed[i])));
      showTip(cx == null ? p[0] : cx, p[1], '<b>' + md(D.days[i]) + '(' + MON[D.days[i].getDay()] + ')</b> ' + g.S.map(function (x) { return sw(x[2]) + ' ' + x[0].split(' ')[0] + ' ' + x[1][i]; }).join(' '));
    }

    /* ── 상태별 구성: Stacked Bar + Legend Toggle + Non-color Encoding(무늬) + Data Label + Bar Grow-in + Data Table View ── */
    var SNAME = ['완료', '진행', '검토', '대기'];
    function renderStack(grw) {
      var el = $('an-stack'), id = 'anp' + (++PATN), vis = function (j) { return !st.off[j]; };
      var fill = function (j) { return j === 1 ? 'url(#' + id + 'a)' : j === 2 ? 'url(#' + id + 'b)' : CC[j]; };
      var chips = '<div class="an-ch" data-term="legend">' + SNAME.map(function (n, j) { return '<button type="button" class="chip" data-sj="' + j + '" aria-pressed="' + vis(j) + '"' + (j ? '' : ' data-term="legend-toggle"') + '><i style="background:' + fill(j) + ';border-color:' + CC[j] + '"></i>' + n + '</button>'; }).join('') + '</div>';
      if (st.table) {
        el.innerHTML = chips.replace(/<button/g, '<button disabled') + '<table class="an-tbl"><caption>상태별 이슈(' + RANGES[st.p] + ')</caption><thead><tr><th scope="col">기간</th>' + SNAME.map(function (n) { return '<th scope="col">' + n + '</th>'; }).join('') + '<th scope="col">합</th></tr></thead><tbody>' +
          D.per.map(function (pn, i) { var r = D.stack[i]; return '<tr><th scope="row">' + pn + '</th>' + r.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '<td>' + r.reduce(function (a, v) { return a + v; }, 0) + '</td></tr>'; }).join('') + '</tbody></table>';
        return;
      }
      var W = 380, b = { x: 34, y: 8, w: 336, h: 150 }, n = D.per.length, band = b.w / n, th = band * 0.56;
      var sums = D.stack.map(function (r) { return r.reduce(function (a, v, j) { return a + (vis(j) ? v : 0); }, 0); }), max = C.niceMax(Math.max(1, Math.max.apply(null, sums)) * 1.05);
      var s = '<svg viewBox="0 0 ' + W + ' 180" data-hov="stack" data-term="stacked-bar-chart"><defs>' +
        '<pattern id="' + id + 'a" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--c2)"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--u-panel);stroke-width:2"/></pattern>' +
        '<pattern id="' + id + 'b" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" style="fill:var(--c3)"/><circle cx="3" cy="3" r="1.3" style="fill:var(--u-panel)"/></pattern></defs>' + axis(b, max) + '<g' + (grw ? ' data-term="bar-grow-in"' : '') + '>';
      var pat = false;
      D.stack.forEach(function (r, i) {
        var y0 = b.y + b.h, x = b.x + band * i + (band - th) / 2;
        r.forEach(function (v, j) {
          if (!vis(j)) return;
          var h = v / max * b.h, hh = Math.max(0, h - (y0 < b.y + b.h ? 2 : 0));
          s += '<rect data-i="' + i + '" data-j="' + j + '" x="' + x + '" y="' + (y0 - h) + '" width="' + th + '" height="' + hh + '" class="' + (grw && !st.calm ? 'an-grow' : '') + '" style="--d:' + (i * 50) + 'ms;fill:' + fill(j) + '"' + ((j === 1 || j === 2) && !pat ? (pat = true, ' data-term="non-color-encoding"') : '') + '/>';
          // 값 라벨: 무늬 칸은 글자 둘레에 바탕색 테를 둘러 읽히게
          if (h >= 16) s += T(x + th / 2, y0 - h / 2 + 4, v, 'middle', 'in', 'fill:' + (j === 0 ? '#ffffff' : j === 3 ? '#1d1f22' : 'var(--u-ink)') + ';paint-order:stroke;stroke:' + (j === 1 || j === 2 ? 'var(--u-panel)' : 'none') + ';stroke-width:3px');
          y0 -= h;
        });
        s += T(x + th / 2, b.y + b.h + 14, D.per[i], 'middle');
      });
      s = s.replace('class="in"', 'class="in" data-term="data-label"');
      el.innerHTML = chips + s + '</g></svg>';
      if (grw) grow(el);
    }

    /* ── 쌓인 작업량: Area Chart(누적) ── */
    function renderArea() {
      var W = 380, b = { x: 34, y: 8, w: 290, h: 150 }, L3 = [['진행', D.prog], ['검토', D.rev], ['대기', D.wait]], cum = D.prog.map(function () { return 0; });
      var layers = L3.map(function (l) { var lo = cum.slice(); cum = cum.map(function (v, i) { return v + l[1][i]; }); return { n: l[0], lo: lo, hi: cum.slice(), v: l[1] }; });
      var max = C.niceMax(Math.max.apply(null, cum) * 1.08), X = function (i) { return b.x + i / Math.max(1, D.N - 1) * b.w; }, Y = function (v) { return b.y + b.h - v / max * b.h; };
      var s = '<svg viewBox="0 0 ' + W + ' 180" data-hov="area" data-term="area-chart">' + axis(b, max);
      layers.forEach(function (l, j) {
        var hi = l.hi.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }), lo = l.lo.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).reverse();
        s += '<polygon points="' + hi.concat(lo).join(' ') + '" style="fill:' + CC[j] + ';opacity:.28"/><polyline points="' + hi.join(' ') + '" style="fill:none;stroke:' + CC[j] + ';stroke-width:2"/>' + T(b.x + b.w + 6, Y((l.lo[D.N - 1] + l.hi[D.N - 1]) / 2) + 4, l.n, '', 'vl');
      });
      [0, D.N - 1].forEach(function (i) { s += T(X(i), b.y + b.h + 14, md(D.days[i]), i ? 'end' : 'start'); });
      $('an-area').innerHTML = s + '<line id="an-axl" y1="' + b.y + '" y2="' + (b.y + b.h) + '" style="stroke:var(--u-ink);stroke-dasharray:3 3;opacity:0"/></svg>';
      AREA = { X: X, layers: layers, b: b };
    }
    var AREA = null;

    /* ── 담당자별: Bar Chart(가로, HTML) + Drilldown + Breadcrumb + Chart Morph(이름으로 짝) ── */
    function teamRows() {
      if (st.team < 0) return D.teams.map(function (t) { return { k: t[0], v: t[1] }; });
      var t = D.teams[st.team]; return MEMBERS[t[0]].map(function (m) { return { k: m[0], v: Math.round(t[1] * m[1]) }; });
    }
    function renderTeams(fresh) {
      var el = $('an-team'), rows = teamRows(), sorted = rows.slice().sort(function (a, b) { return b.v - a.v; }), max = Math.max.apply(null, rows.map(function (r) { return r.v; })) * 1.2;
      $('an-crumb').innerHTML = st.team < 0 ? '<span class="an-sub">팀을 누르면 담당자별로</span>' : '<span data-term="breadcrumb" class="an-crumb"><button type="button" data-act="up">전체 팀</button> › <b>' + D.teams[st.team][0] + '</b></span>';
      var box = el.querySelector('.an-hb');
      if (fresh || !box || box.getAttribute('data-team') !== String(st.team)) {
        el.innerHTML = '<div data-term="chart-morph"><div class="an-hb" data-team="' + st.team + '" data-term="bar-chart" style="height:' + (rows.length * 30) + 'px">' + rows.map(function (r, i) {
          var tag = st.team < 0 ? 'button' : 'div';
          return '<' + tag + (tag === 'button' ? ' type="button" data-ti="' + i + '"' : '') + ' class="row" data-k="' + esc(r.k) + '"' + (i === 0 && st.team < 0 ? ' data-term="drilldown"' : '') + '><span>' + esc(r.k) + '</span><div class="bar" style="width:0"><b></b></div></' + tag + '>';
        }).join('') + '</div></div>';
        box = el.querySelector('.an-hb'); void box.offsetWidth;
      }
      rows.forEach(function (r) {
        var row = box.querySelector('[data-k="' + r.k + '"]'), rank = sorted.indexOf(r);
        row.style.transform = 'translateY(' + rank * 30 + 'px)';
        row.querySelector('.bar').style.width = (r.v / max * 100) + '%'; row.querySelector('b').textContent = r.v + '건';
        if (row.tagName === 'BUTTON') row.setAttribute('aria-label', r.k + ' ' + r.v + '건, 눌러서 담당자별 보기');
      });
    }

    /* ── 처리 단계: Funnel Chart / 우선순위: Donut Chart ── */
    function renderFunnel() {
      var W = 300, f = D.funnel, max = f[0][1], s = '<svg viewBox="0 0 ' + W + ' 170" data-term="funnel-chart">';
      f.forEach(function (x, i) {
        var w = x[1] / max * 170, y = 6 + i * 32;
        s += T(44, y + 15, x[0], 'end') + '<path d="' + C.barPath(52, y, w, 20, true) + '" style="fill:var(--c1)"/>' + T(58 + w, y + 15, x[1] + '건', '', 'vl');
        if (i) s += T(W - 4, y - 2, '−' + (f[i - 1][1] - x[1]) + '(' + Math.round((f[i - 1][1] - x[1]) / f[i - 1][1] * 100) + '%)', 'end', '', 'font-size:10px');
      });
      $('an-funnel').innerHTML = s + '</svg>';
    }
    var DON = null;
    function renderDonut() {
      var W = 300, P = D.prio, tot = P.reduce(function (a, x) { return a + x[1]; }, 0), CX = 78, CY = 82, R = 70, RI = 44, a = 0, s = '<svg viewBox="0 0 ' + W + ' 170" data-hov="donut" data-term="donut-chart">';
      var col = function (i) { return P[i][0] === '기타' ? 'var(--c-other)' : CC[i]; }, pt = function (r, ang) { return (CX + Math.sin(ang) * r).toFixed(1) + ' ' + (CY - Math.cos(ang) * r).toFixed(1); };
      P.forEach(function (x, i) {
        var a0 = a + 0.02, a1 = a + x[1] / tot * Math.PI * 2 - 0.02, lg = a1 - a0 > Math.PI ? 1 : 0; a += x[1] / tot * Math.PI * 2;
        s += '<path data-i="' + i + '" d="M' + pt(R, a0) + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + pt(R, a1) + 'L' + pt(RI, a1) + 'A' + RI + ' ' + RI + ' 0 ' + lg + ' 0 ' + pt(RI, a0) + 'Z" style="fill:' + col(i) + '"/>';
        s += '<rect x="170" y="' + (20 + i * 26) + '" width="11" height="11" rx="2" style="fill:' + col(i) + '"/>' + T(188, 30 + i * 26, x[0]) + T(W - 4, 30 + i * 26, Math.round(x[1] / tot * 100) + '%', 'end', 'vl');
      });
      s += T(CX, CY + 2, tot + '건', 'middle', 'vl', 'font-size:18px') + T(CX, CY + 18, '합계', 'middle', '', '') + '</svg>';
      $('an-donut').innerHTML = s; DON = { P: P, tot: tot };
    }

    /* ── 분포·활동: Histogram, Heatmap, Calendar Heatmap ── */
    var HIST = null;
    function renderHist() {
      var W = 380, b = { x: 34, y: 8, w: 336, h: 150 }, nb = 10, bw = 15 / nb, cnt = []; for (var j = 0; j < nb; j++) cnt.push(0);
      D.samples.forEach(function (v) { cnt[Math.floor(v / bw)]++; });
      var max = C.niceMax(Math.max.apply(null, cnt) * 1.1), avg = D.samples.reduce(function (a, v) { return a + v; }, 0) / D.samples.length, X = function (v) { return b.x + v / 15 * b.w; };
      var s = '<svg viewBox="0 0 ' + W + ' 180" data-hov="hist" data-term="histogram">' + axis(b, max);
      cnt.forEach(function (v, j) { var h = v / max * b.h; s += '<rect data-i="' + j + '" x="' + (X(j * bw) + 0.5) + '" y="' + (b.y + b.h - h) + '" width="' + (b.w / nb - 1) + '" height="' + h + '" style="fill:var(--c1)"/>'; });
      [0, 3, 6, 9, 12, 15].forEach(function (v) { s += T(X(v), b.y + b.h + 14, v + '일', 'middle'); });
      s += L(X(avg), b.y, X(avg), b.y + b.h, 'stroke:var(--c2);stroke-width:2;stroke-dasharray:5 4') + T(X(avg) + 5, b.y + 10, '평균 ' + avg.toFixed(1) + '일', '', 'vl');
      $('an-hist').innerHTML = s + '</svg>'; HIST = { cnt: cnt, bw: bw };
    }
    function renderHeat() {
      var W = 380, x0 = 22, cw = 29, ch = 19, max = Math.max.apply(null, D.heat.map(function (r) { return Math.max.apply(null, r); })) || 1, s = '<svg viewBox="0 0 ' + W + ' 180" data-hov="heat" data-term="heatmap">';
      D.heat.forEach(function (r, ri) { s += T(x0 - 6, 6 + ri * ch + ch / 2 + 4, MON[ri], 'end'); r.forEach(function (v, j) { s += '<rect data-r="' + ri + '" data-c="' + j + '" x="' + (x0 + j * cw + 1) + '" y="' + (6 + ri * ch + 1) + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="3" style="fill:' + C.seqFill(v / max) + '"/>'; }); });
      [0, 3, 6, 9].forEach(function (j) { s += T(x0 + j * cw + 1, 6 + 7 * ch + 13, j * 2 + '시'); });
      for (var g = 0; g < 8; g++) s += '<rect x="' + (240 + g * 14) + '" y="' + (6 + 7 * ch + 22) + '" width="14" height="9" style="fill:' + C.seqFill(g / 7) + '"/>';
      s += T(236, 6 + 7 * ch + 30, '적음', 'end') + T(356, 6 + 7 * ch + 30, '많음');
      $('an-heat').innerHTML = s + '</svg>';
    }
    var CAL = null;
    function renderCal() {
      // 칸 크기는 고정하고 주 수만큼만 넓힌다(넓은 카드에서 늘어나지 않게)
      var Wk = D.weeks, cell = 14, gap = 3, x0 = 30, y0 = 18, W = Math.max(170, x0 + Wk * (cell + gap) + 10), start = back(TODAY.getDay() + (Wk - 1) * 7), days = [], s = '<svg viewBox="0 0 ' + W + ' 160" style="max-width:' + (W * 1.1) + 'px" data-hov="cal" data-term="calendar-heatmap">', lastM = -1, lastW = -9;
      for (var w = 0; w < Wk; w++) for (var d = 0; d < 7; d++) {
        var dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d); if (dt > TODAY) continue;
        var v = d === 0 || d === 6 ? (rnd(w * 7 + d, 100) > 0.7 ? 1 : 0) : Math.round(rnd(w * 7 + d, 101) * 8);
        days.push({ w: w, d: d, dt: dt, v: v });
        if (d === 0 && dt.getMonth() !== lastM) { lastM = dt.getMonth(); if (w - lastW >= 3) { lastW = w; s += T(x0 + w * (cell + gap), 10, (lastM + 1) + '월'); } }
      }
      [1, 3, 5].forEach(function (d) { s += T(x0 - 6, y0 + d * (cell + gap) + cell - 3, MON[d], 'end'); });
      var max = Math.max.apply(null, days.map(function (x) { return x.v; })) || 1;
      days.forEach(function (x, i) { s += '<rect data-i="' + i + '" x="' + (x0 + x.w * (cell + gap)) + '" y="' + (y0 + x.d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="3" style="fill:' + (x.v ? C.seqFill(0.15 + Math.ceil(x.v / max * 4) / 4 * 0.85) : 'var(--u-line)') + '"/>'; });
      var ly = y0 + 7 * (cell + gap) + 6;
      s += T(x0, ly + 9, '적음'); [0, 0.25, 0.5, 0.75, 1].forEach(function (l, i) { s += '<rect x="' + (x0 + 30 + i * 15) + '" y="' + ly + '" width="12" height="12" rx="3" style="fill:' + (l ? C.seqFill(0.15 + l * 0.85) : 'var(--u-line)') + '"/>'; }); s += T(x0 + 108, ly + 9, '많음');
      $('an-cal').innerHTML = s + '</svg>'; $('an-calsub').textContent = '기간을 포함한 ' + Wk + '주'; CAL = days;
    }

    /* ── 상관: Scatter Plot(Canvas, Renderer Choice) / 응답 시간: Downsampling ── */
    function renderScat() {
      var el = $('an-scat');
      el.innerHTML = '<div class="an-cv" data-hov="scat" data-term="scatter-plot"><canvas aria-label="댓글 수와 처리 일수 산점도, 이슈 3,000건. 댓글이 많을수록 오래 걸리는 경향"></canvas></div>';
      var cv = el.querySelector('canvas'), r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), cs = getComputedStyle(scr);
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.round(180 * dpr);
      var g = cv.getContext('2d'), W = r.width, H = 180, b = { x: 30, y: 8, w: W - 40, h: H - 30 };
      g.scale(dpr, dpr); g.font = '11px ' + cs.getPropertyValue('--u-font'); g.fillStyle = cs.getPropertyValue('--u-muted');
      g.strokeStyle = cs.getPropertyValue('--u-line');
      for (var i = 0; i <= 4; i++) { var y = b.y + b.h - b.h * i / 4; g.beginPath(); g.moveTo(b.x, y); g.lineTo(b.x + b.w, y); g.stroke(); g.fillText(i * 5 + (i === 4 ? '일' : ''), 2, y + 4); }
      [0, 10, 20, 30, 40].forEach(function (v) { g.fillText(v, b.x + v / 40 * b.w - 4, H - 6); });
      g.fillStyle = cs.getPropertyValue('--c1'); g.globalAlpha = 0.35;
      SCAT.forEach(function (p) { g.fillRect(b.x + p[0] / 40 * b.w - 1.5, b.y + b.h - p[1] / 20 * b.h - 1.5, 3, 3); });
      SC = { b: b };
    }
    var SC = null;
    function renderDown() {
      var W = 380, b = { x: 34, y: 8, w: 336, h: 150 }, max = 500, X = function (i) { return b.x + i / 19999 * b.w; }, Y = function (v) { return b.y + b.h - Math.min(v, max) / max * b.h; };
      var s = '<svg viewBox="0 0 ' + W + ' 180">' + axis(b, max) + '<polyline points="' + REDUCED.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '" style="fill:none;stroke:var(--c1);stroke-width:1.5;stroke-linejoin:round"/>';
      ['1월', '4월', '7월', '10월'].forEach(function (m, i) { s += T(b.x + b.w * i / 4, b.y + b.h + 14, m); });
      var sp = REDUCED.reduce(function (m, p) { return p[1] > m[1] ? p : m; }, [0, 0]);
      s += '<circle cx="' + X(sp[0]) + '" cy="' + Y(sp[1]) + '" r="7" style="fill:none;stroke:var(--c2);stroke-width:2"/>' + T(X(sp[0]) + 10, Y(sp[1]) + 4, '장애 ' + Math.round(sp[1]) + 'ms(줄여도 남음)', '', 'vl');
      $('an-down').innerHTML = s + '</svg>';
    }

    /* ── 실시간: Live Stream(1초마다, 멈춤) / 분기별 순위: Bar Chart Race ── */
    var LIVE = []; for (var li = 0; li < 40; li++) LIVE.push(liveVal(li));
    var liveN = 40;
    function liveVal(n) { return 20 + 8 * Math.sin(n / 7) + 5 * Math.sin(n / 2.3) + rnd(n, 110) * 4; }
    function renderLive() {
      var W = 380, b = { x: 34, y: 20, w: 336, h: 130 }, max = 40, X = function (i) { return b.x + i / 39 * b.w; }, Y = function (v) { return b.y + b.h - v / max * b.h; }, last = LIVE[LIVE.length - 1];
      $('an-live').innerHTML = '<svg viewBox="0 0 ' + W + ' 172" data-term="live-stream">' + T(b.x, 10, (st.live ? '● 실시간' : '■ 멈춤') + ' · 지금 ' + Math.round(last) + '건/분', '', 'vl') + axis(b, max) +
        '<polyline points="' + LIVE.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/><circle cx="' + X(39) + '" cy="' + Y(last) + '" r="4" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/>' +
        T(b.x, b.y + b.h + 14, '40초 전') + T(b.x + b.w, b.y + b.h + 14, '지금', 'end') + '</svg>';
      $('an-lpz').innerHTML = st.live ? '❚❚ 멈춤' : '▶ 다시'; $('an-lpz').setAttribute('aria-pressed', String(!st.live));
    }
    function tickLive() { if (!st.live || document.hidden) return; LIVE.shift(); LIVE.push(liveVal(liveN++)); renderLive(); }
    function renderRace(fresh) {
      var el = $('an-race'), q = st.raceQ, v = RACE.map(function (r) { return r[q]; }), max = Math.max.apply(null, v) * 1.18, order = v.map(function (x, i) { return i; }).sort(function (a, b) { return v[b] - v[a]; });
      if (fresh || !el.querySelector('.an-hb')) {
        el.innerHTML = '<div class="an-hb" data-term="bar-chart-race" style="height:' + (RACE_N.length * 24) + 'px">' + RACE_N.map(function (n, i) { return '<div class="row" data-k="' + n + '" style="height:20px"><span>' + n + '</span><div class="bar" style="width:0;height:16px;background:' + CC[i % 4] + '"><b style="line-height:16px"></b></div></div>'; }).join('') + '</div>' +
          '<div class="an-ch" style="margin-top:6px"><input type="range" id="an-rq" min="0" max="7" step="1" value="' + q + '" aria-label="분기" style="flex:1;accent-color:var(--u-accent)"><b id="an-rql" style="font-size:16px;min-width:3.5em;text-align:right"></b></div>';
        void el.offsetWidth;
      }
      RACE_N.forEach(function (n, i) { var row = el.querySelector('[data-k="' + n + '"]'); row.style.transform = 'translateY(' + order.indexOf(i) * 24 + 'px)'; row.querySelector('.bar').style.width = (v[i] / max * 100) + '%'; row.querySelector('b').textContent = v[i]; });
      $('an-rq').value = q; $('an-rql').textContent = RACE_Q[q];
      $('an-rpl').innerHTML = st.racePlay ? '❚❚ 멈춤' : '▶ 재생';
    }
    var raceId = 0;
    function playRace() {
      clearInterval(raceId);
      if (!st.racePlay) { renderRace(); return; }
      if (st.raceQ >= 7) st.raceQ = 0;
      renderRace();
      raceId = every(function () { if (st.raceQ >= 7) { st.racePlay = false; clearInterval(raceId); renderRace(); return; } st.raceQ++; renderRace(); }, st.calm ? 300 : 800);
    }

    /* ── 숫자와 게이지 ── */
    var shown = [0, 0, 0];
    function renderKpis(first) {
      var to = [D.kpi.done, D.kpi.avg, D.kpi.fresh], from = shown.slice(), t0 = Date.now(), dur = st.calm ? 0 : first ? 1000 : 600;
      (function step() {
        var p = dur ? Math.min(1, (Date.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
        shown = to.map(function (v, i) { return from[i] + (v - from[i]) * e; });
        $('an-k0').textContent = fmt(shown[0], true) + '건'; $('an-k1').textContent = shown[1].toFixed(1) + '일'; $('an-k2').textContent = fmt(shown[2], true) + '건';
        if (p < 1) later(step, 30);
      })();
      $('an-s0').innerHTML = UI.spark(D.closed, 160, 32, '선', true); $('an-s1').innerHTML = UI.spark(D.samples.slice(0, 12), 160, 32, '선', true); $('an-s2').innerHTML = UI.spark(D.open, 160, 32, '막대', true);
      var v = D.gauge, R = 34, circ = 2 * Math.PI * R;
      if (!$('an-gv')) $('an-gauge').innerHTML = '<svg viewBox="0 0 160 84" style="max-width:180px"><circle cx="42" cy="42" r="' + R + '" style="fill:none;stroke:var(--u-line);stroke-width:9"/><circle id="an-gv" cx="42" cy="42" r="' + R + '" transform="rotate(-90 42 42)" style="fill:none;stroke:var(--c1);stroke-width:9;stroke-linecap:round;stroke-dasharray:0 ' + circ + ';transition:stroke-dasharray 700ms ease-out"/>' +
        '<line x1="' + (42 + Math.sin(0.8 * 2 * Math.PI) * (R - 7)) + '" y1="' + (42 - Math.cos(0.8 * 2 * Math.PI) * (R - 7)) + '" x2="' + (42 + Math.sin(0.8 * 2 * Math.PI) * (R + 7)) + '" y2="' + (42 - Math.cos(0.8 * 2 * Math.PI) * (R + 7)) + '" style="stroke:var(--u-ink);stroke-width:2"/>' +
        '<text id="an-gt" x="42" y="47" text-anchor="middle" class="vl" style="font-size:15px"></text><text x="92" y="38">목표 80%</text><text id="an-gm" x="92" y="56" class="vl"></text></svg>';
      later(function () { $('an-gv').style.strokeDasharray = (v / 100 * circ) + ' ' + circ; }, 30);
      $('an-gt').textContent = v + '%'; $('an-gm').textContent = v >= 80 ? '목표 넘음' : '목표까지 ' + (80 - v) + '%p';
    }

    /* ── 기간 바꾸기: 잠깐 Skeleton 뒤에 모든 차트를 새 기간으로 ── */
    function moveSeg() { var b = root.querySelector('#an-seg button[aria-pressed="true"]'), ind = root.querySelector('#an-seg .u-seg-ind'); if (b) { ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; } }
    function load(p, first, hold) {
      st.p = p; D = makeData(p); st.zoom = null;
      root.querySelectorAll('#an-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === p)); });
      moveSeg();
      $('an-period').textContent = '최근 ' + RANGES[p] + ' (' + md(D.days[0]) + '–' + md(D.days[D.N - 1]) + ')';
      ['an-trend', 'an-stack', 'an-area', 'an-funnel', 'an-donut', 'an-hist', 'an-heat', 'an-cal'].forEach(function (id) { $(id).innerHTML = SK; });
      if (first) ['an-team', 'an-scat', 'an-down', 'an-live', 'an-race'].forEach(function (id) { $(id).innerHTML = SK; });
      later(drawLabels, 30);
      later(function () {
        renderTrend(true); renderStack(first); renderArea(); renderFunnel(); renderDonut(); renderHist(); renderHeat(); renderCal(); renderKpis(first);
        renderTeams(first);
        if (first) { renderScat(); renderDown(); renderLive(); renderRace(true); }
        later(drawLabels, 60);
      }, hold || (first ? 600 : 350));
    }

    /* ── 마우스: 차트마다 위임으로 ── */
    var drag = null;
    on(scr, 'pointermove', function (e) {
      if (drag) return;
      var h = e.target.closest('[data-hov]'), k = h && h.getAttribute('data-hov');
      if (k !== 'trend' && $('an-xh')) hoverTrend(null);
      if (!k) { hideTip(); if (AREA && $('an-axl')) $('an-axl').style.opacity = 0; return; }
      if (k === 'trend' && TRX) { var p = svgPt(h, e, TW); if (p[0] < TB.x || p[0] > TB.x + TB.w) { hoverTrend(null); hideTip(); return; } var dm = TRX.dm; hoverTrend(Math.max(dm[0], Math.min(dm[1], Math.round(dm[0] + (p[0] - TB.x) / TB.w * (dm[1] - dm[0])))), e.clientX); return; }
      if (k === 'area' && AREA) { var pa = svgPt(h, e, 380), i = Math.max(0, Math.min(D.N - 1, Math.round((pa[0] - AREA.b.x) / AREA.b.w * (D.N - 1)))), xl = $('an-axl'); xl.setAttribute('x1', AREA.X(i)); xl.setAttribute('x2', AREA.X(i)); xl.style.opacity = 0.5; showTip(e.clientX, e.clientY, '<b>' + md(D.days[i]) + '</b> ' + AREA.layers.map(function (l, j) { return sw(CC[j]) + ' ' + l.n + ' ' + l.v[i]; }).join(' ')); return; }
      var t = e.target;
      if (k === 'stack' && t.hasAttribute('data-j')) { var si = +t.getAttribute('data-i'), sj = +t.getAttribute('data-j'), sum = D.stack[si].reduce(function (a, v) { return a + v; }, 0); showTip(e.clientX, e.clientY, '<b>' + D.per[si] + ' · ' + SNAME[sj] + '</b> ' + D.stack[si][sj] + '건(' + Math.round(D.stack[si][sj] / sum * 100) + '%)'); return; }
      if (k === 'donut' && t.hasAttribute('data-i')) { var di = +t.getAttribute('data-i'); showTip(e.clientX, e.clientY, '<b>' + DON.P[di][0] + '</b> ' + DON.P[di][1] + '건(' + Math.round(DON.P[di][1] / DON.tot * 100) + '%)'); return; }
      if (k === 'hist' && t.hasAttribute('data-i')) { var hi = +t.getAttribute('data-i'); showTip(e.clientX, e.clientY, '<b>' + fmt(hi * HIST.bw, false, 1) + '~' + fmt((hi + 1) * HIST.bw, false, 1) + '일</b> ' + HIST.cnt[hi] + '건'); return; }
      if (k === 'heat' && t.hasAttribute('data-r')) { var r = +t.getAttribute('data-r'), cc = +t.getAttribute('data-c'); showTip(e.clientX, e.clientY, '<b>' + MON[r] + '요일 ' + cc * 2 + '–' + (cc * 2 + 2) + '시</b> ' + D.heat[r][cc] + '건'); return; }
      if (k === 'cal' && t.hasAttribute('data-i')) { var dd = CAL[+t.getAttribute('data-i')]; showTip(e.clientX, e.clientY, '<b>' + (dd.dt.getMonth() + 1) + '월 ' + dd.dt.getDate() + '일(' + MON[dd.d] + ')</b> ' + dd.v + '건 처리'); return; }
      if (k === 'scat' && SC) {
        var cr = h.getBoundingClientRect(), mx = e.clientX - cr.left, my = e.clientY - cr.top, best = -1, bd = 100;
        SCAT.forEach(function (q, qi) { var dx = SC.b.x + q[0] / 40 * SC.b.w - mx, dy = SC.b.y + SC.b.h - q[1] / 20 * SC.b.h - my, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = qi; } });
        if (best >= 0) showTip(e.clientX, e.clientY, '댓글 ' + Math.round(SCAT[best][0]) + '개 · <b>' + SCAT[best][1].toFixed(1) + '일</b> 걸림'); else hideTip(); return;
      }
      hideTip();
    });
    on(scr, 'pointerleave', function () { hideTip(); if ($('an-xh')) hoverTrend(null); });
    // Brush & Zoom: 미니맵에서 끌어 구간 고르기
    on(scr, 'pointerdown', function (e) {
      var m = e.target.closest('#an-mini'); if (!m || !TRX) return;
      e.preventDefault(); var p = svgPt(m, e, TW), idx = function (x) { return Math.max(0, Math.min(D.N - 1, Math.round((x - TRX.mb.x) / TRX.mb.w * (D.N - 1)))); };
      drag = { a: idx(p[0]), m: m, idx: idx }; m.setPointerCapture && m.setPointerCapture(e.pointerId);
    });
    on(scr, 'pointermove', function (e) {
      if (!drag) return; var p = svgPt(drag.m, e, TW), bI = drag.idx(p[0]), a = Math.min(drag.a, bI), z = Math.max(drag.a, bI), sel = $('an-sel');
      sel.setAttribute('x', TRX.mx(a)); sel.setAttribute('width', TRX.mx(z) - TRX.mx(a)); drag.b = bI;
    });
    on(scr, 'pointerup', function () {
      if (!drag) return; var a = Math.min(drag.a, drag.b == null ? drag.a : drag.b), z = Math.max(drag.a, drag.b == null ? drag.a : drag.b); drag = null;
      if (z - a >= 2) { st.zoom = [a, z]; renderTrend(false); later(drawLabels, 30); }
    });

    /* ── 누르기 ── */
    on(root, 'click', function (e) {
      var el = e.target.closest('button, a'); if (!el || !root.contains(el)) return;
      if (el.closest('#an-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.tagName === 'A') { e.preventDefault(); return; }
      var v;
      if ((v = el.getAttribute('data-p'))) { if (v !== st.p) load(v); return; }
      if ((v = el.getAttribute('data-sj')) != null) { var j = +v, left = st.off.filter(function (x) { return !x; }).length; if (!st.off[j] && left <= 1) return; st.off[j] = !st.off[j]; renderStack(false); later(drawLabels, 30); return; }
      if ((v = el.getAttribute('data-ti')) != null) { st.team = +v; renderTeams(true); later(drawLabels, 30); return; }
      if (el.getAttribute('data-act') === 'up') { st.team = -1; renderTeams(true); later(drawLabels, 30); return; }
      if (el.id === 'an-tbl') { st.table = !st.table; el.setAttribute('aria-pressed', String(st.table)); el.textContent = st.table ? '차트로 보기' : '표로 보기'; renderStack(false); later(drawLabels, 30); return; }
      if (el.id === 'an-reset') { st.zoom = null; renderTrend(false); later(drawLabels, 30); return; }
      if (el.id === 'an-lpz') { st.live = !st.live; renderLive(); return; }
      if (el.id === 'an-rpl') { st.racePlay = !st.racePlay; playRace(); return; }
    });
    on(root, 'input', function (e) { if (e.target.id === 'an-rq') { st.racePlay = false; clearInterval(raceId); st.raceQ = +e.target.value; renderRace(); } });
    function setCalm(v) { st.calm = v; $('an-calm').checked = v; scr.classList.toggle('calm', v); }
    on($('an-calm'), 'change', function () { setCalm(this.checked); });
    function onMq() { setCalm(mq.matches); }
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    /* ── 용어 보기 ── */
    var PLACE = { 'range-selector': 'below', 'reduced-motion': 'right', 'chart-morph': 'in-br', 'gridlines': 'in-br', 'axis': 'in-bl', 'bar-grow-in': 'in-br', 'renderer-choice': 'right', 'downsampling': 'right', 'data-table-view': 'right', 'legend-toggle': 'below', 'crosshair': 'below' };
    function drawLabels() {
      var L2 = $('an-labels'); L2.hidden = !st.labels; if (!st.labels) return;
      var seen = UI.termLabels(scr, L2, opt.termName, function (id) { return PLACE[id] || ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    var settleId = 0;
    on(main, 'scroll', function () { hideTip(); if (!st.labels) return; drawLabels(); clearTimeout(settleId); settleId = setTimeout(drawLabels, 120); }, { passive: true });
    on(window, 'resize', function () { moveSeg(); if (SC) renderScat(); drawLabels(); });
    // 캔버스는 색을 그릴 때 한 번 읽는다. 테마가 바뀌면(머리 줄 단추, 시스템 설정) 새 색으로 다시 그린다
    var themeMo = new MutationObserver(function () { if (SC) renderScat(); });
    themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    offs.push(function () { themeMo.disconnect(); });
    on(window.matchMedia('(prefers-color-scheme: dark)'), 'change', function () { if (SC) renderScat(); });
    every(tickLive, 1000);

    load(st.p, true);

    function goTo(el) { if (!el) return; var y = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 40; main.scrollTop = Math.max(0, y); }
    return {
      setLabels: function (v) { st.labels = v; drawLabels(); },
      demo: function (id) {
        var q = function (sel) { return root.querySelector(sel); };
        // Skeleton은 잠깐만 보이므로 보이기로 부르면 2.5초 머문다
        if (id === 'skeleton') { goTo(q('#an-trend')); load(st.p, false, 2500); return; }
        if (id === 'chart-morph') { goTo(q('#an-team')); load(st.p === '30' ? '90' : '30'); return; }
        if (id === 'line-draw') { goTo(q('#an-trend')); renderTrend(true); }
        if (id === 'bar-grow-in') { goTo(q('#an-stack')); st.table = false; renderStack(true); }
        if (id === 'drilldown' || id === 'breadcrumb') { goTo(q('#an-team')); if (id === 'breadcrumb' && st.team < 0) { st.team = 0; renderTeams(true); } if (id === 'drilldown' && st.team >= 0) { st.team = -1; renderTeams(true); } }
        if (id === 'crosshair' || id === 'chart-tooltip') { goTo(q('#an-trend')); later(function () { hoverTrend(Math.round(D.N * 0.6)); drawLabels(); }, 60); return; }
        if (id === 'brush-zoom') { goTo(q('#an-trend')); st.zoom = [Math.round(D.N * 0.3), Math.round(D.N * 0.7)]; renderTrend(false); }
        if (id === 'data-table-view') { goTo(q('#an-stack')); }
        if (id === 'bar-chart-race') { goTo(q('#an-race')); st.racePlay = true; playRace(); }
        var el = q('#an-main [data-term="' + id + '"]');
        if (el && ['skeleton', 'line-draw', 'bar-grow-in', 'drilldown', 'breadcrumb', 'brush-zoom', 'bar-chart-race'].indexOf(id) < 0) goTo(el);
        later(drawLabels, 80);
      },
      destroy: function () {
        timers.forEach(clearTimeout); ints.forEach(clearInterval); clearTimeout(settleId); offs.forEach(function (f) { f(); });
        if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        root.innerHTML = '';
      }
    };
  };
})();
