"""QA mətn sübutlarının məxfilik/link/count yoxlaması; secret dəyərlərini çıxarmır."""
import csv
import hashlib
import json
import os
import re
from pathlib import Path

root=Path(__file__).resolve().parents[2]
run='20260917T-predeploy-132107'
report=root/'docs/qa'/run
private=Path(os.environ['TEMP'])/run
secrets=set()
def collect(obj):
    if isinstance(obj,dict):
        for key,value in obj.items():
            if re.search(r'password|secret|token|email',key,re.I) and isinstance(value,str) and len(value)>=10:
                if not value.startswith('1x000000') and not value.endswith('@example.invalid'):
                    secrets.add(value)
            if isinstance(value,(dict,list)):collect(value)
    elif isinstance(obj,list):
        for item in obj:collect(item)
for file in (private/'runtime').glob('*.json'):
    try:collect(json.loads(file.read_text(encoding='utf-8-sig')))
    except (ValueError,UnicodeError):pass
local=root/'Kiberaz.Api/appsettings.Local.json'
if local.exists():
    # Sadə string property-lər; JSON comment-ləri olan local config üçün də işləyir.
    for key,value in re.findall(r'"([^"\n]+)"\s*:\s*"((?:\\.|[^"\\])*)"',local.read_text(encoding='utf-8-sig')):
        try:collect({key:json.loads('"'+value+'"')})
        except ValueError:pass
hits=[]
files=[p for base in [report,root/'tools/PreDeployQa'] for p in base.rglob('*')
       if p.is_file() and not any(s in p.parts for s in ('.artifacts','__pycache__'))
       and p.suffix in ('.md','.txt','.json','.csv','.py','.cjs','.cs','.ps1','.csproj')]
for file in files:
    body=file.read_text(encoding='utf-8-sig',errors='replace')
    if any(secret in body for secret in secrets):hits.append(str(file.relative_to(root)))
changes=[]
for line in (report/'evidence/baseline-tracked-sha256.txt').read_text(encoding='utf-8-sig').splitlines():
    m=re.match(r'([A-Fa-f0-9]{64})  (.+)',line)
    if m:
        file=root/m[2]
        if not file.exists() or hashlib.sha256(file.read_bytes()).hexdigest().lower()!=m[1].lower():changes.append(m[2])
rows=list(csv.DictReader((report/'QA-TEST-MATRIX.csv').open(encoding='utf-8-sig',newline='')))
missing=[]
for row in rows:
    for ev in row['Evidence'].split(';'):
        if not (report/ev.strip()).exists():missing.append(ev.strip())
summary={'textFilesChecked':len(files),'knownSensitiveValueMatches':hits,'trackedHashDifferences':changes,
         'matrixRows':len(rows),'uniqueTestIds':len({r['TestId'] for r in rows}),'missingEvidencePaths':sorted(set(missing)),
         'limits':'Known secret value scan of text only; screenshots were visually inspected separately. Not a generic secret detector.'}
(report/'evidence/artifact-verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
raise SystemExit(1 if hits or changes or missing or len(rows)!=len({r['TestId'] for r in rows}) else 0)
