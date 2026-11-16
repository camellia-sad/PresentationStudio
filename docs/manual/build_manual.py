"""Build a self-contained offline user manual from the maintained Markdown."""
from pathlib import Path
import base64
import html
import json
import re
import markdown

HERE = Path(__file__).resolve().parent
source = (HERE / '用户使用教程.md').read_text(encoding='utf-8')
renderer = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc'], extension_configs={
    'toc': {'slugify': lambda value, separator: re.sub(r'[^\w]+', '-', value).strip('-').lower()}
})
body = renderer.convert(source)
for match in list(re.finditer(r'<img[^>]+src="([^"]+)"', body)):
    relative = match[1]
    path = HERE / relative
    if not path.is_file():
        raise FileNotFoundError(path)
    body = body.replace('src="' + relative + '"', 'src="data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode() + '" loading="lazy"')
project = (HERE / '练习项目.studio.json').read_bytes()
body = body.replace('href="练习项目.studio.json"', 'download="练习项目.studio.json" href="data:application/json;base64,' + base64.b64encode(project).decode() + '"')
headings = list(re.finditer(r'<h2 id="([^"]+)">(.+?)</h2>', body))
if len(headings) != 20:
    raise ValueError('Expected all 20 user-facing chapters')
toc = ''.join(f'<a href="#{m[1]}" data-section="{m[1]}">{m[2]}</a>' for m in headings)
intro = body[:headings[0].start()]
chapters = ''.join('<section class="chapter" data-chapter="' + m[1] + '">' + body[m.start():headings[i+1].start() if i+1<len(headings) else len(body)] + '</section>' for i,m in enumerate(headings))
template = (HERE / 'reader.template.html').read_text(encoding='utf-8')
output = template.replace('__TOC__', toc).replace('__INTRO__', intro).replace('__CHAPTERS__', chapters)
(HERE / '汇报工作台完整使用教程.html').write_text(output, encoding='utf-8')
result = {'version': '1.10.0', 'chapters': len(headings), 'screenshots': body.count('src="data:image/'),
          'practiceProjectEmbedded': 'data:application/json;base64,' in body,
          'output': str(HERE / '汇报工作台完整使用教程.html'), 'sourceCharacters': len(source)}
(HERE / 'build-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
