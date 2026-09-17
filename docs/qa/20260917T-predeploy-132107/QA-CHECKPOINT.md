# QA checkpoint — yekun təhvil

**Audit INCOMPLETE; release NO-GO.** Bu run dayandırılıb, arxa planda audit/test işi getmir. Mənbə `C:/Users/User/Desktop/kiberaz`; run/commit `run.json`-da. Production kodu dəyişməyib, tracked SHA256 fərqi 0. Yalnız QA sənədləri və test tooling əlavə olunub.

## Son təsdiqlənmiş vəziyyət

- Son backend Release, frontend production build/typecheck/lint və SecurityRegressionTests 516/516 keçib.
- Son API `FINAL-API-001` PASS: login/authorization/attempt/class/course readback. 38 canonical API ssenarisi: 37 PASS/1 FAIL.
- 16 canonical browser ssenarisi: 11 PASS/5 FAIL. BE-011 bir dəqiqəlik imtahanda 65 saniyə sonra auto-submit FAIL. BE-010 son düzgün error oracle ilə PASS.
- Production CAPTCHA 3/3 fail-closed probe PASS; real provider flow deyil.
- Audit API/UI dayandırıldı; offline ReadOnly LiteDB baxışı PASS. İstifadəçinin 5251/5173 prosesləri dayandırılmadı.
- 6 təsdiqlənmiş bug: P0=0/P1=2/P2=3/P3=1. QA-BUGS.md əsasdır.
- Matris: 273 sətir; 62 PASS/7 FAIL/9 BLOCKED/191 NOT_RUN/4 N/A. Geniş gap planları atomik assertion deyil; API/browser/suite/static vahidlərini qarışdırmayın.

## Dəqiq qalan iş

1. `RUN-BE-005`, `RUN-BE-011`, `REL-CFG-01`: P1 düzəlişindən sonra timer/deadline və təmiz publish paketini təkrar yoxlamaq. Bu audit-only tapşırığı düzəliş etməyib.
2. `RUN-BE-002`, `RUN-BE-003`, `RUN-EXT-001`, `RUN-BE-007`: token storage, unconfirmed resend, protected Admin profile, modal focus regressiyaları.
3. `EXT-REAL-01..03`, `HOST-01..02` və `GAP-FE-021/026/030/036`: test mailbox, Google test hesabı/config, real CAPTCHA və staging/hosting tələb olunur. Provider addımlarını fixture tokenlə PASS etməyin.
4. `GAP-FE-001..113`: CSV statusuna görə bütün qalan browser action/edge-case planları. Mövcud alt-sübutu GAP-ANALYSIS.md ilə əlaqələndirin; məlum FAIL-ləri gizlətməyin.
5. `GAP-INV-API-001..079`: endpoint-lərin qalan rol/owner/state/validation kombinasiyaları. INV/API-001 ilə RUN/API-001 ayrı namespace-dir.
6. `LIFE-01`, `DB-002`, `LIMIT-01`: expiry/orphan lifecycle, bütün normalized/orphan/audit invariantları, production 429 UI recovery. Bunlar hələ icra edilməyib.
7. Host runtime patch/storage/ACL/backup, HTTPS/cookie/CORS/proxy/CDN və SPA fallback. Local nəticədən production PASS çıxarmayın.

## Sübutlar və davam qaydası

Əsas hesabat PRE-DEPLOY-QA-REPORT.md; canonical nəticələr QA-TEST-MATRIX.csv; sayma evidence/matrix-summary.json. API raw/corrected nəticələri api-results.json və api-requests.json-dadır. Browser fayllarında eyni ID üçün son nəticə canonicaldır; ilk harness/oracle uğursuzluqları saxlanıb.

Private temp: `C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107`. DB/keys/credentials/config və publish Local JSON məxfidir, məzmununu loga/Git-ə çıxarmayın. Setup/start/test/cleanup üçün `tools/PreDeployQa/README.md`.

Mövcud fixture artıq dəyişib: UserA parolu reset edilib, Unconfirmed təsdiqlənib, UIRegistration hələ təsdiqlənməyib, course/exam credits istifadə olunub. Kor-koranə tam rerun ilkin state ssenarisini təkrarlamır. Məlumatı silməyin və init-in mövcud qovluğu rədd etməsini keçməyin. Yeni run üçün yeni RUN_ID və ayrı temp fixture yaradın; test helper allow-list yolunu yalnız QA tooling-də uyğunlaşdırın.

`python tools/PreDeployQa/finalize-report.py` yalnız mövcud sübutlardan matris/count yaradır, tətbiqi açmır. Yeni nəticə yaranarsa əsas hesabatdakı cədvəl və checkpoint sayları da yenilənməlidir.
