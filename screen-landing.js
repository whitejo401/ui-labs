/* 조합 화면: 제품 소개 랜딩. 소개·랜딩 효과를 "작업함" 소개 페이지 하나에 엮는다 (recipes.json의 landing)
   꼴은 시안 "밤 빛"(늘 어두움). 본문은 틀 안에서 스크롤되고, 스크롤 효과는 그 틀을 기준으로 한다
   UI.screens['landing'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc;
  var TITLE = '쌓이는 일을 한 화면에서 정리하세요', SHINE = '한 화면에서';
  var LOGOS = ['모래상회', '북극제작소', '다온랩', '푸른창고', '온새미로', '해밀출판', '바람공방', '세모스튜디오'];
  var STEPS = [
    ['01', '어디서든 찾기', 'Ctrl K 한 번으로 이슈, 사람, 명령을 바로 찾아요. 손을 마우스로 옮기지 않아도 돼요.'],
    ['02', '한 번에 바꾸기', '여러 이슈를 골라 상태와 담당자를 한꺼번에 바꿔요. 하나씩 열 필요가 없어요.'],
    ['03', '5초 되돌리기', '지워도 괜찮아요. 알림에 뜨는 되돌리기를 5초 안에 누르면 그대로 돌아와요.']
  ];
  var INTEG = [
    ['#', '메신저', '새 이슈와 댓글을 팀 채널로 보내요', ['연결할 채널을 고르면 끝', '멘션된 사람에게만 따로 알림', '채널 메시지에서 바로 상태 바꾸기']],
    ['31', '달력', '마감일을 팀 달력에 띄워요', ['개인 달력이나 팀 달력 고르기', '마감일을 바꾸면 달력도 같이', '마감 하루 전 알림']],
    ['</>', '코드 저장소', '커밋 메시지로 이슈를 닫아요', ['저장소 연결', '커밋에 "닫음 #123"을 쓰면 이슈가 완료로', '변경 내역이 이슈 기록에 남음']]
  ];
  var STATS = [['쓰는 팀', 1240, '곳'], ['옮겨 온 이슈', 384210, '건'], ['줄어든 회의 시간', 31, '%']];
  var QUOTE = '“아침마다 하던 30분짜리 현황 회의가 없어졌어요. 다들 보드만 보면 되니까요.”';
  var PZ = { stop: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>' };
  // 셰이더: 사인파 두 겹으로 보라·청록 빛이 흐른다. 색은 밤 빛 꼴에 고정
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = 'precision mediump float;uniform vec2 r;uniform float t;' +
    'void main(){vec2 p=gl_FragCoord.xy/r;p.x*=r.x/r.y*.6;' +
    'float a=sin(p.x*3.1+t*.35+sin(p.y*2.3+t*.21)*1.7);float b=sin(p.y*3.7-t*.27+sin(p.x*2.6-t*.17)*1.4);' +
    'float m=smoothstep(-.6,1.,a)*(.35+.65*p.y);float n=smoothstep(-.1,1.,b)*(1.-p.y*.5);' +
    'vec3 c=mix(vec3(.027,.031,.051),vec3(.357,.247,.94),m*.9);c=mix(c,vec3(.059,.71,.659),n*.75);gl_FragColor=vec4(c,1.);}';

  function mocks() {
    return '<div class="ld-mock on"><div class="q">⌕ 결제 오류<span class="c"></span><span style="margin-left:auto;color:var(--u-muted)">Ctrl K</span></div>' +
        '<div class="r hi">#1182 결제 오류 메시지가 두 번 뜸</div><div class="r">#1179 결제 수단 목록 정렬</div><div class="r">명령: 결제 오류 이슈 모두 보기</div></div>' +
      '<div class="ld-mock">' + ['#1182 결제 오류 메시지', '#1180 환불 내역 내보내기', '#1177 영수증 글꼴', '#1171 로그인 유지 기간'].map(function (t, i) {
        return '<div class="r' + (i < 3 ? ' hi' : '') + '"><i class="' + (i < 3 ? 'ck' : '') + '"></i>' + t + '</div>';
      }).join('') + '<div class="bulk">3개 골랐어요<span>상태 바꾸기 ▾</span></div></div>' +
      '<div class="ld-mock"><div class="r">#1180 환불 내역 내보내기</div><div class="r">#1177 영수증 글꼴</div>' +
        '<div class="toast">이슈 3개를 지웠어요<u>되돌리기</u><s></s></div></div>';
  }

  UI.screens['landing'] = function (root, opt) {
    // 제목 글꼴 Space Grotesk는 이 화면에서만 쓰므로 이 화면을 열 때 부른다(도감 첫 화면 글꼴 줄이기)
    if (!document.getElementById('font-landing')) { var fl = document.createElement('link'); fl.id = 'font-landing'; fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap'; document.head.appendChild(fl); }
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)'), hover = window.matchMedia('(hover: hover)').matches;
    var st = { labels: false, calm: mq.matches, paused: false, step: 0, detail: -1 };
    var timers = [], offs = [], ios = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); offs.push(function () { el.removeEventListener(ev, fn, o); }); }

    root.innerHTML =
      '<div class="u scr ld' + (st.calm ? ' calm' : '') + '">' +
        '<div class="ld-main" id="ld-main">' +
          '<header class="ld-nav" data-term="sticky-header"><div class="ld-glass" data-term="glass"><div class="ld-in">' +
            '<span class="ld-logo"><i></i>작업함</span>' +
            '<nav class="ld-links" aria-label="소개 메뉴"><a href="#" data-go="ld-feat">기능</a><a href="#" data-go="ld-int">연동</a><a href="#" data-go="ld-price">요금</a></nav>' +
            '<button type="button" class="ld-pz" id="ld-pz" data-act="pz"></button>' +
            '<button type="button" class="ld-btn pri" data-join>무료로 시작</button>' +
          '</div></div><i class="ld-prog" id="ld-prog" data-term="scroll-progress"></i></header>' +

          '<section class="ld-hero" id="ld-hero" data-term="shader-background"><div class="bg" aria-hidden="true"></div><canvas id="ld-sh" aria-hidden="true"></canvas><div class="ld-in">' +
            '<span class="ld-eye">작은 팀을 위한 이슈 관리</span>' +
            '<h1 id="ld-h1" data-term="text-split-reveal" aria-label="' + TITLE + '"></h1>' +
            '<p class="ld-sub">이슈 목록, 보드, 대시보드를 한곳에. 설치 없이 오늘 바로 팀을 초대할 수 있어요.</p>' +
            '<div class="ld-cta"><button type="button" class="ld-btn pri" id="ld-mag" data-join data-term="magnetic-button">무료로 시작하기</button><a class="ld-btn" href="#" data-go="ld-feat">둘러보기</a></div>' +
          '</div></section>' +

          '<section class="ld-logos"><p>먼저 쓰고 있는 팀들</p><div class="ld-mq" tabindex="0" aria-label="쓰는 팀 이름, 올리거나 초점을 두면 멈춤" data-term="marquee"><div class="ld-track">' +
            LOGOS.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '<span class="dup" aria-hidden="true">' + LOGOS.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</span>' +
          '</div></div></section>' +

          '<section class="ld-sec" id="ld-feat"><div class="ld-in">' +
            '<div class="ld-head ld-rv" data-term="scroll-reveal"><span class="ld-eye">01 · 기능</span><h2>손이 덜 가는 세 가지</h2><p>매일 하는 일부터 줄였습니다. 스크롤하면 오른쪽 화면이 단계에 맞춰 바뀝니다.</p></div>' +
            '<div class="ld-story" data-term="sticky-scrollytelling"><div class="ld-steps">' + STEPS.map(function (s, i) {
              return '<div class="ld-step' + (i ? '' : ' on') + '" data-i="' + i + '"><b>' + s[0] + '</b><h3>' + s[1] + '</h3><p>' + s[2] + '</p></div>';
            }).join('') + '</div><div class="ld-panel" aria-hidden="true">' + mocks() + '</div></div>' +
          '</div></section>' +

          '<section class="ld-sec" id="ld-shot"><div class="ld-in">' +
            '<div class="ld-head ld-rv"><span class="ld-eye">02 · 화면</span><h2>한눈에 보는 팀의 오늘</h2><p>누가 무엇을 하고 있는지, 무엇이 막혔는지 목록 하나로 보여요.</p></div>' +
            '<div class="ld-stage"><div class="ld-win" data-term="scroll-driven-animation"><div class="bar"><i></i><i></i><i></i></div>' +
              [['#1182', '결제 오류 메시지가 두 번 뜸', '진행 중', ''], ['#1180', '환불 내역 내보내기', '검토', ''], ['#1177', '영수증 글꼴이 깨짐', '완료', 'ok'], ['#1171', '로그인 유지 기간 늘리기', '진행 중', ''], ['#1168', '알림 메일 제목 바꾸기', '완료', 'ok']].map(function (r) {
                return '<div class="ld-row"><span class="n">' + r[0] + '</span><span class="t">' + r[1] + '</span><span class="p ' + r[3] + '">' + r[2] + '</span></div>';
              }).join('') + '</div>' +
              '<div class="ld-float a" data-term="parallax"><b>새 댓글 3</b><small>#1182 · 방금 전</small></div>' +
              '<div class="ld-float b"><b>마감 D-2</b><small>결제 오류 수정</small></div>' +
            '</div>' +
          '</div></section>' +

          '<section class="ld-sec" id="ld-int"><div class="ld-in">' +
            '<div class="ld-head ld-rv"><span class="ld-eye">03 · 연동</span><h2>쓰던 도구와 그대로</h2><p>카드를 누르면 연결하는 법이 열립니다.</p></div>' +
            '<div class="ld-cards" data-term="view-transition">' + INTEG.map(function (c, i) {
              return '<button type="button" class="ld-card" data-int="' + i + '"' + (i === 0 ? ' data-term="spotlight-hover"' : i === 1 ? ' data-term="tilt-3d"' : '') + '>' +
                '<span class="ld-ch"' + (i === 2 ? ' data-term="shared-element-transition"' : '') + '><span class="ld-ic">' + esc(c[0]) + '</span><h3>' + c[1] + '</h3></span><p>' + c[2] + '</p><span class="more">연결하는 법 →</span></button>';
            }).join('') + '</div>' +
          '</div></section>' +

          '<section class="ld-sec ld-price" id="ld-price" data-term="dot-grid"><div class="ld-in">' +
            '<div class="ld-head ld-rv"><span class="ld-eye">04 · 요금</span><h2>팀이 커질 때만 내세요</h2><p>5명까지는 무료. 언제든 바꾸거나 그만둘 수 있어요.</p></div>' +
            '<div class="ld-plans">' +
              '<div class="ld-plan"><b>무료</b><div class="pr">0원</div><ul><li>5명까지</li><li>이슈 무제한</li><li>보드와 목록</li></ul><button type="button" class="ld-btn" data-join>시작하기</button></div>' +
              '<div class="ld-beam" data-term="border-beam"><div class="ld-plan"><span class="ld-tag">가장 많이 골라요</span><b>팀</b><div class="pr">9,900원 <small>/ 사람·월</small></div><ul><li>사람 수 제한 없음</li><li>대시보드와 보고서</li><li>기록 1년 보관</li></ul><button type="button" class="ld-btn pri" data-join>14일 써 보기</button></div></div>' +
              '<div class="ld-plan"><b>회사</b><div class="pr">문의</div><ul><li>로그인 연동(SSO)</li><li>권한 세분화</li><li>전담 지원</li></ul><button type="button" class="ld-btn" data-join>상담 요청</button></div>' +
            '</div>' +
          '</div></section>' +

          '<section class="ld-sec" id="ld-voice"><div class="ld-in">' +
            '<div class="ld-head ld-rv"><span class="ld-eye">05 · 후기</span><h2>먼저 옮겨 온 팀들</h2></div>' +
            '<div class="ld-stats" id="ld-stats">' + STATS.map(function (s, i) {
              return '<div' + (i ? '' : ' data-term="number-ticker"') + '><b><span id="ld-n' + i + '">0</span>' + s[2] + '</b><span>' + s[0] + '</span></div>';
            }).join('') + '</div>' +
            '<blockquote class="ld-q" id="ld-q" aria-label="' + QUOTE + '" data-term="typewriter"><span class="ghost" aria-hidden="true">' + QUOTE + '</span><span class="typed" id="ld-typed" aria-hidden="true"></span></blockquote>' +
            '<cite class="ld-cite">해밀출판 편집팀 리드</cite>' +
          '</div></section>' +

          '<section class="ld-final" data-term="aurora-gradient"><i class="ld-au a"></i><i class="ld-au b"></i><i class="ld-au c"></i><i class="ld-grain" data-term="grain"></i>' +
            '<h2>오늘 쌓인 일부터 옮겨 보세요</h2><p>가입하면 예시 이슈 12개가 들어 있는 작업함이 바로 열려요.</p><button type="button" class="ld-btn pri" data-join>무료로 시작하기</button></section>' +
          '<div class="ld-foot"><span>작업함 · 조합 화면용 가상 제품</span><label class="ld-calm" data-term="reduced-motion"><input type="checkbox" id="ld-calm"' + (st.calm ? ' checked' : '') + '> 동작 줄이기</label></div>' +
        '</div>' +
        '<form class="ld-pop" id="ld-pop" data-term="entry-animation" aria-label="작업함 시작하기"><button type="button" class="x" data-act="popx" aria-label="닫기">×</button>' +
          '<b>작업함 시작하기</b><small id="ld-popmsg">메일 주소만 있으면 돼요. 카드 등록은 없어요.</small>' +
          '<input type="email" id="ld-mail" placeholder="team@example.com" aria-label="메일 주소" autocomplete="off"><button type="submit" class="ld-btn pri">메일로 시작 링크 받기</button></form>' +
        '<div class="ld-detail" id="ld-detail" hidden></div>' +
        '<div class="scr-labels" id="ld-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var scr = root.querySelector('.scr'), main = $('ld-main');

    /* ── 제목 나눔 (Text Split Reveal): 단어 단위, 원문은 aria-label. 반짝임은 안쪽 칸에 따로 걸어 두 애니메이션이 겹치지 않게 ── */
    function splitTitle() {
      var h = $('ld-h1'), i = 0;
      h.innerHTML = TITLE.replace(SHINE, '\u0000').split(' ').map(function (w) {
        return '<span class="ld-w" style="--i:' + (i++) + '" aria-hidden="true">' + (w === '\u0000' ? '<span class="ld-shine" data-term="shine-text">' + SHINE + '</span>' : w) + '</span>';
      }).join(' ');
      h.classList.remove('ld-split'); void h.offsetWidth; h.classList.add('ld-split');
    }

    /* ── 셰이더 배경: 처음엔 정지 그라디언트, 첫 입력 뒤 WebGL을 켠다. 해상도 절반, 화면 밖·숨은 탭·멈춤·동작 줄이기에서는 그리지 않는다 ── */
    var cv = $('ld-sh'), gl = null, ur = null, ut = null, raf = 0, tAcc = 0, last = 0, heroIn = true, started = false;
    function initGL() {
      if (started || st.calm) return;
      started = true;
      gl = cv.getContext('webgl', { antialias: false });
      if (!gl) return;
      var pr = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]].forEach(function (s) { var sh = gl.createShader(s[0]); gl.shaderSource(sh, s[1]); gl.compileShader(sh); gl.attachShader(pr, sh); });
      gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      ur = gl.getUniformLocation(pr, 'r'); ut = gl.getUniformLocation(pr, 't');
      draw(); cv.classList.add('on'); kick();
    }
    function draw() {
      var w = Math.max(1, Math.round(cv.clientWidth * 0.5)), h = Math.max(1, Math.round(cv.clientHeight * 0.5));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(ur, w, h); gl.uniform1f(ut, tAcc); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function running() { return gl && !st.paused && !st.calm && heroIn && !document.hidden; }
    function frame(now) {
      raf = 0;
      if (!running()) { last = 0; return; }
      if (last) tAcc += Math.min(50, now - last) / 1000;
      last = now; draw(); raf = requestAnimationFrame(frame);
    }
    function kick() { if (running() && !raf) raf = requestAnimationFrame(frame); }
    ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (ev) { on(scr, ev, initGL, { passive: true }); });
    on(main, 'scroll', initGL, { passive: true });
    on(document, 'visibilitychange', kick);

    /* ── 화면에 들어오는 것 살피기 (스크롤 위치를 매번 재지 않는다) ── */
    function watch(els, fn, o) { var io = new IntersectionObserver(function (es) { es.forEach(fn); }, o); [].forEach.call(els, function (el) { io.observe(el); }); ios.push(io); return io; }
    watch([cv], function (e) { heroIn = e.isIntersecting; kick(); }, { root: main });
    // Sticky Scrollytelling: 틀 한가운데 띠에 들어온 단계를 지금 단계로
    watch(root.querySelectorAll('.ld-step'), function (e) { if (e.isIntersecting) setStep(+e.target.getAttribute('data-i')); }, { root: main, rootMargin: '-45% 0px -45% 0px' });
    // Scroll Reveal, Number Ticker, Typewriter: 처음 보일 때 한 번만
    var once = watch(root.querySelectorAll('.ld-rv, #ld-stats, #ld-q'), function (e) {
      if (!e.isIntersecting) return;
      once.unobserve(e.target);
      if (e.target.id === 'ld-stats') ticker(); else if (e.target.id === 'ld-q') typeQuote(); else e.target.classList.add('in');
    }, { root: main, threshold: 0.3 });
    function setStep(i) {
      st.step = i;
      root.querySelectorAll('.ld-step').forEach(function (s, k) { s.classList.toggle('on', k === i); });
      root.querySelectorAll('.ld-mock').forEach(function (m, k) { m.classList.toggle('on', k === i); });
    }

    /* ── 숫자 올리기와 타자: 타이머로 (앱 안의 보기에서 requestAnimationFrame이 멈출 수 있다) ── */
    function ticker() {
      var t0 = Date.now(), dur = st.calm ? 0 : 1200;
      (function step() {
        var p = dur ? Math.min(1, (Date.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
        STATS.forEach(function (s, i) { $('ld-n' + i).textContent = UI.fmt(Math.round(s[1] * e), true, 0); });
        if (p < 1) later(step, 30);
      })();
    }
    function typeQuote() {
      var el = $('ld-typed'), n = 0;
      el.classList.remove('done');
      if (st.calm) { el.textContent = QUOTE; el.classList.add('done'); return; }
      (function step() { el.textContent = QUOTE.slice(0, ++n); if (n < QUOTE.length) later(step, 38); else el.classList.add('done'); })();
    }

    /* ── 스크롤 진행 막대: CSS animation-timeline이 없을 때만 JS로 ── */
    if (!(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
      on(main, 'scroll', function () { var max = main.scrollHeight - main.clientHeight; $('ld-prog').style.transform = 'scaleX(' + (max > 0 ? main.scrollTop / max : 0) + ')'; }, { passive: true });
    }

    /* ── 포인터 반응: 마우스일 때만 (Magnetic Button, Spotlight Hover, 3D Tilt) ── */
    if (hover) {
      var mag = $('ld-mag');
      on($('ld-hero'), 'pointermove', function (e) {
        if (st.calm) return;
        mag.style.transform = '';
        var r = mag.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy), R = 90;
        var f = d < R ? Math.min(1, (R - d) / (R * 0.3)) : 0;
        mag.style.transform = 'translate(' + (dx / R * 8 * f) + 'px,' + (dy / R * 8 * f) + 'px)';
      });
      on($('ld-hero'), 'pointerleave', function () { mag.style.transform = ''; });
      root.querySelectorAll('.ld-card').forEach(function (c) {
        on(c, 'pointermove', function (e) {
          if (st.calm) return;
          var r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          c.style.setProperty('--x', x + 'px'); c.style.setProperty('--y', y + 'px');
          c.style.transform = 'rotateX(' + (-(y / r.height - 0.5) * 6) + 'deg) rotateY(' + ((x / r.width - 0.5) * 6) + 'deg)';
        });
        on(c, 'pointerleave', function () { c.style.transform = ''; });
      });
    }

    /* ── 연동 카드 → 자세히: View Transition, 카드 머리는 Shared Element Transition. 지원이 없거나 동작 줄이기면 바로 바꾼다 ── */
    function transition(update, done) {
      if (document.startViewTransition && !st.calm) document.startViewTransition(update).finished.then(done, done);
      else { update(); done(); }
    }
    function openDetail(i) {
      if (st.detail >= 0) return;
      var c = INTEG[i], card = root.querySelectorAll('.ld-card')[i], d = $('ld-detail');
      st.detail = i;
      card.querySelector('.ld-ch').style.viewTransitionName = 'ld-shared';
      transition(function () {
        card.querySelector('.ld-ch').style.viewTransitionName = '';
        d.innerHTML = '<div class="ld-in"><button type="button" class="ld-btn" data-act="back" id="ld-back">← 연동 목록</button>' +
          '<span class="ld-dh" data-term="shared-element-transition" style="view-transition-name:ld-shared"><span class="ld-ic">' + esc(c[0]) + '</span><h3>' + c[1] + '</h3></span>' +
          '<p>' + c[2] + '. 연결은 1분이면 끝나고, 언제든 끊을 수 있어요.</p><ol data-term="view-transition">' + c[3].map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
          '<button type="button" class="ld-btn pri" data-join>' + c[1] + ' 연결하기</button></div>';
        d.hidden = false; main.classList.add('off'); main.inert = true;
      }, function () { var h = d.querySelector('.ld-dh'); if (h) h.style.viewTransitionName = ''; $('ld-back').focus(); later(drawLabels, 30); });
    }
    function closeDetail() {
      if (st.detail < 0) return;
      var card = root.querySelectorAll('.ld-card')[st.detail], d = $('ld-detail');
      st.detail = -1;
      d.querySelector('.ld-dh').style.viewTransitionName = 'ld-shared';
      transition(function () {
        d.hidden = true; d.innerHTML = ''; main.classList.remove('off'); main.inert = false;
        card.querySelector('.ld-ch').style.viewTransitionName = 'ld-shared';
      }, function () { card.querySelector('.ld-ch').style.viewTransitionName = ''; card.focus(); later(drawLabels, 30); });
    }

    /* ── 가입 창: Entry Animation. 열고 닫기는 클래스 하나, 움직임은 CSS(@starting-style)만 ── */
    var pop = $('ld-pop'), opener = null;
    function openPop(from) { opener = from || null; $('ld-popmsg').textContent = '메일 주소만 있으면 돼요. 카드 등록은 없어요.'; pop.classList.add('open'); later(function () { $('ld-mail').focus(); }, 30); later(drawLabels, 250); }
    function closePop() { if (!pop.classList.contains('open')) return; pop.classList.remove('open'); if (opener) opener.focus(); later(drawLabels, 250); }
    on(pop, 'submit', function (e) { e.preventDefault(); var v = $('ld-mail').value.trim(); $('ld-popmsg').textContent = v ? v + '로 시작 링크를 보냈어요(예시라 실제로 보내지 않아요).' : '메일 주소를 적어 주세요.'; });

    /* ── 멈춤과 동작 줄이기 ── */
    function pzLabel() { var b = $('ld-pz'); b.innerHTML = (st.paused ? PZ.play + '<span>다시 움직임</span>' : PZ.stop + '<span>움직임 멈춤</span>'); b.setAttribute('aria-pressed', String(st.paused)); b.setAttribute('aria-label', st.paused ? '움직임 다시' : '움직임 멈춤'); b.hidden = st.calm; }
    function setCalm(v) { st.calm = v; $('ld-calm').checked = v; scr.classList.toggle('calm', v); if (v) { $('ld-mag').style.transform = ''; root.querySelectorAll('.ld-card').forEach(function (c) { c.style.transform = ''; }); } pzLabel(); kick(); }
    on($('ld-calm'), 'change', function () { setCalm(this.checked); });
    function onMq() { setCalm(mq.matches); }
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    /* ── 사건 ── */
    function goTo(el, smooth) {
      var y = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 70;
      main.scrollTo({ top: Math.max(0, y), behavior: smooth && !st.calm ? 'smooth' : 'auto' });
    }
    on(root, 'click', function (e) {
      var el = e.target.closest('button, a');
      if (pop.classList.contains('open') && !e.target.closest('#ld-pop') && !(el && el.hasAttribute('data-join'))) closePop();
      if (!el || !root.contains(el)) return;
      if (el.closest('#ld-labels')) { opt.openTerm(el.getAttribute('data-id')); return; }
      if (el.tagName === 'A') { e.preventDefault(); var g = el.getAttribute('data-go'); if (g) goTo($(g), true); return; }
      if (el.hasAttribute('data-join')) { openPop(el); return; }
      if (el.hasAttribute('data-int')) { openDetail(+el.getAttribute('data-int')); return; }
      switch (el.getAttribute('data-act')) {
        case 'pz': st.paused = !st.paused; scr.classList.toggle('paused', st.paused); pzLabel(); kick(); break;
        case 'popx': closePop(); break;
        case 'back': closeDetail(); break;
      }
    });
    on(root, 'keydown', function (e) { if (e.key !== 'Escape') return; if (pop.classList.contains('open')) closePop(); else if (st.detail >= 0) closeDetail(); });

    /* ── 용어 보기 ── */
    var PLACE = { 'glass': 'right', 'scroll-progress': 'below', 'shader-background': 'in-bl', 'shine-text': 'right', 'view-transition': 'in-br', 'dot-grid': 'in-bl', 'grain': 'in-br', 'reduced-motion': 'right', 'parallax': 'below' };
    function drawLabels() {
      var L = $('ld-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) { return PLACE[id] || ''; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    // 스크롤 중에 바로 그리고, 스크롤 연동 값이 자리 잡은 뒤 한 번 더 그린다
    var settleId = 0;
    on(main, 'scroll', function () { if (!st.labels) return; drawLabels(); clearTimeout(settleId); settleId = setTimeout(drawLabels, 120); }, { passive: true });
    on(window, 'resize', drawLabels);

    // 처음: 제목이 단어별로 드러나고, 셰이더는 정지 그림으로 기다린다
    splitTitle(); pzLabel();

    return {
      setLabels: function (v) { st.labels = v; drawLabels(); },
      demo: function (id) {
        if (st.detail >= 0 && id !== 'shared-element-transition' && id !== 'view-transition') closeDetail();
        if (id === 'entry-animation') { openPop(null); return; }
        if (id === 'view-transition' || id === 'shared-element-transition') {
          if (st.detail < 0) { goTo($('ld-int'), false); later(function () { openDetail(2); }, 120); }
          return;
        }
        var el = id === 'shine-text' ? $('ld-h1') : root.querySelector('#ld-main [data-term="' + id + '"]');
        if (!el) return;
        // 진행 막대는 맨 위에서 길이가 0이라 조금 내려가서 보인다
        if (id === 'scroll-progress') main.scrollTop = (main.scrollHeight - main.clientHeight) * 0.35;
        else if (id === 'text-split-reveal' || id === 'shine-text' || id === 'shader-background') main.scrollTop = 0; else goTo(el, false);
        if (id === 'text-split-reveal') splitTitle();
        if (id === 'shader-background') initGL();
        if (id === 'number-ticker') ticker();
        if (id === 'typewriter') typeQuote();
        if (id === 'scroll-reveal') root.querySelectorAll('.ld-rv').forEach(function (r) { r.classList.remove('in'); void r.offsetWidth; later(function () { r.classList.add('in'); }, 60); });
        later(drawLabels, 80);
      },
      destroy: function () {
        timers.forEach(clearTimeout); clearTimeout(settleId); offs.forEach(function (f) { f(); }); ios.forEach(function (io) { io.disconnect(); });
        cancelAnimationFrame(raf);
        if (gl && gl.getExtension('WEBGL_lose_context')) gl.getExtension('WEBGL_lose_context').loseContext();
        if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        root.innerHTML = '';
      }
    };
  };
})();
