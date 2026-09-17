"""Yekun baseline üçün azsaylı auth/ownership/cross-role read-back."""
import importlib,json
q=importlib.import_module('audit-api')
q.results=json.loads((q.OUT/'api-results.json').read_text(encoding='utf8'));q.requests=json.loads((q.OUT/'api-requests.json').read_text(encoding='utf8'));q.ctx=json.loads((q.PRIVATE/'api-context.json').read_text())
def smoke():
    for alias in ['UserA','UserB','TeacherA','TeacherB','VIPA','VIPB','AdminA']:q.login(alias)
    q.health();q.deny('GET','/api/admin/stats','UserA',statuses=(403,))
    q.deny('GET',f'/api/exam-sessions/attempts/{q.ctx["attemptId"]}','UserB',statuses=(404,))
    q.require(q.ok('GET',f'/api/exam-sessions/attempts/{q.ctx["attemptId"]}','UserA')['percentage']==50,'result changed')
    q.require(any(c['id']==q.ctx['classId'] for c in q.ok('GET','/api/User/teacher/classes','TeacherA')),'class missing')
    q.require(q.ok('GET',f'/api/Course/{q.ctx["courseId"]}')['courseTitle'].startswith('QA REV'),'approved course revision missing')
    return '7 isolated account logins; owner/role denials; 50% result, teacher class, public revision preserved'
q.test('FINAL-API-001','Final auth/authorization/cross-role smoke','Multi-role','Login/me; owner deny; result/class/course readback','Same persisted states and boundaries',smoke)
raise SystemExit(0 if q.results[-1]['Status']=='PASS' else 1)
