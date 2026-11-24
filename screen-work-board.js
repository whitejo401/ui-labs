/* 조합 화면: 업무 보드. 용어 4개를 한 화면에 엮는다 (recipes.json의 work-board)
   UI.screens['work-board'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var EXTRA = ['쿠폰 적용 후 금액 표시 오류', '결제 내역 엑셀 내보내기', '환불 승인 알림 문구 다듬기', '정기 결제 해지 흐름 정리', '영수증 재발송 단추', '결제 실패 사유 코드 정리', '카드사 점검 공지 배너', '부분 취소 API 문서화'];
  var WHO = ['민지', '준호', '서연', '도윤'];

  UI.screens['work-board'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cards = {}, cols = { todo: [], prog: [], rev: [], done: [] };
    UI.ISSUES.forEach(function (it) { cards[it.n] = { n: it.n, t: it.t, w: it.w }; cols[it.s === 'hold' ? 'todo' : it.s].push(it.n); });
    EXTRA.forEach(function (t, i) { var n = 33 + i; cards[n] = { n: n, t: t, w: WHO[i % 4] }; cols[i < 5 ? 'todo' : 'rev'].push(n); });
    var st = { labels: false, fold: {}, failNext: false, saving: 0, kb: null };
    var timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function snapshot() { return JSON.parse(JSON.stringify(cols)); }

    root.innerHTML =
      '<div class="u scr">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) { return '<li><a href="#"' + (i === 1 ? ' aria-current="page"' : '') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="wb-main">' +
          '<div class="wb-head"><h2>업무 보드</h2>' +
            '<form class="wb-go" id="wb-go" data-term="scroll-into-view"><label for="wb-gq">카드로 가기</label><input id="wb-gq" inputmode="numeric" placeholder="#번호" autocomplete="off"><button class="u-btn" type="submit">가기</button></form>' +
            '<span style="flex:1"></span><span class="wb-save" id="wb-save" role="status" data-term="optimistic-update"></span>' +
            '<label class="db-calm"><input type="checkbox" id="wb-fail"> 다음 저장 실패시키기</label></div>' +
          '<p class="wb-hint">카드 왼쪽 ⠿를 끌어 옮기세요. 키보드로는 카드에 초점을 두고 Space로 집은 뒤 ← → ↑ ↓로 옮기고 Space로 놓습니다(Esc는 취소).</p>' +
          '<div class="wb-board" id="wb-board" data-term="kanban-board"></div>' +
        '</div>' +
        '<div class="scr-toasts" id="wb-toasts" aria-live="polite"></div>' +
        '<div class="wb-live" id="wb-live" aria-live="assertive"></div>' +
        '<div class="scr-labels" id="wb-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr'), board = $('wb-board');

    function cardHTML(n, first) {
      var c = cards[n];
      return '<div class="wb-card" tabindex="0" data-n="' + n + '" aria-roledescription="옮길 수 있는 카드" aria-label="#' + n + ' ' + esc(c.t) + '">' +
        '<span class="hdl" aria-hidden="true"' + (first ? ' data-term="drag-and-drop"' : '') + '>⠿</span><div class="bd"><span class="num">#' + n + '</span><span class="tt">' + esc(c.t) + '</span>' +
        '<span class="u-who"><span class="u-av" style="background:' + UI.AV[c.w] + '">' + c.w[0] + '</span>' + c.w + '</span></div></div>';
    }
    function render() {
      var first = true;
      board.innerHTML = UI.COLS.map(function (k) {
        var fold = st.fold[k[0]];
        var html = '<section class="wb-col' + (fold ? ' fold' : '') + '" data-k="' + k[0] + '" aria-label="' + k[1] + ' 칸"><div class="wb-ch"><b>' + k[1] + '</b><span class="ct">' + cols[k[0]].length + '</span>' +
          '<button type="button" class="u-icon" data-fold="' + k[0] + '" aria-label="' + k[1] + ' 칸 ' + (fold ? '펼치기' : '접기') + '" aria-expanded="' + !fold + '">' + (fold ? '⇥' : '⇤') + '</button></div>' +
          '<div class="wb-list">' + (fold ? '' : cols[k[0]].map(function (n) { var h = cardHTML(n, first); first = false; return h; }).join('')) + '</div></section>';
        return html;
      }).join('');
      later(drawLabels, 30);
    }
    function where(n) { for (var k in cols) { var i = cols[k].indexOf(n); if (i >= 0) return { k: k, i: i }; } return null; }
    function colName(k) { return UI.COLS.filter(function (x) { return x[0] === k; })[0][1]; }
    function say(t) { $('wb-live').textContent = t; }
    function flash(n, cls) { var el = board.querySelector('[data-n="' + n + '"]'); if (el) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); later(function () { el.classList.remove(cls); }, 1300); } return el; }

    /* ── 저장: 화면을 먼저 바꾸고(Optimistic Update) 실패하면 되돌린다 ── */
    function setSave() {
      var s = $('wb-save');
      s.innerHTML = st.saving ? UI.spinHTML(12, 'run') + ' 저장 중' : '<span style="color:var(--u-ok)">✓</span> 모두 저장됨';
    }
    function commit(before, n, text) {
      var fail = st.failNext;
      st.failNext = false; $('wb-fail').checked = false;
      st.saving++; setSave();
      later(function () {
        st.saving--; setSave();
        if (!fail) return;
        var after = snapshot();
        cols = before; render(); flash(n, 'err');
        say('저장하지 못해 #' + n + '을 원래 자리로 되돌렸습니다');
        toast('저장하지 못했습니다. #' + n + '을 원래 자리로 되돌렸습니다.', function () { var b2 = snapshot(); cols = after; render(); flash(n, 'flash'); commit(b2, n); });
      }, 700);
      if (text) say(text);
    }
    function toast(msg, retry) {
      var el = document.createElement('div');
      el.className = 'u-toast off'; el.setAttribute('role', 'status');
      el.innerHTML = '<span class="dot err"></span><span>' + esc(msg) + '</span>' + (retry ? '<button type="button">다시 시도</button>' : '');
      $('wb-toasts').appendChild(el);
      requestAnimationFrame(function () { el.classList.remove('off'); });
      later(function () { el.classList.remove('off'); }, 60);
      var gone = false;
      function close() { if (gone) return; gone = true; el.classList.add('off'); later(function () { el.remove(); }, 220); }
      later(close, 5000);
      if (retry) el.querySelector('button').addEventListener('click', function () { close(); retry(); });
    }
    function move(n, k, i, text) {
      var before = snapshot(), from = where(n);
      cols[from.k].splice(from.i, 1);
      i = Math.max(0, Math.min(cols[k].length, i));
      cols[k].splice(i, 0, n);
      if (from.k === k && from.i === i) return false;
      commit(before, n, text || '#' + n + '을 ' + colName(k) + ' 칸 ' + (i + 1) + '번째로 옮겼습니다');
      return true;
    }

    /* ── 끌어서 놓기 (마우스·터치) ── */
    var drag = null;
    function rectsOf() { var m = {}; board.querySelectorAll('.wb-card, .wb-ph').forEach(function (el) { m[el.getAttribute('data-n') || 'ph'] = el.getBoundingClientRect().top; }); return m; }
    function flip(before) {
      if (reduce) return;
      board.querySelectorAll('.wb-card').forEach(function (el) {
        var n = el.getAttribute('data-n'); if (before[n] == null || (drag && el === drag.src)) return;
        var dy = before[n] - el.getBoundingClientRect().top;
        if (!dy) return;
        el.style.transition = 'none'; el.style.transform = 'translateY(' + dy + 'px)';
        requestAnimationFrame(function () { el.style.transition = 'transform 150ms ease-out'; el.style.transform = ''; });
        later(function () { el.style.transition = ''; el.style.transform = ''; }, 200);
      });
    }
    board.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.hdl'); if (!h || e.button > 0) return;
      var el = h.closest('.wb-card'), r = el.getBoundingClientRect(), a = scr.getBoundingClientRect();
      e.preventDefault();
      var ph = document.createElement('div'); ph.className = 'wb-ph'; ph.style.height = r.height + 'px';
      var ghost = el.cloneNode(true); ghost.className = 'wb-card ghost'; ghost.removeAttribute('tabindex'); ghost.style.width = r.width + 'px';
      scr.appendChild(ghost);
      el.parentNode.insertBefore(ph, el); el.style.display = 'none';
      drag = { n: +el.getAttribute('data-n'), src: el, ph: ph, ghost: ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, a: a };
      ghost.style.left = (r.left - a.left) + 'px'; ghost.style.top = (r.top - a.top) + 'px';
      try { board.setPointerCapture(e.pointerId); } catch (err) {}
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var a = scr.getBoundingClientRect();
      drag.ghost.style.left = (e.clientX - a.left - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - a.top - drag.dy) + 'px';
      var col = null;
      board.querySelectorAll('.wb-col:not(.fold)').forEach(function (c) { var r = c.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right) col = c; });
      if (!col) return;
      var list = col.querySelector('.wb-list'), next = null;
      [].slice.call(list.querySelectorAll('.wb-card')).some(function (c) { if (c.style.display === 'none') return false; var r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { next = c; return true; } return false; });
      if ((next && drag.ph.nextSibling === next && drag.ph.parentNode === list) || (!next && drag.ph.parentNode === list && !drag.ph.nextElementSibling)) return;
      var before = rectsOf();
      list.insertBefore(drag.ph, next);
      flip(before);
      // 칸 안이 스크롤될 때 끝에 가까우면 조금씩 내린다
      var lr = list.getBoundingClientRect();
      if (e.clientY > lr.bottom - 30) list.scrollTop += 12; else if (e.clientY < lr.top + 30) list.scrollTop -= 12;
    });
    function endDrag(cancel) {
      if (!drag) return;
      var d = drag; drag = null;
      d.ghost.remove();
      var list = d.ph.parentNode, k = list.closest('.wb-col').getAttribute('data-k');
      var i = [].slice.call(list.children).filter(function (c) { return c !== d.src; }).indexOf(d.ph);
      d.ph.remove(); d.src.style.display = '';
      if (!cancel) move(d.n, k, i);
      render(); flash(d.n, 'flash');
    }
    board.addEventListener('pointerup', function () { endDrag(false); });
    board.addEventListener('pointercancel', function () { endDrag(true); });

    /* ── 키보드로 옮기기 ── */
    board.addEventListener('keydown', function (e) {
      var el = e.target.closest('.wb-card'); if (!el) return;
      var n = +el.getAttribute('data-n'), w = where(n), keys = UI.COLS.map(function (x) { return x[0]; });
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!st.kb) { st.kb = { n: n, before: snapshot() }; el.classList.add('picked'); say('#' + n + '을 집었습니다. 화살표로 옮기고 Space로 놓으세요'); }
        else { var b = st.kb.before; st.kb = null; render(); var c = board.querySelector('[data-n="' + n + '"]'); if (c) c.focus(); if (JSON.stringify(b) !== JSON.stringify(cols)) commit(b, n, '#' + n + '을 ' + colName(w.k) + ' 칸 ' + (w.i + 1) + '번째에 놓았습니다'); else say('제자리에 놓았습니다'); }
        return;
      }
      if (e.key === 'Escape' && st.kb) { cols = st.kb.before; st.kb = null; render(); var c0 = board.querySelector('[data-n="' + n + '"]'); if (c0) c0.focus(); say('옮기기를 취소했습니다'); return; }
      if (!st.kb || st.kb.n !== n) return;
      var k = w.k, i = w.i, ki = keys.indexOf(k);
      if (e.key === 'ArrowUp') i--; else if (e.key === 'ArrowDown') i++;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        var step = e.key === 'ArrowLeft' ? -1 : 1, nk = ki + step;
        while (keys[nk] && st.fold[keys[nk]]) nk += step;
        if (!keys[nk]) return;
        k = keys[nk]; i = Math.min(i, cols[k].length);
      } else return;
      e.preventDefault();
      if (i < 0 || (k === w.k && i >= cols[k].length)) return;
      cols[w.k].splice(w.i, 1); cols[k].splice(i, 0, n);
      render();
      var c2 = board.querySelector('[data-n="' + n + '"]'); c2.classList.add('picked'); c2.focus({ preventScroll: true }); intoView(c2, false);
      say(colName(k) + ' 칸 ' + (i + 1) + '번째');
    });

    /* ── 카드로 가기 (Scroll Into View) ── */
    function intoView(el, center) {
      var list = el.closest('.wb-list'), col = el.closest('.wb-col');
      var top = center ? el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2 : Math.min(list.scrollTop, el.offsetTop - 8);
      if (!center && el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) top = el.offsetTop + el.offsetHeight - list.clientHeight + 8;
      var how = reduce ? 'auto' : 'smooth', y = Math.max(0, Math.min(top, list.scrollHeight - list.clientHeight));
      list.scrollTo({ top: y, behavior: how });
      var br = board.getBoundingClientRect(), cr = col.getBoundingClientRect(), x = null;
      if (cr.left < br.left || cr.right > br.right) { x = Math.max(0, board.scrollLeft + cr.left - br.left - 8); board.scrollTo({ left: x, behavior: how }); }
      // 부드러운 스크롤은 앱 안의 보기에서 멈출 수 있다. 끝날 시간에도 못 닿았으면 바로 옮긴다
      later(function () { if (Math.abs(list.scrollTop - y) > 2) list.scrollTop = y; if (x != null && Math.abs(board.scrollLeft - x) > 2) board.scrollLeft = x; }, 700);
    }
    $('wb-go').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt($('wb-gq').value.replace(/\D/g, ''), 10), w = cards[n] && where(n);
      if (!w) { say('#' + (n || '') + ' 카드가 없습니다'); toast('#' + (isNaN(n) ? '' : n) + ' 카드를 찾지 못했습니다.'); return; }
      if (st.fold[w.k]) { st.fold[w.k] = false; render(); }
      var el = board.querySelector('[data-n="' + n + '"]');
      intoView(el, true);
      later(function () { el.focus({ preventScroll: true }); flash(n, 'flash'); }, reduce ? 0 : 750);
      say('#' + n + '로 옮겨 갔습니다');
    });

    root.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (!el || !root.contains(el)) return;
      if (el.closest('#wb-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.tagName === 'A') { e.preventDefault(); return; }
      var v = el.getAttribute('data-fold');
      if (v) { st.fold[v] = !st.fold[v]; render(); var b = board.querySelector('[data-fold="' + v + '"]'); if (b) b.focus(); }
    });
    $('wb-fail').addEventListener('change', function () { st.failNext = this.checked; });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('wb-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'kanban-board' ? 'in-br' : id === 'optimistic-update' ? 'right' : ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { drawLabels(); }
    window.addEventListener('resize', onResize);
    board.addEventListener('scroll', function () { if (st.labels) drawLabels(); }, true);

    render(); setSave();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        if (id === 'scroll-into-view') { $('wb-gq').value = '37'; $('wb-go').requestSubmit ? $('wb-go').requestSubmit() : $('wb-go').dispatchEvent(new Event('submit', { cancelable: true })); }
        else if (id === 'optimistic-update') { st.failNext = true; var n = cols.todo[0]; if (n) { move(n, 'prog', 0); render(); flash(n, 'flash'); } }
        later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
