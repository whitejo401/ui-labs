/* 예시 장면. UI.scenes[용어id](무대, 조절판 값) → { ms: 전체 길이, rest: 멈춰 보일 t, at(t): 그 순간을 그리고 단계 이름을 돌려줌 }
   모든 장면은 시간 값 t(0~1)로 그린다 (wiki: ui-labs-hyperframes-concept-only) */
(function () {
  var UI = window.UI = window.UI || {};
  var S = UI.scenes = {};

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(ms, a, b) { return b <= a ? (ms >= a ? 1 : 0) : clamp((ms - a) / (b - a)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  var ease = {
    linear: function (t) { return t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };
  UI.ease = ease; UI.clamp = clamp;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  UI.esc = esc;
  function mixBg(color, pct, base) { return 'color-mix(in srgb, ' + color + ' ' + Math.round(pct) + '%, ' + (base || 'var(--u-panel)') + ')'; }
  // 순간 목록 [[시각ms, 값], ...]에서 ms 때의 값
  function stepAt(list, ms) { var v = list[0][1]; for (var i = 0; i < list.length; i++) if (ms >= list[i][0]) v = list[i][1]; return v; }
  function rel(stage, el) { var a = stage.getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; }

  // 예시 데이터 (가상의 "결제 개편" 프로젝트)
  var AV = { '민지': '#2f8f6b', '준호': '#4a6fd1', '서연': '#b4579a', '도윤': '#c27a1c' };
  var PILL = { todo: '할 일', prog: '진행 중', rev: '검토', done: '완료', hold: '보류' };
  var ISSUES = [
    { n: 31, t: '환불 요청 화면에서 부분 환불 금액이 합계와 다르게 보임', s: 'prog', w: '민지', ago: 0 },
    { n: 28, t: '환불 사유 선택지에 "기타" 직접 입력 추가', s: 'rev', w: '준호', ago: 1 },
    { n: 27, t: '카드 취소 뒤 환불 알림 메일이 두 번 발송되는 문제와 재발 방지 로그 추가', s: 'todo', w: '서연', ago: 12 },
    { n: 25, t: '환불 내역 표에 결제 수단 열 넣기', s: 'prog', w: '도윤', ago: 64 },
    { n: 22, t: '정산 대기 환불 건 자동 재시도', s: 'hold', w: '민지', ago: 1500 },
    { n: 19, t: '환불 금액 입력 칸 천 단위 쉼표', s: 'done', w: '준호', ago: 4320 },
    { n: 17, t: '환불 정책 안내 문구 검토', s: 'rev', w: '서연', ago: 10080 },
    { n: 15, t: '결제 실패 화면 다시 시도 단추 위치 조정', s: 'done', w: '도윤', ago: 12000 },
    { n: 12, t: '결제 수단 저장 동의 문구 바꾸기', s: 'todo', w: '준호', ago: 15000 },
    { n: 9, t: '영수증 메일 제목에 주문 번호 넣기', s: 'done', w: '서연', ago: 20000 },
    { n: 6, t: '간편결제 버튼 순서 정하기', s: 'hold', w: '민지', ago: 26000 },
    { n: 3, t: '결제 개편 범위 정리', s: 'done', w: '도윤', ago: 40000 }
  ];
  UI.AV = AV; UI.PILL = PILL; UI.ISSUES = ISSUES;

  function pillHTML(s, extra) { return '<span class="u-pill p-' + s + (extra ? ' ' + extra : '') + '">' + PILL[s] + '</span>'; }
  function whoHTML(w) { return '<span class="u-who"><span class="u-av" style="background:' + AV[w] + '">' + w[0] + '</span>' + w + '</span>'; }
  // 상대 시간: 분 단위 차이 → 한국어
  function ago(min, toDate, now) {
    if (min < 1) return '방금';
    if (min < 60) return Math.floor(min) + '분 전';
    if (min < 1440) return Math.floor(min / 60) + '시간 전';
    if (min < 2880) return '어제';
    if (min < 10080) return Math.floor(min / 1440) + '일 전';
    if (toDate) { var d = new Date((now || Date.now()) - min * 60000); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
    return Math.floor(min / 10080) + '주 전';
  }
  UI.pillHTML = pillHTML; UI.whoHTML = whoHTML; UI.ago = ago;

  // 조합 화면의 "용어 보기" 이름표. place(id)는 자리: 'in-bl' 안쪽 왼쪽 아래, 'in-br' 안쪽 오른쪽 아래, 'below' 아래, 'right' 오른쪽 위, 없으면 왼쪽 위
  UI.termLabels = function (scr, L, termName, place) {
    var a = scr.getBoundingClientRect(), html = '', seen = {};
    [scr].concat([].slice.call(scr.querySelectorAll('[data-term]'))).forEach(function (el) {
      var id = el.getAttribute('data-term');
      if (!id || seen[id] || el.closest('.off') || el.closest('[hidden]')) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // 틀 밖으로 스크롤된 요소는 건너뛰고, 걸친 요소는 보이는 부분만 감싼다
      var x = Math.max(0, r.left - a.left - 2), y = Math.max(0, r.top - a.top - 2), w = Math.min(r.right - a.left + 2, a.width) - x, h = Math.min(r.bottom - a.top + 2, a.height) - y;
      if (w <= 0 || h <= 0) return;
      seen[id] = true;
      var k = place && place(id), pos;
      if (k === 'in-bl') pos = 'left:' + (x + 6) + 'px;top:' + (y + h - 6) + 'px';
      else if (k === 'in-br') pos = 'left:' + (x + w - 4) + 'px;top:' + (y + h - 4) + 'px;transform:translate(-100%,-100%)';
      else if (k === 'below') pos = 'left:' + (x + w) + 'px;top:' + (y + h) + 'px;transform:translate(-100%,0)';
      else if (k === 'right') pos = 'left:' + (x + w) + 'px;top:' + Math.max(16, y) + 'px;transform:translate(-100%,-100%)';
      else pos = 'left:' + x + 'px;top:' + Math.max(16, y) + 'px';
      if (el !== scr) html += '<div class="box" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"></div>';
      html += '<button type="button" data-id="' + id + '" style="' + pos + '" title="' + esc(termName(id)) + ' 카드 열기">' + esc(termName(id)) + '</button>';
    });
    L.innerHTML = html;
    return Object.keys(seen);
  };
  function fakes(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="u-fake" style="width:' + [90, 70, 82, 55, 76, 64][i % 6] + '%"></div>'; return s; }
  function cursor(stage) { var c = document.createElement('div'); c.className = 'u-cursor'; stage.appendChild(c); return c; }
  function put(el, x, y, press) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.toggle('press', !!press); }
  function show(el, p, dy, sc) {
    el.style.opacity = p; el.style.visibility = p <= 0.001 ? 'hidden' : 'visible';
    el.style.transform = 'translateY(' + ((dy || 0) * (1 - p)) + 'px)' + (sc ? ' scale(' + lerp(sc, 1, p) + ')' : '');
  }
  function navIcon(i) {
    return ['<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M5 6h6M5 9h4"/></svg>',
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2.5" width="3.5" height="11" rx="1"/><rect x="6.5" y="2.5" width="3.5" height="7" rx="1"/><rect x="11" y="2.5" width="3" height="9" rx="1"/></svg>',
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 13.5V8M6.5 13.5V4M10.5 13.5V9.5M14 13.5V6"/></svg>',
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4"/></svg>'][i];
  }
  UI.navIcon = navIcon;
  var NAV = ['이슈', '보드', '대시보드', '설정'];
  // 표의 한 행 (번호·제목·상태 + 고를 칸)
  function rowHTML(it, o) {
    o = o || {};
    return '<div class="u-tr' + (o.cls ? ' ' + o.cls : '') + '"' + (o.attr || '') + '>' +
      (o.check ? '<span><span class="u-cb"></span></span>' : '') +
      '<span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span>' + pillHTML(it.s) + '</div>';
  }

  /* ───── 구조 › 레이아웃 ───── */
  S['app-shell'] = function (st, c) {
    var wide = c.sidebar === '펼침' ? 150 : 46, hasHead = c.header === '있음';
    st.innerHTML = '<div class="frame" style="position:absolute;top:12px;bottom:12px;left:12px;border:1px solid var(--u-line);border-radius:10px;overflow:hidden;background:var(--u-panel);display:grid;grid-template-rows:' + (hasHead ? '34px ' : '') + '1fr">' +
      (hasHead ? '<div class="hd" style="display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--u-line);font-weight:700;font-size:12.5px;white-space:nowrap"><span class="burger" style="font-size:15px">☰</span><span>결제 개편</span><span style="margin-left:auto" class="u-kbd">머리줄</span></div>' : '') +
      '<div class="bd" style="position:relative;display:grid;grid-template-columns:' + wide + 'px 1fr;min-height:0">' +
        '<div class="u-side sd" style="padding:8px 6px;gap:4px">' + NAV.map(function (n, i) { return '<div class="u-nav"><a' + (i ? '' : ' aria-current="page"') + '>' + navIcon(i) + (wide > 60 ? '<span>' + n + '</span>' : '') + '</a></div>'; }).join('') + '</div>' +
        '<div style="position:relative;overflow:hidden"><div class="ct" style="padding:10px;display:grid;gap:8px">' + fakes(14) + '</div></div>' +
        '<div class="sh u-shade" style="z-index:3"></div>' +
        '<div class="u-side dr" style="position:absolute;left:0;top:0;bottom:0;width:150px;z-index:4;box-shadow:var(--u-shadow);padding:8px 6px;gap:4px">' + NAV.map(function (n, i) { return '<div class="u-nav"><a' + (i ? '' : ' aria-current="page"') + '>' + navIcon(i) + '<span>' + n + '</span></a></div>'; }).join('') + '</div>' +
      '</div>' + (hasHead ? '' : '<button class="u-btn fb" type="button" style="position:absolute;left:8px;top:8px;z-index:2;padding:2px 8px">☰</button>') + '</div>';
    var fr = st.querySelector('.frame'), bd = st.querySelector('.bd'), ct = st.querySelector('.ct'), sh = st.querySelector('.sh'), dr = st.querySelector('.dr');
    var burger = st.querySelector('.burger') || st.querySelector('.fb');
    return { ms: 3600, rest: 0.2, at: function (t) {
      var ms = t * 3600, full = st.clientWidth - 24, phone = Math.min(full, 230);
      var w = lerp(full, phone, ease.inOut(seg(ms, 1300, 1800)));
      fr.style.width = w + 'px';
      var mobile = w < 300;
      bd.style.gridTemplateColumns = (mobile ? '0px' : wide + 'px') + ' 1fr';
      bd.querySelector('.sd').style.visibility = mobile ? 'hidden' : 'visible';
      burger.style.visibility = mobile ? 'visible' : 'hidden';
      ct.style.transform = 'translateY(' + (-90 * ease.inOut(seg(ms, 300, 1100))) + 'px)';
      var open = ease.out(seg(ms, 2100, 2350)) * (1 - seg(ms, 3000, 3200));
      sh.style.opacity = open; sh.style.visibility = open > 0.001 ? 'visible' : 'hidden';
      dr.style.transform = 'translateX(' + (-100 * (1 - open)) + '%)'; dr.style.visibility = open > 0.001 ? 'visible' : 'hidden';
      return ms < 1300 ? '넓은 화면 · 본문만 스크롤' : ms < 2100 ? '휴대폰 폭 · 사이드바 숨김' : ms < 3000 ? '☰ → Drawer' : '닫힘';
    } };
  };

  S['sidebar-navigation'] = function (st, c) {
    var startOpen = c.collapse === '펼침', grp = c.group === '묶음 제목';
    function item(i) { return '<div class="u-nav"><a' + (i ? '' : ' aria-current="page"') + ' data-i="' + i + '">' + navIcon(i) + '<span class="lb">' + NAV[i] + '</span></a></div>'; }
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;grid-template-columns:auto 1fr">' +
      '<div class="u-side sd" style="height:100%;grid-template-rows:auto auto 1fr auto">' +
        '<div class="u-logo"><i></i><span class="lb">작업함</span></div>' +
        '<div style="display:grid;gap:2px">' + (grp ? '<span class="u-navlabel lb">작업</span>' : '') + item(0) + item(1) + item(2) +
          (grp ? '<span class="u-navlabel lb" style="margin-top:6px">설정</span>' : '') + item(3) + '</div><span></span>' +
        '<button class="u-btn tg" type="button" style="justify-content:center">«</button></div>' +
      '<div style="padding:14px;display:grid;gap:8px;align-content:start">' + fakes(6) + '</div></div>' +
      '<div class="u-tip tp">보드</div>';
    var sd = st.querySelector('.sd'), lbs = st.querySelectorAll('.lb'), tg = st.querySelector('.tg'), tip = st.querySelector('.tp'), cur = cursor(st);
    return { ms: 3400, rest: 0.3, at: function (t) {
      var ms = t * 3400, k = ease.out(seg(ms, 900, 1150)) - ease.out(seg(ms, 2600, 2850));
      var open = startOpen ? 1 - k : k;
      sd.style.width = lerp(56, 178, open) + 'px';
      lbs.forEach(function (l) { l.style.opacity = clamp(open * 1.6 - 0.6); });
      tg.textContent = open > 0.5 ? '« 접기' : '»';
      var hov = open < 0.05 && ms > 1500 && ms < 2300;
      var a = st.querySelector('[data-i="1"]'), r = rel(st, a), tb = rel(st, tg);
      tip.style.left = (r.x + r.w + 8) + 'px'; tip.style.top = (r.y + r.h / 2 - 12) + 'px';
      tip.style.opacity = hov ? seg(ms, 1600, 1700) : 0;
      a.style.background = hov ? 'var(--u-hover)' : '';
      var press = (ms > 850 && ms < 1000) || (ms > 2550 && ms < 2700);
      var tx = ms < 1300 || ms > 2400 ? tb.x + tb.w / 2 : r.x + r.w / 2, ty = ms < 1300 || ms > 2400 ? tb.y + tb.h / 2 : r.y + r.h / 2;
      put(cur, tx, ty, press);
      return open > 0.95 ? '펼침' : open < 0.05 ? (hov ? '아이콘만 · Tooltip' : '아이콘만') : '접는 중';
    } };
  };

  S['breadcrumb'] = function (st, c) {
    var steps = [[0, ['홈']], [500, ['홈', '결제 개편']], [1000, ['홈', '결제 개편', '환불']], [1500, ['홈', '결제 개편', '환불', '이슈 #12']],
      [2200, ['홈', '회사 공간', '결제 개편', '환불', '2분기 정리', '이슈 #12']]];
    st.innerHTML = '<div class="u-pad"><div style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px;padding:10px 12px;overflow:hidden"><ol class="u-crumb cr"></ol></div>' +
      '<div class="pg" style="font-size:18px;font-weight:700;padding:4px 2px"></div>' + fakes(4) + '</div>';
    var cr = st.querySelector('.cr'), pg = st.querySelector('.pg'), last = null;
    return { ms: 3200, rest: 0.8, at: function (t) {
      var ms = t * 3200, path = stepAt(steps, ms).slice(), since = ms - stepAt(steps.map(function (s) { return [s[0], s[0]]; }), ms);
      var full = path.length;
      if (c.collapse === '가운데를 …로' && path.length > 4) path = [path[0], '…'].concat(path.slice(-2));
      var key = path.join('|');
      if (key !== last) {
        cr.innerHTML = path.map(function (p, i) {
          var end = i === path.length - 1;
          return (i ? '<li aria-hidden="true">' + esc(c.separator) + '</li>' : '') + '<li' + (end ? ' class="cur nw"' : '') + '>' + (end || p === '…' ? esc(p) : '<a href="#">' + esc(p) + '</a>') + '</li>';
        }).join('');
        pg.textContent = path[path.length - 1];
        last = key;
      }
      var nw = cr.querySelector('.nw'), p = ease.out(seg(since, 0, 220));
      if (nw) { nw.style.opacity = p; nw.style.transform = 'translateX(' + (-6 * (1 - p)) + 'px)'; nw.style.display = 'inline-block'; }
      return full + '단계' + (full !== path.length ? ' · 가운데 접힘' : '');
    } };
  };

  /* ───── 구조 › 화면과 입력 ───── */
  S['search-bar'] = function (st, c) {
    var keys = [[0, ''], [300, '환'], [520, '환불']], clearAt = 2400, enterAt = 1350;
    st.innerHTML = '<div class="u-pad"><div class="u-search"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg><span class="txt"></span>' +
      '<span class="u-kbd ent" style="opacity:0">Enter</span><button class="u-icon x" type="button" aria-label="지우기">×</button></div>' +
      '<div class="u-tbl lst">' + ISSUES.slice(0, 6).map(function (it) { return '<div class="u-tr" style="--cols:46px minmax(0,1fr)">' + '<span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span></div>'; }).join('') + '</div></div>';
    var txt = st.querySelector('.txt'), x = st.querySelector('.x'), ent = st.querySelector('.ent'), rows = st.querySelectorAll('.lst .u-tr');
    var items = ISSUES.slice(0, 6);
    // 목록에 걸리는 질의가 바뀌는 순간들
    var applied = [[0, '']];
    if (c.mode === '적는 대로 거르기') keys.slice(1).forEach(function (k, i, a) { var next = a[i + 1]; if (!next || next[0] - k[0] >= c.debounce_ms) applied.push([k[0] + c.debounce_ms, k[1]]); });
    else applied.push([enterAt, '환불']);
    applied.push([clearAt, '']);
    function vis(q, it) { return !q || it.t.indexOf(q) >= 0 ? 1 : 0; }
    return { ms: 3000, rest: 0.65, at: function (t) {
      var ms = t * 3000, typed = ms >= clearAt ? '' : stepAt(keys, ms), q = stepAt(applied, ms), qi = 0;
      for (var i = 0; i < applied.length; i++) if (ms >= applied[i][0]) qi = i;
      var prev = qi ? applied[qi - 1][1] : '', p = ease.out(seg(ms, applied[qi][0], applied[qi][0] + 180));
      txt.innerHTML = typed ? esc(typed) + '<span class="caret"></span>' : '<span style="color:var(--u-muted)">이슈 찾기</span>';
      x.style.visibility = typed ? 'visible' : 'hidden';
      x.style.background = ms > clearAt - 150 && ms < clearAt ? 'var(--u-hover)' : '';
      ent.style.opacity = c.mode === 'Enter로 찾기' && ms > enterAt - 150 && ms < enterAt + 350 ? 1 : 0;
      rows.forEach(function (r, i) {
        var v = lerp(vis(prev, items[i]), vis(q, items[i]), p);
        r.style.opacity = v; r.style.height = (40 * v) + 'px'; r.style.borderBottomWidth = v > 0.05 ? '1px' : '0';
      });
      var waiting = c.mode === '적는 대로 거르기' && typed && typed !== q;
      return waiting ? '기다리는 중' : q ? '"' + q + '" 거름 · ' + items.filter(function (it) { return vis(q, it); }).length + '건' : '전체';
    } };
  };

  S['segmented-control'] = function (st, c) {
    var all = { 2: ['7일', '30일'], 3: ['7일', '30일', '90일'], 4: ['7일', '30일', '90일', '1년'], 5: ['오늘', '7일', '30일', '90일', '1년'] }[c.count];
    var last = all.length - 1, seq = [[0, 0], [700, 1], [1500, last], [2300, 0]];
    st.innerHTML = '<div class="u-pad" style="gap:14px"><div><div class="u-seg sg"><span class="u-seg-ind ind"></span>' + all.map(function (o) { return '<button type="button">' + o + '</button>'; }).join('') + '</div></div>' +
      '<div class="ch" style="display:flex;align-items:flex-end;gap:6px;height:130px;padding:8px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px">' +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';
    var btns = st.querySelectorAll('.sg button'), ind = st.querySelector('.ind'), bars = st.querySelectorAll('.ch i');
    bars.forEach(function (b) { b.style.cssText = 'flex:1;border-radius:3px 3px 0 0;background:var(--u-accent);opacity:.75'; });
    function hts(k) { var r = []; for (var i = 0; i < 10; i++) r.push(20 + ((i * 37 + k * 53 + (i * k) % 7 * 11) % 80)); return r; }
    return { ms: 3000, rest: 0.4, at: function (t) {
      var ms = t * 3000, idx = 0, from = 0, at0 = 0;
      for (var i = 0; i < seq.length; i++) if (ms >= seq[i][0]) { from = idx; idx = seq[i][1]; at0 = seq[i][0]; }
      var p = c.indicator === '배경이 미끄러짐' ? ease.out(seg(ms, at0, at0 + 200)) : 1;
      var a = btns[from], b = btns[idx];
      ind.style.left = lerp(a.offsetLeft, b.offsetLeft, p) + 'px'; ind.style.width = lerp(a.offsetWidth, b.offsetWidth, p) + 'px';
      btns.forEach(function (x, i) { x.setAttribute('aria-pressed', String(i === idx)); });
      var h0 = hts(from), h1 = hts(idx), q = ease.out(seg(ms, at0, at0 + 260));
      bars.forEach(function (bar, i) { bar.style.height = lerp(h0[i], h1[i], q) + '%'; });
      return all[idx] + ' 고름';
    } };
  };

  S['checkbox'] = function (st, c) {
    var head = c.header === '표 머리 전체 선택', n = 4;
    var ev = head ? [[300, 'r0'], [650, 'r1'], [1150, 'all'], [1900, 'none']] : [[300, 'r0'], [650, 'r1'], [1000, 'r2'], [1700, 'u1']];
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' +
      (head ? '<div class="u-tr head" style="--cols:30px 46px minmax(0,1fr) 80px"><span><span class="u-cb hc"></span></span><span>번호</span><span>제목</span><span>상태</span></div>' : '') +
      ISSUES.slice(0, n).map(function (it, i) { return rowHTML(it, { check: true, cls: 'r', attr: ' style="--cols:30px 46px minmax(0,1fr) 80px"' }); }).join('') + '</div></div>';
    var rows = st.querySelectorAll('.r'), cbs = st.querySelectorAll('.r .u-cb'), hc = st.querySelector('.hc');
    cbs[3].setAttribute('disabled', ''); cbs[3].style.cursor = 'not-allowed';
    return { ms: 2500, rest: 0.4, at: function (t) {
      var ms = t * 2500, on = [false, false, false, false], lastAt = -1;
      ev.forEach(function (e) {
        if (ms < e[0]) return;
        lastAt = e[0];
        if (e[1] === 'all') on = [true, true, true, false]; else if (e[1] === 'none') on = [false, false, false, false];
        else if (e[1][0] === 'u') on[+e[1][1]] = false; else on[+e[1][1]] = true;
      });
      var pop = 0.8 + 0.2 * ease.out(seg(ms, lastAt, lastAt + 140));
      cbs.forEach(function (cb, i) { cb.className = 'u-cb' + (on[i] ? ' on' : ''); cb.style.transform = on[i] && lastAt >= 0 ? 'scale(' + pop + ')' : ''; rows[i].classList.toggle('sel', on[i]); });
      var k = on.filter(Boolean).length;
      if (hc) hc.className = 'u-cb' + (k === 3 ? ' on' : k ? ' mixed' : '');
      return k === 0 ? '꺼짐' : k === 3 && head ? '전체 켜짐' : head ? k + '개 · 머리줄 일부(—)' : k + '개 켜짐';
    } };
  };

  /* ───── 구조 › 컴포넌트 › 데이터 ───── */
  S['data-table'] = function (st, c) {
    var rh = c.density === '넓게' ? 46 : 34, sel = c.select === '체크박스', sort = c.sort === '머리 눌러 정렬';
    var cols = (sel ? '24px ' : '') + '42px minmax(0,1fr) 70px 64px 60px', items = ISSUES.slice(0, 4);
    st.innerHTML = '<div class="u-pad"><div class="u-tbl u-hoverable" style="--cols:' + cols + ';--rowh:' + rh + 'px">' +
      '<div class="u-tr head">' + (sel ? '<span><span class="u-cb"></span></span>' : '') + '<span>번호</span><span>제목</span><span>상태</span><span>담당자</span><span class="sh">바뀐 때</span></div>' +
      '<div class="bd" style="position:relative;height:' + (rh * items.length) + 'px">' + items.map(function (it, i) {
        return '<div class="u-tr rw" style="position:absolute;left:0;right:0">' + (sel ? '<span><span class="u-cb"></span></span>' : '') + '<span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span>' + pillHTML(it.s, 'sm') + whoHTML(it.w) + '<span class="time">' + ago(it.ago) + '</span></div>';
      }).join('') + '</div></div></div>';
    var rws = st.querySelectorAll('.rw'), sh = st.querySelector('.sh');
    var flips = sort ? [[0, 'desc'], [900, 'asc'], [1900, 'desc']] : [[0, 'desc']];
    function order(dir) { return items.map(function (_, i) { return dir === 'desc' ? i : items.length - 1 - i; }); }
    return { ms: 2900, rest: 0.5, at: function (t) {
      var ms = t * 2900, dir = stepAt(flips, ms), at0 = 0, prev = 'desc';
      for (var i = 0; i < flips.length; i++) if (ms >= flips[i][0]) { at0 = flips[i][0]; prev = i ? flips[i - 1][1] : flips[i][1]; }
      var p = ease.inOut(seg(ms, at0, at0 + 320)), a = order(prev), b = order(dir);
      rws.forEach(function (r, i) { r.style.top = lerp(a[i], b[i], p) * rh + 'px'; r.style.borderBottom = '1px solid var(--u-line)'; });
      sh.innerHTML = '바뀐 때' + (sort ? ' <span style="color:var(--u-ink)">' + (dir === 'desc' ? '▼' : '▲') + '</span>' : '');
      sh.style.color = sort && ms > at0 && ms < at0 + 300 && at0 > 0 ? 'var(--u-accent)' : '';
      return sort ? (dir === 'desc' ? '최근 먼저' : '오래된 것 먼저') : '정렬 없음';
    } };
  };

  S['sticky-header'] = function (st, c) {
    var shadow = c.shadow === '붙으면 그림자';
    st.innerHTML = '<div class="u-pad"><div class="u-tbl" style="--cols:46px minmax(0,1fr) 80px;position:relative;height:210px">' +
      '<div class="u-tr head hd" style="position:absolute;left:0;right:0;top:0"><span>번호</span><span>제목</span><span>상태</span></div>' +
      '<div class="bd" style="position:absolute;left:0;right:0;top:34px">' + ISSUES.slice(0, 10).map(function (it) { return rowHTML(it); }).join('') + '</div></div></div>';
    var hd = st.querySelector('.hd'), bd = st.querySelector('.bd');
    return { ms: 3400, rest: 0.45, at: function (t) {
      var ms = t * 3400, max = Math.max(0, bd.scrollHeight - 176);
      var y = max * (ease.inOut(seg(ms, 400, 1700)) - ease.inOut(seg(ms, 2300, 3200)));
      bd.style.transform = 'translateY(' + (-y) + 'px)';
      var stuck = clamp(y / 14);
      hd.style.boxShadow = shadow ? '0 6px 10px -6px rgb(0 0 0 / ' + Math.round(45 * stuck) + '%)' : 'none';
      hd.style.borderBottom = '1px solid var(--u-line)';
      return y < 1 ? '맨 위' : '머리줄 붙음' + (shadow ? ' · 그림자' : '');
    } };
  };

  S['bulk-action-bar'] = function (st, c) {
    var top = c.position === '표 위에 겹침';
    st.innerHTML = '<div class="u-pad"><div class="u-tbl" style="position:relative;--cols:30px 46px minmax(0,1fr) 80px">' +
      '<div class="u-tr head"><span><span class="u-cb hc"></span></span><span>번호</span><span>제목</span><span>상태</span></div>' +
      ISSUES.slice(0, 4).map(function (it) { return rowHTML(it, { check: true, cls: 'r' }); }).join('') +
      (top ? '<div class="u-bulk bar" style="position:absolute;left:0;right:0;top:0;height:34px;border-radius:0;box-shadow:none"></div>' : '') + '</div></div>' +
      (top ? '' : '<div class="u-bulk bar" style="position:absolute;left:50%;bottom:14px;margin-left:-150px;width:300px;justify-content:center"></div>');
    var rows = st.querySelectorAll('.r'), cbs = st.querySelectorAll('.r .u-cb'), hc = st.querySelector('.hc'), bar = st.querySelector('.bar');
    var ev = [[400, [0]], [850, [0, 2]], [2050, []]];
    return { ms: 2700, rest: 0.55, at: function (t) {
      var ms = t * 2700, on = stepAt([[0, []]].concat(ev), ms), k = on.length;
      cbs.forEach(function (cb, i) { var v = on.indexOf(i) >= 0; cb.className = 'u-cb' + (v ? ' on' : ''); rows[i].classList.toggle('sel', v); });
      hc.className = 'u-cb' + (k ? ' mixed' : '');
      var n = Math.max(1, k || 2);
      bar.innerHTML = '<b>' + n + '개 선택됨</b><button type="button">상태 바꾸기</button><button type="button">지우기</button><button type="button" class="x" style="' + (ms > 1950 && ms < 2050 ? 'opacity:1;background:rgb(255 255 255 / 18%);border-radius:4px' : '') + '">✕</button>';
      var p = ease.out(seg(ms, 400, 650)) * (1 - ease.out(seg(ms, 2050, 2250)));
      bar.style.opacity = c.enter === 'fade' || top ? p : clamp(p * 2);
      bar.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      bar.style.transform = c.enter === 'slide' ? (top ? 'translateY(' + (-8 * (1 - p)) + 'px)' : 'translateY(' + (60 * (1 - p)) + 'px)') : '';
      return k ? k + '개 선택 · 막대 보임' : p > 0.01 ? '선택 해제 · 막대 사라짐' : '고른 행 없음';
    } };
  };

  S['pagination'] = function (st, c) {
    var size = +c.page_size, total = 342, pages = Math.ceil(total / size), nums = c.style === '쪽 번호';
    st.innerHTML = '<div class="u-pad"><div class="u-tbl ls"></div><div class="u-pages pg"></div></div>';
    var ls = st.querySelector('.ls'), pg = st.querySelector('.pg'), seq = [[0, 1], [900, 2], [1900, 3]];
    function render(p, pressed) {
      ls.innerHTML = [0, 1, 2].map(function (i) { var it = ISSUES[((p - 1) * 3 + i) % ISSUES.length]; return '<div class="u-tr" style="--cols:56px minmax(0,1fr)"><span class="num">#' + (total - (p - 1) * size - i) + '</span><span class="ttl">' + esc(it.t) + '</span></div>'; }).join('');
      var win = [];
      if (nums) { for (var k = 1; k <= pages; k++) if (k === 1 || k === pages || Math.abs(k - p) <= 2) win.push(k); else if (win[win.length - 1] !== '…') win.push('…'); }
      pg.innerHTML = '<span>' + ((p - 1) * size + 1) + '–' + Math.min(total, p * size) + ' / ' + total + '건</span><span class="nums">' +
        '<button type="button"' + (p === 1 ? ' disabled' : '') + '>' + (nums ? '‹' : '‹ 이전') + '</button>' +
        win.map(function (k) { return k === '…' ? '<span>…</span>' : '<button type="button"' + (k === p ? ' aria-current="page"' : '') + (pressed === k ? ' style="outline:2px solid var(--u-accent);outline-offset:1px"' : '') + '>' + k + '</button>'; }).join('') +
        '<button type="button"' + (!nums && pressed ? ' style="outline:2px solid var(--u-accent);outline-offset:1px"' : '') + '>' + (nums ? '›' : '다음 ›') + '</button></span>';
    }
    var last = '';
    return { ms: 2800, rest: 0.4, at: function (t) {
      var ms = t * 2800, p = stepAt(seq, ms), at0 = 0;
      seq.forEach(function (s) { if (ms >= s[0]) at0 = s[0]; });
      var pressed = at0 > 0 && ms - at0 < 220 ? p : 0, key = p + '/' + pressed;
      if (key !== last) { render(p, pressed); last = key; }
      ls.style.opacity = at0 > 0 ? 0.35 + 0.65 * ease.out(seg(ms, at0, at0 + 200)) : 1;
      return p + '쪽 / ' + pages + '쪽';
    } };
  };

  /* ───── 구조 › 컴포넌트 › 겹쳐 뜨는 창 ───── */
  S['dropdown-menu'] = function (st, c) {
    var label = c.icon === '단추 글' ? '더 보기 ▾' : c.icon, danger = c.danger === '맨 아래 빨간 항목';
    var items = ['편집', '복제', '옮기기'];
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' + ISSUES.slice(0, 3).map(function (it, i) {
      return '<div class="u-tr" style="--cols:46px minmax(0,1fr) auto"><span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span>' +
        (i === 0 ? '<button class="' + (c.icon === '단추 글' ? 'u-btn' : 'u-icon') + ' trg" type="button">' + esc(label) + '</button>' : '<button class="u-icon" type="button">' + esc(c.icon === '단추 글' ? '⋯' : c.icon) + '</button>') + '</div>';
    }).join('') + '</div></div><div class="u-menu mn" style="position:absolute;z-index:5">' +
      items.map(function (x, i) { return '<button type="button">' + x + '<span class="u-kbd" style="border:0">' + ['E', 'D', 'M'][i] + '</span></button>'; }).join('') +
      (danger ? '<div class="sep"></div><button type="button" class="danger">지우기<span class="u-kbd" style="border:0">⌫</span></button>' : '') + '</div>';
    var trg = st.querySelector('.trg'), mn = st.querySelector('.mn'), btns = mn.querySelectorAll('button'), cur = cursor(st);
    var hl = [[0, -1], [950, 0], [1250, 1], [1550, 2]];
    if (danger) hl.push([1850, 3]);
    return { ms: 2900, rest: 0.55, at: function (t) {
      var ms = t * 2900, r = rel(st, trg);
      mn.style.left = Math.max(8, r.x + r.w - mn.offsetWidth) + 'px'; mn.style.top = (r.y + r.h + 4) + 'px';
      var p = ease.out(seg(ms, 400, 550)) * (1 - seg(ms, 2350, 2470));
      show(mn, p, -6, 0.97);
      trg.style.background = p > 0.5 ? 'var(--u-hover)' : '';
      var h = stepAt(hl, ms);
      btns.forEach(function (b, i) { b.classList.toggle('on', i === h); });
      put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > 330 && ms < 470);
      cur.style.opacity = ms < 900 ? 1 : 0;
      return p < 0.01 ? (ms > 2000 ? 'Esc로 닫힘' : '닫힘') : h < 0 ? '열림' : '↓ ' + btns[h].firstChild.textContent;
    } };
  };

  S['confirm-dialog'] = function (st, c) {
    var typing = c.typing === '이름을 적어야 지움', dangerTone = c.tone === '위험(빨간 단추)';
    st.innerHTML = '<div class="u-pad">' + fakes(3) + '<div class="u-tbl">' + rowHTML(ISSUES[1], { attr: ' style="--cols:46px minmax(0,1fr) auto"' }).replace(pillHTML(ISSUES[1].s), '<button class="u-btn dl" type="button">지우기</button>') + '</div>' + fakes(3) + '</div>' +
      '<div class="u-shade sh"></div><div class="wrapd" style="position:absolute;inset:0;display:grid;place-items:center;padding:12px"><div class="u-dlg dg" role="dialog">' +
      '<h3>이슈 #28을 지울까요?</h3><p>지우면 되돌릴 수 없습니다. 댓글과 기록도 함께 지워집니다.</p>' +
      (typing ? '<input class="in" readonly placeholder="28을 적어 주세요">' : '') +
      '<div class="acts"><button class="u-btn cn" type="button">취소</button><button class="u-btn ok ' + (dangerTone ? 'danger' : 'primary') + '" type="button">지우기</button></div></div></div>';
    var sh = st.querySelector('.sh'), wr = st.querySelector('.wrapd'), dg = st.querySelector('.dg'), cn = st.querySelector('.cn'), ok = st.querySelector('.ok'), inp = st.querySelector('.in'), dl = st.querySelector('.dl');
    return { ms: 2800, rest: 0.4, at: function (t) {
      var ms = t * 2800, p = ease.out(seg(ms, 300, 500)) * (1 - seg(ms, 2250, 2400));
      sh.style.opacity = p; sh.style.visibility = p > 0.001 ? 'visible' : 'hidden'; wr.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      dg.style.opacity = p; dg.style.transform = 'scale(' + lerp(0.96, 1, p) + ')';
      dl.style.outline = ms > 150 && ms < 300 ? '2px solid var(--u-accent)' : '';
      var typed = typing ? (ms > 1300 ? '28' : ms > 1050 ? '2' : '') : '';
      if (inp) { inp.value = typed; inp.style.outline = ms > 800 && ms < 2100 ? '2px solid var(--u-accent)' : ''; }
      ok.disabled = typing && typed !== '28';
      cn.classList.toggle('focus', p > 0.5 && !(typing && ms > 800 && ms < 2100));
      cn.style.background = ms > 2150 && ms < 2250 ? 'var(--u-hover)' : '';
      return p < 0.01 ? (ms > 2300 ? '취소 · 닫힘' : '목록') : typing && ms > 800 && ms < 2100 ? '번호 적는 중' : '열림 · 초점은 취소';
    } };
  };

  S['command-palette'] = function (st, c) {
    var grouped = c.groups === '이동·동작·최근 묶음', key = c.shortcut === '/' ? '/' : 'Ctrl K';
    var ACTS = [['이동', '보드로 가기', 'G B'], ['이동', '대시보드로 가기', 'G D'], ['동작', '새 이슈 만들기', 'C'], ['동작', '열린 이슈만 보기', ''], ['최근', '#31 부분 환불 금액', ''], ['최근', '#28 환불 사유 기타', '']];
    st.innerHTML = '<div class="u-pad">' + fakes(8) + '</div><div class="u-shade sh"></div>' +
      '<div class="pw" style="position:absolute;left:0;right:0;top:16px;display:flex;justify-content:center;padding:0 12px"><div class="u-pal"><div class="q"><span class="u-kbd">' + esc(key) + '</span><span class="txt"></span></div><div class="list"></div></div></div>' +
      '<div class="kc u-kbd" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:18px;padding:6px 14px;background:var(--u-panel)">' + esc(key) + '</div>';
    var sh = st.querySelector('.sh'), pw = st.querySelector('.pw'), txt = st.querySelector('.txt'), list = st.querySelector('.list'), kc = st.querySelector('.kc');
    var typing = [[0, ''], [950, '보'], [1200, '보드']], selSeq = [[0, 0], [1600, 1], [1900, 0]], last = '';
    return { ms: 2900, rest: 0.55, at: function (t) {
      var ms = t * 2900, q = stepAt(typing, ms), sel = stepAt(selSeq, ms);
      var hits = ACTS.filter(function (a) { return !q || a[1].indexOf(q) >= 0; });
      var k = q + '|' + sel + '|' + (ms > 2250 && ms < 2400);
      if (k !== last) {
        var g = '', html = '';
        hits.forEach(function (a, i) {
          if (grouped && a[0] !== g) { g = a[0]; html += '<div class="grp">' + g + '</div>'; }
          html += '<button type="button" class="it' + (i === sel ? ' on' : '') + '">' + esc(a[1]) + (a[2] ? '<span class="u-kbd">' + a[2] + '</span>' : '') + '</button>';
        });
        list.innerHTML = html || '<div class="none">맞는 것이 없습니다</div>';
        last = k;
      }
      txt.innerHTML = q ? esc(q) + '<span class="caret" style="display:inline-block;width:1.5px;height:1em;background:var(--u-accent);vertical-align:-2px"></span>' : '<span style="color:var(--u-muted)">이동하거나 할 일을 찾기</span>';
      var p = ease.out(seg(ms, 450, 650)) * (1 - seg(ms, 2400, 2550));
      sh.style.opacity = p; sh.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      show(pw, p, -8, 0.98);
      var kp = seg(ms, 150, 300) * (1 - seg(ms, 450, 600));
      kc.style.opacity = kp; kc.style.visibility = kp > 0.001 ? 'visible' : 'hidden';
      return p < 0.01 ? (ms > 2400 ? 'Enter → ' + hits[sel][1] : key + ' 누름') : q ? '"' + q + '" ' + hits.length + '개' : '열림';
    } };
  };

  /* ───── 구조 › 컴포넌트 › 알림 ───── */
  S['toast'] = function (st, c) {
    var enter = c.duration_ms, hold = c.hold_s * 1000, exit = 160, total = enter + hold + exit;
    var align = { '아래 오른쪽': ['flex-end', 'flex-end'], '아래 가운데': ['flex-end', 'center'], '위 가운데': ['flex-start', 'center'] }[c.position];
    st.innerHTML = '<div class="u-pad">' + fakes(6) + '</div><div style="position:absolute;inset:0;padding:12px;display:flex;align-items:' + align[0] + ';justify-content:' + align[1] + '">' +
      '<div class="u-toast ts"><span class="dot"></span><span>이슈를 저장했습니다.</span>' + (c.undo === '넣기' ? '<button type="button">되돌리기</button>' : '') + '<span class="bar"></span></div></div>';
    var ts = st.querySelector('.ts'), bar = st.querySelector('.bar'), dy = c.position === '위 가운데' ? -18 : 18;
    return { ms: total, rest: (enter + hold * 0.4) / total, at: function (t) {
      var ms = t * total, p = ms < enter ? ease.out(ms / enter) : ms < enter + hold ? 1 : 1 - seg(ms, enter + hold, total);
      ts.style.opacity = p; ts.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      ts.style.transform = c.enter === 'slide' ? 'translateY(' + (dy * (1 - p)) + 'px)' : c.enter === 'scale' ? 'scale(' + lerp(0.9, 1, p) + ')' : '';
      bar.style.transform = 'scaleX(' + (1 - seg(ms, enter, enter + hold)) + ')';
      return ms < enter ? '나타나기' : ms < enter + hold ? '떠 있기' : t < 1 ? '사라지기' : '사라짐';
    } };
  };

  S['badge'] = function (st, c) {
    var dot = c.style === '점만', lim = c.max === '99+' ? 99 : 9, start = lim - 2;
    var seq = [[0, start], [600, start + 1], [1200, start + 2], [1800, start + 3], [2400, start + 4]];
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;grid-template-columns:190px 1fr"><div class="u-side" style="height:100%"><div class="u-logo"><i></i>작업함</div><div class="u-nav">' +
      NAV.map(function (n, i) { return '<a' + (i ? '' : ' aria-current="page"') + '>' + navIcon(i) + n + (i === 0 ? '<span class="u-badge bd"></span>' : '') + '</a>'; }).join('') +
      '</div></div><div style="padding:14px;display:grid;gap:8px;align-content:start">' + fakes(6) + '</div></div>';
    var bd = st.querySelector('.bd');
    return { ms: 3000, rest: 0.45, at: function (t) {
      var ms = t * 3000, n = stepAt(seq, ms), at0 = 0;
      seq.forEach(function (s) { if (ms >= s[0]) at0 = s[0]; });
      bd.className = 'u-badge' + (dot ? ' dot' : '');
      bd.textContent = dot ? '' : n > lim ? lim + '+' : n;
      var k = at0 > 0 ? seg(ms, at0, at0 + 300) : 1;
      bd.style.transform = 'scale(' + (1 + 0.2 * Math.sin(Math.PI * k)) + ')';
      return '새 이슈 ' + n + '건' + (n > lim && !dot ? ' → "' + lim + '+"' : '');
    } };
  };

  /* ───── 구조 › 상태 ───── */
  S['skeleton'] = function (st, c) {
    var real = ISSUES.slice(0, 4).map(function (it) { return rowHTML(it, { attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('');
    var skel = [70, 52, 64, 46].map(function (w) { return '<div class="u-tr" style="--cols:46px minmax(0,1fr) 80px"><span class="u-skel s" style="width:30px"></span><span class="u-skel s" style="width:' + w + '%"></span><span class="u-skel s" style="width:56px"></span></div>'; }).join('');
    st.innerHTML = '<div class="u-pad"><div class="u-tbl" style="position:relative"><div class="sk">' + skel + '</div><div class="rl" style="position:absolute;inset:0">' + real + '</div></div></div>';
    var sk = st.querySelector('.sk'), rl = st.querySelector('.rl'), bars = st.querySelectorAll('.s');
    bars.forEach(function (b) { if (c.shimmer === '빛이 지나감') b.classList.add('shim'); });
    var done = Math.max(1800, c.min_ms);
    return { ms: done + 700, rest: 0.4, at: function (t) {
      var ms = t * (done + 700), cyc = (ms % 1500) / 1500;
      bars.forEach(function (b) {
        if (c.shimmer === '빛이 지나감') b.style.setProperty('--sx', (100 - cyc * 100) + '%');
        b.style.opacity = c.shimmer === '깜빡임(pulse)' ? 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(cyc * 2 * Math.PI)) : 1;
      });
      var p = ease.out(seg(ms, done, done + 300));
      sk.style.opacity = 1 - p; rl.style.opacity = p; rl.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      return p < 0.01 ? '불러오는 중' : p < 1 ? '내용으로 바뀜' : '다 불러옴';
    } };
  };

  S['empty-state'] = function (st, c) {
    var K = {
      '처음이라 없음': ['아직 이슈가 없습니다', '<button class="u-btn primary" type="button">첫 이슈 만들기</button>'],
      '검색 결과 없음': ['\'결제 오류\'에 맞는 이슈가 없습니다', '<button class="u-btn" type="button">필터 지우기</button>'],
      '다 끝냄': ['남은 이슈가 없습니다', '<a href="#" style="color:var(--u-accent)">닫힌 이슈 보기</a>']
    }[c.kind];
    var art = c.art === '작은 그림'
      ? '<svg viewBox="0 0 64 48" fill="none"><rect x="8" y="14" width="48" height="28" rx="5" style="fill:var(--u-hover);stroke:var(--u-line)"/><path d="M8 30h14l4 6h12l4-6h14" style="stroke:var(--u-muted)" stroke-width="1.5"/><path d="M24 8l3 4M32 5v5M40 8l-3 4" style="stroke:var(--u-accent)" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg class="ico" viewBox="0 0 16 16" fill="none" style="stroke:var(--u-muted)" stroke-width="1.4"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M5 6h6M5 9h4"/></svg>';
    var search = c.kind === '검색 결과 없음';
    st.innerHTML = '<div class="u-pad">' + (search ? '<div class="u-search"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg><span class="txt q"></span></div>' : '') +
      '<div class="u-tbl" style="position:relative;min-height:150px"><div class="ls">' + (c.kind === '처음이라 없음'
        ? [60, 44, 52].map(function (w) { return '<div class="u-tr" style="--cols:46px minmax(0,1fr)"><span class="u-skel" style="width:30px"></span><span class="u-skel" style="width:' + w + '%"></span></div>'; }).join('')
        : ISSUES.slice(0, 3).map(function (it) { return rowHTML(it, { cls: 'r', attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('')) +
      '</div><div class="u-empty em" style="position:absolute;inset:0;align-content:center">' + art + '<b>' + esc(K[0]) + '</b>' + K[1] + '</div></div></div>';
    var ls = st.querySelector('.ls'), em = st.querySelector('.em'), q = st.querySelector('.q'), rows = st.querySelectorAll('.r');
    return { ms: 2600, rest: 0.8, at: function (t) {
      var ms = t * 2600;
      if (q) q.textContent = stepAt([[0, ''], [250, '결제'], [500, '결제 오류']], ms);
      if (c.kind === '다 끝냄') rows.forEach(function (r, i) { var g = seg(ms, 250 + i * 250, 450 + i * 250); r.style.opacity = 1 - g; r.style.transform = 'translateX(' + (24 * g) + 'px)'; });
      ls.style.opacity = c.kind === '다 끝냄' ? 1 : 1 - seg(ms, 900, 1150);
      show(em, ease.out(seg(ms, 1150, 1500)), 8);
      return ms < 1150 ? (c.kind === '처음이라 없음' ? '불러오는 중' : c.kind === '검색 결과 없음' ? '찾는 중' : '하나씩 닫음') : '빈 화면';
    } };
  };

  /* ───── 표현 ───── */
  S['status-pill'] = function (st, c) {
    var ext = (c.style === '점 + 글' ? ' dot' : '') + (c.size === '작게' ? ' sm' : '');
    var seq = [[0, 'todo'], [650, 'prog'], [1300, 'rev'], [1950, 'done']];
    st.innerHTML = '<div class="u-pad" style="gap:16px"><div class="u-tbl"><div class="u-tr" style="--cols:46px minmax(0,1fr) auto;--rowh:50px"><span class="num">#28</span><span class="ttl">' + esc(ISSUES[1].t) + '</span><span class="pw"></span></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 2px">' + ['todo', 'prog', 'rev', 'done', 'hold'].map(function (s) { return pillHTML(s, ext.trim()); }).join('') + '</div>' + fakes(3) + '</div>';
    var pw = st.querySelector('.pw'), last = '';
    return { ms: 2600, rest: 0.3, at: function (t) {
      var ms = t * 2600, s = stepAt(seq, ms), at0 = 0;
      seq.forEach(function (x) { if (ms >= x[0]) at0 = x[0]; });
      if (s !== last) { pw.innerHTML = pillHTML(s, ext.trim()); last = s; }
      var k = at0 ? ease.out(seg(ms, at0, at0 + 180)) : 1;
      pw.firstChild.style.transform = 'scale(' + lerp(0.85, 1, k) + ')'; pw.firstChild.style.opacity = lerp(0.3, 1, k);
      return PILL[s];
    } };
  };

  S['relative-time'] = function (st, c) {
    var toDate = c.switch_after === '7일 뒤 날짜로', live = c.live === '1분마다 갱신';
    var base = new Date(2026, 10, 24, 14, 5).getTime(), made = [0, 3, 50];
    st.innerHTML = '<div class="u-pad"><div class="clk" style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)"></div><div class="u-tbl">' +
      ISSUES.slice(0, 3).map(function (it) { return '<div class="u-tr" style="--cols:46px minmax(0,1fr) auto"><span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span><span class="time tm"></span></div>'; }).join('') +
      '</div></div><div class="u-tip tp"></div>';
    var clk = st.querySelector('.clk'), tms = st.querySelectorAll('.tm'), tip = st.querySelector('.tp');
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function stamp(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    return { ms: 4000, rest: 0.55, at: function (t) {
      // 흐른 시간(분): 앞은 천천히, 뒤로 갈수록 빠르게
      var el = t < 0.25 ? lerp(0, 2, t / 0.25) : t < 0.5 ? lerp(2, 70, (t - 0.25) / 0.25) : t < 0.75 ? lerp(70, 2200, (t - 0.5) / 0.25) : lerp(2200, 13000, (t - 0.75) / 0.25);
      var now = base + el * 60000;
      clk.textContent = '지금 ' + stamp(now) + (live ? '' : ' · 표시는 열 때 그대로');
      tms.forEach(function (x, i) { x.textContent = ago((live ? el : 0) + made[i], toDate, live ? now : base); });
      var r = rel(st, tms[0]), on = t > 0.85;
      tip.textContent = stamp(base - made[0] * 60000);
      tip.style.opacity = on ? 1 : 0; tip.style.left = Math.max(8, r.x + r.w - tip.offsetWidth) + 'px'; tip.style.top = (r.y - 30) + 'px';
      return Math.round(el) < 60 ? Math.round(el) + '분 흐름' : Math.round(el / 60) < 48 ? Math.round(el / 60) + '시간 흐름' : Math.round(el / 1440) + '일 흐름';
    } };
  };

  S['truncation'] = function (st, c) {
    var lines = c.lines, tipMode = c.full === 'Tooltip', text = '카드 취소 뒤 환불 알림 메일이 두 번 발송되는 문제와, 같은 일이 다시 생기지 않게 발송 기록(로그)을 남기고 관리 화면에서 볼 수 있게 하기';
    st.innerHTML = '<div class="u-pad"><div class="bx" style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px;padding:12px;display:grid;gap:6px">' +
      '<span class="num" style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#27</span>' +
      '<span class="tx" style="display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;' + (lines === 1 ? 'word-break:break-all' : '') + '">' + esc(text) + '</span>' +
      (tipMode ? '' : '<button class="u-btn more" type="button" style="justify-self:start;padding:2px 8px;font-size:12px">더 보기</button>') + '</div></div>' +
      '<div class="u-tip tp" style="white-space:normal;width:min(300px,85%)">' + esc(text) + '</div>';
    var bx = st.querySelector('.bx'), tx = st.querySelector('.tx'), tip = st.querySelector('.tp'), more = st.querySelector('.more'), cur = cursor(st);
    return { ms: 3000, rest: 0.7, at: function (t) {
      var ms = t * 3000, full = st.clientWidth - 28, w = lerp(full, Math.max(150, full * 0.5), ease.inOut(seg(ms, 200, 1400)));
      bx.style.width = w + 'px';
      var open = !tipMode && ms > 2100;
      tx.style.webkitLineClamp = open ? 'unset' : String(lines);
      var cut = tx.scrollHeight > tx.clientHeight + 1;
      if (more) { more.style.visibility = cut || open ? 'visible' : 'hidden'; more.textContent = open ? '접기' : '더 보기'; }
      var r = rel(st, tx), target = more ? rel(st, more) : r;
      put(cur, target.x + Math.min(target.w, 60) - 10, target.y + target.h / 2, more && ms > 1950 && ms < 2100);
      cur.style.opacity = ms > 1500 ? 1 : 0;
      var tp = tipMode && cut && ms > 1750 ? ease.out(seg(ms, 1750, 1900)) : 0;
      tip.style.opacity = tp; tip.style.left = r.x + 'px'; tip.style.top = (r.y + r.h + 6) + 'px';
      return open ? '펼침' : cut ? (tp ? '잘림 · Tooltip' : '잘림 …') : '다 보임';
    } };
  };

  /* ───── 움직임 ───── */
  S['hover-effect'] = function (st, c) {
    var dur = c.duration_ms, card = c.kind === '그림자';
    st.innerHTML = '<div class="u-pad" style="gap:' + (card ? 10 : 0) + 'px">' + (card
      ? ISSUES.slice(0, 3).map(function (it) { return '<div class="hv" style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center"><span class="num" style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#' + it.n + '</span><span class="ttl" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.t) + '</span>' + pillHTML(it.s) + '</div>'; }).join('')
      : '<div class="u-tbl">' + ISSUES.slice(0, 4).map(function (it) { return rowHTML(it, { cls: 'hv', attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('') + '</div>') + '</div>';
    var hv = st.querySelectorAll('.hv'), cur = cursor(st), n = hv.length, span = 2400 / n;
    return { ms: 2700, rest: 0.3, at: function (t) {
      var ms = t * 2700, idx = -1;
      hv.forEach(function (el, i) {
        var a = 150 + i * span, b = a + span - 60, k;
        if (ms < a) k = 0; else if (ms < b) k = dur ? ease.out(seg(ms, a, a + dur)) : 1; else k = dur ? 1 - ease.out(seg(ms, b, b + dur)) : 0;
        if (ms >= a && ms < b) idx = i;
        if (c.kind === '배경') el.style.background = mixBg('var(--u-accent-soft)', 100 * k);
        else if (card) { el.style.boxShadow = '0 ' + (1 + 6 * k) + 'px ' + (3 + 14 * k) + 'px rgb(0 0 0 / ' + Math.round(6 + 12 * k) + '%)'; el.style.transform = 'translateY(' + (-2 * k) + 'px)'; }
        else { var tt = el.querySelector('.ttl'); tt.style.textDecoration = 'underline'; tt.style.textUnderlineOffset = '3px'; tt.style.textDecorationColor = 'color-mix(in srgb, var(--u-ink) ' + Math.round(100 * k) + '%, transparent)'; }
      });
      var tgt = hv[Math.max(0, idx < 0 ? (ms < 150 ? 0 : n - 1) : idx)], r = rel(st, tgt);
      put(cur, r.x + r.w * 0.62, r.y + r.h / 2 + (idx < 0 && ms > 150 ? r.h : 0));
      return idx < 0 ? '마우스 밖' : (idx + 1) + '번째 위';
    } };
  };

  S['highlight-flash'] = function (st, c) {
    var col = c.color === '노랑' ? 'var(--u-flash)' : 'var(--u-accent)', max = c.color === '노랑' ? 100 : 28, start = 350, total = start + c.duration_ms + 400;
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' + ISSUES.slice(0, 4).map(function (it, i) { return rowHTML(it, { cls: i === 1 ? 'fl' : '', attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('') + '</div></div>';
    var fl = st.querySelector('.fl'), pill = fl.querySelector('.u-pill');
    return { ms: total, rest: (start + c.duration_ms * 0.3) / total, at: function (t) {
      var ms = t * total, a = ms < start ? 0 : 1 - ease.out(seg(ms, start, start + c.duration_ms));
      fl.style.background = mixBg(col, max * a);
      var s = ms < start ? 'prog' : 'rev';
      pill.className = 'u-pill p-' + s; pill.textContent = PILL[s];
      return ms < start ? '바뀌기 전' : a > 0.01 ? '칠함 ' + Math.round(a * 100) + '%' : '원래 색';
    } };
  };

  S['undo'] = function (st, c) {
    var W = c.window_s * 1000, del = 250, tin = 520, undoAt = tin + W * 0.5, total = undoAt + 1500;
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' + ISSUES.slice(0, 4).map(function (it, i) { return rowHTML(it, { cls: i === 1 ? 'dr' : '', attr: ' style="--cols:46px minmax(0,1fr) 80px;overflow:hidden"' }); }).join('') + '</div></div>' +
      '<div style="position:absolute;inset:0;padding:12px;display:flex;align-items:flex-end;justify-content:flex-end;pointer-events:none"><div class="u-toast ts"><span class="dot"></span><span>이슈를 지웠습니다.</span><button type="button" class="ub">되돌리기</button>' +
      (c.shortcut === 'Ctrl+Z' ? '<span class="u-kbd" style="background:transparent;color:inherit;opacity:.7">Ctrl Z</span>' : '') + '<span class="bar"></span></div></div>';
    var dr = st.querySelector('.dr'), ts = st.querySelector('.ts'), bar = st.querySelector('.bar'), ub = st.querySelector('.ub');
    return { ms: total, rest: (tin + W * 0.25) / total, at: function (t) {
      var ms = t * total, gone = ease.inOut(seg(ms, del, del + 250)) * (1 - ease.inOut(seg(ms, undoAt + 60, undoAt + 360)));
      dr.style.height = (40 * (1 - gone)) + 'px'; dr.style.opacity = 1 - gone; dr.style.borderBottomWidth = gone > 0.95 ? '0' : '1px';
      var fa = ms < undoAt + 360 ? 0 : 1 - ease.out(seg(ms, undoAt + 360, undoAt + 1260));
      dr.style.background = mixBg('var(--u-flash)', 100 * fa);
      var p = ease.out(seg(ms, tin, tin + 200)) * (1 - seg(ms, undoAt, undoAt + 160));
      ts.style.opacity = p; ts.style.visibility = p > 0.001 ? 'visible' : 'hidden'; ts.style.transform = 'translateY(' + (18 * (1 - p)) + 'px)';
      bar.style.transform = 'scaleX(' + (1 - seg(ms, tin, tin + W)) + ')';
      ub.style.background = ms > undoAt - 120 && ms < undoAt + 60 ? 'rgb(127 127 127 / 30%)' : '';
      var left = Math.ceil((tin + W - ms) / 1000);
      return ms < del ? '지우기 전' : ms < undoAt ? '되돌릴 수 있음 ' + Math.max(0, left) + '초' : fa > 0.01 ? '되돌림 · 제자리' : '제자리';
    } };
  };
  /* ───── 이슈 상세 묶음 ───── */
  AV['민호'] = '#7a5bd1';
  var ICON = {
    edit: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 13l1-4 7-7 3 3-7 7-4 1z"/></svg>',
    link: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 9l2-2M6 11l-1 1a2.5 2.5 0 01-3.5-3.5l2-2M10 5l1-1a2.5 2.5 0 013.5 3.5l-2 2"/></svg>',
    trash: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5"/></svg>'
  };
  UI.ICON = ICON;
  function iconBtn(k, cls) { return '<button type="button" class="u-btn ' + (cls || '') + '" style="padding:6px 8px">' + ICON[k] + '</button>'; }
  function keycap(txt) { return '<span class="u-kbd kc" style="position:absolute;right:12px;bottom:12px;font-size:13px;padding:2px 10px;opacity:0">' + esc(txt) + '</span>'; }
  function tipAt(stage, tip, el, place, gap) {
    var r = rel(stage, el), w = tip.offsetWidth, h = tip.offsetHeight; gap = gap || 8;
    if (place === '아래') { tip.style.left = (r.x + r.w / 2 - w / 2) + 'px'; tip.style.top = (r.y + r.h + gap) + 'px'; }
    else if (place === '오른쪽') { tip.style.left = (r.x + r.w + gap) + 'px'; tip.style.top = (r.y + r.h / 2 - h / 2) + 'px'; }
    else { tip.style.left = (r.x + r.w / 2 - w / 2) + 'px'; tip.style.top = (r.y - h - gap) + 'px'; }
  }
  ease['in'] = function (t) { return t * t * t; };
  ease.spring = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  S['master-detail'] = function (st, c) {
    var r = c.ratio === '3:7' ? [3, 7] : [4, 6], asDrawer = c.mobile === '상세를 Drawer로', items = ISSUES.slice(0, 5);
    function detail(it, back) {
      return (back ? '<span style="font-size:12px;color:var(--u-accent)">‹ 목록</span>' : '') + '<span style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#' + it.n + '</span><b style="font-size:14px;line-height:1.35">' + esc(it.t) + '</b><div>' + pillHTML(it.s) + '</div>' + fakes(4);
    }
    st.innerHTML = '<div class="fr" style="position:absolute;top:12px;bottom:12px;left:12px;border:1px solid var(--u-line);border-radius:10px;overflow:hidden;background:var(--u-panel)">' +
      '<div class="gd" style="position:absolute;inset:0;display:grid">' +
        '<div style="border-right:1px solid var(--u-line);overflow:hidden;min-width:0">' + items.map(function (it) { return '<div class="u-tr rw" style="--cols:38px minmax(0,1fr);--rowh:38px"><span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span></div>'; }).join('') + '</div>' +
        '<div class="dt" style="padding:12px;display:grid;gap:8px;align-content:start;min-width:0;overflow:hidden"></div></div>' +
      '<div class="u-shade sh" style="z-index:2"></div>' +
      '<div class="mv" style="position:absolute;top:0;bottom:0;right:0;z-index:3;background:var(--u-panel);padding:12px;display:grid;gap:8px;align-content:start;box-shadow:var(--u-shadow);width:' + (asDrawer ? '86%' : '100%') + '">' + detail(items[1], !asDrawer) + '</div></div>';
    var fr = st.querySelector('.fr'), gd = st.querySelector('.gd'), dt = st.querySelector('.dt'), rws = st.querySelectorAll('.rw'), sh = st.querySelector('.sh'), mv = st.querySelector('.mv'), last = null;
    var seq = [[0, -1], [300, 0], [1100, 2], [1700, -1], [2500, 1]];
    return { ms: 3400, rest: 0.25, at: function (t) {
      var ms = t * 3400, full = st.clientWidth - 24, w = lerp(full, Math.min(full, 220), ease.inOut(seg(ms, 1700, 2100)));
      fr.style.width = w + 'px';
      var mobile = w < 300, sel = stepAt(seq, ms), at0 = 0;
      seq.forEach(function (s) { if (ms >= s[0]) at0 = s[0]; });
      gd.style.gridTemplateColumns = mobile ? '1fr 0px' : r[0] + 'fr ' + r[1] + 'fr';
      rws.forEach(function (x, i) { x.style.background = i === sel ? 'var(--u-sel)' : ''; });
      if (sel !== last && ms < 1700) { dt.innerHTML = sel < 0 ? '<span style="color:var(--u-muted)">왼쪽에서 이슈를 고르세요</span>' : detail(items[sel]); last = sel; }
      dt.style.opacity = ms < 1700 && at0 ? ease.out(seg(ms, at0, at0 + 180)) : 1;
      dt.style.visibility = mobile ? 'hidden' : 'visible';
      var p = ease.out(seg(ms, 2500, 2780));
      mv.style.transform = 'translateX(' + (100 * (1 - p)) + '%)'; mv.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      sh.style.opacity = asDrawer ? p : 0; sh.style.visibility = asDrawer && p > 0.001 ? 'visible' : 'hidden';
      return ms < 1700 ? (sel < 0 ? '목록과 빈 상세' : '#' + items[sel].n + ' 상세') : ms < 2500 ? '휴대폰 폭 · 목록만' : asDrawer ? '상세를 Drawer로' : '상세를 새 화면으로';
    } };
  };

  S['drawer'] = function (st, c) {
    var bottom = c.side === '아래(Bottom Sheet)', dim = c.overlay === '뒤를 옅게 덮음', right = c.side === '오른쪽';
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' + ISSUES.slice(0, 5).map(function (it, i) { return rowHTML(it, { cls: i === 1 ? 'pk' : '', attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('') + '</div></div>' +
      (dim ? '<div class="u-shade sh" style="z-index:2"></div>' : '') +
      '<div class="dw" style="position:absolute;z-index:3;background:var(--u-panel);box-shadow:var(--u-shadow);padding:14px;display:grid;gap:8px;align-content:start;' +
        (bottom ? 'left:0;right:0;bottom:0;height:64%;border-radius:14px 14px 0 0' : (right ? 'right:0;' : 'left:0;') + 'top:0;bottom:0') + '">' +
        (bottom ? '<span style="justify-self:center;width:36px;height:4px;border-radius:2px;background:var(--u-line)"></span>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>#28</b><span class="u-kbd">Esc</span></div><b style="font-size:13.5px;line-height:1.35">' + esc(ISSUES[1].t) + '</b><div>' + pillHTML(ISSUES[1].s) + '</div>' +
        '<span style="font-family:var(--u-mono);font-size:11px;color:var(--u-muted)">' + (bottom ? 'Bottom Sheet' : '폭 ' + c.width_px + 'px') + '</span>' + fakes(4) + '</div>';
    var dw = st.querySelector('.dw'), sh = st.querySelector('.sh'), pk = st.querySelector('.pk');
    return { ms: 2500, rest: 0.4, at: function (t) {
      var ms = t * 2500;
      if (!bottom) dw.style.width = Math.min(st.clientWidth - 24, st.clientWidth * c.width_px / 760) + 'px';
      var p = ms < 2000 ? ease.out(seg(ms, 350, 600)) : 1 - ease['in'](seg(ms, 2000, 2150));
      dw.style.transform = bottom ? 'translateY(' + (105 * (1 - p)) + '%)' : 'translateX(' + ((right ? 105 : -105) * (1 - p)) + '%)';
      dw.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      if (sh) { sh.style.opacity = p; sh.style.visibility = p > 0.001 ? 'visible' : 'hidden'; }
      pk.style.background = ms > 250 && ms < 2150 ? 'var(--u-sel)' : '';
      return p < 0.001 ? (ms > 2000 ? 'Esc로 닫힘' : '행을 누름') : ms < 2000 ? (p < 1 ? '밀려 나옴 (ease-out)' : '열림') : '닫히는 중 (ease-in)';
    } };
  };

  S['tabs'] = function (st, c) {
    var names = ['내용', '댓글 3', '기록', '첨부 2', '연결 이슈'], more = c.overflow === '더보기 메뉴', slideInd = c.indicator === '밑줄이 미끄러짐', shown = more ? 3 : 5;
    var tb = 'border:0;background:none;padding:8px 12px;font-size:13px;color:var(--u-muted);cursor:pointer;flex:none';
    st.innerHTML = '<div class="u-pad"><div class="bar" style="position:relative;width:min(100%,280px);border-bottom:1px solid var(--u-line);overflow:hidden"><div class="strip" style="display:flex;gap:2px;position:relative;white-space:nowrap">' +
      names.slice(0, shown).map(function (n) { return '<button type="button" class="tb" style="' + tb + '">' + n + '</button>'; }).join('') +
      (more ? '<button type="button" class="tb mo" style="' + tb + '">더보기 ▾</button>' : '') +
      '<span class="ind" style="position:absolute;bottom:0;height:2px;background:var(--u-accent);border-radius:2px"></span></div></div>' +
      '<div class="pn" style="display:grid;gap:8px;padding-top:8px"></div></div>' + keycap('→') +
      (more ? '<div class="u-menu mm" style="position:absolute;z-index:4;min-width:120px"><button type="button">첨부 2</button><button type="button">연결 이슈</button></div>' : '');
    var bar = st.querySelector('.bar'), strip = st.querySelector('.strip'), tbs = st.querySelectorAll('.tb'), ind = st.querySelector('.ind'), pn = st.querySelector('.pn'), kc = st.querySelector('.kc'), mm = st.querySelector('.mm'), mo = st.querySelector('.mo');
    var seq = [[0, 0], [600, 1], [1200, 2], [2000, 4]], lastIdx = -1;
    function target(i) { return i < shown ? tbs[i] : mo; }
    function shift(el) { return Math.max(0, el.offsetLeft + el.offsetWidth - bar.clientWidth + 8); }
    return { ms: 2800, rest: 0.3, at: function (t) {
      var ms = t * 2800, idx = 0, from = 0, at0 = 0;
      for (var i = 0; i < seq.length; i++) if (ms >= seq[i][0]) { from = idx; idx = seq[i][1]; at0 = seq[i][0]; }
      if (mo) mo.textContent = idx >= shown ? names[idx] + ' ▾' : '더보기 ▾';
      var a = target(from), b = target(idx), p = slideInd ? ease.out(seg(ms, at0, at0 + 200)) : 1;
      ind.style.left = lerp(a.offsetLeft, b.offsetLeft, p) + 'px'; ind.style.width = lerp(a.offsetWidth, b.offsetWidth, p) + 'px';
      if (!more) strip.style.transform = 'translateX(' + (-lerp(shift(a), shift(b), ease.out(seg(ms, at0, at0 + 200)))) + 'px)';
      tbs.forEach(function (x) { x.style.color = x === b ? 'var(--u-ink)' : 'var(--u-muted)'; x.style.fontWeight = x === b ? '600' : '400'; });
      if (idx !== lastIdx) { pn.innerHTML = fakes([5, 3, 6, 2, 4][idx]); lastIdx = idx; }
      pn.style.opacity = at0 ? ease.out(seg(ms, at0, at0 + 150)) : 1;
      var kp = seq.some(function (s) { return s[0] && ms > s[0] - 120 && ms < s[0] + 200; }) && !(more && ms > 1500 && ms < 2200);
      kc.style.opacity = kp ? 1 : 0;
      if (mm) {
        var r = rel(st, mo), op = ms > 1550 && ms < 2000 ? 1 : 0;
        mm.style.left = r.x + 'px'; mm.style.top = (r.y + r.h + 4) + 'px'; show(mm, op, -4);
        mm.querySelectorAll('button').forEach(function (x, i) { x.classList.toggle('on', ms > 1750 && i === 1); });
      }
      return names[idx] + (idx >= shown ? ' (더보기에서)' : '');
    } };
  };

  S['inline-edit'] = function (st, c) {
    var enterSave = c.save === 'Enter로 저장', canEsc = c.cancel === 'Esc로 취소';
    var base = '환불 사유 선택지에 "기타" 직접 입력 추가', add = ' (11월 배포)', add2 = ' 급함';
    st.innerHTML = '<div class="u-pad" style="gap:10px"><span style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#28</span>' +
      '<div class="tw" style="position:relative;border:1px solid transparent;border-radius:6px;padding:4px 30px 4px 6px;font-size:16px;font-weight:700;line-height:1.4"><span class="tt"></span><span class="pen" style="position:absolute;right:8px;top:6px;color:var(--u-muted)">' + ICON.edit + '</span></div>' +
      fakes(5) + '</div>' + keycap('Enter');
    var tw = st.querySelector('.tw'), tt = st.querySelector('.tt'), pen = st.querySelector('.pen'), kc = st.querySelector('.kc'), cur = cursor(st);
    var saveAt = 1800, edit2 = 2300, escAt = 2950;
    return { ms: 3500, rest: 0.45, at: function (t) {
      var ms = t * 3500, editing = (ms >= 600 && ms < saveAt) || (ms >= edit2 && (ms < escAt || !canEsc));
      var text = base;
      if (ms >= 900) text += add.slice(0, Math.min(add.length, Math.floor((ms - 900) / 70)));
      if (ms >= 2450) text += add2.slice(0, Math.min(add2.length, Math.floor((ms - 2450) / 90)));
      if (ms >= escAt && canEsc) text = base + add;
      tt.innerHTML = esc(text) + (editing ? '<span class="caret" style="display:inline-block;width:1.5px;height:1em;background:var(--u-accent);vertical-align:-2px;margin-left:1px"></span>' : '');
      tw.style.borderColor = editing ? 'var(--u-accent)' : ms > 200 && ms < 600 ? 'var(--u-line)' : 'transparent';
      tw.style.boxShadow = editing ? '0 0 0 3px var(--u-accent-soft)' : 'none';
      tw.style.fontWeight = '700';
      var fl = ms >= saveAt && ms < edit2 ? 1 - ease.out(seg(ms, saveAt, saveAt + 700)) : 0;
      tw.style.background = editing ? 'var(--u-panel)' : mixBg('var(--u-flash)', 100 * fl, 'transparent');
      pen.style.opacity = !editing && ms > 200 && ms < saveAt ? 1 : 0;
      var r = rel(st, tw);
      var outside = !enterSave && ms > saveAt - 250 && ms < saveAt + 200;
      put(cur, outside ? r.x + 40 : r.x + r.w - 60, outside ? r.y + r.h + 70 : r.y + r.h / 2, (ms > 520 && ms < 640) || (outside && ms > saveAt - 80 && ms < saveAt + 40) || (ms > edit2 - 80 && ms < edit2 + 40));
      cur.style.opacity = ms < 900 || outside || (ms > edit2 - 300 && ms < edit2 + 100) ? 1 : 0;
      kc.textContent = ms > 2600 ? 'Esc' : 'Enter';
      kc.style.opacity = (enterSave && ms > saveAt - 150 && ms < saveAt + 250) || (ms > escAt - 150 && ms < escAt + 300) ? 1 : 0;
      return editing ? (ms >= escAt && !canEsc ? 'Esc 없음 · 계속 편집' : '편집 중') : ms >= escAt ? 'Esc로 취소 · 원래 글' : ms >= saveAt ? '저장함' : '보기';
    } };
  };

  S['activity-timeline'] = function (st, c) {
    var newest = c.order === '최신이 위', grp = c.group === '날짜별 묶음';
    var ev = [['민지', '상태를 진행 중으로 바꿈', 5], ['준호', '댓글을 남김', 48], ['서연', '담당자를 민지로 바꿈', 1500], ['도윤', '이슈를 만듦', 1700]];
    var fresh = ['민지', '상태를 검토로 바꿈', 0];
    st.innerHTML = '<div class="u-pad"><div class="tl" style="position:relative"></div></div>';
    var tl = st.querySelector('.tl'), on = null;
    function draw(withFresh) {
      var list = ev.slice(); if (withFresh) list.push(fresh);
      list.sort(function (a, b) { return newest ? a[2] - b[2] : b[2] - a[2]; });
      var g = '', html = '<span style="position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:var(--u-line)"></span>';
      list.forEach(function (e) {
        var day = e[2] < 600 ? '오늘' : '어제';
        if (grp && day !== g) { g = day; html += '<div style="padding:2px 0 4px 22px;font-size:11.5px;color:var(--u-muted);font-weight:600">' + day + '</div>'; }
        html += '<div class="ev' + (e === fresh ? ' fr' : '') + '" style="position:relative;padding:4px 6px 8px 22px;border-radius:6px"><span style="position:absolute;left:2px;top:9px;width:10px;height:10px;border-radius:50%;background:var(--u-panel);border:2px solid ' + (e === fresh ? 'var(--u-accent)' : 'var(--u-muted)') + '"></span>' +
          '<b>' + e[0] + '</b> ' + e[1] + ' <span style="color:var(--u-muted);font-size:12px">· ' + ago(e[2]) + '</span></div>';
      });
      tl.innerHTML = html;
    }
    return { ms: 2300, rest: 0.6, at: function (t) {
      var ms = t * 2300, f = ms >= 900;
      if (f !== on) { draw(f); on = f; }
      var el = tl.querySelector('.fr');
      if (el) { var p = ease.out(seg(ms, 900, 1150)); el.style.opacity = p; el.style.transform = 'translateY(' + ((newest ? -8 : 8) * (1 - p)) + 'px)'; el.style.background = mixBg('var(--u-flash)', 100 * (1 - ease.out(seg(ms, 1150, 2000))), 'transparent'); }
      return f ? '새 기록이 ' + (newest ? '맨 위' : '맨 아래') + '에' : '기록 ' + ev.length + '줄';
    } };
  };

  S['select'] = function (st, c) {
    var native = c.look === '브라우저 기본', opts = ['긴급', '높음', '보통', '낮음'];
    var sys = native ? ';font-family:system-ui,-apple-system,sans-serif;font-size:13px' : '';
    st.innerHTML = '<div class="u-pad" style="gap:6px"><span style="font-size:12px;color:var(--u-muted)">우선순위</span>' +
      '<div style="position:relative;width:200px"><button type="button" class="sb" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid var(--u-line);border-radius:' + (native ? '4px' : 'var(--u-r)') + ';background:var(--u-panel);cursor:pointer' + sys + '"><span class="v"></span><span>▾</span></button>' +
      '<div class="ls' + (native ? '' : ' u-menu') + '" style="position:absolute;left:0;right:0;top:100%;z-index:3;' + (native ? 'background:var(--u-panel);border:1px solid var(--u-muted);box-shadow:0 2px 6px rgb(0 0 0 / 25%)' + sys : 'margin-top:4px') + '">' +
      opts.map(function (o) { return '<button type="button" class="op"' + (native ? ' style="display:block;width:100%;text-align:left;border:0;background:none;padding:3px 8px;font:inherit;color:inherit"' : '') + '>' + o + '<span class="ck"></span></button>'; }).join('') + '</div></div>' + fakes(5) + '</div>' + keycap('↑');
    var sb = st.querySelector('.sb'), v = st.querySelector('.v'), ls = st.querySelector('.ls'), ops = st.querySelectorAll('.op'), kc = st.querySelector('.kc');
    var hl = [[0, 2], [700, 1], [1000, 0], [1250, 1]];
    return { ms: 2300, rest: 0.4, at: function (t) {
      var ms = t * 2300, val = ms >= 1500 ? '높음' : '보통', open = ms >= 300 && ms < 1500, h = stepAt(hl, ms);
      v.textContent = val;
      if (native) { ls.style.visibility = open ? 'visible' : 'hidden'; }
      else show(ls, ms < 1500 ? ease.out(seg(ms, 300, 440)) : 1 - seg(ms, 1500, 1600), -4);
      ops.forEach(function (o, i) {
        if (native) { o.style.background = open && i === h ? '#2463d6' : 'none'; o.style.color = open && i === h ? '#ffffff' : ''; }
        else { o.classList.toggle('on', i === h); o.querySelector('.ck').textContent = opts[i] === val ? '✓' : ''; }
      });
      sb.style.outline = open || (ms > 1500 && ms < 1900) ? '2px solid var(--u-accent)' : '';
      kc.textContent = ms > 1400 ? 'Enter' : ms > 1150 ? '↓' : '↑';
      kc.style.opacity = [700, 1000, 1250, 1500].some(function (k) { return ms > k - 100 && ms < k + 150; }) ? 1 : 0;
      return open ? '열림 · ' + opts[h] : '값: ' + val;
    } };
  };

  S['combobox'] = function (st, c) {
    var multi = c.multi === '여러 개(칩)', create = c.create === '새 값 만들기 허용', P = ['민지', '민호', '준호', '서연', '도윤'];
    st.innerHTML = '<div class="u-pad" style="gap:6px"><span style="font-size:12px;color:var(--u-muted)">담당자</span><div style="position:relative">' +
      '<div class="fld" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;border:1px solid var(--u-accent);box-shadow:0 0 0 3px var(--u-accent-soft);border-radius:var(--u-r);padding:4px 8px;background:var(--u-panel);min-height:34px"></div>' +
      '<div class="u-menu ls" style="position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:3"></div></div>' + fakes(4) + '</div>' + keycap('Enter');
    var fld = st.querySelector('.fld'), ls = st.querySelector('.ls'), kc = st.querySelector('.kc'), last = '';
    var typed = [[0, ''], [300, '민'], [1100, ''], [1400, '서'], [1800, ''], [2200, '하늘']], hl = [[0, 0], [700, 1], [1100, 0]];
    function chip(n) { return '<span style="display:inline-flex;gap:5px;align-items:center;background:var(--u-hover);border-radius:999px;padding:1px 8px 1px 2px;font-size:12.5px"><span class="u-av" style="width:18px;height:18px;font-size:10px;background:' + AV[n] + '">' + n[0] + '</span>' + n + ' <span style="color:var(--u-muted)">×</span></span>'; }
    return { ms: 3000, rest: 0.3, at: function (t) {
      var ms = t * 3000, q = stepAt(typed, ms), h = stepAt(hl, ms), picked = [];
      if (ms >= 1100) picked.push('민호');
      if (ms >= 1800) { if (multi) picked.push('서연'); else picked = ['서연']; }
      var hits = q ? P.filter(function (p) { return p.indexOf(q) >= 0; }) : [];
      var key = q + '|' + h + '|' + picked.join();
      if (key !== last) {
        var caret = '<span style="display:inline-block;width:1.5px;height:1em;background:var(--u-accent);vertical-align:-2px"></span>';
        fld.innerHTML = (multi ? picked.map(chip).join('') : '') + '<span>' + (!multi && !q && picked.length ? esc(picked[0]) : esc(q)) + caret + '</span>';
        ls.innerHTML = hits.length ? hits.map(function (p, i) { return '<button type="button" class="' + (i === h ? 'on' : '') + '"><span class="u-who"><span class="u-av" style="background:' + AV[p] + '">' + p[0] + '</span>' + p + '</span></button>'; }).join('')
          : create ? '<button type="button" class="on">\'' + esc(q) + '\' 새로 추가</button>' : '<div style="padding:8px 10px;color:var(--u-muted);font-size:13px">맞는 사람이 없습니다</div>';
        last = key;
      }
      show(ls, q ? 1 : 0);
      kc.style.opacity = (ms > 1000 && ms < 1250) || (ms > 1700 && ms < 1950) ? 1 : 0;
      return q ? '"' + q + '" ' + (hits.length ? hits.length + '명' : create ? '새로 추가 가능' : '없음') : picked.length ? '고름: ' + picked.join(', ') : '비었음';
    } };
  };

  S['date-picker'] = function (st, c) {
    var range = c.mode === '기간', presets = c.presets !== '없음', off = (new Date(2026, 10, 1).getDay() + 6) % 7, DOW = ['일', '월', '화', '수', '목', '금', '토'];
    var cell = 'display:grid;place-items:center;height:19px;font-size:11.5px;border-radius:4px';
    st.innerHTML = '<div class="u-pad" style="gap:6px">' +
      '<div class="fv u-btn" style="justify-self:start;min-width:190px"></div>' +
      '<div class="pp" style="display:flex;gap:10px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:var(--u-r-lg);box-shadow:var(--u-shadow);padding:8px;justify-self:start">' +
        (presets ? '<div style="display:grid;gap:2px;align-content:start;border-right:1px solid var(--u-line);padding-right:8px">' + ['오늘', '이번 주', '이번 달'].map(function (p) { return '<button type="button" class="ps" style="border:0;background:none;text-align:left;padding:4px 8px;border-radius:5px;font-size:12.5px;cursor:pointer;color:var(--u-ink)">' + p + '</button>'; }).join('') + '</div>' : '') +
        '<div><div style="font-weight:600;font-size:12.5px;margin-bottom:2px">2026년 11월</div><div class="gd" style="display:grid;grid-template-columns:repeat(7,26px);gap:1px">' +
        ['월', '화', '수', '목', '금', '토', '일'].map(function (d) { return '<span style="' + cell + ';color:var(--u-muted);font-size:11px">' + d + '</span>'; }).join('') +
        new Array(off + 1).join('<span></span>') + Array.apply(null, Array(30)).map(function (_, i) { return '<span class="dd" style="' + cell + (i + 1 === 24 ? ';font-weight:700;text-decoration:underline' : '') + '">' + (i + 1) + '</span>'; }).join('') + '</div></div></div></div>';
    var fv = st.querySelector('.fv'), pp = st.querySelector('.pp'), dd = st.querySelectorAll('.dd'), ps = st.querySelectorAll('.ps');
    function lab(d) { return '11월 ' + d + '일 (' + DOW[new Date(2026, 10, d).getDay()] + ')'; }
    return { ms: 2800, rest: 0.6, at: function (t) {
      var ms = t * 2800, a = 0, b = 0, preset = -1;
      if (range) {
        if (ms >= 800) a = 10;
        if (ms >= 900) b = Math.min(17, 10 + Math.floor((ms - 900) / 100) + 1);
        if (ms >= 2100) { if (presets) { a = 23; b = 29; preset = 1; } else { a = 2; b = 6; } }
      } else {
        if (ms >= 800) a = b = 17;
        if (ms >= 2100) { if (presets) { a = b = 24; preset = 0; } else a = b = 20; }
      }
      var done = range ? ms >= 1500 : ms >= 800;
      dd.forEach(function (el, i) {
        var d = i + 1, end = d === a || d === b, inR = a && b && d > a && d < b;
        el.style.background = end ? 'var(--u-accent)' : inR ? 'var(--u-accent-soft)' : '';
        el.style.color = end ? 'var(--u-accent-ink)' : '';
        el.style.opacity = inR && !done ? 0.6 : 1;
      });
      ps.forEach(function (p, i) { p.style.background = i === preset ? 'var(--u-accent-soft)' : ''; p.style.color = i === preset ? 'var(--u-accent)' : 'var(--u-ink)'; });
      fv.textContent = !a ? (range ? '기간 고르기 ▾' : '날짜 고르기 ▾') : range ? (done ? lab(a) + ' – ' + lab(b) : lab(a) + ' – …') : lab(a);
      show(pp, ease.out(seg(ms, 200, 320)), -4, 0.98);
      return !a ? '열기' : range && !done ? '끝 날짜 고르는 중' : preset >= 0 ? '빠른 선택: ' + ['오늘', '이번 주', '이번 달'][preset] : '고름';
    } };
  };

  S['tooltip'] = function (st, c) {
    var d = c.delay_ms, pl = c.placement, names = ['편집', '링크 복사', '지우기'];
    st.innerHTML = '<div class="u-pad" style="justify-items:center;align-content:center;height:100%"><div style="display:flex;gap:8px">' + iconBtn('edit', 'ib') + iconBtn('link', 'ib') + iconBtn('trash', 'ib') + '</div></div><div class="u-tip tp"></div>' + keycap('Tab');
    var bs = st.querySelectorAll('.ib'), tip = st.querySelector('.tp'), kc = st.querySelector('.kc'), cur = cursor(st);
    var hoverAt = 450, leaveAt = Math.max(1700, hoverAt + d + 900), focusAt = leaveAt + 400, total = focusAt + d + 900;
    return { ms: total, rest: (hoverAt + d + 300) / total, at: function (t) {
      var ms = t * total, target = ms < focusAt ? bs[1] : bs[2];
      tip.textContent = ms < focusAt ? names[1] : names[2];
      var p;
      if (ms < focusAt) p = ms < leaveAt ? ease.out(seg(ms, hoverAt + d, hoverAt + d + 120)) : 1 - seg(ms, leaveAt, leaveAt + 100);
      else p = ease.out(seg(ms, focusAt + d, focusAt + d + 120));
      tip.style.opacity = p;
      tipAt(st, tip, target, pl);
      bs[2].classList.toggle('focus', ms >= focusAt);
      var r = rel(st, bs[1]), from = { x: r.x - 90, y: r.y + 60 }, k = ease.inOut(seg(ms, 150, hoverAt));
      var mx = lerp(from.x, r.x + r.w / 2, k), my = lerp(from.y, r.y + r.h / 2, k);
      if (ms > leaveAt) { var k2 = ease.inOut(seg(ms, leaveAt, leaveAt + 300)); mx = lerp(r.x + r.w / 2, r.x + r.w / 2, k2); my = lerp(r.y + r.h / 2, r.y + r.h + 70, k2); }
      put(cur, mx, my);
      kc.style.opacity = ms > focusAt - 100 && ms < focusAt + 300 ? 1 : 0;
      return ms < hoverAt ? '마우스 다가감' : ms < hoverAt + d ? d + 'ms 기다림' : ms < focusAt ? (ms < leaveAt ? '보임' : '사라짐') : ms < focusAt + d ? 'Tab 초점 · 기다림' : '초점에도 보임';
    } };
  };

  S['popover'] = function (st, c) {
    var pl = c.placement, arrow = c.arrow === '꼬리 있음';
    var arrowCss = { '아래': 'top:-6px;left:18px;border-right:0;border-bottom:0', '위': 'bottom:-6px;left:18px;border-left:0;border-top:0', '오른쪽': 'left:-6px;top:18px;border-right:0;border-top:0' }[pl];
    st.innerHTML = '<div class="u-pad" style="gap:8px">' + fakes(2) + '<div style="display:flex;gap:10px;align-items:center;padding:' + (pl === '위' ? '104px' : '8px') + ' 0 0 16px"><span style="font-size:12px;color:var(--u-muted)">담당자</span>' +
      '<button type="button" class="av" style="border:0;background:none;padding:2px 6px 2px 2px;border-radius:999px;cursor:pointer">' + whoHTML('민지') + '</button></div>' + fakes(3) + '</div>' +
      '<div class="pv" style="position:absolute;z-index:4;width:220px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:var(--u-r-lg);box-shadow:var(--u-shadow);padding:12px;display:grid;gap:8px">' +
      (arrow ? '<span style="position:absolute;width:10px;height:10px;background:var(--u-panel);border:1px solid var(--u-line);transform:rotate(45deg);' + arrowCss + '"></span>' : '') +
      '<div style="display:flex;gap:8px;align-items:center"><span class="u-av" style="width:32px;height:32px;font-size:14px;background:' + AV['민지'] + '">민</span><div style="display:grid;line-height:1.35"><b>민지</b><span style="font-size:12px;color:var(--u-muted)">minji@example.com</span></div></div>' +
      '<button type="button" class="u-btn go" style="justify-self:start">이슈 보기</button></div>';
    var av = st.querySelector('.av'), pv = st.querySelector('.pv'), go = st.querySelector('.go'), cur = cursor(st);
    return { ms: 2500, rest: 0.4, at: function (t) {
      var ms = t * 2500, r = rel(st, av);
      if (pl === '아래') { pv.style.left = r.x + 'px'; pv.style.top = (r.y + r.h + 10) + 'px'; }
      else if (pl === '위') { pv.style.left = r.x + 'px'; pv.style.top = (r.y - pv.offsetHeight - 10) + 'px'; }
      else { pv.style.left = (r.x + r.w + 10) + 'px'; pv.style.top = (r.y - 8) + 'px'; }
      var p = ms < 1900 ? ease.out(seg(ms, 350, 500)) : 1 - seg(ms, 1900, 2000);
      show(pv, p, 0, 0.96);
      go.style.background = ms > 1200 && ms < 1750 ? 'var(--u-hover)' : '';
      var g = rel(st, go), out = ms > 1700;
      put(cur, ms < 1100 ? r.x + r.w / 2 : out ? st.clientWidth - 40 : g.x + g.w / 2, ms < 1100 ? r.y + r.h / 2 : out ? st.clientHeight - 30 : g.y + g.h / 2, (ms > 280 && ms < 400) || (ms > 1850 && ms < 1950));
      return p < 0.01 ? (ms > 1900 ? '바깥 눌러 닫힘' : '아바타') : '열림 · ' + pl;
    } };
  };

  S['slide'] = function (st, c) {
    var D = c.distance_px, dur = c.duration_ms, dir = { '아래': [0, 1], '위': [0, -1], '오른쪽': [1, 0], '왼쪽': [-1, 0] }[c.from];
    var news = [[400, ISSUES[6]], [1300, ISSUES[7]]], total = 1300 + dur + 700;
    st.innerHTML = '<div class="u-pad"><div class="u-tbl">' + news.slice().reverse().map(function (x, i) { return rowHTML(x[1], { cls: 'nw nw' + (1 - i), attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('') +
      ISSUES.slice(0, 3).map(function (it) { return rowHTML(it, { attr: ' style="--cols:46px minmax(0,1fr) 80px"' }); }).join('') + '</div></div>';
    var rows = [st.querySelector('.nw0'), st.querySelector('.nw1')];
    return { ms: total, rest: (400 + dur * 0.5) / total, at: function (t) {
      var ms = t * total, label = '기다림';
      rows.forEach(function (r, k) {
        var T = news[k][0], p = ease.out(seg(ms, T, T + dur));
        r.style.display = ms >= T ? '' : 'none';
        r.style.opacity = p; r.style.transform = 'translate(' + (dir[0] * D * (1 - p)) + 'px,' + (dir[1] * D * (1 - p)) + 'px)';
        if (ms >= T && p < 1) label = (k + 1) + '번째 들어오는 중';
        else if (ms >= T) label = (k + 1) + '개 들어옴';
      });
      return label;
    } };
  };

  S['easing'] = function (st, c) {
    var f = { 'ease-out': ease.out, 'ease-in': ease['in'], 'ease-in-out': ease.inOut, 'linear': ease.linear, 'spring': ease.spring }[c.curve], dur = c.duration_ms;
    var openAt = 300, closeAt = openAt + dur + 700, total = closeAt + 150 + 300, pts = [];
    for (var i = 0; i <= 40; i++) pts.push((10 + i * 2) + ',' + (90 - f(i / 40) * 70).toFixed(1));
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:110px minmax(0,1fr);gap:14px;height:100%;align-content:center">' +
      '<svg viewBox="0 0 100 100" style="width:110px;height:110px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px">' +
        '<path d="M10 90H90M10 90V10" style="fill:none;stroke:var(--u-line)"/><polyline points="' + pts.join(' ') + '" style="fill:none;stroke:var(--u-accent);stroke-width:2"/>' +
        '<circle class="dot" r="3.5" style="fill:var(--u-accent)"/></svg>' +
      '<div class="tr" style="position:relative;height:140px;border:1px dashed var(--u-line);border-radius:10px;overflow:hidden">' +
        '<div class="pn" style="position:absolute;top:0;bottom:0;left:0;width:62%;background:var(--u-panel);box-shadow:var(--u-shadow);padding:10px;display:grid;gap:6px;align-content:start">' + fakes(4) + '</div></div></div>';
    var dot = st.querySelector('.dot'), pn = st.querySelector('.pn');
    return { ms: total, rest: (openAt + dur * 0.5) / total, at: function (t) {
      var ms = t * total, p = seg(ms, openAt, openAt + dur), x = ms < closeAt ? f(p) : 1 - ease['in'](seg(ms, closeAt, closeAt + 150));
      pn.style.transform = 'translateX(' + (-105 * (1 - x)) + '%)';
      dot.setAttribute('cx', 10 + p * 80); dot.setAttribute('cy', 90 - f(p) * 70);
      dot.style.opacity = ms < closeAt ? 1 : 0.3;
      return ms < openAt ? '닫힘' : ms < openAt + dur ? '열리는 중 · 진행 ' + Math.round(p * 100) + '% → 위치 ' + Math.round(f(p) * 100) + '%' : ms < closeAt ? '열림' : ms < closeAt + 150 ? '닫히는 중 (ease-in 150ms)' : '닫힘';
    } };
  };

  S['fade'] = function (st, c) {
    var dur = c.duration_ms, d = c.delay_ms, hoverAt = 350, start = hoverAt + d, leaveAt = start + dur + 900, total = leaveAt + 100 + 400;
    st.innerHTML = '<div class="u-pad" style="justify-items:center;align-content:center;height:100%">' + iconBtn('link', 'ib') + '</div><div class="u-tip tp">링크 복사</div>';
    var b = st.querySelector('.ib'), tip = st.querySelector('.tp'), cur = cursor(st);
    return { ms: total, rest: (start + dur * 0.5) / total, at: function (t) {
      var ms = t * total, p = ms < leaveAt ? ease.out(seg(ms, start, start + dur)) : 1 - seg(ms, leaveAt, leaveAt + 100);
      tip.style.opacity = p; tipAt(st, tip, b, '위');
      var r = rel(st, b), k = ease.inOut(seg(ms, 50, hoverAt)), out = ease.inOut(seg(ms, leaveAt - 100, leaveAt + 200));
      put(cur, lerp(r.x - 80, r.x + r.w / 2, k), lerp(r.y + 60, r.y + r.h / 2, k) + 60 * out);
      return '투명도 ' + Math.round(p * 100) + '%' + (ms >= hoverAt && ms < start ? ' · 기다림' : '');
    } };
  };

  S['focus-ring'] = function (st, c) {
    st.innerHTML = '<div class="u-pad" style="gap:10px"><label style="display:grid;gap:4px;font-size:12px;color:var(--u-muted)">제목<input class="f0" readonly value="환불 사유 선택지에 기타 추가" style="font:inherit;font-size:13.5px;color:var(--u-ink);border:1px solid var(--u-line);border-radius:var(--u-r);padding:6px 8px;background:var(--u-panel);outline:none"></label>' +
      '<div style="display:flex;gap:14px;align-items:center"><button type="button" class="u-btn primary f1" style="outline:none">저장</button><a href="#" class="f2" style="color:var(--u-accent);font-size:13px;border-radius:3px">도움말</a></div>' + fakes(3) + '</div>' + keycap('Tab');
    var els = [st.querySelector('.f0'), st.querySelector('.f1'), st.querySelector('.f2')], kc = st.querySelector('.kc'), cur = cursor(st);
    var seq = [[0, -1], [900, 0], [1500, 1], [2100, 2]];
    return { ms: 2700, rest: 0.6, at: function (t) {
      var ms = t * 2700, f = stepAt(seq, ms);
      els.forEach(function (e, i) { e.style.outline = i === f ? c.width_px + 'px solid var(--u-accent)' : 'none'; e.style.outlineOffset = c.offset_px + 'px'; });
      var r = rel(st, els[1]);
      put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > 250 && ms < 400);
      cur.style.opacity = ms < 800 ? 1 : 0;
      els[1].style.filter = ms > 250 && ms < 400 ? 'brightness(0.9)' : '';
      kc.style.opacity = [900, 1500, 2100].some(function (k) { return ms > k - 100 && ms < k + 250; }) ? 1 : 0;
      return f < 0 ? (ms > 250 ? '마우스로 누름 · 고리 없음' : '처음') : 'Tab → ' + ['입력칸', '단추', '링크'][f] + ' 고리';
    } };
  };
  /* ───── 대시보드 묶음 ───── */
  // 숫자 꼴: 소수 자리, 천 단위 쉼표
  function fmt(v, comma, dec) {
    var s = dec ? v.toFixed(dec) : String(Math.round(v));
    if (comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
    return s;
  }
  UI.fmt = fmt;
  function curve(name) { return { 'ease-out': ease.out, 'linear': ease.linear, 'ease-in-out': ease.inOut, 'spring': ease.spring }[name] || ease.out; }
  UI.curve = curve;
  // 스파크라인: 선은 옅은 색, 마지막 점만 강조 색 (dataviz: 한 계열, 축 없음)
  function spark(vals, w, h, kind, end, cut) {
    var n = vals.length, pad = 3, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rng = mx - mn || 1;
    var X = function (i) { return pad + i * (w - pad * 2) / (n - 1); }, Y = function (v) { return h - pad - (v - mn) / rng * (h - pad * 2); };
    var k = cut == null ? n : Math.max(1, Math.round(cut * n)), s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="display:block;overflow:visible;max-width:100%">';
    if (kind === '막대') {
      var bw = (w - pad * 2) / n - 2;
      vals.slice(0, k).forEach(function (v, i) {
        var y = Y(v), last = i === n - 1;
        s += '<rect x="' + (pad + i * (w - pad * 2) / n + 1).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, bw).toFixed(1) + '" height="' + (h - pad - y + 1).toFixed(1) + '" rx="1.5" style="fill:' + (last && end ? 'var(--u-accent)' : 'var(--u-muted)') + ';opacity:' + (last && end ? 1 : 0.45) + '"/>';
      });
    } else {
      var pts = vals.slice(0, k).map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
      if (kind === '면' && k > 1) s += '<polygon points="' + X(0).toFixed(1) + ',' + h + ' ' + pts.join(' ') + ' ' + X(k - 1).toFixed(1) + ',' + h + '" style="fill:var(--u-muted);opacity:0.14"/>';
      s += '<polyline points="' + pts.join(' ') + '" style="fill:none;stroke:var(--u-muted);stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round"/>';
      if (end && k === n) s += '<circle cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(vals[n - 1]).toFixed(1) + '" r="3" style="fill:var(--u-accent);stroke:var(--u-panel);stroke-width:1.5"/>';
    }
    return s + '</svg>';
  }
  UI.spark = spark;
  function series(seed, n, base, amp) { var r = []; for (var i = 0; i < n; i++) r.push(base + amp * (Math.sin(i * 0.7 + seed) * 0.6 + i / n * 0.8 + ((i * 7 + seed * 13) % 5) / 10)); return r; }
  UI.series = series;
  function card(inner, extra) { return '<div style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px;padding:12px;display:grid;gap:4px;min-width:0' + (extra || '') + '">' + inner + '</div>'; }
  function delta(d, upGood, unit) {
    var good = (d > 0) === upGood;
    return '<span style="font-size:12px;color:' + (good ? 'var(--u-ok)' : 'var(--u-danger)') + '">' + (d > 0 ? '▲ +' : '▼ −') + Math.abs(d) + unit + '</span> <span style="font-size:12px;color:var(--u-muted)">지난달보다</span>';
  }
  UI.deltaHTML = delta;

  S['card-grid'] = function (st, c) {
    var names = ['결제 개편', '정산 자동화', '환불 정책', '앱 결제', '영수증', '간편결제'];
    st.innerHTML = '<div class="u-pad"><div class="cg" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(' + c.min_width_px + 'px,1fr));gap:' + c.gap_px + 'px;border:1px dashed var(--u-line);border-radius:8px;padding:6px">' +
      names.map(function (n, i) { return card('<b style="font-size:12.5px">' + n + '</b>' + fakes(i % 3 === 0 ? 2 : 1), ';padding:8px 10px'); }).join('') + '</div></div>';
    var cg = st.querySelector('.cg');
    return { ms: 3400, rest: 0.1, at: function (t) {
      var ms = t * 3400, full = st.clientWidth - 28, w = lerp(full, Math.max(150, full * 0.42), ease.inOut(seg(ms, 400, 1400)) - ease.inOut(seg(ms, 2000, 3000)));
      cg.style.width = w + 'px';
      var cols = getComputedStyle(cg).gridTemplateColumns.split(' ').length;
      return '열 ' + cols + '개 · 폭 ' + Math.round(w) + 'px';
    } };
  };

  S['kpi-card'] = function (st, c) {
    var D = [
      { k: '결제 건수', a: 18240, b: 19470, da: 6.2, db: 3.1, up: true, unit: '%', dec: 0, comma: true, s: series(1, 12, 15, 8) },
      { k: '환불률', a: 2.7, b: 2.4, da: 0.2, db: -0.3, up: false, unit: '%p', dec: 1, suf: '%', s: series(3, 12, 2, 1) }
    ];
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + D.map(function () {
      return card('<span class="lb" style="font-size:12px;color:var(--u-muted)"></span><b class="v" style="font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-0.02em"></b>' +
        (c.delta === '없음' ? '' : '<span class="dl"></span>') + (c.spark === '없음' ? '' : '<div class="sp" style="margin-top:4px"></div>'));
    }).join('') + '</div>';
    var cards = [].slice.call(st.querySelectorAll('.u-pad > div'));
    return { ms: 2800, rest: 0.9, at: function (t) {
      var ms = t * 2800, two = ms >= 1600;
      cards.forEach(function (el, i) {
        var d = D[i], v = two ? lerp(d.a, d.b, ease.out(seg(ms, 1600, 2200))) : d.a * ease.out(seg(ms, 0, 900));
        el.querySelector('.lb').textContent = d.k + (two ? ' · 이번 달' : ' · 지난달');
        el.querySelector('.v').textContent = fmt(v, d.comma, d.dec) + (d.suf || '');
        var dl = el.querySelector('.dl'); if (dl) dl.innerHTML = delta(two ? d.db : d.da, d.up, d.unit);
        var sp = el.querySelector('.sp'); if (sp) sp.innerHTML = spark(two ? d.s.slice(1).concat([d.s[11] * 1.06]) : d.s, 120, 24, '면', true, two ? null : seg(ms, 0, 900));
      });
      return two ? '기간 바뀜 · 숫자와 비교 다시' : '처음 불러옴';
    } };
  };

  S['number-ticker'] = function (st, c) {
    var f = curve(c.easing), dur = c.duration_ms, scroll = c.start === '스크롤해서 보일 때', startAt = scroll ? 1150 : 250, total = startAt + dur + 700, target = 1428390;
    st.innerHTML = '<div style="position:absolute;inset:0;overflow:hidden"><div class="ct" style="position:absolute;left:0;right:0;top:0;padding:14px;display:grid;gap:10px">' + (scroll ? fakes(16) : '') +
      card('<span style="font-size:12px;color:var(--u-muted)">이번 달 결제 금액</span><b class="n" style="font-size:30px;font-variant-numeric:tabular-nums;letter-spacing:-0.02em"></b>', ';padding:14px') + fakes(4) + '</div></div>';
    var ct = st.querySelector('.ct'), n = st.querySelector('.n'), box = n.parentNode;
    return { ms: total, rest: (startAt + dur * 0.4) / total, at: function (t) {
      var ms = t * total;
      if (scroll) ct.style.transform = 'translateY(' + (-Math.max(0, box.offsetTop - 40) * ease.inOut(seg(ms, 150, 1100))) + 'px)';
      var p = seg(ms, startAt, startAt + dur);
      n.textContent = fmt(target * f(p), c.comma === '넣기') + '원';
      return ms < startAt ? (scroll ? '아직 안 보여서 안 셈' : '기다림') : p < 1 ? '세는 중 ' + Math.round(p * 100) + '%' : '최종 값';
    } };
  };

  S['sparkline'] = function (st, c) {
    var all = series(5, 34, 20, 9), end = c.endpoint === '끝점 강조';
    st.innerHTML = '<div class="u-pad" style="gap:12px">' + card('<span style="font-size:12px;color:var(--u-muted)">결제 건수 · 지난 30일</span><div style="display:flex;align-items:center;gap:12px;justify-content:space-between"><b class="v" style="font-size:20px;font-variant-numeric:tabular-nums"></b><span class="s1"></span></div>') +
      '<span style="font-size:11.5px;color:var(--u-muted)">같은 Sparkline을 크게 키워 봄</span><div class="s2" style="padding:6px 4px"></div></div>';
    var v = st.querySelector('.v'), s1 = st.querySelector('.s1'), s2 = st.querySelector('.s2');
    return { ms: 3200, rest: 0.2, at: function (t) {
      var ms = t * 3200, shift = Math.min(4, Math.floor(ms / 700)), win = all.slice(shift, shift + 30);
      v.textContent = fmt(win[29] * 100, true) + '건';
      s1.innerHTML = spark(win, 96, 24, c.kind, end);
      s2.innerHTML = spark(win, Math.min(420, st.clientWidth - 40), 96, c.kind, end);
      return '하루 ' + shift + '번 지남 · 새 값이 오른쪽 끝에';
    } };
  };

  S['stagger'] = function (st, c) {
    var n = 12, step = c.step_ms, maxI = c.max_items, start = 250, total = start + Math.min(n - 1, maxI) * step + 200 + 800;
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' + Array.apply(null, Array(n)).map(function (_, i) { return card('<b style="font-size:12px;font-variant-numeric:tabular-nums">' + (i + 1) + '</b><div class="u-fake" style="width:70%"></div>', ';padding:8px;height:50px'); }).join('') + '</div>';
    var cs = st.querySelectorAll('.u-pad > div');
    return { ms: total, rest: 0.45, at: function (t) {
      var ms = t * total, shown = 0;
      cs.forEach(function (el, i) {
        var d = start + Math.min(i, maxI) * step, p = ease.out(seg(ms, d, d + 200));
        el.style.opacity = p; el.style.transform = 'translateY(' + (8 * (1 - p)) + 'px)';
        if (p > 0) shown++;
      });
      return shown + '/' + n + '개 나타남' + (maxI < n ? ' · ' + (maxI + 1) + '번째부터 함께' : '');
    } };
  };

  // 밝은 화면·어두운 화면 미리 보기용 상태 색 (parts.css의 --u-* 값과 같다)
  var SEM = {
    light: '--u-bg:#fafaf8;--u-panel:#ffffff;--u-ink:#1d1f22;--u-muted:#6a6e74;--u-line:#e4e4df;--u-ok:#2f9e5b;--u-warn:#9a5b00;--u-danger:#c4321f;--u-info:#1f6aa5;--u-ok-soft:#e2f2e6;--u-warn-soft:#fdf0d6;--u-danger-soft:#fbe4e0;--u-info-soft:#e2eef8',
    dark: '--u-bg:#0f1218;--u-panel:#141922;--u-ink:#e4e8ef;--u-muted:#8891a1;--u-line:#222936;--u-ok:#5fd18d;--u-warn:#f0b44c;--u-danger:#ff8a7a;--u-info:#6cc4e0;--u-ok-soft:#14301f;--u-warn-soft:#3a2c12;--u-danger-soft:#3a1c18;--u-info-soft:#13303a'
  };
  var STAT = { ok: ['✓', '정상'], warn: ['!', '응답 느림'], danger: ['✕', '오류 증가'], info: ['i', '점검 예정'] };
  UI.STAT = STAT;
  function statHTML(kind, word) {
    return '<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px"><span style="width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:800;background:var(--u-' + kind + '-soft);color:var(--u-' + kind + ')">' + STAT[kind][0] + '</span><b style="font-weight:600">' + (word || STAT[kind][1]) + '</b></span>';
  }
  UI.statHTML = statHTML;
  S['semantic-color'] = function (st, c) {
    var four = c.set === '성공·경고·위험·정보';
    var rows = four ? [['카드 결제', 'ok'], ['계좌이체', 'warn'], ['간편결제', 'danger'], ['휴대폰 결제', 'info']] : [['카드 결제', 'ok'], ['간편결제', 'danger']];
    var seq = four ? [[0, 'warn'], [1200, 'danger'], [2200, 'ok']] : [[0, 'danger'], [1500, 'ok']], ri = four ? 1 : 1;
    st.innerHTML = '<div class="wr" style="position:absolute;inset:0;padding:14px;display:grid;gap:8px;align-content:start;background:var(--u-bg);color:var(--u-ink);' + SEM[c.theme === '어두운 화면' ? 'dark' : 'light'] + '">' +
      '<span style="font-size:12px;color:var(--u-muted)">결제 수단 상태 · ' + c.theme + '</span>' +
      rows.map(function (r) { return '<div class="rw" style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px;padding:8px 12px"><span>' + r[0] + '</span><span class="sv"></span></div>'; }).join('') + '</div>';
    var svs = st.querySelectorAll('.sv'), last = '';
    return { ms: 3000, rest: 0.1, at: function (t) {
      var ms = t * 3000, k = stepAt(seq, ms);
      if (k !== last) { svs.forEach(function (el, i) { el.innerHTML = statHTML(i === ri ? k : rows[i][1]); }); last = k; }
      var at0 = 0; seq.forEach(function (s) { if (ms >= s[0]) at0 = s[0]; });
      svs[ri].style.opacity = at0 ? lerp(0.3, 1, ease.out(seg(ms, at0, at0 + 200))) : 1;
      return rows[ri][0] + ': ' + STAT[k][1];
    } };
  };

  S['banner'] = function (st, c) {
    var canClose = c.dismiss === '닫기 단추', top = c.scope === '화면 맨 위';
    var band = '<div class="bw" style="overflow:hidden"><div class="bn" role="status" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--u-warn-soft);color:var(--u-ink);font-size:12.5px' + (top ? '' : ';border-radius:8px 8px 0 0') + '">' +
      '<span style="width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:800;background:var(--u-warn);color:var(--u-panel);flex:none">!</span><span style="flex:1;min-width:0">11월 30일 22시부터 점검</span><a href="#" style="color:var(--u-ink);white-space:nowrap">자세히</a>' +
      (canClose ? '<button type="button" class="x u-icon" aria-label="닫기">×</button>' : '') + '</div></div>';
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;grid-template-rows:auto auto 1fr">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--u-line);background:var(--u-panel);font-weight:700;font-size:12.5px">결제 대시보드</div>' + (top ? band : '<span></span>') +
      '<div style="padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start">' +
        '<div style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px;overflow:hidden">' + (top ? '' : band) + '<div style="padding:10px;display:grid;gap:6px">' + fakes(3) + '</div></div>' +
        card(fakes(3)) + '</div></div>';
    var bw = st.querySelector('.bw'), bn = st.querySelector('.bn'), x = st.querySelector('.x');
    return { ms: 2700, rest: 0.5, at: function (t) {
      var ms = t * 2700, p = ease.out(seg(ms, 300, 550)) * (canClose ? 1 - ease.inOut(seg(ms, 2000, 2200)) : 1);
      bw.style.height = (bn.offsetHeight * p) + 'px';
      if (x) x.style.background = ms > 1850 && ms < 2000 ? 'var(--u-hover)' : '';
      return p < 0.01 ? (ms > 2000 ? '닫힘 · 다시 안 보임' : '없음') : ms < 550 ? '나타남' : canClose ? (ms < 2000 ? '떠 있음' : '닫는 중') : '닫을 수 없음';
    } };
  };

  function spinHTML(size, cls) { return '<span class="u-spin ' + (cls || '') + '" role="status" aria-label="불러오는 중" style="width:' + size + 'px;height:' + size + 'px"></span>'; }
  UI.spinHTML = spinHTML;
  var WARN_ICO = '<span style="width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;font-weight:800;background:var(--u-danger-soft);color:var(--u-danger)">!</span>';
  UI.WARN_ICO = WARN_ICO;

  S['error-state'] = function (st, c) {
    var whole = c.scope === '화면 전체', retry = c.retry === '다시 시도 단추', s = series(2, 12, 10, 5);
    var errBody = WARN_ICO + '<b style="font-size:13px">차트를 불러오지 못했습니다</b><span style="font-size:12px;color:var(--u-muted)">서버 응답이 늦습니다 (504)</span>' + (retry ? '<button type="button" class="u-btn rt">다시 시도</button>' : '');
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;height:100%">' +
      [0, 1, 2].map(function (i) { return '<div class="cd" style="position:relative;background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px;padding:10px;display:grid;gap:6px;align-content:start;min-height:150px"><span style="font-size:12px;color:var(--u-muted)">' + ['결제 건수', '환불 사유', '정산 대기'][i] + '</span><div class="bd" style="display:grid;place-items:center;min-height:100px"></div></div>'; }).join('') + '</div>' +
      (whole ? '<div class="wh" style="position:absolute;inset:0;background:var(--u-bg);display:grid;place-items:center"><div class="u-empty" style="gap:8px">' + errBody + '</div></div>' : '');
    var bds = st.querySelectorAll('.bd'), wh = st.querySelector('.wh'), last = '';
    function ok(i) { return '<div style="width:100%">' + spark(s.map(function (v) { return v + i; }), 120, 40, i === 1 ? '막대' : '면', true) + '</div>'; }
    return { ms: 3000, rest: 0.45, at: function (t) {
      var ms = t * 3000, phase = ms < 700 ? 'load' : !retry || ms < 1700 ? 'err' : ms < 2400 ? 'retry' : 'ok';
      var key = phase;
      if (key !== last) {
        bds.forEach(function (b, i) {
          var target = whole || i === 1;
          b.innerHTML = phase === 'load' || (phase === 'retry' && target) ? spinHTML(20) : target && phase === 'err' ? (whole ? '' : '<div class="u-empty" style="padding:0;gap:4px">' + errBody + '</div>') : ok(i);
        });
        if (wh) wh.style.display = phase === 'err' ? 'grid' : 'none';
        last = key;
      }
      st.querySelectorAll('.u-spin').forEach(function (sp) { sp.style.transform = 'rotate(' + ((ms % 800) / 800 * 360) + 'deg)'; });
      var rt = st.querySelector('.rt'); if (rt) rt.style.outline = ms > 1550 && ms < 1700 ? '2px solid var(--u-accent)' : '';
      return { load: '불러오는 중', err: whole ? '화면 전체 오류' : '한 카드만 오류 · 나머지 그대로', retry: '다시 시도 · Spinner', ok: '다시 불러옴' }[phase];
    } };
  };

  S['spinner'] = function (st, c) {
    var size = c.size_px, d = c.delay_ms, reqs = [[300, 1800], [2300, 2500]];
    st.innerHTML = '<div class="u-pad" style="gap:12px">' + fakes(3) + '<div style="display:flex;align-items:center;gap:12px;min-height:44px"><button type="button" class="u-btn primary sv" style="min-width:76px;justify-content:center">저장</button><span class="ss" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--u-muted)"></span></div>' + fakes(3) + '</div>';
    var sv = st.querySelector('.sv'), ss = st.querySelector('.ss');
    return { ms: 3000, rest: 0.33, at: function (t) {
      var ms = t * 3000, r = reqs.filter(function (q) { return ms >= q[0] && ms < q[1]; })[0], done = reqs.filter(function (q) { return ms >= q[1] && ms < q[1] + 400; })[0];
      sv.disabled = !!r; sv.textContent = done ? '저장됨 ✓' : '저장';
      if (r && ms - r[0] >= d) { ss.innerHTML = spinHTML(size) + '<span>저장 중</span>'; ss.firstChild.style.transform = 'rotate(' + ((ms % 800) / 800 * 360) + 'deg)'; }
      else ss.innerHTML = '';
      return r ? (ms - r[0] < d ? '요청 중 · ' + d + 'ms 전엔 안 보임' : '저장 중 · 도는 원') : done ? ((done[1] - done[0]) < d ? '빨리 끝나 원을 안 보임' : '끝남') : '기다림';
    } };
  };

  S['reduced-motion'] = function (st, c) {
    var fadeOnly = c.policy === '이동은 빼고 페이드만';
    function col(title) { return '<div style="display:grid;gap:8px;align-content:start;min-width:0"><span style="font-size:12px;color:var(--u-muted)">' + title + '</span><div class="cd" style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px;padding:12px;display:grid;gap:4px"><span style="font-size:12px;color:var(--u-muted)">결제 건수</span><b class="n" style="font-size:22px;font-variant-numeric:tabular-nums"></b>' + fakes(2) + '</div></div>'; }
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">' + col('보통') + col('동작 줄이기') + '</div>';
    var cds = st.querySelectorAll('.cd'), ns = st.querySelectorAll('.n');
    return { ms: 1900, rest: 0.35, at: function (t) {
      var ms = t * 1900, p = ease.out(seg(ms, 300, 700));
      cds[0].style.opacity = p; cds[0].style.transform = 'translateY(' + (24 * (1 - p)) + 'px) scale(' + lerp(0.96, 1, p) + ')';
      ns[0].textContent = fmt(1284 * ease.out(seg(ms, 300, 1200)), true);
      var q = fadeOnly ? ease.out(seg(ms, 300, 450)) : (ms >= 300 ? 1 : 0);
      cds[1].style.opacity = q; cds[1].style.transform = 'none';
      ns[1].textContent = ms >= 300 ? '1,284' : '0';
      return ms < 300 ? '기다림' : ms < 1200 ? '왼쪽은 움직이는 중 · 오른쪽은 ' + (fadeOnly ? '페이드만' : '바로') : '둘 다 끝';
    } };
  };
  /* ───── 업무 보드 묶음 ───── */
  var COLS = [['todo', '할 일'], ['prog', '진행 중'], ['rev', '검토'], ['done', '완료']];
  UI.COLS = COLS;
  function kcard(it, extra) {
    return '<div class="kc" style="background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px;padding:6px 8px;display:grid;gap:2px;font-size:11.5px;line-height:1.35' + (extra || '') + '"><span style="font-family:var(--u-mono);font-size:10.5px;color:var(--u-muted)">#' + it.n + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.t) + '</span></div>';
  }

  S['kanban-board'] = function (st, c) {
    var count = c.count === '칸별 개수 표시', fold = c.collapse === '칸 접기';
    var start = { todo: [ISSUES[2], ISSUES[8]], prog: [ISSUES[0], ISSUES[3]], rev: [ISSUES[1]], done: [ISSUES[5], ISSUES[7]] };
    st.innerHTML = '<div class="bd" style="position:absolute;inset:10px;display:grid;gap:6px">' + COLS.map(function (k) {
      return '<div class="col" data-k="' + k[0] + '" style="background:var(--u-hover);border-radius:8px;padding:6px;display:grid;gap:5px;align-content:start;min-width:0;overflow:hidden">' +
        '<div class="hd" style="display:flex;gap:4px;align-items:center;font-size:11.5px;font-weight:700;white-space:nowrap"><span class="nm">' + k[1] + '</span>' + (count ? '<span class="ct" style="font-weight:400;color:var(--u-muted);font-family:var(--u-mono)"></span>' : '') + (fold ? '<span class="fb" style="margin-left:auto;color:var(--u-muted)">⇤</span>' : '') + '</div><div class="ls" style="display:grid;gap:5px"></div></div>';
    }).join('') + '</div><div class="gh" style="position:absolute;z-index:5;pointer-events:none"></div>';
    var bd = st.querySelector('.bd'), cols = {}, gh = st.querySelector('.gh'), last = '';
    st.querySelectorAll('.col').forEach(function (el) { cols[el.getAttribute('data-k')] = el; });
    var mover = ISSUES[2];
    gh.innerHTML = kcard(mover, ';box-shadow:var(--u-shadow);transform:rotate(-2deg)');
    function lay(phase) {
      if (phase === last) return; last = phase;
      COLS.forEach(function (k) {
        var list = start[k[0]].slice();
        if (k[0] === 'todo' && phase !== 'idle') list = list.filter(function (x) { return x !== mover; });
        var html = list.map(function (it) { return kcard(it); }).join('');
        if (k[0] === 'prog' && phase === 'drag') html = '<div class="ph" style="height:38px;border:1.5px dashed var(--u-accent);border-radius:8px;background:var(--u-accent-soft)"></div>' + html;
        if (k[0] === 'prog' && phase === 'drop') html = kcard(mover, ';outline:2px solid var(--u-accent)') + html;
        cols[k[0]].querySelector('.ls').innerHTML = html;
        var ct = cols[k[0]].querySelector('.ct'); if (ct) ct.textContent = list.length + (k[0] === 'prog' && phase !== 'idle' && phase !== 'drag' ? 1 : 0);
      });
    }
    return { ms: 3200, rest: 0.3, at: function (t) {
      var ms = t * 3200, phase = ms < 400 ? 'idle' : ms < 1300 ? 'drag' : 'drop';
      lay(phase);
      var k = fold ? ease.inOut(seg(ms, 1900, 2200)) * (1 - ease.inOut(seg(ms, 2700, 3000))) : 0;
      bd.style.gridTemplateColumns = '1fr 1fr 1fr ' + lerp(1, 0.22, k) + 'fr';
      var dc = cols.done; dc.querySelector('.ls').style.display = k > 0.5 ? 'none' : 'grid';
      dc.querySelector('.nm').style.writingMode = k > 0.5 ? 'vertical-rl' : '';
      if (phase === 'drag') {
        var a = rel(st, cols.todo.querySelector('.ls')), b = rel(st, cols.prog.querySelector('.ls')), p = ease.inOut(seg(ms, 500, 1250));
        gh.style.width = a.w + 'px'; gh.style.left = lerp(a.x, b.x, p) + 'px'; gh.style.top = (lerp(a.y, b.y, p) - 6 * Math.sin(Math.PI * p)) + 'px'; gh.style.display = '';
      } else gh.style.display = 'none';
      return phase === 'idle' ? '보드' : phase === 'drag' ? '끄는 중 · 놓일 자리에 빈 틀' : k > 0.5 ? '완료 칸 접힘' : '놓음 · 진행 중 ' + (count ? '개수 +1' : '');
    } };
  };

  S['drag-and-drop'] = function (st, c) {
    var H = 40, items = ['환불 화면 시안 확인', '결제 실패 문구 정하기', '영수증 메일 예시', '정산 표 열 순서', '배포 일정 공유'], handleOnly = c.handle === '손잡이(⠿)로만', line = c.placeholder === '선';
    st.innerHTML = '<div style="position:absolute;inset:14px"><div class="lst" style="position:relative;height:' + (H * items.length) + 'px">' + items.map(function (x, i) {
      return '<div class="it" style="position:absolute;left:0;right:0;height:' + (H - 6) + 'px;display:flex;align-items:center;gap:8px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:8px;padding:0 10px;font-size:13px"><span class="hd" style="color:var(--u-muted);' + (handleOnly ? '' : 'opacity:.35') + '">⠿</span><span>' + (i + 1) + '. ' + x + '</span></div>';
    }).join('') + '<div class="ph" style="position:absolute;left:0;right:0"></div></div></div>' + keycap('Space');
    var its = st.querySelectorAll('.it'), ph = st.querySelector('.ph'), kc = st.querySelector('.kc'), cur = cursor(st);
    ph.style.cssText += line ? ';height:2px;background:var(--u-accent);border-radius:2px' : ';height:' + (H - 6) + 'px;border:1.5px dashed var(--u-accent);border-radius:8px;background:var(--u-accent-soft)';
    // 집은 항목(0번)의 위치 y와 다른 항목이 비켜난 정도를 시간에서 계산한다
    function frame(dragIdx, y, others) {
      its.forEach(function (el, i) {
        if (i === dragIdx) return;
        el.style.transform = 'translateY(' + (i * H + others(i)) + 'px)'; el.style.boxShadow = ''; el.style.zIndex = '';
      });
      var d = its[dragIdx]; d.style.transform = 'translateY(' + y + 'px)';
    }
    return { ms: 3200, rest: 0.35, at: function (t) {
      var ms = t * 3200, d = 0, y, lift = ms > 400 && ms < 1550;
      var dragY = ms < 500 ? 0 : ms < 1400 ? lerp(0, 2 * H, ease.inOut(seg(ms, 500, 1400))) : 2 * H;
      var kbY = ms < 2300 ? 2 * H : lerp(2 * H, 3 * H, ease.out(seg(ms, 2300, 2450)));
      y = ms < 2000 ? dragY : kbY;
      var slot = Math.round(y / H);
      // 다른 항목은 집은 항목이 자기 자리 절반을 넘으면 한 칸 위로 비켜난다
      frame(d, y, function (i) { return -H * ease.out(clamp((y - (i - 0.5) * H) / (0.35 * H))); });
      var it = its[0], pick = lift || (ms > 2050 && ms < 2650);
      it.style.boxShadow = pick ? 'var(--u-shadow)' : ''; it.style.zIndex = 3; it.style.transform += pick ? ' scale(1.02)' : '';
      it.style.outline = ms > 1950 && ms < 2800 ? '2px solid var(--u-accent)' : '';
      ph.style.display = lift ? '' : 'none';
      ph.style.top = (line ? slot * H - 4 : slot * H) + 'px';
      var hd = it.querySelector('.hd'), r = rel(st, handleOnly ? hd : it);
      put(cur, handleOnly ? r.x + r.w / 2 : r.x + r.w * 0.5, r.y + r.h / 2, lift);
      cur.style.opacity = ms < 1700 ? 1 : 0;
      kc.textContent = ms > 2200 && ms < 2500 ? '↓' : 'Space';
      kc.style.opacity = (ms > 2000 && ms < 2200) || (ms > 2250 && ms < 2500) || (ms > 2600 && ms < 2850) ? 1 : 0;
      return ms < 500 ? (handleOnly ? '⠿ 손잡이' : '항목 전체') + '로 집기' : ms < 1550 ? '끄는 중 · ' + (slot + 1) + '번째 자리' : ms < 2000 ? '놓음' : ms < 2650 ? '키보드로 옮기는 중' : '키보드로 놓음';
    } };
  };

  S['optimistic-update'] = function (st, c) {
    var toastMode = c.rollback === '되돌리고 Toast';
    st.innerHTML = '<div class="u-pad" style="gap:10px">' + card('<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#28</span><span class="sv" style="font-size:12px;color:var(--u-muted)"></span></div><b style="font-size:13.5px">' + esc(ISSUES[1].t) + '</b><div style="display:flex;gap:8px;align-items:center"><span class="pw"></span><button type="button" class="u-btn nx" style="padding:3px 9px;font-size:12px"></button></div><span class="er" style="font-size:12px;color:var(--u-danger)"></span>', ';padding:14px') + fakes(3) + '</div>' +
      '<div style="position:absolute;right:12px;bottom:12px;left:12px;display:flex;justify-content:flex-end"><div class="u-toast ts" style="font-size:12.5px"><span class="dot err"></span><span>저장하지 못했습니다.</span><button type="button">다시 시도</button></div></div>';
    var pw = st.querySelector('.pw'), sv = st.querySelector('.sv'), nx = st.querySelector('.nx'), er = st.querySelector('.er'), ts = st.querySelector('.ts'), cd = st.querySelector('.u-pad > div');
    return { ms: 3400, rest: 0.75, at: function (t) {
      var ms = t * 3400, s = 'todo';
      if (ms >= 300) s = 'prog';
      if (ms >= 1500) s = 'rev';
      if (ms >= 2200) s = 'prog';
      pw.innerHTML = pillHTML(s);
      nx.textContent = s === 'todo' ? '진행 중으로' : s === 'prog' ? '검토로' : '검토로';
      nx.style.outline = (ms > 200 && ms < 320) || (ms > 1400 && ms < 1520) ? '2px solid var(--u-accent)' : '';
      sv.textContent = (ms >= 300 && ms < 1000) || (ms >= 1500 && ms < 2200) ? '저장 중…' : ms >= 1000 && ms < 1500 ? '저장됨 ✓' : '';
      var fail = ms >= 2200, p = fail ? ease.out(seg(ms, 2200, 2400)) : 0;
      if (toastMode) { ts.style.opacity = p; ts.style.visibility = p > 0.01 ? 'visible' : 'hidden'; ts.style.transform = 'translateY(' + (12 * (1 - p)) + 'px)'; er.textContent = ''; cd.style.borderColor = ''; }
      else { ts.style.visibility = 'hidden'; er.textContent = fail ? '저장 실패 · 다시 시도' : ''; cd.style.borderColor = fail ? 'var(--u-danger)' : ''; }
      return ms < 300 ? '할 일' : ms < 1000 ? '먼저 바꿈 · 서버 기다림' : ms < 1500 ? '서버 성공' : ms < 2200 ? '먼저 바꿈 · 서버 기다림' : '서버 실패 · 되돌림';
    } };
  };

  S['scroll-into-view'] = function (st, c) {
    var smooth = c.behavior === '부드럽게', center = c.block === '가운데', fields = ['이름', '이메일', '전화번호', '회사', '부서', '주소', '우편번호', '메모'], bad = 1;
    st.innerHTML = '<div class="vp" style="position:absolute;inset:0;overflow:hidden"><div class="hd" style="position:absolute;left:0;right:0;top:0;height:38px;z-index:2;display:flex;align-items:center;padding:0 14px;background:var(--u-panel);border-bottom:1px solid var(--u-line);font-weight:700;font-size:13px">신청서 · 고정 머리줄</div>' +
      '<div class="ct" style="position:absolute;left:0;right:0;top:38px;padding:12px 14px;display:grid;gap:10px">' + fields.map(function (f, i) {
        return '<label style="display:grid;gap:3px;font-size:12px;color:var(--u-muted)">' + f + '<span class="fd" style="height:30px;border:1px solid ' + (i === bad ? 'var(--u-danger)' : 'var(--u-line)') + ';border-radius:6px;background:var(--u-panel)"></span>' + (i === bad ? '<span style="color:var(--u-danger)">이메일 형식이 틀렸습니다</span>' : '') + '</label>';
      }).join('') + '<button type="button" class="u-btn primary sv" style="justify-self:start">저장</button></div></div>';
    var ct = st.querySelector('.ct'), fds = st.querySelectorAll('.fd'), sv = st.querySelector('.sv');
    return { ms: 2400, rest: 0.8, at: function (t) {
      var ms = t * 2400, vh = st.clientHeight - 38, maxS = Math.max(0, ct.scrollHeight - vh);
      var f = fds[bad], target = center ? f.offsetTop + f.offsetHeight / 2 - vh / 2 : f.offsetTop - 12;
      target = Math.max(0, Math.min(maxS, target));
      var p = ms < 500 ? 0 : smooth ? ease.inOut(seg(ms, 500, 1100)) : 1;
      ct.style.transform = 'translateY(' + (-lerp(maxS, target, p)) + 'px)';
      sv.style.outline = ms > 350 && ms < 500 ? '2px solid var(--u-accent)' : '';
      var arrived = smooth ? ms > 1100 : ms > 500;
      f.style.outline = arrived ? '2px solid var(--u-accent)' : ''; f.style.outlineOffset = '2px';
      return ms < 500 ? '맨 아래 · 저장 누름' : !arrived ? '스크롤 중' : '오류 칸 도착 · 초점';
    } };
  };
  /* ───── 움직임 › 스크롤 연출 (소개·랜딩) ───── */
  // 스크롤 위치 길 [[ms, 0~1], ...]: 점 사이를 ease.inOut으로 잇는다
  function scrollAlong(path, ms) {
    if (ms <= path[0][0]) return path[0][1];
    for (var i = 1; i < path.length; i++) if (ms < path[i][0]) return lerp(path[i - 1][1], path[i][1], ease.inOut(seg(ms, path[i - 1][0], path[i][0])));
    return path[path.length - 1][1];
  }
  var SBAR = '<div class="sb" style="position:absolute;right:3px;top:3px;bottom:3px;width:4px;z-index:5;pointer-events:none"><i style="position:absolute;left:0;right:0;top:0;border-radius:2px;background:var(--u-muted);opacity:.45"></i></div>';
  function scrollbar(st, y, vh, total) {
    var sb = st.querySelector('.sb'), th = sb.firstChild, H = sb.clientHeight, h = Math.max(16, H * Math.min(1, vh / total));
    th.style.height = h + 'px'; th.style.transform = 'translateY(' + ((total > vh ? y / (total - vh) : 0) * (H - h)) + 'px)';
  }
  function featCard(i, h) { return '<div class="cd" style="height:' + h + 'px;border-radius:10px;background:var(--u-accent-soft);border:1px solid var(--u-line);display:grid;place-items:center;font-weight:700;color:var(--u-accent)">기능 ' + i + '</div>'; }

  S['scroll-driven-animation'] = function (st, c) {
    var view = c.timeline === 'view()', scale = c.prop === '크기', MS = 3800, PATH = [[300, 0], [2600, 1], [3300, 0.45]];
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0;padding:14px 18px;display:grid;gap:12px"><b style="font-size:15px">이렇게 쓰세요</b>' + fakes(2) +
      [1, 2, 3].map(function (i) { return featCard(i, 96) + fakes(1); }).join('') + fakes(3) + '</div>' + SBAR;
    var ct = st.querySelector('.ct'), cds = st.querySelectorAll('.cd');
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.max(0, ct.scrollHeight - vh), y = maxS * scrollAlong(PATH, ms);
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      cds.forEach(function (cd) {
        var p = view ? clamp((vh - (cd.offsetTop - y)) / (vh * 0.6)) : maxS ? y / maxS : 1;
        cd.style.opacity = scale ? lerp(0.35, 1, p) : p;
        cd.style.transform = scale ? 'scale(' + lerp(0.7, 1, p) + ')' : 'translateY(' + (28 * (1 - p)) + 'px)';
      });
      return ms < 300 ? '맨 위' : ms < 2600 ? (view ? '카드마다 화면을 지나는 만큼 진행' : '모든 카드가 페이지 스크롤 하나를 따라감 ' + Math.round(y / (maxS || 1) * 100) + '%') : ms < 3300 ? '위로 되돌리면 되감김' : '스크롤을 멈추면 그 자리에서 멈춤';
    } };
  };

  S['scroll-reveal'] = function (st, c) {
    var dist = +c.distance_px, dur = +c.duration_ms, every = c.once === '들어올 때마다', MS = 4300, PATH = [[300, 0], [1900, 1], [2700, 0.25], [3500, 1]];
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0;padding:14px 18px;display:grid;gap:12px"><b style="font-size:15px">이렇게 쓰세요</b>' + fakes(2) +
      [1, 2, 3, 4].map(function (i) { return featCard(i, 80) + fakes(1); }).join('') + fakes(2) + '</div>' + SBAR;
    var ct = st.querySelector('.ct'), cds = [].slice.call(st.querySelectorAll('.cd'));
    return { ms: MS, rest: 0.8, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.max(0, ct.scrollHeight - vh);
      function yAt(m) { return maxS * scrollAlong(PATH, m); }
      var y = yAt(ms), n = 0;
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      cds.forEach(function (cd) {
        function inside(m) { var top = cd.offsetTop - yAt(m); return top < vh * 0.88 && top + cd.offsetHeight > 0; }
        // 들어온 시각: 한 번만이면 처음, 들어올 때마다면 마지막으로 들어온 때
        var start = -1, was = false;
        for (var m = 0; m <= ms; m += 20) { var on = inside(m); if (on && !was && (every || start < 0)) start = m; was = on; }
        var p = start < 0 || (every && !inside(ms)) ? 0 : ease.out(seg(ms, start, start + dur));
        show(cd, p, dist);
        if (p > 0.5) n++;
      });
      return '나타난 카드 ' + n + '개' + (ms > 1900 && ms < 2700 ? ' · 위로 올림' : ms > 2700 && ms < 3500 ? (every ? ' · 다시 들어온 카드는 다시 재생' : ' · 이미 나온 카드는 그대로') : '');
    } };
  };

  S['parallax'] = function (st, c) {
    var three = c.layers === '3층', sp = +c.speed / 100, mid = (sp + 1) / 2, MS = 3600, PATH = [[300, 0], [2300, 1], [2900, 1], [3500, 0]];
    var hill = function (mix, poly) { return 'background:color-mix(in srgb, var(--u-accent) ' + mix + '%, var(--u-accent-soft));clip-path:polygon(' + poly + ')'; };
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0">' +
      '<div style="position:relative;height:250px;overflow:hidden;background:var(--u-accent-soft)">' +
        '<div class="l0" style="position:absolute;left:0;right:0;top:-40px;height:330px"><i style="position:absolute;right:18%;top:70px;width:54px;height:54px;border-radius:50%;background:var(--u-flash)"></i>' +
          '<i style="position:absolute;left:-10%;right:-10%;bottom:40px;height:150px;' + hill(35, '0 100%,0 60%,18% 25%,32% 55%,50% 10%,68% 50%,82% 30%,100% 58%,100% 100%') + '"></i></div>' +
        (three ? '<div class="l1" style="position:absolute;left:0;right:0;top:0;height:290px"><i style="position:absolute;left:-5%;right:-5%;bottom:0;height:110px;' + hill(65, '0 100%,0 55%,25% 30%,45% 60%,70% 20%,100% 50%,100% 100%') + '"></i></div>' : '') +
        '<div style="position:absolute;left:18px;top:56px;display:grid;gap:6px;justify-items:start"><b style="font-size:20px">여름 산행 예약</b><span>주말마다 열리는 작은 산행</span><button type="button" class="u-btn primary">일정 보기</button></div>' +
      '</div><div style="padding:14px 18px;display:grid;gap:10px;background:var(--u-panel)">' + fakes(8) + '</div></div>' + SBAR;
    var ct = st.querySelector('.ct'), l0 = st.querySelector('.l0'), l1 = st.querySelector('.l1');
    return { ms: MS, rest: 0.7, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.min(200, Math.max(0, ct.scrollHeight - vh)), y = maxS * scrollAlong(PATH, ms);
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      // 층은 글과 함께 올라가되, 뒤층일수록 덜 올라가게 아래로 되민다
      l0.style.transform = 'translateY(' + (y * (1 - sp)) + 'px)';
      if (l1) l1.style.transform = 'translateY(' + (y * (1 - mid)) + 'px)';
      return '배경 ' + Math.round(sp * 100) + '%' + (three ? ' · 중간 ' + Math.round(mid * 100) + '%' : '') + ' · 글 100% 속도';
    } };
  };

  S['sticky-scrollytelling'] = function (st, c) {
    var n = +c.steps, slide = c.swap === '밀어 올림', H = 150, PIN = 40, MS = 1200 + n * 900;
    var STEPS = [['요청 쓰기', '용어 이름으로 화면을 말한다', '✎'], ['화면 받기', 'AI가 이름대로 만든다', '▦'], ['이름표로 확인', '부품마다 이름을 붙여 본다', '◎'], ['다듬기', '조절판 값으로 고친다', '✓']].slice(0, n);
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0;padding:0 16px">' +
      '<div style="height:70px;display:grid;align-content:center;gap:6px"><b style="font-size:15px">이렇게 동작해요</b>' + fakes(1) + '</div>' +
      '<div class="sec" style="position:relative;display:grid;grid-template-columns:1fr 1fr;gap:14px"><div>' +
        STEPS.map(function (s, i) { return '<div class="tx" style="height:' + H + 'px;display:grid;align-content:center;gap:4px;font-size:12.5px"><b style="font-size:14px">' + (i + 1) + '. ' + s[0] + '</b><span style="color:var(--u-muted)">' + s[1] + '</span></div>'; }).join('') + '</div>' +
        '<div class="pin" style="position:absolute;right:0;top:0;width:calc(50% - 7px);height:170px;border-radius:12px;border:1px solid var(--u-line);background:var(--u-panel);overflow:hidden">' +
          STEPS.map(function (s, i) { return '<div class="pg" style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:6px"><span style="font-size:44px;line-height:1;color:var(--u-accent)">' + s[2] + '</span><span style="font-size:12px;color:var(--u-muted)">' + (i + 1) + ' / ' + n + '</span></div>'; }).join('') + '</div>' +
      '</div><div style="padding:16px 0;display:grid;gap:10px">' + fakes(5) + '</div></div>' + SBAR;
    var ct = st.querySelector('.ct'), sec = st.querySelector('.sec'), pin = st.querySelector('.pin'), pgs = st.querySelectorAll('.pg'), txs = st.querySelectorAll('.tx');
    return { ms: MS, rest: 0.5, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.max(0, ct.scrollHeight - vh), y = maxS * scrollAlong([[300, 0], [MS - 500, 1]], ms);
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      // position: sticky 흉내: 구역 안에서는 화면 위 PIN px에 붙어 있다
      var secTop = sec.offsetTop, room = sec.offsetHeight - pin.offsetHeight, top = Math.max(0, Math.min(room, y + PIN - secTop));
      pin.style.transform = 'translateY(' + top + 'px)';
      // 지금 단계: 설명의 가운데가 화면 가운데를 지나면 넘어간다. 경계 근처에서만 바뀐다
      var f = (y + vh / 2 - secTop - H / 2) / H, fl = Math.floor(f), F = Math.max(0, Math.min(n - 1, fl + clamp((f - fl - 0.3) / 0.4))), now = Math.round(F);
      pgs.forEach(function (pg, i) {
        pg.style.opacity = slide ? 1 : clamp(1 - Math.abs(i - F));
        pg.style.transform = slide ? 'translateY(' + ((i - F) * 100) + '%)' : '';
      });
      txs.forEach(function (tx, i) { tx.style.opacity = i === now ? 1 : 0.4; });
      return y + PIN < secTop ? '구역 전' : top >= room ? '구역 끝 · 그림 칸도 함께 올라감' : (now + 1) + '단계 · 그림 칸은 붙어 있음';
    } };
  };

  S['horizontal-scroll'] = function (st, c) {
    var snap = c.snap === '카드마다 멈춤', peek = +c.peek_px, G = 10, MS = 3800, NAMES = ['물류 회사', '병원 예약', '학원 관리', '카페 주문', '공방 수업', '동네 서점'];
    st.innerHTML = '<div class="u-pad" style="gap:10px"><b style="font-size:14px">고객 사례</b>' +
      '<div class="vp" style="position:relative;overflow:hidden;margin:0 -14px;padding:0 14px"><div class="row" style="display:flex;gap:' + G + 'px">' +
        NAMES.map(function (nm, i) { return '<div class="cd" style="flex:none;height:110px;box-sizing:border-box;border-radius:10px;border:1px solid var(--u-line);background:var(--u-panel);padding:10px;display:grid;align-content:space-between"><b>' + nm + '</b>' + fakes(2) + '<span style="font-family:var(--u-mono);font-size:11px;color:var(--u-muted)">' + (i + 1) + ' / 6</span></div>'; }).join('') +
      '</div></div><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="u-btn pv" aria-label="이전">‹</button><button type="button" class="u-btn nx" aria-label="다음">›</button></div></div>';
    var vp = st.querySelector('.vp'), row = st.querySelector('.row'), cds = st.querySelectorAll('.cd'), nx = st.querySelector('.nx'), cur = cursor(st);
    return { ms: MS, rest: 0.95, at: function (t) {
      var ms = t * MS, see = vp.clientWidth - 28, W = Math.max(80, see - peek - G), step = W + G;
      cds.forEach(function (cd) { cd.style.width = W + 'px'; });
      var maxX = 6 * W + 5 * G - see;
      // 두 번 밀고 놓은 뒤, › 단추로 한 장. 자유면 미는 힘만큼 더 흐른다
      var a1 = 0.6, a2 = a1 + (snap ? 0.4 : 0.35), b2 = a2 + 1.6, b3 = snap ? 3 : b2 + 0.35, c3 = b3 + 1, x;
      if (ms < 400) x = 0;
      else if (ms < 1000) x = a1 * seg(ms, 400, 1000);
      else if (ms < 1700) x = lerp(a1, a2, ease.out(seg(ms, 1000, snap ? 1300 : 1500)));
      else if (ms < 2300) x = lerp(a2, b2, seg(ms, 1700, 2300));
      else if (ms < 2900) x = lerp(b2, b3, ease.out(seg(ms, 2300, snap ? 2600 : 2800)));
      else x = lerp(b3, c3, ease.inOut(seg(ms, 2900, 3250)));
      x = Math.min(maxX, x * step);
      row.style.transform = 'translateX(' + (-x) + 'px)';
      var r = rel(st, vp), dragging = (ms > 400 && ms < 1000) || (ms > 1700 && ms < 2300), cy = r.y + 55;
      if (ms < 1700) put(cur, lerp(r.x + see * 0.8, r.x + see * 0.8 - a1 * step, seg(ms, 400, 1000)), cy, dragging);
      else if (ms < 2600) put(cur, lerp(r.x + see * 0.95, r.x + see * 0.95 - 1.6 * step, seg(ms, 1700, 2300)), cy, dragging);
      else { var b = rel(st, nx); put(cur, b.x + b.w / 2, b.y + b.h / 2, ms > 2850 && ms < 2980); }
      cur.style.opacity = ms > 250 && ms < 3500 ? 1 : 0;
      return ms < 400 ? '다음 카드가 ' + peek + 'px 보임' : dragging ? '끌기' : ms < 2900 ? (snap ? '놓음 · 카드 앞머리에 맞춰 멈춤' : '놓음 · 미는 힘만큼 흐르다 멈춤') : '› 단추로 한 장';
    } };
  };

  S['scroll-progress'] = function (st, c) {
    var body = c.target === '본문만', MS = 3600;
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0;padding-top:34px">' +
      '<div class="ar" style="padding:12px 18px;display:grid;gap:9px"><b style="font-size:15px">휴대폰으로 화면 요청하는 법</b>' + fakes(16) + '</div>' +
      '<div style="padding:16px 18px;background:var(--u-side);border-top:1px solid var(--u-line);display:grid;gap:8px;font-size:12px;color:var(--u-muted)">바닥글' + fakes(6) + '</div></div>' +
      '<div style="position:absolute;left:0;right:0;top:0;height:34px;z-index:3;display:flex;align-items:center;padding:0 14px;background:var(--u-panel);border-bottom:1px solid var(--u-line);font-weight:700;font-size:12.5px">블로그</div>' +
      '<div class="pb" style="position:absolute;left:0;right:0;top:34px;height:' + (+c.height_px) + 'px;z-index:4;background:var(--u-accent);transform-origin:left;transform:scaleX(0)"></div>' + SBAR;
    var ct = st.querySelector('.ct'), ar = st.querySelector('.ar'), pb = st.querySelector('.pb');
    return { ms: MS, rest: 0.5, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.max(0, ct.scrollHeight - vh), y = maxS * scrollAlong([[300, 0], [3000, 1]], ms);
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      var end = body ? ar.offsetTop + ar.offsetHeight - vh : maxS, p = clamp(y / Math.max(1, end));
      pb.style.transform = 'scaleX(' + p + ')';
      return '읽은 만큼 ' + Math.round(p * 100) + '%' + (body && p >= 1 && y < maxS - 1 ? ' · 본문 끝에서 다 참(바닥글은 빼고)' : '');
    } };
  };

  /* ───── 움직임 › 화면 전환 (뷰 전환) ───── */
  function centerOf(st, el) { var r = rel(st, el); return [r.x + r.w / 2, r.y + r.h / 2]; }

  S['view-transition'] = function (st, c) {
    var slide = c.kind === '밀기', dur = +c.duration_ms, T1 = 600, T2 = T1 + dur + 900, MS = T2 + dur + 700;
    var PAGES = [['기능', '한 번에 정리되는 일정', 70], ['요금', '월 9,900원부터', 40], ['후기', '"팀 회의가 절반으로 줄었어요"', 20]];
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr">' +
      '<div style="display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid var(--u-line);background:var(--u-panel)">' + PAGES.map(function (p) { return '<button type="button" class="u-btn tb" style="padding:3px 12px">' + p[0] + '</button>'; }).join('') + '</div>' +
      '<div style="position:relative;overflow:hidden">' + PAGES.map(function (p) {
        return '<div class="pg" style="position:absolute;inset:0;padding:14px;display:grid;gap:8px;align-content:start"><b style="font-size:17px">' + esc(p[1]) + '</b>' +
          '<div style="height:70px;border-radius:10px;background:color-mix(in srgb, var(--u-accent) ' + p[2] + '%, var(--u-accent-soft))"></div>' + fakes(3) + '</div>';
      }).join('') + '</div></div>';
    var pgs = st.querySelectorAll('.pg'), tbs = st.querySelectorAll('.tb'), cur = cursor(st);
    return { ms: MS, rest: 0.5, at: function (t) {
      var ms = t * MS, from = ms < T2 ? 0 : 1, at = ms < T2 ? T1 : T2, p = ms < T1 ? 0 : ease.inOut(seg(ms, at, at + dur)), to = from + 1;
      if (ms < T1) { from = 0; to = -1; }
      pgs.forEach(function (pg, i) {
        var o = 0, x = 0;
        if (i === from) { o = slide ? 1 : 1 - p; x = slide ? -100 * p : 0; if (to < 0) o = 1; }
        else if (i === to) { o = slide ? 1 : p; x = slide ? 100 * (1 - p) : 0; }
        pg.style.opacity = o; pg.style.visibility = o > 0.001 && (x > -100 && x < 100) ? 'visible' : 'hidden'; pg.style.transform = x ? 'translateX(' + x + '%)' : '';
      });
      var active = ms < T1 ? 0 : ms < T2 ? 1 : 2;
      tbs.forEach(function (b, i) { b.style.fontWeight = i === active ? 700 : 400; b.style.borderColor = i === active ? 'var(--u-accent)' : ''; });
      var target = ms < T1 + 200 ? tbs[1] : tbs[2], xy = centerOf(st, target);
      put(cur, xy[0], xy[1], (ms > T1 - 120 && ms < T1) || (ms > T2 - 120 && ms < T2));
      cur.style.opacity = ms > 250 && ms < T2 + 300 ? 1 : 0;
      var moving = ms >= T1 && (ms < T1 + dur || (ms >= T2 && ms < T2 + dur));
      return moving ? '전·후 화면을 찍어 ' + (slide ? '밀며' : '교차 페이드로') + ' 잇는 중' : PAGES[active][0] + ' 화면';
    } };
  };

  S['shared-element-transition'] = function (st, c) {
    var dur = +c.duration_ms, back = c.back === '돌아갈 때도', T1 = 600, T2 = T1 + dur + 1100, MS = T2 + dur + 700;
    var ITEMS = [['산책 가방', '39,000원', 30], ['캠핑 컵', '18,000원', 60], ['접이 의자', '54,000원', 85]];
    function photo(mix, cls, h) { return '<div class="' + cls + '" style="height:' + h + 'px;border-radius:8px;background:color-mix(in srgb, var(--u-accent) ' + mix + '%, var(--u-accent-soft))"></div>'; }
    st.innerHTML = '<div class="ls" style="position:absolute;inset:0;padding:14px;display:grid;gap:10px;align-content:start"><b style="font-size:14px">새로 나온 상품</b><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">' +
        ITEMS.map(function (it, i) { return '<div class="cd" style="display:grid;gap:5px;padding:8px;border:1px solid var(--u-line);border-radius:10px;background:var(--u-panel);font-size:12px">' + photo(it[2], 'ph', 62) + '<b>' + it[0] + '</b><span style="color:var(--u-muted)">' + it[1] + '</span></div>'; }).join('') + '</div>' + fakes(2) + '</div>' +
      '<div class="dt" style="position:absolute;inset:0;padding:14px;display:grid;gap:8px;align-content:start;background:var(--u-bg)"><span><button type="button" class="u-btn bk" style="padding:2px 10px">← 목록</button></span>' + photo(ITEMS[1][2], 'big', 100) +
        '<b style="font-size:16px">' + ITEMS[1][0] + ' <span style="font-weight:400;color:var(--u-muted);font-size:13px">' + ITEMS[1][1] + '</span></b>' + fakes(2) + '</div>' +
      '<div class="mv" style="position:absolute;z-index:4;border-radius:8px;background:color-mix(in srgb, var(--u-accent) ' + ITEMS[1][2] + '%, var(--u-accent-soft))"></div>';
    var ls = st.querySelector('.ls'), dt = st.querySelector('.dt'), mv = st.querySelector('.mv'), card = st.querySelectorAll('.cd')[1], small = st.querySelectorAll('.ph')[1], big = st.querySelector('.big'), bk = st.querySelector('.bk'), cur = cursor(st);
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS, a = rel(st, small), b = rel(st, big);
      // d: 상세 쪽으로 간 정도 (0 목록, 1 상세). 뒤로는 되돌아가거나 바로
      var d = ms < T1 ? 0 : ms < T2 ? ease.inOut(seg(ms, T1, T1 + dur)) : back ? 1 - ease.inOut(seg(ms, T2, T2 + dur)) : 0;
      var moving = (ms >= T1 && ms < T1 + dur) || (back && ms >= T2 && ms < T2 + dur);
      ls.style.opacity = 1 - d; ls.style.visibility = d < 0.999 ? 'visible' : 'hidden';
      dt.style.opacity = d; dt.style.visibility = d > 0.001 ? 'visible' : 'hidden';
      small.style.visibility = moving || d > 0.5 ? 'hidden' : 'visible'; big.style.visibility = moving ? 'hidden' : 'visible';
      mv.style.display = moving ? 'block' : 'none';
      if (moving) { mv.style.left = lerp(a.x, b.x, d) + 'px'; mv.style.top = lerp(a.y, b.y, d) + 'px'; mv.style.width = lerp(a.w, b.w, d) + 'px'; mv.style.height = lerp(a.h, b.h, d) + 'px'; }
      var tgt = ms < T1 + 300 ? card : bk, xy = centerOf(st, tgt);
      put(cur, xy[0], xy[1], (ms > T1 - 120 && ms < T1) || (ms > T2 - 120 && ms < T2));
      cur.style.opacity = ms > 250 && ms < T2 + 300 && (ms < T1 + 50 || ms > T1 + dur + 300) ? 1 : 0;
      return moving ? '같은 사진이 자리와 크기를 옮기는 중' : ms < T1 ? '목록' : ms < T2 ? '상세 · 사진이 이어짐' : back ? '목록 · 사진이 제자리로 돌아옴' : '목록 · 바로 바뀜';
    } };
  };

  S['entry-animation'] = function (st, c) {
    var dur = +c.duration_ms, up = c.from === '아래에서', exit = c.exit === '닫을 때도', T1 = 600, T2 = T1 + dur + 1200, MS = T2 + dur + 700;
    st.innerHTML = '<div class="u-pad" style="gap:10px"><b style="font-size:15px">매주 새 소식</b>' + fakes(2) + '<div style="position:relative;justify-self:start"><button type="button" class="u-btn primary op">새 소식 받기</button>' +
      '<div class="pn" style="display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:3;width:260px;max-width:calc(100vw - 60px);padding:12px;border:1px solid var(--u-line);border-radius:12px;background:var(--u-panel);box-shadow:var(--u-shadow)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>소식 구독</b><button type="button" class="u-icon x" aria-label="닫기">×</button></div>' +
        '<div style="margin-top:8px;border:1px solid var(--u-line);border-radius:6px;padding:5px 8px;color:var(--u-muted);font-size:12.5px">이메일</div></div></div>' + fakes(3) + '</div>';
    var pn = st.querySelector('.pn'), op = st.querySelector('.op'), x = st.querySelector('.x'), cur = cursor(st);
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, open = ms >= T1 && ms < T2, p = open ? ease.out(seg(ms, T1, T1 + dur)) : exit && ms >= T2 ? 1 - ease.inOut(seg(ms, T2, T2 + dur)) : 0;
      pn.style.display = p > 0.001 || open ? 'block' : 'none';
      pn.style.opacity = p;
      pn.style.transform = up ? 'translateY(' + (8 * (1 - p)) + 'px)' : 'scale(' + lerp(0.96, 1, p) + ')';
      var xy = centerOf(st, ms < T1 + 300 || pn.style.display === 'none' ? op : x);
      put(cur, xy[0], xy[1], (ms > T1 - 120 && ms < T1) || (ms > T2 - 120 && ms < T2));
      cur.style.opacity = ms > 250 && ms < T2 + 200 ? 1 : 0;
      return ms < T1 ? 'display: none' : open ? (p < 1 ? '생겨남 · @starting-style 모습에서 들어오는 중' : '열림') : p > 0 ? 'allow-discrete로 끝까지 보이며 사라지는 중' : exit ? '닫힘' : '닫힘 · 바로 사라짐';
    } };
  };

  /* ───── 표현 › 글자 효과, 움직임 › 흐르기 (소개·랜딩) ───── */
  function prand(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  // 5초 넘게 스스로 움직이는 예시의 멈춤 단추 (WCAG 2.2.2)
  var PZ_ICON = { stop: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="1.5" y="1" width="2.5" height="8"/><rect x="6" y="1" width="2.5" height="8"/></svg>', play: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>' };
  var PAUSE = '<button type="button" class="u-btn pz" style="position:absolute;right:12px;bottom:12px;z-index:3;padding:2px 10px;font-size:12px;gap:5px">' + PZ_ICON.stop + '멈춤</button>';
  function pzLabel(b, stopped) { var k = stopped ? 'play' : 'stop'; if (b.getAttribute('data-k') !== k) { b.setAttribute('data-k', k); b.innerHTML = PZ_ICON[k] + (stopped ? '재생' : '멈춤'); } }
  function secs(ms) { return (ms / 1000).toFixed(1) + '초'; }

  S['text-split-reveal'] = function (st, c) {
    var unit = c.unit, gap = +c.stagger_ms, mask = c.mask === '가림 틀 안에서', LINES = ['화면을 이름으로 부르면', 'AI가 알아듣는다'], n = 0;
    function piece(s) { return '<span class="pc" style="display:inline-block;white-space:pre">' + esc(s) + '</span>'; }
    st.innerHTML = '<div class="u-pad" style="gap:12px;align-content:center"><div style="font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-0.01em">' + LINES.map(function (ln) {
      var parts = unit === '줄' ? [ln] : unit === '단어' ? ln.split(/( )/) : ln.split('');
      return '<div style="' + (mask ? 'overflow:hidden;' : '') + 'padding-bottom:2px">' + parts.map(function (p) { return p === ' ' ? ' ' : piece(p); }).join('') + '</div>';
    }).join('') + '</div><span style="color:var(--u-muted)">용어 이름 하나로 요청이 짧아집니다</span></div>';
    var pcs = st.querySelectorAll('.pc'); n = pcs.length;
    var DUR = 500, MS = 300 + (n - 1) * gap + DUR + 700;
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, done = 0;
      pcs.forEach(function (pc, i) {
        var p = ease.out(seg(ms, 300 + i * gap, 300 + i * gap + DUR));
        if (mask) { pc.style.transform = 'translateY(' + (105 * (1 - p)) + '%)'; pc.style.opacity = ''; }
        else { pc.style.transform = 'translateY(' + (12 * (1 - p)) + 'px)'; pc.style.opacity = p; }
        if (p > 0.5) done++;
      });
      return '조각 ' + n + '개 중 ' + done + '개 드러남';
    } };
  };

  S['text-scramble'] = function (st, c) {
    var dur = +c.duration_ms, SET = { '기호': '#%&*@$!?', '영문 대문자': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '숫자': '0123456789' }[c.chars], TEXT = '이름으로 만든 화면', MS = 300 + dur + 1200;
    st.innerHTML = '<div class="u-pad" style="gap:10px;align-content:center;justify-items:start"><span style="font-size:12px;color:var(--u-muted)">오늘의 표어</span>' +
      '<div class="tx" aria-label="' + TEXT + '" style="font-size:26px;font-weight:800;white-space:nowrap">' + TEXT.split('').map(function (ch) { return '<span style="display:inline-block;width:' + (ch === ' ' ? '0.35em' : '1em') + ';text-align:center"></span>'; }).join('') + '</div>' +
      '<span style="font-size:12px;color:var(--u-muted)">글자 칸 폭을 1em으로 고정해 줄이 흔들리지 않습니다</span></div>';
    var cells = st.querySelectorAll('.tx span');
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, p = seg(ms, 300, 300 + dur), fixed = Math.floor(p * TEXT.length + 0.0001), frame = Math.floor(ms / 50);
      cells.forEach(function (cell, i) {
        var ch = TEXT[i];
        cell.textContent = ch === ' ' || i < fixed ? ch : SET[Math.floor(prand(i, frame) * SET.length)];
        cell.style.color = i < fixed ? '' : 'var(--u-muted)';
      });
      return p >= 1 ? '맞춰짐 · 한 번만' : ms < 300 ? '섞이기 전' : '앞에서부터 ' + fixed + '/' + TEXT.length + '자 맞춰짐';
    } };
  };

  S['shine-text'] = function (st, c) {
    var sp = +c.speed_ms, GAP = 800, cyc = sp + GAP, auto = c.repeat === '5초 안에 멈춤', MS = 7000, PZ = 5600;
    var rounds = auto ? Math.max(1, Math.floor(5000 / cyc)) : Infinity;
    st.innerHTML = '<div class="u-pad" style="gap:10px;align-content:center"><span style="font-size:12px;color:var(--u-muted)">새로 나왔어요</span>' +
      '<div style="font-size:24px;font-weight:800;line-height:1.3">부품마다 <span class="sh" style="background-image:linear-gradient(100deg, var(--u-ink) 0 42%, var(--u-accent) 50%, var(--u-ink) 58% 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent">이름표 보기</span></div>' + fakes(2) + '</div>' + (auto ? '' : PAUSE);
    var sh = st.querySelector('.sh'), pz = st.querySelector('.pz'), cur = cursor(st);
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, end = auto ? rounds * cyc : PZ, live = Math.min(ms, end), k = Math.floor(live / cyc), q = seg(live - k * cyc, 0, sp);
      if (ms >= end) q = 0;
      sh.style.backgroundPosition = (100 - q * 100) + '% 0';
      if (pz) {
        var r = rel(st, pz); put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > PZ - 120 && ms < PZ);
        cur.style.opacity = ms > PZ - 700 && ms < PZ + 500 ? 1 : 0;
        pzLabel(pz, ms >= PZ);
      } else cur.style.opacity = 0;
      return secs(ms) + ' · ' + (ms < end ? (k + 1) + '번째 지나감' : auto ? rounds + '번 지나고 5초 안에 멈춤' : '멈춤 단추로 멈춤');
    } };
  };

  S['typewriter'] = function (st, c) {
    var sp = +c.speed_ms, loop = c.loop === '여러 문구 돌리기', HEAD = 'AI에게 맡기세요: ', WORDS = ['회의록 정리', '기획서 초안', '화면 만들기'], ONE = '이름으로 요청하면 화면이 맞게 나와요';
    var DEL = 30, HOLD = 900, PZ = 6200, MS = loop ? 7200 : 400 + ONE.length * sp + 1600;
    st.innerHTML = '<div class="u-pad" style="gap:10px;align-content:center"><b style="font-size:20px">작은 팀의 화면 도구</b>' +
      '<div style="font-size:16px;min-height:3em" aria-label="' + (loop ? HEAD + WORDS.join(', ') : ONE) + '"><span class="tw"></span><span class="cr" style="display:inline-block;width:2px;height:1.1em;background:var(--u-accent);vertical-align:-3px;margin-left:1px"></span></div>' + fakes(2) + '</div>' + (loop ? PAUSE : '');
    var tw = st.querySelector('.tw'), cr = st.querySelector('.cr'), pz = st.querySelector('.pz'), cur = cursor(st);
    // 돌리기: 문구마다 치기 → 머묾 → 지우기
    function loopText(ms) {
      var m = ms - 400; if (m < 0) return HEAD;
      for (var k = 0; ; k = (k + 1) % WORDS.length) {
        var w = WORDS[k], typeT = w.length * sp, delT = w.length * DEL, all = typeT + HOLD + delT + 200;
        if (m < typeT) return HEAD + w.slice(0, Math.floor(m / sp));
        if (m < typeT + HOLD) return HEAD + w;
        if (m < typeT + HOLD + delT) return HEAD + w.slice(0, w.length - Math.floor((m - typeT - HOLD) / DEL));
        if (m < all) return HEAD;
        m -= all;
      }
    }
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, live = loop ? Math.min(ms, PZ) : ms;
      tw.textContent = loop ? loopText(live) : ONE.slice(0, Math.max(0, Math.floor((ms - 400) / sp)));
      var typing = loop ? ms < PZ : tw.textContent.length < ONE.length;
      cr.style.opacity = typing || Math.floor(ms / 500) % 2 ? 1 : 0;
      if (pz) {
        var r = rel(st, pz); put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > PZ - 120 && ms < PZ);
        cur.style.opacity = ms > PZ - 700 && ms < PZ + 500 ? 1 : 0;
        pzLabel(pz, ms >= PZ);
      } else cur.style.opacity = 0;
      return loop ? secs(ms) + (ms >= PZ ? ' · 멈춤 단추로 멈춤' : ' · 문구 돌리는 중') : typing ? '치는 중 ' + tw.textContent.length + '/' + ONE.length + '자' : '다 침 · 커서만 깜빡임';
    } };
  };

  S['marquee'] = function (st, c) {
    var v = +c.speed_px, btn = c.stop === '멈춤 단추', LOGOS = ['물류온', '케어노트', '학원24', '카페큐', '공방로그', '책방길'], H0 = 1600, H1 = 2600, PZ = 5600, MS = 6800;
    function set() { return '<div class="set" style="display:flex;gap:10px;padding-right:10px;flex:none">' + LOGOS.map(function (l) { return '<span style="flex:none;padding:8px 14px;border:1px solid var(--u-line);border-radius:999px;background:var(--u-panel);font-weight:700;font-size:13px;color:var(--u-muted)">' + l + '</span>'; }).join('') + '</div>'; }
    st.innerHTML = '<div class="u-pad" style="gap:12px;align-content:center"><b style="font-size:15px;text-align:center">이런 팀이 쓰고 있어요</b>' +
      '<div class="vp" style="overflow:hidden;margin:0 -14px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)"><div class="row" style="display:flex;width:max-content">' + set() + set() + '</div></div>' + fakes(2) + '</div>' + (btn ? PAUSE : '');
    var vp = st.querySelector('.vp'), row = st.querySelector('.row'), one = st.querySelector('.set'), pz = st.querySelector('.pz'), cur = cursor(st);
    return { ms: MS, rest: 0.2, at: function (t) {
      var ms = t * MS, end = btn ? PZ : 5000;
      // 흐른 시간: 마우스를 올린 동안과 멈춘 뒤는 빼고 센다
      var run = Math.min(ms, end) - Math.max(0, Math.min(ms, H1) - H0), W = one.offsetWidth;
      row.style.transform = 'translateX(' + (-((run * v / 1000) % W)) + 'px)';
      var r = rel(st, vp), hover = ms >= H0 && ms < H1;
      if (ms < PZ - 700 || !btn) put(cur, r.x + r.w / 2, r.y + r.h / 2, false);
      else { var b = rel(st, pz); put(cur, b.x + b.w / 2, b.y + b.h / 2, ms > PZ - 120 && ms < PZ); }
      cur.style.opacity = (ms > H0 - 300 && ms < H1 + 200) || (btn && ms > PZ - 700 && ms < PZ + 500) ? 1 : 0;
      if (pz) pzLabel(pz, ms >= PZ);
      return secs(ms) + ' · ' + (hover ? '마우스를 올려 멈춤' : ms < end ? '흐르는 중' : btn ? '멈춤 단추로 멈춤' : '5초 지나 스스로 멈춤');
    } };
  };

  /* ───── 표현 › 색·효과 › 배경·질감 (소개·랜딩) ───── */
  function heroText(title, sub, btn) {
    return '<div style="position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:8px;text-align:center;padding:16px">' +
      '<b style="font-size:20px">' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + (btn ? '<button type="button" class="u-btn primary">' + btn + '</button>' : '') + '</div>';
  }

  S['aurora-gradient'] = function (st, c) {
    var n = +c.blobs, move = c.motion === '천천히 움직임', PZ = 5600, MS = move ? 7000 : 2000;
    var COL = ['var(--u-accent)', 'var(--u-ok)', 'var(--u-warn)', 'var(--u-info)'], POS = [[15, 20], [70, 15], [40, 70], [85, 75]];
    st.innerHTML = '<div style="position:absolute;inset:0;overflow:hidden;background:var(--u-panel)">' + POS.slice(0, n).map(function (p, i) {
      return '<i class="bl" style="position:absolute;left:' + p[0] + '%;top:' + p[1] + '%;width:55%;aspect-ratio:1;margin:-27% 0 0 -27%;border-radius:50%;background:' + COL[i] + ';opacity:0;filter:blur(40px)"></i>';
    }).join('') + heroText('지금 무료로 시작하기', '카드 등록 없이 14일', '시작하기') + '</div>' + (move ? PAUSE : '');
    var bls = st.querySelectorAll('.bl'), pz = st.querySelector('.pz'), cur = cursor(st);
    return { ms: MS, rest: move ? 0.4 : 1, at: function (t) {
      var ms = t * MS, live = move ? Math.min(ms, PZ) : 0;
      bls.forEach(function (b, i) {
        b.style.opacity = 0.45 * seg(ms, 0, 600);
        b.style.transform = move ? 'translate(' + (Math.sin(live / 900 + i * 2) * 30) + 'px,' + (Math.cos(live / 1100 + i) * 20) + 'px)' : '';
      });
      if (pz) {
        var r = rel(st, pz); put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > PZ - 120 && ms < PZ);
        cur.style.opacity = ms > PZ - 700 && ms < PZ + 500 ? 1 : 0;
        pzLabel(pz, ms >= PZ);
      } else cur.style.opacity = 0;
      return move ? secs(ms) + (ms < PZ ? ' · 덩어리가 transform으로만 떠다님(예시는 빠르게)' : ' · 멈춤 단추로 멈춤') : '정지 · 한 번 흐리게 그리고 끝';
    } };
  };

  S['grain'] = function (st, c) {
    var fine = c.size === '고움', MS = 3000;
    st.innerHTML = '<div style="position:absolute;inset:0;background:linear-gradient(135deg, var(--u-accent-soft), color-mix(in srgb, var(--u-accent) 55%, var(--u-accent-soft)))"></div>' +
      '<div class="gr" style="position:absolute;inset:0;pointer-events:none;background-size:' + (fine ? 160 : 320) + 'px;opacity:' + (+c.opacity_pct / 100) + '"></div>' +
      '<div class="ln" style="position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--u-ink);opacity:.4"></div>' +
      '<span class="u-kbd" style="position:absolute;left:12px;top:10px;font-size:11px">잡음 없음</span><span class="u-kbd" style="position:absolute;right:12px;top:10px;font-size:11px">잡음 ' + c.opacity_pct + '%</span>' +
      heroText('손으로 만든 듯한 화면', '', '');
    var gr = st.querySelector('.gr'), ln = st.querySelector('.ln');
    gr.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='" + (fine ? 0.9 : 0.45) + "' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='3 0 0 0 -1 3 0 0 0 -1 3 0 0 0 -1 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, x = lerp(100, 50, ease.inOut(seg(ms, 300, 1800)));
      gr.style.clipPath = 'inset(0 0 0 ' + x + '%)'; ln.style.left = x + '%'; ln.style.opacity = x > 99.9 ? 0 : 0.4;
      return x > 99.9 ? '매끈한 그라데이션' : '오른쪽만 잡음 타일 한 장을 반복해 덮음 · 움직이지 않음';
    } };
  };

  S['glass'] = function (st, c) {
    var b = +c.blur_px, MS = 3600;
    var BLOCKS = [['var(--u-accent)', '새 기능'], ['var(--u-ok)', '요금'], ['var(--u-warn)', '후기'], ['var(--u-info)', '자주 묻는 질문']];
    st.innerHTML = '<div class="ct" style="position:absolute;left:0;right:0;top:0;padding:52px 16px 16px;display:grid;gap:12px">' + BLOCKS.map(function (x) {
      return '<div style="height:70px;border-radius:12px;background:' + x[0] + ';display:flex;align-items:flex-end;padding:10px"><span style="background:var(--u-panel);border-radius:6px;padding:2px 8px;font-weight:700;font-size:12.5px">' + x[1] + '</span></div>';
    }).join('') + fakes(4) + '</div>' +
      '<div style="position:absolute;left:0;right:0;top:0;height:40px;z-index:3;display:flex;align-items:center;gap:12px;padding:0 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--u-line);background:color-mix(in srgb, var(--u-panel) ' + (+c.tint_pct) + '%, transparent);-webkit-backdrop-filter:blur(' + b + 'px);backdrop-filter:blur(' + b + 'px)">작업함<span style="margin-left:auto;font-weight:400">기능 · 요금 · 후기</span></div>' + SBAR;
    var ct = st.querySelector('.ct');
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, vh = st.clientHeight, maxS = Math.max(0, ct.scrollHeight - vh), y = maxS * scrollAlong([[300, 0], [3200, 1]], ms);
      ct.style.transform = 'translateY(' + (-y) + 'px)';
      scrollbar(st, y, vh, ct.scrollHeight);
      return y < 8 ? '유리 판 뒤가 비어 있음' : '판 뒤로 색이 지나가며 ' + b + 'px 흐리게 비침';
    } };
  };

  S['shader-background'] = function (st, c) {
    var lazy = c.start === '첫 입력 뒤', ON = lazy ? 1100 : 0, PZ = 5400, MS = 6600;
    st.innerHTML = '<canvas class="cv" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
      '<div style="position:absolute;inset:0;display:grid;align-content:center;gap:6px;padding:18px"><b style="font-size:21px">흐르는 화면, 가벼운 페이지</b><span>셰이더는 히어로 한 곳에만</span></div>' +
      '<span class="u-kbd tg" style="position:absolute;left:12px;bottom:12px;font-size:11px;background:var(--u-panel)"></span>' + PAUSE;
    var cv = st.querySelector('.cv'), tg = st.querySelector('.tg'), pz = st.querySelector('.pz'), cur = cursor(st);
    function rgb(v) { var e = document.createElement('i'); e.style.color = v; st.appendChild(e); var m = getComputedStyle(e).color.match(/[\d.]+/g).map(Number); e.remove(); return m; }
    var C0 = rgb('var(--u-bg)'), C1 = rgb('var(--u-accent-soft)'), C2 = rgb('var(--u-accent)');
    var W = Math.max(8, Math.round(96 * c.res_pct / 100)), H = Math.max(4, Math.round(W / 2)), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), last = -1;
    cv.width = W; cv.height = H;
    // 셰이더 흉내: 사인 세 개를 겹친 물결을 작은 캔버스에 그리고 늘려 보인다 (WebGL은 장면 여럿에 두지 않는다)
    function draw(time) {
      if (time === last) return; last = time;
      var s = time / 700, d = img.data;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var v = (Math.sin(x / W * 6 + s) + Math.sin(y / H * 5 - s * 0.7) + Math.sin((x / W + y / H) * 4 + s * 0.5)) / 3, k = (v + 1) / 2, o = (y * W + x) * 4;
        var a = k < 0.6 ? C0 : C1, b = k < 0.6 ? C1 : C2, q = k < 0.6 ? k / 0.6 : (k - 0.6) / 0.4 * 0.7;
        for (var j = 0; j < 3; j++) d[o + j] = a[j] + (b[j] - a[j]) * q;
        d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    return { ms: MS, rest: 0.5, at: function (t) {
      var ms = t * MS, running = ms >= ON && ms < PZ;
      draw(ms < ON ? 0 : Math.min(ms, PZ) - ON);
      tg.textContent = ms < ON ? '정지 이미지 · 첫 입력을 기다림' : running ? '켜짐 · ' + W + '×' + H + ' 점으로 그려 늘림' : '멈춤';
      var r = rel(st, pz);
      if (lazy && ms < ON + 200) { put(cur, st.clientWidth * 0.6, lerp(st.clientHeight * 0.35, st.clientHeight * 0.55, seg(ms, 600, 1000)), ms > 600 && ms < 1000); cur.style.opacity = ms > 400 ? 1 : 0; }
      else { put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > PZ - 120 && ms < PZ); cur.style.opacity = ms > PZ - 700 && ms < PZ + 500 ? 1 : 0; }
      pzLabel(pz, ms >= PZ);
      return secs(ms) + ' · ' + (ms < ON ? '정지 이미지(같은 색)' : running ? '셰이더 도는 중' : '멈춤 단추로 멈춤');
    } };
  };

  S['dot-grid'] = function (st, c) {
    var g = +c.gap_px, dots = c.kind === '점', MS = 2000;
    var bg = dots ? 'radial-gradient(circle, color-mix(in srgb, var(--u-muted) 60%, transparent) 1px, transparent 1.6px)' : 'linear-gradient(var(--u-line) 1px, transparent 1px), linear-gradient(90deg, var(--u-line) 1px, transparent 1px)';
    var mask = c.fade === '가장자리 흐림' ? '-webkit-mask-image:radial-gradient(ellipse at center, #000 30%, transparent 75%);mask-image:radial-gradient(ellipse at center, #000 30%, transparent 75%);' : '';
    st.innerHTML = '<div style="position:absolute;inset:0;background:var(--u-panel)"></div><div class="gd" style="position:absolute;inset:0;background-image:' + bg + ';background-size:' + g + 'px ' + g + 'px;background-position:center;' + mask + 'opacity:0"></div>' +
      heroText('화면을 이름으로', '용어 하나로 짧아지는 요청', '둘러보기');
    var gd = st.querySelector('.gd');
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS; gd.style.opacity = seg(ms, 200, 900);
      return ms < 200 ? '빈 배경' : (dots ? '점' : '격자 선') + ' ' + g + 'px 간격 · CSS 그라디언트 하나 · 한 번 그리고 끝';
    } };
  };

  S['border-beam'] = function (st, c) {
    var sp = +c.speed_s * 1000, once = c.stop === '한 바퀴만', PZ = 5600, MS = once ? sp + 1200 : 7000, end = once ? sp : PZ;
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-content:center">' + ['기본', '팀', '회사'].map(function (n, i) {
      var inner = '<div style="position:relative;z-index:1;height:100%;box-sizing:border-box;border-radius:11px;background:var(--u-panel);padding:10px;display:grid;gap:6px;align-content:start;font-size:12px">' +
        (i === 1 ? '<span class="u-pill p-prog" style="justify-self:start">추천</span>' : '<span style="height:20px"></span>') + '<b style="font-size:14px">' + n + '</b><span style="color:var(--u-muted)">' + ['무료', '월 9,900원', '문의'][i] + '</span>' + fakes(2) + '</div>';
      return i === 1 ? '<div style="position:relative;height:150px;border-radius:12px;padding:2px;overflow:hidden;background:var(--u-line)"><i class="rt" style="position:absolute;left:50%;top:50%;width:300%;aspect-ratio:1;margin:-150% 0 0 -150%;background:conic-gradient(transparent 0 250deg, color-mix(in srgb, var(--u-accent) 35%, transparent) 300deg, var(--u-accent) 352deg, transparent 360deg)"></i>' + inner + '</div>'
        : '<div style="height:150px;border-radius:12px;border:1px solid var(--u-line);overflow:hidden">' + inner + '</div>';
    }).join('') + '</div>' + (once ? '' : PAUSE);
    var rt = st.querySelector('.rt'), pz = st.querySelector('.pz'), cur = cursor(st);
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, a = 360 * Math.min(ms, end) / sp;
      rt.style.transform = 'rotate(' + a + 'deg)';
      if (pz) {
        var r = rel(st, pz); put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > PZ - 120 && ms < PZ);
        cur.style.opacity = ms > PZ - 700 && ms < PZ + 500 ? 1 : 0;
        pzLabel(pz, ms >= PZ);
      } else cur.style.opacity = 0;
      return secs(ms) + ' · ' + (ms < end ? '판이 rotate로 도는 중 · ' + Math.floor(a / 360 + 1) + '바퀴째' : once ? '한 바퀴 돌고 멈춤' : '멈춤 단추로 멈춤');
    } };
  };

  /* ───── 움직임 › 인터랙션 패턴 › 포인터 반응 (소개·랜딩) ───── */
  // 포인터 길 [[ms, x비율, y비율], ...]: 점 사이를 ease.inOut으로 잇는다 → [x, y] px
  function pathAt(P, ms, w, h) {
    var a = P[0], b = P[P.length - 1];
    if (ms <= a[0]) return [a[1] * w, a[2] * h];
    for (var i = 1; i < P.length; i++) if (ms < P[i][0]) { a = P[i - 1]; b = P[i]; var q = ease.inOut(seg(ms, a[0], b[0])); return [lerp(a[1], b[1], q) * w, lerp(a[2], b[2], q) * h]; }
    return [b[1] * w, b[2] * h];
  }

  S['magnetic-button'] = function (st, c) {
    var k = +c.strength_px, R = +c.range_px, MS = 3800, P = [[0, 0.08, 0.85], [700, 0.3, 0.62], [1300, 0.62, 0.36], [1900, 0.42, 0.62], [2500, 0.92, 0.15], [3200, 0.53, 0.52], [3800, 0.53, 0.52]];
    st.innerHTML = '<div class="rg" style="position:absolute;left:50%;top:50%;width:' + (2 * R) + 'px;height:' + (2 * R) + 'px;margin:' + (-R) + 'px 0 0 ' + (-R) + 'px;border:1px dashed var(--u-line);border-radius:50%"></div>' +
      '<span style="position:absolute;left:50%;top:calc(50% - ' + (R + 18) + 'px);transform:translateX(-50%);font-size:11px;color:var(--u-muted)">끌림 거리 ' + R + 'px</span>' +
      '<button type="button" class="u-btn primary mb" style="position:absolute;left:50%;top:50%;padding:8px 18px;font-size:14px;margin:-18px 0 0 -48px;width:96px;justify-content:center">시작하기</button>';
    var mb = st.querySelector('.mb'), cur = cursor(st);
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS, w = st.clientWidth, h = st.clientHeight, p = pathAt(P, ms, w, h), dx = p[0] - w / 2, dy = p[1] - h / 2, d = Math.hypot(dx, dy);
      // 둘레 안에서는 포인터 쪽으로, 경계 가까이에서는 0으로 줄어 튀지 않게
      var f = d < R ? clamp((R - d) / (R * 0.3)) : 0, ox = dx / R * k * f, oy = dy / R * k * f, press = ms > 3350 && ms < 3500;
      mb.style.transform = 'translate(' + ox + 'px,' + oy + 'px)' + (press ? ' scale(.97)' : '');
      put(cur, p[0], p[1], press);
      return d < R ? '둘레 안 · ' + Math.round(Math.hypot(ox, oy)) + 'px 끌려옴' + (press ? ' · 누름' : '') : '둘레 밖 · 제자리';
    } };
  };

  S['spotlight-hover'] = function (st, c) {
    var size = +c.size_px, all = c.scope === '카드 줄 전체', MS = 3600, P = [[0, 0.05, 0.9], [600, 0.18, 0.45], [1500, 0.5, 0.6], [2400, 0.82, 0.4], [3200, 0.97, 0.9]];
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-content:center">' + ['빠른 검색', '이름표 보기', '요청 복사'].map(function (n) {
      return '<div class="wr" style="height:140px;border-radius:12px;padding:1px;background:var(--u-line)"><div class="in" style="height:100%;box-sizing:border-box;border-radius:11px;padding:12px;display:grid;gap:6px;align-content:start;background:var(--u-panel)"><b style="font-size:13.5px">' + n + '</b>' + fakes(3) + '</div></div>';
    }).join('') + '</div>';
    var wrs = st.querySelectorAll('.wr'), cur = cursor(st);
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, w = st.clientWidth, h = st.clientHeight, p = pathAt(P, ms, w, h), on = -1;
      wrs.forEach(function (wr, i) {
        var r = rel(st, wr), x = p[0] - r.x, y = p[1] - r.y, inside = x >= 0 && y >= 0 && x <= r.w && y <= r.h, lit = inside || all;
        if (inside) on = i;
        var at = 'circle ' + (size / 2) + 'px at ' + x + 'px ' + y + 'px';
        wr.style.background = lit ? 'radial-gradient(' + at + ', var(--u-accent), var(--u-line))' : 'var(--u-line)';
        wr.firstChild.style.background = inside ? 'radial-gradient(' + at + ', color-mix(in srgb, var(--u-accent) 16%, var(--u-panel)), var(--u-panel))' : 'var(--u-panel)';
      });
      put(cur, p[0], p[1], false);
      return on < 0 ? '카드 밖' + (all ? ' · 가까운 테두리만 비침' : '') : (on + 1) + '번째 카드 위 · 빛이 포인터를 따라감';
    } };
  };

  S['tilt-3d'] = function (st, c) {
    var mx = +c.max_deg, glare = c.glare === '빛 반사', MS = 3600, P = [[0, 0.12, 0.88], [500, 0.36, 0.38], [1200, 0.64, 0.38], [1900, 0.64, 0.64], [2500, 0.36, 0.64], [2800, 0.5, 0.5], [3300, 0.95, 0.12]];
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;perspective:600px"><div class="cd" style="position:relative;width:200px;height:130px;border-radius:14px;border:1px solid var(--u-line);background:var(--u-panel);box-shadow:var(--u-shadow);padding:14px;display:grid;gap:6px;align-content:start;overflow:hidden">' +
      '<b style="font-size:15px">작업함 프로</b><span style="color:var(--u-muted);font-size:12px">월 9,900원</span>' + fakes(2) + '<i class="gl" style="position:absolute;inset:0;pointer-events:none"></i></div></div>';
    var cd = st.querySelector('.cd'), gl = st.querySelector('.gl'), cur = cursor(st);
    function rot(ms) {
      var w = st.clientWidth, h = st.clientHeight, p = pathAt(P, ms, w, h), r = rel(st, cd), nx = (p[0] - (r.x + r.w / 2)) / (r.w / 2), ny = (p[1] - (r.y + r.h / 2)) / (r.h / 2);
      return { p: p, inside: Math.abs(nx) <= 1 && Math.abs(ny) <= 1, rx: -ny * mx, ry: nx * mx, gx: (nx + 1) * 50, gy: (ny + 1) * 50 };
    }
    return { ms: MS, rest: 0.3, at: function (t) {
      cd.style.transform = '';
      var ms = t * MS, now = rot(ms), rx = now.rx, ry = now.ry, g = now.inside ? 1 : 0;
      // 카드를 벗어나면 마지막 기울기에서 0도로 돌아온다 (rel은 기울기와 상관없는 카드 틀로 잰다)
      if (!now.inside) {
        var last = null; for (var m = ms; m >= 0; m -= 20) { var o = rot(m); if (o.inside) { last = { m: m, o: o }; break; } }
        var back = last ? 1 - ease.out(seg(ms, last.m, last.m + 350)) : 0;
        rx = last ? last.o.rx * back : 0; ry = last ? last.o.ry * back : 0; g = back;
      }
      cd.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      gl.style.background = glare ? 'radial-gradient(circle at ' + now.gx + '% ' + now.gy + '%, color-mix(in srgb, var(--u-accent) 22%, rgb(255 255 255 / ' + (0.45 * g) + ')), transparent 60%)' : '';
      put(cur, now.p[0], now.p[1], false);
      return now.inside ? '기울기 ' + Math.round(Math.abs(rx)) + '° · ' + Math.round(Math.abs(ry)) + '° (최대 ' + mx + '°)' : g > 0.01 ? '벗어남 · 0도로 돌아오는 중' : '평평함';
    } };
  };

  S['cursor-follower'] = function (st, c) {
    var lag = +c.lag_ms, grow = c.grow === '링크 위에서 커짐', MS = 3600, P = null;
    st.innerHTML = '<div class="u-pad" style="gap:10px"><b style="font-size:16px">작은 팀의 화면 도구</b>' + fakes(3) + '<span style="justify-self:center;margin-top:16px"><button type="button" class="u-btn primary lk">둘러보기</button></span></div>' +
      '<i class="fw" style="position:absolute;left:0;top:0;width:16px;height:16px;border-radius:50%;border:2px solid var(--u-accent);background:color-mix(in srgb, var(--u-accent) 12%, transparent);pointer-events:none;z-index:19"></i>';
    var fw = st.querySelector('.fw'), lk = st.querySelector('.lk'), cur = cursor(st);
    return { ms: MS, rest: 0.7, at: function (t) {
      var ms = t * MS, w = st.clientWidth, h = st.clientHeight, r = rel(st, lk);
      // 단추 위에 잠시 머무는 길 (단추 자리는 무대 폭에 따라 다르다)
      if (!P) { var bx = (r.x + r.w / 2) / w, by = (r.y + r.h / 2) / h; P = [[0, 0.1, 0.85], [700, 0.35, 0.25], [1400, 0.75, 0.3], [2100, bx, by], [2700, bx, by], [3300, 0.15, 0.4]]; }
      var p = pathAt(P, ms, w, h), q = pathAt(P, ms - lag, w, h);
      var near = grow ? clamp(1 - Math.hypot(q[0] - (r.x + r.w / 2), q[1] - (r.y + r.h / 2)) / 70) : 0, s = 16 + 28 * near;
      fw.style.width = fw.style.height = s + 'px';
      fw.style.transform = 'translate(' + (q[0] - s / 2) + 'px,' + (q[1] - s / 2) + 'px)';
      put(cur, p[0], p[1], false);
      return '원은 ' + lag + 'ms 늦게 따라옴' + (near > 0.5 ? ' · 단추 위라 커짐' : '') + ' · 기본 커서는 그대로';
    } };
  };

  /* ───── 움직임 › 기본 움직임 › 기법 ───── */
  // 곡선 그림: f(0~1) → SVG 선. 0과 1에 기준선, 지금 점
  function curveSVG(w, h) {
    return '<svg class="cg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible;display:block">' +
      '<line x1="0" x2="' + w + '" y1="' + (h * 0.8) + '" y2="' + (h * 0.8) + '" style="stroke:var(--u-line)"/><line x1="0" x2="' + w + '" y1="' + (h * 0.2) + '" y2="' + (h * 0.2) + '" style="stroke:var(--u-line);stroke-dasharray:3 3"/>' +
      '<polyline class="c0" fill="none" style="stroke:var(--u-muted);stroke-width:1"/><polyline class="c1" fill="none" style="stroke:var(--u-accent);stroke-width:2"/><g class="pts"></g>' +
      '<circle class="dt" r="4" style="fill:var(--u-accent)"/></svg>';
  }
  function curvePts(f, w, h, n) { var s = []; for (var i = 0; i <= n; i++) { var p = i / n; s.push((p * w).toFixed(1) + ',' + (h * 0.8 - f(p) * h * 0.6).toFixed(1)); } return s.join(' '); }
  function springF(d, w) { return function (p) { return p >= 1 ? 1 : 1 - Math.exp(-d * p) * Math.cos(w * p); }; }
  function bounceF(p) { var n = 7.5625, k = 2.75; if (p < 1 / k) return n * p * p; if (p < 2 / k) return n * (p -= 1.5 / k) * p + 0.75; if (p < 2.5 / k) return n * (p -= 2.25 / k) * p + 0.9375; return n * (p -= 2.625 / k) * p + 0.984375; }

  S['flip'] = function (st, c) {
    var drop = c.change === '항목 빠짐', dur = +c.duration_ms, H = 34, T0 = 700, MS = T0 + 300 + dur + 900;
    var ROWS = [[31, '환불 금액 표시 오류', 3], [28, '사유 직접 입력 칸', 5], [27, '알림 메일 두 번 발송', 1], [25, '결제 수단 열 넣기', 4], [22, '정산 자동 재시도', 2]];
    var to = drop ? [0, -1, 1, 2, 3] : ROWS.map(function (r) { return r[2] - 1; });
    st.innerHTML = '<div class="u-pad" style="gap:8px"><div style="display:flex;justify-content:space-between;align-items:center"><b>이슈 목록</b><button type="button" class="u-btn sb">' + (drop ? '#28 닫기' : '우선순위순') + '</button></div>' +
      '<div style="position:relative;height:' + (ROWS.length * H) + 'px">' + ROWS.map(function (r) {
        return '<div class="rw" style="position:absolute;left:0;right:0;height:' + (H - 4) + 'px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid var(--u-line);border-radius:8px;background:var(--u-panel);font-size:12.5px"><span style="font-family:var(--u-mono);color:var(--u-muted)">#' + r[0] + '</span><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r[1] + '</span><span class="u-kbd">P' + r[2] + '</span></div>';
      }).join('') + '</div></div>';
    var rws = st.querySelectorAll('.rw'), sb = st.querySelector('.sb'), cur = cursor(st);
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, after = ms >= T0 + 300, play = ease.out(seg(ms, T0 + 300, T0 + 300 + dur));
      rws.forEach(function (rw, i) {
        var n = to[i];
        if (n < 0) { var o = 1 - seg(ms, T0, T0 + 150); rw.style.top = i * H + 'px'; rw.style.opacity = o; rw.style.visibility = o > 0 ? 'visible' : 'hidden'; rw.style.transform = ''; return; }
        // Last 자리(top)에 두고, Invert(처음 자리와의 차이)를 transform으로 되돌렸다가 Play로 0까지 푼다
        rw.style.top = (after ? n : i) * H + 'px';
        rw.style.transform = after ? 'translateY(' + ((i - n) * H * (1 - play)) + 'px)' : '';
      });
      var b = rel(st, sb); put(cur, b.x + b.w / 2, b.y + b.h / 2, ms > T0 - 120 && ms < T0);
      cur.style.opacity = ms > 300 && ms < T0 + 400 ? 1 : 0;
      return ms < T0 ? '처음 모습' : ms < T0 + 100 ? 'First · 처음 자리를 잼' : ms < T0 + 200 ? 'Last · 바뀐 뒤 새 자리를 잼' : ms < T0 + 300 ? 'Invert · 차이만큼 되돌려 그대로 보임' : play < 1 ? 'Play · transform을 0으로 푸는 중' : '새 자리에 도착';
    } };
  };

  S['spring'] = function (st, c) {
    var dur = +c.duration_ms, B = { '없음': [7, 0], '조금': [6, 9], '많이': [4.5, 16] }[c.bounce], f = springF(B[0], B[1]), T0 = 500, MS = T0 + dur + 900, GW = 150, GH = 110;
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:minmax(0,1fr) auto;gap:16px;align-content:center;align-items:center">' +
      '<div style="position:relative;height:150px;border:1px dashed var(--u-line);border-radius:10px;overflow:hidden"><div class="bx" style="position:absolute;left:14px;right:14px;top:40px;padding:10px 12px;border-radius:10px;background:var(--u-panel);border:1px solid var(--u-line);box-shadow:var(--u-shadow);font-size:12.5px"><b>저장했어요</b><div style="color:var(--u-muted)">변경 3건</div></div></div>' +
      '<div style="display:grid;gap:4px;font-size:11px;color:var(--u-muted)">' + curveSVG(GW, GH) + '<span>목표선(점선)을 지나쳤다 돌아옴</span></div></div>';
    var bx = st.querySelector('.bx'), dt = st.querySelector('.dt');
    st.querySelector('.c1').setAttribute('points', curvePts(f, GW, GH, 60));
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, p = seg(ms, T0, T0 + dur), v = f(p);
      bx.style.transform = 'translateY(' + (110 * (1 - v)) + 'px)';
      dt.setAttribute('cx', p * GW); dt.setAttribute('cy', GH * 0.8 - v * GH * 0.6);
      return ms < T0 ? '대기' : p < 1 ? '도착 정도 ' + Math.round(v * 100) + '%' + (v > 1.005 ? ' · 지나침' : '') : '멈춤';
    } };
  };

  S['linear-easing'] = function (st, c) {
    var n = +c.points, f = c.shape === '튕김' ? bounceF : springF(6, 9), T0 = 400, MS = T0 + 1200 + 800, GW = 200, GH = 120;
    var S2 = []; for (var i = 0; i < n; i++) S2.push(f(i / (n - 1)));
    function approx(p) { var x = p * (n - 1), i = Math.min(n - 2, Math.floor(x)); return lerp(S2[i], S2[i + 1], x - i); }
    st.innerHTML = '<div class="u-pad" style="grid-template-columns:auto minmax(0,1fr);gap:16px;align-content:center;align-items:center">' +
      '<div style="display:grid;gap:4px;font-size:11px;color:var(--u-muted)">' + curveSVG(GW, GH) + '<span>회색: 원래 곡선 · 파랑: linear() 점 ' + n + '개</span></div>' +
      '<div style="display:grid;gap:8px;font-size:12px"><code style="font-family:var(--u-mono);font-size:11px;color:var(--u-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">linear(' + S2.slice(0, 4).map(function (v) { return v.toFixed(2); }).join(', ') + ', …)</code>' +
      '<div style="position:relative;height:30px;border-bottom:1px solid var(--u-line)"><i class="bl" style="position:absolute;left:0;bottom:2px;width:22px;height:22px;border-radius:50%;background:var(--u-accent)"></i></div></div></div>';
    var bl = st.querySelector('.bl'), dt = st.querySelector('.dt');
    st.querySelector('.c0').setAttribute('points', curvePts(f, GW, GH, 120));
    st.querySelector('.c1').setAttribute('points', curvePts(approx, GW, GH, (n - 1) * 4));
    st.querySelector('.pts').innerHTML = S2.map(function (v, i) { return '<circle r="2" cx="' + (i / (n - 1) * GW) + '" cy="' + (GH * 0.8 - v * GH * 0.6) + '" style="fill:var(--u-accent)"/>'; }).join('');
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, p = seg(ms, T0, T0 + 1200), v = approx(p), track = bl.parentNode.clientWidth - 22;
      bl.style.transform = 'translateX(' + (v * track) + 'px)';
      dt.setAttribute('cx', p * GW); dt.setAttribute('cy', GH * 0.8 - v * GH * 0.6);
      return ms < T0 ? '대기' : p < 1 ? '점 사이를 곧게 이어 곡선을 흉내 냄 · ' + Math.round(p * 100) + '%' : '도착 · 점이 많을수록 원래 곡선에 가깝다';
    } };
  };

  S['web-animations-api'] = function (st, c) {
    var dur = +c.duration_ms, act = c.action, T0 = 500, MS = T0 + { '되감기': dur * 1.2, '멈춤': dur + 700, '속도 2배': dur * 0.7 }[act] + 900;
    var CODE = { '되감기': 'a.reverse()', '멈춤': 'a.pause() … a.play()', '속도 2배': 'a.playbackRate = 2' }[act];
    // 진행 정도(0~1)와 그때 줄: 시작 → 도중에 할 일 → 끝
    function prog(ms) {
      var m = ms - T0;
      if (m < 0) return [0, 0];
      if (act === '되감기') { var M = dur * 0.6; return m < M ? [m / dur, 1] : [Math.max(0, 0.6 - (m - M) / dur), m - M < M ? 2 : 3]; }
      if (act === '멈춤') { var h = dur / 2; return m < h ? [m / dur, 1] : m < h + 700 ? [0.5, 2] : [Math.min(1, 0.5 + (m - h - 700) / dur), m - h - 700 < h ? 2 : 3]; }
      var q = dur * 0.4; return m < q ? [m / dur, 1] : [Math.min(1, 0.4 + (m - q) * 2 / dur), m - q < dur * 0.3 ? 2 : 3];
    }
    st.innerHTML = '<div style="position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr)">' +
      '<div style="padding:14px;display:grid;gap:6px;align-content:start;font-family:var(--u-mono);font-size:11px;overflow:hidden;min-width:0">' +
        '<span style="color:var(--u-muted)">// frames: translateX 100% → 0</span><span class="l1">const a = el.animate(<br>&nbsp;&nbsp;frames, { duration: ' + dur + ' })</span><span class="l2">' + CODE + '</span><span class="l3">await a.finished</span>' +
        '<div style="margin-top:8px;height:6px;border-radius:3px;background:var(--u-line);overflow:hidden"><i class="pg" style="display:block;height:100%;background:var(--u-accent);transform-origin:left"></i></div><span class="ct" style="color:var(--u-muted)"></span></div>' +
      '<div style="position:relative;overflow:hidden;border-left:1px solid var(--u-line)">' + '<div style="padding:14px;display:grid;gap:8px">' + fakes(5) + '</div>' +
        '<div class="dr" style="position:absolute;top:0;bottom:0;right:0;width:80%;background:var(--u-panel);border-left:1px solid var(--u-line);box-shadow:var(--u-shadow);padding:12px;display:grid;gap:8px;align-content:start;font-size:12.5px"><b>연결 이슈</b>' + fakes(3) + '</div></div></div>';
    var dr = st.querySelector('.dr'), pg = st.querySelector('.pg'), ct = st.querySelector('.ct'), ls = [st.querySelector('.l1'), st.querySelector('.l2'), st.querySelector('.l3')];
    return { ms: MS, rest: 1, at: function (t) {
      var ms = t * MS, r = prog(ms), v = ease.out(r[0]);
      dr.style.transform = 'translateX(' + (100 * (1 - v)) + '%)';
      pg.style.transform = 'scaleX(' + r[0] + ')';
      ct.textContent = 'currentTime ' + Math.round(r[0] * dur) + ' / ' + dur + 'ms';
      ls.forEach(function (l, i) { l.style.color = r[1] === i + 1 ? 'var(--u-accent)' : ''; l.style.fontWeight = r[1] === i + 1 ? 700 : 400; });
      return r[1] === 0 ? '대기' : r[1] === 1 ? 'animate()로 시작' : r[1] === 2 ? CODE : act === '되감기' ? '되감겨 처음 자리로' : '끝 · finished로 다음 일';
    } };
  };

  /* ───── 신청·설정 묶음 ───── */
  var FIELD = 'border:1px solid var(--u-line);border-radius:var(--u-r);background:var(--u-panel);padding:7px 10px;font-size:13.5px;min-height:34px;position:relative';
  function caretHTML() { return '<span style="display:inline-block;width:1.5px;height:1em;background:var(--u-accent);vertical-align:-2px;margin-left:1px"></span>'; }
  function typed(text, ms, a, b) { return text.slice(0, Math.max(0, Math.min(text.length, Math.floor((ms - a) / ((b - a) / text.length))))); }

  S['stepper'] = function (st, c) {
    var vertical = c.direction === '세로', clickable = c.clickable === '지난 단계 누르기', names = ['기본 정보', '첨부', '확인'];
    st.innerHTML = '<div class="u-pad" style="gap:16px"><div class="sp" style="display:flex;' + (vertical ? 'flex-direction:column;align-items:flex-start' : 'align-items:center') + ';gap:6px">' +
      names.map(function (n, i) {
        return (i ? '<span class="ln" style="position:relative;' + (vertical ? 'width:2px;height:22px;margin-left:12px' : 'flex:1;height:2px;min-width:20px') + ';background:var(--u-line);border-radius:2px;overflow:hidden"><i style="position:absolute;inset:0;background:var(--u-accent);transform-origin:' + (vertical ? 'top' : 'left') + '"></i></span>' : '') +
          '<span class="st" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;white-space:nowrap"><b class="dot" style="width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;border:2px solid var(--u-line);background:var(--u-panel)">' + (i + 1) + '</b><span class="nm">' + n + '</span></span>';
      }).join('') + '</div><div class="bd" style="display:grid;gap:8px"></div></div>';
    var sts = st.querySelectorAll('.st'), lns = st.querySelectorAll('.ln i'), bd = st.querySelector('.bd'), cur = cursor(st), last = -1;
    return { ms: 3200, rest: 0.4, at: function (t) {
      var ms = t * 3200, now = ms < 700 ? 0 : ms < 1600 ? 1 : 2;
      if (clickable && ms >= 2500) now = 0;
      sts.forEach(function (s, i) {
        var dot = s.querySelector('.dot');
        var state = i < now ? 'done' : i === now ? 'cur' : 'todo';
        if (clickable && ms >= 2500 && i === 1) state = 'done';
        dot.textContent = state === 'done' ? '✓' : i + 1;
        dot.style.background = state === 'done' ? 'var(--u-accent)' : 'var(--u-panel)';
        dot.style.color = state === 'done' ? 'var(--u-accent-ink)' : state === 'cur' ? 'var(--u-accent)' : 'var(--u-muted)';
        dot.style.borderColor = state === 'todo' ? 'var(--u-line)' : 'var(--u-accent)';
        s.querySelector('.nm').style.fontWeight = state === 'cur' ? '700' : '400';
        s.querySelector('.nm').style.color = state === 'todo' ? 'var(--u-muted)' : 'var(--u-ink)';
      });
      lns[0].style.transform = (vertical ? 'scaleY(' : 'scaleX(') + ease.out(seg(ms, 700, 1000)) + ')';
      lns[1].style.transform = (vertical ? 'scaleY(' : 'scaleX(') + ease.out(seg(ms, 1600, 1900)) + ')';
      if (now !== last) { bd.innerHTML = '<b style="font-size:13px">' + names[now] + '</b>' + fakes(3 + now); last = now; }
      var r = rel(st, sts[0].querySelector('.dot'));
      put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > 2400 && ms < 2550);
      cur.style.opacity = ms > 2100 ? 1 : 0;
      return ms < 2400 ? (now + 1) + '단계' : clickable ? '1단계 눌러 돌아감' : '눌러도 돌아가지 않음';
    } };
  };

  S['text-field'] = function (st, c) {
    var floating = c.label === 'Floating Label', help = c.help === '아래 도움말', word = '환불 사유 기타';
    st.innerHTML = '<div class="u-pad" style="gap:6px;max-width:340px">' + (floating ? '' : '<span class="lb" style="font-size:12.5px;font-weight:600">제목</span>') +
      '<div class="fd" style="' + FIELD + (floating ? ';padding-top:16px;min-height:44px' : '') + '">' + (floating ? '<span class="fl" style="position:absolute;left:10px;top:12px;color:var(--u-muted);transform-origin:left top;transition:none">제목</span>' : '') + '<span class="tx"></span></div>' +
      '<span class="hp" style="font-size:12px;color:var(--u-muted);min-height:18px"></span>' + fakes(3) + '</div>';
    var fd = st.querySelector('.fd'), tx = st.querySelector('.tx'), hp = st.querySelector('.hp'), fl = st.querySelector('.fl');
    return { ms: 3200, rest: 0.3, at: function (t) {
      var ms = t * 3200, focus = (ms >= 400 && ms < 1800) || ms >= 2300, v = '';
      if (ms >= 600 && ms < 1300) v = typed(word, ms, 600, 1100);
      else if (ms >= 1300 && ms < 1600) v = word.slice(0, Math.max(0, word.length - Math.floor((ms - 1300) / 40)));
      else if (ms >= 2400) v = typed(word, ms, 2400, 2900);
      var err = ms >= 1800 && ms < 2400 && !v;
      tx.innerHTML = esc(v) + (focus ? caretHTML() : '');
      fd.style.borderColor = err ? 'var(--u-danger)' : focus ? 'var(--u-accent)' : 'var(--u-line)';
      fd.style.boxShadow = focus && !err ? '0 0 0 3px var(--u-accent-soft)' : 'none';
      hp.style.color = err ? 'var(--u-danger)' : 'var(--u-muted)';
      hp.textContent = err ? '제목은 비울 수 없습니다' : help ? '목록에 보이는 이름입니다. 50자까지' : '';
      if (fl) { var up = focus || v ? 1 : 0, k = ease.out(seg(ms, 400, 550)); if (ms >= 1800 && ms < 2300 && !v) up = 0; var p = ms < 1800 ? k * up : up; fl.style.transform = 'translateY(' + (-9 * p) + 'px) scale(' + lerp(1, 0.78, p) + ')'; fl.style.color = err ? 'var(--u-danger)' : p > 0.5 && focus ? 'var(--u-accent)' : 'var(--u-muted)'; }
      return err ? '오류' : focus ? (v ? '입력 중' : '초점') : '기본';
    } };
  };

  S['inline-validation'] = function (st, c) {
    var mode = c.timing, bad = 'minji@examp', good = 'minji@example.com';
    st.innerHTML = '<div class="u-pad" style="gap:6px;max-width:360px"><span style="font-size:12.5px;font-weight:600">이메일</span><div class="fd" style="' + FIELD + '"><span class="tx"></span></div>' +
      '<span class="ms" style="font-size:12px;min-height:18px"></span><button type="button" class="u-btn primary sb" style="justify-self:start">제출</button>' + fakes(2) + '</div>';
    var fd = st.querySelector('.fd'), tx = st.querySelector('.tx'), msE = st.querySelector('.ms'), sb = st.querySelector('.sb');
    // 검사 시점: 적는 동안(멈추고 300ms), 칸을 벗어날 때, 제출할 때
    var check1 = mode === '적는 동안' ? 1600 : 1500, check2 = mode === '적는 동안' ? 2600 : 2500;
    return { ms: 3000, rest: 0.6, at: function (t) {
      var ms = t * 3000, v = ms < 300 ? '' : ms < 1300 ? typed(bad, ms, 300, 1300) : ms < 1900 ? bad : ms < 2300 ? bad + typed('le.com', ms, 1900, 2300) : good;
      var focus = mode === '칸을 벗어날 때' ? (ms < 1500 || (ms >= 1850 && ms < 2500)) : ms >= 200;
      // 한 번 틀렸다고 알린 뒤에는 다음 검사 때까지 알림을 둔다
      var state = ms < check1 ? '' : ms < check2 ? 'bad' : 'ok';
      tx.innerHTML = esc(v) + (focus ? caretHTML() : '');
      fd.style.borderColor = state === 'bad' ? 'var(--u-danger)' : state === 'ok' ? 'var(--u-ok)' : focus ? 'var(--u-accent)' : 'var(--u-line)';
      msE.style.color = state === 'bad' ? 'var(--u-danger)' : 'var(--u-ok)';
      msE.textContent = state === 'bad' ? 'example@company.com 형식으로 적어 주세요' : state === 'ok' ? '✓ 확인됐습니다' : '';
      sb.style.outline = mode === '제출할 때' && ((ms > 1350 && ms < 1500) || (ms > 2350 && ms < 2500)) ? '2px solid var(--u-accent)' : '';
      return state === 'bad' ? '틀림' : state === 'ok' ? '맞음' : ms < 1300 ? '적는 중 · 아직 검사 안 함' : '검사 기다림';
    } };
  };

  S['radio-group'] = function (st, c) {
    var row = c.direction === '가로', opts = [['모두', '모든 새 글과 댓글을 알립니다.'], ['멘션만', '나를 부른 글과 댓글만 알립니다.'], ['끔', '알림을 보내지 않습니다. 화면 안 배지는 남습니다.']];
    st.innerHTML = '<div class="u-pad" style="gap:10px"><b style="font-size:13px">알림 받기</b><div role="radiogroup" style="display:flex;' + (row ? 'gap:16px;flex-wrap:wrap' : 'flex-direction:column;gap:8px') + '">' +
      opts.map(function (o) { return '<span class="ro" style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;border-radius:6px"><span class="ci" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--u-muted);display:inline-grid;place-items:center"><i style="width:8px;height:8px;border-radius:50%;background:var(--u-accent)"></i></span>' + o[0] + '</span>'; }).join('') +
      '</div><span class="ds" style="font-size:12.5px;color:var(--u-muted)"></span>' + fakes(2) + '</div>' + keycap('↓');
    var ros = st.querySelectorAll('.ro'), ds = st.querySelector('.ds'), kc = st.querySelector('.kc'), seq = [[0, 1], [800, 0], [1600, 2], [2400, 1]];
    kc.textContent = row ? '→' : '↓';
    return { ms: 3000, rest: 0.1, at: function (t) {
      var ms = t * 3000, s = stepAt(seq, ms), at0 = 0;
      seq.forEach(function (x) { if (ms >= x[0]) at0 = x[0]; });
      ros.forEach(function (r, i) {
        var on = i === s, ci = r.querySelector('.ci'), dot = ci.querySelector('i');
        ci.style.borderColor = on ? 'var(--u-accent)' : 'var(--u-muted)';
        dot.style.transform = 'scale(' + (on ? (at0 ? ease.out(seg(ms, at0, at0 + 120)) : 1) : 0) + ')';
        r.style.outline = on && ms > 1500 && ms < 2600 ? '2px solid var(--u-accent)' : ''; r.style.outlineOffset = '3px';
      });
      ds.textContent = opts[s][1];
      kc.style.opacity = (ms > 1500 && ms < 1750) || (ms > 2300 && ms < 2550) ? 1 : 0;
      return opts[s][0] + (ms > 1500 ? ' · 화살표 키' : '');
    } };
  };

  S['toggle-switch'] = function (st, c) {
    var left = c.label === '왼쪽', dur = c.duration_ms;
    var sw = '<span class="tr" style="position:relative;width:38px;height:22px;border-radius:999px;background:var(--u-line);flex:none"><i class="kn" style="position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#ffffff;box-shadow:0 1px 3px rgb(0 0 0 / 30%)"></i></span>';
    st.innerHTML = '<div class="u-pad" style="gap:10px"><div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--u-panel);border:1px solid var(--u-line);border-radius:10px">' +
      (left ? '<span style="flex:1"><b style="font-size:13.5px">메일 알림</b><br><span class="sv" style="font-size:12px;color:var(--u-muted)"></span></span>' + sw : sw + '<span style="flex:1"><b style="font-size:13.5px">메일 알림</b><br><span class="sv" style="font-size:12px;color:var(--u-muted)"></span></span>') +
      '</div>' + fakes(3) + '</div>' +
      '<div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:flex-end"><div class="u-toast ts" style="font-size:12.5px"><span class="dot err"></span>저장하지 못했습니다. 다시 켰습니다.</div></div>';
    var tr = st.querySelector('.tr'), kn = st.querySelector('.kn'), sv = st.querySelector('.sv'), ts = st.querySelector('.ts');
    return { ms: 3000, rest: 0.3, at: function (t) {
      var ms = t * 3000, pos;
      if (ms < 400) pos = 0; else if (ms < 1600) pos = ease.out(seg(ms, 400, 400 + dur)); else if (ms < 2100) pos = 1 - ease.out(seg(ms, 1600, 1600 + dur)); else pos = ease.out(seg(ms, 2100, 2100 + dur));
      kn.style.transform = 'translateX(' + (16 * pos) + 'px)';
      tr.style.background = mixBg('var(--u-accent)', 100 * pos, 'var(--u-line)');
      sv.textContent = (ms >= 400 && ms < 900) || (ms >= 1600 && ms < 2100) ? '저장 중…' : ms >= 900 && ms < 1600 ? '켜짐 · 저장됨' : ms >= 2100 ? '켜짐 (끄기 실패)' : '꺼짐';
      var p = ms >= 2100 ? ease.out(seg(ms, 2100, 2300)) : 0;
      ts.style.opacity = p; ts.style.visibility = p > 0.01 ? 'visible' : 'hidden';
      return ms < 400 ? '꺼짐' : ms < 900 ? '켜는 중 · 저장 중' : ms < 1600 ? '켜짐' : ms < 2100 ? '끄는 중 · 저장 중' : '저장 실패 · 되돌림';
    } };
  };

  function bar(p, mode, t) {
    if (mode === '모름(왔다 갔다)' && p < 1) { var x = (t % 1200) / 1200; return '<span style="display:block;position:relative;height:4px;border-radius:2px;background:var(--u-line);overflow:hidden"><i style="position:absolute;top:0;bottom:0;width:30%;left:' + (x * 130 - 30) + '%;background:var(--u-accent);border-radius:2px"></i></span>'; }
    return '<span style="display:block;height:4px;border-radius:2px;background:var(--u-line);overflow:hidden"><i style="display:block;height:100%;width:' + (p * 100) + '%;background:var(--u-accent);border-radius:0 2px 2px 0"></i></span>';
  }
  UI.barHTML = bar;
  S['progress-bar'] = function (st, c) {
    var files = [['사업자등록증.pdf', 300, 1900], ['통장 사본.jpg', 400, 1300], ['정산 계좌 확인서.pdf', 500, 2500]], pct = c.label === '% 표시';
    st.innerHTML = '<div class="u-pad" style="gap:12px">' + files.map(function () { return '<div class="fl" style="display:grid;gap:5px"></div>'; }).join('') + '</div>';
    var fls = st.querySelectorAll('.fl');
    return { ms: 3000, rest: 0.45, at: function (t) {
      var ms = t * 3000, done = 0;
      fls.forEach(function (el, i) {
        var f = files[i], p = ease.inOut(seg(ms, f[1], f[2])), fin = ms >= f[2];
        if (fin) done++;
        el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span>' + f[0] + '</span><span style="font-family:var(--u-mono);font-size:12px;color:' + (fin ? 'var(--u-ok)' : 'var(--u-muted)') + '">' + (fin ? '✓ 완료' : pct && c.mode === '정해진 값' ? Math.round(p * 100) + '%' : '') + '</span></div>' + (fin ? '' : bar(p, c.mode, ms));
      });
      return done + '/3 완료';
    } };
  };

  S['file-drop-zone'] = function (st, c) {
    var multi = c.multiple === '여러 개', limit = c.limit === '크기 제한 표시';
    var files = multi ? [['사업자등록증.pdf', '1.2MB', 0], ['통장 사본.jpg', '3.4MB', 0], ['계약서 스캔.pdf', '14MB', 1]] : [['사업자등록증.pdf', '1.2MB', 0]];
    st.innerHTML = '<div class="u-pad" style="gap:10px"><div class="zn" style="border:2px dashed var(--u-line);border-radius:10px;padding:16px;text-align:center;font-size:13px;color:var(--u-muted);display:grid;gap:4px">' +
      '<b style="color:var(--u-ink)">파일을 여기로 끌어 오세요</b><span>또는 눌러서 고르기' + (limit ? ' · 10MB까지' : '') + (multi ? ' · 여러 개' : ' · 하나만') + '</span></div><div class="ls" style="display:grid;gap:8px"></div></div>' +
      '<div class="gh" style="position:absolute;z-index:4;display:flex;gap:4px;pointer-events:none">' + files.map(function () { return '<span style="width:26px;height:32px;border-radius:4px;background:var(--u-panel);border:1px solid var(--u-line);box-shadow:var(--u-shadow-sm)"></span>'; }).join('') + '</div>';
    var zn = st.querySelector('.zn'), ls = st.querySelector('.ls'), gh = st.querySelector('.gh');
    return { ms: 3000, rest: 0.55, at: function (t) {
      var ms = t * 3000, z = rel(st, zn), k = ease.inOut(seg(ms, 150, 650));
      gh.style.left = lerp(st.clientWidth - 60, z.x + z.w / 2 - 20, k) + 'px'; gh.style.top = lerp(st.clientHeight - 40, z.y + z.h / 2 - 16, k) + 'px';
      gh.style.opacity = ms < 800 ? 1 : 0;
      var over = ms > 450 && ms < 800;
      zn.style.borderColor = over ? 'var(--u-accent)' : 'var(--u-line)'; zn.style.background = over ? 'var(--u-accent-soft)' : 'transparent';
      ls.innerHTML = ms < 800 ? '' : files.map(function (f, i) {
        var tooBig = f[2] && limit, a = 800 + i * 150, b = a + 900 + i * 400, p = ease.inOut(seg(ms, a, b));
        return '<div style="display:grid;gap:4px;font-size:12.5px"><div style="display:flex;justify-content:space-between;gap:8px"><span>' + f[0] + ' <span style="color:var(--u-muted)">' + f[1] + '</span></span><span style="color:' + (tooBig ? 'var(--u-danger)' : p >= 1 ? 'var(--u-ok)' : 'var(--u-muted)') + '">' + (tooBig ? '10MB를 넘습니다' : p >= 1 ? '✓' : Math.round(p * 100) + '%') + '</span></div>' + (tooBig || p >= 1 ? '' : bar(p, '정해진 값', ms)) + '</div>';
      }).join('');
      return ms < 450 ? '기다림' : over ? '끌어 올림 · 강조' : ms < 2600 ? '올리는 중' : limit && multi ? '완료 · 큰 파일 하나만 오류' : '완료';
    } };
  };

  S['loading-button'] = function (st, c) {
    var keep = c.width === '폭 유지', back = c.done === '체크 후 원래대로';
    st.innerHTML = '<div class="u-pad" style="gap:12px">' + fakes(3) + '<div><button type="button" class="u-btn primary lb" style="justify-content:center;gap:8px;' + (keep ? 'width:96px' : 'min-width:72px') + '"></button></div>' + fakes(2) + '</div>';
    var lb = st.querySelector('.lb'), last = '';
    return { ms: 3900, rest: 0.18, at: function (t) {
      var ms = t * 3900, s;
      // 첫 요청은 성공, 두 번째 요청은 실패
      s = ms < 300 ? 'idle' : ms < 1300 ? 'busy' : ms < 2300 ? 'ok' : ms < 2600 ? (back ? 'idle' : 'ok') : ms < 3300 ? 'busy' : 'fail';
      if (s !== last) {
        lb.innerHTML = s === 'busy' ? spinHTML(14) + (keep ? '' : '<span>저장 중…</span>') : s === 'ok' ? '✓ 저장됨' : '저장';
        last = s;
      }
      var sp = lb.querySelector('.u-spin'); if (sp) { sp.style.borderColor = 'rgb(255 255 255 / 35%)'; sp.style.borderTopColor = 'var(--u-accent-ink)'; sp.style.transform = 'rotate(' + ((ms % 800) / 800 * 360) + 'deg)'; }
      lb.disabled = s === 'busy';
      lb.style.transform = s === 'fail' ? 'translateX(' + (Math.sin(seg(ms, 3300, 3700) * Math.PI * 4) * 6 * (1 - seg(ms, 3300, 3700))) + 'px)' : '';
      return { idle: '기본', busy: '처리 중 · 못 누름', ok: '완료', fail: '실패 · 흔들기' }[s];
    } };
  };

  S['disabled'] = function (st, c) {
    var tip = c.reason === '툴팁으로 이유', aria = c.focus === '초점 받음(aria-disabled)';
    st.innerHTML = '<div class="u-pad" style="gap:8px;max-width:360px"><span style="font-size:12.5px;font-weight:600">제목 <span style="color:var(--u-danger)">*</span></span><div class="fd" style="' + FIELD + '"><span class="tx"></span></div>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:4px"><button type="button" class="u-btn primary sv">저장</button><a href="#" class="cn" style="font-size:13px;color:var(--u-accent);border-radius:3px">취소</a></div>' + fakes(2) + '</div><div class="u-tip tp">제목을 적어 주세요</div>' + keycap('Tab');
    var sv = st.querySelector('.sv'), cn = st.querySelector('.cn'), tx = st.querySelector('.tx'), tp = st.querySelector('.tp'), kc = st.querySelector('.kc'), cur = cursor(st);
    return { ms: 3200, rest: 0.3, at: function (t) {
      var ms = t * 3200, v = ms >= 2100 ? typed('환불 사유 기타', ms, 2100, 2600) : '', off = !v;
      sv.style.opacity = off ? 0.5 : 1; sv.style.cursor = off ? 'not-allowed' : 'pointer';
      tx.textContent = v;
      var hover = ms > 500 && ms < 1100, kb = ms >= 1300 && ms < 2000;
      var focusBtn = kb && aria, focusLink = kb && !aria;
      sv.style.outline = focusBtn ? '2px solid var(--u-accent)' : ''; sv.style.outlineOffset = '2px';
      cn.style.outline = focusLink ? '2px solid var(--u-accent)' : ''; cn.style.outlineOffset = '2px';
      var showTip = tip && off && (hover || focusBtn);
      tp.style.opacity = showTip ? 1 : 0; tipAt(st, tp, sv, '위');
      var r = rel(st, sv);
      put(cur, r.x + r.w / 2, r.y + r.h / 2, ms > 900 && ms < 1000);
      cur.style.opacity = ms > 300 && ms < 1200 ? 1 : 0;
      kc.style.opacity = ms > 1250 && ms < 1550 ? 1 : 0;
      return off ? (hover ? '눌러도 안 됨' + (tip ? ' · 이유 보임' : '') : kb ? (aria ? 'Tab: 단추에 초점' : 'Tab: 단추를 건너뜀') : '꺼짐') : '켜짐 · 누를 수 있음';
    } };
  };

  S['accordion'] = function (st, c) {
    var dur = c.duration_ms, one = c.multiple === '하나만 펼침', heads = ['알림 보낼 주소', '결제 한도', '웹훅'];
    st.innerHTML = '<div class="u-pad" style="gap:0"><div style="border:1px solid var(--u-line);border-radius:10px;overflow:hidden;background:var(--u-panel)">' + heads.map(function (h, i) {
      return '<div class="ac" style="border-top:' + (i ? '1px solid var(--u-line)' : '0') + '"><button type="button" class="ah" style="display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:none;padding:10px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--u-ink)">' + h + '<span class="ar" style="color:var(--u-muted)">›</span></button>' +
        '<div class="ab" style="overflow:hidden"><div style="padding:0 12px 12px;display:grid;gap:6px">' + fakes(2 + i % 2) + '</div></div></div>';
    }).join('') + '</div></div>';
    var abs = st.querySelectorAll('.ab'), ars = st.querySelectorAll('.ar'), ahs = st.querySelectorAll('.ah');
    // 열림 정도: 0번은 300에 펴고, 1번은 1200에 편다. 하나만이면 1번을 펼 때 0번이 접힌다. 2300에 1번을 접는다
    function open(i, ms) {
      var f = function (a) { return ease.out(seg(ms, a, a + dur)); };
      if (i === 0) return f(300) * (one ? 1 - f(1200) : 1);
      if (i === 1) return f(1200) * (1 - f(2300));
      return 0;
    }
    return { ms: 3000, rest: 0.55, at: function (t) {
      var ms = t * 3000, n = 0;
      abs.forEach(function (b, i) { var p = open(i, ms); b.style.height = (b.firstChild.scrollHeight * p) + 'px'; ars[i].style.transform = 'rotate(' + (90 * p) + 'deg)'; if (p > 0.5) n++; ahs[i].style.background = (i === 0 && ms > 200 && ms < 320) || (i === 1 && (ms > 1100 && ms < 1220 || ms > 2200 && ms < 2320)) ? 'var(--u-hover)' : ''; });
      return n + '개 펼침' + (one && ms > 1200 && ms < 2300 ? ' · 앞의 것은 접힘' : '');
    } };
  };

  S['modal-dialog'] = function (st, c) {
    var frac = { '작게': 0.6, '보통': 0.8, '크게': 0.96 }[c.size], px = { '작게': 400, '보통': 560, '크게': 800 }[c.size], scale = c.enter === 'fade + scale', outside = c.close === '바깥 누르면 닫힘';
    st.innerHTML = '<div class="u-pad" style="gap:8px"><div><button type="button" class="u-btn primary nb">새 이슈</button></div>' + fakes(6) + '</div><div class="u-shade sh"></div>' +
      '<div class="wr" style="position:absolute;inset:0;display:grid;place-items:center;padding:10px"><div class="u-dlg dg" style="width:' + (frac * 100) + '%;max-width:none"><div style="display:flex;justify-content:space-between;align-items:center"><h3>새 이슈</h3><button type="button" class="u-icon f3" aria-label="닫기">×</button></div>' +
      '<input class="f0" readonly placeholder="제목" style="outline:none"><div class="acts"><button type="button" class="u-btn f2">취소</button><button type="button" class="u-btn primary f1">만들기</button></div>' +
      '<span style="font-family:var(--u-mono);font-size:11px;color:var(--u-muted)">폭 ' + px + 'px</span></div></div>' + keycap('Tab');
    var sh = st.querySelector('.sh'), wr = st.querySelector('.wr'), dg = st.querySelector('.dg'), nb = st.querySelector('.nb'), kc = st.querySelector('.kc'), cur = cursor(st);
    var fs = [st.querySelector('.f0'), st.querySelector('.f1'), st.querySelector('.f2'), st.querySelector('.f3')], seq = [[0, 0], [900, 1], [1200, 2], [1500, 3], [1800, 0]];
    var closeAt = outside ? 2200 : 2650;
    return { ms: 3100, rest: 0.4, at: function (t) {
      var ms = t * 3100, p = ms < closeAt ? ease.out(seg(ms, 300, 500)) : 1 - seg(ms, closeAt, closeAt + 150);
      sh.style.opacity = p; sh.style.visibility = wr.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      dg.style.opacity = p; dg.style.transform = scale ? 'scale(' + lerp(0.96, 1, p) + ')' : '';
      var f = stepAt(seq, ms);
      fs.forEach(function (e, i) { e.style.outline = p > 0.5 && i === f ? '2px solid var(--u-accent)' : ''; e.style.outlineOffset = '2px'; });
      nb.style.outline = ms > 200 && ms < 320 ? '2px solid var(--u-accent)' : '';
      put(cur, st.clientWidth - 24, st.clientHeight - 24, ms > 2120 && ms < 2240);
      cur.style.opacity = ms > 1950 && ms < 2400 ? 1 : 0;
      kc.textContent = ms > 2500 ? 'Esc' : 'Tab';
      kc.style.opacity = [900, 1200, 1500, 1800].some(function (k) { return ms > k - 100 && ms < k + 200; }) || (!outside && ms > 2550 && ms < 2800) ? 1 : 0;
      return p < 0.01 ? (ms > closeAt ? (outside ? '바깥 눌러 닫힘' : 'Esc로 닫힘') : '목록') : ms < 2000 ? 'Tab은 창 안에서만 돎' : !outside && ms > 2120 && ms < closeAt ? '바깥 눌러도 안 닫힘' : '열림';
    } };
  };
})();
