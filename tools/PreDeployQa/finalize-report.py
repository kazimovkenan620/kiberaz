"""Yalnız bu audit snapshot-ı: əl ilə yoxlanmış gate/suite qeydləri və JSON nəticələri.
Yeni run üçün gate assertion-ları yenidən yoxlanmalıdır; bu skript test icra etmir.
Tətbiqə və DB-yə müraciət etmir. Statistika yaranmış matrisdən hesablanır.
"""
import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = '20260917T-predeploy-132107'
OUT = ROOT / 'docs' / 'qa' / RUN
META = json.loads((OUT / 'run.json').read_text(encoding='utf-8-sig'))
NOW = datetime.now(timezone.utc).isoformat()
rows = []

def read(name):
    return json.loads((OUT / 'evidence' / name).read_text(encoding='utf-8-sig'))

def table(name, pattern):
    for line in (OUT / name).read_text(encoding='utf-8-sig').splitlines():
        if re.match(pattern, line):
            yield [x.strip() for x in line.strip('|').split('|')]

def add(tid, feature, level, status, actual, evidence, account='QA', steps='', expected='', feature_state='IMPLEMENTED', bug='', priority='P1', coverage='SCENARIO', mode='LOCAL'):
    rows.append(dict(TestId=tid, Feature=feature, FeatureState=feature_state, EvidenceType=level,
        Account=account, Priority=priority, Precondition='İzolə audit; run.json; əlavə şərtlər Steps və inventarda',
        TestData=RUN, Steps=steps or feature, Expected=expected or 'Göstərilən kontrakt və bütün plan assertion-ları ödənir',
        Actual=actual, Status=status, Evidence=evidence, BugId=bug, Timestamp=NOW, RunId=RUN,
        Commit=META['commit'], Coverage=coverage, IntegrationMode=mode, OriginalId=tid))

superseded={'API-008','API-008-R','API-013','EXT-003','EXT-004','EXT-008','BOUND-002'}
bugmap={'EXT-001':'BUG-005','BE-002':'BUG-003','BE-003':'BUG-004','BE-005':'BUG-001','BE-007':'BUG-006','BE-011':'BUG-001'}
for r in read('api-results.json'):
    if r['TestId'] in superseded:
        continue
    r=dict(r); r['OriginalId']=r['TestId']; r['TestId']='RUN-'+r['TestId']
    r['Coverage']='SCENARIO';r['IntegrationMode']='LOCAL'
    r['BugId']=bugmap.get(r['OriginalId'],'')
    if r['OriginalId'] in {'EXT-003-R','EXT-004-R','EXT-005'}:
        r['IntegrationMode']='FIXTURE_TOKEN; SMTP_NOT_VERIFIED'
    rows.append(r)
browser={}
for name in ['browser-results.json','browser-retest-results.json','browser-roles-results.json','browser-deadline-results.json']:
    for r in read(name):
        r=dict(r);r['Evidence']='evidence/'+name;browser[r['TestId']]=r
for r in browser.values():
    r['OriginalId']=r['TestId'];r['TestId']='RUN-'+r['TestId'];r['Coverage']='SCENARIO'
    r['BugId']=bugmap.get(r['OriginalId'],'');r['IntegrationMode']='LOCAL'
    if r['OriginalId']=='BE-008':r['IntegrationMode']='MOCKED/SANDBOX: OFFICIAL_TURNSTILE_TEST_KEY; SMTP_NOT_VERIFIED'
    rows.append(r)

gates=[
('BUILD-01','Backend restore/Release build','backend-build.txt','dotnet restore; dotnet build Kiberaz.sln -c Release --warnaserror'),
('BUILD-02','Backend publish','backend-publish.txt','dotnet publish Kiberaz.Api -c Release; ayrıca temp publish'),
('BUILD-03','Frontend isolated lockfile restore','frontend-isolated.txt','npm ci; ayrı temp/ui'),
('BUILD-04','Frontend final typecheck/lint','frontend-final.txt','npx tsc --noEmit -p tsconfig.app.json; npm run lint'),
('BUILD-05','Frontend production build final','frontend-build-final.txt','npm run build; localhost API/test CAPTCHA build environment'),
('BUILD-06','Backend final release gate','final-build.txt','dotnet build Kiberaz.sln -c Release --warnaserror'),
('HYGIENE-01','Tracked mənbə bütövlüyü','final-hygiene.txt','Baseline SHA256 müqayisəsi; git diff --check'),
]
for tid,feature,ev,cmd in gates:
    add(tid,feature,'STATIC_ONLY','PASS','Exit 0; müvafiq command output sübutdadır','evidence/'+ev,steps=cmd)
add('DEP-01','npm lockfile advisory audit','STATIC_ONLY','PASS','Audit cavabında məlum vulnerability sayı 0; zəmanət deyil','evidence/npm-audit.json',steps='npm audit --json')
add('DEP-02','NuGet advisory audit','STATIC_ONLY','PASS','Cari mənbələrdən məlum vulnerable package bildirilmədi','evidence/nuget-audit.txt',steps='dotnet list Kiberaz.sln package --vulnerable --include-transitive')
add('REL-CFG-01','Publish local secret faylı','STATIC_ONLY','FAIL','Local JSON publish daxilindədir; source ilə hash eynidir','RELEASE-CONFIG-REVIEW.md; QA-BUGS.md',bug='BUG-002')
add('UNIT-01','Ayrıca unit test layihəsi','UNIT','N/A','Solution-da ayrıca test SDK layihəsi yoxdur; dotnet test exit 0 assertion sübutu deyil','evidence/dotnet-test.txt')
add('UNIT-02','Frontend unit test script','UNIT','N/A','package.json-da test script yoxdur','FRONTEND-INVENTORY.md')
add('SEC-001','Mövcud security regression suite','INTEGRATION','PASS','Son run: 516/516 assertion, 29 imtiyazlı route, exit 0. İki run eyni test dəstidir','REGRESSION-RESULTS.md; evidence/security-regression-final.txt',steps='dotnet run --project tools/SecurityRegressionTests',mode='LOCAL + EMAIL_CAPTURE_TEST_DOUBLE')
for n,p in enumerate(read('production-startup-probes.json'),1):
    add('PROD-START-'+str(n),p['name'],'INTEGRATION','PASS' if p['passed'] else 'FAIL',f"Expected fail-fast; exit {p['exitCode']}; listener={p['listenerObserved']}",'evidence/production-startup-probes.json',steps='powershell -File tools/PreDeployQa/prod-startup-probes.ps1',mode='ISOLATED_PRODUCTION_STARTUP_NEGATIVE')
add('DB-001','Offline LiteDB inspection','INTEGRATION','PASS','API dayandırıldı; ReadOnly=true; 12 users, 5 roles, 5 exams/attempts, 1 course/class/result, 3 uploads','evidence/offline-db-inspection.json; evidence/cleanup.txt',steps='PreDeployQa.dll inspect; yalnız sintetik runtime yolu',expected='Baza yalnız oxunur; qeydiyyat və test entity-ləri saxlanıb')

fe={c[0]:c for c in table('FRONTEND-INVENTORY.md',r'^\| FE-\d{3} \|')}
for c in table('GAP-ANALYSIS.md',r'^\| FE-\d{3} \|'):
    source=fe[c[0]]
    add('GAP-'+c[0],source[1]+' — qalan geniş plan','BROWSER_E2E',c[1],c[2]+'; qalan: '+c[3],
        'FRONTEND-INVENTORY.md; GAP-ANALYSIS.md',account=source[3] if len(source)>4 else 'Hamı',steps=source[2]+('; '+source[4] if len(source)>4 else ''),
        coverage='PARTIAL' if 'PARTIAL' in c[2] or 'FAIL' in c[2] else 'NONE',
        feature_state='PARTIALLY_IMPLEMENTED' if c[0]=='FE-007' else 'IMPLEMENTED')
api={c[0].split()[0]:c for c in table('BACKEND-INVENTORY.md',r'^\| API-\d{3} NOT_RUN \|')}
for c in table('GAP-ANALYSIS.md',r'^\| INV/API-\d{3} \|'):
    tid=c[0].split('/')[1];source=api[tid]
    add('GAP-INV-'+tid,c[1]+' — bütün rol/state/validation kombinasiyaları','API_RUNTIME','NOT_RUN',
        'Mövcud alt-sübut: '+c[3]+'; '+c[4], 'BACKEND-INVENTORY.md; GAP-ANALYSIS.md',account=source[2],
        steps=source[3]+'; owner/non-owner/wrong-role/invalid/empty/duplicate variantları',expected=source[4],
        coverage='PARTIAL' if 'PARTIAL' in c[4] else 'NONE')
for tid,title,reason in [
('EXT-REAL-01','SMTP registration/confirmation/reset/change tam roundtrip','Test mailbox/sink yoxdur; fixture token real delivery deyil'),
('EXT-REAL-02','Google OAuth real provider və linking','İcazəli provider test hesabı/config yoxdur'),
('EXT-REAL-03','Turnstile real secret/hostname','Yalnız rəsmi test widget/key yoxlanıb'),
('HOST-01','Hosting DNS/TLS/proxy/CDN/cache/production cookie','Deploy/staging host bu auditə verilməyib'),
('HOST-02','Production storage ACL/topology/backup restore','Hədəf host/persistent disk və backup snapshot verilməyib'),
]:
    add(tid,title,'INTEGRATION','BLOCKED',reason,'GAP-ANALYSIS.md',coverage='NONE',mode='REAL_PROVIDER_OR_HOST')
for tid,title in [('LIFE-01','CourseExpirySweeper və orphan upload lifecycle'),('DB-002','Bütün kolleksiyalarda normalized duplicate/orphan/audit invariantları'),('LIMIT-01','Production rate-limit 429 və UI retry')]:
    add(tid,title,'INTEGRATION','NOT_RUN','Bu geniş lifecycle ssenarisi icra edilməyib; static/service subset bütün lifecycle deyil','GAP-ANALYSIS.md',coverage='PARTIAL')
add('SCOPE-01','Teacher imtahan təyin etməsi','BROWSER_E2E','N/A','Cari kontraktda imtahan hostu VIP-dir; Teacher assignment funksiyası yoxdur','ROLE-PERMISSION-MATRIX.md',feature_state='OUT_OF_SCOPE')
add('SCOPE-02','Real ödəniş','INTEGRATION','N/A','Cari scope-da payment provider yoxdur; real ödəniş qadağandır','FRONTEND-INVENTORY.md',feature_state='OUT_OF_SCOPE')

fields=['TestId','OriginalId','Feature','FeatureState','EvidenceType','IntegrationMode','Coverage','Account','Priority','Precondition','TestData','Steps','Expected','Actual','Status','Evidence','BugId','Timestamp','RunId','Commit','RequestRange']
with (OUT/'QA-TEST-MATRIX.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
counts={level:dict(Counter(r['Status'] for r in rows if r['EvidenceType']==level)) for level in sorted({r['EvidenceType'] for r in rows})}
totals=dict(Counter(r['Status'] for r in rows))
def pct(a,b):return f'{a}/{b} ({a/b:.1%})' if b else 'N/A (0/0)'
summary=['| Sübut səviyyəsi | PASS | FAIL | BLOCKED | NOT_RUN | N/A | Execution coverage | Runtime pass rate |','|---|---:|---:|---:|---:|---:|---|---|']
for level,c in counts.items():
    p,f,b,n,na=[c.get(s,0) for s in ['PASS','FAIL','BLOCKED','NOT_RUN','N/A']]
    summary.append(f'| {level} | {p} | {f} | {b} | {n} | {na} | {pct(p+f,p+f+b+n)} | {pct(p,p+f) if level in ("API_RUNTIME","BROWSER_E2E") else "N/A — ayrıca gate/suite"} |')
summary='\n'.join(summary)
(OUT/'evidence/matrix-summary.json').write_text(json.dumps({'generatedUtc':NOW,'totalRows':len(rows),'totals':totals,'byEvidenceType':counts},ensure_ascii=False,indent=2),encoding='utf-8')
intro='''# QA test matrisi — yekun snapshot

Audit **INCOMPLETE**, release **NO-GO**. Tam metadata, addımlar, expected/actual, tarix, run/commit və request range [CSV](QA-TEST-MATRIX.csv)-dədir. Bu Markdown onun oxunaqlı indeksidir.

`RUN-*` faktiki icra olunmuş məhdud ssenarilərdir. `GAP-FE-*` və `GAP-INV-*` inventardakı geniş planların hələ qapanmayan hissələridir; keçmiş altaddımları ikinci dəfə PASS saymır. Bunlar atomik assertion sayı deyil. Geniş planların konservativ məxrəci auditin tamamlanmadığını göstərir; faiz bütün məhsulun doğruluq ehtimalı deyil. NOT_RUN/BLOCKED timestamp icra vaxtı deyil, planın son qiymətləndirmə vaxtıdır.

İlkin harness/environment/oracle səhvləri raw evidence-də saxlanıb; son düzgün oracle nəticəsi məntiqi ssenaridə sayılır. Səbəblər [gap-analysis](GAP-ANALYSIS.md)-dədir. Məhsul FAIL-ləri retry ilə gizlədilmir. Registration CAPTCHA sınağı SANDBOX-dur; SMTP və Google real inteqrasiya PASS deyil. Security suite-in 516 assertion-u ayrıca vahiddir, 516 E2E ssenari kimi sayılmır.

'''
def cell(v):return str(v).replace('|',' / ').replace('\n',' ')
lines=[intro,summary,'\n| Test ID | Feature / qalan plan | Sübut | Status | Əhatə | Bug |','|---|---|---|---|---|---|']
for r in rows:lines.append('| '+' | '.join(cell(r.get(k,'')) for k in ['TestId','Feature','EvidenceType','Status','Coverage','BugId'])+' |')
(OUT/'QA-TEST-MATRIX.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
(OUT/'evidence/matrix-counts.md').write_text(summary+'\n',encoding='utf-8')
print(json.dumps({'rows':len(rows),'totals':totals,'levels':counts},ensure_ascii=False))
