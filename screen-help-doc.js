/* 조합 화면: 도움말 문서. 긴 문서 한 편에 묶기·스크롤 용어 13개를 엮는다 (recipes.json의 help-doc)
   본문은 화면 안 스크롤 상자(#hd-main)에서 실제로 스크롤된다. 목차 이동은 제목의 scroll-margin-top을 읽어 그만큼 띄운다
   UI.screens['help-doc'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  // 목차: [제목 id, 글, 단계]
  var TOC = [['hd-start', '시작하기', 2], ['hd-card', '결제 수단 등록', 2], ['hd-card-add', '카드 등록', 3], ['hd-bank', '계좌 등록', 3], ['hd-refund', '환불 기준', 2], ['hd-faq', '자주 묻는 질문', 2], ['hd-log', '변경 기록', 2]];
  var REFUND = [['결제 수단', '환불 방법', '걸리는 때', '요청 기한', '부분 환불', '알림', '영수증', '수수료'],
    ['카드', '결제 취소', '3~5영업일', '결제 뒤 30일', '됨', '카드사 문자', '취소 영수증 다시 발행', '없음'], ['계좌 이체', '같은 계좌로 입금', '다음 영업일', '결제 뒤 30일', '됨', '메일', '환불 확인서', '없음'],
    ['간편결제', '간편결제 잔액으로', '바로', '결제 뒤 14일', '안 됨', '앱 알림', '간편결제 앱에서', '없음'], ['포인트', '포인트로 되돌림', '바로', '기한 없음', '됨', '화면 안 배지', '없음', '없음']];
  var FAQ = [['환불은 언제 들어오나요?', '카드는 3~5영업일, 계좌는 다음 영업일에 들어와요. 간편결제와 포인트는 바로 돌아가요.'],
    ['결제 수단을 두 개 이상 둘 수 있나요?', '네. 기본 수단 하나와 예비 수단을 둘까지 둘 수 있어요. 기본 수단이 실패하면 예비 수단으로 다시 시도해요.'],
    ['환불 금액이 결제 금액과 다르게 보여요.', '부분 환불이 섞이면 합계가 달라 보일 수 있어요. 결제 내역의 "환불" 열에서 건마다 확인하세요.']];
  var LOG = [['11월 26일', ['환불 내역 표에 결제 수단 열을 넣었어요', '부분 환불 금액이 합계와 다르게 보이던 문제를 고쳤어요', '환불 알림 메일 제목에 주문 번호를 넣었어요']],
    ['11월 20일', ['간편결제 환불이 바로 처리되게 바꿨어요', '환불 사유에 "기타" 직접 입력을 넣었어요']],
    ['11월 12일', ['예비 결제 수단을 둘까지 둘 수 있게 했어요', '카드 등록 화면의 천 단위 쉼표를 고쳤어요', '결제 실패 화면에 다시 시도 단추를 옮겼어요']],
    ['10월 30일', ['결제 수단 저장 동의 문구를 바꿨어요', '영수증 메일 제목에 주문 번호를 넣었어요']],
    ['10월 21일', ['간편결제 버튼 순서를 정했어요', '정산 대기 환불 건을 자동으로 다시 시도해요', '환불 정책 안내 문구를 다듬었어요']],
    ['10월 8일', ['결제 개편 범위를 정리했어요', '결제 내역을 달마다 묶어 보여요']]];
  function p(t) { return '<p>' + t + '</p>'; }

  UI.screens['help-doc'] = function (root, opt) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches, st = { labels: false }, timers = [], gapT = null;
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

    root.innerHTML =
      '<div class="u scr hd-scr">' +
        '<div class="hd-pane">' +
          '<div class="hd-main" id="hd-main">' +
            '<header class="hd-top" data-term="sticky-header"><nav class="hd-crumb" aria-label="위치" data-term="breadcrumb"><a href="#">도움말</a><span aria-hidden="true">›</span><a href="#">결제</a><span aria-hidden="true">›</span><span aria-current="page">결제 수단과 환불</span></nav>' +
              '<b>결제 수단과 환불</b><i class="hd-prog" id="hd-prog" data-term="scroll-progress"></i></header>' +
            '<div class="hd-wrap">' +
              '<h1 id="hd-h1" tabindex="-1">결제 수단과 환불</h1>' +
              p('작업함에서 결제 수단을 등록하고, 결제를 취소하거나 환불하는 방법을 정리했어요. 팀 관리자를 위한 안내예요.') +
              '<h2 id="hd-start">시작하기</h2>' +
              p('결제 설정은 왼쪽 메뉴의 <b>설정 › 결제</b>에 있어요. 처음 들어가면 등록된 결제 수단이 없다는 안내와 함께 "결제 수단 추가" 단추가 보여요.') +
              p('결제 수단을 하나 등록하면 그 수단이 기본 수단이 되고, 다음 달 정기 결제부터 쓰여요. 지난 결제는 원래 수단으로 그대로 남아요.') +
              UI.calloutHTML('정보', true, '결제 수단은 팀 관리자만 바꿀 수 있어요. 멤버는 결제 내역만 볼 수 있어요.', ' data-term="callout"') +
              '<hr class="hd-hr" data-term="divider">' +
              '<h2 id="hd-card">결제 수단 등록</h2>' +
              p('카드와 계좌를 등록할 수 있어요. 기본 수단 하나와 예비 수단을 둘까지 둘 수 있고, 기본 수단이 실패하면 예비 수단으로 다시 시도해요.') +
              '<h3 id="hd-card-add">카드 등록</h3>' +
              p('"결제 수단 추가 › 카드"를 누르고 카드 번호, 유효 기간, 생년월일 앞 여섯 자리를 적어요. 카드사 확인이 끝나면 목록에 카드 끝 네 자리가 보여요.') +
              p('법인 카드는 사업자 번호를 함께 적어야 해요. 확인에 실패하면 칸 아래에 이유가 나오고, 적은 내용은 그대로 남아요.') +
              '<h3 id="hd-bank">계좌 등록</h3>' +
              p('"결제 수단 추가 › 계좌"에서 은행과 계좌 번호를 적으면, 그 계좌로 1원을 보내요. 입금자 이름에 적힌 숫자 네 개를 적으면 등록이 끝나요.') +
              UI.calloutHTML('주의', true, '결제 수단을 지우면 다시 살릴 수 없어요. 정기 결제에 쓰이는 수단이면 먼저 다른 수단으로 바꾸세요.', ' data-term="callout"') +
              '<hr class="hd-hr">' +
              '<h2 id="hd-refund">환불 기준</h2>' +
              p('결제를 취소하면 결제한 수단으로 돌려드려요. 걸리는 때는 결제 수단마다 달라요. 부분 환불도 같은 길로 돌아가요.') +
              '<figure class="hd-pq" data-term="pull-quote"><blockquote>환불은 결제한 수단으로만 돌려드려요.</blockquote><figcaption>고객지원팀 민지</figcaption></figure>' +
              p('다른 계좌나 다른 카드로 받고 싶다면, 먼저 환불을 받은 뒤 새로 결제해야 해요. 아래 표는 결제 수단별 기준이에요. 표가 넓으면 가로로 넘겨 보세요.') +
              '<div class="hd-xs" data-term="scroll-shadow"><div id="hd-xsc" tabindex="0" role="region" aria-label="결제 수단별 환불 기준 표, 가로로 넘겨 보기"><table>' +
                '<thead><tr>' + REFUND[0].map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
                REFUND.slice(1).map(function (r) { return '<tr>' + r.map(function (v, i) { return i ? '<td>' + v + '</td>' : '<th scope="row">' + v + '</th>'; }).join('') + '</tr>'; }).join('') +
              '</tbody></table></div><i class="l" id="hd-xl" aria-hidden="true"></i><i class="r" id="hd-xr" aria-hidden="true"></i></div>' +
              p('환불이 늦어지면 결제 내역에서 그 건을 열고 "환불 상태"를 보세요. 카드사 처리 중이면 그대로 기다리면 돼요.') +
            '</div>' +
            '<section class="hd-band" data-term="section-band" aria-labelledby="hd-faq"><div class="hd-wrap"><h2 id="hd-faq">자주 묻는 질문</h2><dl>' +
              FAQ.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl></div></section>' +
            '<div class="hd-wrap">' +
              '<h2 id="hd-log">변경 기록</h2>' + p('이 문서와 결제 화면에서 바뀐 것을 날짜별로 모았어요.') +
              '<div class="hd-log">' + LOG.map(function (g) {
                // 묶음마다 감싸야 다음 날짜 제목이 앞 제목을 밀어낸다(한 부모 안이면 위에서 겹쳐 쌓인다)
                return '<section class="hd-grp"><div class="hd-gh" data-term="sticky-section-header">' + g[0] + '</div><ul>' + g[1].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>';
              }).join('') + '</div>' +
              p('더 궁금한 점은 도움말 맨 아래 "문의하기"로 보내 주세요. 영업일 기준 하루 안에 답해요.') +
            '</div>' +
            '<footer class="hd-foot"><b>이 문서가 도움이 되었나요?</b><span><button type="button" class="u-btn">네</button> <button type="button" class="u-btn">아니요</button></span><small>작업함 도움말 · 문의하기 · 이용 약관 · 개인정보 처리방침</small></footer>' +
          '</div>' +
          '<div class="hd-gap" id="hd-gap" aria-hidden="true" data-term="scroll-margin"></div>' +
          '<button type="button" class="hd-totop off" id="hd-totop" aria-label="맨 위로" data-term="back-to-top">↑</button>' +
        '</div>' +
        '<nav class="hd-toc" aria-label="이 페이지" data-term="table-of-contents"><span>이 페이지</span>' +
          TOC.map(function (x) { return '<a href="#' + x[0] + '" data-go="' + x[0] + '"' + (x[2] === 3 ? ' class="sub"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>' +
        '<div class="scr-labels" id="hd-labels" hidden></div>' +
      '</div>';
    var $ = function (id) { return root.querySelector('#' + id); }, scr = root.querySelector('.hd-scr'), main = $('hd-main'), xs = $('hd-xsc'), gap = $('hd-gap'), totop = $('hd-totop');
    var links = [].slice.call(root.querySelectorAll('.hd-toc a')), ghs = [].slice.call(root.querySelectorAll('.hd-gh'));
    function topH() { return root.querySelector('.hd-top').offsetHeight; }
    function yOf(el) { return el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop; }

    // 스크롤 스파이(목차의 지금 구역: 제목이 고정 머리 아래 판정선을 지나면), 읽은 만큼 막대, 맨 위로 단추, 붙은 구역 제목의 아래 선
    function onScroll() {
      var y = main.scrollTop, max = main.scrollHeight - main.clientHeight, line = y + topH() + 40, cur = 0;
      $('hd-prog').style.width = (max > 0 ? y / max * 100 : 0) + '%';
      TOC.forEach(function (x, i) { if (yOf($(x[0])) <= line) cur = i; });
      if (y >= max - 2) cur = TOC.length - 1;
      links.forEach(function (a, i) {
        if (i === cur) { a.setAttribute('aria-current', 'true'); a.setAttribute('data-term', 'scroll-spy'); }
        else { a.removeAttribute('aria-current'); a.removeAttribute('data-term'); }
      });
      // 좁은 화면의 가로 목차: 켜진 항목이 줄 밖이면 줄을 옮긴다(페이지는 스크롤하지 않음)
      var nav = links[0].parentNode, on = links[cur];
      if (nav.scrollWidth > nav.clientWidth && (on.offsetLeft < nav.scrollLeft || on.offsetLeft + on.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = on.offsetLeft - 12;
      totop.classList.toggle('off', y < Math.min(main.clientHeight * 2, max * 0.6));
      var top = main.getBoundingClientRect().top + topH();
      ghs.forEach(function (g) { g.classList.toggle('stuck', y > 0 && Math.abs(g.getBoundingClientRect().top - top) < 1); });
      if (st.labels) drawLabels();
    }
    // 넘침 그림자: 더 볼 내용이 남은 쪽 끝에만
    function onX() {
      var m = xs.scrollWidth - xs.clientWidth;
      $('hd-xl').style.opacity = Math.min(1, xs.scrollLeft / 24);
      $('hd-xr').style.opacity = Math.min(1, Math.max(0, m - xs.scrollLeft) / 24);
    }
    // 목차 이동: 제목의 scroll-margin-top만큼 고정 머리 아래에 멈춘다. 페이지 주소(#)는 도감이 쓰므로 바꾸지 않는다
    function go(el, instant) {
      var m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      main.scrollTo({ top: yOf(el) - m, behavior: reduce || instant ? 'auto' : 'smooth' });
      el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
      gap.classList.add('on'); clearTimeout(gapT);
      gapT = later(function () { gap.classList.toggle('on', st.labels); }, 1600);
    }

    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]'), b = e.target.closest('button');
      if (a && root.contains(a)) { e.preventDefault(); go($(a.getAttribute('data-go'))); return; }
      if (e.target.closest('.hd-crumb a')) { e.preventDefault(); return; }
      if (b && b.closest('#hd-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b === totop) { main.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); $('hd-h1').focus({ preventScroll: true }); }
    });
    main.addEventListener('scroll', onScroll);
    xs.addEventListener('scroll', onX);

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('hd-labels');
      L.hidden = !st.labels;
      gap.classList.toggle('on', st.labels);
      if (!st.labels) return;
      // 본문 부품은 위쪽이 고정 머리 밑에 가려 있으면 건너뛴다(가린 자리에 이름표가 뜨지 않게)
      var hb = main.getBoundingClientRect().top + topH();
      var seen = UI.termLabels(scr, L, opt.termName, function (id) {
        return id === 'sticky-header' || id === 'scroll-spy' ? 'in-br' : id === 'breadcrumb' || id === 'back-to-top' ? 'right' : id === 'scroll-progress' || id === 'scroll-margin' ? 'below' : '';
      }, function (el) { return main.contains(el) && !el.closest('.hd-top') && el.getBoundingClientRect().top < hb - 1; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { onX(); drawLabels(); }
    window.addEventListener('resize', onResize);
    onScroll(); onX();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      // 지금 화면에 없는 용어: 그 부품이 보이는 곳으로 스크롤한다
      demo: function (id) {
        var sel = { 'callout': '.hd-wrap [data-term="callout"]', 'divider': '.hd-hr', 'pull-quote': '.hd-pq', 'scroll-shadow': '.hd-xs', 'section-band': '.hd-band' }[id];
        if (id === 'back-to-top') main.scrollTop = main.scrollHeight;
        else if (id === 'scroll-progress') main.scrollTop = (main.scrollHeight - main.clientHeight) * 0.3;
        else if (id === 'sticky-section-header') main.scrollTop = yOf(ghs[0]) - topH() + 70;
        else if (id === 'scroll-margin') go($('hd-refund'), true);
        else if (sel) main.scrollTop = Math.max(0, yOf(root.querySelector(sel)) - topH() - 40);
        onScroll(); later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
