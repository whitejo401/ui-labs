/* 슬라이드 생성기의 HTML 문서 출력: 같은 덱 JSON → 목차 있는 HTML 문서 한 장
   UI.slide.doc(deck, theme) → HTML 문자열. 표지 장(cover, title)은 문서 머리, 나머지 장은 절 하나씩. 표지 장이 없으면 deck.name이 머리 제목
   절: 머리말 · 제목(h2, 목차에 들어감) · 결론 문장 · 본문 그림(장 SVG를 본문 칸으로 자름) · 문서에만 넣을 문단(장의 doc: [글]) · 발표자 노트 */
(function () {
  var S = window.UI.slide;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function p(t, cls) { return t ? '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(t) + '</p>' : ''; }

  function cover(s) {
    var meta = [s.eyebrow, s.by].filter(Boolean).join(' · ');
    return '<header>' + p(meta, 'eyebrow') + '<h1>' + esc(s.title) + '</h1>' + p(s.sub, 'sub') +
      ((s.agenda || []).length ? '<ul class="agenda">' + s.agenda.map(function (a) {
        return '<li><b>' + esc(a.head) + '</b>' + (a.key ? ' <span>' + esc(a.key) + '</span>' : '') +
          ((a.items || []).length ? '<br>' + a.items.map(esc).join(' · ') : '') + '</li>';
      }).join('') + '</ul>' : '') + p(s.notes, 'note') + '</header>';
  }

  S.doc = function (deck, theme) {
    var th = theme, top = '', toc = [], secs = [], title = deck.name || '';
    deck.slides.forEach(function (s, i) {
      if (s.layout === 'cover' || s.layout === 'title') { top += cover(s); title = title || s.title; return; }
      var id = 's' + (i + 1), b = S.bodyBox(s, th), pad = 8;
      var svg = S.svg(S.build(s, i, th).prims).replace(/viewBox="[^"]*"/,
        'viewBox="' + [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad].join(' ') + '"');
      toc.push('<li><a href="#' + id + '">' + esc(s.title) + '</a></li>');
      secs.push('<section id="' + id + '">' + p(s.eyebrow, 'eyebrow') + '<h2>' + esc(s.title) + '</h2>' + p(s.takeaway, 'lead') +
        '<figure>' + svg + '</figure>' + (s.doc || []).map(function (t) { return p(t); }).join('') + p(s.notes, 'note') + '</section>');
      title = title || s.title;
    });
    if (!top && deck.name) top = '<header><h1>' + esc(deck.name) + '</h1></header>';
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + '</title>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"><style>' +
      ':root{--bg:' + th.bg + ';--ink:' + th.ink + ';--muted:' + th.muted + ';--line:' + th.line + ';--accent:' + th.accent + '}' +
      'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "' + th.font + '",sans-serif}' +
      'main{max-width:960px;margin:0 auto;padding:48px 16px 96px}' +
      'h1{font-size:30px;line-height:1.35;margin:4px 0 12px}h2{font-size:22px;line-height:1.4;margin:4px 0 12px}' +
      '.eyebrow{margin:0;color:var(--muted);font-size:14px}.sub{color:var(--muted)}.note{color:var(--muted);font-size:15px}' +
      '.lead{margin:0 0 16px;padding-left:12px;border-left:4px solid var(--accent);font-weight:700}' +
      '.agenda{padding-left:20px}.agenda span{color:var(--muted);font-size:14px}' +
      'nav{margin:32px 0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}nav ol{margin:8px 0 0;padding-left:24px}' +
      'nav a{color:var(--ink)}section{margin-top:56px;scroll-margin-top:16px}figure{margin:0}figure svg{display:block;width:100%;height:auto}' +
      '</style></head><body><main>' + top +
      '<nav><b>목차</b><ol>' + toc.join('') + '</ol></nav>' + secs.join('') + '</main></body></html>';
  };
})();
