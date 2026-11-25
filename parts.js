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
  // 틀 안 좌표. 틀이 transform으로 줄어 있으면(카드 미리보기) 그 비율을 나눠 틀 기준 px로 돌려준다
  function rel(stage, el) { var a = stage.getBoundingClientRect(), b = el.getBoundingClientRect(), k = stage.offsetWidth ? a.width / stage.offsetWidth : 1; if (Math.abs(k - 1) < 0.02) k = 1; return { x: (b.left - a.left) / k, y: (b.top - a.top) / k, w: b.width / k, h: b.height / k }; }

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

  /* ───── 표현 › 차트 › 차트 종류 ───── */
  // 차트 색: 범주 4색은 dataviz 기준 팔레트 앞 4색(밝음·어두움 따로 검사, parts.css의 --c1~--c4). 밝은 화면의 3·4번은 바탕 대비가 3:1 아래라 범례나 값 라벨을 꼭 붙인다
  var CC = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'], VW = 480, VH = 230;
  // 눈금 4칸이 정수로 떨어지는 최댓값(12.5·37.5 같은 눈금을 피한다)
  function tickMax(m) { var st = m / 4, p = Math.pow(10, Math.floor(Math.log10(st))), c = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for (var i = 0; i < c.length; i++) { var v = Math.round(c[i] * p * 1e6) / 1e6; if (v >= st && (v < 1 || v % 1 === 0)) return v * 4; } return 40 * p; }
  function niceMax(m) { var s = Math.pow(10, Math.floor(Math.log10(m))); return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].filter(function (k) { return k * s >= m; })[0] * s; }
  function tx(x, y, s, a, cls) { return '<text x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>'; }
  function ln(x1, y1, x2, y2, st) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" style="' + st + '"/>'; }
  var GRID = 'stroke:var(--u-muted);stroke-opacity:.3;stroke-width:1;stroke-dasharray:2 3', BASE = 'stroke:var(--u-muted);stroke-width:1;opacity:.6';
  // 값 축(4칸): 바닥선은 실선, 격자선은 점선으로 물러나게. b = {x, y, w, h}
  function yAxis(b, max, unit) {
    var s = '';
    for (var i = 0; i <= 4; i++) { var y = b.y + b.h - b.h * i / 4; s += ln(b.x, y, b.x + b.w, y, i ? GRID : BASE) + tx(b.x - 6, y + 4, fmt(max * i / 4, true) + (i === 4 && unit ? unit : ''), 'end', 'tk'); }
    return s;
  }
  // 막대: 값 쪽 끝만 둥글게(4px), 바닥에 붙인다
  function barPath(x, y, w, h, horiz) {
    var r = Math.min(4, horiz ? h / 2 : w / 2, horiz ? w : h);
    if (w <= 0.1 || h <= 0.1) return 'M0 0';
    return horiz ? 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z'
      : 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
  }
  // 장면 틀: SVG(480×230 좌표) + 툴팁 + 커서. 좌표는 SVG 기준으로 주고 화면 px로 바꿔 놓는다
  function chartKit(st, inner) {
    st.innerHTML = '<svg class="u-chart" viewBox="0 0 ' + VW + ' ' + VH + '" preserveAspectRatio="xMidYMid meet">' + inner + '</svg><div class="u-ctip off"></div>';
    var svg = st.querySelector('svg'), tip = st.querySelector('.u-ctip'), cur = cursor(st);
    function px(x, y) { var r = rel(st, svg), k = Math.min(r.w / VW, r.h / VH); return [r.x + (r.w - VW * k) / 2 + x * k, r.y + (r.h - VH * k) / 2 + y * k]; }
    return {
      q: function (sel) { return [].slice.call(svg.querySelectorAll(sel)); },
      // 툴팁은 틀 안에 머물게 좌우를 당긴다
      tip: function (on, x, y, html) { tip.classList.toggle('off', !on); if (on) { var p = px(x, y), hw; tip.innerHTML = html; hw = tip.offsetWidth / 2 + 4; tip.style.left = Math.max(hw, Math.min(st.clientWidth - hw, p[0])) + 'px'; tip.style.top = p[1] + 'px'; } },
      noCursor: function () { cur.remove(); },
      px: px,
      cur: function (x, y, press) { var p = px(x, y); put(cur, p[0], p[1], press); }
    };
  }
  function sw(i) { return '<i style="background:' + (typeof i === 'number' ? CC[i] : i) + '"></i>'; }
  // 커서가 SVG 좌표 a에서 b로 (t0~t1)
  function glide(ms, t0, t1, a, b) { var q = ease.inOut(seg(ms, t0, t1)); return [lerp(a[0], b[0], q), lerp(a[1], b[1], q)]; }

  S['bar-chart'] = function (st, c) {
    var horiz = c.orient === '가로', D = [['민지', 24], ['준호', 17], ['서연', 31], ['도윤', 12], ['하은', 20]];
    if (c.sort === '큰 순서') D = D.slice().sort(function (a, b) { return b[1] - a[1]; });
    var n = D.length, max = niceMax(31), MS = 3200, top = D.reduce(function (m, d, i) { return d[1] > D[m][1] ? i : m; }, 0);
    var b = horiz ? { x: 56, y: 10, w: 380, h: 186 } : { x: 40, y: 18, w: 425, h: 178 }, s = '', band = (horiz ? b.h : b.w) / n, th = band * 0.56;
    if (horiz) for (var i = 0; i <= 4; i++) { var x = b.x + b.w * i / 4; s += ln(x, b.y, x, b.y + b.h, i ? GRID : BASE) + tx(x, b.y + b.h + 16, fmt(max * i / 4), 'middle', 'tk'); }
    else s += yAxis(b, max);
    D.forEach(function (d, i) {
      var o = (horiz ? b.y : b.x) + band * i + (band - th) / 2;
      s += '<path class="bar" style="fill:var(--c1)"/>' + (horiz ? tx(b.x - 8, o + th / 2 + 4, d[0], 'end', 'tk') : tx(o + th / 2, b.y + b.h + 16, d[0], 'middle', 'tk')) + '<text class="vl" text-anchor="' + (horiz ? 'start' : 'middle') + '"></text>';
    });
    s += tx(horiz ? b.x + b.w : b.x - 6, horiz ? b.y + b.h + 30 : 10, '처리 건수', horiz ? 'end' : 'start', 'tk');
    var k = chartKit(st, s), bars = k.q('.bar'), vls = k.q('.vl');
    function geo(i, p) {
      var o = (horiz ? b.y : b.x) + band * i + (band - th) / 2, L = D[i][1] / max * (horiz ? b.w : b.h) * p;
      return horiz ? { x: b.x, y: o, w: L, h: th, ex: b.x + L, ey: o + th / 2 } : { x: o, y: b.y + b.h - L, w: th, h: L, ex: o + th / 2, ey: b.y + b.h - L };
    }
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, hov = ms > 2050 && ms < 2950;
      D.forEach(function (d, i) {
        var g = geo(i, ease.out(seg(ms, 150 + i * 90, 750 + i * 90)));
        bars[i].setAttribute('d', barPath(g.x, g.y, g.w, g.h, horiz)); bars[i].style.opacity = hov && i !== top ? 0.4 : 1;
        vls[i].textContent = d[1]; vls[i].setAttribute('x', horiz ? g.ex + 6 : g.ex); vls[i].setAttribute('y', horiz ? g.ey + 4 : g.ey - 6); vls[i].style.opacity = seg(ms, 650 + i * 90, 900 + i * 90);
      });
      var e = geo(top, 1), at = horiz ? [e.ex - 20, e.ey] : [e.ex, e.ey + 24], p = glide(ms, 1500, 2050, [VW - 10, VH - 4], at);
      k.cur(p[0], p[1], false); k.tip(hov, horiz ? e.ex - 20 : e.ex, horiz ? e.ey - 10 : e.ey - 18, sw(0) + '<b>' + D[top][0] + '</b> ' + D[top][1] + '건');
      return ms < 1100 ? '막대가 0에서 자라남' : hov ? '가장 큰 값 · ' + D[top][0] + ' ' + D[top][1] + '건' : (horiz ? '가로' : '세로') + ' 막대 · ' + c.sort;
    } };
  };

  S['stacked-bar-chart'] = function (st, c) {
    var pct = c.mode === '100% 비율', ns = c.series === '2개' ? 2 : 4, NAMES = ['완료', '진행', '검토', '대기'], WEEK = ['1주', '2주', '3주', '4주'], fo = c.focus === '범례로 계열 강조', MS = fo ? 4700 : 3400, F0 = 3550, F1 = 4450;
    var V = [[12, 8, 4, 6], [15, 9, 5, 4], [18, 7, 6, 3], [22, 6, 4, 2]].map(function (r) { r = r.slice(0, ns); var sum = r.reduce(function (a, v) { return a + v; }, 0); return r.map(function (v) { return pct ? v / sum * 100 : v; }); });
    var max = pct ? 100 : tickMax(Math.max.apply(null, V.map(function (r) { return r.reduce(function (a, v) { return a + v; }, 0); }))), b = { x: 40, y: 34, w: 425, h: 162 }, band = b.w / 4, th = band * 0.5, s = yAxis(b, max, pct ? '%' : '');
    for (var j = 0; j < ns; j++) s += '<g class="lg"><rect x="' + (b.x + j * 64) + '" y="4" width="10" height="10" rx="2" style="fill:' + CC[j] + '"/>' + tx(b.x + 14 + j * 64, 13, NAMES[j], '', 'tk') + '</g>';
    V.forEach(function (r, i) { s += tx(b.x + band * i + band / 2, b.y + b.h + 16, WEEK[i], 'middle', 'tk'); r.forEach(function (v, j) { s += '<rect class="sg" style="fill:' + CC[j] + '"/><text class="in" text-anchor="middle" style="fill:' + (j < 2 ? '#ffffff' : '#1d1f22') + '"></text>'; }); });
    var k = chartKit(st, s), sg = k.q('.sg'), ins = k.q('.in'), lgs = k.q('.lg'), HI = [2, 1], hv = null;
    return { ms: MS, rest: 0.4, at: function (t) {
      // 범례 강조: 범례의 '진행'을 가리키면 그 계열 칸만 남기고 나머지를 흐린다(Focus Dimming)
      var ms = t * MS, hov = ms > 2200 && ms < 3100, fon = fo && ms > F0 && ms < F1;
      lgs.forEach(function (g, j) { g.style.opacity = fon && j !== 1 ? 0.35 : 1; });
      V.forEach(function (r, i) {
        var y0 = b.y + b.h, x = b.x + band * i + (band - th) / 2;
        r.forEach(function (v, j) {
          var h = v / max * b.h, p = ease.out(seg(ms, 150 + j * 260 + i * 60, 480 + j * 260 + i * 60)), hh = Math.max(0, h * p - (j ? 2 : 0)), el = sg[i * ns + j], tl = ins[i * ns + j];
          el.setAttribute('x', x); el.setAttribute('width', th); el.setAttribute('y', y0 - (j ? 2 : 0) - hh); el.setAttribute('height', hh);
          el.style.opacity = hov && !(i === HI[0] && j === HI[1]) ? 0.4 : fon && j !== 1 ? 0.22 : 1; tl.style.opacity = fon && j !== 1 ? 0.3 : 1;
          tl.setAttribute('x', x + th / 2); tl.setAttribute('y', y0 - h / 2 + 4); tl.textContent = h >= 15 && p >= 1 ? (pct ? Math.round(v) + '%' : v) : '';
          if (i === HI[0] && j === HI[1]) hv = [x + th / 2, y0 - h / 2];
          y0 -= h;
        });
      });
      var p = ms < 3150 || !fo ? glide(ms, 1700, 2200, [VW - 10, VH - 4], [hv[0] + 6, hv[1] + 6]) : ms < F1 ? glide(ms, 3150, F0, [hv[0] + 6, hv[1] + 6], [b.x + 64 + 24, 12]) : glide(ms, F1, F1 + 250, [b.x + 64 + 24, 12], [VW - 10, VH - 4]), raw = [[12, 8, 4, 6], [15, 9, 5, 4], [18, 7, 6, 3], [22, 6, 4, 2]][HI[0]];
      k.cur(p[0], p[1], false); k.tip(hov, hv[0], hv[1] - 12, sw(1) + '<b>' + WEEK[HI[0]] + ' · ' + NAMES[1] + '</b> ' + raw[1] + '건' + (pct ? ' (' + Math.round(V[HI[0]][1]) + '%)' : ''));
      return ms < 1500 ? '계열이 아래부터 쌓임' : hov ? '가운데 칸 하나를 가리킴 · 값은 툴팁으로' : fon ? '범례 "진행"을 가리킴 · 그 계열만 남음' : (pct ? '주마다 합을 100%로' : '쌓인 높이가 그 주의 합') + ' · 계열 ' + ns + '개';
    } };
  };

  // 선·면 차트가 같이 쓰는 12주 데이터
  var WK = ['1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주', '9주', '10주', '11주', '12주'];
  var LINES = [['열린 이슈', [32, 35, 38, 36, 40, 43, 41, 45, 44, 48, 46, 50]], ['닫힌 이슈', [20, 24, 22, 27, 29, 28, 33, 35, 34, 38, 41, 43]], ['새 이슈', [14, 12, 17, 15, 18, 16, 19, 17, 21, 18, 20, 22]]];
  function xAxis12(b) { var s = ''; WK.forEach(function (w, i) { if (i % 3 === 0 || i === 11) s += tx(b.x + b.w * i / 11, b.y + b.h + 16, w, 'middle', 'tk'); }); return s; }

  S['line-chart'] = function (st, c) {
    var L = c.lines === '1개' ? LINES.slice(0, 1) : LINES, mk = c.markers, max = niceMax(55), b = { x: 34, y: 12, w: 360, h: 182 }, MS = 3600, HW = [3, 8];
    var X = function (i) { return b.x + b.w * i / 11; }, Y = function (v) { return b.y + b.h - v / max * b.h; }, s = yAxis(b, max) + xAxis12(b) + '<line class="xh" style="stroke:var(--u-muted);stroke-width:1;opacity:0"/>';
    L.forEach(function (l, j) {
      s += '<polyline class="ln" pathLength="1" points="' + l[1].map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ') + '" style="fill:none;stroke:' + CC[j] + ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1"/>';
      l[1].forEach(function (v, i) { if (mk === '모든 점' || (mk === '마지막 점만' && i === 11)) s += '<circle class="mk" data-j="' + j + '" data-i="' + i + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="4" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:2"/>'; });
      s += '<circle class="hd" r="4.5" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:2;opacity:0"/>' + tx(X(11) + 10, Y(l[1][11]) + 4, l[0], '', 'nm');
    });
    var k = chartKit(st, s), lns = k.q('.ln'), mks = k.q('.mk'), hds = k.q('.hd'), nms = k.q('.nm'), xh = k.q('.xh')[0];
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, p = ease.inOut(seg(ms, 150, 1250)), on = ms > 1850 && ms < 3200;
      lns.forEach(function (e) { e.style.strokeDashoffset = 1 - p; });
      mks.forEach(function (e) { e.style.opacity = seg(ms, 150 + 1100 * (+e.getAttribute('data-i')) / 11, 250 + 1100 * (+e.getAttribute('data-i')) / 11); });
      nms.forEach(function (e) { e.style.opacity = seg(ms, 1200, 1450); });
      var f = lerp(HW[0], HW[1], ease.inOut(seg(ms, 2150, 3000))), wi = Math.round(f), cx = X(f), q = glide(ms, 1500, 1850, [VW - 8, VH - 4], [X(HW[0]), b.y + 40]);
      if (ms >= 1850) q = [cx, b.y + 40];
      xh.setAttribute('x1', X(wi)); xh.setAttribute('x2', X(wi)); xh.setAttribute('y1', b.y); xh.setAttribute('y2', b.y + b.h); xh.style.opacity = on ? 0.5 : 0;
      hds.forEach(function (e, j) { e.setAttribute('cx', X(wi)); e.setAttribute('cy', Y(L[j][1][wi])); e.style.opacity = on ? 1 : 0; });
      k.cur(q[0], q[1], false);
      k.tip(on, Math.min(X(wi), b.x + b.w - 40), b.y + 8, '<b>' + WK[wi] + '</b>' + L.map(function (l, j) { return sw(j) + l[1][wi]; }).join(' '));
      return ms < 1300 ? '선이 왼쪽에서 그려짐' : on ? WK[wi] + ' · ' + L.map(function (l) { return l[0].split(' ')[0] + ' ' + l[1][wi]; }).join(' · ') : '선 ' + L.length + '개 · 끝에 이름 · 점: ' + mk;
    } };
  };

  S['area-chart'] = function (st, c) {
    var stack = c.kind === '누적', op = (+c.opacity_pct) / 100, grad = c.fill === '그라데이션', gid = 'uag' + (++CLIP_N), MS = 3400, HI = 8;
    var L = stack ? [['진행', [10, 12, 11, 14, 13, 15, 14, 16, 15, 17, 16, 18]], ['검토', [6, 7, 9, 8, 10, 9, 11, 10, 12, 11, 13, 12]], ['대기', [8, 9, 7, 10, 9, 11, 10, 9, 11, 10, 12, 11]]] : LINES.slice(0, 1);
    var cum = WK.map(function () { return 0; }), layers = L.map(function (l) { var lo = cum.slice(); cum = cum.map(function (v, i) { return v + l[1][i]; }); return { name: l[0], lo: lo, hi: cum.slice(), v: l[1] }; });
    var max = tickMax(Math.max.apply(null, cum) * 1.08), b = { x: 34, y: 12, w: 372, h: 182 }, X = function (i) { return b.x + b.w * i / 11; }, Y = function (v) { return b.y + b.h - v / max * b.h; };
    var s = yAxis(b, max) + xAxis12(b) + '<line class="xh" style="stroke:var(--u-muted);stroke-width:1;opacity:0"/>';
    // 그라데이션: 위는 채움 %, 바닥으로 갈수록 0에 가깝게
    if (grad) s += '<defs>' + layers.map(function (l, j) { return '<linearGradient id="' + gid + j + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + CC[j] + ';stop-opacity:' + Math.min(0.9, op * 1.6) + '"/><stop offset="1" style="stop-color:' + CC[j] + ';stop-opacity:.03"/></linearGradient>'; }).join('') + '</defs>';
    layers.forEach(function (l, j) { s += '<polygon class="ar" style="' + (grad ? 'fill:url(#' + gid + j + ')' : 'fill:' + CC[j] + ';opacity:' + op) + '"/><polyline class="tp" style="fill:none;stroke:' + CC[j] + ';stroke-width:2;stroke-linejoin:round"/>' + tx(X(11) + 8, 0, l.name, '', 'nm'); });
    var k = chartKit(st, s), ars = k.q('.ar'), tps = k.q('.tp'), nms = k.q('.nm'), xh = k.q('.xh')[0];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, p = ease.out(seg(ms, 150, 1050)), on = ms > 2000 && ms < 3000;
      layers.forEach(function (l, j) {
        var hi = l.hi.map(function (v, i) { return X(i) + ',' + Y(v * p); }), lo = l.lo.map(function (v, i) { return X(i) + ',' + Y(v * p); }).reverse();
        ars[j].setAttribute('points', hi.concat(lo).join(' ')); tps[j].setAttribute('points', hi.join(' '));
        nms[j].setAttribute('y', Y((l.lo[11] + l.hi[11]) / 2) + 4); nms[j].style.opacity = seg(ms, 1050, 1300);
      });
      var q = glide(ms, 1500, 2000, [VW - 8, VH - 4], [X(HI), Y(cum[HI]) - 14]);
      xh.setAttribute('x1', X(HI)); xh.setAttribute('x2', X(HI)); xh.setAttribute('y1', b.y); xh.setAttribute('y2', b.y + b.h); xh.style.opacity = on ? 0.5 : 0;
      k.cur(q[0], q[1], false);
      k.tip(on, X(HI), Y(cum[HI]) - 26, '<b>' + WK[HI] + '</b>' + layers.map(function (l, j) { return sw(j) + l.name + ' ' + l.v[HI]; }).join(' ') + (stack ? ' · 합 ' + cum[HI] : ''));
      return ms < 1100 ? '면이 바닥(0)에서 차오름' : on ? WK[HI] + (stack ? ' · 층마다 값, 맨 위가 합 ' + cum[HI] : ' · ' + L[0][1][HI] + '건') : (stack ? '누적 면 · 맨 아래 층만 바닥이 곧다' : '한 계열 면 · 채움 ' + c.opacity_pct + '%') + (grad ? ' · 아래로 옅어짐' : '');
    } };
  };

  S['donut-chart'] = function (st, c) {
    var five = c.slices === '5개', D = five ? [['보통', 34], ['높음', 21], ['낮음', 18], ['긴급', 9], ['기타', 8]] : [['보통', 34], ['높음', 21], ['기타', 35]], MS = 3600, HI = 1;
    var tot = D.reduce(function (a, d) { return a + d[1]; }, 0), CX = 140, CY = 115, R = 92, RI = 58, GAP = 0.025, col = function (i) { return D[i][0] === '기타' ? 'var(--c-other)' : CC[i]; };
    var s = D.map(function (d, i) { return '<path class="sl" style="fill:' + col(i) + '"/>'; }).join('') + tx(CX, CY - 2, '', 'middle', 'big') + tx(CX, CY + 18, '', 'middle', 'tk');
    D.forEach(function (d, i) { var y = 52 + i * 28; s += '<rect x="282" y="' + (y - 10) + '" width="11" height="11" rx="2" style="fill:' + col(i) + '"/>' + tx(300, y, d[0], '', 'nm') + tx(452, y, Math.round(d[1] / tot * 100) + '%', 'end', 'tk'); });
    var k = chartKit(st, s), sls = k.q('.sl'), big = k.q('.big')[0], sub = k.q('text.tk')[0];
    function arc(a0, a1, dr) {
      var m = (a0 + a1) / 2, ox = Math.sin(m) * dr, oy = -Math.cos(m) * dr, P = function (r, a) { return (CX + ox + Math.sin(a) * r).toFixed(1) + ' ' + (CY + oy - Math.cos(a) * r).toFixed(1); }, lg = a1 - a0 > Math.PI ? 1 : 0;
      return a1 - a0 <= 0.001 ? 'M0 0' : 'M' + P(R, a0) + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + P(R, a1) + 'L' + P(RI, a1) + 'A' + RI + ' ' + RI + ' 0 ' + lg + ' 0 ' + P(RI, a0) + 'Z';
    }
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, sweep = Math.PI * 2 * ease.inOut(seg(ms, 150, 1150)), on = ms > 2000 && ms < 3100, a = 0, mid = 0;
      D.forEach(function (d, i) {
        var a0 = a, a1 = a + d[1] / tot * Math.PI * 2; a = a1;
        if (i === HI) mid = (a0 + a1) / 2;
        sls[i].setAttribute('d', arc(Math.min(a0 + GAP, sweep), Math.min(a1 - GAP, sweep), on && i === HI ? 6 : 0));
        sls[i].style.opacity = on && i !== HI ? 0.45 : 1;
      });
      var center = c.center === '가리킨 조각' && on;
      big.textContent = center ? Math.round(D[HI][1] / tot * 100) + '%' : Math.round(tot * ease.out(seg(ms, 150, 1150))) + '건';
      sub.textContent = center ? D[HI][0] + ' ' + D[HI][1] + '건' : '이슈 합계';
      var hx = CX + Math.sin(mid) * (R + RI) / 2, hy = CY - Math.cos(mid) * (R + RI) / 2, q = glide(ms, 1500, 2000, [VW - 8, VH - 4], [hx + 4, hy + 4]);
      k.cur(q[0], q[1], false); k.tip(on && c.center === '합계', hx, hy - 12, sw(HI) + '<b>' + D[HI][0] + '</b> ' + D[HI][1] + '건 (' + Math.round(D[HI][1] / tot * 100) + '%)');
      return ms < 1200 ? '조각이 12시부터 시계 방향으로 채워짐' : on ? D[HI][0] + ' 조각을 가리킴 · ' + (center ? '가운데 글이 그 조각으로' : '툴팁에 값') : '조각 ' + D.length + '개 · 오른쪽에 이름과 비율';
    } };
  };

  S['scatter-plot'] = function (st, c) {
    var n = +c.points, trend = c.trend === '추세선', MS = 3600, b = { x: 40, y: 12, w: 420, h: 178 }, P = [];
    for (var i = 0; i < n; i++) { var x = prand(i, 1) * 38 + 1, y = Math.max(0.3, 1.5 + x * 0.32 + (prand(i, 2) - 0.5) * 7 + (prand(i, 3) > 0.94 ? 6 : 0)); P.push([x, Math.min(y, 19.5)]); }
    var out = P.reduce(function (m, p, i) { return p[1] - (1.5 + p[0] * 0.32) > P[m][1] - (1.5 + P[m][0] * 0.32) ? i : m; }, 0);
    var mx = P.reduce(function (a, p) { return a + p[0]; }, 0) / n, my = P.reduce(function (a, p) { return a + p[1]; }, 0) / n, sxy = 0, sxx = 0;
    P.forEach(function (p) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); });
    var sl = sxy / sxx, ic = my - sl * mx, X = function (v) { return b.x + v / 40 * b.w; }, Y = function (v) { return b.y + b.h - v / 20 * b.h; };
    var s = yAxis(b, 20, '일');
    [0, 10, 20, 30, 40].forEach(function (v) { s += tx(X(v), b.y + b.h + 16, v, 'middle', 'tk'); });
    s += tx(b.x + b.w, b.y + b.h + 30, '댓글 수 →', 'end', 'tk') + P.map(function (p) { return '<circle class="pt" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="4" style="fill:var(--c1);fill-opacity:.55;stroke:var(--u-panel);stroke-width:1"/>'; }).join('');
    s += '<line class="tr" pathLength="1" x1="' + X(0) + '" y1="' + Y(ic) + '" x2="' + X(40) + '" y2="' + Y(Math.min(20, ic + sl * 40)) + '" style="stroke:var(--c2);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1"/>';
    s += '<circle class="rg" r="8" cx="' + X(P[out][0]) + '" cy="' + Y(P[out][1]) + '" style="fill:none;stroke:var(--u-ink);stroke-width:1.5;opacity:0"/>';
    var k = chartKit(st, s), pts = k.q('.pt'), tr = k.q('.tr')[0], rg = k.q('.rg')[0];
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, on = ms > 2300 && ms < 3300;
      pts.forEach(function (e, i) { var a = 100 + prand(i, 4) * 800; e.style.opacity = seg(ms, a, a + 200); });
      tr.style.strokeDashoffset = trend ? 1 - ease.inOut(seg(ms, 1100, 1700)) : 1;
      rg.style.opacity = on ? 1 : 0;
      var q = glide(ms, 1800, 2300, [VW - 8, VH - 4], [X(P[out][0]) + 5, Y(P[out][1]) + 5]);
      k.cur(q[0], q[1], false); k.tip(on, X(P[out][0]), Y(P[out][1]) - 12, '댓글 ' + Math.round(P[out][0]) + '개 · <b>' + P[out][1].toFixed(1) + '일</b> 걸림');
      return ms < 1000 ? '점 ' + n + '개가 나타남' : on ? '추세에서 멀리 떨어진 점 하나' : trend ? '댓글이 많을수록 오래 걸림(추세선)' : '점 하나 = 이슈 하나(댓글 수, 처리 일수)';
    } };
  };

  // 순서 색: 두 끝 색(--seq-lo → --seq-hi)을 섞는다. 발산은 가운데 회색에서 양쪽 색으로
  function seqFill(p) { return 'color-mix(in oklab, var(--seq-hi) ' + Math.round(p * 100) + '%, var(--seq-lo))'; }
  function divFill(p) { return 'color-mix(in oklab, ' + (p < 0 ? 'var(--div-neg)' : 'var(--div-pos)') + ' ' + Math.round(Math.abs(p) * 100) + '%, var(--div-mid))'; }

  S['heatmap'] = function (st, c) {
    var div = c.scale === '두 색(가운데 회색)', vals = c.labels === '값 적기', DAY = ['월', '화', '수', '목', '금', '토', '일'], MS = 3400, x0 = 30, y0 = 8, cw = 36, ch = 22, HI = [2, 7];
    var V = DAY.map(function (d, r) { return WK.map(function (w, j) { var h = j * 2, base = Math.exp(-Math.pow((h - 14) / 5, 2)) * 20 * (r < 5 ? 1 : 0.25); return Math.round(Math.max(0, base + prand(r * 12 + j, 5) * 4)); }); });
    var D2 = DAY.map(function (d, r) { return WK.map(function (w, j) { return Math.round((prand(r * 12 + j, 6) - 0.5) * 16 + (j > 5 && r < 5 ? 3 : 0)); }); }), max = 22, dm = 10;
    var s = '';
    DAY.forEach(function (d, r) { s += tx(x0 - 8, y0 + r * ch + ch / 2 + 4, d, 'end', 'tk'); WK.forEach(function (w, j) { s += '<rect class="cl" x="' + (x0 + j * cw + 1) + '" y="' + (y0 + r * ch + 1) + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="3"/><text class="cv" text-anchor="middle" x="' + (x0 + j * cw + cw / 2) + '" y="' + (y0 + r * ch + ch / 2 + 4) + '"></text>'; }); });
    [0, 3, 6, 9].forEach(function (j) { s += tx(x0 + j * cw + 1, y0 + 7 * ch + 14, (j * 2) + '시', '', 'tk'); });
    s += '<rect class="hl" x="' + (x0 + HI[1] * cw) + '" y="' + (y0 + HI[0] * ch) + '" width="' + cw + '" height="' + ch + '" rx="4" style="fill:none;stroke:var(--u-ink);stroke-width:2;opacity:0"/>';
    for (var g = 0; g < 10; g++) s += '<rect x="' + (250 + g * 16) + '" y="' + (y0 + 7 * ch + 22) + '" width="16" height="10" style="fill:' + (div ? divFill(g / 9 * 2 - 1) : seqFill(g / 9)) + '"/>';
    s += tx(246, y0 + 7 * ch + 31, div ? '줄어듦' : '적음', 'end', 'tk') + tx(414, y0 + 7 * ch + 31, div ? '늘어남' : '많음', '', 'tk');
    var k = chartKit(st, s), cls = k.q('.cl'), cvs = k.q('.cv'), hl = k.q('.hl')[0];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2100 && ms < 3100;
      cls.forEach(function (e, i) {
        var r = Math.floor(i / 12), j = i % 12, v = div ? D2[r][j] / dm : V[r][j] / max, a = seg(ms, 100 + j * 55, 400 + j * 55);
        e.style.fill = div ? divFill(Math.max(-1, Math.min(1, v))) : seqFill(Math.min(1, v)); e.style.opacity = a;
        cvs[i].textContent = vals && a >= 1 ? (div && D2[r][j] > 0 ? '+' : '') + (div ? D2[r][j] : V[r][j]) : '';
        cvs[i].style.fill = Math.abs(v) > 0.55 ? '#ffffff' : 'var(--u-ink)';
      });
      hl.style.opacity = on ? 1 : 0;
      var hx = x0 + HI[1] * cw + cw / 2, hy = y0 + HI[0] * ch + ch / 2, q = glide(ms, 1600, 2100, [VW - 8, VH - 4], [hx + 4, hy + 4]), hv = div ? D2[HI[0]][HI[1]] : V[HI[0]][HI[1]];
      k.cur(q[0], q[1], false); k.tip(on, hx, hy - 12, '<b>' + DAY[HI[0]] + '요일 ' + HI[1] * 2 + '–' + (HI[1] * 2 + 2) + '시</b> ' + (div ? (hv > 0 ? '+' : '') + hv + '건(지난주 대비)' : hv + '건'));
      return ms < 900 ? '칸이 시간 순서로 칠해짐' : on ? '칸 하나를 가리킴 · 값은 글자로도' : div ? '가운데(0)는 회색, 늘면 파랑·줄면 빨강' : '진할수록 많음 · 한 색 진하기';
    } };
  };

  S['calendar-heatmap'] = function (st, c) {
    var W = +c.weeks, steps = c.steps === '5단계', MS = 3400, cell = Math.min(22, Math.floor(420 / W) - 3), gap = 3, x0 = 34, y0 = 22, MON = ['일', '월', '화', '수', '목', '금', '토'];
    var end = new Date(2026, 10, 25), start = new Date(end); start.setDate(end.getDate() - end.getDay() - (W - 1) * 7);
    var days = [], s = '', lastM = -1, lastW = -9;
    for (var w = 0; w < W; w++) for (var d = 0; d < 7; d++) {
      var dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      if (dt > end) continue;
      var v = d === 0 || d === 6 ? (prand(w * 7 + d, 7) > 0.7 ? 1 : 0) : Math.round(prand(w * 7 + d, 8) * 8 * (0.6 + w / W * 0.6));
      days.push({ w: w, d: d, dt: dt, v: v });
      // 달 이름은 바뀌는 주에 하나, 앞 이름과 3주 넘게 떨어질 때만(겹치지 않게)
      if (d === 0 && dt.getMonth() !== lastM) { lastM = dt.getMonth(); if (w - lastW >= 3) { lastW = w; s += tx(x0 + w * (cell + gap), 12, (lastM + 1) + '월', '', 'tk'); } }
    }
    [1, 3, 5].forEach(function (d) { s += tx(x0 - 6, y0 + d * (cell + gap) + cell - 3, MON[d], 'end', 'tk'); });
    var max = Math.max.apply(null, days.map(function (x) { return x.v; })), lvl = function (v) { return v === 0 ? -1 : steps ? Math.ceil(v / max * 4) / 4 : v / max; };
    days.forEach(function (x) { s += '<rect class="dy" x="' + (x0 + x.w * (cell + gap)) + '" y="' + (y0 + x.d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="3"/>'; });
    var ly = y0 + 7 * (cell + gap) + 8;
    s += tx(x0, ly + 9, '적음', '', 'tk');
    [-1, 0.25, 0.5, 0.75, 1].forEach(function (l, i) { s += '<rect x="' + (x0 + 30 + i * 15) + '" y="' + ly + '" width="12" height="12" rx="3" style="fill:' + (l < 0 ? 'var(--u-line)' : seqFill(l)) + '"/>'; });
    s += tx(x0 + 30 + 5 * 15 + 2, ly + 9, '많음', '', 'tk');
    var HI = days.length - 6, k = chartKit(st, s), dys = k.q('.dy');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2100 && ms < 3100;
      days.forEach(function (x, i) {
        var L = lvl(x.v), a = seg(ms, 100 + x.w / W * 900, 300 + x.w / W * 900);
        dys[i].style.fill = L < 0 ? 'var(--u-line)' : seqFill(0.15 + L * 0.85); dys[i].style.opacity = a;
        dys[i].style.stroke = on && i === HI ? 'var(--u-ink)' : 'none'; dys[i].style.strokeWidth = 2;
      });
      var h = days[HI], hx = x0 + h.w * (cell + gap) + cell / 2, hy = y0 + h.d * (cell + gap) + cell / 2, q = glide(ms, 1600, 2100, [VW - 8, VH - 4], [hx + 4, hy + 4]);
      k.cur(q[0], q[1], false); k.tip(on, hx, hy - 10, '<b>' + (h.dt.getMonth() + 1) + '월 ' + h.dt.getDate() + '일(' + MON[h.d] + ')</b> 이슈 ' + h.v + '건 처리');
      return ms < 1100 ? '지난 ' + W + '주가 왼쪽부터 칠해짐' : on ? '날짜 칸 하나 · 값은 툴팁으로' : (steps ? '진하기 5단계(0은 회색)' : '진하기 연속') + ' · 한 줄이 한 요일';
    } };
  };

  S['histogram'] = function (st, c) {
    var nb = +c.bins, mean = c.mean === '평균선', MS = 3400, b = { x: 40, y: 18, w: 420, h: 172 }, N = 200, R = 15, vals = [];
    for (var i = 0; i < N; i++) vals.push(Math.min(R - 0.01, Math.exp(Math.log(3) + (prand(i, 9) + prand(i, 10) + prand(i, 11) - 1.5) * 1.1)));
    var bw = R / nb, cnt = []; for (var j = 0; j < nb; j++) cnt.push(0);
    vals.forEach(function (v) { cnt[Math.floor(v / bw)]++; });
    var max = niceMax(Math.max.apply(null, cnt) * 1.1), avg = vals.reduce(function (a, v) { return a + v; }, 0) / N, top = cnt.indexOf(Math.max.apply(null, cnt));
    var X = function (v) { return b.x + v / R * b.w; }, s = yAxis(b, max);
    [0, 3, 6, 9, 12, 15].forEach(function (v) { s += tx(X(v), b.y + b.h + 16, v + '일', 'middle', 'tk'); });
    cnt.forEach(function () { s += '<rect class="hb" style="fill:var(--c1)"/>'; });
    s += '<line class="mn" x1="' + X(avg) + '" x2="' + X(avg) + '" y1="' + b.y + '" y2="' + (b.y + b.h) + '" style="stroke:var(--c2);stroke-width:2;stroke-dasharray:5 4;opacity:0"/>' + tx(X(avg) + 6, b.y + 10, '평균 ' + avg.toFixed(1) + '일', '', 'mnt');
    var k = chartKit(st, s), hbs = k.q('.hb'), mn = k.q('.mn')[0], mnt = k.q('.mnt')[0];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2200 && ms < 3100;
      cnt.forEach(function (v, j) {
        var p = ease.out(seg(ms, 150 + j * (500 / nb), 650 + j * (500 / nb))), h = v / max * b.h * p;
        hbs[j].setAttribute('x', X(j * bw) + 0.5); hbs[j].setAttribute('width', Math.max(0.5, b.w / nb - 1)); hbs[j].setAttribute('y', b.y + b.h - h); hbs[j].setAttribute('height', h);
        hbs[j].style.opacity = on && j !== top ? 0.45 : 1;
      });
      var mo = mean ? seg(ms, 1200, 1500) : 0; mn.style.opacity = mo; mnt.style.opacity = mo;
      var hx = X((top + 0.5) * bw), hy = b.y + b.h - cnt[top] / max * b.h, q = glide(ms, 1700, 2200, [VW - 8, VH - 4], [hx + 4, hy + 18]);
      k.cur(q[0], q[1], false); k.tip(on, hx, hy - 10, '<b>' + fmt(top * bw, false, bw % 1 ? 1 : 0) + '~' + fmt((top + 1) * bw, false, bw % 1 ? 1 : 0) + '일</b> ' + cnt[top] + '건');
      return ms < 1100 ? '구간 ' + nb + '개 · 막대가 붙어 있음' : on ? '가장 많은 구간' : mean ? '평균선 · 오른쪽으로 꼬리가 김' : '이슈 ' + N + '건의 처리 일수 분포';
    } };
  };

  S['funnel-chart'] = function (st, c) {
    var cone = c.shape === '깔때기형', rate = c.show === '이전 단계 대비', D = [['접수', 120], ['분류', 96], ['진행', 71], ['검토', 52], ['완료', 44]], MS = 3400, HI = 3;
    var x0 = 70, W = 340, rowH = 40, bh = 26, y0 = 12, CXm = x0 + W / 2, s = '';
    D.forEach(function (d, i) { s += tx(x0 - 10, y0 + i * rowH + bh / 2 + 4, d[0], 'end', 'tk') + (i ? '<polygon class="cn" style="fill:var(--c1);opacity:.12"/>' : '') + '<path class="fb" style="fill:var(--c1)"/><text class="fv"></text>'; });
    var k = chartKit(st, s), fbs = k.q('.fb'), fvs = k.q('.fv'), cns = k.q('.cn');
    function g(i, p) { var w = d2w(i) * p, x = cone ? CXm - w / 2 : x0; return { x: x, y: y0 + i * rowH, w: w }; }
    function d2w(i) { return D[i][1] / D[0][1] * W; }
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2100 && ms < 3100;
      D.forEach(function (d, i) {
        var p = ease.out(seg(ms, 100 + i * 170, 550 + i * 170)), q = g(i, p);
        fbs[i].setAttribute('d', cone ? 'M' + q.x + ' ' + q.y + 'h' + q.w + 'v' + bh + 'h' + (-q.w) + 'Z' : barPath(q.x, q.y, q.w, bh, true));
        fvs[i].setAttribute('x', q.x + q.w + 8); fvs[i].setAttribute('y', q.y + bh / 2 + 4); fvs[i].style.opacity = seg(ms, 450 + i * 170, 650 + i * 170);
        fvs[i].textContent = rate && i ? Math.round(d[1] / D[i - 1][1] * 100) + '%' : d[1] + '건';
        if (i) { var a = g(i - 1, 1), bq = g(i, 1), y1 = a.y + bh + 1, y2 = bq.y - 1;
          cns[i - 1].setAttribute('points', cone ? [a.x + ',' + y1, (a.x + a.w) + ',' + y1, (bq.x + bq.w) + ',' + y2, bq.x + ',' + y2].join(' ') : [x0 + ',' + y1, (x0 + a.w) + ',' + y1, (x0 + bq.w) + ',' + y2, x0 + ',' + y2].join(' '));
          cns[i - 1].style.opacity = (on && i === HI ? 0.35 : 0.12) * seg(ms, 550 + i * 170, 700 + i * 170); }
      });
      var a = g(HI - 1, 1), hx = (cone ? CXm : x0 + a.w * 0.7), hy = y0 + HI * rowH - 7, q = glide(ms, 1600, 2100, [VW - 8, VH - 4], [hx + 4, hy + 4]), drop = D[HI - 1][1] - D[HI][1];
      k.cur(q[0], q[1], false); k.tip(on, hx, hy - 8, '<b>' + D[HI - 1][0] + ' → ' + D[HI][0] + '</b> ' + drop + '건 빠짐(' + Math.round(drop / D[HI - 1][1] * 100) + '%)');
      return ms < 1100 ? '단계가 위에서 아래로 줄어듦' : on ? '단계 사이에서 빠진 수' : (cone ? '깔때기형' : '막대형') + ' · ' + (rate ? '이전 단계 대비 %' : '건수');
    } };
  };

  S['gauge-ring'] = function (st, c) {
    var semi = c.shape === '반원 게이지', v = +c.value, TG = 80, MS = 3000, CX = 240, CY = semi ? 168 : 112, R = semi ? 118 : 86, sw2 = semi ? 22 : 18;
    var A = function (p) { return semi ? Math.PI * (1 - p) : Math.PI / 2 - Math.PI * 2 * p; }, P = function (p, r) { var a = A(p); return [CX + Math.cos(a) * r, CY - Math.sin(a) * r]; };
    var path = semi ? 'M' + P(0, R).join(' ') + 'A' + R + ' ' + R + ' 0 0 1 ' + P(1, R).join(' ') : 'M' + P(0, R).join(' ') + 'A' + R + ' ' + R + ' 0 1 1 ' + P(0.9999, R).join(' ');
    var t1 = P(TG / 100, R - sw2 / 2 - 4), t2 = P(TG / 100, R + sw2 / 2 + 4), tl = P(TG / 100, R + sw2 / 2 + 16);
    var s = '<path d="' + path + '" style="fill:none;stroke:var(--u-line);stroke-width:' + sw2 + ';stroke-linecap:round"/><path class="gv" d="' + path + '" pathLength="100" style="fill:none;stroke:var(--c1);stroke-width:' + sw2 + ';stroke-linecap:round"/>' +
      ln(t1[0], t1[1], t2[0], t2[1], 'stroke:var(--u-ink);stroke-width:2') + tx(tl[0], tl[1] + 4, '목표 ' + TG, 'middle', 'tk') +
      tx(CX, CY - (semi ? 18 : -4), '', 'middle', 'big') + tx(CX, CY + (semi ? 4 : 22), '스프린트 이슈 완료', 'middle', 'tk');
    if (semi) s += tx(CX - R, CY + 20, '0', 'middle', 'tk') + tx(CX + R, CY + 20, '100', 'middle', 'tk');
    var k = chartKit(st, s), gv = k.q('.gv')[0], big = k.q('.big')[0];
    k.noCursor();
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS, p = ease.out(seg(ms, 200, 1400)), now = v * p;
      gv.style.strokeDasharray = Math.max(0.01, now) + ' 100'; gv.style.opacity = v === 0 ? 0 : 1;
      big.textContent = Math.round(now) + '%';
      return ms < 1400 ? '원호가 0에서 ' + v + '%까지 참' : v >= TG ? '목표(' + TG + '%) 넘음' : '목표까지 ' + (TG - v) + '%p 남음';
    } };
  };

  /* ───── 표현 › 차트 › 차트 종류 (2차) ───── */
  S['waterfall-chart'] = function (st, c) {
    var link = c.connector === '연결선', sign = c.sign === '+/− 부호', MS = 3600, HI = 3;
    var D = [['지난주', 40, 1], ['새 이슈', 18], ['재오픈', 4], ['완료', -22], ['중복', -5], ['이번 주', 35, 1]];
    var lv = 0, G = D.map(function (d) { var a = d[2] ? 0 : lv, z = d[2] ? d[1] : lv + d[1]; lv = z; return { lo: Math.min(a, z), hi: Math.max(a, z), from: a, to: z, v: d[1], tot: !!d[2] }; });
    var max = niceMax(62), b = { x: 40, y: 18, w: 425, h: 176 }, band = b.w / D.length, th = band * 0.6, Y = function (v) { return b.y + b.h - v / max * b.h; }, s = yAxis(b, max);
    D.forEach(function (d, i) {
      var g = G[i], col = g.tot ? 'var(--u-muted)' : g.v > 0 ? 'var(--div-neg)' : 'var(--div-pos)';
      s += '<path class="wb" style="fill:' + col + '"/><text class="vl" text-anchor="middle"></text>' + tx(b.x + band * i + band / 2, b.y + b.h + 16, d[0], 'middle', 'tk');
      if (i < D.length - 1) s += '<line class="wl" x1="' + (b.x + band * i + (band + th) / 2) + '" x2="' + (b.x + band * (i + 1) + (band - th) / 2) + '" y1="' + Y(g.to) + '" y2="' + Y(g.to) + '" style="stroke:var(--u-muted);stroke-width:1;stroke-dasharray:3 2;opacity:0"/>';
    });
    s += '<rect x="' + (b.x + 250) + '" y="2" width="10" height="10" rx="2" style="fill:var(--div-neg)"/>' + tx(b.x + 264, 11, '늘어남', '', 'tk') + '<rect x="' + (b.x + 320) + '" y="2" width="10" height="10" rx="2" style="fill:var(--div-pos)"/>' + tx(b.x + 334, 11, '줄어듦', '', 'tk') + tx(b.x - 6, 10, '열린 이슈', 'start', 'tk');
    var k = chartKit(st, s), wbs = k.q('.wb'), vls = k.q('.vl'), wls = k.q('.wl');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2500 && ms < 3400;
      G.forEach(function (g, i) {
        var p = ease.out(seg(ms, 150 + i * 280, 450 + i * 280)), x = b.x + band * i + (band - th) / 2, cur = lerp(g.from, g.to, p), y1 = Y(Math.max(g.from, cur)), y2 = Y(Math.min(g.from, cur));
        wbs[i].setAttribute('d', 'M' + x + ' ' + y2 + 'V' + y1 + 'H' + (x + th) + 'V' + y2 + 'Z'); wbs[i].style.opacity = on && i !== HI ? 0.4 : 1;
        vls[i].setAttribute('x', x + th / 2); vls[i].setAttribute('y', Y(g.hi) - 6); vls[i].style.opacity = seg(ms, 400 + i * 280, 550 + i * 280);
        vls[i].textContent = g.tot ? g.v : (sign ? (g.v > 0 ? '+' : '−') : '') + Math.abs(g.v);
        if (wls[i]) wls[i].style.opacity = link ? seg(ms, 450 + i * 280, 560 + i * 280) * 0.8 : 0;
      });
      var g = G[HI], hx = b.x + band * HI + band / 2, q = glide(ms, 2000, 2500, [VW - 8, VH - 4], [hx + 4, Y((g.lo + g.hi) / 2) + 4]);
      k.cur(q[0], q[1], false); k.tip(on, hx, Y(g.hi) - 18, '<b>' + D[HI][0] + '</b> ' + g.v + '건 · ' + g.from + ' → ' + g.to);
      return ms < 1900 ? '전 막대 끝에서 다음 막대가 이어짐' : on ? '줄어든 칸 하나 · 앞뒤 값까지 툴팁' : '시작 40 → 끝 35 · ' + (link ? '연결선' : '연결선 없음') + ' · ' + (sign ? '+/− 부호' : '값만');
    } };
  };

  S['bullet-chart'] = function (st, c) {
    var R = [['완료율', 72, 80, '%', 100], ['기한 지킴', 88, 90, '%', 100], ['만족도', 4.1, 4.5, '점', 5]].slice(0, c.rows === '1개' ? 1 : 3), band = c.ranges === '3구간', MS = 3200;
    var x0 = 100, W = 270, rowH = R.length === 1 ? 120 : 66, y0 = R.length === 1 ? 70 : 20, bh = 24, s = '';
    R.forEach(function (r, i) {
      var y = y0 + i * rowH;
      s += tx(x0 - 10, y + bh / 2 + 4, r[0], 'end', 'vl');
      if (band) [[1, 10], [0.8, 18], [0.6, 28]].forEach(function (z) { s += '<rect class="rg" x="' + x0 + '" y="' + y + '" width="' + W * z[0] + '" height="' + bh + '" style="fill:color-mix(in oklab, var(--u-muted) ' + z[1] + '%, transparent)"/>'; });
      else s += '<rect class="rg" x="' + x0 + '" y="' + y + '" width="' + W + '" height="' + bh + '" style="fill:none;stroke:var(--u-line)"/>';
      s += '<path class="bm" style="fill:var(--c1)"/><line class="tg" x1="' + (x0 + r[2] / r[4] * W) + '" x2="' + (x0 + r[2] / r[4] * W) + '" y1="' + (y + 3) + '" y2="' + (y + bh - 3) + '" style="stroke:var(--u-ink);stroke-width:2.5"/><text class="fv" x="' + (x0 + W + 10) + '" y="' + (y + bh / 2 + 4) + '"></text>';
      [0, 0.5, 1].forEach(function (f) { s += tx(x0 + W * f, y + bh + 14, fmt(r[4] * f, false, r[4] < 10 ? 1 : 0).replace('.0', ''), 'middle', 'tk'); });
    });
    var k = chartKit(st, s), bms = k.q('.bm'), tgs = k.q('.tg'), fvs = k.q('.fv'), rgs = k.q('.rg');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2200 && ms < 3000;
      rgs.forEach(function (e) { e.style.opacity = seg(ms, 50, 350); });
      R.forEach(function (r, i) {
        var p = ease.out(seg(ms, 300 + i * 150, 1100 + i * 150)), y = y0 + i * rowH, w = r[1] / r[4] * W * p;
        bms[i].setAttribute('d', barPath(x0, y + bh / 3, w, bh / 3, true)); bms[i].style.opacity = on && i ? 0.4 : 1;
        tgs[i].style.opacity = seg(ms, 1000 + i * 150, 1150 + i * 150);
        fvs[i].textContent = (r[4] < 10 ? (r[1] * p).toFixed(1) : Math.round(r[1] * p)) + r[3] + ' / 목표 ' + r[2];
      });
      var r = R[0], bx = x0 + r[1] / r[4] * W, q = glide(ms, 1700, 2200, [VW - 8, VH - 4], [bx - 10, y0 + bh / 2 + 4]), gap = Math.round((r[2] - r[1]) * 10) / 10;
      k.cur(q[0], q[1], false); k.tip(on, bx - 10, y0 - 4, '<b>' + r[0] + '</b> ' + r[1] + r[3] + ' · 목표까지 ' + gap + (r[3] === '%' ? '%p' : r[3]));
      return ms < 1300 ? '값 막대가 자라고 목표 눈금이 섬' : on ? '목표까지 남은 거리' : '지표 ' + R.length + '개 · ' + (band ? '나쁨·보통·좋음 3구간' : '구간 없음');
    } };
  };

  S['lollipop-chart'] = function (st, c) {
    var D = [['로그인', 22], ['검색', 19], ['결제', 28], ['채팅', 5], ['알림', 15], ['설정', 12], ['업로드', 7], ['프로필', 9]], avgB = c.base === '평균 기준', MS = 3200;
    if (c.sort === '큰 순서') D = D.slice().sort(function (a, b) { return b[1] - a[1]; });
    var avg = D.reduce(function (a, d) { return a + d[1]; }, 0) / D.length, b = { x: 70, y: 8, w: 380, h: 190 }, rh = b.h / D.length, X = function (v) { return b.x + v / 30 * b.w; }, s = '';
    [0, 10, 20, 30].forEach(function (v, i) { s += ln(X(v), b.y, X(v), b.y + b.h, i ? GRID : BASE) + tx(X(v), b.y + b.h + 16, v, 'middle', 'tk'); });
    if (avgB) s += ln(X(avg), b.y - 2, X(avg), b.y + b.h, 'stroke:var(--u-ink);stroke-width:1.5') + tx(X(avg) + 4, b.y + b.h + 30, '평균 ' + avg.toFixed(1), 'start', 'tk');
    s += tx(b.x + b.w, b.y + b.h + 30, '기능별 열린 이슈 →', 'end', 'tk');
    D.forEach(function (d, i) { var y = b.y + rh * i + rh / 2; s += tx(b.x - 8, y + 4, d[0], 'end', 'tk') + '<line class="lp" y1="' + y + '" y2="' + y + '" style="stroke:var(--c1);stroke-width:2"/><circle class="ld" cy="' + y + '" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/><text class="vl" y="' + (y + 4) + '"></text>'; });
    var k = chartKit(st, s), lps = k.q('.lp'), lds = k.q('.ld'), vls = k.q('.vl'), top = D.reduce(function (m, d, i) { return d[1] > D[m][1] ? i : m; }, 0);
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2100 && ms < 2950;
      D.forEach(function (d, i) {
        var p = ease.out(seg(ms, 150 + i * 80, 650 + i * 80)), x1 = X(avgB ? avg : 0), x2 = lerp(x1, X(d[1]), p), up = d[1] >= avg || !avgB;
        lps[i].setAttribute('x1', x1); lps[i].setAttribute('x2', x2); lds[i].setAttribute('cx', x2); lds[i].setAttribute('r', 5.5 * ease.out(seg(ms, 550 + i * 80, 750 + i * 80)));
        lps[i].style.opacity = lds[i].style.opacity = on && i !== top ? 0.4 : 1;
        vls[i].textContent = d[1]; vls[i].setAttribute('x', x2 + (up ? 10 : -10)); vls[i].setAttribute('text-anchor', up ? 'start' : 'end'); vls[i].style.opacity = seg(ms, 700 + i * 80, 850 + i * 80);
      });
      var y = b.y + rh * top + rh / 2, q = glide(ms, 1600, 2100, [VW - 8, VH - 4], [X(D[top][1]) + 4, y + 4]);
      k.cur(q[0], q[1], false); k.tip(on, X(D[top][1]), y - 10, '<b>' + D[top][0] + '</b> ' + D[top][1] + '건' + (avgB ? ' · 평균보다 +' + (D[top][1] - avg).toFixed(1) : ''));
      return ms < 1200 ? '막대 대신 가는 선과 끝 점' : on ? '가장 큰 항목 하나' : (avgB ? '평균에서 위아래로 뻗음' : '0에서 뻗음') + ' · ' + c.sort;
    } };
  };

  S['dumbbell-chart'] = function (st, c) {
    var D = [['앱', 6.2, 3.8], ['웹', 5.1, 4.6], ['결제', 7.4, 4.1], ['정산', 4.0, 4.4], ['검색', 5.8, 5.0]], gapOnly = c.label === '차이만', MS = 3400;
    if (c.sort === '차이 큰 순서') D = D.slice().sort(function (a, b) { return Math.abs(b[2] - b[1]) - Math.abs(a[2] - a[1]); });
    var b = { x: 60, y: 30, w: 390, h: 164 }, rh = b.h / D.length, X = function (v) { return b.x + v / 8 * b.w; }, s = '', HI = D.map(function (d) { return d[0]; }).indexOf('결제');
    [0, 2, 4, 6, 8].forEach(function (v, i) { s += ln(X(v), b.y, X(v), b.y + b.h, i ? GRID : BASE) + tx(X(v), b.y + b.h + 16, v + (v === 8 ? '일' : ''), 'middle', 'tk'); });
    s += '<circle cx="' + (b.x + 4) + '" cy="10" r="5" style="fill:var(--u-muted)"/>' + tx(b.x + 14, 14, '지난 분기', '', 'tk') + '<circle cx="' + (b.x + 84) + '" cy="10" r="5" style="fill:var(--c1)"/>' + tx(b.x + 94, 14, '이번 분기', '', 'tk') + tx(b.x + b.w, 14, '평균 처리 일수', 'end', 'tk');
    D.forEach(function (d, i) { var y = b.y + rh * i + rh / 2; s += tx(b.x - 8, y + 4, d[0], 'end', 'tk') + '<line class="db" y1="' + y + '" y2="' + y + '" style="stroke:var(--u-muted);stroke-width:2;opacity:.5"/><circle class="d0" cx="' + X(d[1]) + '" cy="' + y + '" r="6" style="fill:var(--u-muted);stroke:var(--u-panel);stroke-width:2"/><circle class="d1" cy="' + y + '" r="6" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/><text class="in" y="' + (y + 4) + '"></text><text class="in" y="' + (y + 4) + '"></text>'; });
    var k = chartKit(st, s), dbs = k.q('.db'), d0 = k.q('.d0'), d1 = k.q('.d1'), ins = k.q('.in');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2400 && ms < 3250;
      D.forEach(function (d, i) {
        var p = ease.inOut(seg(ms, 700 + i * 120, 1300 + i * 120)), x = lerp(X(d[1]), X(d[2]), p), dn = d[2] < d[1], dim = on && i !== HI ? 0.35 : 1;
        d0[i].style.opacity = seg(ms, 100 + i * 80, 300 + i * 80) * dim; d1[i].setAttribute('cx', x); d1[i].style.opacity = seg(ms, 650 + i * 120, 750 + i * 120) * dim;
        dbs[i].setAttribute('x1', X(d[1])); dbs[i].setAttribute('x2', x); dbs[i].style.opacity = 0.5 * dim;
        var a = ins[i * 2], z = ins[i * 2 + 1], lo = Math.min(X(d[1]), X(d[2])), hi = Math.max(X(d[1]), X(d[2])), f = seg(ms, 1300 + i * 120, 1450 + i * 120) * dim;
        if (gapOnly) { a.textContent = (dn ? '−' : '+') + Math.abs(d[2] - d[1]).toFixed(1); a.setAttribute('x', hi + 12); a.setAttribute('text-anchor', 'start'); z.textContent = ''; }
        else { a.textContent = (dn ? d[2] : d[1]).toFixed(1); a.setAttribute('x', lo - 11); a.setAttribute('text-anchor', 'end'); z.textContent = (dn ? d[1] : d[2]).toFixed(1); z.setAttribute('x', hi + 11); z.setAttribute('text-anchor', 'start'); }
        a.style.opacity = z.style.opacity = f; a.style.fill = z.style.fill = 'var(--u-ink)';
      });
      var d = D[HI], y = b.y + rh * HI + rh / 2, mx = (X(d[1]) + X(d[2])) / 2, q = glide(ms, 1900, 2400, [VW - 8, VH - 4], [mx + 4, y + 4]);
      k.cur(q[0], q[1], false); k.tip(on, mx, y - 10, '<b>' + d[0] + '</b> ' + d[1] + '일 → ' + d[2] + '일 (−' + (d[1] - d[2]).toFixed(1) + '일)');
      return ms < 1900 ? '지난 분기 점에서 이번 분기 점으로 늘어남' : on ? '가장 많이 줄어든 팀' : '두 시점 차이 · ' + c.sort + ' · ' + (gapOnly ? '차이만' : '양 끝 값');
    } };
  };

  S['slope-chart'] = function (st, c) {
    var D = [['앱', 42, 58], ['웹', 51, 47], ['결제', 38, 52], ['정산', 30, 33], ['검색', 47, 40], ['운영', 25, 29]], focus = c.focus === '크게 오른 것만 강조', both = c.labels === '양쪽 이름·값', MS = 3400, HI = 2;
    var L = 160, Rx = 320, Y = function (v) { return 26 + (62 - v) / 40 * 176; }, s = tx(L, 14, '1분기', 'middle', 'tk') + tx(Rx, 14, '4분기', 'middle', 'tk') + ln(L, 22, L, 206, BASE) + ln(Rx, 22, Rx, 206, BASE);
    D.forEach(function (d) { var big = d[2] - d[1] >= 10; s += '<line class="sl" pathLength="1" x1="' + L + '" y1="' + Y(d[1]) + '" x2="' + Rx + '" y2="' + Y(d[2]) + '" style="stroke:' + (big || !focus ? 'var(--c1)' : 'var(--c-other)') + ';stroke-width:' + (big && focus ? 2.5 : 2) + ';stroke-dasharray:1"/><circle class="s0" cx="' + L + '" cy="' + Y(d[1]) + '" r="4.5" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/><circle class="s1" cx="' + Rx + '" cy="' + Y(d[2]) + '" r="4.5" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/>' + (both ? tx(L - 10, Y(d[1]) + 4, d[0] + ' ' + d[1], 'end', 'la') : '') + tx(Rx + 10, Y(d[2]) + 4, d[2] + ' ' + d[0] + (d[2] > d[1] ? ' ▲' : ' ▼'), '', 'la'); });
    s += tx(VW - 6, 222, '팀별 처리 건수', 'end', 'tk');
    var k = chartKit(st, s), sls = k.q('.sl'), s0 = k.q('.s0'), s1 = k.q('.s1'), las = k.q('.la');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2400 && ms < 3250, fo = focus ? seg(ms, 1600, 1900) : 0;
      D.forEach(function (d, i) {
        var big = d[2] - d[1] >= 10, dim = on && i !== HI ? 0.3 : !big ? 1 - fo * 0.55 : 1;
        sls[i].style.strokeDashoffset = 1 - ease.inOut(seg(ms, 500 + i * 60, 1300 + i * 60)); sls[i].style.opacity = dim;
        s0[i].style.opacity = seg(ms, 100 + i * 50, 300 + i * 50) * dim; s1[i].style.opacity = seg(ms, 1250 + i * 60, 1400 + i * 60) * dim; s1[i].style.fill = s0[i].style.fill = big || !focus ? 'var(--c1)' : 'var(--c-other)';
      });
      las.forEach(function (e, j) { var i = both ? j >> 1 : j, big = D[i][2] - D[i][1] >= 10; e.style.opacity = seg(ms, both && !(j & 1) ? 200 : 1350, both && !(j & 1) ? 400 : 1550) * (on && i !== HI ? 0.3 : !big ? 1 - fo * 0.4 : 1); e.style.fill = 'var(--u-ink)'; });
      var d = D[HI], mx = (L + Rx) / 2, my = (Y(d[1]) + Y(d[2])) / 2, q = glide(ms, 1900, 2400, [VW - 8, VH - 4], [mx + 4, my + 4]);
      k.cur(q[0], q[1], false); k.tip(on, mx, my - 10, '<b>' + d[0] + '</b> ' + d[1] + ' → ' + d[2] + ' (+' + (d[2] - d[1]) + ')');
      return ms < 1500 ? '왼쪽 시점에서 오른쪽 시점으로 선이 그어짐' : on ? '기울기 = 바뀐 크기' : focus ? '크게 오른 2개만 진하게' : '모든 선이 같은 색';
    } };
  };

  S['bubble-chart'] = function (st, c) {
    var D = [['앱', 96, 3.8, 12], ['운영', 85, 7.2, 10], ['웹', 70, 4.6, 8], ['결제', 40, 4.1, 6], ['검색', 58, 5.0, 5], ['정산', 28, 6.4, 3], ['인프라', 18, 2.5, 2]], area = c.size === '넓이 비례', all = c.labels === '모두 이름', MS = 3400, HI = 1, RM = 26;
    var b = { x: 40, y: 12, w: 420, h: 178 }, X = function (v) { return b.x + v / 120 * b.w; }, Y = function (v) { return b.y + b.h - v / 12 * b.h; }, R = function (z) { return area ? RM * Math.sqrt(z / 12) : RM * z / 12; }, s = yAxis(b, 12, '일');
    [0, 30, 60, 90, 120].forEach(function (v) { s += tx(X(v), b.y + b.h + 16, v, 'middle', 'tk'); });
    s += tx(b.x + b.w, b.y + b.h + 30, '처리 건수 →', 'end', 'tk') + tx(b.x, b.y + b.h + 30, '원 크기 = 팀 인원(' + (area ? '넓이' : '지름') + ')', 'start', 'tk');
    D.forEach(function (d) { s += '<circle class="bb" cx="' + X(d[1]) + '" cy="' + Y(d[2]) + '" style="fill:var(--c1);fill-opacity:.5;stroke:var(--u-panel);stroke-width:1.5"/>' + (all || d[3] >= 8 ? tx(X(d[1]), Y(d[2]) + 4, d[0], 'middle', 'la') : ''); });
    var k = chartKit(st, s), bbs = k.q('.bb'), las = k.q('.la');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2300 && ms < 3200;
      D.forEach(function (d, i) { bbs[i].setAttribute('r', R(d[3]) * ease.out(seg(ms, 100 + i * 120, 600 + i * 120))); bbs[i].style.opacity = on && i !== HI ? 0.4 : 1; });
      las.forEach(function (e) { e.style.opacity = seg(ms, 1000, 1250); e.style.fill = 'var(--u-ink)'; });
      var d = D[HI], q = glide(ms, 1800, 2300, [VW - 8, VH - 4], [X(d[1]) + 6, Y(d[2]) + 6]);
      k.cur(q[0], q[1], false); k.tip(on, X(d[1]), Y(d[2]) - R(d[3]) - 6, '<b>' + d[0] + '</b> ' + d[1] + '건 · ' + d[2] + '일 · ' + d[3] + '명');
      return ms < 1100 ? '원이 차례로 커짐' : on ? '세 값(건수·일수·인원)을 한 점에' : area ? '넓이가 인원에 비례' : '지름 비례 · 큰 값이 실제보다 훨씬 커 보임';
    } };
  };

  S['waffle-chart'] = function (st, c) {
    var three = c.series === '3개(구성)', col = c.fill === '세로 줄 순서', MS = 3400, HI = 1;
    var P = three ? [['완료', 58], ['진행', 24], ['대기', 18]] : [['완료', 58], ['남음', 42]], cs = 17, gap = 2, x0 = 70, y0 = 20, s = '', owner = [];
    P.forEach(function (p, j) { for (var n = 0; n < p[1]; n++) owner.push(j); });
    for (var i = 0; i < 100; i++) { var r = col ? i % 10 : Math.floor(i / 10), q = col ? Math.floor(i / 10) : i % 10; s += '<rect class="wc" x="' + (x0 + q * (cs + gap)) + '" y="' + (y0 + (9 - r) * (cs + gap)) + '" width="' + cs + '" height="' + cs + '" rx="3"/>'; }
    P.forEach(function (p, j) { var y = y0 + 30 + j * 34, fill = !three && j ? 'var(--u-line)' : CC[j]; s += '<rect class="lg" x="290" y="' + (y - 11) + '" width="14" height="14" rx="3" style="fill:' + fill + '"/>' + tx(312, y, p[0], '', 'vl') + tx(312 + 46, y, p[1] + '칸 = ' + p[1] + '%', '', 'tk'); });
    s += tx(290, y0 + 4, '이슈 100건 중', '', 'tk') + tx(290, y0 + 170, '한 칸 = 이슈 1건', '', 'tk');
    var k = chartKit(st, s), wcs = k.q('.wc');
    wcs.forEach(function (e, i) { e.style.fill = !three && owner[i] ? 'var(--u-line)' : CC[owner[i]]; });
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = three && ms > 2200 && ms < 3100;
      wcs.forEach(function (e, i) { e.style.opacity = seg(ms, 100 + i * 12, 220 + i * 12) * (on && owner[i] !== HI ? 0.25 : 1); });
      var q = glide(ms, 1700, 2200, [VW - 8, VH - 4], [300, y0 + 30 + HI * 34 - 2]);
      if (three) k.cur(q[0], q[1], false); else k.cur(VW - 8, VH - 4, false);
      k.tip(on, 330, y0 + 30 + HI * 34 - 18, '<b>' + P[HI][0] + '</b> ' + P[HI][1] + '칸 = ' + P[HI][1] + '%');
      return ms < 1350 ? '칸이 ' + (col ? '세로 줄' : '가로 줄') + ' 순서로 채워짐' : on ? '범례를 가리키면 그 칸만 남음' : three ? '100칸 = 100% · 3개 구성' : '100칸 중 58칸 완료';
    } };
  };

  // 트리맵 배치. 비율 맞춤(squarify): 큰 값부터 한 줄에 넣다가 칸이 길쭉해지면 새 줄. slice는 한 방향으로만 자른다
  function treeLayout(vals, r, slice, vert) {
    var tot = vals.reduce(function (a, v) { return a + v; }, 0), out = [], x = r.x, y = r.y, w = r.w, h = r.h, row = [], i = 0, k = r.w * r.h / tot;
    if (slice) { var o = 0; vals.forEach(function (v) { var f = v / tot; out.push(vert ? { x: r.x, y: r.y + o * r.h, w: r.w, h: f * r.h } : { x: r.x + o * r.w, y: r.y, w: f * r.w, h: r.h }); o += f; }); return out; }
    function worst(rw, side) { var s = 0, mx = 0, mn = Infinity; rw.forEach(function (a) { s += a; mx = Math.max(mx, a); mn = Math.min(mn, a); }); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); }
    function place(rw) {
      var s = rw.reduce(function (a, b) { return a + b; }, 0);
      if (w >= h) { var cw = s / h, yy = y; rw.forEach(function (a) { out.push({ x: x, y: yy, w: cw, h: a / cw }); yy += a / cw; }); x += cw; w -= cw; }
      else { var rh = s / w, xx = x; rw.forEach(function (a) { out.push({ x: xx, y: y, w: a / rh, h: rh }); xx += a / rh; }); y += rh; h -= rh; }
    }
    while (i < vals.length) { var a = vals[i] * k, side = Math.min(w, h); if (!row.length || worst(row.concat([a]), side) <= worst(row, side)) { row.push(a); i++; } else { place(row); row = []; } }
    if (row.length) place(row);
    return out;
  }
  // 점을 지나는 부드러운 곡선(Catmull-Rom → 베지어). lead는 'M' 또는 'L'
  function smoothPath(P, lead, smooth) {
    var f = function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }, d = lead + f(P[0]);
    for (var i = 0; i < P.length - 1; i++) {
      if (!smooth) { d += 'L' + f(P[i + 1]); continue; }
      var a = P[i - 1] || P[i], b = P[i], c = P[i + 1], e = P[i + 2] || c;
      d += 'C' + f([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6]) + ' ' + f([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6]) + ' ' + f(c);
    }
    return d;
  }
  var HALO = 'paint-order:stroke;stroke:var(--u-panel);stroke-width:3;stroke-linejoin:round';

  S['treemap'] = function (st, c) {
    var D = [['앱', [16, 10, 8]], ['운영', [14, 6, 6]], ['웹', [8, 7, 5]], ['검색', [6, 5, 3]], ['결제', [5, 3, 2]], ['정산', [3, 2, 1]], ['인프라', [2, 1, 1]]], TY = ['버그', '기능', '개선'];
    var two = c.depth === '팀 › 유형', slice = c.layout === '한 방향으로 자르기', MS = 3400, b = { x: 4, y: 4, w: 472, h: 200 }, tot = 114, cells = [], s = '';
    var sums = D.map(function (d) { return d[1].reduce(function (a, v) { return a + v; }, 0); }), R = treeLayout(sums, b, slice, false);
    function mix(col) { return 'color-mix(in oklab, ' + col + ' 45%, var(--u-panel))'; }
    D.forEach(function (d, i) {
      var r = R[i];
      if (!two) { cells.push({ r: r, team: i, v: sums[i], fill: mix(CC[0]), name: d[0] }); return; }
      var hd = r.w >= 44 && r.h >= 44 ? 16 : 0;
      s += '<rect x="' + (r.x + 0.5) + '" y="' + (r.y + 0.5) + '" width="' + (r.w - 1) + '" height="' + (r.h - 1) + '" rx="4" class="tf" style="fill:var(--u-line);opacity:.6"/>' + (hd ? tx(r.x + 6, r.y + 12, d[0] + ' ' + sums[i], '', 'vl tfl') : '');
      treeLayout(d[1], { x: r.x + 2, y: r.y + 2 + hd, w: r.w - 4, h: r.h - 4 - hd }, slice, true).forEach(function (q, j) { cells.push({ r: q, team: i, ty: j, v: d[1][j], fill: mix(CC[j]), name: TY[j] }); });
    });
    cells.forEach(function (e) {
      var r = e.r, big = r.w >= 40 && r.h >= (two ? 18 : 30);
      s += '<rect class="tc" rx="3" style="fill:' + e.fill + ';stroke:var(--u-panel);stroke-width:2"/>';
      if (big) s += two ? tx(r.x + 5, r.y + 13, e.name + ' ' + e.v, '', 'in tcl') : tx(r.x + 7, r.y + 17, e.name, '', 'vl tcl') + (r.h >= 40 ? tx(r.x + 7, r.y + 32, e.v + '건', '', 'tcl') : '');
    });
    if (two) TY.forEach(function (n, j) { s += '<rect x="' + (6 + j * 52) + '" y="212" width="10" height="10" rx="2" style="fill:' + mix(CC[j]) + '"/>' + tx(20 + j * 52, 221, n, '', 'tk'); });
    s += tx(VW - 6, 221, '칸 넓이 = 열린 이슈 수 (모두 ' + tot + '건)', 'end', 'tk');
    var k = chartKit(st, s), tcs = k.q('.tc'), tcl = k.q('.tcl'), tfs = k.q('.tf'), tfl = k.q('.tfl'), HI = two ? cells.map(function (e) { return e.team === 1 && e.ty === 0; }).indexOf(true) : 1;
    tcl.forEach(function (e) { e.style.fill = 'var(--u-ink)'; });
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2400 && ms < 3250, e = cells[HI], r = e.r;
      cells.forEach(function (e, i) {
        var p = ease.out(seg(ms, 100 + i * 55, 500 + i * 55)), q = e.r, w = Math.max(0, (q.w - 2) * p), h = Math.max(0, (q.h - 2) * p);
        tcs[i].setAttribute('x', q.x + q.w / 2 - w / 2); tcs[i].setAttribute('y', q.y + q.h / 2 - h / 2); tcs[i].setAttribute('width', w); tcs[i].setAttribute('height', h);
        tcs[i].style.opacity = on && i !== HI ? 0.35 : 1;
      });
      tcl.forEach(function (e) { e.style.opacity = seg(ms, 1500, 1800) * (on ? 0.5 : 1); });
      tfs.forEach(function (e) { e.style.opacity = 0.6 * seg(ms, 0, 250); }); tfl.forEach(function (e) { e.style.opacity = seg(ms, 1500, 1800); });
      var q = glide(ms, 2000, 2400, [VW - 8, VH - 4], [r.x + r.w / 2, r.y + r.h / 2 + 6]);
      k.cur(q[0], q[1], false);
      k.tip(on, r.x + r.w / 2, r.y + r.h / 2 - 6, two ? '<b>' + D[e.team][0] + ' › ' + e.name + '</b> ' + e.v + '건 · ' + D[e.team][0] + '의 ' + Math.round(e.v / sums[e.team] * 100) + '%' : '<b>' + e.name + '</b> ' + e.v + '건 · 전체의 ' + Math.round(e.v / tot * 100) + '%');
      return ms < 1700 ? '넓이가 값인 칸이 차례로 생김' : on ? '칸 하나 · 몫까지 툴팁' : slice ? '한 방향으로만 잘라 가는 칸이 생김 · 넓이 비교가 어려움' : two ? '팀 칸 안에 유형 칸 · 2단계' : '정사각형에 가까운 칸 · 1단계';
    } };
  };

  S['sankey-diagram'] = function (st, c) {
    var three = c.stages === '3단계', gray = c.color === '회색 + 가리킨 흐름만', MS = 3600, HT = 2;
    var COL = [[['고객 문의', 40], ['내부 발견', 30], ['모니터링', 20]], [['앱', 34], ['웹', 26], ['운영', 30]], [['해결', 68], ['보류', 15], ['중복', 7]]], HD = ['접수 경로', '담당 팀', '결과'];
    var LK = [[0, 0, 0, 18], [0, 0, 1, 14], [0, 0, 2, 8], [0, 1, 0, 12], [0, 1, 1, 10], [0, 1, 2, 8], [0, 2, 0, 4], [0, 2, 1, 2], [0, 2, 2, 14],
      [1, 0, 0, 26], [1, 0, 1, 5], [1, 0, 2, 3], [1, 1, 0, 18], [1, 1, 1, 6], [1, 1, 2, 2], [1, 2, 0, 24], [1, 2, 1, 4], [1, 2, 2, 2]];
    if (!three) { COL = COL.slice(0, 2); LK = LK.filter(function (l) { return !l[0]; }); }
    var XS = three ? [96, 235, 374] : [150, 330], NW = 10, top = 24, gap = 12, kk = (186 - gap * 2) / 90, s = '', N = [];
    COL.forEach(function (col, ci) {
      var y = top; N.push(col.map(function (n) { var o = { x: XS[ci], y: y, h: n[1] * kk, so: 0, ti: 0 }; y += o.h + gap; return o; }));
      s += tx(XS[ci] + NW / 2, 13, HD[ci], 'middle', 'tk');
    });
    var G = LK.map(function (l) {
      var a = N[l[0]][l[1]], z = N[l[0] + 1][l[2]], w = l[3] * kk, g = { x0: a.x + NW, x1: z.x, sy: a.y + a.so, ty: z.y + z.ti, w: w, team: l[0] ? l[1] : l[2], st: l[0] };
      a.so += w; z.ti += w; return g;
    });
    G.forEach(function (g) { s += '<path class="sk" style="fill:' + (gray ? 'var(--u-muted)' : CC[g.team]) + '"/>'; });
    COL.forEach(function (col, ci) {
      col.forEach(function (n, i) {
        var o = N[ci][i], last = ci === COL.length - 1;
        s += '<rect class="sn" x="' + o.x + '" y="' + o.y + '" width="' + NW + '" height="' + o.h + '" rx="2" style="fill:' + (ci === 1 && !gray ? CC[i] : 'var(--u-muted)') + '"/>';
        s += tx(ci ? o.x + NW + 6 : o.x - 6, o.y + o.h / 2 + 4, '<tspan class="snm">' + n[0] + '</tspan> ' + n[1], ci ? 'start' : 'end', 'skl');
      });
    });
    var k = chartKit(st, s), sks = k.q('.sk'), sns = k.q('.sn'), skl = k.q('.skl'), hn = N[1][HT];
    skl.forEach(function (e) { e.style.cssText = HALO; }); k.q('.snm').forEach(function (e) { e.style.fill = 'var(--u-ink)'; e.style.fontWeight = 600; });
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2500 && ms < 3400;
      sns.forEach(function (e, i) { e.style.opacity = seg(ms, 50 + i * 40, 350 + i * 40); });
      skl.forEach(function (e) { e.style.opacity = seg(ms, 300, 600); });
      G.forEach(function (g, i) {
        var p = ease.inOut(seg(ms, 450 + g.st * 650 + (i % 9) * 40, 1100 + g.st * 650 + (i % 9) * 40)), x1 = lerp(g.x0, g.x1, p), ty = lerp(g.sy, g.ty, p), xm = (g.x0 + x1) / 2, mine = g.team === HT;
        sks[i].setAttribute('d', p <= 0 ? 'M0 0' : 'M' + g.x0 + ' ' + g.sy + 'C' + xm + ' ' + g.sy + ' ' + xm + ' ' + ty + ' ' + x1 + ' ' + ty + 'V' + (ty + g.w) + 'C' + xm + ' ' + (ty + g.w) + ' ' + xm + ' ' + (g.sy + g.w) + ' ' + g.x0 + ' ' + (g.sy + g.w) + 'Z');
        sks[i].style.opacity = on ? (mine ? 0.6 : 0.1) : 0.35;
        sks[i].style.fill = gray ? (on && mine ? 'var(--c1)' : 'var(--u-muted)') : CC[g.team];
      });
      var q = glide(ms, 2100, 2500, [VW - 8, VH - 4], [hn.x + NW / 2 + 2, hn.y + hn.h / 2 + 4]);
      k.cur(q[0], q[1], false); k.tip(on, hn.x + NW / 2, hn.y - 4, '<b>운영</b> 들어옴 30 · 모니터링에서 14' + (three ? ' · 해결 24' : ''));
      return ms < 1900 ? '띠 너비 = 흐름 양' : on ? '팀을 가리키면 그 흐름만 남음' : (three ? '3단계' : '2단계') + ' · ' + (gray ? '회색 흐름' : '팀 색 흐름');
    } };
  };

  S['radar-chart'] = function (st, c) {
    var AX = ['속도', '품질', '응답', '문서', '테스트', '배포'], SR = [['앱 팀', [4, 3, 5, 2, 3, 4]], ['웹 팀', [3, 4, 3, 4, 4, 2]]].slice(0, c.series === '1개' ? 1 : 2), fill = c.fill === '옅게 채움', MS = 3400, cx = 240, cy = 120, R = 86, s = '';
    var P = function (i, v) { var a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; }, pts = function (v) { return v.map(function (x, i) { return P(i, x).map(function (n) { return n.toFixed(1); }).join(','); }).join(' '); };
    for (var v = 1; v <= 5; v++) s += '<polygon points="' + pts([v, v, v, v, v, v]) + '" style="fill:none;' + (v < 5 ? GRID : BASE) + '"/>' + (v % 2 ? '' : tx(cx + 4, P(0, v)[1] + 11, v, 'start', 'tk'));
    AX.forEach(function (n, i) { var e = P(i, 5), l = P(i, 5.85), co = Math.cos(-Math.PI / 2 + i * Math.PI / 3); s += ln(cx, cy, e[0], e[1], GRID) + tx(l[0], l[1] + 4, n, Math.abs(co) < 0.1 ? 'middle' : co > 0 ? 'start' : 'end', 'vl'); });
    SR.forEach(function (r, j) { s += '<polygon class="rp" style="fill:' + CC[j] + ';fill-opacity:' + (fill ? 0.18 : 0) + ';stroke:' + CC[j] + ';stroke-width:2;stroke-linejoin:round"/>' + r[1].map(function () { return '<circle class="rd" r="3.5" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:1.5"/>'; }).join('') + '<rect x="8" y="' + (6 + j * 18) + '" width="10" height="10" rx="2" style="fill:' + CC[j] + '"/>' + tx(22, 15 + j * 18, r[0], '', 'tk'); });
    s += tx(VW - 6, 221, '팀 역량 점수(0~5)', 'end', 'tk');
    var k = chartKit(st, s), rps = k.q('.rp'), rds = k.q('.rd'), hp = P(2, SR[0][1][2]);
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2400 && ms < 3250;
      SR.forEach(function (r, j) {
        var p = ease.out(seg(ms, 200 + j * 450, 1000 + j * 450)), dim = on && j ? 0.3 : 1;
        rps[j].setAttribute('points', pts(r[1].map(function (x) { return x * p; }))); rps[j].style.opacity = (p > 0 ? 1 : 0) * dim;
        r[1].forEach(function (x, i) { var d = rds[j * 6 + i], q = P(i, x * p); d.setAttribute('cx', q[0]); d.setAttribute('cy', q[1]); d.style.opacity = seg(ms, 800 + j * 450, 1000 + j * 450) * dim; });
      });
      var q = glide(ms, 2000, 2400, [VW - 8, VH - 4], [hp[0] + 4, hp[1] + 4]);
      k.cur(q[0], q[1], false); k.tip(on, hp[0], hp[1] - 8, '<b>앱 팀 · 응답</b> 5점' + (SR.length > 1 ? ' · 웹 팀 3점' : ''));
      return ms < 1500 ? '중심에서 다각형이 펼쳐짐' : on ? '꼭짓점 하나 · 같은 축의 다른 팀 값까지' : '계열 ' + SR.length + '개 · ' + (fill ? '옅게 채움' : '선만');
    } };
  };

  S['boxplot'] = function (st, c) {
    var dots = c.points === '점 함께', iqr = c.whisker === '1.5×IQR', MS = 3400, HI = 2;
    var D = [['앱', 4, 1.2, [10.5]], ['웹', 3, 0.8, [7.2]], ['결제', 6, 1.8, []], ['정산', 2.5, 0.6, [6, 6.8]]].map(function (g, gi) {
      var v = []; for (var i = 0; i < 24; i++) v.push(Math.max(0.3, Math.round((g[1] + g[2] * 2 * (prand(i, gi * 9) + prand(i, gi * 9 + 3) + prand(i, gi * 9 + 5) - 1.5)) * 10) / 10));
      v = v.concat(g[3]).sort(function (a, b) { return a - b; });
      var q = function (p) { var x = (v.length - 1) * p, lo = Math.floor(x); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (x - lo); }, q1 = q(0.25), q3 = q(0.75), f = 1.5 * (q3 - q1);
      var inn = iqr ? v.filter(function (x) { return x >= q1 - f && x <= q3 + f; }) : v;
      return { name: g[0], v: v, q1: q1, md: q(0.5), q3: q3, lo: inn[0], hi: inn[inn.length - 1], out: iqr ? v.filter(function (x) { return inn.indexOf(x) < 0; }) : [] };
    });
    var b = { x: 40, y: 18, w: 420, h: 176 }, band = b.w / 4, bw = 36, Y = function (v) { return b.y + b.h - v / 12 * b.h; }, s = yAxis(b, 12, '일');
    s += tx(VW - 6, 10, '상자 = 가운데 절반 · 굵은 선 = 중앙값', 'end', 'tk') + tx(b.x - 6, 10, '처리 일수', 'start', 'tk');
    D.forEach(function (g, gi) {
      var cx = b.x + band * gi + band / 2;
      s += tx(cx, b.y + b.h + 16, g.name, 'middle', 'tk');
      if (dots) g.v.forEach(function (x, i) { s += '<circle class="bp" data-g="' + gi + '" cx="' + (cx + (prand(i, gi + 40) - 0.5) * 46).toFixed(1) + '" cy="' + Y(x).toFixed(1) + '" r="2.5" style="fill:var(--u-muted)"/>'; });
      s += '<line class="bwk" style="stroke:var(--c1);stroke-width:1.5"/><line class="bwk" style="stroke:var(--c1);stroke-width:1.5"/><rect class="bx" x="' + (cx - bw / 2) + '" width="' + bw + '" rx="3" style="fill:color-mix(in oklab, var(--c1) 22%, var(--u-panel));stroke:var(--c1);stroke-width:2"/>' +
        '<line class="bm" x1="' + (cx - bw / 2) + '" x2="' + (cx + bw / 2) + '" y1="' + Y(g.md) + '" y2="' + Y(g.md) + '" style="stroke:var(--u-ink);stroke-width:2.5"/>' +
        g.out.map(function (x) { return '<circle class="bo" data-g="' + gi + '" cx="' + cx + '" cy="' + Y(x) + '" r="3.5" style="fill:var(--u-panel);stroke:var(--c1);stroke-width:1.5"/>'; }).join('');
    });
    var k = chartKit(st, s), bps = k.q('.bp'), bxs = k.q('.bx'), bms = k.q('.bm'), bwk = k.q('.bwk'), bos = k.q('.bo'), H = D[HI], hx = b.x + band * HI + band / 2;
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2400 && ms < 3250;
      bps.forEach(function (e, i) { e.style.opacity = seg(ms, 50 + i * 8, 250 + i * 8) * (on && +e.dataset.g !== HI ? 0.15 : 0.55); });
      D.forEach(function (g, gi) {
        var t0 = (dots ? 900 : 200) + gi * 120, p = ease.out(seg(ms, t0, t0 + 450)), w = ease.out(seg(ms, t0 + 350, t0 + 700)), cx = b.x + band * gi + band / 2, dim = on && gi !== HI ? 0.3 : 1;
        var y3 = lerp(Y(g.md), Y(g.q3), p), y1 = lerp(Y(g.md), Y(g.q1), p);
        bxs[gi].setAttribute('y', y3); bxs[gi].setAttribute('height', Math.max(0, y1 - y3)); bxs[gi].style.opacity = (p > 0 ? 1 : 0) * dim;
        bms[gi].style.opacity = seg(ms, t0, t0 + 100) * dim;
        [[Y(g.q3), Y(g.hi)], [Y(g.q1), Y(g.lo)]].forEach(function (z, j) { var e = bwk[gi * 2 + j]; e.setAttribute('x1', cx); e.setAttribute('x2', cx); e.setAttribute('y1', z[0]); e.setAttribute('y2', lerp(z[0], z[1], w)); e.style.opacity = (w > 0 ? 1 : 0) * dim; });
      });
      bos.forEach(function (e) { var gi = +e.dataset.g; e.style.opacity = seg(ms, (dots ? 1600 : 900) + gi * 120, (dots ? 1750 : 1050) + gi * 120) * (on && gi !== HI ? 0.3 : 1); });
      var q = glide(ms, 2000, 2400, [VW - 8, VH - 4], [hx + 6, Y(H.md) + 6]);
      k.cur(q[0], q[1], false); k.tip(on, hx, Y(H.q3) - 8, '<b>' + H.name + '</b> 중앙값 ' + H.md.toFixed(1) + '일 · 가운데 절반 ' + H.q1.toFixed(1) + '~' + H.q3.toFixed(1) + '일');
      return ms < (dots ? 900 : 300) ? '처리 일수 점이 찍힘' : ms < 2000 ? '중앙값에서 상자(가운데 절반)가 펼쳐짐' : on ? '상자 하나 · 중앙값과 사분위 툴팁' : iqr ? '수염 = 1.5×IQR · 밖은 이상치 점' : '수염 = 최소~최대 · 이상치가 수염에 묻힘';
    } };
  };

  S['streamgraph'] = function (st, c) {
    var L = [['버그', [8, 10, 14, 18, 16, 12, 10, 9, 11, 15, 13, 10]], ['기능', [4, 5, 6, 8, 10, 13, 15, 14, 12, 10, 9, 8]], ['문의', [10, 9, 8, 9, 11, 10, 12, 15, 18, 16, 14, 12]], ['개선', [3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 11]]];
    var mid = c.offset === '가운데 기준', sm = c.curve === '부드럽게', MS = 3400, HI = 8, b = mid ? { x: 20, y: 14, w: 380, h: 180 } : { x: 34, y: 14, w: 366, h: 180 };
    var sum = WK.map(function (w, i) { return L.reduce(function (a, l) { return a + l[1][i]; }, 0); }), max = mid ? 55 : niceMax(55), X = function (i) { return b.x + b.w * i / 11; };
    var Y = function (v) { return mid ? b.y + b.h / 2 - v / max * b.h : b.y + b.h - v / max * b.h; };
    var s = (mid ? ln(b.x, b.y + b.h / 2, b.x + b.w, b.y + b.h / 2, GRID) + ln(b.x, b.y + b.h, b.x + b.w, b.y + b.h, BASE) : yAxis(b, max)) + xAxis12(b) + '<line class="xh" style="stroke:var(--u-ink);stroke-width:1;opacity:0"/>';
    L.forEach(function (l, j) { s += '<path class="sg" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:1.5;stroke-linejoin:round"/>' + tx(X(11) + 8, 0, l[0], '', 'nm'); });
    s += tx(b.x, 8, '주제별 새 이슈', 'start', 'tk');
    var k = chartKit(st, s), sgs = k.q('.sg'), nms = k.q('.nm'), xh = k.q('.xh')[0];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, p = ease.out(seg(ms, 150, 1100)), on = ms > 2100 && ms < 3150, cum = WK.map(function (w, i) { return mid ? -sum[i] / 2 : 0; });
      L.forEach(function (l, j) {
        var lo = cum.slice(); cum = cum.map(function (v, i) { return v + l[1][i]; });
        var top = cum.map(function (v, i) { return [X(i), Y(v * p)]; }), bot = lo.map(function (v, i) { return [X(i), Y(v * p)]; }).reverse();
        sgs[j].setAttribute('d', smoothPath(top, 'M', sm) + smoothPath(bot, 'L', sm) + 'Z');
        nms[j].setAttribute('y', Y((lo[11] + cum[11]) / 2 * p) + 4); nms[j].style.opacity = seg(ms, 1100, 1350);
      });
      var q = glide(ms, 1700, 2100, [VW - 8, VH - 4], [X(HI), b.y + 20]);
      xh.setAttribute('x1', X(HI)); xh.setAttribute('x2', X(HI)); xh.setAttribute('y1', b.y); xh.setAttribute('y2', b.y + b.h); xh.style.opacity = on ? 0.6 : 0;
      k.cur(q[0], q[1], false); k.tip(on, X(HI), b.y + 6, '<b>' + WK[HI] + '</b> ' + L.map(function (l, j) { return sw(j) + l[0] + ' ' + l[1][HI]; }).join(' '));
      return ms < 1200 ? (mid ? '가운데 선에서 위아래로 흐름이 퍼짐' : '바닥에서 층이 쌓여 오름') : on ? '세로선 한 주 · 주제별 값 툴팁' : (mid ? '가운데 기준 · 전체 흐름과 구성 변화' : '바닥 기준 = 누적 면 차트 · 합계를 읽기 쉬움') + ' · ' + c.curve;
    } };
  };

  S['gantt-chart'] = function (st, c) {
    var T = [['설계', 0, 2, 100], ['디자인', 1, 4, 100], ['서버 개발', 2, 7, 60], ['앱 개발', 4, 9, 40], ['테스트', 7, 10, 0], ['배포', 10, 12, 0]], DP = [[0, 2], [1, 3], [2, 4], [4, 5]];
    var deps = c.deps === '의존 화살표', prog = c.progress === '진행률', MS = 3600, HI = 2, NOW = 5.5, b = { x: 88, y: 26, w: 372, h: 168 }, rh = b.h / T.length, bh = 14, s = '';
    var X = function (w) { return b.x + b.w * w / 12; }, RY = function (i) { return b.y + rh * i + rh / 2; };
    for (var w = 0; w <= 12; w++) { s += ln(X(w), b.y, X(w), b.y + b.h, w ? GRID : BASE); if (w < 12) s += tx(X(w + 0.5), 16, (w + 1) + (w ? '' : '주'), 'middle', 'tk'); }
    if (deps) DP.forEach(function (d) { var a = T[d[0]], z = T[d[1]], x0 = X(a[2]) - 10, y0 = RY(d[0]) + bh / 2, x1 = X(z[1]), y1 = RY(d[1]); s += '<path class="gd" d="M' + x0 + ' ' + y0 + 'V' + y1 + 'H' + (x1 - 1) + '" style="fill:none;stroke:var(--u-muted);stroke-width:1.5"/><path class="gd" d="M' + (x1 - 6) + ' ' + (y1 - 3.5) + 'L' + x1 + ' ' + y1 + 'L' + (x1 - 6) + ' ' + (y1 + 3.5) + 'Z" style="fill:var(--u-muted)"/>'; });
    T.forEach(function (r, i) {
      s += tx(8, RY(i) + 4, r[0], 'start', 'vl') + '<rect class="gb" y="' + (RY(i) - bh / 2) + '" height="' + bh + '" rx="4" style="fill:' + (prog ? 'color-mix(in oklab, var(--c1) 28%, var(--u-panel))' : 'var(--c1)') + '"/>';
      if (prog) s += '<rect class="gp" y="' + (RY(i) - bh / 2) + '" height="' + bh + '" rx="4" style="fill:var(--c1)"/>' + tx(X(r[2]) + 6, RY(i) + 4, r[3] + '%', 'start', 'gpl tk');
    });
    s += '<line class="gn" x1="' + X(NOW) + '" x2="' + X(NOW) + '" y1="' + (b.y - 4) + '" y2="' + (b.y + b.h) + '" style="stroke:var(--u-ink);stroke-width:1.5;stroke-dasharray:4 3"/>' + tx(X(NOW), b.y + b.h + 16, '오늘', 'middle', 'gnl vl');
    var k = chartKit(st, s), gbs = k.q('.gb'), gps = k.q('.gp'), gpl = k.q('.gpl'), gds = k.q('.gd'), gn = k.q('.gn, .gnl'), H = T[HI];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2500 && ms < 3400;
      T.forEach(function (r, i) {
        var p = ease.out(seg(ms, 100 + i * 170, 600 + i * 170)), w = (X(r[2]) - X(r[1])) * p, dim = on && i !== HI ? 0.35 : 1;
        gbs[i].setAttribute('x', X(r[1])); gbs[i].setAttribute('width', w); gbs[i].style.opacity = (p > 0 ? 1 : 0) * dim;
        if (prog) { var f = ease.out(seg(ms, 1300 + i * 60, 1700 + i * 60)); gps[i].setAttribute('x', X(r[1])); gps[i].setAttribute('width', w * r[3] / 100 * f); gpl[i].style.opacity = seg(ms, 1600, 1800) * dim; gps[i].style.opacity = dim; }
      });
      gds.forEach(function (e) { e.style.opacity = seg(ms, 1500, 1800) * (on ? 0.35 : 1); });
      gn.forEach(function (e) { e.style.opacity = seg(ms, 1800, 2000); });
      var cx = (X(H[1]) + X(H[2])) / 2, q = glide(ms, 2100, 2500, [VW - 8, VH - 4], [cx + 4, RY(HI) + 4]);
      k.cur(q[0], q[1], false); k.tip(on, cx, RY(HI) - 10, '<b>' + H[0] + '</b> ' + (H[1] + 1) + '주~' + H[2] + '주 · ' + (H[2] - H[1]) + '주' + (prog ? ' · ' + H[3] + '%' : ''));
      return ms < 1500 ? '작업 막대가 시작 주에서 끝 주로 뻗음' : on ? '막대 하나 · 기간' + (prog ? '과 진행률' : '') + ' 툴팁' : (deps ? '앞 작업이 끝나면 시작하는 화살표' : '의존 표시 없음') + ' · ' + (prog ? '진행률 · 오늘 선' : '기간만 · 오늘 선');
    } };
  };

  /* ───── 표현 › 차트 › 차트 배치 ───── */
  S['small-multiples'] = function (st, c) {
    var T = [['앱', [30, 33, 36, 35, 39, 42, 41, 44, 46, 45, 48, 50]], ['운영', [26, 25, 24, 22, 23, 21, 20, 19, 18, 18, 16, 15]], ['웹', [20, 21, 20, 22, 21, 23, 22, 24, 23, 24, 25, 25]], ['검색', [12, 13, 15, 14, 16, 17, 16, 18, 19, 18, 20, 20]], ['결제', [8, 9, 8, 10, 11, 10, 12, 11, 13, 12, 14, 14]], ['정산', [5, 5, 6, 5, 6, 5, 6, 6, 5, 6, 6, 6]]];
    var same = c.scale === '같은 축', nc = c.cols === '2열' ? 2 : 3, nr = 6 / nc, gw = 8, gh = 8, pw = (VW - 8 - gw * (nc - 1)) / nc, ph = (VH - 4 - gh * (nr - 1)) / nr, MS = 3600, s = '', box = [];
    T.forEach(function (tm, i) {
      var cx = 4 + (i % nc) * (pw + gw), cy = 2 + Math.floor(i / nc) * (ph + gh), max = same ? 60 : niceMax(Math.max.apply(null, tm[1])), lo = same ? 0 : Math.max(0, Math.floor(Math.min.apply(null, tm[1]) * 0.8)), p = { x: cx + 26, y: cy + 22, w: pw - 34, h: ph - 30, max: max, lo: lo };
      box.push(p);
      var Xf = function (k) { return p.x + p.w * k / 11; }, Yf = function (v) { return p.y + p.h - (v - lo) / (max - lo) * p.h; };
      s += '<rect x="' + cx + '" y="' + cy + '" width="' + pw + '" height="' + ph + '" rx="6" style="fill:none;stroke:var(--u-line)"/>' + tx(cx + 8, cy + 15, tm[0], '', 'vl') + '<text class="sv tk" x="' + (cx + pw - 8) + '" y="' + (cy + 15) + '" text-anchor="end"></text>';
      s += ln(p.x, p.y + p.h, p.x + p.w, p.y + p.h, BASE) + ln(p.x, p.y, p.x + p.w, p.y, GRID) + tx(p.x - 4, p.y + 4, (same && i ? '' : max), 'end', 'tk') + tx(p.x - 4, p.y + p.h + 4, (same && i ? '' : lo), 'end', 'tk');
      s += '<polyline class="sm" pathLength="1" points="' + tm[1].map(function (v, k) { return Xf(k).toFixed(1) + ',' + Yf(v).toFixed(1); }).join(' ') + '" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round;stroke-dasharray:1"/><line class="sx" style="stroke:var(--u-muted);stroke-width:1;opacity:0"/><circle class="sd" r="3.5" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:1.5;opacity:0"/>';
      p.X = Xf; p.Y = Yf;
    });
    var k = chartKit(st, s), sms = k.q('.sm'), sxs = k.q('.sx'), sds = k.q('.sd'), svs = k.q('.sv');
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, on = ms > 1900 && ms < 3300, f = lerp(3, 9, ease.inOut(seg(ms, 2100, 3100))), wi = Math.round(f), p0 = box[0];
      T.forEach(function (tm, i) {
        var p = box[i]; sms[i].style.strokeDashoffset = 1 - ease.inOut(seg(ms, 150, 1250));
        sxs[i].setAttribute('x1', p.X(wi)); sxs[i].setAttribute('x2', p.X(wi)); sxs[i].setAttribute('y1', p.y); sxs[i].setAttribute('y2', p.y + p.h); sxs[i].style.opacity = on ? 0.5 : 0;
        sds[i].setAttribute('cx', p.X(wi)); sds[i].setAttribute('cy', p.Y(tm[1][wi])); sds[i].style.opacity = on ? 1 : 0;
        svs[i].textContent = on ? WK[wi] + ' ' + tm[1][wi] : '12주 ' + tm[1][11]; svs[i].style.opacity = seg(ms, 1100, 1300);
      });
      var q = glide(ms, 1500, 1900, [VW - 8, VH - 4], [p0.X(3), p0.y + p0.h / 2]);
      if (ms >= 1900) q = [p0.X(f), p0.y + p0.h / 2];
      k.cur(q[0], q[1], false);
      return ms < 1300 ? '같은 틀의 작은 차트 6개가 함께 그려짐' : on ? '한 칸을 가리키면 모든 칸이 같은 주를 보임' : same ? '모든 칸 같은 축(0~60) · 크기 비교가 됨' : '칸마다 다른 축 · 작은 팀도 크게 변한 듯 보임';
    } };
  };

  /* ───── 표현 › 차트 › 차트 부품 ───── */
  // 선 차트 바탕(12주 데이터): 부품 예시들이 같이 쓴다. n = 선 수
  function lineBase(b, L, max) {
    var X = function (i) { return b.x + b.w * i / 11; }, Y = function (v) { return b.y + b.h - v / max * b.h; };
    return { X: X, Y: Y, svg: L.map(function (l, j) { return '<polyline class="ln" data-j="' + j + '" points="' + l[1].map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ') + '" style="fill:none;stroke:' + CC[j] + ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>'; }).join('') };
  }

  S['axis'] = function (st, c) {
    var n = +c.ticks, zero = c.start === '0부터', D = [['1팀', 88], ['2팀', 92], ['3팀', 95], ['4팀', 90]], MS = 3200;
    var lo = zero ? 0 : 80, hi = 100, b = { x: 46, y: 18, w: 400, h: 172 }, band = b.w / 4, th = band * 0.5, Y = function (v) { return b.y + b.h - (v - lo) / (hi - lo) * b.h; }, s = '';
    for (var i = 0; i <= n - 1; i++) { var v = lo + (hi - lo) * i / (n - 1), y = Y(v); s += '<g class="tk1">' + ln(b.x - 4, y, b.x, y, BASE) + tx(b.x - 8, y + 4, fmt(v, false, (hi - lo) / (n - 1) % 1 ? 1 : 0), 'end', 'tk') + '</g>'; }
    s += '<line class="ax" x1="' + b.x + '" y1="' + b.y + '" x2="' + b.x + '" y2="' + (b.y + b.h) + '" style="' + BASE + ';opacity:1"/><line class="ax" x1="' + b.x + '" y1="' + (b.y + b.h) + '" x2="' + (b.x + b.w) + '" y2="' + (b.y + b.h) + '" style="' + BASE + ';opacity:1"/>';
    s += tx(b.x - 8, 10, '완료율(%)', 'start', 'tk1 tk');
    D.forEach(function (d, i) { s += '<path class="bar" style="fill:var(--c1)"/>' + tx(b.x + band * i + band / 2, b.y + b.h + 16, d[0], 'middle', 'tk1 tk'); });
    if (!zero) s += '<g class="brk">' + ln(b.x - 6, b.y + b.h - 6, b.x + 6, b.y + b.h - 10, 'stroke:var(--u-danger);stroke-width:2') + ln(b.x - 6, b.y + b.h - 1, b.x + 6, b.y + b.h - 5, 'stroke:var(--u-danger);stroke-width:2') + '</g>';
    var k = chartKit(st, s), tks = k.q('.tk1'), bars = k.q('.bar'), axs = k.q('.ax'), brk = k.q('.brk')[0];
    k.noCursor();
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS;
      axs.forEach(function (a, i) { a.style.opacity = seg(ms, 100 + i * 150, 400 + i * 150); });
      tks.forEach(function (e, i) { e.style.opacity = seg(ms, 400 + i * 70, 600 + i * 70); });
      if (brk) brk.style.opacity = seg(ms, 2000, 2300);
      D.forEach(function (d, i) { var p = ease.out(seg(ms, 900 + i * 80, 1500 + i * 80)), x = b.x + band * i + (band - th) / 2, y = lerp(b.y + b.h, Y(d[1]), p); bars[i].setAttribute('d', barPath(x, y, th, b.y + b.h - y)); });
      return ms < 900 ? '축과 눈금 ' + n + '개가 먼저' : ms < 2000 ? '막대 88 · 92 · 95 · 90' : zero ? '0부터라 차이가 실제 크기대로(최대 8%p)' : '80부터 시작해 4팀 차이가 몇 배로 부풀어 보임';
    } };
  };

  S['gridlines'] = function (st, c) {
    var sty = c.style, both = c.direction === '가로·세로', L = LINES.slice(0, 1), max = 60, b = { x: 34, y: 12, w: 420, h: 182 }, MS = 3200, HI = 6;
    var base = lineBase(b, L, max), s = '';
    for (var i = 1; i <= 4; i++) { var y = b.y + b.h - b.h * i / 4; if (sty !== '없음') s += '<line class="gl" x1="' + b.x + '" x2="' + (b.x + b.w) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--u-muted);stroke-opacity:.3;stroke-width:1' + (sty === '점선' ? ';stroke-dasharray:2 3' : '') + '"/>'; s += tx(b.x - 6, y + 4, max * i / 4, 'end', 'tk'); }
    if (both && sty !== '없음') [0, 3, 6, 9, 11].forEach(function (i) { s += '<line class="gl" x1="' + base.X(i) + '" x2="' + base.X(i) + '" y1="' + b.y + '" y2="' + (b.y + b.h) + '" style="stroke:var(--u-muted);stroke-opacity:.3;stroke-width:1' + (sty === '점선' ? ';stroke-dasharray:2 3' : '') + '"/>'; });
    s += ln(b.x, b.y + b.h, b.x + b.w, b.y + b.h, BASE) + xAxis12(b) + base.svg + '<circle class="hd" r="4.5" cx="' + base.X(HI) + '" cy="' + base.Y(L[0][1][HI]) + '" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2;opacity:0"/>';
    var k = chartKit(st, s), gls = k.q('.gl'), hd = k.q('.hd')[0];
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 1700;
      gls.forEach(function (g, i) { g.style.opacity = seg(ms, 200 + i * 60, 500 + i * 60); });
      hd.style.opacity = on ? 1 : 0;
      var q = glide(ms, 1100, 1700, [VW - 8, VH - 4], [base.X(HI) + 4, base.Y(L[0][1][HI]) + 4]); k.cur(q[0], q[1], false);
      return ms < 900 ? (sty === '없음' ? '격자선 없음' : '격자선이 옅게 깔림 · ' + sty) : sty === '없음' ? '7주 점의 값을 눈으로 축까지 따라가야 함' : '7주 점 ≈ 41: 가까운 선(45)을 보고 어림';
    } };
  };

  S['legend'] = function (st, c) {
    var pos = c.position, ns = c.series === '2개' ? 2 : 4, MS = 3400, HI = 1, NM = ['열린', '닫힌', '새', '보류'];
    var L = LINES.concat([['보류 이슈', [6, 7, 6, 8, 9, 8, 7, 9, 8, 10, 9, 11]]]).slice(0, ns), max = 60;
    var b = pos === '위' ? { x: 34, y: 34, w: 420, h: 160 } : { x: 34, y: 12, w: pos === '오른쪽' ? 330 : 360, h: 182 }, base = lineBase(b, L, max), s = yAxis(b, max) + xAxis12(b) + base.svg, lg = [];
    L.forEach(function (l, j) {
      var x, y, a = '';
      if (pos === '위') { x = b.x + j * 86; y = 12; } else if (pos === '오른쪽') { x = b.x + b.w + 22; y = b.y + 20 + j * 22; } else { x = base.X(11) + 8; y = base.Y(l[1][11]) + 4 + (j === 3 ? 6 : 0); a = ''; }
      s += '<g class="lg" data-j="' + j + '">' + (pos === '선 끝(바로 이름)' ? '' : '<rect x="' + x + '" y="' + (y - 9) + '" width="14" height="3" rx="1.5" style="fill:' + CC[j] + '"/>') + tx(x + (pos === '선 끝(바로 이름)' ? 0 : 19), y, NM[j], a, 'nm') + '</g>';
      lg.push([x + 20, y - 4]);
    });
    var k = chartKit(st, s), lns = k.q('.ln'), lgs = k.q('.lg');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 1800 && ms < 3000;
      lgs.forEach(function (g, j) { g.style.opacity = seg(ms, 200 + j * 120, 450 + j * 120) * (on && j !== HI ? 0.4 : 1); });
      lns.forEach(function (e, j) { e.style.opacity = on && j !== HI ? 0.2 : 1; e.style.strokeWidth = on && j === HI ? 3 : 2; });
      var q = glide(ms, 1200, 1800, [VW - 8, VH - 4], [lg[HI][0] + 6, lg[HI][1] + 4]); k.cur(q[0], q[1], false);
      return on ? '범례 "' + NM[HI] + '"에 올림 · 그 선만 진하게' : pos === '선 끝(바로 이름)' ? '범례 상자 대신 선 끝에 이름(눈이 덜 오감)' : '범례 · ' + pos + ' · 계열 ' + ns + '개';
    } };
  };

  S['chart-tooltip'] = function (st, c) {
    var all = c.content === '같은 시점 모두', tap = c.trigger === '누름(터치)', L = LINES, max = 60, b = { x: 34, y: 12, w: 420, h: 182 }, MS = 3800, base = lineBase(b, L, max);
    var s = yAxis(b, max) + xAxis12(b) + base.svg + L.map(function (l, j) { return '<circle class="hd" r="4.5" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:2;opacity:0"/>'; }).join('');
    var k = chartKit(st, s), hds = k.q('.hd'), stops = [[1100, 3], [2100, 6], [3000, 9]];
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, wi = -1, pressAt = -1;
      stops.forEach(function (sp, i) { if (ms >= sp[0]) { wi = sp[1]; pressAt = sp[0]; } });
      var from = [VW - 8, VH - 4], cur = from;
      stops.forEach(function (sp, i) { var a = i ? [base.X(stops[i - 1][1]), base.Y(L[0][1][stops[i - 1][1]]) + 6] : from, bb = [base.X(sp[1]), base.Y(L[0][1][sp[1]]) + 6]; if (ms >= sp[0] - 600) cur = glide(ms, sp[0] - 600, sp[0] - 100, a, bb); });
      var shown = tap ? (pressAt > 0 && ms >= pressAt) : (wi >= 0 && ms >= pressAt - 100);
      var press = tap && stops.some(function (sp) { return ms > sp[0] - 100 && ms < sp[0] + 150; });
      k.cur(cur[0], cur[1], press);
      hds.forEach(function (e, j) { var on = shown && (all || j === 0); e.style.opacity = on ? 1 : 0; if (wi >= 0) { e.setAttribute('cx', base.X(wi)); e.setAttribute('cy', base.Y(L[j][1][wi])); } });
      if (wi >= 0) k.tip(shown, base.X(wi), base.Y(Math.max.apply(null, L.map(function (l) { return l[1][wi]; }))) - 12, '<b>' + WK[wi] + '</b>' + (all ? L.map(function (l, j) { return sw(j) + l[0].split(' ')[0] + ' ' + l[1][wi]; }).join(' ') : sw(0) + '열린 이슈 ' + L[0][1][wi] + '건'));
      else k.tip(false);
      return !shown ? (tap ? '누르면 뜸(터치에는 올림이 없음)' : '점 가까이 가면 뜸') : WK[wi] + ' · ' + (all ? '세 선의 값을 한 상자에' : '가리킨 선의 값만') + (tap ? ' · 다른 곳을 누를 때까지 남음' : '');
    } };
  };

  S['crosshair'] = function (st, c) {
    var both = c.lines === '세로·가로', snap = c.snap === '점에 붙음', L = LINES.slice(0, 1), max = 60, b = { x: 40, y: 12, w: 414, h: 178 }, MS = 3600, base = lineBase(b, L, max);
    var s = yAxis(b, max) + xAxis12(b) + base.svg + '<line class="vx" style="stroke:var(--u-ink);stroke-width:1;stroke-dasharray:3 3;opacity:.55"/><line class="hx" style="stroke:var(--u-ink);stroke-width:1;stroke-dasharray:3 3;opacity:.55"/>' +
      '<circle class="hd" r="4.5" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/><g class="bx"><rect class="bxr" rx="3" height="16" style="fill:var(--u-ink)"/><text class="bxt" text-anchor="middle" style="fill:var(--u-panel);font-weight:600"></text></g><g class="by"><rect class="byr" rx="3" height="16" width="30" style="fill:var(--u-ink)"/><text class="byt" text-anchor="middle" style="fill:var(--u-panel);font-weight:600"></text></g>';
    var k = chartKit(st, s), vx = k.q('.vx')[0], hx = k.q('.hx')[0], hd = k.q('.hd')[0], bx = k.q('.bx')[0], by = k.q('.by')[0];
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, on = ms > 900, f = lerp(1.3, 10.6, ease.inOut(seg(ms, 1000, 3100))), wi = Math.round(f), fx = snap ? wi : f;
      var x = base.X(fx), v = snap ? L[0][1][wi] : lerp(L[0][1][Math.floor(f)], L[0][1][Math.min(11, Math.floor(f) + 1)], f - Math.floor(f)), y = base.Y(v), q = glide(ms, 400, 1000, [VW - 8, VH - 4], [base.X(1.3), b.y + 50]);
      if (ms >= 1000) q = [base.X(f), b.y + 50];
      [vx, hx, hd, bx, by].forEach(function (e) { e.style.display = on ? '' : 'none'; });
      vx.setAttribute('x1', x); vx.setAttribute('x2', x); vx.setAttribute('y1', b.y); vx.setAttribute('y2', b.y + b.h);
      hx.setAttribute('x1', b.x); hx.setAttribute('x2', b.x + b.w); hx.setAttribute('y1', y); hx.setAttribute('y2', y); hx.style.display = on && both ? '' : 'none'; by.style.display = on && both ? '' : 'none';
      hd.setAttribute('cx', x); hd.setAttribute('cy', y); hd.style.display = on && snap ? '' : 'none';
      var lab = snap ? WK[wi] : (f + 1).toFixed(1) + '주';
      bx.querySelector('rect').setAttribute('x', x - 20); bx.querySelector('rect').setAttribute('y', b.y + b.h + 3); bx.querySelector('rect').setAttribute('width', 40); bx.querySelector('text').setAttribute('x', x); bx.querySelector('text').setAttribute('y', b.y + b.h + 15); bx.querySelector('text').textContent = lab;
      by.querySelector('rect').setAttribute('x', b.x - 34); by.querySelector('rect').setAttribute('y', y - 8); by.querySelector('text').setAttribute('x', b.x - 19); by.querySelector('text').setAttribute('y', y + 4); by.querySelector('text').textContent = Math.round(v);
      k.cur(q[0], q[1], false);
      return !on ? '포인터가 차트에 들어오면 나타남' : (snap ? '가까운 점에 붙음 · ' : '포인터 자리 그대로 · ') + lab + (both ? ' · 값 ' + Math.round(v) : '');
    } };
  };

  S['data-label'] = function (st, c) {
    var inside = c.where === '막대 안', topOnly = c.which === '가장 큰 것만', D = [['민지', 24], ['준호', 17], ['서연', 31], ['도윤', 12], ['하은', 20]], MS = 3000;
    var max = 40, b = { x: 56, y: 12, w: 390, h: 190 }, band = b.h / 5, th = band * 0.6, top = 2, s = '';
    D.forEach(function (d, i) { var y = b.y + band * i + (band - th) / 2; s += tx(b.x - 8, y + th / 2 + 4, d[0], 'end', 'tk') + '<path class="bar" style="fill:var(--c1)"/><text class="dl" text-anchor="' + (inside ? 'end' : 'start') + '" style="' + (inside ? 'fill:#ffffff;' : '') + 'font-size:12.5px;font-weight:700"></text>'; });
    s += ln(b.x, b.y, b.x, b.y + b.h, BASE);
    var k = chartKit(st, s), bars = k.q('.bar'), dls = k.q('.dl');
    k.noCursor();
    return { ms: MS, rest: 0.45, at: function (t) {
      var ms = t * MS;
      D.forEach(function (d, i) {
        var p = ease.out(seg(ms, 100 + i * 80, 700 + i * 80)), w = d[1] / max * b.w * p, y = b.y + band * i + (band - th) / 2, show = !topOnly || i === top;
        bars[i].setAttribute('d', barPath(b.x, y, w, th, true)); bars[i].style.fill = topOnly && i !== top ? 'var(--c-other)' : 'var(--c1)';
        dls[i].setAttribute('x', inside ? b.x + w - 8 : b.x + w + 6); dls[i].setAttribute('y', y + th / 2 + 4.5); dls[i].textContent = d[1] + '건';
        dls[i].style.opacity = show ? seg(ms, 900 + i * 90, 1100 + i * 90) : 0; if (!inside) dls[i].style.fill = 'var(--u-ink)';
      });
      return ms < 900 ? '막대가 자람' : (topOnly ? '가장 큰 값에만 숫자, 나머지는 회색' : '값을 ' + c.where + '에 바로 적어 축을 안 읽어도 됨');
    } };
  };

  S['reference-line'] = function (st, c) {
    var avgK = c.kind === '평균선', band = c.band === '범위 띠', L = [LINES[1]], max = 60, b = { x: 34, y: 12, w: 380, h: 182 }, MS = 3400, base = lineBase(b, L, max);
    var vals = L[0][1], ref = avgK ? Math.round(vals.reduce(function (a, v) { return a + v; }, 0) / 12) : 35, ry = base.Y(ref), first = vals.findIndex(function (v) { return v >= ref; });
    var s = yAxis(b, max) + xAxis12(b) + (band ? '<rect class="bd" x="' + b.x + '" width="' + b.w + '" y="' + base.Y(ref + 5) + '" height="' + (base.Y(ref - 5) - base.Y(ref + 5)) + '" style="fill:var(--c2);opacity:0"/>' : '') +
      base.svg + '<line class="rl" pathLength="1" x1="' + b.x + '" x2="' + (b.x + b.w) + '" y1="' + ry + '" y2="' + ry + '" style="stroke:var(--c2);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1"/>' + tx(b.x + b.w + 6, ry + 4, (avgK ? '평균 ' : '목표 ') + ref, '', 'nm rlt') +
      vals.map(function (v, i) { return '<circle class="pt" cx="' + base.X(i) + '" cy="' + base.Y(v) + '" r="4" style="fill:' + (v >= ref ? 'var(--c1)' : 'var(--u-panel)') + ';stroke:var(--c1);stroke-width:2;opacity:0"/>'; }).join('');
    var k = chartKit(st, s), rl = k.q('.rl')[0], rlt = k.q('.rlt')[0], bd = k.q('.bd')[0], pts = k.q('.pt'), lns = k.q('.ln');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ms > 2300 && ms < 3200;
      lns[0].setAttribute('stroke-dasharray', '1'); lns[0].setAttribute('pathLength', '1'); lns[0].style.strokeDashoffset = 1 - ease.inOut(seg(ms, 100, 900));
      rl.style.strokeDashoffset = 1 - ease.out(seg(ms, 1000, 1500)); rlt.style.opacity = seg(ms, 1400, 1600); if (bd) bd.style.opacity = 0.12 * seg(ms, 1000, 1400);
      pts.forEach(function (p, i) { p.style.opacity = seg(ms, 1600 + i * 30, 1800 + i * 30); });
      var hx = base.X(first), hy = base.Y(vals[first]), q = glide(ms, 1800, 2300, [VW - 8, VH - 4], [hx + 4, hy + 4]);
      k.cur(q[0], q[1], false); k.tip(on, hx, hy - 12, '<b>' + WK[first] + '</b> 닫힌 ' + vals[first] + '건 · ' + (avgK ? '평균' : '목표') + '(' + ref + ') 처음 넘음');
      return ms < 1000 ? '선이 그려짐' : ms < 1700 ? (avgK ? '평균선' : '목표선') + '이 가로로 그어짐 · 오른쪽 끝에 값' : on ? WK[first] + '부터 ' + (avgK ? '평균' : '목표') + ' 위' : '넘은 주는 속이 찬 점' + (band ? ' · ±5 범위 띠' : '');
    } };
  };

  /* ───── 표현 › 차트 › 차트 조작 ───── */
  var CLIP_N = 0;
  // 눌림 표시: 커서가 t0 근처에서 누른다
  function pressAt(ms, list) { return list.some(function (x) { return ms > x - 60 && ms < x + 140; }); }
  // 값 축을 매 프레임 다시 그릴 때 쓰는 눈금 5개(글자와 격자선)
  function liveAxis(b) { var s = ''; for (var i = 0; i <= 4; i++) s += '<line class="ag" x1="' + b.x + '" x2="' + (b.x + b.w) + '" style="' + (i ? GRID : BASE) + '"/><text class="at tk" text-anchor="end" x="' + (b.x - 6) + '"></text>'; return s; }
  function setAxis(k, b, max) {
    var ag = k.q('.ag'), at = k.q('.at');
    for (var i = 0; i <= 4; i++) { var y = b.y + b.h - b.h * i / 4; ag[i].setAttribute('y1', y); ag[i].setAttribute('y2', y); at[i].setAttribute('y', y + 4); var v = max * i / 4; at[i].textContent = fmt(v, false, Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0); }
  }

  S['legend-toggle'] = function (st, c) {
    var iso = c.mode === '눌러서 그것만 보기', fit = c.rescale === '축 다시 맞춤', L = LINES, b = { x: 34, y: 36, w: 420, h: 158 }, MS = 3800, T1 = 1250, T2 = 2650;
    var tg = iso ? 1 : 0, aff = function (j) { return iso ? j !== tg : j === tg; }, rest = L.filter(function (l, j) { return !aff(j); }), m2 = fit ? tickMax(Math.max.apply(null, rest.map(function (l) { return Math.max.apply(null, l[1]); })) * 1.1) : 60;
    var s = liveAxis(b) + xAxis12(b) + L.map(function (l, j) { return '<polyline class="ln" style="fill:none;stroke:' + CC[j] + ';stroke-width:2;stroke-linejoin:round"/>'; }).join('');
    L.forEach(function (l, j) { var x = b.x + j * 104; s += '<g class="chip"><rect x="' + (x - 6) + '" y="2" width="96" height="22" rx="11" style="fill:var(--u-panel);stroke:var(--u-line)"/><rect class="sq" x="' + x + '" y="8" width="10" height="10" rx="2" style="stroke:' + CC[j] + ';stroke-width:1.5"/>' + tx(x + 16, 17, l[0], '', 'nm') + '</g>'; });
    var k = chartKit(st, s), lns = k.q('.ln'), sqs = k.q('.sq'), nms = k.q('.nm'), cx = b.x + tg * 104 + 40;
    return { ms: MS, rest: 0.25, at: function (t) {
      var ms = t * MS, a = ease.inOut(seg(ms, T1, T1 + 300)) - ease.inOut(seg(ms, T2, T2 + 300)), max = lerp(60, m2, a);
      setAxis(k, b, max);
      L.forEach(function (l, j) {
        var off = aff(j) ? a : 0;
        lns[j].setAttribute('points', l[1].map(function (v, i) { return (b.x + b.w * i / 11) + ',' + (b.y + b.h - Math.min(v, max * 1.15) / max * b.h); }).join(' '));
        lns[j].style.opacity = 1 - off;
        sqs[j].style.fill = off > 0.5 ? 'transparent' : CC[j];
        nms[j].style.opacity = off > 0.5 ? 0.45 : 1; nms[j].style.textDecoration = off > 0.5 ? 'line-through' : 'none';
      });
      var q = glide(ms, 650, T1 - 100, [VW - 8, VH - 4], [cx, 18]);
      k.cur(q[0], q[1], pressAt(ms, [T1, T2]));
      var who = iso ? '"' + L[tg][0] + '"만 보기' : '"' + L[tg][0] + '" 끔';
      return ms < T1 ? '범례 칩을 누르면 계열이 켜지고 꺼짐' : ms < T2 ? who + (fit ? ' · 축이 남은 선에 맞춰 ' + Math.round(m2) + '까지' : ' · 축은 그대로') : '다시 누름 · 모두 켬';
    } };
  };

  S['brush-zoom'] = function (st, c) {
    var mini = c.how === '아래 미니맵에서 끌기', dbl = c.reset === '두 번 눌러 되돌리기', N = 52, MS = 4400, S0 = 20, S1 = 32, id = 'ubz' + (++CLIP_N);
    var V = []; for (var i = 0; i < N; i++) V.push(Math.round(30 + 9 * Math.sin(i / 6) + i * 0.25 + prand(i, 12) * 7));
    var b = mini ? { x: 34, y: 14, w: 420, h: 128 } : { x: 34, y: 14, w: 420, h: 168 }, m = { x: 34, y: 176, w: 420, h: 34 }, max = 60;
    var s = '<defs><clipPath id="' + id + '"><rect x="' + b.x + '" y="' + (b.y - 6) + '" width="' + b.w + '" height="' + (b.h + 8) + '"/></clipPath></defs>' + yAxis(b, max) +
      '<g class="xl"></g><polyline class="mln" clip-path="url(#' + id + ')" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/>' +
      '<rect class="sel" style="fill:var(--c1);fill-opacity:.15;stroke:var(--c1);stroke-width:1"/>';
    if (mini) s += '<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h + '" rx="4" style="fill:none;stroke:var(--u-line)"/><polyline points="' + V.map(function (v, i) { return (m.x + m.w * i / (N - 1)) + ',' + (m.y + m.h - 3 - v / max * (m.h - 6)); }).join(' ') + '" style="fill:none;stroke:var(--u-muted);stroke-width:1"/>';
    s += '<g class="rs"><rect x="374" y="0" width="80" height="22" rx="6" style="fill:var(--u-panel);stroke:var(--u-line)"/>' + tx(414, 15, dbl ? '두 번 눌러 전체' : '↺ 전체 보기', 'middle', 'nm') + '</g>';
    var k = chartKit(st, s), mln = k.q('.mln')[0], sel = k.q('.sel')[0], xl = k.q('.xl')[0], rs = k.q('.rs')[0];
    var DR = [900, 1700], ZM = [1850, 2400], RS = dbl ? [3250, 3420] : [3300], ZB = [3500, 4050];
    return { ms: MS, rest: 0.25, at: function (t) {
      var ms = t * MS, z = ease.inOut(seg(ms, ZM[0], ZM[1])) - ease.inOut(seg(ms, ZB[0], ZB[1])), d0 = lerp(0, S0, z), d1 = lerp(N - 1, S1, z);
      mln.setAttribute('points', V.map(function (v, i) { return (b.x + (i - d0) / (d1 - d0) * b.w).toFixed(1) + ',' + (b.y + b.h - v / max * b.h).toFixed(1); }).join(' '));
      var step = d1 - d0 > 20 ? 10 : 2, h = '';
      for (var w = Math.ceil(d0 / step) * step; w <= d1; w += step) h += tx(b.x + (w - d0) / (d1 - d0) * b.w, b.y + b.h + 14, (w + 1) + '주', 'middle', 'tk');
      xl.innerHTML = h;
      // 고르는 사각형: 미니맵(또는 차트) 위에서 S0부터 끌어 S1까지
      var g = ease.inOut(seg(ms, DR[0], DR[1])), box = mini ? m : b, sx = function (wk) { return box.x + wk / (N - 1) * box.w; }, cur1 = lerp(S0, S1, g);
      var showSel = mini ? ms >= DR[0] && ms < ZB[0] : ms >= DR[0] && ms < ZM[0] + 150;
      var selR = mini ? [sx(S0), sx(lerp(S0, S1, g)) - sx(S0)] : [sx(S0), sx(cur1) - sx(S0)];
      if (mini && ms >= ZB[0]) showSel = false;
      sel.style.display = showSel ? '' : 'none'; sel.setAttribute('x', selR[0]); sel.setAttribute('width', Math.max(0, selR[1])); sel.setAttribute('y', box.y + 1); sel.setAttribute('height', box.h - 2);
      sel.style.opacity = mini ? 1 : 1 - seg(ms, ZM[0], ZM[0] + 150);
      rs.style.opacity = z > 0.9 && ms < ZB[0] ? 1 : 0;
      var dragY = box.y + box.h / 2, q = ms < DR[0] ? glide(ms, 300, DR[0] - 80, [VW - 8, VH - 4], [sx(S0), dragY]) : ms < RS[0] - 500 ? [sx(cur1), dragY] : glide(ms, RS[0] - 500, RS[0] - 80, [sx(S1), dragY], dbl ? [b.x + b.w / 2, b.y + b.h / 2] : [414, 12]);
      k.cur(q[0], q[1], (ms > DR[0] - 40 && ms < DR[1]) || pressAt(ms, RS));
      return ms < DR[0] ? '전체 52주' : ms < DR[1] ? (mini ? '아래 미니맵에서' : '차트 위에서') + ' 구간을 끌어 고름' : ms < ZB[0] ? Math.round(d0 + 1) + '주–' + Math.round(d1 + 1) + '주로 확대' + (z > 0.9 ? (dbl ? ' · 두 번 누르면 전체' : ' · "전체 보기" 단추') : '') : '전체로 되돌림';
    } };
  };

  S['drilldown'] = function (st, c) {
    var crumb = c.back === '이동 경로(Breadcrumb)', anim = c.motion === '막대가 펼쳐짐', MS = 4200, T1 = 1300, T2 = 3000, DUR = anim ? 550 : 1;
    var TEAMS = [['결제팀', 42], ['정산팀', 31], ['앱팀', 27], ['운영팀', 18]], MEM = [['민지', 15], ['준호', 12], ['서연', 9], ['도윤', 6]];
    var b = { x: 40, y: 50, w: 420, h: 140 }, band = b.w / 4, th = band * 0.5, s = liveAxis(b);
    TEAMS.forEach(function () { s += '<path class="tb" style="fill:var(--c1)"/><text class="tl tk" text-anchor="middle"></text>'; });
    MEM.forEach(function () { s += '<path class="mb" style="fill:var(--c1)"/><text class="ml tk" text-anchor="middle"></text>'; });
    s += crumb ? '<g class="cr">' + tx(b.x - 30, 18, '전체 팀', '', 'crt') + tx(b.x + 20, 18, '› 결제팀', '', 'crd') + '</g>'
      : '<g class="bk"><rect x="' + (b.x - 30) + '" y="4" width="64" height="22" rx="6" style="fill:var(--u-panel);stroke:var(--u-line)"/>' + tx(b.x + 2, 19, '← 뒤로', 'middle', 'nm') + '</g>' + tx(b.x - 30, 18, '팀별 열린 이슈', '', 'ttl nm') + tx(b.x + 44, 19, '결제팀 담당자별', '', 'ttl2 nm');
    var k = chartKit(st, s), tbs = k.q('.tb'), tls = k.q('.tl'), mbs = k.q('.mb'), mls = k.q('.ml');
    var crt = k.q('.crt')[0], crd = k.q('.crd')[0], bk = k.q('.bk')[0], ttl = k.q('.ttl')[0], ttl2 = k.q('.ttl2')[0];
    function bx(i) { return b.x + band * i + (band - th) / 2; }
    return { ms: MS, rest: 0.25, at: function (t) {
      var ms = t * MS, d = ease.inOut(seg(ms, T1 + 80, T1 + 80 + DUR)) - ease.inOut(seg(ms, T2 + 80, T2 + 80 + DUR)), max = lerp(60, 20, d), Y = function (v) { return b.y + b.h - v / max * b.h; };
      setAxis(k, b, max);
      TEAMS.forEach(function (tm, i) {
        // 팀 막대는 처음 축(60)에 고정하고 흐려지기만 한다
        var y = b.y + b.h - tm[1] / 60 * b.h, keep = 1 - Math.min(1, d * 2);
        tbs[i].setAttribute('d', barPath(bx(i), y, th, b.y + b.h - y)); tbs[i].style.opacity = i === 0 ? (d > 0.02 ? 0 : 1) : keep;
        tls[i].setAttribute('x', bx(i) + th / 2); tls[i].setAttribute('y', b.y + b.h + 16); tls[i].textContent = tm[0]; tls[i].style.opacity = 1 - d;
      });
      // 결제팀 막대 안에 쌓인 조각이 담당자 막대 4개로 펼쳐진다
      var acc = 0;
      MEM.forEach(function (mm, j) {
        var sx = bx(0), sy0 = acc; acc += mm[1];
        var x = lerp(sx, bx(j), d), w = th, yTop = lerp(Y(acc), Y(mm[1]), d), yBot = lerp(Y(sy0), b.y + b.h, d);
        mbs[j].setAttribute('d', barPath(x, yTop, w, Math.max(0, yBot - yTop - (d < 0.98 && j ? 1 : 0)))); mbs[j].style.opacity = d > 0.02 ? 1 : 0;
        mls[j].setAttribute('x', bx(j) + th / 2); mls[j].setAttribute('y', b.y + b.h + 16); mls[j].textContent = mm[0]; mls[j].style.opacity = d;
      });
      if (crumb) { crd.style.opacity = d; crt.style.fill = d > 0.5 ? 'var(--u-accent)' : 'var(--u-ink)'; crt.style.textDecoration = d > 0.5 ? 'underline' : 'none'; }
      else { bk.style.opacity = d; ttl.style.opacity = 1 - d; ttl2.style.opacity = d; }
      var backAt = crumb ? [b.x - 8, 14] : [b.x + 2, 14], q = ms < T2 - 500 ? glide(ms, 650, T1 - 100, [VW - 8, VH - 4], [bx(0) + th / 2, Y(30)]) : glide(ms, T2 - 500, T2 - 80, [bx(0) + th / 2, Y(10)], backAt);
      k.cur(q[0], q[1], pressAt(ms, [T1, T2]));
      return ms < T1 ? '팀 막대를 누르면 한 단계 아래로' : ms < T2 ? '결제팀 → 담당자 4명' + (anim ? '(막대가 펼쳐짐)' : '') + ' · ' + (crumb ? '위에 이동 경로' : '"뒤로" 단추') : '다시 전체 팀으로';
    } };
  };

  S['range-selector'] = function (st, c) {
    var rel3 = c.presets === '오늘·이번 주·이번 달', custom = c.custom === '단추 + 날짜 직접 고르기', MS = 4400, T1 = 1300, T2 = 2500, T3 = 3300, NP = 40;
    var OPT = rel3 ? ['오늘', '이번 주', '이번 달'] : ['7일', '30일', '90일'], TITLE = rel3 ? ['오늘 (11월 25일, 시간별)', '이번 주 (11월 23일–29일)', '이번 달 (11월 1일–30일)'] : ['최근 7일 (11월 19일–25일)', '최근 30일 (10월 27일–11월 25일)', '최근 90일 (8월 28일–11월 25일)'];
    var series = function (k) { var r = []; for (var i = 0; i < NP; i++) r.push(18 + 10 * Math.sin(i / (3 + k * 2) + k) + prand(i, 20 + k) * (8 - k * 2) + k * 4); return r; };
    var SER = [series(0), series(1), series(2), series(3)], b = { x: 34, y: 62, w: 420, h: 130 }, max = 48, segW = 62;
    var s = yAxis(b, max) + '<rect x="' + b.x + '" y="2" width="' + (segW * 3 + 4) + '" height="26" rx="7" style="fill:var(--u-hover);stroke:var(--u-line)"/><rect class="ind" y="4" width="' + segW + '" height="22" rx="5" style="fill:var(--u-panel);stroke:var(--u-line)"/>';
    OPT.forEach(function (o, i) { s += tx(b.x + 2 + segW * i + segW / 2, 19, o, 'middle', 'seg'); });
    if (custom) s += '<g class="cb"><rect x="' + (b.x + segW * 3 + 12) + '" y="2" width="84" height="26" rx="7" style="fill:var(--u-panel);stroke:var(--u-line)"/>' + tx(b.x + segW * 3 + 54, 19, '직접 고르기…', 'middle', 'nm') + '</g>';
    s += tx(b.x, 48, '', '', 'ttl nm') + '<polygon class="ar" style="fill:var(--c1);opacity:.18"/><polyline class="ln" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/>';
    if (custom) s += '<g class="pop"><rect x="250" y="34" width="210" height="64" rx="8" style="fill:var(--u-panel);stroke:var(--u-line)"/>' + tx(262, 56, '10월 1일  –  10월 31일', '', 'nm') + '<rect x="398" y="68" width="50" height="22" rx="6" style="fill:var(--u-accent)"/>' + tx(423, 83, '적용', 'middle', 'apply') + '</g>';
    var k = chartKit(st, s), ind = k.q('.ind')[0], segs = k.q('.seg'), ttl = k.q('.ttl')[0], ar = k.q('.ar')[0], lnE = k.q('.ln')[0], pop = k.q('.pop')[0], ap = k.q('.apply')[0];
    if (ap) ap.style.fill = 'var(--u-accent-ink)';
    return { ms: MS, rest: 0.25, at: function (t) {
      var ms = t * MS, sel = ms < T1 ? 1 : 2, m1 = ease.inOut(seg(ms, T1, T1 + 350)), m2 = custom ? ease.inOut(seg(ms, T3, T3 + 350)) : 0;
      var A = ms >= T3 && custom ? SER[2] : SER[1], B = ms >= T3 && custom ? SER[3] : SER[2], p = ms >= T3 && custom ? m2 : m1, vals = A.map(function (v, i) { return lerp(v, B[i], p); });
      var pts = vals.map(function (v, i) { return (b.x + b.w * i / (NP - 1)).toFixed(1) + ',' + (b.y + b.h - v / max * b.h).toFixed(1); });
      lnE.setAttribute('points', pts.join(' ')); ar.setAttribute('points', b.x + ',' + (b.y + b.h) + ' ' + pts.join(' ') + ' ' + (b.x + b.w) + ',' + (b.y + b.h));
      var cus = custom && ms >= T3 + 100;
      ind.setAttribute('x', b.x + 2 + segW * lerp(1, 2, m1)); ind.style.opacity = cus ? 0 : 1;
      segs.forEach(function (e, i) { e.style.fill = !cus && i === Math.round(lerp(1, 2, m1)) ? 'var(--u-ink)' : 'var(--u-muted)'; e.style.fontWeight = !cus && i === Math.round(lerp(1, 2, m1)) ? 700 : 400; });
      ttl.textContent = cus ? '직접 고름 (10월 1일–31일)' : TITLE[sel];
      if (pop) pop.style.display = custom && ms > T2 + 100 && ms < T3 + 100 ? '' : 'none';
      var segX = function (i) { return b.x + 2 + segW * i + segW / 2; }, q = glide(ms, 650, T1 - 100, [VW - 8, VH - 4], [segX(2), 16]);
      if (custom && ms >= T1 + 300) q = ms < T2 ? glide(ms, T2 - 600, T2 - 80, [segX(2), 16], [b.x + segW * 3 + 54, 16]) : glide(ms, T3 - 500, T3 - 80, [b.x + segW * 3 + 54, 16], [423, 80]);
      k.cur(q[0], q[1], pressAt(ms, custom ? [T1, T2, T3] : [T1]));
      return ms < T1 ? '기간 단추: ' + OPT.join(' · ') : !custom || ms < T2 ? OPT[2] + ' 누름 · 제목의 기간도 같이 바뀜' : ms < T3 ? '"직접 고르기" · 시작일과 끝일' : '직접 고른 기간 · 단추 선택은 풀림';
    } };
  };

  /* ───── 움직임 › 차트 모션 ───── */
  S['bar-grow-in'] = function (st, c) {
    var scale = c.method === 'transform: scaleY', gap = +c.stagger_ms, D = [18, 26, 22, 34, 29, 38], MS = 2400 + gap * 6, b = { x: 40, y: 30, w: 420, h: 166 }, band = b.w / 6, th = band * 0.56, max = 40;
    var s = yAxis(b, max) + D.map(function (v, i) { return '<path class="bar" style="fill:var(--c1)"/>' + tx(b.x + band * i + band / 2, b.y + b.h + 16, (i + 1) + '월', 'middle', 'tk'); }).join('') +
      '<rect x="' + (b.x + b.w - 190) + '" y="0" width="190" height="22" rx="6" style="fill:' + (scale ? 'var(--u-ok-soft)' : 'var(--u-warn-soft)') + '"/>' + tx(b.x + b.w - 95, 15, '', 'middle', 'cnt nm');
    var k = chartKit(st, s), bars = k.q('.bar'), cnt = k.q('.cnt')[0], DUR = 600;
    k.noCursor();
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, moving = 0;
      D.forEach(function (v, i) {
        var t0 = 200 + i * gap, p = ease.out(seg(ms, t0, t0 + DUR)), x = b.x + band * i + (band - th) / 2, full = v / max * b.h;
        if (p > 0 && p < 1) moving++;
        // scaleY: 완성 모양을 한 번 그리고 바닥 기준으로 늘린다 / height: 매 프레임 모양을 다시 계산
        if (scale) { bars[i].setAttribute('d', barPath(x, b.y + b.h - full, th, full)); bars[i].setAttribute('transform', 'translate(0 ' + (b.y + b.h) + ') scale(1 ' + Math.max(0.001, p) + ') translate(0 ' + -(b.y + b.h) + ')'); }
        else bars[i].setAttribute('d', barPath(x, b.y + b.h - full * p, th, full * p));
      });
      var frames = Math.round(seg(ms, 200, 200 + 5 * gap + DUR) * (5 * gap + DUR) / 16.7);
      cnt.textContent = scale ? '레이아웃 다시 계산 0번 · 합성만' : '레이아웃 다시 계산 약 ' + frames + '번';
      return ms < 200 ? '처음' : moving ? '막대 ' + moving + '개가 자라는 중 · ' + gap + 'ms 간격' : '다 자람 · ' + (scale ? 'scaleY라 모양 계산은 처음 한 번' : 'height라 프레임마다 모양 계산');
    } };
  };

  S['line-draw'] = function (st, c) {
    var clip = c.method === 'clip 사각형 밀기', dur = +c.duration_ms, L = LINES.slice(0, 2), max = 60, b = { x: 34, y: 14, w: 370, h: 180 }, MS = dur + 2000, id = 'uld' + (++CLIP_N), base = lineBase(b, L, max);
    var s = '<defs><clipPath id="' + id + '"><rect class="cr" x="' + b.x + '" y="0" height="' + VH + '" width="0"/></clipPath></defs>' + yAxis(b, max) + xAxis12(b) +
      '<g' + (clip ? ' clip-path="url(#' + id + ')"' : '') + '>' + base.svg + '</g>' + L.map(function (l, j) { return '<circle class="end" cx="' + base.X(11) + '" cy="' + base.Y(l[1][11]) + '" r="4" style="fill:' + CC[j] + ';stroke:var(--u-panel);stroke-width:2"/>' + tx(base.X(11) + 9, base.Y(l[1][11]) + 4, l[0], '', 'nm end'); }).join('') +
      '<line class="edge" y1="' + b.y + '" y2="' + (b.y + b.h) + '" style="stroke:var(--u-accent);stroke-width:1;stroke-dasharray:3 3"/>';
    var k = chartKit(st, s), cr = k.q('.cr')[0], lns = k.q('.ln'), ends = k.q('.end'), edge = k.q('.edge')[0];
    k.noCursor();
    if (!clip) lns.forEach(function (e) { e.setAttribute('pathLength', '1'); e.style.strokeDasharray = '1'; });
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, p = ease.inOut(seg(ms, 300, 300 + dur)), w = b.w * p;
      if (clip) { cr.setAttribute('width', w); edge.setAttribute('x1', b.x + w); edge.setAttribute('x2', b.x + w); edge.style.opacity = p > 0 && p < 1 ? 0.8 : 0; }
      else { lns.forEach(function (e) { e.style.strokeDashoffset = 1 - p; }); edge.style.opacity = 0; }
      ends.forEach(function (e) { e.style.opacity = seg(ms, 300 + dur, 500 + dur); });
      return p <= 0 ? '처음' : p < 1 ? (clip ? '잘라 낸 사각형을 넓혀 드러냄(점선이 그 끝)' : '선 길이를 대시로 조금씩 드러냄') + ' · ' + dur + 'ms' : '다 그려짐 · 끝점과 이름이 그다음에';
    } };
  };

  S['chart-morph'] = function (st, c) {
    var byKey = c.match === '이름(key)으로 짝', withAx = c.axis === '함께 이어서', dur = +c.duration_ms, T1 = 1300, MS = T1 + dur + 1900;
    var A = [['민지', 24], ['준호', 17], ['서연', 31], ['도윤', 12], ['하은', 20]], B = [['민지', 19], ['준호', 28], ['서연', 22], ['도윤', 52], ['하은', 9]];
    var sortD = function (d) { return d.slice().sort(function (x, y) { return y[1] - x[1]; }); }, SA = sortD(A), SB = sortD(B), b = { x: 56, y: 30, w: 380, h: 166 }, band = b.h / 5, th = band * 0.6;
    // Axis Rescale: 최댓값이 바뀌면(40 → 60) 눈금도 막대와 같이 움직인다. 눈금 값은 그대로, 자리만 옮긴다
    var M0 = tickMax(31 * 1.1), M1 = tickMax(52 * 1.1), s = tx(b.x - 50, 14, '', '', 'per nm');
    for (var v = 0; v <= M1; v += 10) s += '<line class="gx" y1="' + b.y + '" y2="' + (b.y + b.h) + '" style="' + (v ? GRID : BASE) + '"/><text class="gt tk" text-anchor="middle" y="' + (b.y + b.h + 15) + '">' + v + '</text>';
    SA.forEach(function () { s += '<path class="bar" style="fill:var(--c1)"/><text class="nmL tk" text-anchor="end"></text><text class="vl"></text>'; });
    var k = chartKit(st, s), bars = k.q('.bar'), nms = k.q('.nmL'), vls = k.q('.vl'), per = k.q('.per')[0], gx = k.q('.gx'), gt = k.q('.gt');
    k.noCursor();
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, p = ease.inOut(seg(ms, T1, T1 + dur)), max = withAx ? lerp(M0, M1, p) : ms >= T1 ? M1 : M0;
      per.textContent = p < 0.5 ? '지난주 처리 건수' : '이번 주 처리 건수';
      gx.forEach(function (g, i) { var x = b.x + i * 10 / max * b.w, o = clamp((max - i * 10) / 4 + 1); g.setAttribute('x1', x); g.setAttribute('x2', x); g.style.opacity = o; gt[i].setAttribute('x', x); gt[i].style.opacity = o; });
      // 짝: 이름이면 같은 사람끼리(자리도 옮김), 순서면 n번째 막대끼리(이름이 중간에 바뀜)
      SA.forEach(function (d, i) {
        var from = { r: i, v: d[1], n: d[0] }, to;
        if (byKey) { var r2 = SB.findIndex(function (x) { return x[0] === d[0]; }); to = { r: r2, v: SB[r2][1], n: d[0] }; } else to = { r: i, v: SB[i][1], n: SB[i][0] };
        var r = lerp(from.r, to.r, p), v = lerp(from.v, to.v, p), y = b.y + band * r + (band - th) / 2, w = v / max * b.w;
        bars[i].setAttribute('d', barPath(b.x, y, w, th, true));
        nms[i].setAttribute('x', b.x - 8); nms[i].setAttribute('y', y + th / 2 + 4); nms[i].textContent = p < 0.5 ? from.n : to.n;
        vls[i].setAttribute('x', b.x + w + 6); vls[i].setAttribute('y', y + th / 2 + 4); vls[i].textContent = Math.round(v);
      });
      var ax = withAx ? '축도 함께 ' + M0 + '→' + M1 : '축이 먼저 ' + M1 + '로 튐';
      return ms < T1 ? '지난주(큰 순서) · 축 0~' + M0 : p < 1 ? (byKey ? '같은 사람이 새 순위 자리로' : '같은 자리끼리 길이만, 이름이 바뀜') + ' · ' + ax : byKey ? '이번 주 · 누가 어디로 갔는지 보임' : '이번 주 · 누가 올랐는지 따라가기 어려움';
    } };
  };

  S['live-stream'] = function (st, c) {
    var W = +c.window, every = c.rate === '1초마다' ? 1000 : 250, MS = 6000, PZ = 4300, b = { x: 34, y: 26, w: 420, h: 160 }, max = 40;
    var val = function (n) { return 20 + 8 * Math.sin(n / 7) + 5 * Math.sin(n / 2.3) + prand(n, 13) * 4; };
    var s = yAxis(b, max) + '<polyline class="ln" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/><circle class="hd" r="4" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/>' +
      tx(b.x, 14, '', '', 'lv nm') + tx(b.x + b.w, b.y + b.h + 16, '지금', 'end', 'tk') + tx(b.x, b.y + b.h + 16, '', '', 'ago tk');
    var k = chartKit(st, s), lnE = k.q('.ln')[0], hd = k.q('.hd')[0], lv = k.q('.lv')[0], ago = k.q('.ago')[0];
    st.insertAdjacentHTML('beforeend', PAUSE);
    var pz = st.querySelector('.pz');
    ago.textContent = Math.round(W * every / 1000) + '초 전';
    return { ms: MS, rest: 0, at: function (t) {
      var ms = t * MS, run = Math.min(ms, PZ), f = run / every, n0 = Math.floor(f), frac = f - n0;
      // 창 크기는 고정: 새 점이 오른쪽에서 들어오고 맨 왼쪽 점은 밀려난다
      var pts = []; for (var i = 0; i <= W; i++) { var n = n0 - W + i, x = b.x + b.w * (i - frac) / W; if (x >= b.x - 0.5) pts.push(x.toFixed(1) + ',' + (b.y + b.h - val(n) / max * b.h).toFixed(1)); }
      lnE.setAttribute('points', pts.join(' '));
      var last = val(n0); hd.setAttribute('cx', b.x + b.w * (W - frac) / W); hd.setAttribute('cy', b.y + b.h - last / max * b.h);
      lv.textContent = (ms >= PZ ? '■ 멈춤 · ' : '● 실시간 · ') + '들어오는 이슈 ' + Math.round(last) + '건/분';
      pzLabel(pz, ms >= PZ);
      var pr = rel(st, pz); k.cur(VW - 8, VH - 4, false);
      if (ms > PZ - 700) { var cu = st.querySelector('.u-cursor'); put(cu, pr.x + pr.w / 2, pr.y + pr.h / 2, ms > PZ - 120 && ms < PZ + 60); }
      return ms < PZ ? '최근 ' + W + '개만 보이게 창을 밀며 그림 · ' + (every === 1000 ? '1초' : '0.25초') + '마다 새 값' : '멈춤 단추 · 다시 누르면 지금 값부터';
    } };
  };

  S['bar-chart-race'] = function (st, c) {
    var nb = +c.bars, step = +c.step_ms, NAMES = ['민지', '준호', '서연', '도윤', '하은', '지후', '수아', '예준', '하린', '시우', '유나', '건우'], PER = ['1분기', '2분기', '3분기', '4분기', '5분기', '6분기', '7분기', '8분기'];
    var NP = PER.length, MS = 400 + step * (NP - 1) + 1600, b = { x: 56, y: 10, w: 360, h: 196 }, band = b.h / nb, th = band * 0.68, ITEMS = NAMES.slice(0, nb), auto = MS > 5000;
    // 분기별 누적 처리 건수: 사람마다 속도가 달라 순위가 바뀐다
    var VAL = ITEMS.map(function (n, i) { var acc = 0, r = []; for (var q = 0; q < NP; q++) { acc += 4 + prand(i, 30 + q) * 9 + (i % 3 === 0 ? q * 1.2 : 0); r.push(acc); } return r; });
    var s = ''; ITEMS.forEach(function (n, i) { s += '<path class="bar" style="fill:' + CC[i % 4] + '"/><text class="nmL tk" text-anchor="end"></text><text class="vl"></text>'; });
    s += tx(b.x + b.w + 54, b.y + b.h - 4, '', 'end', 'big per');
    var k = chartKit(st, s), bars = k.q('.bar'), nms = k.q('.nmL'), vls = k.q('.vl'), per = k.q('.per')[0];
    if (auto) st.insertAdjacentHTML('beforeend', PAUSE);
    var pz = st.querySelector('.pz');
    k.noCursor();
    function at(f) { var q = Math.min(NP - 1, Math.floor(f)), r = f - q; return ITEMS.map(function (n, i) { return q >= NP - 1 ? VAL[i][NP - 1] : lerp(VAL[i][q], VAL[i][q + 1], r); }); }
    return { ms: MS, rest: 0, at: function (t) {
      var fOf = function (m) { return Math.max(0, Math.min(NP - 1, (m - 400) / step)); }, ranks = function (vv) { return vv.map(function (x, i) { return i; }).sort(function (a, z) { return vv[z] - vv[a]; }); };
      var ms = t * MS, f = fOf(ms), v = at(f), mx = Math.max.apply(null, v) * 1.12, rank = ranks(v);
      // 자리 = 최근 280ms 동안의 순위 평균. 순위가 바뀌면 막대가 이어서 미끄러지고, 멈추면 정확한 순위 자리에 선다
      var past = []; for (var j = 0; j < 10; j++) past.push(ranks(at(fOf(ms - 280 * j / 9))));
      ITEMS.forEach(function (n, i) {
        var r = past.reduce(function (acc, rk) { return acc + rk.indexOf(i); }, 0) / past.length, y = b.y + band * r + (band - th) / 2, w = v[i] / mx * b.w;
        bars[i].setAttribute('d', barPath(b.x, y, w, th, true));
        nms[i].setAttribute('x', b.x - 8); nms[i].setAttribute('y', y + th / 2 + 4); nms[i].textContent = n;
        vls[i].setAttribute('x', b.x + w + 6); vls[i].setAttribute('y', y + th / 2 + 4); vls[i].textContent = Math.round(v[i]);
      });
      per.textContent = PER[Math.round(f)];
      if (pz) pzLabel(pz, f >= NP - 1);
      var lead = ITEMS[rank[0]];
      return f >= NP - 1 ? '끝 · 마지막 순위에서 멈춤' + (auto ? '(5초 넘게 움직여 멈춤 단추를 둠)' : '') : PER[Math.round(f)] + ' · 1위 ' + lead + ' · 순위가 바뀌면 막대가 자리를 바꿈';
    } };
  };

  /* ───── 움직임 › 차트 모션 (2차) ───── */
  // 차트 위 전환 칩(필터·종류 단추). on이면 고른 모양
  function chipSvg(x, w, label) { return '<rect class="chip" x="' + x + '" y="3" width="' + w + '" height="20" rx="10"/>' + tx(x + w / 2, 17, label, 'middle', 'chipt'); }
  function chipOn(k, i) { k.q('.chip').forEach(function (e, j) { e.style.cssText = j === i ? 'fill:color-mix(in oklab, var(--c1) 18%, var(--u-panel));stroke:var(--c1);stroke-width:1.5' : 'fill:var(--u-panel);stroke:var(--u-line);stroke-width:1'; }); k.q('.chipt').forEach(function (e, j) { e.style.fill = j === i ? 'var(--u-ink)' : 'var(--u-muted)'; e.style.fontWeight = j === i ? 600 : 400; }); }

  S['enter-update-exit'] = function (st, c) {
    var seq = c.order === '차례로', fade = c.exit === '줄며 사라짐', T = 1400, MS = 4600, max = 40;
    var A = [['민지', 24], ['준호', 17], ['서연', 31], ['도윤', 12], ['하은', 20]], B = [['민지', 18], ['서연', 26], ['하은', 22], ['지호', 15], ['유나', 9]];
    var IT = [], find = function (L, n) { for (var i = 0; i < L.length; i++) if (L[i][0] === n) return i; return -1; };
    A.concat(B).forEach(function (d) { if (IT.some(function (x) { return x.n === d[0]; })) return; var a = find(A, d[0]), z = find(B, d[0]); IT.push({ n: d[0], a: a, z: z, va: a < 0 ? 0 : A[a][1], vb: z < 0 ? 0 : B[z][1] }); });
    var PH = seq ? { x: [T, T + 350], u: [T + 350, T + 950], e: [T + 950, T + 1350] } : { x: [T, T + 700], u: [T, T + 700], e: [T, T + 700] };
    var b = { x: 40, y: 32, w: 420, h: 160 }, band = b.w / 5, th = band * 0.56, P = function (i) { return b.x + band * i + (band - th) / 2; }, Y = function (v) { return b.y + b.h - v / max * b.h; };
    var s = yAxis(b, max) + tx(b.x - 6, 17, '담당자별 처리 건수', 'start', 'tk') + chipSvg(340, 60, '이번 주') + chipSvg(404, 60, '지난주');
    IT.forEach(function () { s += '<path class="eb" style="fill:var(--c1)"/><text class="vl" text-anchor="middle"></text><text class="en tk" text-anchor="middle"></text>'; });
    var k = chartKit(st, s), ebs = k.q('.eb'), vls = k.q('.vl'), ens = k.q('.en');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, px = ease.inOut(seg(ms, PH.x[0], PH.x[1])), pu = ease.inOut(seg(ms, PH.u[0], PH.u[1])), pe = ease.out(seg(ms, PH.e[0], PH.e[1]));
      chipOn(k, ms < T ? 0 : 1);
      IT.forEach(function (d, i) {
        var g = ease.out(seg(ms, 100 + i * 60, 600 + i * 60)), x, v, op = 1;
        if (d.z < 0) { x = P(d.a); v = d.va * g * (fade ? 1 - px : ms >= PH.x[0] ? 0 : 1); op = fade ? 1 - px * 0.6 : 1; }
        else if (d.a < 0) { x = P(d.z); v = d.vb * pe; op = pe > 0 ? 1 : 0; }
        else { x = lerp(P(d.a), P(d.z), pu); v = lerp(d.va, d.vb, pu) * g; }
        var h = v / max * b.h, on = v > 0.3 ? op : 0;
        ebs[i].setAttribute('d', barPath(x, Y(v), th, h)); ebs[i].style.opacity = on;
        vls[i].setAttribute('x', x + th / 2); vls[i].setAttribute('y', Y(v) - 6); vls[i].textContent = Math.round(v); vls[i].style.opacity = on * seg(ms, 500, 700);
        ens[i].setAttribute('x', x + th / 2); ens[i].setAttribute('y', b.y + b.h + 16); ens[i].textContent = d.n; ens[i].style.opacity = d.a < 0 ? pe : d.z < 0 ? (fade ? 1 - px : ms >= PH.x[0] ? 0 : 1) : 1;
      });
      var q = glide(ms, 600, 1100, [VW - 8, VH - 4], [434, 14]);
      k.cur(q[0], q[1], ms > 1150 && ms < 1300);
      if (ms < T) return '이번 주 막대 · 지난주를 누르면 담당자가 바뀜';
      if (ms < PH.e[1]) return seq ? (ms < PH.u[0] ? '① 나감: 준호·도윤 ' + (fade ? '줄어 사라짐' : '바로 사라짐') : ms < PH.e[0] ? '② 옮김: 남은 막대가 새 자리·값으로' : '③ 들어옴: 지호·유나가 자람') : '셋이 한꺼번에 · 나가는 막대와 들어오는 막대가 겹침';
      return '지난주 · 이름(key)으로 짝지어 나감 → 옮김 → 들어옴';
    } };
  };

  S['chart-type-morph'] = function (st, c) {
    var morph = c.how === '모양을 이어서', dur = +c.duration_ms, T1 = 1300, T2 = T1 + dur + 1100, MS = T2 + dur + 800, NS = 14, PAD = 0.018;
    var D = [['완료', 20], ['진행', 12], ['대기', 9], ['검토', 7]], tot = 48, max = 24, b = { x: 40, y: 32, w: 300, h: 164 }, band = b.w / 4, th = band * 0.56, cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 2, R = 80, r = 50;
    var Y = function (v) { return b.y + b.h - v / max * b.h; }, cum = 0;
    var G = D.map(function (d, i) { var a0 = -Math.PI / 2 + cum / tot * 2 * Math.PI + PAD; cum += d[1]; return { x0: b.x + band * i + (band - th) / 2, v: d[1], a0: a0, a1: -Math.PI / 2 + cum / tot * 2 * Math.PI - PAD }; });
    // 막대의 윗변·밑변과 도넛 조각의 바깥·안쪽 호를 같은 수의 점으로 나눠 점끼리 잇는다
    function shape(g, p) {
      var o = [], n = [];
      for (var j = 0; j <= NS; j++) {
        var f = j / NS, a = g.a0 + (g.a1 - g.a0) * f, bx = g.x0 + th * f;
        o.push([lerp(bx, cx + R * Math.cos(a), p), lerp(Y(g.v), cy + R * Math.sin(a), p)]); n.push([lerp(bx, cx + r * Math.cos(a), p), lerp(b.y + b.h, cy + r * Math.sin(a), p)]);
      }
      return 'M' + o.concat(n.reverse()).map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z';
    }
    var s = '<g class="ax">' + yAxis(b, max) + '</g>' + tx(b.x - 6, 17, '상태별 이슈', 'start', 'tk') + chipSvg(358, 52, '막대') + chipSvg(414, 52, '도넛');
    D.forEach(function (d, i) { s += '<path class="mA" style="fill:' + CC[i] + ';stroke:var(--u-panel);stroke-width:2;stroke-linejoin:round"/><path class="mB" style="fill:' + CC[i] + ';stroke:var(--u-panel);stroke-width:2;stroke-linejoin:round"/>' + tx(G[i].x0 + th / 2, b.y + b.h + 16, d[0], 'middle', 'bl tk') + tx(G[i].x0 + th / 2, Y(d[1]) - 6, d[1], 'middle', 'bl vl') + '<rect x="372" y="' + (64 + i * 24) + '" width="10" height="10" rx="2" style="fill:' + CC[i] + '"/>' + tx(388, 73 + i * 24, d[0] + ' ' + d[1], '', 'tk'); });
    s += tx(cx, cy + 4, tot + '건', 'middle', 'dl vl') + tx(cx, cy + 20, '전체', 'middle', 'dl tk');
    var k = chartKit(st, s), mA = k.q('.mA'), mB = k.q('.mB'), bl = k.q('.bl'), dl = k.q('.dl'), ax = k.q('.ax')[0];
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, q = ease.inOut(seg(ms, T1, T1 + dur)) - ease.inOut(seg(ms, T2, T2 + dur)), g0 = ease.out(seg(ms, 100, 650));
      chipOn(k, (ms < T1 || ms >= T2) ? 0 : 1);
      G.forEach(function (g, i) {
        var gv = { x0: g.x0, v: g.v * g0, a0: g.a0, a1: g.a1 };
        if (morph) { mA[i].setAttribute('d', shape(gv, q)); mA[i].style.opacity = 1; mB[i].style.opacity = 0; }
        else { mA[i].setAttribute('d', shape(gv, 0)); mA[i].style.opacity = 1 - q; mB[i].setAttribute('d', shape(g, 1)); mB[i].style.opacity = q; }
      });
      var lb = 1 - clamp(q * 2), ld = clamp(q * 2 - 1);
      bl.forEach(function (e) { e.style.opacity = lb * seg(ms, 500, 750); }); dl.forEach(function (e) { e.style.opacity = ld; }); ax.style.opacity = lb;
      var c1 = glide(ms, T1 - 600, T1 - 150, [VW - 8, VH - 4], [440, 14]), c2 = glide(ms, T2 - 600, T2 - 150, [440, 14], [384, 14]), cu = ms < T1 + 200 ? c1 : c2;
      k.cur(cu[0], cu[1], (ms > T1 - 140 && ms < T1) || (ms > T2 - 140 && ms < T2));
      var how = morph ? '같은 막대가 도넛 조각으로 휘어짐' : '막대가 사라지며 도넛이 겹쳐 나타남(교차 페이드)';
      return ms < T1 ? '막대 · 도넛을 누르면 종류가 바뀜' : ms < T1 + dur ? how + ' · ' + dur + 'ms' : ms < T2 ? '도넛 · 색과 범례는 그대로' : ms < T2 + dur ? '다시 막대로 · ' + (morph ? '조각이 펴짐' : '교차 페이드') : '막대 ↔ 도넛 · 같은 항목이 같은 색으로 이어짐';
    } };
  };

  S['motion-chart'] = function (st, c) {
    var trail = c.trail === '지나온 자취', step = c.step === '한 달씩 끊어', MS = 5600, P0 = 1100, PM = 600, P1 = P0 + PM * 5, S0 = 4500, S1 = 5100, M = ['1월', '2월', '3월', '4월', '5월', '6월'];
    var D = [['앱', [[44, 5.2, 8], [52, 5.0, 8], [60, 4.7, 9], [72, 4.4, 10], [80, 4.0, 10], [96, 3.8, 12]]], ['운영', [[70, 5.2, 10], [74, 5.8, 10], [78, 6.4, 10], [82, 7.0, 10], [84, 7.4, 10], [85, 7.2, 10]]], ['웹', [[50, 7.0, 7], [55, 6.8, 7], [60, 6.6, 8], [64, 6.5, 8], [68, 6.4, 8], [70, 6.4, 8]]], ['결제', [[20, 8.0, 4], [24, 7.0, 4], [30, 6.0, 5], [34, 5.2, 5], [38, 4.6, 6], [40, 4.1, 6]]], ['정산', [[30, 3.0, 3], [29, 3.2, 3], [28, 3.4, 3], [28, 3.5, 3], [28, 3.4, 3], [28, 3.4, 3]]]];
    var b = { x: 40, y: 12, w: 410, h: 158 }, X = function (v) { return b.x + v / 120 * b.w; }, Y = function (v) { return b.y + b.h - v / 12 * b.h; }, R = function (z) { return 20 * Math.sqrt(z / 12); };
    var TX = function (f) { return 80 + f / 5 * 360; }, s = yAxis(b, 12, '일') + tx(b.x + 12, b.y + b.h - 10, '', 'start', 'big mo');
    [0, 30, 60, 90, 120].forEach(function (v) { s += tx(X(v), b.y + b.h + 14, v + (v === 120 ? '건' : ''), 'middle', 'tk'); });
    s += tx(b.x + b.w, b.y + 10, '가로 처리 건수 · 세로 처리 일수 · 원 인원', 'end', 'tk');
    D.forEach(function () { s += '<polyline class="mt" style="fill:none;stroke:var(--c1);stroke-width:1.5;stroke-opacity:.45;stroke-linejoin:round"/>'; });
    D.forEach(function (d) { s += '<circle class="mb" style="fill:var(--c1);fill-opacity:.5;stroke:var(--u-panel);stroke-width:1.5"/><text class="mn" text-anchor="middle">' + d[0] + '</text>'; });
    s += '<circle cx="56" cy="207" r="11" style="fill:var(--u-panel);stroke:var(--u-line)"/><path class="pi" style="fill:var(--u-ink)"/>' + ln(TX(0), 207, TX(5), 207, 'stroke:var(--u-line);stroke-width:4;stroke-linecap:round') + '<line class="tf" y1="207" y2="207" x1="' + TX(0) + '" style="stroke:var(--c1);stroke-width:4;stroke-linecap:round"/><circle class="th" cy="207" r="7" style="fill:var(--c1);stroke:var(--u-panel);stroke-width:2"/>';
    M.forEach(function (m, i) { s += tx(TX(i), 226, m, 'middle', 'tk'); });
    var k = chartKit(st, s), mts = k.q('.mt'), mbs = k.q('.mb'), mns = k.q('.mn'), mo = k.q('.mo')[0], pi = k.q('.pi')[0], tf = k.q('.tf')[0], th = k.q('.th')[0];
    mo.style.opacity = 0.22; mns.forEach(function (e) { e.style.fill = 'var(--u-ink)'; e.style.fontWeight = 600; });
    function pos(d, f) { var q = Math.min(4, Math.floor(f)), r = f - q, a = d[1][q], z = d[1][q + 1]; return [X(lerp(a[0], z[0], r)), Y(lerp(a[1], z[1], r)), R(lerp(a[2], z[2], r))]; }
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, g = clamp((ms - P0) / PM / 5) * 5, f;
      if (step) { var n = Math.floor(g); f = n >= 5 ? 5 : n + ease.inOut(seg((g - n) * PM, PM - 250, PM)); } else f = g;
      if (ms >= S0) f = lerp(5, 2, ease.inOut(seg(ms, S0, S1)));
      var play = ms > P0 && ms < P1, ap = ease.out(seg(ms, 100, 500));
      D.forEach(function (d, i) {
        var p = pos(d, f); mbs[i].setAttribute('cx', p[0]); mbs[i].setAttribute('cy', p[1]); mbs[i].setAttribute('r', p[2] * ap); mns[i].setAttribute('x', p[0]); mns[i].setAttribute('y', p[1] + 4); mns[i].style.opacity = ap;
        var tr = []; for (var m = 0; m <= Math.floor(f); m++) tr.push(X(d[1][m][0]).toFixed(1) + ',' + Y(d[1][m][1]).toFixed(1)); tr.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
        mts[i].setAttribute('points', tr.join(' ')); mts[i].style.opacity = trail ? 1 : 0;
      });
      mo.textContent = M[Math.round(f)];
      pi.setAttribute('d', play ? 'M51 202h3.5v10H51zM57.5 202H61v10h-3.5z' : 'M52.5 201.5L62 207l-9.5 5.5z');
      tf.setAttribute('x2', TX(f)); th.setAttribute('cx', TX(f));
      var cu = ms < S0 - 400 ? glide(ms, 500, 900, [VW - 8, VH - 4], [56, 208]) : ms < S0 ? glide(ms, S0 - 400, S0 - 50, [56, 208], [TX(5), 208]) : [TX(f), 208];
      k.cur(cu[0], cu[1], (ms > 950 && ms < 1080) || (ms > S0 - 40 && ms < S1));
      return ms < P0 ? '1월 · 재생 단추를 누름' : play ? M[Math.round(f)] + ' · ' + (step ? '한 달씩 끊어 이동' : '달 사이를 이어서 이동') : ms < S0 ? '6월에서 멈춤' : ms < S1 ? '슬라이더를 끌어 되돌림' : '3월로 되돌림 · ' + (trail ? '지나온 자취로 방향이 보임' : '자취 없음');
    } };
  };

  S['focus-dimming'] = function (st, c) {
    var gray = c.dim === '회색으로', dur = +c.duration_ms, MS = 4400, b = { x: 34, y: 30, w: 372, h: 162 }, max = 60;
    var X = function (i) { return b.x + b.w * i / 11; }, Y = function (v) { return b.y + b.h - v / max * b.h; }, s = yAxis(b, max) + xAxis12(b), lx = [34, 118, 202];
    LINES.forEach(function (l, j) { s += '<polyline class="fl" pathLength="1" points="' + l[1].map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '" style="fill:none;stroke-width:2;stroke-linejoin:round;stroke-dasharray:1"/>' + tx(X(11) + 8, Y(l[1][11]) + 4, l[0], '', 'fn nm') + '<rect class="fg" x="' + lx[j] + '" y="5" width="10" height="10" rx="2"/>' + tx(lx[j] + 14, 14, l[0], '', 'fgt tk'); });
    s += '<circle class="fd" r="4.5" style="stroke:var(--u-panel);stroke-width:2;opacity:0"/>';
    var k = chartKit(st, s), fls = k.q('.fl'), fns = k.q('.fn'), fgs = k.q('.fg'), fgt = k.q('.fgt'), fd = k.q('.fd')[0];
    // 가리킨 계열이 바뀌는 순간들: [시각, 계열(-1은 없음)]
    var EV = [[0, -1], [1600, 1], [2750, 2], [3700, -1]], HW = 7;
    function dimOf(j, f) { return f < 0 || f === j ? 0 : 1; }
    return { ms: MS, rest: 0.35, at: function (t) {
      var ms = t * MS, e = 0; while (e + 1 < EV.length && ms >= EV[e + 1][0]) e++;
      var cur = EV[e][1], prev = e ? EV[e - 1][1] : -1, p = dur ? ease.out(seg(ms, EV[e][0], EV[e][0] + dur)) : 1;
      LINES.forEach(function (l, j) {
        var d = lerp(dimOf(j, prev), dimOf(j, cur), p), col = CC[j];
        fls[j].style.strokeDashoffset = 1 - ease.inOut(seg(ms, 150 + j * 150, 1050 + j * 150));
        fls[j].style.stroke = gray && d > 0.5 ? 'var(--u-muted)' : col; fls[j].style.opacity = gray ? 1 - d * 0.45 : 1 - d * 0.8; fls[j].style.strokeWidth = cur === j ? 3 : 2;
        fns[j].style.opacity = seg(ms, 1000 + j * 150, 1200 + j * 150) * (1 - d * 0.7); fns[j].style.fill = 'var(--u-ink)';
        fgs[j].style.fill = gray && d > 0.5 ? 'var(--u-muted)' : col; fgs[j].style.opacity = 1 - d * 0.6; fgt[j].style.opacity = 1 - d * 0.5;
      });
      var on1 = cur === 1, q;
      fd.setAttribute('cx', X(HW)); fd.setAttribute('cy', Y(LINES[1][1][HW])); fd.style.fill = CC[1]; fd.style.opacity = on1 ? 1 : 0;
      if (ms < 2400) q = glide(ms, 1150, 1600, [VW - 8, VH - 4], [X(HW) + 3, Y(LINES[1][1][HW]) + 4]);
      else if (ms < 3400) q = glide(ms, 2350, 2750, [X(HW) + 3, Y(LINES[1][1][HW]) + 4], [lx[2] + 20, 12]);
      else q = glide(ms, 3300, 3700, [lx[2] + 20, 12], [VW - 8, VH - 4]);
      k.cur(q[0], q[1], false); k.tip(on1, X(HW), Y(LINES[1][1][HW]) - 12, sw(1) + '<b>닫힌 이슈</b> ' + WK[HW] + ' ' + LINES[1][1][HW]);
      var how = (gray ? '나머지 회색' : '나머지 20%') + ' · ' + (dur ? dur + 'ms' : '바로');
      return ms < 1600 ? '선 3개 · 모두 같은 진하기' : cur === 1 ? '선을 가리킴 · ' + how : cur === 2 ? '범례를 가리킴 · 그 계열만' : '벗어나면 되돌림';
    } };
  };

  S['annotation-reveal'] = function (st, c) {
    var mode = c.timing, one = c.count === '1개', MS = 4200, D = [32, 33, 35, 34, 36, 44, 45, 43, 41, 40, 38, 37], max = 60;
    var b = { x: 34, y: 18, w: 410, h: 176 }, X = function (i) { return b.x + b.w * i / 11; }, Y = function (v) { return b.y + b.h - v / max * b.h; }, L0 = 200, L1 = 1600;
    var s = yAxis(b, max) + xAxis12(b);
    // 주석: 출시 주간 띠, 급증 지시선, 목표선. pass는 선이 그 자리를 지나는 시각
    var A = [{ k: 'band', i: 4.5 }, { k: 'spike', i: 5 }, { k: 'goal', i: 0 }];
    if (one) A = [A[1]];
    A.forEach(function (a) {
      if (a.k === 'band') s += '<g class="an"><rect x="' + X(3.5) + '" y="' + b.y + '" width="' + (X(5.5) - X(3.5)) + '" height="' + b.h + '" style="fill:var(--u-muted);opacity:.12"/>' + tx(X(4.5), b.y + 12, '새 버전 출시', 'middle', 'tk') + '</g>';
      if (a.k === 'spike') s += '<g class="an"><path d="M' + (X(5) + 6) + ' ' + (Y(44) - 6) + 'L' + (X(5) + 40) + ' ' + (Y(44) - 34) + 'H' + (X(5) + 48) + '" style="fill:none;stroke:var(--u-ink);stroke-width:1.2"/>' + tx(X(5) + 52, Y(44) - 30, '6주 +8건 급증', 'start', 'vl') + '</g>';
      if (a.k === 'goal') s += '<g class="an">' + ln(b.x, Y(40), b.x + b.w, Y(40), 'stroke:var(--u-ink);stroke-width:1.2;stroke-dasharray:5 4') + tx(b.x + b.w, Y(40) - 6, '목표 40건 이하', 'end', 'tk') + '</g>';
    });
    s += '<polyline class="al" pathLength="1" points="' + D.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round;stroke-dasharray:1"/>' + tx(b.x - 6, 10, '열린 이슈', 'start', 'tk');
    var k = chartKit(st, s), al = k.q('.al')[0], ans = k.q('.an');
    k.noCursor();
    var T0 = A.map(function (a, n) { return mode === '처음부터 모두' ? 0 : mode === '선이 지나갈 때' ? L0 + (L1 - L0) * a.i / 11 : L1 + 250 + n * 450; });
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, shown = 0;
      al.style.strokeDashoffset = 1 - seg(ms, L0, L1);
      ans.forEach(function (g, n) { var p = mode === '처음부터 모두' ? 1 : ease.out(seg(ms, T0[n], T0[n] + 300)); g.style.opacity = p; g.style.transform = 'translateY(' + (1 - p) * 6 + 'px)'; if (p > 0.5) shown++; });
      if (mode === '처음부터 모두') return ms < L1 ? '주석이 처음부터 다 떠 있어 선보다 먼저 읽힘' : '주석 ' + A.length + '개가 처음부터 보임';
      return ms < L1 ? '선이 그려짐' + (mode === '선이 지나갈 때' && shown ? ' · 지나간 자리의 주석이 나타남' : '') : shown < A.length ? '주석이 하나씩 나타남(' + shown + '/' + A.length + ')' : '주석 ' + A.length + '개 · 읽는 순서대로 등장';
    } };
  };

  S['step-transition'] = function (st, c) {
    var discrete = c.trigger === '단계에 들어갈 때', dur = +c.duration_ms, MS = 5600, TL = 115;
    var TEAM = ['앱', '웹', '결제', '정산', '검색'], VA = [34, 22, 38, 12, 26], VB = [30, 24, 20, 14, 25];
    var STEP = [['이번 달 팀별', '처리 건수예요'], ['결제 팀이 가장', '많이 처리했어요'], ['목표 30건을 넘은', '팀은 둘이에요'], ['지난달에는 결제가', '20건이었어요']];
    var SX = [{ e: [1, 1, 1, 1, 1], r: 0, d: 0 }, { e: [0, 0, 1, 0, 0], r: 0, d: 0 }, { e: [1, 0, 1, 0, 0], r: 1, d: 0 }, { e: [0, 0, 1, 0, 0], r: 0, d: 1 }];
    var SC = [[800, 1400], [2200, 2800], [3600, 4200]], ENT = SC.map(function (z) { return z[0] + (z[1] - z[0]) * 0.7; });
    var b = { x: 258, y: 22, w: 207, h: 168 }, band = b.w / 5, th = band * 0.56, max = 40, Y = function (v) { return b.y + b.h - v / max * b.h; };
    var s = ln(230, 8, 230, 220, 'stroke:var(--u-line)') + yAxis(b, max);
    STEP.forEach(function (l, i) { s += '<g class="sc"><rect x="10" y="-30" width="170" height="56" rx="8"/><text x="22" y="-6" class="vl">' + l[0] + '</text><text x="22" y="12" class="vl">' + l[1] + '</text></g>'; });
    s += ln(4, TL, 186, TL, 'stroke:var(--u-muted);stroke-width:1;stroke-dasharray:3 3;opacity:.8') + tx(190, TL + 4, '기준선', 'start', 'tk');
    TEAM.forEach(function (n, i) { s += '<path class="sb" style="fill:var(--c1)"/>' + tx(b.x + band * i + band / 2, b.y + b.h + 16, n, 'middle', 'tk'); });
    s += '<g class="sr">' + ln(b.x, Y(30), b.x + b.w, Y(30), 'stroke:var(--u-ink);stroke-width:1.2;stroke-dasharray:5 4') + tx(b.x + b.w, Y(30) - 5, '목표 30', 'end', 'tk') + '</g>' + tx(b.x - 6, 12, '', 'start', 'spn tk');
    var k = chartKit(st, s), scs = k.q('.sc'), sbs = k.q('.sb'), sr = k.q('.sr')[0], spn = k.q('.spn')[0];
    k.noCursor();
    function scroll(ms) { var v = 0; SC.forEach(function (z, i) { v += ease.inOut(seg(ms, z[0], z[1])); }); return v; }
    function mix(u) { var i = Math.min(2, Math.floor(u)), f = u - i, A = SX[i], B = SX[i + 1]; return { e: A.e.map(function (x, j) { return lerp(x, B.e[j], f); }), r: lerp(A.r, B.r, f), d: lerp(A.d, B.d, f) }; }
    return { ms: MS, rest: 0.3, at: function (t) {
      var ms = t * MS, sp = scroll(ms), step = 0, u;
      ENT.forEach(function (x, i) { if (ms >= x) step = i + 1; });
      u = discrete ? (step ? step - 1 + ease.inOut(seg(ms, ENT[step - 1], ENT[step - 1] + dur)) : 0) : sp;
      var S = mix(u), g = ease.out(seg(ms, 100, 600));
      scs.forEach(function (e, i) {
        var y = TL + (i - sp) * 92, act = discrete ? i === step : Math.abs(i - sp) < 0.5, r = e.firstChild;
        e.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')'); e.style.opacity = Math.max(0, 1 - Math.abs(y - TL) / 130);
        r.style.cssText = act ? 'fill:color-mix(in oklab, var(--c1) 12%, var(--u-panel));stroke:var(--c1);stroke-width:1.5' : 'fill:var(--u-panel);stroke:var(--u-line);stroke-width:1';
      });
      TEAM.forEach(function (n, i) {
        var v = lerp(VA[i], VB[i], S.d) * g, x = b.x + band * i + (band - th) / 2;
        sbs[i].setAttribute('d', barPath(x, Y(v), th, v / max * b.h)); sbs[i].style.opacity = 0.25 + 0.75 * S.e[i];
      });
      sr.style.opacity = S.r; spn.textContent = S.d > 0.5 ? '지난달 처리 건수' : '이번 달 처리 건수';
      var moving = SC.some(function (z) { return ms > z[0] && ms < z[1]; });
      return discrete ? '단계 ' + (step + 1) + (moving ? ' · 스크롤 중' : ' · 기준선 넘으면 ' + dur + 'ms 전환') : '스크롤만큼 이어서 바뀜';
    } };
  };

  /* ───── 만들기 › 차트 기법 ───── */
  // SVG 좌표 상자 b에 딱 맞는 캔버스를 장면 위에 얹는다(해상도는 화면 배율만큼)
  function canvasOver(st, k, b) {
    var cv = document.createElement('canvas'), a = k.px(b.x, b.y), z = k.px(b.x + b.w, b.y + b.h), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.cssText = 'position:absolute;pointer-events:none;left:' + a[0] + 'px;top:' + a[1] + 'px;width:' + (z[0] - a[0]) + 'px;height:' + (z[1] - a[1]) + 'px';
    cv.width = Math.max(1, Math.round((z[0] - a[0]) * dpr)); cv.height = Math.max(1, Math.round((z[1] - a[1]) * dpr));
    st.insertBefore(cv, st.querySelector('.u-ctip'));
    return cv;
  }
  function cssColor(st, v) { return getComputedStyle(st).getPropertyValue(v).trim() || '#2a78d6'; }

  S['renderer-choice'] = function (st, c) {
    var N = +c.points, mode = c.renderer, MS = 3200, b = { x: 34, y: 14, w: 250, h: 170 }, auto = mode === '자동(1천 넘으면 Canvas)', use = auto ? (N > 1000 ? 'Canvas' : 'SVG') : mode;
    var s = yAxis(b, 20, '') + tx(b.x + b.w, b.y + b.h + 16, '점 ' + fmt(N, true) + '개', 'end', 'tk');
    // 오른쪽: 표식 수 눈금(로그). 경계는 조사에서 겹친 대략 구간이다
    var mx0 = 306, mw = 160, L = function (n) { return mx0 + (Math.log10(n) - 2) / 3 * mw; };
    s += tx(mx0, 26, '그릴 표식 수', '', 'nm') +
      '<rect x="' + L(100) + '" y="36" width="' + (L(1000) - L(100)) + '" height="10" style="fill:var(--c3);opacity:.55"/><rect x="' + L(1000) + '" y="36" width="' + (L(30000) - L(1000)) + '" height="10" style="fill:var(--c4);opacity:.55"/><rect x="' + L(30000) + '" y="36" width="' + (L(100000) - L(30000)) + '" height="10" style="fill:var(--c2);opacity:.55"/>' +
      tx(L(100), 60, 'SVG', '', 'tk') + tx(L(3000), 60, 'Canvas', 'middle', 'tk') + tx(L(100000), 60, 'WebGL', 'end', 'tk') + tx(L(100), 72, '100', '', 'tk') + tx(L(100000), 72, '10만', 'end', 'tk') +
      '<path class="mk" d="M0 0l-5 -8h10z" style="fill:var(--u-ink)"/>' +
      tx(mx0, 104, '', '', 'r1 nm') + tx(mx0, 124, '', '', 'r2 tk') + tx(mx0, 144, '', '', 'r3 tk') + tx(mx0, 176, '경계는 대략(실측 아님)', '', 'tk');
    var k = chartKit(st, s), mk = k.q('.mk')[0], r1 = k.q('.r1')[0], r2 = k.q('.r2')[0], r3 = k.q('.r3')[0], cv = canvasOver(st, k, b), g = cv.getContext('2d'), col = cssColor(st, '--c1'), P = [];
    for (var i = 0; i < N; i++) P.push([prand(i, 40), Math.min(0.98, Math.max(0.02, prand(i, 41) * 0.5 + prand(i, 42) * 0.5))]);
    k.noCursor();
    var drawn = -1;
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, n = Math.round(N * ease.out(seg(ms, 100, 1300)));
      if (n !== drawn) { drawn = n; g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = col; g.globalAlpha = N > 5000 ? 0.35 : 0.6; var sz = Math.max(1.5, cv.width / 160); for (var i = 0; i < n; i++) g.fillRect(P[i][0] * (cv.width - sz), P[i][1] * (cv.height - sz), sz, sz); }
      var m = ease.out(seg(ms, 1300, 1800)); mk.setAttribute('transform', 'translate(' + lerp(L(100), L(Math.max(100, Math.min(100000, N))), m) + ' 34)');
      var rec = N <= 1000 ? 'SVG' : N <= 30000 ? 'Canvas' : 'WebGL 또는 Downsampling';
      r1.textContent = '지금: ' + use + (auto ? '(자동)' : '');
      r2.textContent = use === 'SVG' ? 'DOM 노드 약 ' + fmt(N, true) + '개(점마다 하나)' : 'DOM 노드 1개(캔버스 하나)';
      r3.textContent = '권장: ' + rec;
      r1.style.fill = use === rec || (rec !== 'SVG' && rec !== 'Canvas' && use === 'Canvas') ? 'var(--u-ink)' : 'var(--u-danger)';
      return ms < 1300 ? '점 ' + fmt(N, true) + '개를 그리는 중' : use === rec ? use + ' · 이 개수에 맞는 선택' : rec === 'SVG' ? 'Canvas도 되지만 점이 적으면 SVG가 다루기 쉬움' : use + '로 ' + fmt(N, true) + '개 · 권장은 ' + rec;
    } };
  };

  // LTTB(Largest-Triangle-Three-Buckets): 구간마다 앞뒤 점과 가장 큰 삼각형을 만드는 점을 골라 모양(봉우리)을 남긴다
  function lttb(d, n) {
    if (n >= d.length || n < 3) return d.slice();
    var out = [d[0]], every = (d.length - 2) / (n - 2), a = 0;
    for (var i = 0; i < n - 2; i++) {
      var s0 = Math.floor((i + 1) * every) + 1, s1 = Math.min(d.length, Math.floor((i + 2) * every) + 1), ax = 0, ay = 0;
      for (var j = s0; j < s1; j++) { ax += d[j][0]; ay += d[j][1]; } ax /= (s1 - s0) || 1; ay /= (s1 - s0) || 1;
      var r0 = Math.floor(i * every) + 1, r1 = Math.floor((i + 1) * every) + 1, best = r0, area = -1;
      for (var q = r0; q < r1; q++) { var ar = Math.abs((d[a][0] - ax) * (d[q][1] - d[a][1]) - (d[a][0] - d[q][0]) * (ay - d[a][1])); if (ar > area) { area = ar; best = q; } }
      out.push(d[best]); a = best;
    }
    out.push(d[d.length - 1]);
    return out;
  }
  S['downsampling'] = function (st, c) {
    var N = +c.points, M = +c.target, smart = c.method === 'LTTB(모양 유지)', MS = 3400, b = { x: 34, y: 14, w: 420, h: 170 }, max = 60, SP = Math.floor(N * 0.63) + 7;
    var D = []; for (var i = 0; i < N; i++) D.push([i, 28 + 10 * Math.sin(i / N * 9) + (prand(i, 50) - 0.5) * 10 + (Math.abs(i - SP) <= 2 ? 22 : 0)]);
    var R = smart ? lttb(D, M) : D.filter(function (p, i) { return i % Math.ceil(N / M) === 0; });
    var X = function (i) { return b.x + i / (N - 1) * b.w; }, Y = function (v) { return b.y + b.h - v / max * b.h; };
    var s = yAxis(b, max) + '<polyline class="rd" points="' + R.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '" pathLength="1" style="fill:none;stroke:var(--c1);stroke-width:2;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1"/>' +
      '<circle class="sp" cx="' + X(SP) + '" cy="' + Y(D[SP][1]) + '" r="9" style="fill:none;stroke:var(--c2);stroke-width:2;opacity:0"/>' + tx(b.x, b.y + b.h + 16, '', '', 'cnt nm');
    var k = chartKit(st, s), rd = k.q('.rd')[0], sp = k.q('.sp')[0], cnt = k.q('.cnt')[0], cv = canvasOver(st, k, b), g = cv.getContext('2d'), keep = R.some(function (p) { return Math.abs(p[0] - SP) <= 2 && p[1] > 45; });
    g.strokeStyle = cssColor(st, '--u-muted'); g.globalAlpha = 0.45; g.lineWidth = 1; g.beginPath();
    D.forEach(function (p, i) { var x = i / (N - 1) * cv.width, y = cv.height - p[1] / max * cv.height; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    k.noCursor();
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, raw = 1 - seg(ms, 1700, 2100) * 0.75;
      cv.style.opacity = raw; rd.style.strokeDashoffset = 1 - ease.inOut(seg(ms, 900, 1700)); sp.style.opacity = seg(ms, 2100, 2300);
      cnt.textContent = ms < 900 ? '원본 ' + fmt(N, true) + '점' : '원본 ' + fmt(N, true) + '점 → ' + R.length + '점으로 줄여 그림';
      return ms < 900 ? '원본 ' + fmt(N, true) + '점(회색)' : ms < 2100 ? (smart ? 'LTTB로 구간마다 모양을 남기는 점을 고름' : Math.ceil(N / M) + '개마다 하나씩만 남김') : keep ? '튀는 값(주황 원)이 줄인 선에도 남음' : '튀는 값(주황 원)이 줄이면서 사라짐';
    } };
  };

  S['data-table-view'] = function (st, c) {
    var below = c.layout === '차트 아래에 표', pct = c.format === '값과 비율', MS = 3400, T1 = 1300;
    var D = [['완료', 22], ['진행', 6], ['검토', 4], ['대기', 2]], tot = 34, b = below ? { x: 40, y: 34, w: 400, h: 70 } : { x: 40, y: 34, w: 400, h: 150 }, band = b.w / 4, th = band * 0.5, max = 24;
    var s = '<g class="ch">' + yAxis(b, max) + D.map(function (d, i) { var h = d[1] / max * b.h, x = b.x + band * i + (band - th) / 2; return '<path d="' + barPath(x, b.y + b.h - h, th, h) + '" style="fill:var(--c1)"/>' + tx(x + th / 2, b.y + b.h + 14, d[0], 'middle', 'tk'); }).join('') + '</g>' +
      '<g class="sw"><rect x="' + (b.x + b.w - 96) + '" y="2" width="96" height="22" rx="6" style="fill:var(--u-panel);stroke:var(--u-line)"/>' + tx(b.x + b.w - 48, 17, below ? '표 펼치기' : '표로 보기', 'middle', 'swt nm') + '</g>' + tx(b.x - 30, 17, '4주차 상태별 이슈', '', 'dtt nm');
    var k = chartKit(st, s), ch = k.q('.ch')[0], swt = k.q('.swt')[0], dtt = k.q('.dtt')[0];
    var a = below ? k.px(b.x - 30, b.y + b.h + 20) : k.px(b.x - 30, b.y), z = k.px(b.x + b.w, below ? VH - 2 : b.y + b.h);
    st.insertAdjacentHTML('beforeend', '<table class="u-dtv" style="left:' + a[0] + 'px;top:' + a[1] + 'px;width:' + (z[0] - a[0]) + 'px"><caption>4주차 상태별 이슈(합계 ' + tot + '건)</caption><thead><tr><th scope="col">상태</th><th scope="col">건수</th>' + (pct ? '<th scope="col">비율</th>' : '') + '</tr></thead><tbody>' +
      D.map(function (d) { return '<tr><th scope="row">' + d[0] + '</th><td>' + d[1] + '</td>' + (pct ? '<td>' + Math.round(d[1] / tot * 100) + '%</td>' : '') + '</tr>'; }).join('') + '</tbody></table>');
    var tb = st.querySelector('.u-dtv');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, on = ease.inOut(seg(ms, T1, T1 + 300));
      if (below) { ch.style.opacity = 1; tb.style.opacity = on; tb.style.transform = 'translateY(' + (1 - on) * 8 + 'px)'; }
      else { ch.style.opacity = 1 - on; tb.style.opacity = on; dtt.style.opacity = 1 - on; }
      tb.style.visibility = on > 0.01 ? 'visible' : 'hidden';
      swt.textContent = ms < T1 ? (below ? '표 펼치기' : '표로 보기') : (below ? '표 접기' : '차트로 보기');
      var q = glide(ms, 600, T1 - 100, [VW - 8, VH - 4], [b.x + b.w - 48, 13]); k.cur(q[0], q[1], pressAt(ms, [T1]));
      return ms < T1 ? '차트 위 단추로 같은 값을 표로' : below ? '차트는 두고 아래에 같은 값의 표' : '차트 자리에 같은 값의 표(제목·머리글 포함)';
    } };
  };

  S['non-color-encoding'] = function (st, c) {
    var m = c.method, gray = c.view === '색약 흉내(흑백)', MS = 3600, T1 = 1500, id = 'unc' + (++CLIP_N), b = { x: 34, y: 14, w: 360, h: 176 }, s = '';
    var PAT = ['', '<pattern id="' + id + 'a" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--c2)"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--u-panel);stroke-width:2"/></pattern>',
      '<pattern id="' + id + 'b" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" style="fill:var(--c3)"/><circle cx="3" cy="3" r="1.3" style="fill:var(--u-panel)"/></pattern>'];
    if (m === '무늬(패턴)') {
      var NM = ['완료', '진행', '대기'], V = [[12, 8, 6], [15, 9, 4], [18, 7, 3], [22, 6, 2]], max = 40, band = b.w / 4, th = band * 0.5;
      s += '<defs>' + PAT.join('') + '</defs>' + yAxis(b, max);
      var fill = function (j) { return j === 0 ? 'var(--c1)' : 'url(#' + id + (j === 1 ? 'a' : 'b') + ')'; };
      V.forEach(function (r, i) { var y0 = b.y + b.h, x = b.x + band * i + (band - th) / 2; r.forEach(function (v, j) { var h = v / max * b.h; s += '<rect x="' + x + '" y="' + (y0 - h + (j ? 2 : 0)) + '" width="' + th + '" height="' + Math.max(0, h - (j ? 2 : 0)) + '" style="fill:' + fill(j) + '"/>'; y0 -= h; }); s += tx(x + th / 2, b.y + b.h + 14, (i + 1) + '주', 'middle', 'tk'); });
      NM.forEach(function (n, j) { s += '<rect x="' + (b.x + b.w + 18) + '" y="' + (b.y + 10 + j * 26) + '" width="14" height="14" rx="2" style="fill:' + fill(j) + '"/>' + tx(b.x + b.w + 38, b.y + 22 + j * 26, n, '', 'nm'); });
    } else {
      var L = LINES, max2 = 60, base = lineBase(b, L, max2), DASH = ['', '7 4', '2 3'];
      s += yAxis(b, max2) + xAxis12(b) + base.svg;
      L.forEach(function (l, j) {
        if (m === '선 모양(점선)') s += '<line x1="' + (b.x + b.w + 14) + '" x2="' + (b.x + b.w + 34) + '" y1="' + (b.y + 16 + j * 26) + '" y2="' + (b.y + 16 + j * 26) + '" style="stroke:' + CC[j] + ';stroke-width:2;stroke-dasharray:' + (DASH[j] || 'none') + '"/>' + tx(b.x + b.w + 40, b.y + 20 + j * 26, l[0].split(' ')[0], '', 'nm');
        else s += tx(base.X(11) + 8, base.Y(l[1][11]) + 4, l[0], '', 'nm');
      });
      s = s.replace(/<polyline class="ln" data-j="(\d)"/g, function (all, j) { return all + (m === '선 모양(점선)' && DASH[+j] ? ' stroke-dasharray="' + DASH[+j] + '"' : ''); });
    }
    var k = chartKit(st, s), svg = st.querySelector('svg');
    k.noCursor();
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, g = gray ? seg(ms, T1, T1 + 500) : 0;
      svg.style.filter = g ? 'grayscale(' + g + ')' : '';
      return !gray || ms < T1 ? (m === '무늬(패턴)' ? '색 + 빗금·점 무늬' : m === '선 모양(점선)' ? '색 + 실선·긴 점선·짧은 점선' : '색 + 선 끝에 이름') : '흑백으로 바꿔도 ' + (m === '무늬(패턴)' ? '무늬로' : m === '선 모양(점선)' ? '선 모양으로' : '이름으로') + ' 구분됨';
    } };
  };

  // 선 끝 이름이 겹치지 않게 y를 gap 이상 벌린다(위에서부터 차례로)
  function endLabels(ys, gap) { var o = ys.map(function (y, i) { return [y, i]; }).sort(function (a, z) { return a[0] - z[0]; }), r = []; o.forEach(function (q, n) { var y = n ? Math.max(q[0], o[n - 1][0] + gap) : q[0]; o[n][0] = y; r[q[1]] = y; }); var shift = (ys.reduce(function (a, v) { return a + v; }, 0) - r.reduce(function (a, v) { return a + v; }, 0)) / ys.length; return r.map(function (y) { return y + shift; }); }
  S['chart-summary'] = function (st, c) {
    var top = c.where === '차트 위 한 줄', num = c.detail === '추세와 숫자', L = LINES.slice(0, 2), max = 60, MS = 3400, b = top ? { x: 34, y: 80, w: 380, h: 112 } : { x: 34, y: 10, w: 380, h: 132 }, base = lineBase(b, L, max);
    var s = yAxis(b, max) + xAxis12(b) + base.svg + endLabels(L.map(function (l) { return base.Y(l[1][11]); }), 15).map(function (y, j) { return tx(base.X(11) + 10, y + 4, L[j][0], '', 'nm'); }).join('') +
      L.map(function (l) { return '<circle class="hl" cx="' + base.X(0) + '" cy="' + base.Y(l[1][0]) + '" r="6" style="fill:none;stroke:var(--u-ink);stroke-width:1.5;opacity:0"/><circle class="hl" cx="' + base.X(11) + '" cy="' + base.Y(l[1][11]) + '" r="6" style="fill:none;stroke:var(--u-ink);stroke-width:1.5;opacity:0"/>'; }).join('');
    var k = chartKit(st, s), hls = k.q('.hl');
    k.noCursor();
    var SUM = top ? (num ? '열린 이슈 32→50건(+56%), 닫힌 이슈가 더 빨리 늘어 차이가 12→7건으로 줄었다.' : '두 이슈 모두 늘었고 둘의 차이는 줄고 있다.') : num ? '12주 동안 열린 이슈는 32건에서 50건으로 56% 늘었고, 닫힌 이슈도 20건에서 43건으로 늘어 둘의 차이는 12건에서 7건으로 줄었다.' : '열린 이슈와 닫힌 이슈가 함께 늘었고, 닫는 속도가 더 빨라 둘의 차이가 줄고 있다.';
    var a = top ? k.px(b.x - 26, 4) : k.px(b.x - 26, b.y + b.h + 24);
    st.insertAdjacentHTML('beforeend', '<p class="u-csum" style="left:' + a[0] + 'px;top:' + a[1] + 'px;right:14px"><b>요약</b> <span></span></p>');
    var sp = st.querySelector('.u-csum span');
    return { ms: MS, rest: 0.4, at: function (t) {
      var ms = t * MS, n = Math.round(SUM.length * seg(ms, 300, 1500));
      sp.textContent = SUM.slice(0, n);
      hls.forEach(function (h) { h.style.opacity = seg(ms, 1600, 1800); });
      return ms < 1600 ? '차트 ' + (top ? '위' : '아래') + '에 보이는 글로 요약' : '요약이 가리키는 시작·끝 값 · 화면 읽기 프로그램도 이 글을 읽음';
    } };
  };

  // 조합 화면(분석·보고서)도 같은 차트 보조 함수를 쓴다
  UI.chart = { CC: CC, barPath: barPath, niceMax: niceMax, lttb: lttb, seqFill: seqFill, divFill: divFill, treeLayout: treeLayout };

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
