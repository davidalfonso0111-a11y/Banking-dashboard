#!/usr/bin/env python3
"""Split a complete exported dashboard without truncating its source.
Usage: python tools/split_dashboard.py /path/to/export.html
Output: split-dashboard/ (does not overwrite the live index.html).
"""
from pathlib import Path
import argparse
import re
import hashlib
import json

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('split-dashboard'))
args = parser.parse_args()
source = args.source.read_text(encoding='utf-8-sig')
if not re.search(r'<!doctype\s+html', source, re.I) or not re.search(r'</html>\s*$', source, re.I):
    raise SystemExit('STOP: source must be the complete HTML export, including </html>.')
if not re.search(r'</body>', source, re.I):
    raise SystemExit('STOP: source is missing </body>.')
output = args.output
if output.exists():
    raise SystemExit('STOP: output directory already exists; choose another --output path.')
files = {}
counts = {'css': 0, 'js': 0}
pattern = re.compile(r'<style\b([^>]*)>(.*?)</style\s*>|<script\b([^>]*)>(.*?)</script\s*>', re.I | re.S)

def extract(match):
    if match.group(1) is not None:
        attrs, body = match.group(1), match.group(2)
        # Preserve unusual style attributes by leaving the block inline.
        if attrs.strip():
            return match.group(0)
        counts['css'] += 1
        path = f'assets/css/styles-{counts["css"]:02d}.css'
        files[path] = body
        return f'<link rel="stylesheet" href="./{path}">'
    attrs, body = match.group(3), match.group(4)
    # Existing external scripts and non-JavaScript data blocks stay unchanged.
    if re.search(r'\bsrc\s*=', attrs, re.I):
        return match.group(0)
    type_match = re.search(r'\btype\s*=\s*[\"\']([^\"\']+)[\"\']', attrs, re.I)
    if type_match and type_match.group(1).lower() not in ('text/javascript', 'application/javascript', 'module'):
        return match.group(0)
    counts['js'] += 1
    path = f'assets/js/script-{counts["js"]:02d}.js'
    files[path] = body
    # No defer/async added: preserve the original execution order and timing.
    return f'<script{attrs} src="./{path}"></script>'

html = pattern.sub(extract, source)
files['index.html'] = html
if not counts['css'] or not counts['js']:
    raise SystemExit('STOP: no inline CSS or JavaScript found; check the source export.')
# Verify a lossless round trip before writing anything.
reconstructed = html
for path, body in files.items():
    if path.endswith('.css'):
        reconstructed = reconstructed.replace(f'<link rel="stylesheet" href="./{path}">', '<style>'+body+'</style>', 1)
    elif path.endswith('.js'):
        expression = re.compile(r'<script([^>]*) src="\./'+re.escape(path)+r'"></script>')
        reconstructed = expression.sub(lambda m: '<script'+m.group(1)+'>'+body+'</script>', reconstructed, count=1)
if reconstructed != source:
    raise SystemExit('STOP: lossless reconstruction failed; no files written.')
files['README.md'] = '''# Saldoa — split dashboard\n\nGenerated from the complete HTML source without changing functionality.\n\n- index.html: screens and forms.\n- assets/css/: extracted styles in original order.\n- assets/js/: extracted scripts in original order.\n\nPublish index.html and assets together at the repository root. Keep the\nprevious version until all files are uploaded. Do not publish index.html first.\n\nAccount login uses Supabase Auth. Financial data is still stored locally.\nSocial providers require configuration. No app PIN has been implemented.\nThe hidden design-preview code is preserved to avoid changing behavior.\n\nServe locally with python -m http.server 8000 from this directory.\nA lossless reconstruction check passed; this is not a browser or login test.\n'''
manifest = {path: hashlib.sha256(text.encode('utf-8')).hexdigest() for path, text in files.items()}
files['manifest.json'] = json.dumps({'source_sha256': hashlib.sha256(source.encode('utf-8')).hexdigest(), 'files': manifest}, indent=2)+'\n'
for path, text in files.items():
    destination = output / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding='utf-8')
print(f'Created {len(files)} complete files in {output}. Live files were not overwritten.')
