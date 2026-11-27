/* 조합 화면: 칩 견주기. 쇼핑 검색 결과 화면을 폭 슬라이더 틀에 넣어 칩 용어 5개를 엮는다 (recipes.json의 chips)
   필터 칩 줄은 칸 폭 기준 @container로 긴 문구 → 짧은 문구 → 아이콘만으로 바뀌고, 그래도 넘치면 JS가 +N 칩으로 접는다
   UI.screens['chips'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  // 필터 칩: 도감 공용 여섯에 둘을 더한다 [키, 아이콘, 긴 문구, 짧은 문구]
  var F = UI.FILTERS.concat([['coupon', 'ticket', '쿠폰 적용', '쿠폰'], ['free', 'card', '무이자 할부', '무이자']]);
  var COUNT = [128, 96, 41, 22, 57, 18, 63, 30];   // 칩마다 걸렀을 때 남는 수(가상)
  var GOODS = ['경량 패딩 남색', '롱패딩 검정', '숏패딩 베이지', '덕다운 점퍼', '후드 패딩 회색', '패딩 조끼', '푸퍼 재킷', '구스 롱패딩'];
  var PEOPLE = ['민지', '준호', '서연', '도윤', '하은', '지우'];
  var STEPS = [['짧은 문구 → 아이콘만 → +N', 'icon'], ['짧은 문구 → +N', 'short'], ['필터 단추와 시트로', 'sheet']];

  UI.screens['chips'] = function (root, opt) {
    var st = { labels: false, w: 1000, steps: 'icon', h: 32, sel: [1, 4], who: PEOPLE.slice(0, 4), guide: false, sheet: false, fieldOpen: false }, timers = [], ro = null;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function $(id) { return document.getElementById(id); }
    function ph(i) { return 'color-mix(in srgb, ' + ['var(--u-accent)', 'var(--u-ok)', 'var(--u-warn)', 'var(--u-info)', 'var(--u-danger)'][i % 5] + ' 26%, var(--u-panel))'; }

    root.innerHTML =
      '<div class="u scr cj-scr">' +
        '<div class="cj-tools">' +
          '<label class="cj-w">화면 폭 <input type="range" id="cj-w" min="300" max="1100" step="10" value="1000"> <b id="cj-wv"></b></label>' +
          '<label>좁아질 때 <select id="cj-steps">' + STEPS.map(function (s) { return '<option value="' + s[1] + '">' + s[0] + '</option>'; }).join('') + '</select></label>' +
          '<label>칩 높이 <select id="cj-h"><option value="24">작게 24px</option><option value="32" selected>보통 32px</option><option value="40">크게 40px</option></select></label>' +
          '<label class="cj-g"><button type="button" class="u-switch" role="switch" aria-checked="false" id="cj-guide"><i></i></button>터치 기준선 44px</label>' +
          '<span class="cj-stage" id="cj-stage" role="status"></span></div>' +
        '<div class="cj-stagebox"><div class="cj-frame" id="cj-frame">' +
          '<div class="cj-page">' +
            '<input class="cj-q" id="cj-q" type="search" value="겨울 패딩" aria-label="상품 찾기" data-term="search-bar">' +
            '<div class="cj-sug" role="group" aria-label="추천 검색어"><span>이런 말로 찾아보세요</span>' + ['롱패딩', '경량 패딩', '숏패딩'].map(function (t) { return '<button type="button" class="cj-chip" data-sug="' + t + '">' + UI.chipIcon('spark') + '<span>' + t + '</span></button>'; }).join('') + '</div>' +
            '<div class="cj-rowbox" data-term="responsive-chip-row"><div class="cj-row" id="cj-row" role="group" aria-label="검색 결과 거르기"></div></div>' +
            '<div class="cj-meta"><b id="cj-n"></b><span class="grow"></span>' +
              '<button type="button" class="cj-chip cj-assist" data-assist="save">' + UI.chipIcon('star') + '<span>이 검색 저장</span></button>' +
              '<button type="button" class="cj-chip cj-assist" data-assist="price">' + UI.chipIcon('bolt') + '<span>가격 알림</span></button></div>' +
            '<div class="cj-grid" data-term="card-grid">' + GOODS.map(function (g, i) { return '<div class="cj-good"><i style="background:' + ph(i) + '"></i><b>' + g + '</b><span>' + (49 + i * 11) + ',000원</span></div>'; }).join('') + '</div>' +
            '<div class="cj-share"><b>이 검색 결과 보내기</b><div class="cj-field" id="cj-field"></div></div>' +
          '</div>' +
          '<div class="cj-sheet" id="cj-sheet" hidden><div class="cj-sh"><b>필터</b><button type="button" class="u-btn" id="cj-close">닫기</button></div><div id="cj-sl"></div></div>' +
          '<div class="cj-toast" id="cj-toast" role="status"></div>' +
        '</div></div>' +
        '<div class="scr-labels" id="cj-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.cj-scr'), frame = $('cj-frame'), rowEl = $('cj-row');

    /* ── 필터 칩 줄: 고른 칩이 앞. 칩 안에 긴·짧은 문구를 모두 두고 @container가 하나만 보인다(이름은 늘 긴 문구) ── */
    function chip(i) {
      var f = F[i], on = st.sel.indexOf(i) >= 0;
      return '<button type="button" class="cj-chip cj-f" data-f="' + i + '" aria-pressed="' + on + '" aria-label="' + f[2] + '">' + '<b class="ck" aria-hidden="true">✓</b>' + UI.chipIcon(f[1]) +
        '<span class="lg" aria-hidden="true">' + f[2] + '</span><span class="sh" aria-hidden="true">' + f[3] + '</span></button>';
    }
    function drawRow() {
      var order = st.sel.slice().concat(F.map(function (f, i) { return i; }).filter(function (i) { return st.sel.indexOf(i) < 0; }));
      rowEl.dataset.steps = st.steps;
      rowEl.innerHTML = order.map(chip).join('') + '<button type="button" class="cj-chip cj-more" id="cj-more" aria-haspopup="true" aria-expanded="false" hidden data-term="overflow-chip"></button>' +
        '<button type="button" class="cj-chip cj-fbtn" id="cj-fbtn">' + UI.chipIcon('sale') + '<span>필터 (' + st.sel.length + ')</span></button>';
      var first = rowEl.querySelector('.cj-f'); if (first) first.setAttribute('data-term', 'chip');
      $('cj-n').textContent = '상품 ' + (st.sel.length ? Math.min.apply(null, st.sel.map(function (i) { return COUNT[i]; })) : 312) + '개';
      fit();
    }
    // +N: 아이콘·짧은 문구로도 넘치면 뒤에서부터 숨기고(aria-hidden) +N 칩 이름에 숨긴 칩 이름을 넣는다
    function fit() {
      var fs = [].slice.call(rowEl.querySelectorAll('.cj-f')), more = $('cj-more');
      fs.forEach(function (c) { c.hidden = false; c.removeAttribute('aria-hidden'); });
      more.hidden = true;
      var hid = [];
      if (getComputedStyle(fs[0]).display !== 'none') {
        while (rowEl.scrollWidth > rowEl.clientWidth + 1 && fs.length - hid.length > st.sel.length) {
          var c = fs[fs.length - 1 - hid.length]; c.hidden = true; c.setAttribute('aria-hidden', 'true'); hid.unshift(c);
          more.hidden = false; more.textContent = '+' + hid.length;
        }
        // +N 칩이 들어가면서 다시 넘치면 하나 더 접는다
        while (!more.hidden && rowEl.scrollWidth > rowEl.clientWidth + 1 && fs.length - hid.length > st.sel.length) {
          var d = fs[fs.length - 1 - hid.length]; d.hidden = true; d.setAttribute('aria-hidden', 'true'); hid.unshift(d); more.textContent = '+' + hid.length;
        }
      }
      st.hidden = hid.map(function (c) { return +c.getAttribute('data-f'); });
      more.setAttribute('aria-label', '필터 ' + hid.length + '개 더: ' + st.hidden.map(function (i) { return F[i][2]; }).join(', '));
      stageText();
    }
    function stageText() {
      var w = rowEl.parentNode.clientWidth, any = rowEl.querySelector('.cj-f'), cs = any && getComputedStyle(any.querySelector('.lg')).display !== 'none', ss = any && getComputedStyle(any.querySelector('.sh')).display !== 'none';
      var name = getComputedStyle($('cj-fbtn')).display !== 'none' ? '필터 단추' : cs ? '아이콘+긴 문구' : ss ? '아이콘+짧은 문구' : '아이콘만';
      if (!$('cj-more').hidden) name += ' · +' + st.hidden.length + ' 접기';
      $('cj-stage').textContent = '칩 줄 칸 ' + Math.round(w) + 'px · ' + name;
      $('cj-wv').textContent = Math.round(frame.offsetWidth) + 'px';
    }

    /* ── 시트: 필터 단추나 +N을 누르면 고른 칩을 체크 목록으로 고친다 ── */
    function openSheet(only) {
      var list = only || F.map(function (f, i) { return i; });
      $('cj-sl').innerHTML = list.map(function (i) { return '<label class="cj-ck"><input type="checkbox" data-ck="' + i + '"' + (st.sel.indexOf(i) >= 0 ? ' checked' : '') + '>' + UI.chipIcon(F[i][1]) + F[i][2] + '</label>'; }).join('');
      $('cj-sheet').hidden = false; $('cj-more').setAttribute('aria-expanded', 'true');
      var f = $('cj-sl').querySelector('input'); if (f) f.focus();
    }
    function closeSheet() { $('cj-sheet').hidden = true; var m = $('cj-more'); if (m) m.setAttribute('aria-expanded', 'false'); }

    /* ── 보낼 사람: 입력 칩(아바타+×). 칸 밖에 있으면 한 줄에 넘치는 사람을 "+N명"으로 접고, 칸 안에 들어오면 모두 보인다 ── */
    function drawField(focusInput) {
      var fd = $('cj-field');
      fd.innerHTML = st.who.map(function (n, i) { return '<span class="cj-chip cj-in" data-who="' + i + '"><i style="background:' + ph(n.charCodeAt(0)) + '">' + n[0] + '</i><span>' + n + '</span><button type="button" class="cj-x" data-rm="' + i + '" aria-label="' + n + ' 빼기">×</button></span>'; }).join('') +
        '<span class="cj-chip cj-more cj-pm" hidden></span><input id="cj-who" aria-label="보낼 사람 이름 넣기" placeholder="이름 넣고 Enter">';
      fd.classList.toggle('open', st.fieldOpen);
      if (!st.fieldOpen) {
        var ins = [].slice.call(fd.querySelectorAll('.cj-in')), pm = fd.querySelector('.cj-pm'), n = 0, top = ins.length ? ins[0].offsetTop : 0;
        // 첫 줄에 들어가지 않는 사람을 접는다
        for (var i = ins.length - 1; i > 0 && ins[i].offsetTop > top + 2; i--) { ins[i].hidden = true; n++; }
        if (n) { pm.hidden = false; pm.textContent = '+' + n + '명'; pm.setAttribute('aria-label', '보낼 사람 ' + n + '명 더'); while (pm.offsetTop > top + 2 && ins.length - n > 1) { ins[ins.length - 1 - n].hidden = true; n++; pm.textContent = '+' + n + '명'; } }
      }
      if (focusInput) $('cj-who').focus();
    }

    function toast(t) { var e = $('cj-toast'); e.textContent = t; e.classList.add('on'); clearTimeout(st.tt); st.tt = later(function () { e.classList.remove('on'); }, 1600); }
    function setW(v) { st.w = v; frame.style.width = v + 'px'; }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.closest('#cj-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.hasAttribute('data-f')) { var i = +b.getAttribute('data-f'), k = st.sel.indexOf(i); if (k >= 0) st.sel.splice(k, 1); else st.sel.push(i); drawRow(); var nb = rowEl.querySelector('[data-f="' + i + '"]'); if (nb && !nb.hidden) nb.focus(); }
      else if (b.id === 'cj-more') openSheet(st.hidden);
      else if (b.id === 'cj-fbtn') openSheet();
      else if (b.id === 'cj-close') { closeSheet(); }
      else if (b.hasAttribute('data-sug')) { $('cj-q').value = b.getAttribute('data-sug'); $('cj-q').focus(); }
      else if (b.hasAttribute('data-assist')) toast(b.getAttribute('data-assist') === 'save' ? '"' + $('cj-q').value + '" 검색을 저장했어요' : '가격이 내리면 알려 드릴게요');
      else if (b.id === 'cj-guide') { st.guide = !st.guide; b.setAttribute('aria-checked', String(st.guide)); scr.classList.toggle('guide', st.guide); }
      else if (b.hasAttribute('data-rm')) { st.who.splice(+b.getAttribute('data-rm'), 1); st.fieldOpen = true; drawField(true); }
      if (st.labels) later(drawLabels, 30);
    });
    root.addEventListener('change', function (e) {
      var c = e.target.closest('[data-ck]');
      if (c) { var i = +c.getAttribute('data-ck'), k = st.sel.indexOf(i); if (c.checked && k < 0) st.sel.push(i); else if (!c.checked && k >= 0) st.sel.splice(k, 1); drawRow(); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('cj-sheet').hidden) { closeSheet(); var m = $('cj-more'); (m && !m.hidden ? m : $('cj-fbtn')).focus(); return; }
      if (e.target.id !== 'cj-who') return;
      var v = e.target.value.trim();
      if (e.key === 'Enter' && v) { e.preventDefault(); st.who.push(v.slice(0, 6)); drawField(true); }
      else if (e.key === 'Backspace' && !e.target.value && st.who.length) { st.who.pop(); drawField(true); }
    });
    // 칸 빈 곳이나 칩 글을 누르면 열고 입력칸에 초점(칸 요소는 그대로라 다시 그려도 사건을 받는다)
    $('cj-field').addEventListener('mousedown', function (e) { if (e.target.closest('button, input')) return; e.preventDefault(); st.fieldOpen = true; drawField(true); });
    root.addEventListener('focusin', function (e) { if (e.target.closest('#cj-field') && !st.fieldOpen) { st.fieldOpen = true; var id = e.target.id; drawField(id === 'cj-who'); } });
    root.addEventListener('focusout', function (e) {
      if (!e.target.closest('#cj-field')) return;
      later(function () { if (!$('cj-field').contains(document.activeElement)) { st.fieldOpen = false; drawField(); } }, 0);
    });
    $('cj-w').addEventListener('input', function () { setW(+this.value); });
    $('cj-steps').addEventListener('change', function () { st.steps = this.value; drawRow(); });
    $('cj-h').addEventListener('change', function () { st.h = +this.value; scr.style.setProperty('--cj-h', st.h + 'px'); fit(); drawField(); });

    /* ── 틀 폭이 바뀌면(슬라이더·창 크기) 다시 맞춘다 ── */
    ro = new ResizeObserver(function () { fit(); drawField(); if (st.labels) drawLabels(); });
    ro.observe(rowEl.parentNode);

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('cj-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'responsive-chip-row' ? 'below' : id === 'overflow-chip' ? 'right' : ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }

    setW(Math.min(1000, root.clientWidth - 40));
    $('cj-w').value = st.w;
    drawRow(); drawField();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      // +N 칩은 좁을 때만 보이므로 폭을 줄여 보인다
      demo: function (id) { if (id === 'overflow-chip') { $('cj-steps').value = st.steps = 'icon'; setW(330); $('cj-w').value = 330; drawRow(); } later(drawLabels, 80); },
      destroy: function () { timers.forEach(clearTimeout); if (ro) ro.disconnect(); root.innerHTML = ''; }
    };
  };
})();
