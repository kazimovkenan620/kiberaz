// Yalnız fresh sintetik localhost fixture. Həssas response/header/storage dəyərləri yazılmır.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),priv=path.join(process.env.TEMP,'kiberaz-releasefix-20260917');
const out=path.join(root,'docs/deployment/evidence-2026-09-17');
const {chromium}=require(path.join(process.env.TEMP,'20260917T-predeploy-132107/browser-tooling/node_modules/playwright'));
const fixture=JSON.parse(fs.readFileSync(path.join(priv,'runtime/accounts.json'),'utf8'));
const accounts=Object.fromEntries(fixture.accounts.map(a=>[a.alias,a]));
const rows=[],network=[],tokens={};let browser;
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
const resultsFile=only?'browser-api-resend-retest.json':'browser-api-fixes.json';
async function api(method,url,alias,body){
 const response=await fetch('http://localhost:5259'+url,{method,headers:{'Content-Type':'application/json',...(tokens[alias]?{Authorization:'Bearer '+tokens[alias]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json();return {status:response.status,value};
}
async function token(alias){const a=accounts[alias];const r=await api('POST','/api/auth/login',alias,{email:a.email,password:a.password});assert.equal(r.status,200);tokens[alias]=r.value.data.accessToken;}
async function record(id,fn){if(only&&id!==only)return;const row={id,startedUtc:new Date().toISOString(),status:'PASS'};try{row.actual=await fn()||'assertion-lar keçdi'}catch(e){row.status='FAIL';row.actual=e.message.split('\n')[0];process.exitCode=1}rows.push(row);fs.writeFileSync(path.join(out,resultsFile),JSON.stringify(rows,null,2));console.log(id,row.status,row.actual);}
async function page(){const c=await browser.newContext({viewport:{width:1440,height:900}});const p=await c.newPage();p.setDefaultTimeout(10000);p.on('response',r=>{if(r.url().startsWith('http://localhost:5259'))network.push({path:new URL(r.url()).pathname,status:r.status(),time:new Date().toISOString()})});await p.goto('http://localhost:5189');await p.locator('#navbar-login-btn').waitFor();return p;}
async function login(p,alias){const a=accounts[alias];await p.locator('#navbar-login-btn').click();await p.locator('#login-email').fill(a.email);await p.locator('#login-password').fill(a.password);await p.locator('#login-submit').click();await p.locator('#navbar-user-menu').waitFor();}
function seconds(s){const m=s.match(/(\d+):(\d+)/);assert.ok(m);return +m[1]*60 + +m[2];}
async function main(){
 browser=await chromium.launch({channel:'chrome',headless:true});
 const user=await page();
 await record('FIX-003-memory-reload-newtab',async()=>{
  await login(user,'UserA');
  const present=()=>user.evaluate(()=>({session:!!sessionStorage.getItem('access_token'),local:!!localStorage.getItem('access_token')}));
  assert.deepEqual(await present(),{session:false,local:false});
  await user.reload();await user.locator('#navbar-user-menu').waitFor();assert.deepEqual(await present(),{session:false,local:false});
  const tab=await user.context().newPage();await tab.goto('http://localhost:5189');await tab.locator('#navbar-user-menu').waitFor();await tab.close();
  await user.screenshot({path:path.join(out,'fixed-login-reload.png')});
  return 'Access token storage-da yoxdur; reload və yeni tab cookie ilə bərpa oldu';
 });
 await record('FIX-004-resend-real-api',async()=>{
  const p=await page(),a=accounts.Unconfirmed;await p.locator('#navbar-login-btn').click();await p.locator('#login-email').fill(a.email);await p.locator('#login-password').fill(a.password);await p.locator('#login-submit').click();await p.getByRole('alert').waitFor();
  const resend=p.getByRole('button',{name:'Təsdiq linkini yenidən göndər',exact:true});await resend.waitFor();
  const response=p.waitForResponse(r=>r.url().endsWith('/auth/resend-confirmation'));await resend.click();assert.equal((await response).status(),200);await p.getByRole('dialog').getByRole('status').waitFor();
  await p.locator('#login-email').fill('');await p.locator('#login-password').fill('');await p.screenshot({path:path.join(out,'fixed-resend.png')});await p.context().close();
  return 'Təsdiqsiz login → resend CTA → endpoint 200; SMTP çatdırılması ayrıca gate-dir';
 });
 await record('FIX-006-modal-focus',async()=>{
  const p=await page();await p.locator('#navbar-login-btn').focus();await p.keyboard.press('Enter');await p.locator('#login-email').waitFor();
  for(let i=0;i<14;i++){await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));}
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement?.id==='navbar-login-btn');await p.context().close();return 'Tab trap və Escape-dən sonra trigger focus PASS';
 });
 await record('FIX-005-protected-profile',async()=>{
  await token('AdminA');const before=(await api('GET','/api/User/profile','AdminA')).value.data;
  for(const nickname of [before.nickname,'protectednewname']){const r=await api('PUT','/api/User/profile','AdminA',{firstName:'Yeni',lastName:'Sahib',nickname,gender:2});assert.equal(r.status,400);assert.deepEqual((await api('GET','/api/User/profile','AdminA')).value.data,before);}
  await token('TeacherA');const normal=(await api('GET','/api/User/profile','TeacherA')).value.data;assert.equal((await api('PUT','/api/User/profile','TeacherA',{firstName:'Əli',lastName:'Sınaq',nickname:normal.nickname,gender:1})).status,200);
  return 'Owner ad/nickname rədd və readback dəyişməz; Teacher control 200';
 });
 await record('FIX-001-live-timer-deadline-scoring',async()=>{
  await token('VIPA');const created=await api('POST','/api/exam-sessions','VIPA',{title:'Release regression',durationMinutes:1,categories:[{categoryId:fixture.categories.examId,count:4}]});assert.equal(created.status,200);
  const p=await page();await login(p,'UserB');await p.locator('#exam-join-code').fill(created.value.data.code);await p.getByRole('button',{name:'Qoşul',exact:true}).click();await p.getByRole('timer').waitFor();
  const first=seconds(await p.getByRole('timer').innerText());await p.waitForTimeout(6000);const second=seconds(await p.getByRole('timer').innerText());assert.ok(first-second>=5,`Taymer azalmadı: ${first} -> ${second}`);
  for(let i=0;i<4;i++){
   const text=await p.locator('.es-question__text').innerText(),n=+text.match(/(\d+)\s*$/)[1],correct='ABCD'[n-1],selected=i<2?correct:'ABCD'.split('').find(k=>k!==correct);
   const saved=p.waitForResponse(r=>r.url().endsWith('/answer')&&r.status()===200);await p.getByRole('group',{name:'Cavab variantları'}).getByRole('button').filter({hasText:'Sintetik variant '+selected}).click();await saved;
   if(i<3)await p.getByRole('button',{name:'Növbəti',exact:true}).click();
  }
  await p.getByText('50%',{exact:true}).waitFor({timeout:70000});
  assert.equal(await p.getByRole('timer').count(),0);
  const submits=network.filter(r=>r.path.endsWith('/submit')&&r.status===200);assert.equal(submits.length,1);
  await p.screenshot({path:path.join(out,'fixed-deadline-result.png')});await p.context().close();
  return `Taymer ${first}→${second}; deadline-da tək auto-submit; 2/4=50%`;
 });
 await record('FIX-003-logout-revocation',async()=>{
  await user.locator('#navbar-user-menu').click();await user.getByRole('menuitem',{name:'Çıxış',exact:true}).click();await user.locator('#navbar-login-btn').waitFor();await user.reload();await user.locator('#navbar-login-btn').waitFor();
  assert.equal(await user.evaluate(()=>!!sessionStorage.getItem('access_token')||!!localStorage.getItem('access_token')),false);return 'Logout/reload guest və storage boşdur';
 });
 fs.writeFileSync(path.join(out,only?'browser-api-resend-network.json':'browser-api-network.json'),JSON.stringify(network,null,2));await browser.close();
}
main().catch(async e=>{console.error('Harness:',e.message.split('\n')[0]);if(browser)await browser.close();process.exitCode=1});
