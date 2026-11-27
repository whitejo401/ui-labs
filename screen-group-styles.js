/* 조합 화면: 그룹 구분. 할 일 앱 한 화면에 묶음 구분 용어 8개를 엮는다 (recipes.json의 group-styles)
   목록 위 도구로 구분 방식(간격·옅은 배경·테두리 상자·왼쪽 막대·구분선)과 색 신호를 바꾸고, 흑백 보기로 색만 쓸 때의 위험을 본다
   UI.screens['group-styles'](뿌리 요소, { termName(id), openTerm(id), onLabels(보이는 id들) }) → { setLabels, demo, destroy } */
(function () {
  var UI = window.UI = window.UI || {};
  UI.screens = UI.screens || {};
  var esc = UI.esc, GRP = UI.GROUPS;
  var WAYS = ['간격만', '옅은 배경', '테두리 상자', '왼쪽 막대', '구분선'], SIGS = ['색+글자 이름', '색+아이콘', '색만'];
  // 묶음별 할 일 [글, 아이콘 글자, 담당]
  var TASKS = [
    [['결제 화면 문구 고치기', '민지'], ['환불 표에 수단 열 넣기', '준호'], ['환불 알림 메일 문장 다듬기', '서연'], ['결제 실패 화면 단추 옮기기', '도윤']],
    [['정산 메일 제목 바꾸기', '서연'], ['카드 등록 쉼표 오류', '도윤'], ['결제 수단 저장 동의 문구', '민지']],
    [['부분 환불 합계 다시 보기', '민지'], ['영수증 메일에 주문 번호', '준호']],
    [['10:00 결제 개편 회의', '준호'], ['13:30 정산 점검', '민지'], ['15:00 고객사 통화', '서연']],
    [['영수증 다시 발행 요청', '도윤'], ['간편결제 순서 문의', '민지'], ['예비 결제 수단 문의', '준호']]];
  var THREAD = [['민지', '영수증을 메일로 다시 보내 달라는 요청이 3건 왔어요.', 0], ['준호', '주문 번호가 메일 제목에 없어서 찾기 어렵대요.', 1], ['민지', '제목에 주문 번호 넣는 건 이번 주에 끝낼게요.', 2], ['서연', '다시 발행 단추를 결제 내역에도 둘까요?', 1], ['도윤', '고객센터 문의도 같은 내용이에요.', 0], ['서연', '그럼 결제 내역에 단추를 먼저 둘게요.', 1]];
  var LANES = ['민지', '준호', '서연'], COLS = ['할 일', '진행', '완료'];
  var BOARD = [[0, 0, '결제 화면 문구'], [0, 1, '부분 환불 합계'], [0, 2, '환불 알림 메일'], [1, 0, '환불 표 열'], [1, 1, '회의 정리'], [2, 0, '정산 메일 제목'], [2, 2, '예비 수단 둘']];
  var LOG = [['결제 화면 문구', '오늘 할 일', '민지', '11/20'], ['환불 표 열 추가', '요청', '준호', '11/21'], ['정산 메일 제목', '지연', '서연', '11/21'], ['카드 등록 쉼표', '빠른 메모', '도윤', '11/22'], ['영수증 다시 발행', '요청', '민지', '11/24'], ['간편결제 순서', '오늘 일정', '준호', '11/25'], ['예비 수단 둘', '오늘 할 일', '서연', '11/26'], ['환불 알림 메일', '요청', '도윤', '11/26'], ['결제 실패 다시 시도', '지연', '민지', '11/27']];

  UI.screens['group-styles'] = function (root, opt) {
    var st = { labels: false, way: '왼쪽 막대', sig: '색+글자 이름', gray: false, tab: 'list', open: {} }, timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function $(id) { return document.getElementById(id); }

    root.innerHTML =
      '<div class="u scr gs-scr">' +
        '<div class="gs-main">' +
          '<div class="gs-head"><h2>할 일</h2>' +
            '<div class="gs-tabs" role="tablist" aria-label="보기" data-term="tabs">' + [['list', '목록'], ['board', '담당자별 보드'], ['log', '완료 기록']].map(function (x) { return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (x[0] === 'list') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
          '<div class="gs-tools" id="gs-tools" data-term="group-style">' +
            '<label>구분 방식 <select id="gs-way">' + WAYS.map(function (w) { return '<option' + (w === st.way ? ' selected' : '') + '>' + w + '</option>'; }).join('') + '</select></label>' +
            '<label>색 신호 <select id="gs-sig">' + SIGS.map(function (w) { return '<option>' + w + '</option>'; }).join('') + '</select></label>' +
            '<label class="gs-gray"><button type="button" class="u-switch" role="switch" aria-checked="false" id="gs-gray" aria-label="흑백 보기"><i></i></button>흑백 보기</label></div>' +
          '<div class="gs-pane" id="gs-list" role="tabpanel"><div class="gs-groups" id="gs-groups" data-term="grouped-list"></div></div>' +
          '<div class="gs-pane" id="gs-board" role="tabpanel" hidden><div class="gs-lanes" data-term="swimlane">' +
            '<span></span>' + COLS.map(function (c) { return '<b class="gs-col">' + c + '</b>'; }).join('') +
            LANES.map(function (l, i) {
              return '<div class="gs-lh"><b>' + l + '</b><small>' + BOARD.filter(function (b) { return b[0] === i; }).length + '장</small></div>' +
                COLS.map(function (c, k) { return '<div class="gs-cell' + (i % 2 ? ' alt' : '') + '">' + BOARD.filter(function (b) { return b[0] === i && b[1] === k; }).map(function (b) { return '<div class="gs-card">' + b[2] + '</div>'; }).join('') + '</div>'; }).join('');
            }).join('') + '</div></div>' +
          '<div class="gs-pane" id="gs-log" role="tabpanel" hidden><table class="gs-tbl" data-term="zebra-striping"><thead><tr><th>할 일</th><th>묶음</th><th>담당</th><th>끝낸 날</th></tr></thead><tbody>' +
            LOG.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '</div>' +
        '<aside class="gs-side" aria-labelledby="gs-th"><h3 id="gs-th">영수증 다시 발행 요청</h3><p class="gs-sub">요청 · 댓글 ' + THREAD.length + '개</p><div class="gs-thread" id="gs-thread" data-term="indent-guide"></div></aside>' +
        '<div class="scr-labels" id="gs-labels" hidden></div>' +
      '</div>';

    var scr = root.querySelector('.gs-scr');

    /* ── 목록: 지금 고른 방식과 색 신호로 다시 그린다 ── */
    function drawGroups() {
      var g = $('gs-groups');
      g.className = 'gs-groups way-' + WAYS.indexOf(st.way);
      g.innerHTML = GRP.map(function (gr, i) {
        var head = st.sig === '색만' ? '<i class="gs-dot" aria-hidden="true"></i><span class="gs-sr">' + gr[0] + '</span>' :
          '<span class="gs-ic" aria-hidden="true">' + gr[2] + '</span>' + (st.sig === '색+글자 이름' ? gr[0] : '<span class="gs-sr">' + gr[0] + '</span>');
        return '<section class="gs-grp" style="--g:' + gr[1] + '" aria-labelledby="gs-h' + i + '"' + '>' +
          (st.way === '왼쪽 막대' ? '<i class="gs-bar"' + (i === 1 ? ' data-term="accent-bar"' : '') + ' aria-hidden="true"></i>' : '') +
          '<h3 class="gs-gh" id="gs-h' + i + '"' + (i === 1 ? ' data-term="sticky-section-header"' : '') + '>' + head + '<small>' + TASKS[i].length + '</small></h3>' +
          '<ul>' + TASKS[i].map(function (t) { return '<li><button type="button" class="gs-chk" aria-label="' + esc(t[0]) + ' 끝내기"></button><span>' + esc(t[0]) + '</span><em>' + t[1] + '</em></li>'; }).join('') + '</ul></section>';
      }).join('');
      $('gs-list').classList.toggle('gray', st.gray);
    }

    /* ── 댓글: 들여쓰기 안내선, 선이나 단추를 누르면 그 답글 묶음을 접는다 ── */
    function drawThread() {
      var html = '', i = 0;
      function node(k) {
        var t = THREAD[k], kids = [], j = k + 1;
        while (j < THREAD.length && THREAD[j][2] > t[2]) { if (THREAD[j][2] === t[2] + 1) kids.push(j); j++; }
        var closed = st.open[k] === false, n = j - k - 1;
        return '<div class="gs-c"><div class="gs-ch"><i style="background:color-mix(in srgb, ' + GRP[k % 5][1] + ' 24%, var(--u-panel))">' + t[0][0] + '</i><b>' + t[0] + '</b></div><p>' + esc(t[1]) + '</p>' +
          (kids.length ? (closed ? '<button type="button" class="gs-more" data-fold="' + k + '" aria-expanded="false">답글 ' + n + '개 펼치기</button>' :
            '<div class="gs-kids"><button type="button" class="gs-line" data-fold="' + k + '" aria-expanded="true" aria-label="' + t[0] + ' 댓글의 답글 ' + n + '개 접기"></button>' + kids.map(node).join('') + '</div>') : '') + '</div>';
      }
      while (i < THREAD.length) { if (THREAD[i][2] === 0) html += node(i); i++; }
      $('gs-thread').innerHTML = html;
    }

    function setTab(tab) {
      st.tab = tab;
      root.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
      $('gs-list').hidden = tab !== 'list'; $('gs-board').hidden = tab !== 'board'; $('gs-log').hidden = tab !== 'log';
      $('gs-tools').hidden = tab !== 'list';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.closest('#gs-labels')) { opt.openTerm(b.getAttribute('data-id')); return; }
      if (b.hasAttribute('data-tab')) { setTab(b.getAttribute('data-tab')); }
      else if (b.id === 'gs-gray') { st.gray = !st.gray; b.setAttribute('aria-checked', String(st.gray)); drawGroups(); }
      else if (b.hasAttribute('data-fold')) { var k = b.getAttribute('data-fold'); st.open[k] = st.open[k] === false; drawThread(); var nb = root.querySelector('[data-fold="' + k + '"]'); if (nb) nb.focus(); }
      else if (b.classList.contains('gs-chk')) { b.closest('li').classList.toggle('done'); }
      else return;
      if (st.labels) later(drawLabels, 30);
    });
    root.querySelector('.gs-tabs').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = [].slice.call(root.querySelectorAll('[data-tab]')), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setTab(n.getAttribute('data-tab'));
      if (st.labels) later(drawLabels, 30);
    });
    $('gs-way').addEventListener('change', function () { st.way = this.value; drawGroups(); if (st.labels) drawLabels(); });
    $('gs-sig').addEventListener('change', function () { st.sig = this.value; drawGroups(); if (st.labels) drawLabels(); });
    $('gs-list').addEventListener('scroll', function () { if (st.labels) drawLabels(); });

    /* ── 용어 보기 ── */
    function drawLabels() {
      var L = $('gs-labels');
      L.hidden = !st.labels;
      if (!st.labels) return;
      var list = $('gs-list'), top = list.getBoundingClientRect().top;
      var seen = UI.termLabels(scr, L, opt.termName, function (id) {
        return id === 'sticky-section-header' ? 'right' : id === 'grouped-list' ? 'in-br' : id === 'tabs' ? 'right' : '';
      }, function (el) { return list.contains(el) && el !== list && el.getBoundingClientRect().top < top - 1; });
      if (opt.onLabels) opt.onLabels(seen);
    }
    function onResize() { drawLabels(); }
    window.addEventListener('resize', onResize);
    drawGroups(); drawThread();

    return {
      setLabels: function (on) { st.labels = on; drawLabels(); },
      demo: function (id) {
        if (id === 'swimlane') setTab('board');
        else if (id === 'zebra-striping') setTab('log');
        else {
          setTab('list');
          if (id === 'accent-bar' && st.way !== '왼쪽 막대') { st.way = '왼쪽 막대'; $('gs-way').value = st.way; drawGroups(); }
          if (id === 'sticky-section-header') $('gs-list').scrollTop = root.querySelector('[data-term="sticky-section-header"]').closest('.gs-grp').offsetTop + 20;
          else $('gs-list').scrollTop = 0;
        }
        later(drawLabels, 60);
      },
      destroy: function () { timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); root.innerHTML = ''; }
    };
  };
})();
