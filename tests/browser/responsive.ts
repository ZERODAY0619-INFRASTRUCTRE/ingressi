/** Run ONLY against a disposable app with the synthetic admin below, never production. */
import { chromium, expect } from '@playwright/test';
const base='http://127.0.0.1:3000';
// A real isolated Caddy is required by settings mutations; no production admin endpoint.
await Bun.write('/tmp/responsive-caddy.json', JSON.stringify({admin:{listen:'127.0.0.1:2019'}}));
const caddy=Bun.spawn(['/usr/local/bin/caddy','run','--config','/tmp/responsive-caddy.json'],{stdout:Bun.file('/tmp/responsive-caddy.log'),stderr:Bun.file('/tmp/responsive-caddy.log')});
for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:2019/config/');break;}catch{await Bun.sleep(50);}}
const browser=await chromium.launch({args:['--no-sandbox']});
const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
const page=await context.newPage();
const failures:string[]=[];let checks=0;
async function fits(label:string){
 await page.waitForTimeout(100);
 const problems=await page.evaluate(()=>{
  const width=document.documentElement.clientWidth;
  const bad:string[]=[];
  if(document.documentElement.scrollWidth>width+1)bad.push(`document ${document.documentElement.scrollWidth}/${width}`);
  // An element wider than the viewport is allowed only inside a local scrolling region.
  for(const el of document.querySelectorAll<HTMLElement>('main button, main input, main [role=tablist], [role=dialog] input, [role=dialog] [role=tablist]')){
   const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   let clipped=false;
   for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowX)){clipped=true;break;}}
   if(!clipped&&(rect.right>width+1||rect.left< -1))bad.push(`${el.tagName} ${el.textContent?.slice(0,35)} ${Math.round(rect.right)}`);
  }
  return bad.slice(0,12);
 });
 expect(await page.locator('body').innerText()).not.toMatch(/[가-힣ぁ-んァ-ヶ一-龥]/);
 checks++;console.log(label, problems.length ? problems : "OK");if(problems.length)failures.push(`${label}: ${problems.join('; ')}`);
}
try{
 await page.goto(base+'/login');await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.fonts.check('700 24px "TOMORI Display"'))).toBe(true);await page.locator('#username').fill('responsive');await page.locator('#password').fill('MobileFixture!2486');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(base+'/',{timeout:30000});
 await page.goto(base+'/access-lists');await page.getByRole('button',{name:'New',exact:true}).click();
 await page.getByPlaceholder('e.g. Internal — Engineering').fill('Responsive fixture with a long access list name');
 await page.getByRole('button',{name:'Create list',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const routes=['/','/proxy-hosts','/l4-proxy-hosts','/access-lists','/groups','/users','/certificates','/waf','/analytics','/audit-log','/api-docs','/settings','/profile','/maintenance'];
 for(const width of [320,360,390,430,640,768,834,1024,1440]){
  await page.setViewportSize({width,height:width<834?844:1000});
  for(const route of routes){
   await page.goto(base+route);await page.waitForLoadState('domcontentloaded');
   if(route!='/maintenance'){await expect(page.locator('.dashboard-main')).toBeVisible();await expect(page.locator('.eva-workspace-header')).toContainText('SECTION');await expect(page.locator('.dashboard-main .eva-entry-title')).toHaveCount(0);const navNumber=page.locator('nav a[aria-current=page] .eva-nav-index').first();if(await navNumber.count())await expect(page.locator('.dashboard-main .eva-section-id')).toHaveText((await navNumber.textContent())!);}
   await fits(`${width} ${route}`);
  }
 }
 await page.setViewportSize({width:320,height:568});await page.goto(base+'/proxy-hosts');
 await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').getByRole('link',{name:'Settings',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await fits('320 navigation');
 for(const [route,label] of [['/proxy-hosts','Create Host'],['/l4-proxy-hosts','Create L4 Host']] as const){
  await page.goto(base+route);const button=page.getByRole('button',{name:label,exact:true});
  if(await button.count()){
   await button.click();await expect(page.getByRole('dialog')).toBeVisible();await fits(`320 dialog ${route}`);
   if(route==='/proxy-hosts'){
    const geo=page.getByRole('dialog').getByText('Geo Blocking',{exact:true}).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-lg ")][1]');
    await geo.getByRole('switch').first().click();await fits('320 Geo Blocking enabled');
   }
   const tabs=page.getByRole('dialog').locator('[role=tab]:not([inert] *)');
   for(let i=0;i<await tabs.count();i++){await tabs.nth(i).click();await fits(`320 dialog ${route} tab ${i}`);}
   await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  }
 }
 await page.goto(base+'/settings');
 await page.setViewportSize({width:844,height:390});await fits('844 landscape settings');await page.setViewportSize({width:320,height:568});
 const settings=page.getByTestId('mobile-settings-nav').locator('button');
 for(let i=1;i<await settings.count();i++){await settings.nth(i).click();await fits(`320 settings section ${i}`);}
 await page.goto(base+'/certificates');
 const certTabs=page.getByRole('tab');
 for(let i=0;i<await certTabs.count();i++){await certTabs.nth(i).click();await fits(`320 certificate tab ${i}`);}
 await page.goto(base+'/');await page.screenshot({path:'/artifacts/dashboard-mobile.png',fullPage:true});
 await expect(page.locator('html')).toHaveClass(/dark/);await page.getByRole('button',{name:'Toggle theme'}).click();await expect(page.locator('html')).toHaveClass(/light/);await fits('320 light');await page.screenshot({path:'/artifacts/dashboard-mobile-light.png',fullPage:true});await page.getByRole('button',{name:'Toggle theme'}).click();await expect(page.locator('html')).toHaveClass(/dark/);await fits('320 dark');await page.screenshot({path:'/artifacts/dashboard-mobile-dark.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.screenshot({path:'/artifacts/dashboard-desktop.png',fullPage:true});
 const guest=await browser.newContext();const guestPage=await guest.newPage();
 for(const width of [320,390,768]){await guestPage.setViewportSize({width,height:568});for(const route of ['/login','/portal','/link-account','/maintenance']){await guestPage.goto(base+route);expect(await guestPage.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);checks++;if(width===390&&route==='/login')await guestPage.screenshot({path:'/artifacts/login-mobile.png',fullPage:true});}}
 console.log(JSON.stringify({checks,failures},null,2));expect(failures).toEqual([]);
}finally{console.log(JSON.stringify({checks,failures}));await browser.close();caddy.kill();await caddy.exited;}
