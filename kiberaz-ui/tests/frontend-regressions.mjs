import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer as createSocketServer } from 'node:net';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// PLAYWRIGHT_MODULE_PATH mövcud Playwright quraşdırmasının index.mjs yoludur.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const socket = createSocketServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const server = await createServer({ configFile: false, envFile: false, plugins: [react(), {
  name: 'regression-callback-route',
  configureServer(vite) {
    vite.middlewares.use((request, _response, next) => {
      if (request.url?.startsWith('/google-login-callback')) request.url = '/tests/regression-fixture.html?mode=app';
      next();
    });
  },
}],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port, strictPort: true, open: false }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/tests/regression-fixture.html`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
async function check(name, run) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let pageErrors = 0;
  page.on('pageerror', () => { pageErrors++; });
  page.setDefaultTimeout(5000);
  try { await run(page, context); assert.equal(pageErrors, 0, 'Brauzerdə tutulmamış JavaScript xətası var'); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); }
}
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
const ok = data => ({ success: true, message: 'Tamamlandı', data });
const authData = { accessToken: 'synthetic-test-token', user: { nickname: 'Sınaq', roles: ['User'] } };
const tokenPresence = () => ['access_token', 'refresh_token', 'token'].some(key => sessionStorage.getItem(key) || localStorage.getItem(key));

try {
  await check('BUG003 token yalnız yaddaşda və köhnə açarlar təmizlənir', async page => {
    await page.addInitScript(() => {
      for (const storage of [localStorage, sessionStorage])
        for (const key of ['access_token', 'refresh_token', 'token']) storage.setItem(key, 'synthetic-old-token');
    });
    await page.goto(base);
    assert.equal(await page.evaluate(tokenPresence), false);
    assert.equal(await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      auth.setTokens('synthetic-new-token');
      return Boolean(auth.getToken());
    }), true);
    assert.equal(await page.evaluate(tokenPresence), false);
  });

  await check('BUG003 StrictMode reload/new-tab bərpası tək refresh edir', async (page, context) => {
    let refreshes = 0;
    await context.route('**/api/**', route => {
      if (route.request().url().endsWith('/auth/refresh')) { refreshes++; return json(route, ok(authData)); }
      if (route.request().url().endsWith('/exam-sessions/mine')) return json(route, ok({ attempts: [], sessions: [] }));
      return json(route, { success: false, message: 'Bu məlumat sınağın əhatəsinə daxil deyil.' });
    });
    await page.goto(base);
    await page.evaluate(() => localStorage.setItem('kiberaz-session', '1'));
    await page.goto(`${base}?mode=app`);
    await page.locator('#navbar-user-menu').waitFor();
    assert.equal(refreshes, 1);
    assert.equal(await page.evaluate(tokenPresence), false);
    await page.reload();
    await page.locator('#navbar-user-menu').waitFor();
    assert.equal(refreshes, 2);
    const other = await context.newPage();
    await other.goto(`${base}?mode=app`);
    await other.locator('#navbar-user-menu').waitFor();
    assert.equal(refreshes, 3);
  });

  await check('BUG003 çıxışdan sonra gecikmiş refresh sessiyanı bərpa etmir', async page => {
    let release;
    let requestReady;
    const requested = new Promise(resolve => { requestReady = resolve; });
    await page.route('**/api/auth/refresh', route => new Promise(resolve => {
      release = async () => { await json(route, ok(authData)); resolve(); };
      requestReady();
    }));
    await page.goto(base);
    const pending = page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      auth.setTokens('synthetic-before-logout');
      const refresh = auth.refreshTokens();
      auth.logout();
      return { refreshed: await refresh, hasToken: Boolean(auth.getToken()) };
    });
    await requested;
    await release();
    assert.deepEqual(await pending, { refreshed: false, hasToken: false });
    assert.equal(await page.evaluate(tokenPresence), false);
  });

  await check('BUG003 paralel 401 tək refresh edir və logout yaddaşı təmizləyir', async page => {
    let refreshes = 0;
    let loggedOut = false;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/refresh')) {
        refreshes++;
        return json(route, ok(authData));
      }
      if (path.endsWith('/auth/logout')) {
        loggedOut = Boolean(route.request().headers().authorization);
        return json(route, ok(null));
      }
      return json(route, ok(null), route.request().headers().authorization === `Bearer ${authData.accessToken}` ? 200 : 401);
    });
    await page.goto(base);
    const statuses = await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      const { apiFetch } = await import('/src/services/apiClient.ts');
      auth.setTokens('synthetic-expired-token');
      const responses = await Promise.all([apiFetch('/one'), apiFetch('/two'), apiFetch('/three')]);
      await auth.logoutOnServer();
      return { statuses: responses.map(response => response.status), hasToken: Boolean(auth.getToken()), hint: auth.hasSessionHint() };
    });
    assert.deepEqual(statuses, { statuses: [200, 200, 200], hasToken: false, hint: false });
    assert.equal(refreshes, 1);
    assert.equal(loggedOut, true);
    assert.equal(await page.evaluate(tokenPresence), false);
  });

  await check('BUG003 gecikmiş login və Google exchange çıxışı ləğv etmir', async page => {
    await page.route('**/api/auth/login', route => json(route, ok(authData)));
    await page.route('**/api/auth/google/exchange', route => json(route, ok(authData)));
    await page.goto(base);
    const cancelled = await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      const login = auth.loginUser({ email: 'synthetic@example.invalid', password: 'SyntheticPassword1' });
      auth.logout();
      const loginResult = await login;
      const google = auth.exchangeGoogleLoginCode('synthetic-code');
      auth.logout();
      const googleResult = await google;
      return [loginResult.success, googleResult.success, Boolean(auth.getToken())];
    });
    assert.deepEqual(cancelled, [false, false, false]);
  });

  await check('BUG003 köhnə API refresh yeni giriş sessiyasını silmir və sorğunu təkrarlamır', async page => {
    let release;
    let requestReady;
    let requests = 0;
    const requested = new Promise(resolve => { requestReady = resolve; });
    await page.route('**/api/**', route => {
      if (route.request().url().endsWith('/auth/refresh')) {
        return new Promise(resolve => {
          release = async () => { await json(route, ok(authData)); resolve(); };
          requestReady();
        });
      }
      requests++;
      return json(route, { success: false }, 401);
    });
    await page.goto(base);
    const pending = page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      const { apiFetch } = await import('/src/services/apiClient.ts');
      auth.setTokens('synthetic-old-identity');
      return (await apiFetch('/old-request')).status;
    });
    await requested;
    await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      auth.logout();
      auth.setTokens('synthetic-new-identity');
    });
    await release();
    assert.equal(await pending, 401);
    const state = await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      return { newSessionPreserved: auth.getToken() === 'synthetic-new-identity', hint: auth.hasSessionHint() };
    });
    assert.deepEqual(state, { newSessionPreserved: true, hint: true });
    assert.equal(requests, 1);
  });

  await check('BUG003 yeni sessiyanın refresh-i köhnə sorğu ilə paylaşılmır', async page => {
    let release;
    let requestReady;
    let refreshes = 0;
    const requested = new Promise(resolve => { requestReady = resolve; });
    await page.route('**/api/auth/refresh', route => {
      refreshes++;
      if (refreshes > 1) return json(route, ok({ ...authData, accessToken: 'synthetic-new-refreshed' }));
      return new Promise(resolve => {
        release = async () => { await json(route, ok(authData)); resolve(); };
        requestReady();
      });
    });
    await page.goto(base);
    const oldRefresh = page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      auth.setTokens('synthetic-old-identity');
      return auth.refreshTokens();
    });
    await requested;
    const newRefresh = page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      auth.logout();
      auth.setTokens('synthetic-new-identity');
      return auth.refreshTokens();
    });
    await page.waitForTimeout(100);
    await release();
    assert.equal(await oldRefresh, false);
    assert.equal(await newRefresh, true);
    assert.equal(refreshes, 2);
    assert.equal(await page.evaluate(async () => (await import('/src/services/authService.ts')).getToken() === 'synthetic-new-refreshed'), true);
  });

  await check('BUG003 müvəqqəti refresh xətası cookie bərpa işarəsini silmir', async page => {
    await page.route('**/api/auth/refresh', route => json(route, { success: false }, 503));
    await page.goto(base);
    const result = await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      localStorage.setItem('kiberaz-session', '1');
      return { refreshed: await auth.refreshTokens(), hint: auth.hasSessionHint() };
    });
    assert.deepEqual(result, { refreshed: false, hint: true });
  });

  await check('BUG003 etibarsız cookie üçün faktiki 400 bərpa işarəsini silir', async page => {
    await page.route('**/api/auth/refresh', route => json(route, { success: false }, 400));
    await page.goto(base);
    const result = await page.evaluate(async () => {
      const auth = await import('/src/services/authService.ts');
      localStorage.setItem('kiberaz-session', '1');
      return { refreshed: await auth.refreshTokens(), hint: auth.hasSessionHint() };
    });
    assert.deepEqual(result, { refreshed: false, hint: false });
  });

  await check('BUG003 Google callback köhnə hint ilə paralel bootstrap refresh etmir', async page => {
    let release;
    let requestReady;
    let refreshes = 0;
    const requested = new Promise(resolve => { requestReady = resolve; });
    await page.route('**/api/**', route => {
      if (route.request().url().endsWith('/auth/google/exchange')) {
        return new Promise(resolve => {
          release = async () => { await json(route, ok(authData)); resolve(); };
          requestReady();
        });
      }
      if (route.request().url().endsWith('/auth/refresh')) { refreshes++; return json(route, ok(authData)); }
      if (route.request().url().endsWith('/exam-sessions/mine')) return json(route, ok({ attempts: [], sessions: [] }));
      return json(route, { success: false, message: 'Bu məlumat sınağın əhatəsinə daxil deyil.' });
    });
    await page.goto(base);
    await page.evaluate(() => localStorage.setItem('kiberaz-session', '1'));
    await page.goto(`${new URL(base).origin}/google-login-callback#code=synthetic-code`);
    await requested;
    await page.waitForTimeout(100);
    await release();
    assert.equal(refreshes, 0);
    await page.locator('#navbar-user-menu').waitFor();
    assert.equal(await page.evaluate(tokenPresence), false);
  });

  await check('BUG004 resend mesaj mətnindən asılı deyil və 429 göstərilir', async page => {
    let resendCount = 0;
    await page.route('**/api/auth/login', route => json(route, { success: false, message: 'Hesabınız hələ təsdiqlənməyib.' }, 401));
    await page.route('**/api/auth/resend-confirmation', route => {
      resendCount++;
      return route.fulfill({ status: 429, body: '' });
    });
    await page.goto(`${base}?mode=navbar`);
    await page.locator('#navbar-login-btn').click();
    await page.locator('#login-email').fill('synthetic@example.invalid');
    await page.locator('#login-password').fill('SyntheticPassword1');
    await page.locator('#login-submit').click();
    await page.getByRole('button', { name: 'Təsdiq linkini yenidən göndər' }).click();
    await page.getByRole('status').filter({ hasText: 'Çox sayda cəhd edildi' }).waitFor();
    assert.equal(resendCount, 1);
  });

  await check('BUG006 autoFocus, klaviatura və auth keçidində fokus qayıdır', async page => {
    await page.goto(`${base}?mode=navbar`);
    await page.locator('#navbar-login-btn').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'navbar-login-btn');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Hesabınız yoxdur? Qeydiyyat' }).click();
    await page.getByRole('dialog', { name: 'Qeydiyyat' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'navbar-login-btn');
  });

  await check('BUG006 iç modal yalnız özünü bağlayır və itmiş trigger ehtiyat fokusu alır', async page => {
    await page.goto(`${base}?mode=modal`);
    await page.locator('#opener').click();
    await page.locator('#nested-opener').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'nested-opener');
    await page.locator('#remove-opener').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fallback');
  });

  await check('BUG001 monoton taymer, köhnə cavab snapshot-ı, deadline və retry', async page => {
    const start = new Date('2026-09-17T10:00:00Z');
    await page.clock.install({ time: start });
    let submits = 0;
    const attempt = { id: 'synthetic-attempt', serverNow: start.toISOString(), expiresAt: new Date(+start + 20000).toISOString(),
      submittedAt: null, correctCount: null, percentage: null, revision: 1, answers: {},
      session: { id: 'synthetic-session', title: 'Sınaq imtahanı', durationMinutes: 1, questionCount: 1, code: 'KBR-1234567890ABCDEF' },
      questions: [{ id: 'q1', category: 'Sınaq', text: 'Sınaq sualı', options: [{ key: 'A', text: 'Birinci' }, { key: 'B', text: 'İkinci' }] }] };
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/mine')) return json(route, ok({ attempts: [], sessions: [] }));
      if (path.endsWith('/submit')) {
        submits++;
        return submits === 1 ? json(route, { success: false, message: 'Sınaq bağlantı xətası' }, 503)
          : json(route, ok({ ...attempt, submittedAt: new Date(+start + 20000).toISOString(), percentage: 50 }));
      }
      if (path.endsWith('/answer')) return json(route, ok({ ...attempt, revision: 2, answers: { q1: 'A' }, serverNow: new Date(+start + 1000).toISOString() }));
      return json(route, ok(attempt));
    });
    await page.goto(`${base}?mode=exam`);
    await page.locator('#exam-join-code').fill('KBR-1234567890ABCDEF');
    await page.getByRole('button', { name: 'Qoşul', exact: true }).click();
    await page.getByRole('timer').waitFor();
    const initial = await page.locator('.es-timer__value').textContent();
    await page.clock.runFor(10000);
    const beforeAnswer = await page.locator('.es-timer__value').textContent();
    assert.ok(beforeAnswer < initial, `${initial} -> ${beforeAnswer}`);
    const saved = page.waitForResponse('**/answer');
    await page.getByRole('button', { name: /Birinci/ }).click();
    await saved;
    assert.ok(await page.locator('.es-timer__value').textContent() <= beforeAnswer);
    await page.clock.fastForward(11000);
    await page.getByRole('alert').filter({ hasText: 'Sınaq bağlantı xətası' }).waitFor();
    assert.equal(submits, 1);
    await page.clock.runFor(10000);
    assert.equal(submits, 1);
    await page.getByRole('button', { name: 'Yenidən göndər' }).click();
    await page.getByText('İmtahan tamamlandı', { exact: true }).waitFor();
    assert.equal(submits, 2);
    await page.clock.runFor(10000);
    assert.equal(submits, 2);
  });

  await check('BUG001 gecikmiş cavab deadline göndərişini bloklamır və nəticəni geri çevirmir', async page => {
    const start = new Date('2026-09-17T10:00:00Z');
    await page.clock.install({ time: start });
    let submits = 0;
    let release;
    let answerReady;
    const answerRequested = new Promise(resolve => { answerReady = resolve; });
    const attempt = { id: 'synthetic-attempt', serverNow: start.toISOString(), expiresAt: new Date(+start + 20000).toISOString(),
      submittedAt: null, correctCount: null, percentage: null, revision: 1, answers: {},
      session: { id: 'synthetic-session', title: 'Sınaq imtahanı', durationMinutes: 1, questionCount: 1, code: 'KBR-1234567890ABCDEF' },
      questions: [{ id: 'q1', category: 'Sınaq', text: 'Sınaq sualı', options: [{ key: 'A', text: 'Birinci' }] }] };
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/mine')) return json(route, ok({ attempts: [], sessions: [] }));
      if (path.endsWith('/submit')) {
        submits++;
        return json(route, ok({ ...attempt, submittedAt: new Date(+start + 20000).toISOString(), percentage: 50 }));
      }
      if (path.endsWith('/answer')) return new Promise(resolve => {
        release = async () => { await json(route, ok({ ...attempt, revision: 2, answers: { q1: 'A' } })); resolve(); };
        answerReady();
      });
      return json(route, ok(attempt));
    });
    await page.goto(`${base}?mode=exam`);
    await page.locator('#exam-join-code').fill('KBR-1234567890ABCDEF');
    await page.getByRole('button', { name: 'Qoşul', exact: true }).click();
    await page.getByRole('timer').waitFor();
    await page.getByRole('button', { name: /Birinci/ }).click();
    await answerRequested;
    await page.clock.fastForward(21000);
    await page.clock.runFor(2500);
    try { await page.getByText('İmtahan tamamlandı', { exact: true }).waitFor(); }
    finally { await release(); }
    assert.equal(submits, 1);
    await page.clock.runFor(1000);
    assert.equal(await page.getByText('İmtahan tamamlandı', { exact: true }).count(), 1);
    assert.equal(await page.getByRole('timer').count(), 0);
  });
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) process.exitCode = 1;
