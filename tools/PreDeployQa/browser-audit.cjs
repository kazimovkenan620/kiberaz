// İzolə brauzer profilləri; parol və auth state heç vaxt evidence-ə yazılmır.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),run='20260917T-predeploy-132107';
const priv=path.join(process.env.TEMP,run),out=path.join(root,'docs/qa',run,'evidence');
const {chromium}=require(path.join(priv,'browser-tooling/node_modules/playwright'));
const accounts=JSON.parse(fs.readFileSync(path.join(priv,'runtime/accounts.json'),'utf8'));
const rows=[], errors=[],network=[];
const retest=process.argv.includes('--retest');
const callbacksMode=process.argv.includes('--callbacks');
const rolesMode=process.argv.includes('--roles')||callbacksMode;
if(callbacksMode){rows.push(...JSON.parse(fs.readFileSync(path.join(out,'browser-roles-results.json'),'utf8')).filter(r=>r.TestId!=='BE-010'));network.push(...JSON.parse(fs.readFileSync(path.join(out,'browser-roles-network.json'),'utf8')));}
const deadlineMode=process.argv.includes('--deadline');
let browser;
function check(x,m){if(!x)throw new Error(m)}
function record(id,feature,alias,steps,expected,fn){return (async()=>{
 if(retest&&!['BE-004','BE-005','BE-006','BE-007'].includes(id))return;
 const r={TestId:id,Feature:feature,FeatureState:'IMPLEMENTED',EvidenceType:'BROWSER_E2E',Account:alias,Priority:'P1',Precondition:'Chrome; production frontend build; local Development API; ayrı browser context',TestData:run,Steps:steps,Expected:expected,Actual:'',Status:'NOT_RUN',Evidence:'evidence/browser-results.json',BugId:'',Timestamp:new Date().toISOString(),RunId:run,Commit:'2a3f32f4e131fda77d668215c4ea83af20a6f8b5'};
 try{r.Actual=await fn()||'Bütün assertion-lar keçdi';r.Status='PASS'}catch(e){r.Status=e.message.startsWith('BLOCKED:')?'BLOCKED':'FAIL';r.Actual=e.message.split('\n')[0].slice(0,400)}
 rows.push(r);if(r.Status==='FAIL')process.exitCode=1;else if(r.Status==='BLOCKED'&&!process.exitCode)process.exitCode=2;fs.writeFileSync(path.join(out,deadlineMode?'browser-deadline-results.json':rolesMode?'browser-roles-results.json':retest?'browser-retest-results.json':'browser-results.json'),JSON.stringify(rows,null,2));console.log(id,r.Status,r.Actual);
})();}
async function page(alias,viewport={width:1440,height:900}){
 const context=await browser.newContext({viewport});const p=await context.newPage();
 p.on('pageerror',e=>errors.push({alias,message:e.message}));
 p.on('response',r=>{if(r.url().startsWith('http://localhost:5259'))network.push({alias,method:r.request().method(),path:new URL(r.url()).pathname,status:r.status(),timestamp:new Date().toISOString()})});
 p.setDefaultTimeout(8000);
 await p.goto('http://localhost:5189');await p.locator('#kd-tab-1').waitFor();
 return p;
}
async function login(p,alias){
 const a=accounts.accounts.find(x=>x.alias===alias);
 await p.locator('#navbar-login-btn').click();
 await p.locator('#login-email').fill(a.email);await p.locator('#login-password').fill(a.password);
 await p.locator('#login-submit').click();
 await p.locator('.modal-backdrop').waitFor({state:'hidden',timeout:10000});
 check(await p.getByText(a.nickname,{exact:true}).count()>0,'nickname login UI-da görünmür');
}
async function main(){
 browser=await chromium.launch({channel:'chrome',headless:true});
 fs.writeFileSync(path.join(out,'browser-engine.json'),JSON.stringify({engine:'Chromium',channel:'installed Chrome',version:browser.version(),automation:'Playwright 1.58.2',run,timestamp:new Date().toISOString()},null,2));
 const guest=await page('Guest');
 if(deadlineMode){
  await record('BE-011','Deadline auto-submit','UserB','API fixture 1-minute exam; UI join; observe 65 seconds','Automatic submit/results by deadline',async()=>{
   await login(guest,'UserB');const session=JSON.parse(fs.readFileSync(path.join(priv,'runtime/timer-session.private.json'),'utf8'));
   await guest.locator('#exam-join-code').fill(session.code);await guest.getByRole('button',{name:'Qoşul',exact:true}).click();await guest.getByRole('timer').waitFor();
   const samples=[];for(let i=0;i<13;i++){samples.push({timestamp:new Date().toISOString(),timer:await guest.getByRole('timer').innerText().catch(()=>null)});await new Promise(r=>setTimeout(r,5000));}
   await guest.screenshot({path:path.join(out,'expired-exam-still-active.png')});
   const data={samples,submitRequests:network.filter(x=>x.path.endsWith('/submit')).length,timerVisible:await guest.getByRole('timer').isVisible()};fs.writeFileSync(path.join(out,'deadline-observation.json'),JSON.stringify(data,null,2));
   check(!data.timerVisible&&data.submitRequests>0,'65 saniyə sonra taymer aktivdir və avtomatik submit göndərilməyib');
  });
  await browser.close();return;
 }
 if(rolesMode){
  for(const alias of callbacksMode?[]:['UserA','TeacherA','VIPA','ModeratorA','AdminA']){
   const p=await page(alias);
   await record('BE-ROLE-'+alias,'Dashboard screens',alias,'Real UI login; cabinet; each available sidebar section','Each role has its intended sections; data loads without alert',async()=>{
    await login(p,alias);await p.locator('#navbar-user-menu').click();await p.getByRole('menuitem',{name:'Kabinetim'}).click();await p.locator('[id^="ud-nav-"]').first().waitFor();
    const ids=await p.locator('[id^="ud-nav-"]').evaluateAll(es=>es.map(x=>x.id));
    check(ids.includes(alias==='AdminA'?'ud-nav-adm-overview':'ud-nav-profile'),'expected role sidebar absent');
    if(alias!=='AdminA')check(!ids.includes('ud-nav-adm-users'),'admin controls shown for ordinary role');
    for(const id of ids){
      await p.locator('#'+id).click();await p.locator('main').waitFor();
      await p.waitForLoadState('networkidle');
      const txt=(await p.locator('body').innerText()).replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,'[EMAIL REDACTED]');
      fs.writeFileSync(path.join(out,`dashboard-${alias}-${id}.txt`),txt);
      check(!txt.includes('Serverlə əlaqə yaradıla bilmədi'),'dashboard network error '+id);
    }
    await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,`dashboard-${alias}-mobile.png`),fullPage:true,mask:[p.locator('input'),p.locator('[class*="email"]')]});
    return ids.join(', ');
   });
  }
  await record('BE-010','Invalid callbacks/deep links','Guest','Open reset/confirm/change callback without token','SPA fallback + understandable error',async()=>{
   for(const route of ['/reset-password','/confirm-email','/confirm-email-change']){
    await guest.goto('http://localhost:5189'+route);await guest.locator('main').waitFor();
    if(route==='/reset-password'){const pw='Qa1!'+require('node:crypto').randomBytes(12).toString('hex');await guest.locator('#reset-pass').fill(pw);await guest.locator('#reset-confirm').fill(pw);await guest.locator('button[type="submit"]').click();await guest.getByRole('alert').waitFor();}
    await guest.getByRole('alert').waitFor();const t=await guest.locator('body').innerText();check(!t.includes('404 Not Found'),'SPA fallback missing');check(/etibarsız|tapılmadı|natamam|xəta|tələb olunur|boş ola bilməz/i.test(t),'no invalid-link message for '+route);fs.writeFileSync(path.join(out,'callback-'+route.slice(1)+'.txt'),t);
   }
  });
  fs.writeFileSync(path.join(out,'browser-roles-console.json'),JSON.stringify(errors,null,2));fs.writeFileSync(path.join(out,'browser-roles-network.json'),JSON.stringify(network,null,2));
  await browser.close();return;
 }
 if(process.argv.includes('--inspect')){console.log((await guest.locator('body').innerText()).slice(0,14000));console.log(await guest.locator('button,input').evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,text:e.innerText,type:e.type}))));await browser.close();return;}
 await record('BE-001','Guest navigation/theme/responsive','Guest','Desktop/tablet/mobile; dark/light; category/leaderboard tabs','No horizontal overflow; navigation and theme work',async()=>{
  for(const size of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]){
   await guest.setViewportSize(size);await guest.screenshot({path:path.join(out,`guest-${size.width}-dark.png`),fullPage:true});
   const dims=await guest.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));check(dims.scroll<=dims.width,`horizontal overflow ${size.width}: ${dims.scroll}`);
  }
  await guest.setViewportSize({width:1440,height:900});await guest.getByRole('button',{name:'Açıq mövzuya keç'}).click();
  await guest.screenshot({path:path.join(out,'guest-1440-light.png'),fullPage:true});
  await guest.locator('#lb-tab-all').click();await guest.locator('#kd-tab-2').click();check(await guest.locator('#kd-detail-panel').innerText().then(t=>t.includes('QA Qapalı')),'category navigation failed');
  return '1440/768/390 overflow yoxdur; theme/tab controls';
 });
 const student=await page('UserA');
 await record('BE-002','Login/reload/storage','UserA','UI login; inspect only key presence; reload','Login survives reload; access token persistent storage-da olmamalıdır',async()=>{
  await login(student,'UserA');const storage=await student.evaluate(()=>({sessionAccessTokenPresent:!!sessionStorage.getItem('access_token'),localAccessTokenPresent:!!localStorage.getItem('access_token')}));
  fs.writeFileSync(path.join(out,'token-storage-presence.json'),JSON.stringify(storage,null,2));
  await student.reload();await student.getByText('qausera',{exact:true}).first().waitFor();
  await student.screenshot({path:path.join(out,'student-login-reload.png'),fullPage:true});
  check(!storage.sessionAccessTokenPresent&&!storage.localAccessTokenPresent,'Access token sessionStorage-də saxlanır; memory-only invariant pozulur');
 });
 const unconfirmed=await page('Unconfirmed');
 await record('BE-003','Unconfirmed account resend','Unconfirmed','UI correct-password login','Clear confirmation error and resend CTA',async()=>{
  const a=accounts.accounts.find(x=>x.alias==='Unconfirmed');await unconfirmed.locator('#navbar-login-btn').click();await unconfirmed.locator('#login-email').fill(a.email);await unconfirmed.locator('#login-password').fill(a.password);
  await unconfirmed.locator('#login-submit').click();
  await unconfirmed.getByRole('alert').waitFor();await unconfirmed.locator('#login-password').fill('');await unconfirmed.locator('#login-email').fill('');
  await unconfirmed.screenshot({path:path.join(out,'unconfirmed-resend.png')});
  const text=await unconfirmed.getByRole('alert').innerText();fs.writeFileSync(path.join(out,'unconfirmed-message.txt'),text);
  check(await unconfirmed.getByRole('button',{name:/Təsdiq.*yenidən|yenidən.*göndər/i}).count()>0,'Confirmation error görünür, lakin resend CTA yoxdur');
 });
 const host=await page('VIPB'), participant=await page('UserB');let examCode;
 await record('BE-004','VIP creates exam through UI','VIPB','UI login; create 15-minute 4-question exam','UI code; API creation persisted',async()=>{
  await login(host,'VIPB');await host.getByRole('button',{name:'Sessiya yarat',exact:true}).click();
  await host.locator('#es-title').fill('QA UI '+run);await host.getByRole('button',{name:'15 dəq',exact:true}).click();
  for(let i=0;i<4;i++)await host.getByRole('button',{name:'QA Qapalı İmtahan artır'}).click();
  const [response]=await Promise.all([host.waitForResponse(r=>r.url().endsWith('/api/exam-sessions')&&r.request().method()==='POST'),host.getByRole('dialog',{name:'Sessiya yarat'}).locator('button[type="submit"]').click()]);
  const data=await response.json();check(response.status()===200&&data.success,'UI exam create failed');examCode=data.data.code;
  await host.getByRole('button',{name:'Bağla',exact:true}).click();return 'UI-dan sessiya yaradıldı; HTTP 200';
 });
 await record('BE-005','Exam join/timer monotonicity','UserB','UI login/join; sample timer for 8 seconds','Timer elapsed wall time-a uyğun azalır',async()=>{
  if(!examCode)throw new Error('BLOCKED: exam creation prerequisite');await login(participant,'UserB');await participant.locator('#exam-join-code').fill(examCode);await participant.getByRole('button',{name:'Qoşul',exact:true}).click();await participant.getByRole('timer').waitFor();
  const samples=[];for(let i=0;i<8;i++){samples.push({at:Date.now(),text:await participant.getByRole('timer').innerText()});await new Promise(r=>setTimeout(r,1100));}
  fs.writeFileSync(path.join(out,'exam-timer-samples.json'),JSON.stringify(samples,null,2));await participant.screenshot({path:path.join(out,'exam-frozen-timer.png')});
  const sec=t=>{const m=t.match(/(\d+):(\d+)/);return +m[1]*60+(+m[2])};check(sec(samples[0].text)-sec(samples.at(-1).text)>=6,'8 saniyə ərzində taymer lazımi qədər azalmadı: '+samples.map(x=>x.text.trim()).join(' → '));
 });
 await record('BE-006','Exam UI answer/submit/result','UserB','Answer 4 questions; confirm submit; result','50% independently calculated score',async()=>{
  if(!await participant.getByRole('timer').count())throw new Error('BLOCKED: no active exam');
  for(let i=0;i<4;i++){
   const question=await participant.locator('.es-question__text').innerText();const n=+question.match(/(\d+)\s*$/)[1];const correct='ABCD'[n-1];const selected=i<2?correct:'ABCD'.split('').find(k=>k!==correct);
   await participant.getByRole('group',{name:'Cavab variantları'}).getByRole('button').filter({hasText:'Sintetik variant '+selected}).click();
   await participant.waitForResponse(r=>r.url().endsWith('/answer')&&r.status()===200).catch(()=>{});
   if(i<3)await participant.getByRole('button',{name:'Növbəti',exact:true}).click();
  }
  await participant.getByRole('button',{name:'İmtahanı bitir',exact:true}).click();
  await participant.getByRole('alertdialog').getByRole('button',{name:/bitir|təsdiq/i}).click();
  await participant.getByText('50%',{exact:true}).waitFor();await participant.screenshot({path:path.join(out,'exam-ui-result.png')});
 });
 await record('BE-007','Modal keyboard focus','Guest','Open login; Tab loop; Escape','Focus remains in dialog; Escape restores trigger',async()=>{
  await guest.locator('#navbar-login-btn').click();await guest.locator('#login-email').focus();for(let i=0;i<12;i++){await guest.keyboard.press('Tab');check(await guest.evaluate(()=>!!document.activeElement.closest('.modal')),'focus escaped modal');}
  await guest.keyboard.press('Escape');await guest.locator('.modal-backdrop').waitFor({state:'hidden'});
  await guest.waitForFunction(()=>document.activeElement?.id==='navbar-login-btn',{},{timeout:1500}).catch(()=>{});
  const focused=await guest.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));fs.writeFileSync(path.join(out,'modal-focus-after-close.json'),JSON.stringify(focused));
  check(focused.id==='navbar-login-btn','focus not restored; active='+focused.tag+'#'+focused.id);
 });
 const reg=await page('UIRegistration');
 await record('BE-008','Registration UI with official test CAPTCHA','UIRegistration','Fill real UI; official sandbox widget; submit','Synthetic account created; email handoff observed',async()=>{
  await reg.locator('#navbar-register-btn').click();const password='Qa1!'+require('node:crypto').randomBytes(16).toString('hex');
  const credentials={alias:'UIRegistration',nickname:'qa_ui_132107',email:'qa_ui_132107@example.invalid',password};fs.writeFileSync(path.join(priv,'runtime/ui-registration.private.json'),JSON.stringify(credentials));
  for(const [id,val] of Object.entries({'reg-first':'Əli','reg-last':'Şükürov','reg-email':credentials.email,'reg-nickname':credentials.nickname,'reg-pass':password,'reg-confirm':password}))await reg.locator('#'+id).fill(val);
  await reg.getByRole('button',{name:'Kişi',exact:true}).click();
  const submit=reg.getByRole('button',{name:'Qeydiyyatdan keç',exact:true});
  try{await submit.waitFor({state:'visible'});await reg.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('Qeydiyyatdan keç'))?.disabled,{},{timeout:20000});}catch{throw new Error('BLOCKED: official Turnstile widget did not produce test token');}
  const promise=reg.waitForResponse(r=>r.url().includes('/api/auth/register'));await submit.click();const response=await promise;const body=await response.json();
  await reg.locator('#reg-pass').fill('').catch(()=>{});await reg.locator('#reg-confirm').fill('').catch(()=>{});await reg.locator('#reg-email').fill('').catch(()=>{});
  await reg.screenshot({path:path.join(out,'registration-result.png')});fs.writeFileSync(path.join(out,'registration-response.json'),JSON.stringify({status:response.status(),success:body.success,message:body.message,errors:body.errors},null,2));
  check(body.success,'Registration returned error: '+JSON.stringify(body.errors));
 });
 await record('BE-009','Logout/back/reload isolation','UserA','UI logout; back; reload; storage presence','Guest state; access token removed',async()=>{
  await student.locator('#navbar-user-menu').click();await student.getByRole('menuitem',{name:'Çıxış'}).click();await student.locator('#navbar-login-btn').waitFor();await student.reload();await student.locator('#navbar-login-btn').waitFor();
  check(!await student.evaluate(()=>sessionStorage.getItem('access_token')),'token remains after logout');
 });
 fs.writeFileSync(path.join(out,retest?'browser-retest-console.json':'browser-console.json'),JSON.stringify(errors,null,2));fs.writeFileSync(path.join(out,retest?'browser-retest-network.json':'browser-network.json'),JSON.stringify(network,null,2));
 await browser.close();
}
main().catch(async e=>{console.error(e.message);if(browser)await browser.close();process.exitCode=1});
