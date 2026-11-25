import {chromium,expect} from '@playwright/test';
import {caddyStatusRoute,defaultErrorRoutes,feedbackProxyRoute} from '../../src/lib/caddy-status';
import {upstreamErrorResponses} from '../../src/lib/status-pages';
const received:unknown[]=[];let rejectFeedback=false;
const upstream=Bun.serve({hostname:'127.0.0.1',port:8788,async fetch(req){
 if(new URL(req.url).pathname==='/api/error-feedback'){received.push(await req.json());return Response.json({saved:!rejectFeedback},{status:rejectFeedback?503:200});}
 const json=new URL(req.url).pathname.endsWith('json');return new Response(json?' {"original":true}':'original upstream html',{status:502,headers:{'Content-Type':json?'application/json':'text/html'}});
}});
const server={listen:['127.0.0.1:8787'],routes:[feedbackProxyRoute('127.0.0.1:8788'),{...caddyStatusRoute(503,'maintenance'),match:[{path:['/maintenance']}]},{match:[{path:['/error']}],handle:[{handler:'error',status_code:502,error:'test'}]},{match:[{path:['/unknown']}],handle:[{handler:'error',status_code:418,error:'test'}]},{match:[{path:['/upstream-*']}],handle:[{handler:'reverse_proxy',upstreams:[{dial:'127.0.0.1:8788'}],handle_response:upstreamErrorResponses()}]},caddyStatusRoute(404,'notFound')],errors:{routes:defaultErrorRoutes()}};
await Bun.write('/tmp/status-browser-caddy.json',JSON.stringify({admin:{disabled:true},apps:{http:{servers:{test:server}}}}));
const caddy=Bun.spawn(['/usr/local/bin/caddy','run','--config','/tmp/status-browser-caddy.json'],{stdout:Bun.file('/tmp/status-browser-caddy.log'),stderr:Bun.file('/tmp/status-browser-caddy-errors.log'),env:{...process.env,CPM_TEST_TEMPLATE_SECRET:'template-secret-must-not-render'}});
let browser;
try{
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:8787');break;}catch{await Bun.sleep(50);}}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const response=await page.goto('http://127.0.0.1:8787/error?token=do-not-copy');expect(response?.status()).toBe(502);
 await expect(page.locator('.status-node')).toHaveCount(3);
 const requestId=await page.locator('[data-meta="requestId"]').innerText();expect(requestId).toMatch(/^[0-9a-f-]{36}$/);expect(response?.headers()['x-request-id']).toBe(requestId);
 await expect(page.locator('[data-meta="clientIp"]')).not.toBeVisible();await page.getByText('Show my IP address',{exact:true}).click();await expect(page.locator('[data-meta="clientIp"]')).toBeVisible();await expect(page.locator('[data-meta="clientIp"]')).toHaveText('127.0.0.1');await expect(page.locator('[data-meta="path"]')).toHaveText('/error');
 await page.getByRole('button',{name:'Copy diagnostics'}).click();await expect(page.locator('[data-copy-status]')).toContainText('copied');
 const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain(requestId);expect(copied).not.toContain('do-not-copy');expect(copied).not.toContain('Client IP');
 await page.getByRole('button',{name:'Yes',exact:true}).click();await expect(page.locator('[data-feedback-status]')).toContainText('saved');expect(received[0]).toEqual({requestId,code:502,helpful:true});
 await page.getByText('For site operators',{exact:true}).click();await page.screenshot({path:'/artifacts/error-desktop.png',fullPage:true});
 rejectFeedback=true;await page.reload();await page.getByRole('button',{name:'No',exact:true}).click();await expect(page.locator('[data-feedback-status]')).toContainText('could not be saved');await expect(page.getByRole('button',{name:'No',exact:true})).toBeEnabled();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))}}));await page.getByRole('button',{name:'Copy diagnostics'}).click();await expect(page.locator('[data-copybox]')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.reload();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'/artifacts/error-mobile.png',fullPage:true});
 await page.emulateMedia({contrast:'more'});expect(await page.locator('.status-page').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(19, 20, 22)');await page.emulateMedia({contrast:'no-preference'});
 const before=await page.locator('[data-meta="requestId"]').innerText();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('[data-meta="requestId"]')).not.toHaveText(before);
 expect((await page.goto('http://127.0.0.1:8787/maintenance'))?.status()).toBe(503);await expect(page.locator('#status-title')).toHaveText('Maintenance in progress');await expect(page.locator('.status-chain')).toContainText('Not checked');
 expect((await page.goto('http://127.0.0.1:8787/unknown'))?.status()).toBe(418);await expect(page.locator('.status-code')).toContainText('418');
 const malicious='/'+encodeURIComponent('{{env "CPM_TEST_TEMPLATE_SECRET"}}<script>alert(1)</script>');await page.goto('http://127.0.0.1:8787'+malicious);expect(await page.content()).not.toContain('template-secret-must-not-render');expect(errors).toEqual([]);
 const json=await fetch('http://127.0.0.1:8787/upstream-json');expect(json.status).toBe(502);expect(await json.json()).toEqual({original:true});
 expect((await page.goto('http://127.0.0.1:8787/upstream-html'))?.status()).toBe(502);await expect(page.locator('.status-chain')).toBeVisible();
 const nojs=await browser.newContext({javaScriptEnabled:false});const plain=await nojs.newPage();await plain.goto('http://127.0.0.1:8787/error');await plain.getByText('Show my IP address',{exact:true}).click();await expect(plain.locator('[data-meta="clientIp"]')).toBeVisible();await expect(plain.locator('noscript')).toBeVisible();
 console.log('PASS: Caddy status/metadata, CSP script, reveal IP, clipboard + fallback, persisted-feedback transport + failure, retry, mobile layout, no-JS, template injection, JSON passthrough');
}finally{await browser?.close();caddy.kill();await caddy.exited;upstream.stop(true);}
