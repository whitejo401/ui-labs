/* 조합 화면: 신청·설정. 용어 11개를 한 화면에 엮는다 (recipes.json의 request-form)
   UI.screens['request-form'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var STEPS = ['기본 정보', '첨부', '설정 확인'], LIMIT = 10 * 1024 * 1024;
  var NOTIFY = [['all', '모두', '모든 결제·정산 소식을 알립니다.'], ['mention', '멘션만', '나를 부르거나 내 신청이 바뀔 때만 알립니다.'], ['off', '끔', '알림을 보내지 않습니다. 화면 안 배지는 남습니다.']];
  var EXAMPLES = [['사업자등록증.pdf', 1.2], ['통장 사본.jpg', 3.4], ['계약서 스캔.pdf', 14]];

  UI.screens['request-form'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var st = { step: 0, done: false, labels: false, company: '', email: '', touched: {}, files: [], notify: 'mention', sw: { mail: true, sms: false }, swSaving: {}, smsFailed: false, open: { 0: false, 1: false, 2: false }, agree: false, busy: false };
    var timers = [], stops = [], fid = 0;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function tween(dur, fn) {
      var start = performance.now(), raf = null, tm = null;
      function stop() { cancelAnimationFrame(raf); clearTimeout(tm); }
      (function step() { stop(); var p = Math.min(1, (performance.now() - start) / dur); fn(p); if (p < 1) { raf = requestAnimationFrame(step); tm = setTimeout(step, 50); } })();
      stops.push(stop);
    }
    function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
    function size(mb) { return mb >= 1 ? mb.toFixed(1) + 'MB' : Math.round(mb * 1024) + 'KB'; }

    root.innerHTML =
      '<div class="u scr">' +
        '<aside class="u-side"><div class="u-logo"><i></i>작업함</div><span class="u-navlabel">작업</span><ul class="u-nav">' +
          ['이슈', '보드', '대시보드', '설정'].map(function (n, i) { return '<li><a href="#"' + (i === 3 ? ' aria-current="page"' : '') + '>' + UI.navIcon(i) + n + '</a></li>'; }).join('') + '</ul></aside>' +
        '<div class="rf-main" id="rf-main">' +
          '<div class="rf-head"><h2>결제 연동 신청</h2><p>세 단계로 신청합니다. 적은 내용은 신청 전까지 이 화면에만 남습니다.</p></div>' +
          '<ol class="rf-steps" id="rf-steps" data-term="stepper" aria-label="신청 단계"></ol>' +
          '<form class="rf-body" id="rf-body" novalidate></form>' +
          '<div class="rf-foot" id="rf-foot"></div>' +
        '</div>' +
        '<div class="scr-layer center off" id="rf-modal" data-term="modal-dialog"><div class="u-shade"></div>' +
          '<div class="u-dlg rf-dlg" role="dialog" aria-modal="true" aria-labelledby="rf-mt"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 id="rf-mt">결제 연동 약관</h3><button type="button" class="u-icon" data-act="mclose" aria-label="닫기">×</button></div>' +
          '<div class="rf-terms"><p>1. 연동한 결제는 영업일 기준 이틀 뒤 정산합니다.</p><p>2. 환불은 결제한 수단으로만 돌려줍니다.</p><p>3. 결제 정보는 정산이 끝나고 5년 동안 보관합니다.</p><p>4. 한도를 넘는 결제는 승인하지 않습니다.</p></div>' +
          '<div class="acts"><button type="button" class="u-btn" data-act="mclose">닫기</button><button type="button" class="u-btn primary" data-act="magree">동의하고 닫기</button></div></div></div>' +
        '<div class="scr-toasts" id="rf-toasts" aria-live="polite"></div>' +
        '<div class="u-tip sd-tip off" id="rf-tip" role="tooltip"></div>' +
        '<div class="scr-labels" id="rf-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr');

    /* ── 단계마다 빠진 것 ── */
    function missing(step) {
      var m = [];
      if (step === 0) { if (!st.company.trim()) m.push('회사 이름'); if (!emailOk(st.email)) m.push('이메일'); }
      if (step === 1) { if (!st.files.some(function (f) { return !f.err && f.p >= 1; })) m.push('다 올라간 파일 하나'); }
      if (step === 2) { if (!st.agree) m.push('약관 동의'); }
      return m;
    }

    /* ── 입력칸의 상태: 한 번 벗어난 칸만 오류를 보인다 ── */
    function fieldView(k) {
      if (k === 'company') {
        var cb = !!st.touched.company && !st.company.trim();
        return { bad: cb, cls: cb ? ' bad' : '', help: cb ? '회사 이름을 적어 주세요' : '사업자등록증에 적힌 이름 그대로 적어 주세요' };
      }
      var t = !!st.touched.email, empty = t && !st.email, wrong = t && st.email && !emailOk(st.email), ok = !!st.email && emailOk(st.email);
      return { bad: !!(empty || wrong), cls: empty || wrong ? ' bad' : ok ? ' good' : '',
        help: empty ? '이메일을 적어 주세요' : wrong ? 'example@company.com 형식으로 적어 주세요' : ok ? '✓ 확인됐습니다' : '칸을 벗어나면 형식을 확인합니다' };
    }
    // 칸을 다시 그리지 않고 테두리와 안내 문구만 바꾼다. 다시 그리면 커서 자리를 잃는다(type=email은 커서 위치를 알려 주지 않는다)
    function updateField(k) {
      var v = fieldView(k), inp = $('rf-' + k), help = $('rf-' + k + '-h');
      if (!inp || !help) return;
      inp.className = 'rf-input' + v.cls; inp.setAttribute('aria-invalid', String(v.bad));
      help.className = 'rf-help' + v.cls; help.textContent = v.help;
    }

    /* ── 그리기 ── */
    function renderSteps() {
      $('rf-steps').innerHTML = STEPS.map(function (n, i) {
        var state = st.done || i < st.step ? 'done' : i === st.step ? 'cur' : 'todo';
        return (i ? '<li class="rf-ln" aria-hidden="true"><i style="transform:scaleX(' + (st.done || i <= st.step ? 1 : 0) + ')"></i></li>' : '') +
          '<li class="rf-st ' + state + '"><button type="button" data-go="' + i + '"' + (state === 'done' && !st.done ? '' : ' disabled') + (state === 'cur' ? ' aria-current="step"' : '') + '><b>' + (state === 'done' ? '✓' : i + 1) + '</b><span>' + n + '</span></button></li>';
      }).join('');
    }
    function fileRows() {
      return st.files.map(function (f, i) {
        return '<div class="rf-file"><div class="row"><span>' + esc(f.name) + ' <span class="sz">' + size(f.mb) + '</span></span>' +
          '<span class="stt' + (f.err ? ' err' : f.p >= 1 ? ' ok' : '') + '">' + (f.err ? '10MB를 넘습니다' : f.p >= 1 ? '✓ 완료' : Math.round(f.p * 100) + '%') + '</span>' +
          '<button type="button" class="u-icon" data-rm="' + f.id + '" aria-label="' + esc(f.name) + ' 빼기">×</button></div>' +
          (f.err || f.p >= 1 ? '' : '<span class="rf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(f.p * 100) + '" aria-label="' + esc(f.name) + ' 올리는 중"' + (i === firstBar() ? ' data-term="progress-bar"' : '') + '><i style="width:' + (f.p * 100) + '%"></i></span>') + '</div>';
      }).join('');
    }
    function firstBar() { for (var i = 0; i < st.files.length; i++) if (!st.files[i].err && st.files[i].p < 1) return i; return -1; }
    function renderBody() {
      var b = $('rf-body'), h = '';
      if (st.done) h = '<div class="u-empty rf-done"><span class="ok">✓</span><b>신청이 접수됐습니다</b><span>검토가 끝나면 ' + esc(st.email) + '로 알려 드립니다. 보통 영업일 이틀 걸립니다.</span><button type="button" class="u-btn" data-act="restart">처음부터 다시</button></div>';
      else if (st.step === 0) {
        var c = fieldView('company'), m = fieldView('email');
        h = '<div class="rf-field" data-term="text-field"><label for="rf-company">회사 이름 <span class="req">*</span></label><input id="rf-company" class="rf-input' + c.cls + '" value="' + esc(st.company) + '" autocomplete="organization" aria-describedby="rf-company-h" aria-invalid="' + c.bad + '">' +
            '<span class="rf-help' + c.cls + '" id="rf-company-h">' + c.help + '</span></div>' +
          '<div class="rf-field" data-term="inline-validation"><label for="rf-email">알림 받을 이메일 <span class="req">*</span></label><input id="rf-email" type="email" class="rf-input' + m.cls + '" value="' + esc(st.email) + '" autocomplete="email" aria-describedby="rf-email-h" aria-invalid="' + m.bad + '">' +
            '<span class="rf-help' + m.cls + '" id="rf-email-h" role="status">' + m.help + '</span></div>';
      } else if (st.step === 1) {
        h = '<div class="rf-drop" id="rf-drop" data-term="file-drop-zone" tabindex="0" role="button" aria-label="파일 올리기. 누르거나 파일을 끌어 오세요"><b>파일을 여기로 끌어 오세요</b><span>또는 눌러서 고르기 · 여러 개 · 10MB까지</span><input type="file" id="rf-file" multiple hidden></div>' +
          '<div class="rf-files" id="rf-files">' + fileRows() + '</div><div><button type="button" class="u-btn" data-act="examples">예시 파일 넣기</button></div>';
      } else {
        h = '<fieldset class="rf-radio" data-term="radio-group"><legend>알림 받기</legend><div role="radiogroup" aria-label="알림 받기">' + NOTIFY.map(function (n) {
              var on = st.notify === n[0];
              return '<label><input type="radio" name="rf-notify" value="' + n[0] + '"' + (on ? ' checked' : '') + '><span>' + n[1] + '</span></label>';
            }).join('') + '</div><p class="rf-help">' + NOTIFY.filter(function (n) { return n[0] === st.notify; })[0][2] + '</p></fieldset>' +
          '<div class="rf-sws">' + [['mail', '메일 알림', '정산과 환불 결과를 메일로 받습니다'], ['sms', '문자 알림', '결제 실패만 문자로 받습니다']].map(function (s, i) {
              return '<div class="rf-sw"' + (i ? '' : ' data-term="toggle-switch"') + '><span><b>' + s[1] + '</b><br><span class="rf-help">' + (st.swSaving[s[0]] ? '저장 중…' : s[2]) + '</span></span>' +
                '<button type="button" role="switch" class="u-switch" aria-checked="' + !!st.sw[s[0]] + '" data-sw="' + s[0] + '" aria-label="' + s[1] + '"><i></i></button></div>';
            }).join('') + '</div>' +
          '<div class="rf-acc" data-term="accordion">' + [['결제 한도', '한 번에 500만 원, 하루에 3,000만 원까지 결제를 받습니다. 바꾸려면 담당자에게 요청해 주세요.'], ['웹훅 주소', '결제와 환불이 끝나면 https://example.com/hooks/pay 로 알립니다. 신청 뒤 설정에서 바꿀 수 있습니다.'], ['정산 주기', '영업일 기준 이틀 뒤 등록한 계좌로 보냅니다. 주 단위 정산은 따로 신청합니다.']].map(function (a, i) {
              var o = st.open[i];
              return '<div class="ai"><button type="button" class="ah" aria-expanded="' + o + '" aria-controls="rf-ap' + i + '" data-acc="' + i + '">' + a[0] + '<span class="ar">›</span></button><div class="ap" id="rf-ap' + i + '" style="height:' + (o ? 'auto' : '0px') + '"><p>' + esc(a[1]) + '</p></div></div>';
            }).join('') + '</div>' +
          '<label class="rf-agree"><input type="checkbox" id="rf-agree"' + (st.agree ? ' checked' : '') + '> 결제 연동 약관에 동의합니다 <span class="req">*</span> <button type="button" class="rf-link" data-act="mopen">약관 전문 보기</button></label>';
      }
      b.innerHTML = h;
      later(drawLabels, 30);
    }
    function renderFoot() {
      var m = st.done ? [] : missing(st.step), last = st.step === STEPS.length - 1;
      $('rf-foot').innerHTML = st.done ? '' :
        '<button type="button" class="u-btn" data-act="prev"' + (st.step ? '' : ' hidden') + '>이전</button><span style="flex:1"></span>' +
        '<button type="button" class="u-btn primary rf-next" id="rf-next" data-term="loading-button" aria-disabled="' + (m.length > 0) + '"' + (m.length ? ' data-why="' + esc(m.join(', ')) + '"' : '') + '>' + (last ? '신청하기' : '다음') + '</button>';
      later(drawLabels, 30);
    }
    function render() { renderSteps(); renderBody(); renderFoot(); }
    function refreshFoot() { var f = document.activeElement && document.activeElement.id === 'rf-next'; renderFoot(); if (f) $('rf-next').focus(); }

    /* ── 파일 ── */
    function addFiles(list) {
      list.forEach(function (x) {
        var f = { id: ++fid, name: x.name, mb: x.mb, p: 0, err: x.mb * 1024 * 1024 > LIMIT };
        st.files.push(f);
        if (!f.err) {
          var dur = reduce ? 300 : 900 + x.mb * 300;
          tween(dur, function (p) {
            f.p = p;
            var row = $('rf-files'); if (!row) return;
            if (p >= 1) { row.innerHTML = fileRows(); refreshFoot(); return; }
            var bar = row.querySelector('[data-rm="' + f.id + '"]'); if (!bar) return;
            var wrap = bar.closest('.rf-file'), i = wrap.querySelector('.rf-bar i'), s = wrap.querySelector('.stt');
            if (i) { i.style.width = (p * 100) + '%'; i.parentNode.setAttribute('aria-valuenow', Math.round(p * 100)); }
            if (s) s.textContent = Math.round(p * 100) + '%';
          });
        }
      });
      $('rf-files').innerHTML = fileRows(); refreshFoot();
    }

    /* ── 스위치: 누르는 즉시 저장, 문자 알림은 처음 한 번 저장에 실패해 되돌린다 ── */
    function toggle(k) {
      if (st.swSaving[k]) return;
      var before = st.sw[k]; st.sw[k] = !before; st.swSaving[k] = true; renderBody();
      var b = root.querySelector('[data-sw="' + k + '"]'); if (b) b.focus();
      later(function () {
        st.swSaving[k] = false;
        if (k === 'sms' && !st.smsFailed) { st.smsFailed = true; st.sw[k] = before; toast('문자 알림을 저장하지 못해 원래대로 돌렸습니다. 다시 눌러 주세요.'); }
        if (st.step === 2 && !st.done) { renderBody(); var b2 = root.querySelector('[data-sw="' + k + '"]'); if (b2 && document.activeElement === document.body) b2.focus(); }
      }, 600);
    }
    function toast(msg) {
      var el = document.createElement('div');
      el.className = 'u-toast off'; el.setAttribute('role', 'status');
      el.innerHTML = '<span class="dot err"></span><span>' + esc(msg) + '</span>';
      $('rf-toasts').appendChild(el);
      requestAnimationFrame(function () { el.classList.remove('off'); }); later(function () { el.classList.remove('off'); }, 60);
      later(function () { el.classList.add('off'); later(function () { el.remove(); }, 220); }, 4000);
    }

    /* ── 아코디언 ── */
    function setAcc(i, open) {
      st.open[i] = open;
      var p = $('rf-ap' + i), h = root.querySelector('[data-acc="' + i + '"]');
      if (!p) return;
      h.setAttribute('aria-expanded', String(open));
      var full = p.scrollHeight;
      if (reduce) { p.style.height = open ? 'auto' : '0px'; return; }
      p.style.height = (open ? 0 : full) + 'px'; void p.offsetHeight;
      p.style.height = (open ? full : 0) + 'px';
      later(function () { if (st.open[i]) p.style.height = 'auto'; drawLabels(); }, 260);
    }

    /* ── 약관 창 (Modal Dialog): 초점은 창 안에서만, Esc와 ×로 닫기 ── */
    var lastFocus = null;
    function openModal() { lastFocus = document.activeElement; $('rf-modal').classList.remove('off'); root.querySelector('#rf-modal [data-act="magree"]').focus(); later(drawLabels, 220); }
    function closeModal() { $('rf-modal').classList.add('off'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); later(drawLabels, 220); }
    $('rf-modal').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab') return;
      var f = [].slice.call($('rf-modal').querySelectorAll('button')), i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    });

    /* ── 꺼진 단추의 이유 (Disabled + Tooltip) ── */
    function showWhy(btn) {
      var why = btn.getAttribute('data-why'); if (!why) return;
      var tip = $('rf-tip'), a = scr.getBoundingClientRect(), r = btn.getBoundingClientRect();
      tip.textContent = '채울 칸: ' + why; tip.classList.remove('off');
      tip.style.left = Math.max(4, Math.min(a.width - tip.offsetWidth - 4, r.left - a.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = (r.top - a.top - tip.offsetHeight - 8) + 'px';
      drawLabels();
    }
    function hideWhy() { $('rf-tip').classList.add('off'); later(drawLabels, 120); }

    /* ── 다음·신청 (Loading Button) ── */
    function next() {
      var nb = $('rf-next');
      if (!nb || st.busy) return;
      if (nb.getAttribute('aria-disabled') === 'true') { showWhy(nb); return; }
      st.busy = true; hideWhy();
      var w = nb.offsetWidth; nb.style.width = w + 'px';
      nb.innerHTML = UI.spinHTML(14, 'run').replace('aria-label="불러오는 중"', 'aria-label="처리 중"'); nb.setAttribute('aria-busy', 'true');
      var sp = nb.querySelector('.u-spin'); sp.style.borderColor = 'rgb(255 255 255 / 35%)'; sp.style.borderTopColor = 'var(--u-accent-ink)';
      later(function () {
        st.busy = false;
        if (st.step === STEPS.length - 1) { st.done = true; render(); $('rf-main').scrollTop = 0; var r = root.querySelector('[data-act="restart"]'); if (r) r.focus(); return; }
        nb.innerHTML = '✓';
        later(function () { st.step++; render(); var first = $('rf-body').querySelector('input, [tabindex="0"], button'); if (first) first.focus(); }, 300);
      }, st.step === STEPS.length - 1 ? 1100 : 600);
    }

    /* ── 사건 ── */
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'rf-company') { st.company = t.value; if (st.touched.company) updateField('company'); refreshFoot(); }
      if (t.id === 'rf-email') { st.email = t.value.trim(); if (st.touched.email) updateField('email'); refreshFoot(); }
    });
    // 칸을 벗어나면 그때부터 검사한다. 이미 오류를 보인 칸은 고치는 즉시 다시 검사한다(위 input)
    root.addEventListener('focusout', function (e) {
      var t = e.target;
      if (t.id === 'rf-company' || t.id === 'rf-email') {
        var k = t.id === 'rf-company' ? 'company' : 'email';
        st.touched[k] = true; updateField(k);
      }
      if (t.id === 'rf-next') hideWhy();
    });
    root.addEventListener('focusin', function (e) { if (e.target.id === 'rf-next' && e.target.getAttribute('aria-disabled') === 'true') showWhy(e.target); });
    root.addEventListener('mouseover', function (e) { var b = e.target.closest('#rf-next'); if (b && b.getAttribute('aria-disabled') === 'true') showWhy(b); });
    root.addEventListener('mouseout', function (e) { var b = e.target.closest('#rf-next'); if (b && !b.contains(e.relatedTarget)) hideWhy(); });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'rf-notify') { st.notify = t.value; renderBody(); var r = root.querySelector('input[name="rf-notify"][value="' + t.value + '"]'); if (r) r.focus(); }
      if (t.id === 'rf-agree') { st.agree = t.checked; refreshFoot(); }
      if (t.id === 'rf-file') { addFiles([].map.call(t.files, function (f) { return { name: f.name, mb: f.size / 1048576 }; })); t.value = ''; }
    });
    root.addEventListener('submit', function (e) { e.preventDefault(); next(); });
    root.addEventListener('keydown', function (e) {
      if (e.target.id === 'rf-drop' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('rf-file').click(); }
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('rf-input')) { e.preventDefault(); next(); }
    });
    root.addEventListener('dragover', function (e) { var d = e.target.closest && e.target.closest('#rf-drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    root.addEventListener('dragleave', function (e) { var d = e.target.closest && e.target.closest('#rf-drop'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('over'); });
    root.addEventListener('drop', function (e) {
      var d = e.target.closest && e.target.closest('#rf-drop'); if (!d) return;
      e.preventDefault(); d.classList.remove('over');
      addFiles([].map.call(e.dataTransfer.files || [], function (f) { return { name: f.name, mb: f.size / 1048576 }; }));
    });
    root.addEventListener('click', function (e) {
      var el = e.target.closest('button, a, #rf-drop');
      if (e.target.classList.contains('u-shade')) return; // 약관 창은 바깥을 눌러도 닫지 않는다
      if (!el || !root.contains(el)) return;
      if (el.closest('#rf-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.tagName === 'A') { e.preventDefault(); return; }
      if (el.id === 'rf-drop') { $('rf-file').click(); return; }
      var v;
      if ((v = el.getAttribute('data-go'))) { if (!el.disabled) { st.step = +v; render(); } return; }
      if ((v = el.getAttribute('data-sw'))) { toggle(v); return; }
      if ((v = el.getAttribute('data-acc'))) { setAcc(+v, !st.open[+v]); return; }
      if ((v = el.getAttribute('data-rm'))) { st.files = st.files.filter(function (f) { return f.id !== +v; }); $('rf-files').innerHTML = fileRows(); refreshFoot(); return; }
      if (el.id === 'rf-next') { next(); return; }
      switch (el.getAttribute('data-act')) {
        case 'prev': st.step = Math.max(0, st.step - 1); render(); break;
        case 'examples': addFiles(EXAMPLES.map(function (x) { return { name: x[0], mb: x[1] }; })); break;
        case 'mopen': e.preventDefault(); openModal(); break;
        case 'mclose': closeModal(); break;
        case 'magree': st.agree = true; closeModal(); renderBody(); refreshFoot(); break;
        case 'restart': st = Object.assign(st, { step: 0, done: false, company: '', email: '', touched: {}, files: [], agree: false }); render(); break;
      }
    });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('rf-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      // 꺼진 "다음" 단추는 Disabled로도 이름표를 붙인다
      var nb = $('rf-next'), alt = nb && nb.getAttribute('aria-disabled') === 'true';
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return id === 'loading-button' ? 'right' : ''; });
      if (alt) {
        var a = scr.getBoundingClientRect(), r = nb.getBoundingClientRect();
        L.insertAdjacentHTML('beforeend', '<button type="button" data-id="disabled" style="left:' + (r.left - a.left - 6) + 'px;top:' + (r.top - a.top + r.height / 2) + 'px;transform:translate(-100%,-50%)">' + esc(opt.termName('disabled')) + '</button>');
        seen.push('disabled');
      }
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { drawLabels(); }
    window.addEventListener('resize', onResize);
    $('rf-main').addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    render();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        var goStep = { 'text-field': 0, 'inline-validation': 0, 'file-drop-zone': 1, 'progress-bar': 1, 'radio-group': 2, 'toggle-switch': 2, 'accordion': 2, 'modal-dialog': 2 }[id];
        if (goStep != null && (st.step !== goStep || st.done)) { st.done = false; st.step = goStep; render(); }
        if (id === 'progress-bar') addFiles([{ name: '정산 계좌 확인서.pdf', mb: 4.8 }]);
        else if (id === 'modal-dialog') openModal();
        else if (id === 'disabled') { st.agree = false; if (st.done) { st.done = false; } render(); }
        else if (id === 'inline-validation') { st.email = 'minji@examp'; st.touched.email = true; render(); }
        else if (id === 'stepper') { st.done = false; render(); }
        later(drawLabels, 80);
      },
      destroy: function () { timers.forEach(clearTimeout); stops.forEach(function (f) { f(); }); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
