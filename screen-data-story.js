/* 조합 화면: 데이터 스토리. 작업함 팀의 한 해를 스크롤 글 한 편으로 읽힌다 (recipes.json의 data-story)
   글 단계가 틀 가운데를 지나면 옆에 고정된 차트 하나가 그 단계 모습으로 바뀐다. 숫자는 모두 예시용으로 지어낸 값이다
   UI.screens['data-story'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var fmt = UI.fmt, C = UI.chart, CC = C.CC, W = 480, H = 270;
  function T(x, y, s, a, cls, at) { return '<text x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + (cls ? ' class="' + cls + '"' : '') + (at || '') + '>' + s + '</text>'; }
  function L(x1, y1, x2, y2, st) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" style="' + st + '"/>'; }
  var GRID = 'stroke:var(--u-muted);stroke-opacity:.3;stroke-dasharray:2 3', BASE = 'stroke:var(--u-muted);stroke-opacity:.6';
  function mix(c, p) { return 'color-mix(in oklab, ' + c + ' ' + p + '%, var(--u-panel))'; }

  /* ── 데이터(가상): 달마다 닫은 이슈, 팀 6개로 나눔. 9~10월 급증은 앱팀·결제팀 몫 ── */
  var MON = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  var TOT = [82, 88, 95, 90, 98, 104, 101, 108, 142, 151, 126, 99], ALL = 1284, GOAL = 1400, MGOAL = 117;
  // [이름, 평소 몫, 인원, 처리 일수 기준, 팀 목표 배수]
  var TM = [['앱팀', 0.26, 6, 3.8, 0.9], ['결제팀', 0.19, 4, 4.5, 0.95], ['웹팀', 0.18, 5, 3.2, 1.05], ['운영팀', 0.16, 4, 5.0, 0.97], ['검색팀', 0.12, 3, 2.8, 1.1], ['정산팀', 0.09, 3, 3.5, 1.02]];
  var BASEM = TOT.map(function (v, m) { return m === 8 ? 112 : m === 9 ? 114 : v; });
  var TEAM = TM.map(function (t) { return BASEM.map(function (b) { return Math.round(b * t[1]); }); });
  [8, 9].forEach(function (m) { var ex = TOT[m] - BASEM[m], a = Math.round(ex * 0.6); TEAM[0][m] += a; TEAM[1][m] += ex - a; });
  TOT.forEach(function (v, m) { TEAM[3][m] += v - TEAM.reduce(function (a, t) { return a + t[m]; }, 0); });
  var SUM = TEAM.map(function (t) { return t.reduce(function (a, v) { return a + v; }, 0); });
  var DAYS = TM.map(function (t, i) { return MON.map(function (x, m) { var up = (m === 8 || m === 9) ? (i === 0 ? 1.5 : i === 1 ? 1.2 : 0) : (m === 10 && i < 2 ? 0.6 : 0); return Math.round((t[3] - m * 0.08 + up) * 10) / 10; }); });
  var TGOAL = TM.map(function (t, i) { return Math.round(SUM[i] * t[4]); });
  var OVER = SUM.map(function (s, i) { return s >= TGOAL[i]; }), NOVER = OVER.filter(Boolean).length;
  var WF = [['작년 말', 210, 1], ['새 이슈', 1236], ['닫음', -1284], ['중복 정리', -40], ['올해 말', 122, 1]];
  var AVG8 = TOT.slice(0, 8).reduce(function (a, v) { return a + v; }, 0) / 8, JUMP = (TOT[8] + TOT[9]) / 2 / AVG8;
  var share0 = Math.round(SUM[0] / ALL * 100), SMAX = C.niceMax(Math.max.apply(null, TEAM.map(function (t) { return Math.max.apply(null, t); })) * 1.1);

  var STEPS = [
    ['01 · 한 해 합계', '올해 닫은 이슈는 ' + fmt(ALL, true) + '건', '목표 ' + fmt(GOAL, true) + '건의 ' + Math.round(ALL / GOAL * 100) + '%예요. 1,250건부터인 "좋음" 구간에는 들어왔어요.'],
    ['02 · 달마다', '봄부터 조금씩 늘었어요', '1월 ' + TOT[0] + '건에서 8월 ' + TOT[7] + '건까지 천천히 올랐어요.'],
    ['03 · 눈에 띄는 두 달', '9~10월에 크게 뛰었어요', '9월에 새 버전을 낸 뒤 두 달 동안 평소의 ' + JUMP.toFixed(1) + '배를 닫았어요. 점선은 월 목표 ' + MGOAL + '건이에요.'],
    ['04 · 팀별로 나누면', '급증은 앱팀과 결제팀 몫이었어요', '같은 축으로 그린 작은 차트 6개예요. 나머지 팀은 거의 평평해요.'],
    ['05 · 누가 얼마나', '앱팀이 전체의 ' + share0 + '%', '칸 넓이가 팀이 닫은 이슈 수예요. 위 두 팀이 절반 가까이를 맡았어요.'],
    ['06 · 쌓인 이슈', '열린 이슈는 210건에서 122건으로', '새로 1,236건이 들어왔지만 1,284건을 닫고 중복 40건을 정리했어요.'],
    ['07 · 달마다 움직임', '팀은 어디로 움직였나', '재생을 누르면 달마다 팀 버블이 움직여요. 가로는 닫은 건수, 세로는 평균 처리 일수, 크기는 인원이에요.'],
    ['08 · 정리', '팀 목표를 넘은 팀은 ' + NOVER + '곳', '▲ 표시가 팀 목표를 넘은 팀이에요. 숫자는 "표로 보기"로도 볼 수 있어요.']
  ];
  var SUMS = [
    '스크롤하면 이 차트가 단계마다 바뀌어요.',
    '올해 닫은 이슈 <b>' + fmt(ALL, true) + '건</b>, 목표의 ' + Math.round(ALL / GOAL * 100) + '%.',
    '달마다 닫은 이슈. 1월 ' + TOT[0] + '건 → 8월 ' + TOT[7] + '건.',
    '9~10월에 <b>평소의 ' + JUMP.toFixed(1) + '배</b>. 두 달 모두 월 목표 ' + MGOAL + '건을 넘었어요.',
    '팀별 달마다 닫은 이슈. 모든 칸이 같은 축(0~' + SMAX + '건)이에요.',
    '팀별 몫. <b>앱팀 ' + share0 + '%</b>, 결제팀 ' + Math.round(SUM[1] / ALL * 100) + '%.',
    '열린 이슈 210건 → <b>122건</b>. 들어온 것보다 닫은 것이 48건 많았어요.',
    '팀별 닫은 건수와 처리 일수가 달마다 어떻게 바뀌었는지.',
    '팀 6곳 중 <b>' + NOVER + '곳</b>이 팀 목표를 넘었어요.'
  ];
  var LAYER = [0, 1, 2, 2, 4, 5, 6, 7, 8];

  /* ── 차트 층: 단계마다 하나씩, 같은 SVG 안에 겹쳐 둔다 ── */
  function lyIntro() { return '<g class="ds-ly" data-ly="0">' + '<rect x="4" y="4" width="472" height="262" rx="10" style="fill:none;stroke:var(--u-line);stroke-dasharray:4 4"/>' + T(W / 2, H / 2 + 4, '차트가 여기에 나타나요', 'middle') + '</g>'; }
  function lyBullet() {
    var x0 = 50, bw = 400, y = 120, h = 36, X = function (v) { return x0 + v / 1500 * bw; }, s = '<g class="ds-ly off" data-ly="1" data-term="bullet-chart">';
    s += T(x0, 72, '0', 'start', 'big', ' id="ds-num" data-term="number-ticker"') + T(x0, 96, '건 닫음 · 목표 ' + fmt(GOAL, true) + '건', 'start');
    [[0, 1000, 30, '나쁨'], [1000, 1250, 20, '보통'], [1250, 1500, 10, '좋음']].forEach(function (r) { s += '<rect x="' + X(r[0]) + '" y="' + y + '" width="' + (X(r[1]) - X(r[0])) + '" height="' + h + '" style="fill:' + mix('var(--u-muted)', r[2]) + '"/>' + T((X(r[0]) + X(r[1])) / 2, y - 6, r[3], 'middle'); });
    s += '<rect class="ds-bm" x="' + x0 + '" y="' + (y + h / 3) + '" width="' + (X(ALL) - x0) + '" height="' + (h / 3) + '" rx="3" style="fill:var(--c1)"/>' + L(X(GOAL), y + 4, X(GOAL), y + h - 4, 'stroke:var(--u-ink);stroke-width:3') + T(X(GOAL), y + h + 30, '목표 ' + fmt(GOAL, true), 'middle', 'vl');
    [0, 500, 1000, 1500].forEach(function (v) { s += T(X(v), y + h + 14, fmt(v, true), 'middle'); });
    return s + '</g>';
  }
  var LB = { x: 44, y: 30, w: 410, h: 196 }, LMAX = 160;
  function LX(m) { return LB.x + LB.w * m / 11; }
  function LY(v) { return LB.y + LB.h - v / LMAX * LB.h; }
  function pts(arr, a, z, X, Y) { var p = []; for (var m = a; m <= z; m++) p.push(X(m).toFixed(1) + ',' + Y(arr[m]).toFixed(1)); return p.join(' '); }
  function lyLine() {
    var s = '<g class="ds-ly off ds-line" data-ly="2" data-term="line-chart"><g data-term="axis">';
    for (var i = 0; i <= 4; i++) { var v = LMAX * i / 4, y = LY(v); s += L(LB.x, y, LB.x + LB.w, y, i ? GRID : BASE) + T(LB.x - 6, y + 4, v + (i === 4 ? '건' : ''), 'end'); }
    MON.forEach(function (n, m) { if (m % 2 === 0 || m === 11) s += T(LX(m), LB.y + LB.h + 16, n, 'middle'); });
    s += '</g>';
    s += '<g class="ds-an" style="--d:0ms"><rect x="' + LX(7.5) + '" y="' + LB.y + '" width="' + (LX(9.5) - LX(7.5)) + '" height="' + LB.h + '" style="fill:var(--u-muted);opacity:.12"/></g>';
    s += '<polyline class="ds-base ds-draw" data-term="line-draw" pathLength="1" points="' + pts(TOT, 0, 11, LX, LY) + '" style="fill:none;stroke:var(--c1);stroke-width:2.5;stroke-linejoin:round"/>';
    s += '<polyline class="ds-hl" data-term="focus-dimming" points="' + pts(TOT, 7, 10, LX, LY) + '" style="fill:none;stroke:var(--c1);stroke-width:4;stroke-linejoin:round;stroke-linecap:round"/>';
    s += '<g class="ds-an" style="--d:250ms" data-term="reference-line">' + L(LB.x, LY(MGOAL), LB.x + LB.w, LY(MGOAL), 'stroke:var(--u-ink);stroke-width:1.2;stroke-dasharray:5 4') + T(LB.x + LB.w, LY(MGOAL) + 14, '월 목표 ' + MGOAL + '건', 'end') + '</g>';
    s += '<g class="ds-an" style="--d:600ms" data-term="annotation-reveal"><path d="M' + (LX(9) - 8) + ' ' + LY(TOT[9]) + 'H' + (LX(8) - 4) + '" style="fill:none;stroke:var(--u-ink);stroke-width:1.2"/>' + T(LX(8) - 8, LY(TOT[9]) + 4, '9월 출시 뒤 두 달, 평소의 ' + JUMP.toFixed(1) + '배', 'end', 'vl') + '</g>';
    [8, 9].forEach(function (m) { s += '<circle class="ds-an" style="--d:150ms" cx="' + LX(m) + '" cy="' + LY(TOT[m]) + '" r="5" fill="var(--c1)" stroke="var(--u-panel)" stroke-width="2"/>'; });
    return s + '</g>';
  }
  function lySmall() {
    var cols = 3, gw = 10, gh = 10, pw = (W - gw * (cols - 1)) / cols, ph = (H - gh) / 2, max = SMAX, s = '<g class="ds-ly off" data-ly="4" data-term="small-multiples">';
    TM.forEach(function (t, i) {
      var cx = (i % cols) * (pw + gw), cy = Math.floor(i / cols) * (ph + gh), p = { x: cx + 26, y: cy + 26, w: pw - 36, h: ph - 46 };
      var X = function (m) { return p.x + p.w * m / 11; }, Y = function (v) { return p.y + p.h - v / max * p.h; };
      s += '<g class="ds-pn" style="--d:' + (380 + i * 90) + 'ms"' + (i ? '' : ' data-term="enter-update-exit"') + '><rect x="' + (cx + 0.5) + '" y="' + (cy + 0.5) + '" width="' + (pw - 1) + '" height="' + (ph - 1) + '" rx="8" style="fill:var(--u-panel);stroke:var(--u-line)"/>' +
        T(cx + 10, cy + 17, t[0], 'start', 'vl') + T(cx + pw - 10, cy + 17, fmt(SUM[i], true) + '건', 'end') +
        L(p.x, p.y + p.h, p.x + p.w, p.y + p.h, BASE) + L(p.x, p.y, p.x + p.w, p.y, GRID) + (i % cols ? '' : T(p.x - 4, p.y + 4, max, 'end') + T(p.x - 4, p.y + p.h + 4, 0, 'end')) +
        T(p.x, p.y + p.h + 14, '1월', 'start') + T(p.x + p.w, p.y + p.h + 14, '12월', 'end') +
        '<polyline class="ds-draw" pathLength="1" points="' + pts(TEAM[i], 0, 11, X, Y) + '" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/></g>';
    });
    return s + '</g>';
  }
  function lyTree() {
    var R = C.treeLayout(SUM, { x: 4, y: 4, w: 472, h: 236 }, false, false), s = '<g class="ds-ly off" data-ly="5" data-term="treemap">';
    R.forEach(function (r, i) {
      s += '<g class="ds-tc" style="--d:' + (i * 70) + 'ms"><rect x="' + (r.x + 1) + '" y="' + (r.y + 1) + '" width="' + (r.w - 2) + '" height="' + (r.h - 2) + '" rx="4" style="fill:' + mix('var(--c1)', i < 2 ? 60 : 35) + '"/>' +
        T(r.x + 10, r.y + 22, TM[i][0], 'start', 'vl') + T(r.x + 10, r.y + 40, fmt(SUM[i], true) + '건 · ' + Math.round(SUM[i] / ALL * 100) + '%', 'start', 'ds-ink') + '</g>';
    });
    s += T(4, 260, '칸 넓이 = 닫은 이슈 수', 'start') + T(W - 4, 260, '작은 차트에서 트리맵으로는 모양을 이을 수 없어 교차 페이드', 'end', '', ' data-term="chart-type-morph"');
    return s + '</g>';
  }
  function lyWater() {
    var b = { x: 50, y: 30, w: 410, h: 196 }, max = 1500, band = b.w / WF.length, th = band * 0.56, Y = function (v) { return b.y + b.h - v / max * b.h; }, lv = 0, s = '<g class="ds-ly off" data-ly="6" data-term="waterfall-chart">';
    for (var i = 0; i <= 3; i++) { var v = max * i / 3, y = Y(v); s += L(b.x, y, b.x + b.w, y, i ? GRID : BASE) + T(b.x - 6, y + 4, fmt(v, true), 'end'); }
    s += '<rect x="' + (b.x + 220) + '" y="6" width="10" height="10" rx="2" style="fill:var(--div-neg)"/>' + T(b.x + 234, 15, '늘어남', 'start') + '<rect x="' + (b.x + 290) + '" y="6" width="10" height="10" rx="2" style="fill:var(--div-pos)"/>' + T(b.x + 304, 15, '줄어듦', 'start') + T(b.x - 6, 15, '열린 이슈', 'start');
    WF.forEach(function (d, i) {
      var a = d[2] ? 0 : lv, z = d[2] ? d[1] : lv + d[1], x = b.x + band * i + (band - th) / 2, col = d[2] ? 'var(--u-muted)' : d[1] > 0 ? 'var(--div-neg)' : 'var(--div-pos)';
      lv = z;
      s += '<g class="ds-wb" style="--d:' + (i * 160) + 'ms"><rect x="' + x + '" y="' + Y(Math.max(a, z)) + '" width="' + th + '" height="' + Math.max(1, Y(Math.min(a, z)) - Y(Math.max(a, z))) + '" rx="3" style="fill:' + col + '"/>' +
        T(x + th / 2, Y(Math.max(a, z)) - 6, d[2] ? fmt(d[1], true) : (d[1] > 0 ? '+' : '−') + fmt(Math.abs(d[1]), true), 'middle', 'vl') + '</g>' + T(x + th / 2, b.y + b.h + 16, d[0], 'middle');
      if (i < WF.length - 1) s += L(x + th, Y(z), x + band, Y(z), 'stroke:var(--u-muted);stroke-dasharray:3 2;opacity:.7');
    });
    return s + '</g>';
  }
  var BB = { x: 44, y: 20, w: 410, h: 204 }, BXM = 60, BYM = 8;
  function BX(v) { return BB.x + v / BXM * BB.w; }
  function BY(v) { return BB.y + BB.h - v / BYM * BB.h; }
  function lyBubble() {
    var s = '<g class="ds-ly off" data-ly="7" data-term="bubble-chart">';
    for (var i = 0; i <= 4; i++) { var v = BYM * i / 4, y = BY(v); s += L(BB.x, y, BB.x + BB.w, y, i ? GRID : BASE) + T(BB.x - 6, y + 4, v + (i === 4 ? '일' : ''), 'end'); }
    [0, 20, 40, 60].forEach(function (v) { s += T(BX(v), BB.y + BB.h + 16, v + (v === 60 ? '건' : ''), 'middle'); });
    s += T(BB.x + 12, BB.y + BB.h - 12, MON[0], 'start', 'ds-mo', ' id="ds-mo"') + T(BB.x + BB.w, BB.y + 10, '가로 닫은 건수 · 세로 처리 일수 · 원 인원', 'end');
    TM.forEach(function (t, i) { s += '<g class="ds-bb" data-i="' + i + '"><circle r="' + (7 * Math.sqrt(t[2])) + '" style="fill:var(--c1);fill-opacity:.5;stroke:var(--u-panel);stroke-width:1.5"/>' + T(0, 4, t[0].replace('팀', ''), 'middle', 'ds-ink ds-halo') + '</g>'; });
    return s + '</g>';
  }
  function lyBars() {
    var order = SUM.map(function (v, i) { return i; }).sort(function (a, z) { return SUM[z] - SUM[a]; }), b = { x: 58, y: 18, w: 300, h: 220 }, max = 450, rh = b.h / 6, X = function (v) { return b.x + v / max * b.w; }, s = '<g class="ds-ly off" data-ly="8" data-term="bar-chart">', first = true;
    order.forEach(function (i, r) {
      var y = b.y + rh * r + rh * 0.2, h = rh * 0.6, ok = OVER[i];
      s += T(b.x - 8, y + h / 2 + 4, TM[i][0], 'end') + '<rect class="ds-hb" style="--d:' + (r * 70) + 'ms;fill:' + (ok ? 'var(--c1)' : mix('var(--u-muted)', 55)) + '" x="' + b.x + '" y="' + y + '" width="' + (X(SUM[i]) - b.x) + '" height="' + h + '" rx="3"/>' +
        L(X(TGOAL[i]), y - 3, X(TGOAL[i]), y + h + 3, 'stroke:var(--u-ink);stroke-width:2') +
        T(Math.max(X(SUM[i]), X(TGOAL[i])) + 8, y + h / 2 + 4, '<tspan class="vl">' + SUM[i] + '</tspan> / 목표 ' + TGOAL[i] + (ok ? ' <tspan class="ds-ok">▲ 넘음</tspan>' : ''), 'start', '', ok && first ? ' data-term="non-color-encoding"' : '');
      if (ok) first = false;
    });
    s += T(b.x, H - 4, '세로 눈금 = 팀 목표', 'start');
    return s + '</g>';
  }
  function table() {
    return '<table class="an-tbl"><caption>팀별 한 해 (가상 데이터)</caption><thead><tr><th>팀</th><th>닫은 이슈</th><th>팀 목표</th><th>전체 대비</th><th>평균 처리 일수</th></tr></thead><tbody>' +
      TM.map(function (t, i) { var avg = DAYS[i].reduce(function (a, v) { return a + v; }, 0) / 12; return '<tr><th>' + t[0] + (OVER[i] ? ' ▲' : '') + '</th><td>' + SUM[i] + '</td><td>' + TGOAL[i] + '</td><td>' + Math.round(SUM[i] / ALL * 100) + '%</td><td>' + avg.toFixed(1) + '</td></tr>'; }).join('') +
      '<tr><th>합계</th><td>' + fmt(ALL, true) + '</td><td>' + fmt(GOAL, true) + '</td><td>100%</td><td></td></tr></tbody></table>';
  }

  UI.screens['data-story'] = function (root, opt) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var st = { labels: false, calm: mq.matches, step: -1, mo: 0, table: false };
    var timers = [], offs = [], ios = [], playId = 0, tickRaf = 0;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); offs.push(function () { el.removeEventListener(ev, fn, o); }); }
    function $(id) { return root.querySelector('#' + id); }

    root.innerHTML =
      '<div class="u scr ds' + (st.calm ? ' calm' : '') + '">' +
        '<div class="ds-main" id="ds-main">' +
          '<header class="ds-top"><b>작업함 연간 리포트</b><span>2026 · 가상 데이터</span>' +
            '<label class="ds-calm" data-term="reduced-motion"><input type="checkbox" id="ds-calm"' + (st.calm ? ' checked' : '') + '> 동작 줄이기</label>' +
            '<i class="ds-prog" id="ds-prog" data-term="scroll-progress"></i></header>' +
          '<section class="ds-intro ds-rv" data-i="0" data-term="scroll-reveal"><span class="ds-eye">우리 팀의 한 해</span><h1>올해 우리 팀은 이슈를 얼마나 풀었을까</h1>' +
            '<p>작업함에 쌓인 한 해 기록을 차트 하나로 따라가 봐요. 아래로 스크롤하면 오른쪽 차트가 글에 맞춰 바뀌어요.</p>' +
            '<p class="ds-note">이 글의 숫자는 조합 화면 예시를 위해 지어낸 값이에요.</p><p class="ds-hint">↓ 스크롤</p></section>' +
          '<div class="ds-story" data-term="sticky-scrollytelling"><div class="ds-steps">' + STEPS.map(function (s, i) {
            return '<article class="ds-step" data-i="' + (i + 1) + '"><b>' + s[0] + '</b><h3>' + s[1] + '</h3><p>' + s[2] + '</p></article>';
          }).join('') + '</div>' +
          '<figure class="ds-fig" id="ds-fig" data-term="step-transition"><p class="ds-sum" id="ds-sum" data-term="chart-summary" aria-live="polite"></p>' +
            '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="ds-sum">' + lyIntro() + lyBullet() + lyLine() + lySmall() + lyTree() + lyWater() + lyBubble() + lyBars() + '</svg>' +
            '<div class="ds-tw" id="ds-tw" hidden>' + table() + '</div>' +
            '<div class="ds-ctrl" id="ds-c7" hidden data-term="motion-chart"><button type="button" class="ds-btn" id="ds-play"></button><input type="range" id="ds-rng" min="0" max="11" step="1" value="0" aria-label="달 고르기"><span id="ds-ml">1월</span></div>' +
            '<div class="ds-ctrl" id="ds-c8" hidden><button type="button" class="ds-btn" id="ds-tb" aria-pressed="false" data-term="data-table-view">표로 보기</button></div>' +
          '</figure></div>' +
          '<section class="ds-end ds-rv"><h2>내년에는</h2><p>급증한 두 달에 처리 일수도 함께 늘었어요. 새 버전을 낼 때는 앱팀·결제팀에 한 달 앞서 사람을 더 붙이는 것부터 시작해요.</p><p class="ds-note">작업함 · 조합 화면용 가상 제품과 가상 데이터</p></section>' +
        '</div>' +
        '<div class="scr-labels" id="ds-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.ds'), main = $('ds-main'), svg = root.querySelector('.ds-fig svg'), LY = {};
    svg.querySelectorAll('.ds-ly').forEach(function (g) { LY[g.getAttribute('data-ly')] = g; });
    var bbs = [].slice.call(svg.querySelectorAll('.ds-bb'));

    /* ── 단계 ── */
    function setStep(i) {
      if (i === st.step) return;
      st.step = i;
      root.querySelectorAll('.ds-step').forEach(function (s) { s.classList.toggle('on', +s.getAttribute('data-i') === i); });
      Object.keys(LY).forEach(function (k) { LY[k].classList.toggle('off', +k !== LAYER[i]); });
      LY[2].classList.toggle('focus', i === 3);
      $('ds-sum').innerHTML = SUMS[i];
      $('ds-c7').hidden = i !== 7; $('ds-c8').hidden = i !== 8;
      if (i !== 7) stopPlay();
      if (i !== 8) showTable(false);
      if (i === 1) ticker();
      later(drawLabels, 450);
    }
    // Number Ticker: 단계 1에 들어올 때마다 0에서 합계까지
    function ticker() {
      var el = $('ds-num'), t0 = 0; cancelAnimationFrame(tickRaf);
      if (st.calm) { el.textContent = fmt(ALL, true); return; }
      function f(now) { if (!t0) t0 = now; var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.round(ALL * e), true); if (p < 1) tickRaf = requestAnimationFrame(f); }
      tickRaf = requestAnimationFrame(f);
    }
    // Motion Chart: 재생하면 0.6초마다 한 달. 동작 줄이기면 재생 없이 슬라이더만
    function setMonth(m) {
      st.mo = m; $('ds-rng').value = m; $('ds-ml').textContent = MON[m]; $('ds-mo').textContent = MON[m];
      bbs.forEach(function (g, i) { g.style.transform = 'translate(' + BX(TEAM[i][m]).toFixed(1) + 'px,' + BY(DAYS[i][m]).toFixed(1) + 'px)'; });
    }
    function playLabel() { var b = $('ds-play'); b.hidden = st.calm; b.textContent = playId ? '❚❚ 멈춤' : '▶ 재생'; b.setAttribute('aria-pressed', String(!!playId)); }
    function stopPlay() { clearInterval(playId); playId = 0; playLabel(); }
    function play() {
      if (playId) { stopPlay(); return; }
      if (st.calm) return;
      if (st.mo >= 11) setMonth(0);
      playId = setInterval(function () { if (st.mo >= 11) { stopPlay(); return; } setMonth(st.mo + 1); }, 600);
      playLabel();
    }
    function showTable(v) { st.table = v; $('ds-tw').hidden = !v; svg.style.display = v ? 'none' : ''; var b = $('ds-tb'); b.setAttribute('aria-pressed', String(v)); b.textContent = v ? '차트로 보기' : '표로 보기'; }

    /* ── 스크롤 ── */
    function watch(els, fn, o) { var io = new IntersectionObserver(function (es) { es.forEach(fn); }, o); [].forEach.call(els, function (el) { io.observe(el); }); ios.push(io); return io; }
    // Step Transition: 틀 가운데 띠에 들어온 단계를 지금 단계로 (scroll 이벤트로 재지 않는다)
    watch(root.querySelectorAll('.ds-step, .ds-intro'), function (e) { if (e.isIntersecting) setStep(+e.target.getAttribute('data-i')); }, { root: main, rootMargin: '-45% 0px -45% 0px' });
    // Scroll Reveal: 처음 보일 때 한 번
    var once = watch(root.querySelectorAll('.ds-rv'), function (e) { if (!e.isIntersecting) return; once.unobserve(e.target); e.target.classList.add('in'); }, { root: main, threshold: 0.2 });
    // Scroll Progress: 글을 얼마나 읽었는지
    function prog() { var m = main.scrollHeight - main.clientHeight; $('ds-prog').style.transform = 'scaleX(' + (m > 0 ? main.scrollTop / m : 0).toFixed(3) + ')'; }
    var settleId = 0;
    on(main, 'scroll', function () { prog(); if (!st.labels) return; drawLabels(); clearTimeout(settleId); settleId = setTimeout(drawLabels, 120); }, { passive: true });

    /* ── 사건 ── */
    on(root, 'click', function (e) {
      var el = e.target.closest('button'); if (!el || !root.contains(el)) return;
      if (el.closest('#ds-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.id === 'ds-play') play();
      if (el.id === 'ds-tb') { showTable(!st.table); later(drawLabels, 30); }
    });
    on($('ds-rng'), 'input', function () { stopPlay(); setMonth(+this.value); });
    function setCalm(v) { st.calm = v; $('ds-calm').checked = v; scr.classList.toggle('calm', v); if (v) stopPlay(); playLabel(); }
    on($('ds-calm'), 'change', function () { setCalm(this.checked); });
    function onMq() { setCalm(mq.matches); }
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    /* ── 용어 보기 ── */
    var PLACE = { 'scroll-progress': 'below', 'reduced-motion': 'right', 'step-transition': 'in-br', 'sticky-scrollytelling': 'in-bl', 'chart-summary': 'right', 'axis': 'in-bl', 'line-chart': 'in-br', 'small-multiples': 'in-br', 'treemap': 'in-br', 'bubble-chart': 'in-br', 'bar-chart': 'in-br', 'waterfall-chart': 'in-br' };
    function drawLabels() {
      var L2 = $('ds-labels'); L2.hidden = !st.labels; if (!st.labels) return;
      var seen = UI.termLabels(scr, L2, opt.termName, function (id) { return PLACE[id] || ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    on(window, 'resize', drawLabels);

    setMonth(0); playLabel(); setStep(0); prog();

    // 단계 글을 틀 가운데로
    function goStep(i) {
      var el = root.querySelector('[data-i="' + i + '"]'); if (!el) return;
      var r = el.getBoundingClientRect(), m = main.getBoundingClientRect();
      main.scrollTop = Math.max(0, r.top - m.top + main.scrollTop - (main.clientHeight - r.height) / 2);
      setStep(i);
    }
    var DEMO = { 'bullet-chart': 1, 'number-ticker': 1, 'line-chart': 2, 'line-draw': 2, 'axis': 2, 'step-transition': 2, 'sticky-scrollytelling': 2, 'chart-summary': 2, 'focus-dimming': 3, 'annotation-reveal': 3, 'reference-line': 3, 'small-multiples': 4, 'enter-update-exit': 4, 'treemap': 5, 'chart-type-morph': 5, 'waterfall-chart': 6, 'bubble-chart': 7, 'motion-chart': 7, 'bar-chart': 8, 'non-color-encoding': 8, 'data-table-view': 8 };
    return {
      setLabels: function (v) { st.labels = v; drawLabels(); },
      demo: function (id) {
        if (id === 'scroll-progress') { main.scrollTop = (main.scrollHeight - main.clientHeight) * 0.35; }
        else if (id === 'scroll-reveal' || id === 'reduced-motion') { main.scrollTop = 0; }
        else if (DEMO[id] != null) {
          var i = DEMO[id];
          // 같은 단계를 다시 부르면 그 단계 움직임을 처음부터: 앞 단계를 거쳐 들어온다
          var go = function () { goStep(i); if (id === 'motion-chart') { stopPlay(); setMonth(0); later(play, 300); } if (id === 'data-table-view') showTable(true); };
          if (st.step === i) { setStep(i === 1 ? 0 : i - 1); later(go, 60); } else go();
        }
        prog(); later(drawLabels, 500);
      },
      destroy: function () {
        timers.forEach(clearTimeout); clearTimeout(settleId); stopPlay(); cancelAnimationFrame(tickRaf);
        offs.forEach(function (f) { f(); }); ios.forEach(function (io) { io.disconnect(); });
        if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        root.innerHTML = '';
      }
    };
  };
})();
