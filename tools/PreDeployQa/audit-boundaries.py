"""Kiçik sərhəd sınaqları; yalnız iki sorğulu nəzarətli concurrency."""
import importlib,json,threading,sys
from concurrent.futures import ThreadPoolExecutor
q=importlib.import_module('audit-api')
q.results=json.loads((q.OUT/'api-results.json').read_text(encoding='utf8'));q.requests=json.loads((q.OUT/'api-requests.json').read_text(encoding='utf8'));q.ctx=json.loads((q.PRIVATE/'api-context.json').read_text())
for a in ['UserA','UserB','VIPA','VIPB','AdminA','ModeratorB']:q.login(a)
def boundaries():
    aid=q.ctx['attemptId'];code=q.ctx['exam']['code']
    q.deny('POST',f'/api/exam-sessions/attempts/{aid}/submit','UserB',statuses=(404,))
    q.deny('POST',f'/api/exam-sessions/{code}/close','VIPB',statuses=(404,))
    q.deny('POST','/api/exam-sessions/join','AdminA',{'code':code},statuses=(403,))
    q.deny('POST','/api/exam-sessions/join','VIPA',{'code':code},statuses=(400,))
    q.ok('POST',f'/api/exam-sessions/{code}/close','VIPA')
    q.deny('POST','/api/exam-sessions/join','ModeratorB',{'code':code},statuses=(409,))
    q.require(q.ok('GET',f'/api/exam-sessions/attempts/{aid}','UserA')['percentage']==50,'close changed submitted score')
def concurrent():
    s=q.ok('POST','/api/exam-sessions','VIPA',{'title':'QA concurrency '+q.RUN,'durationMinutes':1,'categories':[{'categoryId':q.accounts_doc['categories']['examId'],'count':2}]})
    a=q.ok('POST','/api/exam-sessions/join','UserA',{'code':s['code']});question=a['questions'][0];barrier=threading.Barrier(2)
    def save(key):
        barrier.wait();return q.call('PUT',f'/api/exam-sessions/attempts/{a["id"]}/answer','UserA',{'questionId':question['id'],'optionKey':key,'revision':a['revision']})
    with ThreadPoolExecutor(max_workers=2) as pool:
        fs=[pool.submit(save,k) for k in ['A','B']];responses=[f.result() for f in fs]
    q.require(sorted(x[0] for x in responses)==[200,409],'expected one write and one revision conflict')
    after=q.ok('GET',f'/api/exam-sessions/attempts/{a["id"]}','UserA');q.require(after['revision']==a['revision']+1 and len(after['answers'])==1,'revision/persistence mismatch')
    return 'İki sorğu, bir 200 və bir 409; yalnız bir cavab və bir revizyon artımı'
def syllabus():
    # Zərərsiz, bir səhifəli PDF; JavaScript/embedded files yoxdur.
    import io
    chunks=[b'%PDF-1.4\n'];offsets=[0]
    for obj in [b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>']:
        offsets.append(sum(map(len,chunks)));chunks.append(str(len(offsets)-1).encode()+b' 0 obj\n'+obj+b'\nendobj\n')
    xref=sum(map(len,chunks));chunks.append(b'xref\n0 4\n0000000000 65535 f \n'+b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets[1:])+b'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n'+str(xref).encode()+b'\n%%EOF')
    pdf=b''.join(chunks);boundary='qapdf';raw=b'--qapdf\r\nContent-Disposition: form-data; name="file"; filename="qa.pdf"\r\nContent-Type: application/pdf\r\n\r\n'+pdf+b'\r\n--qapdf--\r\n'
    s,b,h=q.call('POST','/api/Upload/syllabus','VIPA',headers={'Content-Type':'multipart/form-data; boundary='+boundary},raw=raw);q.require(s==200,f'PDF upload status={s}, errors={b.get("errors")}')
    s,d,h=q.call('GET',b['data']);q.require(s==200,'sanitized PDF download failed');h={k.lower():v for k,v in h.items()};q.require('sandbox' in h.get('content-security-policy',''),'PDF sandbox CSP absent')
    return 'Isolated sanitizer rewrites benign PDF; anonymous controller readback 200 + sandbox CSP'
def setup_timer():
    s=q.ok('POST','/api/exam-sessions','VIPB',{'title':'QA deadline '+q.RUN,'durationMinutes':1,'categories':[{'categoryId':q.accounts_doc['categories']['examId'],'count':1}]})
    (q.PRIVATE/'timer-session.private.json').write_text(json.dumps(s))
if '--concurrent' in sys.argv:
    q.test('BOUND-002-R','Two-tab revision concurrency','UserA','Two simultaneous writes same revision; readback','One 200, one 409, single mutation',concurrent)
    sys.exit(0)
q.test('BOUND-001','Closed exam/ownership/state','Multi-role','Foreign submit/close, host/admin join, closed join','404/400/403/409; original result unchanged',boundaries)
q.test('BOUND-002','Two-tab revision concurrency','UserA','Two simultaneous writes same revision; readback','One 200, one 409, single mutation',concurrent)
q.test('BOUND-003','PDF upload/sanitizer/readback','VIPA','Harmless PDF upload + public download','Rewritten safe PDF and CSP',syllabus)
setup_timer()
