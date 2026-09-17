"""Əlavə API kontraktı və fixture-token sərhədləri. SMTP E2E sübutu deyil."""
import importlib,json,sys,secrets,base64
q=importlib.import_module('audit-api')
q.results=json.loads((q.OUT/'api-results.json').read_text(encoding='utf8'))
q.requests=json.loads((q.OUT/'api-requests.json').read_text(encoding='utf8'))
q.ctx=json.loads((q.PRIVATE/'api-context.json').read_text(encoding='utf8'))
for alias in ['UserA','TeacherA','TeacherB','VIPA','VIPB','AdminA','ModeratorA']:q.login(alias)

def owner_profile():
    before=q.ok('GET','/api/User/profile','AdminA')
    s,b,h=q.call('PUT','/api/User/profile','AdminA',{'firstName':'QA Dəyişmiş','lastName':'Sahib','nickname':q.accounts['AdminA']['nickname'],'gender':1})
    after=q.ok('GET','/api/User/profile','AdminA')
    q.require(s in (400,403) and before==after,f'Owner immutable profile expected; PUT status={s}, firstName changed={before["firstName"]!=after["firstName"]}')

def refresh_cookie():
    a=q.accounts['ModeratorA'];s,b,h=q.call('POST','/api/auth/login','ModeratorA',{'email':a['email'],'password':a['password']})
    cookie=next((v for k,v in h.items() if k.lower()=='set-cookie'),'')
    presence={'httpOnly':'httponly' in cookie.lower(),'sameSiteStrict':'samesite=strict' in cookie.lower(),'secure':'secure' in cookie.lower(),'refreshTokenBodyEmpty':not b.get('data',{}).get('refreshToken')}
    q.require(presence['httpOnly'] and presence['sameSiteStrict'] and presence['refreshTokenBodyEmpty'],'cookie/body policy mismatch')
    q.ok('POST','/api/auth/refresh','ModeratorA',{})
    return str(presence)+'; Development Secure=false expected'

def invalid_links():
    registered=q.ok('GET','/api/admin/users?search=qa_ui_132107','AdminA')
    pending=next(x['id'] for x in registered if x['nickname']=='qa_ui_132107')
    for p,b in [('/api/auth/confirm-email',{'userId':pending,'token':'QA_INVALID'}),('/api/auth/reset-password',{'userId':q.accounts['UserA']['id'],'token':'QA_INVALID','newPassword':'Qa1!'+secrets.token_hex(10),'confirmPassword':'bad'}),('/api/User/confirm-email-change',{'userId':q.accounts['UserA']['id'],'newEmail':'qa_change@example.invalid','token':'QA_INVALID'}),('/api/auth/google/exchange',{'code':'QA_INVALID'})]:
        s,d,h=q.call('POST',p,body=b);q.require(s in (400,401),f'{p}: invalid token accepted {s}')

def confirmation():
    token=next(t for t in json.loads((q.PRIVATE/'tokens.private.json').read_text()) if t['label']=='Unconfirmed')
    q.ok('POST','/api/auth/confirm-email',body={'userId':token['userId'],'token':token['confirmationToken']})
    q.login('Unconfirmed')
    s,b,h=q.call('POST','/api/auth/confirm-email',body={'userId':token['userId'],'token':token['confirmationToken']})
    q.require(s==200,'confirmed-account idempotence contract violated')
    return 'Fixture-issued confirmation→real API→login; replay idempotent 200 per AuthService:571–587. SMTP NOT tested'

def reset():
    token=next(t for t in json.loads((q.PRIVATE/'tokens.private.json').read_text()) if t['label']=='UserA')
    old=q.accounts['UserA']['password'];new='Qa1!'+secrets.token_hex(18)
    body={'userId':token['userId'],'token':token['passwordResetToken'],'newPassword':new,'confirmPassword':new}
    q.ok('POST','/api/auth/reset-password',body=body)
    q.deny('GET','/api/auth/me','UserA',statuses=(401,))
    s,b,h=q.call('POST','/api/auth/login',body={'email':q.accounts['UserA']['email'],'password':old});q.require(s==401,'old password accepted')
    q.accounts['UserA']['password']=new
    for a in q.accounts_doc['accounts']:
        if a['alias']=='UserA':a['password']=new
    (q.PRIVATE/'accounts.json').write_text(json.dumps(q.accounts_doc))
    q.login('UserA');q.require(q.call('POST','/api/auth/reset-password',body=body)[0]==400,'reset token reused')
    return 'Fixture-issued reset; old password/session rejected; new login; token reuse rejected. SMTP NOT tested'

def revision():
    cid=q.ctx['courseId'];old=q.ok('GET',f'/api/Course/{cid}')
    payload={k:v for k,v in old.items() if k in ['instructorName','instructorRole','instructorCompany','instructorPhotoUrl','linkedInUrl','gitHubUrl','contactEmail','contactPhone','courseTitle','kicker','description','duration','level','language','syllabusTopics','syllabusFileUrl','accentColor']}
    payload['courseTitle']='QA REV '+q.RUN
    q.ok('PUT',f'/api/Course/{cid}','VIPA',payload)
    q.require(q.ok('GET',f'/api/Course/{cid}')['courseTitle']==old['courseTitle'],'pending revision visible publicly')
    q.ok('PATCH',f'/api/admin/courses/{cid}/revision/approve','AdminA')
    q.require(q.ok('GET',f'/api/Course/{cid}')['courseTitle']==payload['courseTitle'],'approved revision not visible')

def admin_bank():
    c=q.ok('POST','/api/quiz/categories','AdminA',{'title':'QA CRUD '+q.RUN,'description':'Sintetik audit kateqoriyası','icon':'shield','color':'#00FFFF','topics':['QA'],'sortOrder':9},status=201)
    cid=c['id'];payload={'categoryId':cid,'difficulty':'Başlanğıc','question':'QA CRUD sintetik sual','correctKey':'A','isExamOnly':False,'options':[{'key':k,'text':'Sintetik '+k,'explanation':'QA izahı'} for k in 'ABCD']}
    # DTO spelling is discovered from the application contract.
    payload['categoryId']=cid
    s,b,h=q.call('POST','/api/quiz/questions','AdminA',payload);q.require(s==201,f'question creation status={s}; errors={b.get("errors")}')
    qid=b['data']['id'];q.ok('DELETE',f'/api/quiz/questions/{qid}','AdminA');q.ok('POST',f'/api/quiz/questions/{qid}/restore','AdminA')
    q.ok('DELETE',f'/api/quiz/categories/{cid}','AdminA');q.ok('POST',f'/api/quiz/categories/{cid}/restore','AdminA')
    return 'Category/question create, soft-delete and restore performed'

def admin_views():
    for p in ['/api/admin/stats','/api/admin/users?take=1','/api/admin/courses','/api/admin/exam-sessions','/api/admin/audit?take=10','/api/quiz/admin/categories','/api/quiz/admin/questions','/api/admin/users/'+q.accounts['UserA']['id']]:q.ok('GET',p,'AdminA')

def restart():
    aid=q.ctx['attemptId'];a=q.ok('GET',f'/api/exam-sessions/attempts/{aid}','UserA');q.require(a['percentage']==50,'restart score lost')
    q.require(any(c['id']==q.ctx['classId'] for c in q.ok('GET','/api/User/teacher/classes','TeacherA')),'restart class lost')
    return 'API restarted after initial test; prior 50% attempt and teacher class persisted'

if '--corrected' in sys.argv:
    q.test('EXT-003-R','Invalid callback/exchange tokens','Guest','Invalid token on still-unconfirmed UIRegistration; other callbacks','400/401; no state transition',invalid_links)
    q.test('EXT-004-R','Fixture confirmation token boundary','Unconfirmed','Confirm fixture token; login; repeated confirmation','Idempotent 200 for confirmed account; no new privileges',confirmation)
    q.test('EXT-008-R','Admin question/category lifecycle','AdminA','Correct request DTO; create/delete/restore','Soft deletion and restoration',admin_bank)
    sys.exit(0)

q.test('EXT-001','Protected owner immutable profile','AdminA','Read; attempt self-edit; readback','Reject per AGENTS/SENIOR-RULES invariant',owner_profile,priority='P2')
q.test('EXT-002','Refresh transport','ModeratorA','Login headers flags only; cookie refresh','HttpOnly/Strict, empty refresh body; rotate works',refresh_cookie)
q.test('EXT-003','Invalid callback/exchange tokens','Guest','Invalid confirmation/reset/change-email/google-exchange','400/401; no authorization',invalid_links)
q.test('EXT-004','Fixture confirmation token boundary','Unconfirmed','Fixture token POST; login; replay','First accepts; already-confirmed account replay is idempotent 200',confirmation)
q.test('EXT-005','Fixture reset token boundary','UserA','Fixture token reset; old login/session; new login; replay','Revoke old, accept new, deny reuse',reset)
q.test('EXT-006','Course revision moderation','VIPA/AdminA','Edit approved; guest old; approve; guest new','Pending revision isolated',revision)
q.test('EXT-007','Admin read views','AdminA','GET stats/users/courses/exams/audit/private bank','Authorized data envelopes',admin_views)
q.test('EXT-008','Admin question/category lifecycle','AdminA','Create; delete; restore','Soft deletion and restoration',admin_bank)
q.test('EXT-009','Restart persistence','UserA/TeacherA','Read pre-restart result/class','50% and class preserved',restart)
