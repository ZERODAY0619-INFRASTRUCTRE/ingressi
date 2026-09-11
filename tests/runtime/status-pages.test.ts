import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {maintenanceEnabled,statusHtml,statusHeaders,statusScript,upstreamErrorResponses,errorCatalog} from '../../src/lib/status-pages';
import {responseHeaders} from '../../src/lib/status-response';
import {caddyStatusRoute,defaultErrorRoutes} from '../../src/lib/caddy-status';
test('maintenance requires an explicit enabled value',()=>{for(const v of ['1','true','TRUE'])expect(maintenanceEnabled(v)).toBe(true);for(const v of ['0','false','','yes'])expect(maintenanceEnabled(v)).toBe(false);});
test('self-contained interaction script is explicitly allowed by the CSP hash',()=>{
 const html=statusHtml('error','502');expect(html).toContain('lang="en"');expect(html).toContain('data-action="copy"');expect(html).toContain('<details class="status-ip">');expect(html).not.toContain('src="http');
 const hash=createHash('sha256').update(statusScript).digest('base64');expect(responseHeaders()['Content-Security-Policy']).toContain(`script-src 'sha256-${hash}'`);expect(statusHeaders['Cache-Control']).toBe('no-store');
});
test('request data cannot inject markup or executable code',()=>{
 const attack='</code><script>alert(1)</script><img src=x onerror=alert(1)>';
 const html=statusHtml('error','502',{host:attack,path:attack,requestId:attack,clientIp:attack,timestamp:attack});
 expect(html).not.toContain('<script>alert(1)');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;script&gt;');
});
test('errors have distinct guidance and unknown infrastructure is not marked working',()=>{
 for(const code of Object.keys(errorCatalog)){const html=statusHtml('error',code);expect(html).toContain(`<span class="status-designation">${code}</span>`);expect(html).toContain('For site operators');}
 expect(statusHtml('error','500',{source:'app'})).toContain('Proxy diagnostics unavailable');
 expect(statusHtml('maintenance')).toContain('Not checked');
 expect(statusHtml('error','502')).not.toContain('HTTP 521, indicating a refused connection');
});
test('only generated Caddy pages use escaped templates, preserving status',()=>{
 const route=caddyStatusRoute(502,'error',true);expect(route.match).toEqual([{expression:'{http.error.status_code} == 502'}]);
 expect(JSON.stringify(route)).toContain('http.request.uuid');expect(JSON.stringify(route)).toContain('| html');expect(defaultErrorRoutes().length).toBeGreaterThan(15);
 expect(upstreamErrorResponses()[0].match).toEqual({status_code:[4,5],headers:{'Content-Type':['text/html*']}});
});
