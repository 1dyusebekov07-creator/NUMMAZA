"""Собирает веб-версию NUMMAZA в один HTML-файл (стили и скрипты внутри).
Так её можно опубликовать где угодно одним файлом: claude.ai Artifact, GitHub Pages, Netlify.
  python3 scripts/build_web.py dist/nummaza-web.html          — полный HTML-документ
  python3 scripts/build_web.py dist/artifact.html --artifact   — тело страницы для claude.ai Artifact"""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent / 'app'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/nummaza-web.html')
artifact = '--artifact' in sys.argv

def js(path):
    code = (root / path).read_text(encoding='utf-8')
    # Внутри <script> нельзя встречать закрывающий тег
    return code.replace('</script', '<\\/script')

css = (root / 'css/app.css').read_text(encoding='utf-8')
scripts = ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'js/core.js', 'js/i18n.js', 'js/parser.js', 'js/numa.js', 'js/app.js']
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700;800&display=swap">'
head = ('<title>NUMMAZA</title>\n<meta name="theme-color" content="#F4F5F7">\n'
        '<meta name="description" content="Бюджет-ассистент: сколько можно потратить сегодня, конверты, цели и разбор выписки Kaspi.">\n'
        + fonts + '\n<style>\n' + css + '\n</style>\n')
body = ('<div id="app"></div>\n<div id="sheet"></div>\n<div id="toast" role="status" aria-live="polite"></div>\n'
        + ''.join('<script>\n' + js(s) + '\n</script>\n' for s in scripts))
if artifact:
    html = head + body
else:
    html = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + '</head>\n<body>\n' + body + '</body>\n</html>\n')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, round(len(html.encode('utf-8')) / 1024), 'KB')
