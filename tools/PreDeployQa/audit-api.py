"""Yalnız izolə QA bazasına qarşı API ssenariləri; production koduna toxunmur."""
import json, os, sys, time, urllib.request, urllib.error, http.cookiejar, pathlib, datetime, base64
ROOT = pathlib.Path(__file__).resolve().parents[2]
RUN = '20260917T-predeploy-132107'
PRIVATE = pathlib.Path(os.environ['TEMP']) / RUN / 'runtime'
OUT = ROOT / 'docs' / 'qa' / RUN / 'evidence'
BASE = 'http://localhost:5259'
accounts_doc = json.loads((PRIVATE/'accounts.json').read_text(encoding='utf-8-sig'))
accounts = {x['alias']: x for x in accounts_doc['accounts']}
sessions, tokens, results, requests = {}, {}, [], []
ctx = {}

def redact(value):
    if isinstance(value, dict):
        return {k: ('[REDACTED]' if any(s in k.lower() for s in ['token','password','email','stamp','hash','correctkey','correctoptionkey']) else redact(v)) for k,v in value.items()}
    if isinstance(value, list): return [redact(v) for v in value]
    return value

def call(method,path,alias=None,body=None,headers=None,raw=None):
    h={'Content-Type':'application/json', **(headers or {})}
    if alias and alias in tokens: h['Authorization']='Bearer '+tokens[alias]
    opener=sessions.setdefault(alias,urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())))
    data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    start=time.perf_counter()
    try: response=opener.open(urllib.request.Request(BASE+path,data=data,headers=h,method=method),timeout=20)
    except urllib.error.HTTPError as e: response=e
    status=response.code; payload=response.read()
    try: value=json.loads(payload)
    except (ValueError,UnicodeDecodeError): value={'bytes':len(payload)}
    requests.append({'method':method,'path':path,'alias':alias or 'Guest','status':status,'elapsedMs':round((time.perf_counter()-start)*1000),'body':redact(value),'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    return status,value,dict(response.headers)

def require(condition,message):
    if not condition: raise AssertionError(message)

def test(id,feature,alias,steps,expected,fn,priority='P1'):
    before=len(requests)
    row=dict(TestId=id,Feature=feature,FeatureState='IMPLEMENTED',EvidenceType='API_RUNTIME',Account=alias or 'Guest',Priority=priority,Precondition='İzolə Development, sintetik fixture; localhost:5259',TestData=RUN,Steps=steps,Expected=expected,Actual='',Status='NOT_RUN',Evidence='evidence/api-results.json; evidence/api-requests.json',BugId='',Timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),RunId=RUN,Commit='2a3f32f4e131fda77d668215c4ea83af20a6f8b5')
    try:
        actual=fn(); row.update(Status='PASS',Actual=str(actual or 'Bütün assertion-lar keçdi'))
    except AssertionError as e: row.update(Status='FAIL',Actual=str(e))
    except Exception as e: row.update(Status='BLOCKED',Actual=type(e).__name__+': '+str(e)[:180])
    row['RequestRange']=[before,len(requests)];results.append(row)
    (OUT/'api-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'api-requests.json').write_text(json.dumps(requests,ensure_ascii=False,indent=2),encoding='utf-8')
    print(id,row['Status'],row['Actual'][:150])

def ok(method,path,alias=None,body=None,status=200):
    s,b,h=call(method,path,alias,body)
    require(s==status,f'{method} {path}: expected {status}, actual {s}; message={b.get("message","")}')
    if 'success' in b: require(b['success'],f'{path}: success=false')
    return b.get('data',b)

def deny(method,path,alias=None,body=None,statuses=(401,403,404)):
    s,b,h=call(method,path,alias,body);require(s in statuses,f'{path}: expected {statuses}, actual {s}')
    require(not b.get('data'),f'{path}: denied response data mövcuddur')
    return f'HTTP {s}, cavabda resurs yoxdur'

def login(alias):
    a=accounts[alias]; b=ok('POST','/api/auth/login',alias,{'email':a['email'],'password':a['password']})
    tokens[alias]=b['accessToken']; me=ok('GET','/api/auth/me',alias)
    require(me.get('id',me.get('userId'))==a['id'],'Me identity mismatch')
    return 'Login və /me kimliyi uyğundur'

def main():
    test('API-001','Health/security headers',None,'GET /health','200 ok; nosniff və DENY',lambda: health())
    for i,alias in enumerate(accounts):
        if alias in ('Unconfirmed','Blocked'): continue
        test(f'AUTH-LOGIN-{i+1:02}','Rol login/me',alias,'POST login; GET me','Sintetik hesab kimliyi',lambda a=alias:login(a))
    ua='UserA'
    ub='UserB'
    ta='TeacherA';tb='TeacherB'
    va='VIPA';vb='VIPB'
    admin='AdminA'
    ctx.update(ua=ua,ub=ub,ta=ta,tb=tb,va=va,vb=vb,admin=admin)
    test('API-002','Guest restricted endpoints',None,'GET profile/classes/admin; POST submit','401; resurs yoxdur',lambda:[deny(m,p,body=b,statuses=(401,)) for m,p,b in [('GET','/api/User/profile',None),('GET','/api/User/teacher/classes',None),('GET','/api/admin/stats',None),('POST','/api/quiz/submit',{'questionId':1,'selectedKey':'A'})]])
    test('API-003','Wrong role',ua,'User → Teacher/VIP/Admin endpoints','403',lambda:[deny(m,p,ua,b,statuses=(403,)) for m,p,b in [('GET','/api/User/teacher/classes',None),('POST','/api/exam-sessions',{'title':RUN,'durationMinutes':5,'categories':[{'categoryId':accounts_doc['categories']['examId'],'count':4}]}),('GET','/api/admin/stats',None)]])
    test('API-004','Quiz public projection',None,'GET categories/questions; missing/count boundary','Cavab açarı/izahat yoxdur, private bank gizlidir',public_quiz)
    test('API-005','Quiz submit/duplicate scoring',ua,'Məlum sual, iki submit, overview read-back','Nəticə doğrudur, duplicate bal artırmır',quiz)
    test('API-006','Teacher class cross-owner',ta,'Create class; add User A; B add/read/delete denied; readback','Owner sees A, unrelated teacher cannot read/mutate',teacher)
    test('API-007','Exam deterministic scoring/ownership',va,'Create 4-question; User A join; non-owner read/save denied; 2 correct answers; submit twice; dashboard','50%; owner-only attempt/dashboard; duplicate same result',exam)
    test('API-008','Course publication/moderation',va,'Create pending; guest hidden; VIP B edit denied; admin approve; guest readback','Owner/admin boundaries, approved visible',course)
    test('API-009','Hidden administrator',admin,'GET users/stats/leaderboard','Protected owner excluded from user list and leaderboard',hidden)
    test('API-010','Profile ownership/overposting',ua,'PUT profile with other userId, role Admin; read both profiles','Only caller profile changes; roles stay User',profile)
    test('API-011','CORS explicit allowlist',None,'OPTIONS trusted/evil origins','Only configured origin allowed',cors)
    test('API-012','Registration validation',None,'POST empty and weak-password payloads','400 Azerbaijani errors',registration_validation)
    test('API-013','Upload auth/magic/filename',va,'User deny; VIP invalid magic; harmless PNG; GET stored','403/400; generated safe filename; bytes readback',upload)
    for alias in accounts:
        if alias in ('Unconfirmed','Blocked'):
            test('AUTH-STATE-'+alias,'Account state',alias,'POST login correct password','Giriş rədd edilir, token yoxdur',lambda a=alias: state_login(a))
    test('API-014','Logout revocation',ub,'POST logout; old token GET me; refresh','Old token and cookie rejected',lambda: logout(ub))
    # Browser creates its own login sessions; this is only continuation identifiers, no access tokens.
    (PRIVATE/'api-context.json').write_text(json.dumps(ctx,ensure_ascii=False,indent=2),encoding='utf-8')

def health():
    s,b,h=call('GET','/health');require(s==200 and b.get('status')=='ok','health mismatch')
    h={k.lower():v for k,v in h.items()};require(h.get('x-content-type-options')=='nosniff' and h.get('x-frame-options')=='DENY','headers missing')

def public_quiz():
    cats=ok('GET','/api/quiz/categories');pc=accounts_doc['categories']['publicId']; ec=accounts_doc['categories']['examId']
    qs=ok('GET',f'/api/quiz/questions?categoryId={pc}&count=500')
    require(len(qs)==4,'fixture public questions expected 4')
    require(all('correctKey' not in q and 'correctOptionKey' not in q and all('explanation' not in o for o in q['options']) for q in qs),'answer key/explanation leaked')
    require(ok('GET',f'/api/quiz/questions?categoryId={ec}')==[],'private exam questions leaked')
    require(call('GET','/api/quiz/questions?categoryId=-1')[0]==400,'negative category accepted')
    ctx['question']=qs[0];return f'{len(cats)} kateqoriya, 4 public sual, private bank sızmır'

def quiz():
    ua=ctx['ua'];q=ctx['question'];key=q['options'][0]['key']
    b=ok('POST','/api/quiz/submit',ua,{'questionId':q['id'],'selectedKey':key})
    first=ok('GET','/api/User/me/overview',ua)
    ok('POST','/api/quiz/submit',ua,{'questionId':q['id'],'selectedKey':key})
    second=ok('GET','/api/User/me/overview',ua)
    require(first==second,'duplicate submit overview changed')
    require(isinstance(b.get('isCorrect'),bool),'no scoring')
    return 'Scored response; duplicate overview identical'

def teacher():
    ta,tb,ua,ub=(ctx[x] for x in ['ta','tb','ua','ub'])
    cl=ok('POST','/api/User/teacher/classes',ta,{'name':'QA '+RUN});cid=cl['id'];ctx['classId']=cid
    ok('POST',f'/api/User/teacher/classes/{cid}/students',ta,{'studentId':accounts[ua]['id']})
    ok('GET',f'/api/User/students/{accounts[ua]["id"]}/overview',ta)
    deny('GET',f'/api/User/students/{accounts[ua]["id"]}/overview',tb,statuses=(400,403,404))
    deny('POST',f'/api/User/teacher/classes/{cid}/students',tb,{'studentId':accounts[ub]['id']},statuses=(400,403,404))
    deny('DELETE',f'/api/User/teacher/classes/{cid}',tb,statuses=(400,403,404))
    classes=ok('GET','/api/User/teacher/classes',ta);require(any(x['id']==cid for x in classes),'class disappeared')
    return 'Owner create/add/read; foreign read/add/delete rejected; class persists'

def exam():
    va,vb,ua,ub=(ctx[x] for x in ['va','vb','ua','ub'])
    s=ok('POST','/api/exam-sessions',va,{'title':'QA '+RUN,'durationMinutes':5,'categories':[{'categoryId':accounts_doc['categories']['examId'],'count':4}]});ctx['exam']=s
    a=ok('POST','/api/exam-sessions/join',ua,{'code':s['code']});aid=a['id'];ctx['attemptId']=aid
    require(len(a['questions'])==4 and a['correctCount'] is None,'questions count or early score')
    deny('GET',f'/api/exam-sessions/attempts/{aid}',ub,statuses=(404,))
    deny('GET',f'/api/exam-sessions/{s["code"]}/dashboard',vb,statuses=(404,))
    require(ok('POST','/api/exam-sessions/join',ua,{'code':s['code']})['id']==aid,'duplicate join created new attempt')
    # Deterministic fixture identifies the intended answer in option text, not API scoring.
    answers=json.loads((PRIVATE/'answers.private.json').read_text(encoding='utf-8-sig')) if (PRIVATE/'answers.private.json').exists() else None
    for index,q in enumerate(a['questions']):
        # Fixture question text contains its deterministic ordinal (1..4).
        import re
        number=int(re.findall(r'\d+',q['text'])[-1]);correct='ABCD'[(number-1)%4]
        key=correct if index<2 else next(o['key'] for o in q['options'] if o['key']!=correct)
        oldrev=a['revision']; a=ok('PUT',f'/api/exam-sessions/attempts/{aid}/answer',ua,{'questionId':q['id'],'optionKey':key,'revision':oldrev})
        if index==0:
            deny('PUT',f'/api/exam-sessions/attempts/{aid}/answer',ub,{'questionId':q['id'],'optionKey':key,'revision':a['revision']},statuses=(404,))
            require(call('PUT',f'/api/exam-sessions/attempts/{aid}/answer',ua,{'questionId':q['id'],'optionKey':key,'revision':oldrev})[0]==409,'stale revision not rejected')
    b=ok('POST',f'/api/exam-sessions/attempts/{aid}/submit',ua)
    require(b['correctCount']==2 and b['percentage']==50,f'expected independent 2/4 = 50%, actual {b["correctCount"]}/4 = {b["percentage"]}')
    c=ok('POST',f'/api/exam-sessions/attempts/{aid}/submit',ua);require(b==c or (b['submittedAt']==c['submittedAt'] and c['percentage']==50),'duplicate submit changed result')
    dash=ok('GET',f'/api/exam-sessions/{s["code"]}/dashboard',va);require(len(dash['participants'])==1 and dash['participants'][0]['percentage']==50,'host result mismatch')
    return '2/4 = 50%; duplicate submit, revision/owner boundaries verified'

def course():
    va,vb,admin=(ctx[x] for x in ['va','vb','admin'])
    payload={'instructorName':'QA Müəllim','instructorRole':'Təlimçi','courseTitle':'QA '+RUN,'description':'Yalnız audit üçün sintetik təlim açıqlamasıdır.','duration':'4 həftə','level':'Başlanğıc','language':'Azərbaycan dili','syllabusTopics':['QA mövzusu'],'accentColor':'--brand-primary'}
    existing=ok('GET','/api/Course/mine',va)
    c=next((c for c in existing if c['courseTitle']==payload['courseTitle']),None)
    if c is None: c=ok('POST','/api/Course',va,payload,status=200)
    cid=c['id'];ctx['courseId']=cid
    deny('GET',f'/api/Course/{cid}',statuses=(404,))
    deny('PUT',f'/api/Course/{cid}',vb,payload,statuses=(400,403,404))
    ok('PATCH',f'/api/admin/courses/{cid}/approve',admin)
    require(ok('GET',f'/api/Course/{cid}')['courseTitle']==payload['courseTitle'],'public title mismatch')
    return 'Pending hidden; other VIP denied; admin approval public read-back'

def hidden():
    users=ok('GET','/api/admin/users',ctx['admin']);owner=accounts[ctx['admin']]['id']
    require(owner not in json.dumps(users),'protected owner in list')
    leaders=ok('GET','/api/quiz/leaderboard');require(owner not in json.dumps(leaders),'owner in leaderboard')

def profile():
    ua,ub=ctx['ua'],ctx['ub'];before=ok('GET','/api/User/profile',ub)
    ok('PUT','/api/User/profile',ua,{'firstName':'QA Yoxlama','lastName':'Sintetik','gender':1,'nickname':accounts[ua]['nickname'],'userId':accounts[ub]['id'],'role':'Admin','roles':['Admin'],'emailConfirmed':True})
    require(ok('GET','/api/User/profile',ub)==before,'other user profile changed')
    me=ok('GET','/api/auth/me',ua);require('Admin' not in me.get('roles',[]),'role injection')

def cors():
    for origin,allowed in [('http://localhost:5189',True),('https://qa-untrusted.invalid',False)]:
        s,b,h=call('OPTIONS','/api/User/profile',headers={'Origin':origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'})
        h={k.lower():v for k,v in h.items()};require((h.get('access-control-allow-origin')==origin)==allowed,'origin result wrong')

def registration_validation():
    for body in [{},{'firstName':'Əli','lastName':'Şükürov','nickname':'QA_VALIDATION','email':'invalid','password':'a','confirmPassword':'b','gender':1,'role':'Admin'}]:
        s,b,h=call('POST','/api/auth/register',body=body);require(s==400 and not b.get('success'),'invalid registration not rejected')

def upload():
    def multipart(alias,name,data,ctype):
        boundary='qa'+RUN;raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
        return call('POST','/api/Upload/photo',alias,headers={'Content-Type':'multipart/form-data; boundary='+boundary},raw=raw)
    require(multipart(ctx['ua'],'test.png',b'not png','image/png')[0]==403,'User upload allowed')
    require(multipart(ctx['va'],'test.png',b'not png','image/png')[0]==400,'magic mismatch accepted')
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5xkAAAAASUVORK5CYII=')
    s,b,h=multipart(ctx['va'],'../qa.png',png,'image/png');require(s==200,'harmless PNG failed')
    path=b['data'];require('..' not in path and 'qa.png' not in path,'client filename retained')
    require(call('GET',path)[0]==200,'stored photo not readable');ctx['photo']=path

def state_login(alias):
    a=accounts[alias];s,b,h=call('POST','/api/auth/login',alias,{'email':a['email'],'password':a['password']})
    require(s in (400,401) and not b.get('data'),'restricted account login succeeded')
    return f'HTTP {s}, token yoxdur'

def logout(alias):
    ok('POST','/api/auth/logout',alias)
    deny('GET','/api/auth/me',alias,statuses=(401,));deny('POST','/api/auth/refresh',alias,{},statuses=(400,401))

if __name__=='__main__': main()
