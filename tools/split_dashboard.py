#!/usr/bin/env python3
"""Split a complete single-file dashboard without changing the source.
Usage: python tools/split_dashboard.py dashboard-complete.html --output dist
The output must be inspected and tested before publishing.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tempfile
import shutil


def split(source, output):
    source = source.resolve()
    output = output.resolve()
    if not source.is_file():
        raise ValueError('Bronbestand ontbreekt.')
    if output.exists():
        raise ValueError('Uitvoermap bestaat al. Kies een nieuwe map; niets wordt overschreven.')
    if source == output or output in source.parents:
        raise ValueError('Uitvoermap mag het bronbestand niet bevatten.')
    text = source.read_text(encoding='utf-8-sig')
    if not re.search(r'</body>\s*</html>\s*$', text, re.I):
        raise ValueError('Onvolledig HTML-bestand: afsluitende body/html ontbreken.')
    if not re.search(r'<html\b', text, re.I):
        raise ValueError('Geen volledig HTML-document.')
    files = {}
    def style(match):
        number = sum(name.endswith('.css') for name in files) + 1
        name = f'assets/css/styles-{number}.css'
        files[name] = match.group(1).strip() + '\n'
        return f'<link rel="stylesheet" href="./{name}">'
    html = re.sub(r'<style\s*>(.*?)</style\s*>', style, text, flags=re.I | re.S)
    def script(match):
        code = match.group(1)
        number = sum(name.endswith('.js') for name in files) + 1
        marker = '// Supabase Auth via HTTPS REST; geen externe SDK nodig.'
        if marker in code:
            before, after = code.split(marker, 1)
            dashboard = 'assets/js/dashboard.js'
            auth = 'assets/js/auth.js'
            if dashboard in files or auth in files:
                raise ValueError('Meerdere authenticatieblokken: handmatige controle nodig.')
            files[dashboard] = before.strip() + '\n'
            files[auth] = marker + after.rstrip() + '\n'
            return f'<script src="./{dashboard}"></script>\n<script src="./{auth}"></script>'
        name = f'assets/js/script-{number}.js'
        files[name] = code.strip() + '\n'
        return f'<script src="./{name}"></script>'
    # Classic scripts stay classic and retain their original order and shared scope.
    html = re.sub(r'<script\s*>(.*?)</script\s*>', script, html, flags=re.I | re.S)
    if not files:
        raise ValueError('Geen inline CSS of klassieke scripts gevonden.')
    files['index.html'] = html
    manifest = {
        'source_sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(),
        'files': {name: hashlib.sha256(content.encode('utf-8')).hexdigest()
                  for name, content in files.items()},
        'warning': 'Opsplitsing is geen browser-, JavaScript- of beveiligingstest.'
    }
    files['split-manifest.json'] = json.dumps(manifest, indent=2) + '\n'
    files['README.txt'] = (
        'Dashboard opgesplitst; bronbestand niet gewijzigd.\n'
        'Start vanuit deze map: python -m http.server 8080\n'
        'Open http://localhost:8080 en test registratie, login, alle pagina’s,\n'
        'donkere modus, rekeningen, transacties en back-up.\n'
        'Controleer ook de browserconsole. Lokale login vereist een toegestane\n'
        'redirect-URL in Supabase. Publiceer daarna index.html en assets samen.\n'
        'Financiële opslag blijft lokaal; sociale providers moeten ingesteld zijn.\n'
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.dashboard-split-', dir=output.parent))
    try:
        for name, content in files.items():
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding='utf-8')
        temporary.rename(output)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    print(f'{len(files)} bestanden aangemaakt in {output}. Bron niet gewijzigd.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Veilig dashboard opsplitsen')
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path('dist'))
    args = parser.parse_args()
    try:
        split(args.source, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Niet uitgevoerd: {error}\n')
