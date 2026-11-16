"""Synchronize tutorial copies without rebuilding executable application code."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import os

ROOT = Path(__file__).resolve().parent.parent
GUIDE = ROOT / 'agent/AGENT_GUIDE.md'
TAG = re.compile(rb'(<script id="agent-guide" type="application/json">)(.*?)(</script>)', re.S)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def html_update(original, text):
    matches = list(TAG.finditer(original))
    if len(matches) != 1:
        raise ValueError('Expected exactly one agent-guide data script')
    match = matches[0]
    payload = json.dumps(text, ensure_ascii=False).replace('<', '\\u003c').encode('utf-8')
    updated = original[:match.start(2)] + payload + original[match.end(2):]
    assert json.loads(TAG.search(updated).group(2)) == text
    # Removing the tutorial leaves identical bytes, including scripts, CSP and project.
    assert TAG.sub(b'GUIDE', updated) == TAG.sub(b'GUIDE', original)
    return updated


def atomic_write(path, data):
    temp = path.with_name(path.name + '.guide-sync.tmp')
    created = False
    try:
        with temp.open('xb') as stream:
            created = True
            stream.write(data)
        os.replace(temp, path)
    finally:
        if created and temp.exists():
            temp.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--installed', action='store_true', help='Also update D:/PresentationStudio')
    args = parser.parse_args()
    guide_bytes = GUIDE.read_bytes()
    guide_text = GUIDE.read_text(encoding='utf-8')
    release = ROOT / 'release/汇报工作台-Windows-x64'
    targets = [(ROOT / '汇报工作台.html', True),
               (release / 'resources/app/汇报工作台.html', True),
               (release / 'Agent教程/AGENT_GUIDE.md', False)]
    # Local build products may not exist in a clean checkout.
    targets = [(p, html) for p, html in targets if p.is_file()]
    if args.installed:
        installed = Path('D:/PresentationStudio')
        targets.extend([(installed / 'resources/app/汇报工作台.html', True),
                        (installed / 'Agent教程/AGENT_GUIDE.md', False)])
    prepared = []
    for path, html in targets:
        before = path.read_bytes()
        after = html_update(before, guide_text) if html else guide_bytes
        prepared.append((path, before, after))
    backup = ROOT / 'docs/guide-sync-backup' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup.mkdir(parents=True)
    records = []
    for index, (path, before, after) in enumerate(prepared):
        saved = backup / f'{index:02d}-{path.name}'
        saved.write_bytes(before)
        assert saved.read_bytes() == before
        records.append({'path': str(path), 'backup': str(saved), 'before': digest(before),
                        'after': digest(after), 'changed': before != after})
    (backup / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    changed = []
    try:
        for path, before, after in prepared:
            if path.read_bytes() != before:
                raise RuntimeError(f'Target changed during preparation: {path}')
            if before != after:
                atomic_write(path, after)
                changed.append((path, before))
            if path.read_bytes() != after:
                raise RuntimeError(f'Verification failed: {path}')
    except Exception:
        for path, before in reversed(changed):
            atomic_write(path, before)
        raise
    result = {'guide': str(GUIDE), 'installed': args.installed,
              'nonGuideHtmlBytesUnchanged': True, 'files': records}
    (ROOT / 'docs/guide-sync-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Guide verified in {len(prepared)} copies; updated {len(changed)}. Scripts/CSP/project data preserved.')


if __name__ == '__main__':
    main()
