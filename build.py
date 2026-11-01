#!/usr/bin/env python3
"""Bundle each src/lesson-N.html into a single self-contained file.

docs/     full HTML documents: the GitHub Pages site, also usable as local files
publish/  page bodies for publishing as artifacts (the host adds <html>/<head>)
Links between lessons come from links.json when it exists (published URLs),
otherwise they are relative file names.
"""
import base64, json, pathlib, re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400'
         '&family=JetBrains+Mono:wght@500;600&family=Shippori+Mincho+B1:wght@600;700;800&display=swap">')

def head_block():
    css = (SRC / 'lesson.css').read_text()
    js = (SRC / 'go-engine.js').read_text() + '\n' + (SRC / 'go-ui.js').read_text()
    return f'{FONTS}\n<style>\n{css}\n</style>\n<script>\n{js}\n</script>'

def links(target):
    local = {'INDEX': 'index.html', **{f'L{n}': f'lesson-{n}.html' for n in range(1, 5)}}
    if target == 'publish':
        f = ROOT / 'links.json'
        if f.exists():
            local.update(json.loads(f.read_text()))
    return local

def hero(name):
    # assets/hero-N.jpg becomes the hero illustration; otherwise a large numeral.
    n = re.search(r'lesson-(\d+)', name)
    n = n.group(1) if n else None
    img = ROOT / 'assets' / f'hero-{n}.jpg'
    if n and img.exists():
        data = base64.b64encode(img.read_bytes()).decode()
        alt = (ROOT / 'assets' / f'hero-{n}.txt').read_text().strip() if (ROOT / 'assets' / f'hero-{n}.txt').exists() else ''
        return f'<figure class="hero-art"><img src="data:image/jpeg;base64,{data}" alt="{alt}"></figure>'
    return f'<div class="numeral" aria-hidden="true">{n or ""}</div>'

def render(text, target, name=''):
    text = text.replace('<!--HEAD-->', head_block()).replace('<!--HERO-->', hero(name))
    for k, v in links(target).items():
        text = text.replace('{{' + k + '}}', v)
    return text

def main():
    for target in ('docs', 'publish'):
        (ROOT / target).mkdir(exist_ok=True)
    pages = sorted(SRC.glob('lesson-*.html')) + sorted(SRC.glob('index.html'))
    for page in pages:
        text = page.read_text()
        body = render(text, 'publish', page.name)
        (ROOT / 'publish' / page.name).write_text(body)
        full = render(text, 'docs', page.name)
        title = re.search(r'<title>.*?</title>', full).group(0)
        rest = full.replace(title, '', 1)
        doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               f'{title}\n</head>\n<body>\n{rest}\n</body>\n</html>\n')
        (ROOT / 'docs' / page.name).write_text(doc)
        print('built', page.name, f'{len(doc)//1024} KB')

if __name__ == '__main__':
    main()
