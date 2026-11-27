/* 조합 화면: 설정 페이지. 알림 설정과 미리보기를 가름대로 나눈 화면에 묶기 용어 11개를 엮는다 (recipes.json의 settings)
   왼쪽에서 바꾼 값(받는 곳, 방해 금지, 받을 알림)이 오른쪽 알림 미리보기에 바로 반영된다
   UI.screens['settings'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, MIN = 240, STEP = 24;
  var CH = [['mail', '메일', true], ['push', '앱 푸시', true], ['sms', '문자', false]];
  // [키, 칩 이름, 미리보기 알림 글]. 보안은 끌 수 없다
  var KIND = [['pay', '결제', '42,000원이 승인됐어요'], ['refund', '환불', '18,500원을 돌려드렸어요'], ['settle', '정산', '11월 정산이 끝났어요'],
    ['sec', '보안', '새 기기에서 로그인했어요'], ['news', '소식', '환불 내역 표가 새로 생겼어요']];
  var QUIET = ['끔', '22:00~08:00', '23:00~07:00'], DEV = [['phone', '휴대폰', 260], ['tablet', '태블릿', 380], ['pc', 'PC', 0]];

  UI.screens['settings'] = function (root, opt) {
    var st = { labels: false, ch: { mail: true, push: true, sms: false }, kinds: { pay: true, refund: true, settle: false, sec: true, news: false }, quiet: QUIET[1], weekend: false, dev: 'phone', w: null };
    var timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function sw(key, on, label) { return '<button type="button" class="u-switch" role="switch" aria-checked="' + on + '" aria-label="' + label + '" data-sw="' + key + '"' + (key === 'mail' ? ' data-term="toggle-switch"' : '') + '><i></i></button>'; }
    function row(name, right) { return '<div class="st-row"><span>' + name + '</span>' + right + '</div>'; }

    root.innerHTML =
      '<div class="u scr st-scr">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) { return '<li><a href="#"' + (i === 3 ? ' aria-current="page"' : '') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="st-main">' +
          '<div class="st-head"><h2>알림 설정</h2><p>어디로, 무엇을 받을지 정합니다. 오른쪽 미리보기에 바로 보입니다.</p></div>' +
          '<div class="st-split" id="st-split">' +
            '<div class="st-left" id="st-left" data-term="overscroll-behavior">' +
              '<section class="st-grp" data-term="grouped-list" aria-labelledby="st-g1"><h3 id="st-g1">받는 곳</h3><div class="st-box">' +
                CH.map(function (c) { return row(c[1], sw(c[0], st.ch[c[0]], c[1] + ' 알림')); }).join('') + '</div></section>' +
              '<section class="st-grp" aria-labelledby="st-g2"><h3 id="st-g2">방해 금지</h3><div class="st-box">' +
                row('시간', '<select class="st-sel" id="st-quiet" aria-label="방해 금지 시간" data-term="select">' + QUIET.map(function (q) { return '<option' + (q === st.quiet ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select>') +
                row('주말에도', sw('weekend', st.weekend, '주말에도 방해 금지')) + '</div></section>' +
              '<fieldset class="st-fs" data-term="fieldset"><legend>받을 알림</legend>' +
                '<div class="st-chips" role="group" aria-label="받을 알림 종류" data-term="chip-group">' + KIND.map(function (k) {
                  return '<button type="button" class="st-chip" data-kind="' + k[0] + '" aria-pressed="' + st.kinds[k[0]] + '"' + (k[0] === 'sec' ? ' aria-disabled="true" title="보안 알림은 끌 수 없어요"' : '') + '><span aria-hidden="true">✓</span>' + k[1] + '</button>';
                }).join('') + '</div>' +
                UI.calloutHTML('주의', '보안 알림은 끌 수 없어요', '새 기기 로그인과 비밀번호 변경은 계정을 지키려고 늘 보내요.', ' data-term="callout"') +
              '</fieldset>' +
              '<hr class="st-hr" data-term="divider">' +
              '<section aria-labelledby="st-g3"><h3 id="st-g3" class="st-h">알림을 받는 계정</h3><dl class="st-dl" data-term="description-list">' +
                '<dt>이름</dt><dd>김민지</dd><dt>메일</dt><dd><span>minji@example.com</span><button type="button" class="u-btn st-copy" id="st-copy">복사</button></dd>' +
                '<dt>휴대폰</dt><dd>010-****-1234</dd><dt>마지막 변경</dt><dd>11월 26일</dd></dl><p class="st-note" id="st-note" role="status"></p></section>' +
            '</div>' +
            '<div class="st-sep" id="st-sep" role="separator" tabindex="0" aria-orientation="vertical" aria-label="설정과 미리보기 폭" aria-controls="st-left" data-term="split-view"><i></i></div>' +
            '<div class="st-right">' +
              '<div class="st-tools"><b>미리보기</b><div class="st-bg" role="toolbar" aria-label="미리보기 크기" id="st-bg" data-term="button-group">' +
                DEV.map(function (d, i) { return '<button type="button" data-dev="' + d[0] + '" aria-pressed="' + (d[0] === st.dev) + '" tabindex="' + (d[0] === st.dev ? 0 : -1) + '">' + d[1] + '</button>'; }).join('') + '</div></div>' +
              '<div class="st-stage"><div class="st-mail" id="st-mail"></div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="scr-labels" id="st-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); }, scr = root.querySelector('.st-scr'), split = $('st-split'), sep = $('st-sep'), left = $('st-left');

    // 오른쪽 미리보기: 켠 받는 곳과 알림 종류, 방해 금지
    function preview() {
      var dev = DEV.filter(function (d) { return d[0] === st.dev; })[0], chans = CH.filter(function (c) { return st.ch[c[0]]; }).map(function (c) { return c[1]; });
      var list = KIND.filter(function (k) { return st.kinds[k[0]]; });
      $('st-mail').style.maxWidth = dev[2] ? dev[2] + 'px' : 'none';
      $('st-mail').innerHTML = '<div class="st-mh"><b>작업함 알림</b><small>' + (chans.length ? chans.join('·') + '로 받아요' : '받는 곳을 모두 껐어요') + '</small></div>' +
        (list.length ? '<ul>' + list.map(function (k) { return '<li><i></i><span><b>' + k[1] + '</b> ' + esc(k[2]) + '</span></li>'; }).join('') + '</ul>' : '') +
        '<p class="st-mq">' + (st.quiet === '끔' ? (st.weekend ? '주말에는 하루 종일' : '방해 금지 없이 늘 보내요') : st.quiet + '에는' + (st.weekend ? '(주말은 하루 종일)' : '')) + (st.quiet === '끔' && !st.weekend ? '' : ' 앱 푸시와 문자를 보내지 않아요') + '</p>';
    }
    // 가름대: 왼쪽 폭(px). 양쪽 최소 MIN
    function maxW() { return split.clientWidth - sep.offsetWidth - MIN; }
    function setW(w) {
      if (split.clientWidth < 2 * MIN + 8) return;   // 좁은 화면은 위아래로 쌓여 가름대가 없다
      st.w = Math.round(Math.max(MIN, Math.min(maxW(), w)));
      split.style.gridTemplateColumns = st.w + 'px 8px minmax(0, 1fr)';
      sepVals(st.w);
      if (st.labels) drawLabels();
    }
    // 가름대 값(초점을 받는 separator는 aria-valuenow가 있어야 한다). 끌기 전에도 지금 폭으로
    function sepVals(w) {
      sep.setAttribute('aria-valuemin', MIN); sep.setAttribute('aria-valuemax', Math.round(maxW())); sep.setAttribute('aria-valuenow', Math.round(w));
      sep.setAttribute('aria-valuetext', '설정 칸 ' + Math.round(w) + 'px');
    }
    sepVals(left.offsetWidth);
    var drag = null;
    sep.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, w: left.offsetWidth }; sep.setPointerCapture(e.pointerId); sep.classList.add('on'); e.preventDefault(); });
    sep.addEventListener('pointermove', function (e) { if (drag) setW(drag.w + e.clientX - drag.x); });
    function endDrag() { drag = null; sep.classList.remove('on'); }
    sep.addEventListener('pointerup', endDrag); sep.addEventListener('pointercancel', endDrag);
    sep.addEventListener('keydown', function (e) {
      var w = left.offsetWidth, k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') {
        e.preventDefault();
        setW(k === 'ArrowLeft' ? w - STEP : k === 'ArrowRight' ? w + STEP : k === 'Home' ? MIN : maxW());
      }
    });
    // 단추 묶음: 하나만 켜짐, 묶음 안은 화살표 키로
    var bg = $('st-bg'), bbs = [].slice.call(bg.querySelectorAll('button'));
    function pickDev(d, focus) {
      st.dev = d;
      bbs.forEach(function (b) { var on = b.getAttribute('data-dev') === d; b.setAttribute('aria-pressed', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      preview(); if (st.labels) later(drawLabels, 30);
    }
    bg.addEventListener('keydown', function (e) {
      var i = bbs.indexOf(document.activeElement); if (i < 0) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? bbs.length - 1 : null;
      if (n == null) return;
      e.preventDefault(); n = (n + bbs.length) % bbs.length; pickDev(bbs[n].getAttribute('data-dev'), true);
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button, a');
      if (!b || !root.contains(b)) return;
      if (b.closest('#st-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.tagName === 'A') { e.preventDefault(); return; }
      if (b.hasAttribute('data-sw')) {
        var k = b.getAttribute('data-sw'), on = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', on);
        if (k === 'weekend') st.weekend = on; else st.ch[k] = on;
        preview(); return;
      }
      if (b.hasAttribute('data-kind')) {
        var kk = b.getAttribute('data-kind');
        if (b.getAttribute('aria-disabled') === 'true') { $('st-note').textContent = '보안 알림은 끌 수 없어요.'; return; }
        st.kinds[kk] = !st.kinds[kk]; b.setAttribute('aria-pressed', st.kinds[kk]); preview(); return;
      }
      if (b.hasAttribute('data-dev')) { pickDev(b.getAttribute('data-dev')); return; }
      if (b.id === 'st-copy') {
        var note = $('st-note');
        (navigator.clipboard ? navigator.clipboard.writeText('minji@example.com') : Promise.reject())
          .then(function () { note.textContent = '메일 주소를 복사했어요.'; }, function () { note.textContent = '복사하지 못했어요. 브라우저가 클립보드를 막았어요.'; });
      }
    });
    $('st-quiet').addEventListener('change', function () { st.quiet = this.value; preview(); });
    left.addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('st-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var top = left.getBoundingClientRect().top;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) {
        return id === 'overscroll-behavior' ? 'in-br' : id === 'button-group' || id === 'toggle-switch' || id === 'select' || id === 'fieldset' || id === 'divider' ? 'right' : '';
      }, function (el) { return left.contains(el) && el !== left && el.getBoundingClientRect().top < top - 1; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { if (st.w) setW(st.w); else { sepVals(left.offsetWidth); drawLabels(); } }
    window.addEventListener('resize', onResize);
    preview();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        var el = { 'divider': '.st-hr', 'description-list': '.st-dl', 'callout': '.st-fs [data-term="callout"]', 'fieldset': '.st-fs', 'chip-group': '.st-chips' }[id];
        if (el) { var t = root.querySelector(el); left.scrollTop += t.getBoundingClientRect().top - left.getBoundingClientRect().top - 24; }
        else if (id === 'grouped-list' || id === 'toggle-switch' || id === 'select') left.scrollTop = 0;
        later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
