/* 조합 화면: 이슈 상세. 용어 14개를 한 화면에 엮는다 (recipes.json의 issue-detail)
   UI.screens['issue-detail'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var ME = '민지', PEOPLE = ['민지', '민호', '준호', '서연', '도윤'];
  var MAIL = { '민지': 'minji', '민호': 'minho', '준호': 'junho', '서연': 'seoyeon', '도윤': 'doyun' };
  var STATUS = ['todo', 'prog', 'rev', 'done', 'hold'], PRI = ['긴급', '높음', '보통', '낮음'];
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  UI.screens['issue-detail'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var now = Date.now(), MIN = 60000;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function dayLabel(d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW[d.getDay()] + ')'; }
    var issues = UI.ISSUES.slice(0, 8).map(function (it, i) {
      return {
        n: it.n, t: it.t, s: it.s, pri: PRI[(i + 2) % 4], people: [it.w].concat(i % 3 === 0 ? ['준호'] : []),
        due: addDays(today, [4, 2, 6, 9, 1, -3, 12, 5][i]),
        desc: '고객이 ' + it.t.replace(/ 추가$| 넣기$| 검토$/, '') + ' 관련해 문의가 늘었습니다. 재현 방법과 기대 동작을 정리하고, 바꾼 뒤에는 결제 개편 회의에서 확인합니다.',
        links: [UI.ISSUES[(i + 1) % 8].n, UI.ISSUES[(i + 4) % 8].n],
        comments: i % 2 ? [] : [{ who: '준호', at: now - 42 * MIN, text: '재현됩니다. 부분 환불 두 번째부터 금액이 어긋나요.' }],
        log: [
          { who: it.w, what: '상태를 ' + UI.PILL[it.s] + '(으)로 바꿈', at: now - (it.ago + 3) * MIN },
          { who: '준호', what: '담당자에 ' + it.w + '을(를) 넣음', at: now - (it.ago + 1500) * MIN },
          { who: '도윤', what: '이슈를 만듦', at: now - (it.ago + 1700) * MIN }
        ]
      };
    });
    var st = { cur: issues[0].n, tab: 'body', who: '', labels: false, mobile: false, editing: false, fresh: null };
    var timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function cur() { return issues.filter(function (x) { return x.n === st.cur; })[0]; }
    function byN(n) { return issues.filter(function (x) { return x.n === n; })[0]; }
    function log(it, what) { it.log.push({ who: ME, what: what, at: Date.now() }); st.fresh = 'log'; }

    root.innerHTML =
      '<div class="u scr">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) { return '<li><a href="#"' + (i ? '' : ' aria-current="page"') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="md" id="sd-md" data-term="master-detail"><div class="md-list" id="sd-list"></div><div class="md-detail" id="sd-detail"></div></div>' +
        '<div class="sd-drawer off" id="sd-drawer"><div class="u-shade"></div><aside class="u-drawer" role="dialog" aria-modal="true" aria-label="연결된 이슈 미리 보기" data-term="drawer" id="sd-dbody"></aside></div>' +
        '<div class="u-pop off" id="sd-pop" role="dialog" aria-label="담당자" data-term="popover"></div>' +
        '<div class="u-pop off" id="sd-cal" role="dialog" aria-label="마감일 고르기" data-term="date-picker"></div>' +
        '<div class="u-tip sd-tip off" id="sd-tip" role="tooltip" data-term="tooltip"></div>' +
        '<div class="scr-labels" id="sd-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr');

    /* ── 왼쪽 목록 ── */
    function renderList(flashN) {
      var rows = issues.filter(function (it) { return !st.who || it.people.indexOf(st.who) >= 0; });
      $('sd-list').innerHTML = '<div class="lh">이슈 <span style="color:var(--u-muted);font-weight:400;font-size:13px">' + rows.length + '</span>' +
        (st.who ? '<button class="u-btn flt" type="button" data-act="unwho">담당: ' + esc(st.who) + ' ✕</button>' : '') + '</div>' +
        rows.map(function (it) {
          return '<button type="button" class="md-row' + (it.n === flashN ? ' flash' : '') + '" data-n="' + it.n + '" aria-current="' + (it.n === st.cur) + '"><span class="num">#' + it.n + '</span><span class="ttl">' + esc(it.t) + '</span>' +
            '<span class="meta">' + UI.pillHTML(it.s, 'sm') + '<span>' + esc(it.people.join(', ')) + '</span></span></button>';
        }).join('');
    }

    /* ── 오른쪽 상세 ── */
    function tabsHTML(it) {
      var tabs = [['body', '내용'], ['comments', '댓글 ' + it.comments.length], ['log', '기록 ' + it.log.length]];
      return '<div class="tabs" role="tablist" aria-label="이슈 내용" data-term="tabs" id="sd-tabs">' + tabs.map(function (t) {
        var on = t[0] === st.tab;
        return '<button type="button" role="tab" id="sd-tab-' + t[0] + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-dtab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '<span class="ind" data-term="easing"></span></div>';
    }
    function groupDay(ms) {
      var d = new Date(ms); d.setHours(0, 0, 0, 0);
      var diff = Math.round((today - d) / 86400000);
      return diff === 0 ? '오늘' : diff === 1 ? '어제' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    }
    function panelHTML(it) {
      if (st.tab === 'body') return '<p>' + esc(it.desc) + '</p><div style="font-size:12px;color:var(--u-muted)">연결된 이슈</div><div class="links">' +
        it.links.map(function (n) { var x = byN(n); return x ? '<button type="button" data-peek="' + n + '"><span style="font-family:var(--u-mono);font-size:12px;color:var(--u-muted)">#' + n + '</span><span class="ttl">' + esc(x.t) + '</span>' + UI.pillHTML(x.s, 'sm') + '</button>' : ''; }).join('') + '</div>';
      if (st.tab === 'comments') return it.comments.map(function (c, i) {
        var nw = st.fresh === 'comment' && i === it.comments.length - 1;
        return '<div class="cm' + (nw ? ' u-slidein' : '') + '"' + (nw ? ' data-term="slide"' : '') + '><div class="h">' + UI.whoHTML(c.who).replace('class="u-who"', 'class="u-who" style="color:var(--u-ink)"') + '<span>' + UI.ago((Date.now() - c.at) / MIN, true) + '</span></div><div>' + esc(c.text) + '</div></div>';
      }).join('') + (it.comments.length ? '' : '<div style="color:var(--u-muted);font-size:13px">아직 댓글이 없습니다.</div>') +
        '<form class="cm-form" id="sd-cform"><textarea id="sd-ctext" placeholder="댓글 남기기" aria-label="댓글"></textarea><button class="u-btn primary" type="submit" style="justify-self:end">댓글 남기기</button></form>';
      var g = '', list = it.log.slice().sort(function (a, b) { return b.at - a.at; });
      return '<div class="tl" data-term="activity-timeline">' + list.map(function (e, i) {
        var day = groupDay(e.at), h = '';
        if (day !== g) { g = day; h = '<div class="day">' + day + '</div>'; }
        var nw = st.fresh === 'log' && i === 0;
        return h + '<div class="ev' + (nw ? ' new u-slidein' : '') + '"' + (nw ? ' data-term="slide"' : '') + '><b>' + esc(e.who) + '</b> ' + esc(e.what) + ' <time title="' + new Date(e.at).toLocaleString('ko-KR') + '">· ' + UI.ago((Date.now() - e.at) / MIN, true) + '</time></div>';
      }).join('') + '</div>';
    }
    function chipsHTML(it) {
      return it.people.map(function (p) {
        return '<span class="chip-p"><button type="button" data-person="' + esc(p) + '" aria-haspopup="dialog"><span class="u-av" style="background:' + UI.AV[p] + '">' + p[0] + '</span>' + esc(p) + '</button><button type="button" class="rm" data-rm="' + esc(p) + '" aria-label="' + esc(p) + ' 빼기">×</button></span>';
      }).join('');
    }
    function renderDetail(fade) {
      var it = cur();
      if (!it) return;
      $('sd-detail').innerHTML =
        '<div class="det-head"><button class="u-btn md-back" type="button" data-act="back">‹ 목록</button><span class="num">#' + it.n + '</span><div class="det-tools">' +
          '<button class="u-btn" type="button" data-act="prev" data-tip="이전 이슈 (K)" aria-label="이전 이슈">↑</button>' +
          '<button class="u-btn" type="button" data-act="next" data-tip="다음 이슈 (J)" aria-label="다음 이슈">↓</button>' +
          '<button class="u-btn" type="button" data-act="copy" data-tip="링크 복사" aria-label="링크 복사">' + UI.ICON.link + '</button></div></div>' +
        (st.editing ? '<input class="ie-input" id="sd-title" value="' + esc(it.t) + '" aria-label="제목" data-term="inline-edit">'
          : '<button type="button" class="ie" id="sd-title-btn" data-term="inline-edit" aria-label="제목 고치기: ' + esc(it.t) + '">' + esc(it.t) + '<span class="pen">' + UI.ICON.edit + '</span></button>') +
        '<div class="props">' +
          '<span class="k">상태</span><span class="v"><select class="u-native" id="sd-status" data-term="select" aria-label="상태">' + STATUS.map(function (s) { return '<option value="' + s + '"' + (s === it.s ? ' selected' : '') + '>' + UI.PILL[s] + '</option>'; }).join('') + '</select></span>' +
          '<span class="k">우선순위</span><span class="v"><select class="u-native" id="sd-pri" aria-label="우선순위">' + PRI.map(function (p) { return '<option' + (p === it.pri ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></span>' +
          '<span class="k">담당자</span><span class="v" style="width:100%"><div class="cbx" id="sd-cbx" data-term="combobox">' + chipsHTML(it) +
            '<input id="sd-cin" placeholder="' + (it.people.length ? '' : '이름 적기') + '" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sd-clist" aria-label="담당자 더하기"><div class="u-menu off" id="sd-clist" role="listbox"></div></div></span>' +
          '<span class="k">마감일</span><span class="v"><button class="u-btn" type="button" id="sd-due" aria-haspopup="dialog">' + dayLabel(it.due) + ' ▾</button></span>' +
        '</div>' + tabsHTML(it) +
        '<div class="tabpanel' + (fade ? ' u-fade' : '') + '" role="tabpanel" id="sd-panel" aria-labelledby="sd-tab-' + st.tab + '" data-term="fade">' + panelHTML(it) + '</div>';
      moveInd();
      // 페이드·미끄러짐은 CSS 애니메이션이라 앱 안의 보기에서 멈출 수 있다. 끝날 시간에 클래스를 걷어 내 내용이 늘 보이게 한다
      later(function () { root.querySelectorAll('.u-fade, .u-slidein').forEach(function (x) { x.classList.remove('u-fade', 'u-slidein'); }); }, 400);
      if (st.editing) { var inp = $('sd-title'); inp.focus(); inp.select(); }
      later(drawLabels, 30); later(drawLabels, 260);
    }
    function moveInd() {
      var on = root.querySelector('#sd-tabs [aria-selected="true"]'), ind = root.querySelector('#sd-tabs .ind');
      if (on && ind) { ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; }
    }
    function render(flashN) { renderList(flashN); renderDetail(); $('sd-md').classList.toggle('show', st.mobile); }
    function select(n) { st.cur = n; st.tab = 'body'; st.editing = false; st.fresh = null; st.mobile = true; closePops(); renderList(); renderDetail(true); $('sd-md').classList.toggle('show', true); }

    /* ── 제자리 고치기 (Inline Edit) ── */
    function saveTitle() {
      if (!st.editing) return;
      var it = cur(), v = $('sd-title').value.trim();
      st.editing = false;
      if (v && v !== it.t) { it.t = v; log(it, '제목을 고침'); render(it.n); } else renderDetail();
      var b = $('sd-title-btn'); if (b) b.focus();
    }
    function cancelTitle() { st.editing = false; renderDetail(); var b = $('sd-title-btn'); if (b) b.focus(); }

    /* ── 탭 ── */
    function setTab(t, focus) {
      st.tab = t; st.fresh = null; renderDetail(true);
      if (focus) { var b = $('sd-tab-' + t); if (b) b.focus(); }
    }

    /* ── 담당자 (Combobox + Popover) ── */
    var hl = 0;
    function hits() {
      var it = cur(), q = ($('sd-cin') || {}).value || '';
      return PEOPLE.filter(function (p) { return it.people.indexOf(p) < 0 && p.indexOf(q.trim()) >= 0; });
    }
    function renderOpts(open) {
      var box = $('sd-clist'), inp = $('sd-cin'), h = hits();
      if (!open) { box.classList.add('off'); inp.setAttribute('aria-expanded', 'false'); return; }
      if (hl >= h.length) hl = 0;
      box.innerHTML = h.length ? h.map(function (p, i) { return '<button type="button" role="option" aria-selected="' + (i === hl) + '" class="' + (i === hl ? 'on' : '') + '" data-add="' + p + '"><span class="u-who"><span class="u-av" style="background:' + UI.AV[p] + '">' + p[0] + '</span>' + p + '</span></button>'; }).join('')
        : '<div style="padding:8px 10px;color:var(--u-muted);font-size:13px">맞는 사람이 없습니다</div>';
      box.classList.remove('off'); inp.setAttribute('aria-expanded', 'true');
      later(drawLabels, 30);
    }
    function addPerson(p) {
      var it = cur(); if (!p || it.people.indexOf(p) >= 0) return;
      it.people.push(p); log(it, '담당자에 ' + p + '을(를) 넣음');
      render(it.n); var inp = $('sd-cin'); if (inp) inp.focus();
    }
    function removePerson(p) { var it = cur(); it.people = it.people.filter(function (x) { return x !== p; }); log(it, '담당자에서 ' + p + '을(를) 뺌'); render(it.n); }
    var popFor = null, popBtn = null;
    function place(pop, btn, gap) {
      var a = scr.getBoundingClientRect(), r = btn.getBoundingClientRect();
      var left = Math.min(Math.max(8, r.left - a.left), a.width - pop.offsetWidth - 8), top = r.bottom - a.top + (gap || 10);
      var flip = top + pop.offsetHeight > a.height - 8;
      if (flip) top = r.top - a.top - pop.offsetHeight - (gap || 10);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      var arr = pop.querySelector('.arr');
      if (arr) { arr.style.left = Math.max(10, Math.min(pop.offsetWidth - 20, r.left - a.left - left + 12)) + 'px'; arr.style.top = flip ? '' : '-6px'; arr.style.bottom = flip ? '-6px' : ''; arr.style.transform = 'rotate(' + (flip ? 225 : 45) + 'deg)'; }
    }
    function openPerson(btn) {
      var p = btn.getAttribute('data-person'), pop = $('sd-pop');
      popFor = p; popBtn = btn;
      pop.innerHTML = '<span class="arr"></span><div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><span class="u-av" style="width:34px;height:34px;font-size:14px;background:' + UI.AV[p] + '">' + p[0] + '</span><div style="display:grid;line-height:1.35"><b>' + esc(p) + '</b><span style="font-size:12px;color:var(--u-muted)">' + MAIL[p] + '@example.com</span></div></div>' +
        '<button class="u-btn" type="button" data-act="who">' + esc(p) + '의 이슈만 보기</button>';
      pop.classList.remove('off'); place(pop, btn);
      pop.querySelector('button').focus();
      later(drawLabels, 160);
    }

    /* ── 마감일 (Date Picker) ── */
    var calMonth = null;
    function renderCal() {
      var it = cur(), m = calMonth, first = new Date(m.getFullYear(), m.getMonth(), 1), off = (first.getDay() + 6) % 7;
      var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), fri = addDays(today, (5 - today.getDay() + 7) % 7), mon = addDays(today, ((8 - today.getDay()) % 7) || 7);
      var html = '<div class="presets"><button type="button" data-due="' + today.getTime() + '">오늘</button><button type="button" data-due="' + fri.getTime() + '">이번 주 금요일</button><button type="button" data-due="' + mon.getTime() + '">다음 주 월요일</button></div>' +
        '<div class="cal-h"><button class="u-icon" type="button" data-mon="-1" aria-label="이전 달">‹</button><span>' + m.getFullYear() + '년 ' + (m.getMonth() + 1) + '월</span><button class="u-icon" type="button" data-mon="1" aria-label="다음 달">›</button></div><div class="cal">' +
        ['월', '화', '수', '목', '금', '토', '일'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + new Array(off + 1).join('<span></span>');
      for (var d = 1; d <= days; d++) {
        var dt = new Date(m.getFullYear(), m.getMonth(), d);
        html += '<button type="button" data-due="' + dt.getTime() + '" class="' + (+dt === +today ? 'today ' : '') + (+dt === +it.due ? 'on' : '') + '" aria-label="' + dayLabel(dt) + '"' + (+dt === +it.due ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
      }
      $('sd-cal').innerHTML = html + '</div>';
    }
    function openCal() {
      var it = cur(); calMonth = new Date(it.due.getFullYear(), it.due.getMonth(), 1);
      renderCal(); $('sd-cal').classList.remove('off'); place($('sd-cal'), $('sd-due'), 6);
      var on = $('sd-cal').querySelector('.cal button.on') || $('sd-cal').querySelector('.cal button'); on.focus();
      later(drawLabels, 160);
    }
    function setDue(ms) { var it = cur(); it.due = new Date(+ms); log(it, '마감일을 ' + dayLabel(it.due) + '(으)로 바꿈'); closePops(); render(it.n); var b = $('sd-due'); if (b) b.focus(); }

    /* ── 말풍선 (Tooltip, Fade) ── */
    var tipTimer = null, tipEl = null;
    function showTip(el) {
      clearTimeout(tipTimer); tipEl = el;
      tipTimer = later(function () {
        if (tipEl !== el || !document.contains(el)) return;
        var tip = $('sd-tip'), a = scr.getBoundingClientRect(), r = el.getBoundingClientRect();
        tip.textContent = el.getAttribute('data-tip'); tip.classList.remove('off');
        var left = r.left - a.left + r.width / 2 - tip.offsetWidth / 2, top = r.top - a.top - tip.offsetHeight - 8;
        if (top < 4) top = r.bottom - a.top + 8;
        tip.style.left = Math.max(4, Math.min(a.width - tip.offsetWidth - 4, left)) + 'px'; tip.style.top = top + 'px';
        drawLabels();
      }, 300);
    }
    function hideTip() { clearTimeout(tipTimer); tipEl = null; $('sd-tip').classList.add('off'); later(drawLabels, 120); }

    /* ── 연결 이슈 미리 보기 (Drawer, Easing) ── */
    var drawerBack = null;
    function openDrawer(n, from) {
      var x = byN(n); if (!x) return;
      drawerBack = from;
      $('sd-dbody').innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="font-family:var(--u-mono);font-size:12.5px;color:var(--u-muted)">#' + x.n + ' 미리 보기</span><button class="u-btn" type="button" data-act="dclose" style="margin-left:auto" aria-label="닫기">✕</button></div>' +
        '<b style="font-size:16px;line-height:1.4">' + esc(x.t) + '</b><div style="display:flex;gap:8px;align-items:center">' + UI.pillHTML(x.s) + '<span style="font-size:12.5px;color:var(--u-muted)">' + esc(x.people.join(', ')) + ' · 마감 ' + dayLabel(x.due) + '</span></div>' +
        '<p style="margin:0;line-height:1.7;color:var(--u-muted)">' + esc(x.desc) + '</p><button class="u-btn primary" type="button" data-go="' + x.n + '" style="justify-self:start">이 이슈로 가기</button>';
      $('sd-drawer').classList.remove('off');
      $('sd-dbody').querySelector('[data-act="dclose"]').focus();
      later(drawLabels, 300);
    }
    function closeDrawer() { $('sd-drawer').classList.add('off'); if (drawerBack && document.contains(drawerBack)) drawerBack.focus(); later(drawLabels, 200); }

    function closePops() {
      $('sd-pop').classList.add('off'); $('sd-cal').classList.add('off');
      var cl = $('sd-clist'); if (cl) cl.classList.add('off');
      later(drawLabels, 120);
    }

    /* ── 사건 ── */
    root.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (e.target.closest('#sd-labels') && el) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (!e.target.closest('#sd-pop, #sd-cal, [data-person], #sd-due, #sd-cbx')) closePops();
      if (e.target.classList.contains('u-shade')) { closeDrawer(); return; }
      if (!el || !root.contains(el)) return;
      if (el.tagName === 'A') { e.preventDefault(); return; }
      var v;
      if ((v = el.getAttribute('data-n'))) { select(+v); return; }
      if (el.id === 'sd-title-btn') { st.editing = true; renderDetail(); return; }
      if ((v = el.getAttribute('data-dtab'))) { setTab(v); return; }
      if ((v = el.getAttribute('data-peek'))) { openDrawer(+v, el); return; }
      if ((v = el.getAttribute('data-go'))) { closeDrawer(); select(+v); render(+v); return; }
      if ((v = el.getAttribute('data-person'))) { if (!$('sd-pop').classList.contains('off') && popFor === v) closePops(); else { closePops(); openPerson(el); } return; }
      if ((v = el.getAttribute('data-rm'))) { removePerson(v); return; }
      if ((v = el.getAttribute('data-add'))) { addPerson(v); return; }
      if (el.id === 'sd-due') { if ($('sd-cal').classList.contains('off')) { closePops(); openCal(); } else closePops(); return; }
      if ((v = el.getAttribute('data-due'))) { setDue(v); return; }
      if ((v = el.getAttribute('data-mon'))) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + (+v), 1); renderCal(); return; }
      var idx = issues.map(function (x) { return x.n; }).indexOf(st.cur);
      switch (el.getAttribute('data-act')) {
        case 'back': st.mobile = false; $('sd-md').classList.remove('show'); break;
        case 'prev': if (idx > 0) select(issues[idx - 1].n); break;
        case 'next': if (idx < issues.length - 1) select(issues[idx + 1].n); break;
        case 'copy':
          var txt = location.href.split('#')[0] + '#issue-' + st.cur, tip = $('sd-tip');
          try { navigator.clipboard.writeText(txt).catch(function () {}); } catch (err) {}
          tip.textContent = '복사했습니다'; tip.classList.remove('off'); later(hideTip, 1200); break;
        case 'who': st.who = popFor; closePops(); renderList(); if (popBtn && document.contains(popBtn)) popBtn.focus(); break;
        case 'unwho': st.who = ''; renderList(); break;
        case 'dclose': closeDrawer(); break;
      }
    });
    root.addEventListener('change', function (e) {
      var it = cur();
      if (e.target.id === 'sd-status') { it.s = e.target.value; log(it, '상태를 ' + UI.PILL[it.s] + '(으)로 바꿈'); render(it.n); $('sd-status').focus(); }
      if (e.target.id === 'sd-pri') { it.pri = e.target.value; log(it, '우선순위를 ' + it.pri + '(으)로 바꿈'); renderDetail(); $('sd-pri').focus(); }
    });
    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'sd-cform') return;
      e.preventDefault();
      var v = $('sd-ctext').value.trim(); if (!v) return;
      var it = cur(); it.comments.push({ who: ME, at: Date.now(), text: v }); st.fresh = 'comment';
      renderDetail(); var ta = $('sd-ctext'); if (ta) ta.focus();
    });
    root.addEventListener('input', function (e) { if (e.target.id === 'sd-cin') { hl = 0; renderOpts(!!e.target.value.trim()); } });
    root.addEventListener('focusin', function (e) { var t = e.target.closest('[data-tip]'); if (t) showTip(t); });
    root.addEventListener('focusout', function (e) {
      if (e.target.closest('[data-tip]')) hideTip();
      if (e.target.id === 'sd-title' && st.editing) later(saveTitle, 0);
    });
    root.addEventListener('mouseover', function (e) { var t = e.target.closest('[data-tip]'); if (t && t !== tipEl) showTip(t); });
    root.addEventListener('mouseout', function (e) { var t = e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t.id === 'sd-title') { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); } else if (e.key === 'Escape') { e.preventDefault(); cancelTitle(); } return; }
      if (t.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        var order = ['body', 'comments', 'log'], i = order.indexOf(st.tab);
        e.preventDefault(); setTab(order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3], true); return;
      }
      if (t.id === 'sd-cin') {
        var h = hits();
        if (e.key === 'ArrowDown') { e.preventDefault(); hl = Math.min(h.length - 1, hl + 1); renderOpts(true); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, hl - 1); renderOpts(true); }
        else if (e.key === 'Enter') { e.preventDefault(); if (t.value.trim() && h[hl]) addPerson(h[hl]); }
        else if (e.key === 'Escape') renderOpts(false);
        else if (e.key === 'Backspace' && !t.value && cur().people.length) removePerson(cur().people[cur().people.length - 1]);
        return;
      }
      if (e.key === 'Escape') {
        if (!$('sd-drawer').classList.contains('off')) { closeDrawer(); return; }
        if (!$('sd-pop').classList.contains('off')) { closePops(); if (popBtn) popBtn.focus(); return; }
        if (!$('sd-cal').classList.contains('off')) { closePops(); $('sd-due').focus(); }
      }
    });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('sd-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'master-detail' ? 'in-br' : id === 'easing' || id === 'fade' ? 'right' : id === 'select' ? 'right' : ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { moveInd(); drawLabels(); }
    window.addEventListener('resize', onResize);
    $('sd-detail').addEventListener('scroll', function () { if (st.labels) drawLabels(); });
    $('sd-list').addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    render();
    st.mobile = false; $('sd-md').classList.remove('show');

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        st.mobile = true; $('sd-md').classList.add('show');
        if (id === 'drawer') { var b = root.querySelector('[data-peek]'); if (!b) { setTab('body'); b = root.querySelector('[data-peek]'); } openDrawer(+b.getAttribute('data-peek'), b); }
        else if (id === 'popover') { openPerson(root.querySelector('[data-person]')); }
        else if (id === 'date-picker') openCal();
        else if (id === 'tooltip') { var t = root.querySelector('[data-tip]'); tipEl = null; showTip(t); }
        else if (id === 'activity-timeline') setTab('log');
        else if (id === 'slide') { var it = cur(); it.comments.push({ who: '서연', at: Date.now(), text: '확인했어요. 내일 오전에 같이 봐요.' }); st.tab = 'comments'; st.fresh = 'comment'; renderDetail(true); }
        else if (id === 'focus-ring') { var f = $('sd-tab-' + st.tab); f.focus(); f.classList.add('u-ring'); f.setAttribute('data-term', 'focus-ring'); f.addEventListener('blur', function () { f.classList.remove('u-ring'); f.removeAttribute('data-term'); drawLabels(); }, { once: true }); later(drawLabels, 30); }
        else if (id === 'inline-edit') { st.editing = true; renderDetail(); }
        else if (id === 'combobox') { var c = $('sd-cin'); c.focus(); c.value = '서'; renderOpts(true); }
        else renderDetail();
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
