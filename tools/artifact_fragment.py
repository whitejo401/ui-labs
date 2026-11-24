"""index.html(완전한 문서)에서 Claude 아티팩트에 올릴 조각을 만든다.

아티팩트는 <!doctype>·<html>·<head>·<body>를 스스로 감싸므로, head 안의 charset·viewport를 뺀 나머지와 body 내용만 남긴다.
쓰는 법: python3 tools/artifact_fragment.py index.html 나갈파일.html
"""
import re
import sys

src = open(sys.argv[1], encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = '\n'.join(l for l in head.strip().split('\n') if not l.startswith('<meta charset') and not l.startswith('<meta name="viewport"'))
open(sys.argv[2], 'w', encoding='utf-8').write(head + '\n\n' + body.strip() + '\n')
