/* 조합 화면: 이슈 목록. 용어 23개를 한 화면에 엮는다 (recipes.json의 issue-list)
   UI.screens['issue-list'](뿌리 요소, { termName(id), openTerm(id) }) → { destroy() } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var PAGE = 8, UNDO_MS = 5000, TOAST_MS = 4000;

  UI.screens['issue-list'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var now = Date.now();
    var issues = UI.ISSUES.map(function (it) { return { n: it.n, t: it.t, s: it.s, w: it.w, at: now - it.ago * 60000 }; });
    var st = { view: 'open', q: '', typed: '', dir: 'desc', page: 1, sel: {}, loading: true, labels: false };
    var timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

    root.innerHTML =
      '<div class="u scr" data-term="app-shell">' +
        '<aside class="u-side" data-term="sidebar-navigation"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) {
            return '<li><a href="#"' + (i ? ' data-soon="' + n + '"' : ' aria-current="page"') + '>' + UI.navIcon(i) + n + (i ? '' : '<span class="u-badge" data-term="badge" id="sc-badge"></span>') + '</a></li>';
          }).join('') + '</ul></aside>' +
        '<div class="scr-main">' +
          '<div class="scr-top"><ol class="u-crumb" data-term="breadcrumb"><li><a href="#" data-soon="홈">홈</a></li><li aria-hidden="true">›</li><li><a href="#" data-soon="결제 개편">결제 개편</a></li><li aria-hidden="true">›</li><li class="cur">이슈</li></ol>' +
            '<label class="u-search" data-term="search-bar"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>' +
              '<input id="sc-q" type="search" placeholder="이슈 찾기" autocomplete="off" aria-label="이슈 찾기"><button class="u-icon" type="button" id="sc-clear" aria-label="찾는 말 지우기" hidden>×</button></label>' +
            '<button class="u-btn" type="button" id="sc-cmd" data-term="command-palette">명령 <span class="u-kbd">Ctrl K</span></button></div>' +
          '<div class="scr-head"><h2>이슈</h2><div class="u-seg" role="group" aria-label="이슈 상태" data-term="segmented-control" id="sc-seg"><span class="u-seg-ind"></span>' +
            '<button type="button" data-view="open">열림<b></b></button><button type="button" data-view="closed">닫힘<b></b></button><button type="button" data-view="all">전체<b></b></button></div>' +
            '<span class="grow"></span><button class="u-btn primary" type="button" id="sc-new">새 이슈</button></div>' +
          '<div class="scr-box" id="sc-box" data-term="data-table"></div>' +
          '<div class="u-pages" data-term="pagination" id="sc-pages"></div>' +
        '</div>' +
        '<div class="u-bulk scr-bulk off" data-term="bulk-action-bar" id="sc-bulk" role="toolbar" aria-label="고른 이슈"></div>' +
        '<div class="scr-toasts" id="sc-toasts" aria-live="polite"></div>' +
        '<div class="u-menu off" id="sc-menu" role="menu" data-term="dropdown-menu">' +
          '<button type="button" role="menuitem" data-act="done">완료로 바꾸기<span class="u-kbd" style="border:0">D</span></button>' +
          '<button type="button" role="menuitem" data-act="copy">복제<span class="u-kbd" style="border:0">C</span></button>' +
          '<div class="sep"></div><button type="button" role="menuitem" class="danger" data-act="del">지우기<span class="u-kbd" style="border:0">⌫</span></button></div>' +
        '<div class="scr-layer center off" id="sc-confirm" data-term="confirm-dialog"><div class="u-shade"></div>' +
          '<div class="u-dlg" role="alertdialog" aria-modal="true" aria-labelledby="sc-ct"><h3 id="sc-ct"></h3><p>지우면 되돌릴 시간 5초가 지난 뒤 사라집니다. 댓글과 기록도 함께 지워집니다.</p>' +
          '<div class="acts"><button class="u-btn" type="button" id="sc-cancel">취소</button><button class="u-btn danger" type="button" id="sc-ok">지우기</button></div></div></div>' +
        '<div class="scr-layer top off" id="sc-pal" data-term="command-palette"><div class="u-shade"></div>' +
          '<div class="u-pal" role="dialog" aria-modal="true" aria-label="명령 팔레트"><div class="q"><span class="u-kbd">Ctrl K</span><input id="sc-pq" placeholder="이동하거나 할 일을 찾기" autocomplete="off" aria-label="명령 찾기"></div><div class="list" id="sc-plist" role="listbox"></div></div></div>' +
        '<div class="scr-labels" id="sc-labels" hidden></div>' +
      '</div>';

    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr'), box = $('sc-box');

    /* ── 목록 계산 ── */
    function closed(it) { return it.s === 'done'; }
    function inView(it) { return st.view === 'all' || (st.view === 'closed') === closed(it); }
    function listed() {
      var q = st.q.trim();
      return issues.filter(function (it) { return inView(it) && (!q || it.t.indexOf(q) >= 0 || ('#' + it.n).indexOf(q) >= 0); })
        .sort(function (a, b) { return st.dir === 'desc' ? b.at - a.at : a.at - b.at; });
    }
    function stamp(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
    function selIds() { return Object.keys(st.sel).map(Number); }

    /* ── 그리기 ── */
    function render(flash) {
      var all = listed(), pages = Math.max(1, Math.ceil(all.length / PAGE));
      if (st.page > pages) st.page = pages;
      var rows = all.slice((st.page - 1) * PAGE, st.page * PAGE), ids = rows.map(function (r) { return r.n; });
      var k = ids.filter(function (n) { return st.sel[n]; }).length;
      var head = '<div class="u-tr head" data-term="sticky-header"><span><button type="button" class="u-cb' + (k && k === ids.length ? ' on' : k ? ' mixed' : '') + '" id="sc-all" data-term="checkbox" aria-label="이 쪽 모두 고르기"></button></span>' +
        '<span>번호</span><span>제목</span><span>상태</span><span>담당자</span><span><button type="button" id="sc-sort">바뀐 때 ' + (st.dir === 'desc' ? '▼' : '▲') + '</button></span><span></span></div>';
      var body;
      if (st.loading) {
        body = [62, 48, 70, 40, 56, 66].map(function (w, i) {
          return '<div class="u-tr"' + (i ? '' : ' data-term="skeleton"') + '><span></span><span class="u-skel shim' + (reduce ? '' : ' run') + '" style="width:30px"></span><span class="u-skel shim' + (reduce ? '' : ' run') + '" style="width:' + w + '%"></span><span class="u-skel shim' + (reduce ? '' : ' run') + '" style="width:52px"></span><span class="u-skel" style="width:60px"></span><span class="u-skel" style="width:40px"></span><span></span></div>';
        }).join('');
      } else if (!rows.length) {
        var q = st.q.trim();
        body = '<div class="u-empty scr-empty u-fadein" data-term="empty-state"><svg viewBox="0 0 64 48" fill="none" aria-hidden="true"><rect x="8" y="14" width="48" height="28" rx="5" style="fill:var(--u-hover);stroke:var(--u-line)"/><path d="M8 30h14l4 6h12l4-6h14" style="stroke:var(--u-muted)" stroke-width="1.5"/><path d="M24 8l3 4M32 5v5M40 8l-3 4" style="stroke:var(--u-accent)" stroke-width="1.8" stroke-linecap="round"/></svg>' +
          (q ? '<b>\'' + esc(q) + '\'에 맞는 이슈가 없습니다</b><button class="u-btn" type="button" data-act="clearq">찾는 말 지우기</button>'
             : st.view === 'open' ? '<b>열린 이슈가 없습니다</b><button class="u-btn" type="button" data-act="showclosed">닫힌 이슈 보기</button>'
             : '<b>이슈가 없습니다</b><button class="u-btn primary" type="button" data-act="new">첫 이슈 만들기</button>') + '</div>';
      } else {
        var longest = rows.reduce(function (a, b) { return b.t.length > a.t.length ? b : a; });
        body = rows.map(function (it, i) {
          var on = !!st.sel[it.n];
          return '<div class="u-tr' + (on ? ' sel' : '') + (flash && flash.indexOf(it.n) >= 0 ? ' flash' : '') + '" data-n="' + it.n + '"' + (flash && flash.indexOf(it.n) >= 0 ? ' data-term="highlight-flash"' : i === 1 ? ' data-term="hover-effect"' : '') + '>' +
            '<span><button type="button" class="u-cb' + (on ? ' on' : '') + '" data-pick="' + it.n + '" aria-label="#' + it.n + ' 고르기" aria-pressed="' + on + '"></button></span>' +
            '<span class="num">#' + it.n + '</span><span class="ttl"' + (it === longest ? ' data-term="truncation"' : '') + '>' + esc(it.t) + '</span>' +
            '<span>' + UI.pillHTML(it.s, 'sm').replace('<span ', '<span' + (i ? '' : ' data-term="status-pill"') + ' ') + '</span>' +
            '<span>' + UI.whoHTML(it.w) + '</span><span class="time"' + (i ? '' : ' data-term="relative-time"') + ' title="' + stamp(it.at) + '">' + UI.ago((Date.now() - it.at) / 60000, true) + '</span>' +
            '<span><button class="u-icon" type="button" data-menu="' + it.n + '" aria-haspopup="menu" aria-label="#' + it.n + ' 더 보기"' + (i ? '' : ' data-term="dropdown-menu"') + '>⋯</button></span></div>';
        }).join('');
      }
      box.innerHTML = '<div class="u-tbl u-hoverable">' + head + body + '</div>';
      // 쪽 나누기
      var from = all.length ? (st.page - 1) * PAGE + 1 : 0, to = Math.min(all.length, st.page * PAGE), nums = '';
      for (var p = 1; p <= pages; p++) nums += '<button type="button" data-page="' + p + '"' + (p === st.page ? ' aria-current="page"' : '') + '>' + p + '</button>';
      $('sc-pages').innerHTML = '<span>' + (st.loading ? '불러오는 중' : from + '–' + to + ' / ' + all.length + '건') + '</span><span class="nums"><button type="button" data-page="' + (st.page - 1) + '"' + (st.page <= 1 ? ' disabled' : '') + ' aria-label="이전 쪽">‹</button>' + nums +
        '<button type="button" data-page="' + (st.page + 1) + '"' + (st.page >= pages ? ' disabled' : '') + ' aria-label="다음 쪽">›</button></span>';
      // 세그먼트 수와 표시
      var cnt = { open: 0, closed: 0, all: issues.length };
      issues.forEach(function (it) { cnt[closed(it) ? 'closed' : 'open']++; });
      root.querySelectorAll('#sc-seg button').forEach(function (b) { var v = b.getAttribute('data-view'); b.setAttribute('aria-pressed', String(v === st.view)); b.querySelector('b').textContent = cnt[v]; });
      moveSeg();
      setBadge(cnt.open);
      // 일괄 작업 막대
      var n = selIds().length, bulk = $('sc-bulk');
      if (n) bulk.innerHTML = '<b>' + n + '개 선택됨</b><button type="button" data-act="bulkrev">검토로 바꾸기</button><button type="button" data-act="bulkdel">지우기</button><button type="button" class="x" data-act="unsel" aria-label="선택 해제">✕</button>';
      bulk.classList.toggle('off', !n);
      $('sc-clear').hidden = !$('sc-q').value;
      // 빈 화면 페이드는 CSS 애니메이션이라 앱 안의 보기에서 멈출 수 있다. 끝날 시간에 클래스를 걷어 낸다
      later(function () { var em = box.querySelector('.u-fadein'); if (em) em.classList.remove('u-fadein'); }, 400);
      later(drawLabels, 30); later(drawLabels, 260);
    }
    function moveSeg() {
      var on = root.querySelector('#sc-seg button[aria-pressed="true"]'), ind = root.querySelector('#sc-seg .u-seg-ind');
      if (on) { ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; }
    }
    var lastBadge = null;
    function setBadge(n) {
      var b = $('sc-badge');
      b.textContent = n > 99 ? '99+' : n; b.hidden = !n;
      if (lastBadge !== null && n > lastBadge && !reduce) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
      lastBadge = n;
    }

    /* ── 토스트와 되돌리기 ── */
    function toast(msg, undo) {
      var el = document.createElement('div'), hold = undo ? UNDO_MS : TOAST_MS;
      el.className = 'u-toast off'; el.setAttribute('role', 'status');
      el.setAttribute('data-term', 'toast');
      el.innerHTML = '<span class="dot"></span><span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-term="undo">되돌리기</button>' : '') + '<span class="bar"></span>';
      $('sc-toasts').appendChild(el);
      var bar = el.querySelector('.bar');
      requestAnimationFrame(function () { el.classList.remove('off'); bar.style.transitionDuration = hold + 'ms'; bar.style.transform = 'scaleX(0)'; });
      later(function () { el.classList.remove('off'); bar.style.transitionDuration = hold + 'ms'; bar.style.transform = 'scaleX(0)'; }, 60);
      var gone = false;
      function close() { if (gone) return; gone = true; el.classList.add('off'); later(function () { el.remove(); drawLabels(); }, 220); }
      later(function () { close(); if (undo && undo.commit) undo.commit(); }, hold);
      if (undo) el.querySelector('button').addEventListener('click', function () { if (gone) return; undo.run(); close(); });
      later(drawLabels, 260);
    }
    function changeStatus(ns, s) {
      ns.forEach(function (n) { issues.forEach(function (it) { if (it.n === n) { it.s = s; it.at = Date.now(); } }); });
      if (s === 'done' && st.view === 'open') st.view = 'all';
      st.sel = {}; st.dir = 'desc'; st.page = 1;
      render(ns);
    }
    function remove(ns) {
      var kept = [], gone = [];
      issues.forEach(function (it, i) { (ns.indexOf(it.n) >= 0 ? gone : kept).push({ it: it, i: i }); });
      issues = kept.map(function (x) { return x.it; }); st.sel = {};
      render();
      toast(ns.length === 1 ? '이슈 #' + ns[0] + '을 지웠습니다.' : ns.length + '건을 지웠습니다.', {
        run: function () { gone.forEach(function (g) { issues.splice(g.i, 0, g.it); }); render(ns); toast('되돌렸습니다.'); },
        commit: function () {}
      });
    }
    function addIssue(title, s) {
      var n = issues.reduce(function (m, it) { return Math.max(m, it.n); }, 0) + 1;
      issues.unshift({ n: n, t: title, s: s || 'todo', w: '민지', at: Date.now() });
      st.view = 'open'; st.q = ''; $('sc-q').value = ''; st.dir = 'desc'; st.page = 1;
      render([n]); toast('이슈 #' + n + '을 만들었습니다.');
    }
    function reload() {
      st.loading = true; render();
      later(function () { st.loading = false; render(); }, reduce ? 300 : 1100);
    }

    /* ── 드롭다운 메뉴 ── */
    var menu = $('sc-menu'), menuFor = null, menuBtn = null;
    function openMenu(btn) {
      menuFor = +btn.getAttribute('data-menu'); menuBtn = btn;
      var a = scr.getBoundingClientRect(), r = btn.getBoundingClientRect();
      menu.classList.remove('off');
      menu.style.left = Math.max(8, r.right - a.left - menu.offsetWidth) + 'px';
      var top = r.bottom - a.top + 4;
      if (top + menu.offsetHeight > a.height - 8) top = r.top - a.top - menu.offsetHeight - 4;
      menu.style.top = top + 'px';
      btn.setAttribute('aria-expanded', 'true');
      menu.querySelector('button').focus();
      later(drawLabels, 160);
    }
    function closeMenu(focusBack) {
      if (menu.classList.contains('off')) return;
      menu.classList.add('off');
      if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); if (focusBack && document.contains(menuBtn)) menuBtn.focus(); }
      later(drawLabels, 160);
    }
    menu.addEventListener('keydown', function (e) {
      var items = [].slice.call(menu.querySelectorAll('button')), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    });

    /* ── 확인 대화상자 ── */
    var pending = null, lastFocus = null;
    function confirmDel(ns) {
      pending = ns; lastFocus = document.activeElement;
      $('sc-ct').textContent = ns.length === 1 ? '이슈 #' + ns[0] + '을 지울까요?' : ns.length + '건을 지울까요?';
      $('sc-confirm').classList.remove('off');
      $('sc-cancel').focus();
      later(drawLabels, 200);
    }
    function closeConfirm() { $('sc-confirm').classList.add('off'); pending = null; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); later(drawLabels, 200); }
    $('sc-cancel').addEventListener('click', closeConfirm);
    $('sc-ok').addEventListener('click', function () { var ns = pending; closeConfirm(); if (ns) remove(ns); });
    $('sc-confirm').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeConfirm(); }
      if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === $('sc-ok') ? $('sc-cancel') : $('sc-ok')).focus(); }
    });

    /* ── 명령 팔레트 ── */
    var palSel = 0, palHits = [];
    function palActs() {
      var list = [
        ['이동', '보드로 가기', 'G B', function () { soon('보드'); }],
        ['이동', '대시보드로 가기', 'G D', function () { soon('대시보드'); }],
        ['동작', '새 이슈 만들기', 'C', function () { addIssue('새 이슈'); }],
        ['동작', '열린 이슈만 보기', '', function () { st.view = 'open'; st.page = 1; render(); }],
        ['동작', '닫힌 이슈 보기', '', function () { st.view = 'closed'; st.page = 1; render(); }],
        ['동작', '목록 다시 불러오기', 'R', reload]
      ];
      issues.slice(0, 3).forEach(function (it) { list.push(['최근', '#' + it.n + ' ' + it.t, '', function () { jump(it.n); }]); });
      return list;
    }
    function palRender() {
      var q = $('sc-pq').value.trim(), g = '', html = '';
      palHits = palActs().filter(function (a) { return !q || a[1].indexOf(q) >= 0; });
      if (palSel >= palHits.length) palSel = 0;
      palHits.forEach(function (a, i) {
        if (a[0] !== g) { g = a[0]; html += '<div class="grp">' + g + '</div>'; }
        html += '<button type="button" class="it' + (i === palSel ? ' on' : '') + '" role="option" aria-selected="' + (i === palSel) + '" data-pi="' + i + '"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a[1]) + '</span>' + (a[2] ? '<span class="u-kbd">' + a[2] + '</span>' : '') + '</button>';
      });
      $('sc-plist').innerHTML = html || '<div class="none">맞는 것이 없습니다</div>';
    }
    function openPal() { lastFocus = document.activeElement; $('sc-pq').value = ''; palSel = 0; palRender(); $('sc-pal').classList.remove('off'); $('sc-pq').focus(); later(drawLabels, 200); }
    function closePal() { $('sc-pal').classList.add('off'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); later(drawLabels, 200); }
    function runPal(i) { var a = palHits[i]; closePal(); if (a) a[3](); }
    $('sc-pq').addEventListener('input', function () { palSel = 0; palRender(); });
    $('sc-pq').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palHits.length - 1, palSel + 1); palRender(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); palRender(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel); }
      else if (e.key === 'Escape') { e.preventDefault(); closePal(); }
    });
    function jump(n) {
      st.q = ''; $('sc-q').value = ''; st.view = 'all';
      var all = listed(), i = all.map(function (it) { return it.n; }).indexOf(n);
      st.page = Math.floor(i / PAGE) + 1; render([n]);
      var row = box.querySelector('[data-n="' + n + '"]');
      if (row) row.scrollIntoView({ block: 'nearest' });
    }
    function soon(name) { toast(name + ' 화면은 다음 묶음에서 만듭니다.'); }

    /* ── 사건 ── */
    var qTimer = null;
    $('sc-q').addEventListener('input', function () {
      $('sc-clear').hidden = !this.value;
      clearTimeout(qTimer);
      var v = this.value;
      qTimer = later(function () { st.q = v; st.page = 1; render(); }, 300);
    });
    $('sc-q').addEventListener('keydown', function (e) { if (e.key === 'Escape' && this.value) { this.value = ''; st.q = ''; render(); } });
    box.addEventListener('scroll', function () { box.classList.toggle('stuck', box.scrollTop > 0); });
    box.addEventListener('mouseover', function (e) {
      var t = e.target.closest('.ttl');
      if (t) { if (t.scrollWidth > t.clientWidth) t.title = t.textContent; else t.removeAttribute('title'); }
    });
    root.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (!el || !root.contains(el)) { closeMenu(); return; }
      if (!el.closest('#sc-menu') && !el.hasAttribute('data-menu')) closeMenu();
      if (el.tagName === 'A') { e.preventDefault(); if (el.getAttribute('data-soon')) soon(el.getAttribute('data-soon')); return; }
      if (el.closest('#sc-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      var v;
      if ((v = el.getAttribute('data-view'))) { st.view = v; st.page = 1; render(); return; }
      if ((v = el.getAttribute('data-pick'))) { if (st.sel[v]) delete st.sel[v]; else st.sel[v] = true; render(); return; }
      if (el.id === 'sc-all') {
        var ids = listed().slice((st.page - 1) * PAGE, st.page * PAGE).map(function (r) { return r.n; });
        var allOn = ids.every(function (n) { return st.sel[n]; });
        ids.forEach(function (n) { if (allOn) delete st.sel[n]; else st.sel[n] = true; });
        render(); return;
      }
      if (el.id === 'sc-sort') { st.dir = st.dir === 'desc' ? 'asc' : 'desc'; render(); return; }
      if ((v = el.getAttribute('data-page'))) { if (!el.disabled) { st.page = +v; render(); box.scrollTop = 0; } return; }
      if ((v = el.getAttribute('data-menu'))) { if (!menu.classList.contains('off') && menuFor === +v) closeMenu(); else openMenu(el); return; }
      if (el.id === 'sc-new') { addIssue('새 이슈'); return; }
      if (el.id === 'sc-cmd') { openPal(); return; }
      if (el.id === 'sc-clear') { $('sc-q').value = ''; st.q = ''; render(); $('sc-q').focus(); return; }
      if ((v = el.getAttribute('data-pi'))) { runPal(+v); return; }
      switch (el.getAttribute('data-act')) {
        case 'done': closeMenu(); changeStatus([menuFor], 'done'); toast('#' + menuFor + '을 완료로 바꿨습니다.'); break;
        case 'copy': closeMenu(); var src = issues.filter(function (it) { return it.n === menuFor; })[0]; if (src) addIssue(src.t + ' (복제)', src.s === 'done' ? 'todo' : src.s); break;
        case 'del': closeMenu(); confirmDel([menuFor]); break;
        case 'bulkrev': var ns = selIds(); changeStatus(ns, 'rev'); toast(ns.length + '건을 검토로 바꿨습니다.'); break;
        case 'bulkdel': confirmDel(selIds()); break;
        case 'unsel': st.sel = {}; render(); break;
        case 'clearq': $('sc-q').value = ''; st.q = ''; render(); break;
        case 'showclosed': st.view = 'closed'; render(); break;
        case 'new': addIssue('새 이슈'); break;
      }
    });
    function onKey(e) {
      if (root.offsetParent === null) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if ($('sc-pal').classList.contains('off')) openPal(); else closePal(); }
    }
    document.addEventListener('keydown', onKey);
    $('sc-pal').querySelector('.u-shade').addEventListener('click', closePal);
    $('sc-confirm').querySelector('.u-shade').addEventListener('click', closeConfirm);

    /* ── 용어 보기 이름표 ── */
    function drawLabels() {
      var L = $('sc-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) {
        return id === 'app-shell' ? 'in-bl' : id === 'data-table' ? 'in-br' : id === 'dropdown-menu' ? 'below' : id === 'sticky-header' || id === 'undo' ? 'right' : '';
      });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { moveSeg(); drawLabels(); }
    window.addEventListener('resize', onResize);
    box.addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    // 처음: 뼈대를 잠깐 보이고 목록으로
    render();
    later(function () { st.loading = false; render(); }, reduce ? 300 : 1100);
    var minute = setInterval(function () { if (!st.loading) render(); }, 60000);

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      // 지금 화면에 없는 용어를 불러오는 시연
      demo: function (id) {
        var first = listed()[0];
        if (id === 'confirm-dialog') confirmDel([first ? first.n : issues[0].n]);
        else if (id === 'empty-state') { $('sc-q').value = '없는 말'; st.q = '없는 말'; render(); }
        else if (id === 'highlight-flash' || id === 'toast') { if (first) { changeStatus([first.n], 'rev'); toast('#' + first.n + ' 상태를 검토로 바꿨습니다.'); } }
        else if (id === 'undo') { if (first) remove([first.n]); }
        else if (id === 'skeleton') reload();
        else if (id === 'bulk-action-bar') { listed().slice(0, 2).forEach(function (it) { st.sel[it.n] = true; }); render(); }
        else if (id === 'command-palette') openPal();
        else if (id === 'dropdown-menu') { var b = box.querySelector('[data-menu]'); if (b) openMenu(b); }
        else { $('sc-q').value = ''; st.q = ''; st.view = 'all'; st.page = 1; render(); } // 행이 있어야 보이는 용어
      },
      destroy: function () {
        timers.forEach(clearTimeout); clearInterval(minute);
        document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
        root.innerHTML = '';
      }
    };
  };
})();
