/* 조합 화면: 대시보드. 용어 10개를 한 화면에 엮는다 (recipes.json의 dashboard)
   UI.screens['dashboard'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var PERIODS = { '7': '7일', '30': '30일', '90': '90일' };
  // 지표 4개. 좋은 방향(up)이 다르다: 건수·금액은 오를수록, 환불률·처리 시간은 내릴수록 좋다
  var KPIS = [
    { k: '결제 건수', v: { 7: 18240, 30: 76915, 90: 231480 }, d: { 7: 6.2, 30: 3.4, 90: 9.1 }, unit: '%', up: true, dec: 0, suf: '건', seed: 1, sum: true },
    { k: '결제 금액', v: { 7: 14.2, 30: 61.8, 90: 183.5 }, d: { 7: 5.1, 30: 2.2, 90: 7.8 }, unit: '%', up: true, dec: 2, suf: '억 원', seed: 4, sum: true },
    { k: '환불률', v: { 7: 2.4, 30: 2.7, 90: 2.6 }, d: { 7: -0.3, 30: 0.2, 90: -0.1 }, unit: '%p', up: false, dec: 1, suf: '%', seed: 7 },
    { k: '평균 처리 시간', v: { 7: 1.8, 30: 1.9, 90: 2.0 }, d: { 7: 0.2, 30: -0.1, 90: 0.3 }, unit: '초', up: false, dec: 1, suf: '초', seed: 9 }
  ];
  var METHODS = [['카드 결제', 'ok', '정상'], ['계좌이체', 'warn', '응답 느림'], ['간편결제', 'danger', '오류 증가'], ['휴대폰 결제', 'info', '11월 30일 점검 예정']];
  var REASONS = [['단순 변심', 38], ['배송 지연', 24], ['상품 불량', 19], ['기타', 19]];
  var SW = 160, SH = 32;

  UI.screens['dashboard'] = function (root, opt) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var st = { p: '7', labels: false, calm: mq.matches, chart: 'load' };
    var shown = KPIS.map(function (x) { return x.v[st.p]; });
    var timers = [], frames = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    // 스파크라인은 하루 값: 합계 지표는 기간 일수로 나누고, 비율·평균 지표는 그대로
    function seriesOf(i, p) { var b = KPIS[i].v[p] / (KPIS[i].sum ? +p : 1); return UI.series(KPIS[i].seed + (+p) / 7, 12, b * 0.8, b * 0.12); }
    // 숫자 바꾸기 (Number Ticker). 앱 안의 보기에서 requestAnimationFrame이 멈출 수 있어 타이머를 함께 건다
    function tween(dur, fn) {
      var start = performance.now(), raf = null, tm = null;
      function stop() { cancelAnimationFrame(raf); clearTimeout(tm); }
      (function step() { stop(); var p = Math.min(1, (performance.now() - start) / dur); fn(p); if (p < 1) { raf = requestAnimationFrame(step); tm = setTimeout(step, 50); } })();
      frames.push(stop);
    }

    root.innerHTML =
      '<div class="u scr' + (st.calm ? ' calm' : '') + '">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) { return '<li><a href="#"' + (i === 2 ? ' aria-current="page"' : '') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="db-main" id="sb-main">' +
          '<div class="db-banner" id="sb-banner" role="status" data-term="banner"><span class="ico">!</span><span style="flex:1;min-width:0">11월 30일 22시부터 30분 동안 결제 점검이 있습니다. 그동안 휴대폰 결제를 쓸 수 없습니다.</span><a href="#">자세히</a><button type="button" class="u-icon" data-act="closeban" aria-label="안내 닫기">×</button></div>' +
          '<div class="db-head"><h2>결제 대시보드</h2><div class="u-seg" role="group" aria-label="기간" id="sb-seg"><span class="u-seg-ind"></span>' +
            Object.keys(PERIODS).map(function (p) { return '<button type="button" data-p="' + p + '" aria-pressed="' + (p === st.p) + '">' + PERIODS[p] + '</button>'; }).join('') + '</div>' +
            '<span style="flex:1"></span><label class="db-calm" data-term="reduced-motion"><input type="checkbox" id="sb-calm"' + (st.calm ? ' checked' : '') + '> 동작 줄이기</label></div>' +
          '<div class="db-grid" id="sb-kpis" data-term="card-grid">' + KPIS.map(function (x, i) {
            return '<div class="kpi u-stag" style="--d:' + (i * 40) + 'ms"' + (i ? '' : ' data-term="kpi-card"') + '><span class="lb">' + x.k + '</span>' +
              '<b class="v" id="sb-v' + i + '"' + (i ? '' : ' data-term="number-ticker"') + '></b><span class="dl" id="sb-d' + i + '"></span>' +
              '<div class="sp" id="sb-s' + i + '" data-i="' + i + '"' + (i ? '' : ' data-term="sparkline"') + '></div></div>';
          }).join('') + '</div>' +
          '<div class="db-row" data-term="stagger">' +
            '<section class="db-card u-stag" style="--d:160ms"><h3>결제 수단 상태</h3><div data-term="semantic-color">' + METHODS.map(function (m) {
              return '<div class="stat-row"><span>' + m[0] + '</span>' + UI.statHTML(m[1], m[2]) + '</div>';
            }).join('') + '</div></section>' +
            '<section class="db-card u-stag" style="--d:200ms"><h3>환불 사유 · <span id="sb-rp">' + PERIODS[st.p] + '</span></h3><div id="sb-chart" class="db-chart"></div></section>' +
          '</div>' +
        '</div>' +
        '<div class="u-tip sd-tip off" id="sb-tip" role="tooltip"></div>' +
        '<div class="scr-labels" id="sb-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr');

    /* ── 지표 ── */
    function drawKpi(i, val) {
      var x = KPIS[i];
      $('sb-v' + i).textContent = UI.fmt(val, true, x.sum && x.dec ? 1 : x.dec) + ' ' + x.suf;
      $('sb-d' + i).innerHTML = UI.deltaHTML(x.d[st.p], x.up, x.unit).replace('지난달보다', '지난 ' + PERIODS[st.p] + '보다');
      $('sb-s' + i).innerHTML = UI.spark(seriesOf(i, st.p), SW, SH, '면', true) + '<svg class="hov" viewBox="0 0 ' + SW + ' ' + SH + '" width="' + SW + '" height="' + SH + '" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none"></svg>';
    }
    function setPeriod(p, first) {
      var from = shown.slice();
      st.p = p;
      root.querySelectorAll('#sb-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === p)); });
      moveSeg();
      $('sb-rp').textContent = PERIODS[p];
      var to = KPIS.map(function (x) { return x.v[p]; });
      if (st.calm) { to.forEach(function (v, i) { drawKpi(i, v); }); shown = to; }
      else tween(first ? 1200 : 700, function (k) {
        var e = UI.ease.out(k);
        shown = to.map(function (v, i) { return from[i] + (v - from[i]) * e; });
        shown.forEach(function (v, i) { drawKpi(i, v); });
      });
      if (st.chart === 'ok') drawChart();
    }
    function moveSeg() {
      var on = root.querySelector('#sb-seg button[aria-pressed="true"]'), ind = root.querySelector('#sb-seg .u-seg-ind');
      if (on) { ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; }
    }

    /* ── 스파크라인 위에 마우스: 십자선과 그날 값 ── */
    function hover(e) {
      var sp = e.target.closest('.sp'), tip = $('sb-tip');
      root.querySelectorAll('.sp .hov').forEach(function (h) { if (!sp || !sp.contains(h)) h.innerHTML = ''; });
      if (!sp) { tip.classList.add('off'); return; }
      var i = +sp.getAttribute('data-i'), vals = seriesOf(i, st.p), n = vals.length, pad = 3;
      var r = sp.querySelector('svg').getBoundingClientRect(), x = (e.clientX - r.left) / r.width * SW;
      var idx = Math.max(0, Math.min(n - 1, Math.round((x - pad) / (SW - pad * 2) * (n - 1))));
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), X = pad + idx * (SW - pad * 2) / (n - 1), Y = SH - pad - (vals[idx] - mn) / (mx - mn || 1) * (SH - pad * 2);
      sp.querySelector('.hov').innerHTML = '<line x1="' + X + '" x2="' + X + '" y1="0" y2="' + SH + '" style="stroke:var(--u-ink);stroke-width:1;opacity:0.35"/><circle cx="' + X + '" cy="' + Y + '" r="3.5" style="fill:var(--u-ink);stroke:var(--u-panel);stroke-width:1.5"/>';
      var days = { 7: 7, 30: 30, 90: 90 }[st.p], d = new Date(); d.setDate(d.getDate() - Math.round((n - 1 - idx) * days / (n - 1)));
      tip.textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 · 하루 ' + UI.fmt(vals[idx], true, KPIS[i].dec) + ' ' + KPIS[i].suf;
      tip.classList.remove('off');
      var a = scr.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(a.width - tip.offsetWidth - 4, r.left - a.left + X / SW * r.width - tip.offsetWidth / 2)) + 'px';
      tip.style.top = (r.top - a.top - tip.offsetHeight - 8) + 'px';
    }

    /* ── 환불 사유 차트: 처음엔 실패(Error State), 다시 시도하면 Spinner 뒤에 그림 ── */
    function drawChart() {
      var box = $('sb-chart'), k = { 7: 0, 30: 3, 90: -2 }[st.p];
      if (st.chart === 'load') box.innerHTML = '<div class="db-center">' + UI.spinHTML(20, 'run') + '</div>';
      else if (st.chart === 'err') box.innerHTML = '<div class="u-empty" data-term="error-state" style="padding:6px">' + UI.WARN_ICO + '<b>차트를 불러오지 못했습니다</b><span>서버 응답이 늦습니다 (504). 다른 카드는 그대로 볼 수 있습니다.</span><button type="button" class="u-btn" data-act="retry">다시 시도</button></div>';
      else if (st.chart === 'retry') box.innerHTML = '<div class="db-center" id="sb-wait"></div>';
      else box.innerHTML = '<div class="hbars u-fade">' + REASONS.map(function (r, i) {
        var v = Math.max(5, r[1] + (i === 0 ? k : i === 1 ? -k : 0));
        return '<div class="hbar"><span>' + r[0] + '</span><i style="width:' + (v / 45 * 100) + '%"></i><b>' + v + '%</b></div>';
      }).join('') + '</div>';
      later(drawLabels, 30);
    }
    function retry(slow) {
      st.chart = 'retry'; drawChart();
      // 300ms가 넘을 때만 Spinner를 보인다
      later(function () { if (st.chart === 'retry') { $('sb-wait').innerHTML = UI.spinHTML(20, 'run').replace('class="u-spin', 'data-term="spinner" class="u-spin') + '<span>다시 불러오는 중</span>'; drawLabels(); } }, 300);
      later(function () { if (st.chart === 'retry') { st.chart = 'ok'; drawChart(); } }, slow ? 2200 : 1100);
    }

    /* ── 사건 ── */
    root.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (!el || !root.contains(el)) return;
      if (el.closest('#sb-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.tagName === 'A') { e.preventDefault(); return; }
      var v;
      if ((v = el.getAttribute('data-p'))) { setPeriod(v); return; }
      switch (el.getAttribute('data-act')) {
        case 'closeban': $('sb-banner').hidden = true; later(drawLabels, 30); break;
        case 'retry': retry(false); break;
      }
    });
    $('sb-calm').addEventListener('change', function () { st.calm = this.checked; scr.classList.toggle('calm', st.calm); });
    function onMq() { st.calm = mq.matches; $('sb-calm').checked = st.calm; scr.classList.toggle('calm', st.calm); }
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    scr.addEventListener('mousemove', hover);
    scr.addEventListener('mouseleave', function () { hover({ target: scr }); });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('sb-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'card-grid' || id === 'stagger' ? 'in-br' : id === 'reduced-motion' ? 'right' : ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { moveSeg(); drawLabels(); }
    window.addEventListener('resize', onResize);
    $('sb-main').addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    // Stagger는 CSS 애니메이션이다. 앱 안의 보기에서 애니메이션이 멈춰도 카드가 투명한 채 남지 않게, 끝날 시간에 타이머로 클래스를 걷어 낸다
    function settle() { later(function () { root.querySelectorAll('.u-stag').forEach(function (c) { c.classList.remove('u-stag'); }); }, 700); }

    // 처음: 카드가 차례로 나타나고(Stagger) 숫자가 0부터 올라가고, 환불 사유 차트는 불러오기에 실패한다
    settle();
    shown = [0, 0, 0, 0];
    KPIS.forEach(function (x, i) { drawKpi(i, 0); });
    setPeriod('7', true);
    drawChart();
    later(function () { st.chart = 'err'; drawChart(); }, 700);

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        if (id === 'banner') { $('sb-banner').hidden = false; $('sb-main').scrollTop = 0; }
        else if (id === 'error-state') { st.chart = 'err'; drawChart(); }
        else if (id === 'spinner') retry(true);
        else if (id === 'number-ticker' || id === 'stagger') {
          $('sb-kpis').querySelectorAll('.kpi').forEach(function (c) { c.classList.remove('u-stag'); void c.offsetWidth; c.classList.add('u-stag'); });
          settle();
          shown = [0, 0, 0, 0]; setPeriod(st.p, true);
        }
        later(drawLabels, 60);
      },
      destroy: function () {
        timers.forEach(clearTimeout); frames.forEach(function (f) { f(); });
        window.removeEventListener('resize', onResize); if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        root.innerHTML = '';
      }
    };
  };
})();
