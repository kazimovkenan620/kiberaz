"""Release sübutları: məxfi dəyərlər çıxarılmadan mətn, manifest və mənbə snapshot yoxlaması."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/deployment/evidence-2026-09-17'
release = root / 'artifacts/releases/20260917-161219-647464fc'
private = Path(os.environ['TEMP']) / 'kiberaz-releasefix-20260917/runtime'
sensitive = set()

def collect(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if re.search(r'password|secret|token', key, re.I) and isinstance(item, str) and len(item) >= 12:
                if not item.startswith(('1x000000', '2x000000', '3x000000')):
                    sensitive.add(item)
            if isinstance(item, (dict, list)):
                collect(item)
    elif isinstance(value, list):
        for item in value:
            collect(item)

for file in private.glob('*.json'):
    try:
        collect(json.loads(file.read_text(encoding='utf-8-sig')))
    except (ValueError, UnicodeError):
        pass
local = root / 'Kiberaz.Api/appsettings.Local.json'
if local.exists():
    for key, value in re.findall(r'"([^"\n]+)"\s*:\s*"((?:\\.|[^"\\])*)"', local.read_text(encoding='utf-8-sig')):
        try:
            collect({key: json.loads('"' + value + '"')})
        except ValueError:
            pass

tracked = subprocess.check_output(['git', 'diff', '--name-only'], cwd=root, text=True).splitlines()
extra = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=root, text=True).splitlines()
paths = {root / name for name in tracked + extra if not name.startswith(('docs/qa/', 'tools/PreDeployQa/'))}
text_extensions = {'.md', '.txt', '.json', '.csv', '.py', '.cjs', '.mjs', '.cs', '.tsx', '.ts', '.ps1', '.csproj', '.sh', '.example', '.service'}
checked = [p for p in paths if p.is_file() and p.suffix in text_extensions]
hits = [str(p.relative_to(root)) for p in checked if any(s in p.read_text(encoding='utf-8-sig', errors='replace') for s in sensitive)]

manifest = json.loads((release / 'manifest.json').read_text(encoding='utf-8-sig'))
mismatches = []
for entry in manifest:
    file = release / entry['path']
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest().lower() != entry['sha256'].lower():
        mismatches.append(entry['path'])
lock_unchanged = subprocess.run(['git', 'diff', '--quiet', '--', 'kiberaz-ui/package.json', 'kiberaz-ui/package-lock.json'], cwd=root).returncode == 0
snapshot = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths) if p.is_file() and not str(p.relative_to(root)).startswith('docs')}
(evidence / 'source-sha256.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
result = {
    'textFilesChecked': len(checked), 'knownSensitiveValueMatches': hits,
    'releasePath': str(release.relative_to(root)), 'manifestEntries': len(manifest),
    'manifestMismatches': mismatches, 'frontendDependencyManifestsUnchanged': lock_unchanged,
    'limitations': 'Yalnız məlum məxfi dəyərlər və mətn faylları; screenshot-lar ayrıca vizual yoxlanır.'
}
(evidence / 'artifact-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=True))
raise SystemExit(1 if hits or mismatches or not lock_unchanged else 0)
