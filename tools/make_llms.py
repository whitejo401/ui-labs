"""terms.json과 recipes.json에서 llms.txt를 만든다. 용어나 조합 화면을 바꾸면 다시 돌린다.

쓰는 법: python3 tools/make_llms.py > llms.txt
요청 문장은 페이지와 같은 규칙으로 만든다: 언제 + 무엇 + (구조·표현은 "넣어줘", 움직임·만들기는 "적용해줘"). 어떻게
어떻게 안의 {키}는 defaults 값(phrases에 문구가 있으면 그 문구)으로 채운다.
"""
import json
import re

BASE = 'https://whitejo401.github.io/ui-labs/'
terms = json.load(open('terms.json', encoding='utf-8'))
recipes = json.load(open('recipes.json', encoding='utf-8'))
by_id = {t['id']: t for t in terms}


def fill_how(t):
    s, vals, ph = t['prompt']['how'], t.get('defaults', {}), t.get('phrases', {})
    for _ in range(2):
        def rep(m):
            k = m.group(1)
            if k not in vals:
                return m.group(0)
            v = str(vals[k])
            return ph.get(k, {}).get(v, v)
        s = re.sub(r'\{(\w+)\}', rep, s)
    return s


def prompt(t):
    verb = ' 적용해줘. ' if t['path'][0] in ('움직임', '만들기') else ' 넣어줘. '
    return t['prompt']['when'] + ' ' + t['prompt']['what'] + verb + fill_how(t)


out = ['# UI 도감 (ui-labs)', '',
       '> 바이브코딩 때 사람과 AI가 화면을 같은 이름으로 부르게 하는 UI·모션 용어 ' + str(len(terms)) + '개(업무 화면 부품, 소개·랜딩 효과, 차트·시각화, 다이어그램·슬라이드). 용어마다 한 줄 설명, 헷갈리는 짝, 틀리기 쉬운 말, 그대로 쓸 수 있는 요청 문장이 있다.', '',
       '사람이 "사이드 팝업"이라고 말할 때 Drawer인지 Modal Dialog인지 정해 두려고 만든 목록이다. 화면을 만들어 달라는 요청을 받으면 아래 영어 이름을 그대로 쓰고, 헷갈리는 짝과 구별해서 만든다.', '',
       '## 데이터', '',
       '- [terms.json](' + BASE + 'terms.json): 용어 ' + str(len(terms)) + '개 전체. 칸: id, name, ko, path(묶음·갈래·작은 묶음), one(한 줄 설명), aka(다른 이름), tags, controls(조절판), control_ko, defaults, phrases, states, pairs(헷갈리는 짝), wrong(틀리기 쉬운 말), right(바르게 말하는 법), prompt(언제·무엇·어떻게), motion(효과 용어만: 성능·가볍게 만드는 법·지원·동작 줄이기)',
       '- [recipes.json](' + BASE + 'recipes.json): 용어를 엮은 조합 화면 ' + str(len(recipes)) + '개와 화면 하나를 통째로 만드는 요청 문장. 덱 항목은 장 목록 slides(장마다 layout과 내용 칸, notes)도 가진다. 페이지의 덱 화면에서 .pptx로 내려받는다',
       '- [페이지](' + BASE + '): 용어마다 움직이는 예시와 조절판, 조합 화면에서 부품 이름 보기', '']
# 같은 묶음(path 앞 두 칸)은 처음 나온 자리에 모아 쓴다. terms.json에서 묶음이 떨어져 있어도 제목은 한 번만
groups = {}
for t in terms:
    groups.setdefault(' › '.join(t['path'][:2]), []).append(t)
for g, ts in groups.items():
    out += ['', '## ' + g, '']
    for t in ts:
        pairs = ', '.join(p['name'] for p in t['pairs'])
        out.append('- **' + t['name'] + '** (' + t['ko'] + '): ' + t['one'] + '. 헷갈리는 짝: ' + pairs + '. 요청 예: ' + prompt(t) + ('. 가볍게: ' + t['motion']['light'] if t.get('motion') else ''))
out += ['', '## 조합 화면', '']
for r in recipes:
    out.append('- **' + r['name'] + '** (용어 ' + str(len(r['terms'])) + '개: ' + ', '.join(by_id[i]['name'] for i in r['terms']) + ')' + (': ' + r['prompt'] if r.get('prompt') else ''))
out += ['', '## 라이선스', '', '코드는 MIT, 글(용어 설명과 요청 문장, terms.json·recipes.json의 내용)은 CC BY 4.0. 출처: UI 도감 (github.com/whitejo401/ui-labs)', '']
print('\n'.join(out))
