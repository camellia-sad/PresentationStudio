"""Read-only consistency check between installed renderer and maintained source."""
from pathlib import Path
import re
import hashlib
import base64
import html

root = Path(__file__).resolve().parent.parent
installed = Path('D:/PresentationStudio/resources/app')
document = (installed / '汇报工作台.html').read_text(encoding='utf-8')
policy = html.unescape(re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', document)[1])
mapping = {'core': 'core.js', 'preview': 'preview-renderer.js', 'ui': 'editor-ui.js', 'stepnav': 'step-navigation.js', 'tools': 'editor-tools.js', 'sidebar': 'sidebar-layout.js', 'projects': 'project-manager.js', 'layers': 'layer-tools.js', 'components': 'component-library.js', 'template': 'template-editor.js', 'motion': 'motion-editor.js', 'welcome': 'welcome.js', 'effects': 'effects.js', 'app': 'app.js'}
for name, file in mapping.items():
    script = re.search(f'<script id="studio-{name}">([\\s\\S]*?)</script>', document)[1]
    assert script.strip() == (root / file).read_text(encoding='utf-8').strip(), name
    digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
    assert 'sha256-' + digest in policy, f'CSP {name}'
assert (installed / 'core.js').read_bytes() == (root / 'core.js').read_bytes()
print('PASS: installed renderer matches maintained source and all renderer CSP hashes')
