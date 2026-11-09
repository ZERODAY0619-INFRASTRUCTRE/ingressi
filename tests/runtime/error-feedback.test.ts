import {expect,test,mock} from 'bun:test';
import {NextRequest} from 'next/server';
process.env.ERROR_FEEDBACK_PATH=':memory:';
mock.module('../../src/lib/auth',()=>({auth:async()=>null}));
const {POST,GET}=await import('../../app/api/error-feedback/route');
const {saveFeedback,validFeedback}=await import('../../src/lib/error-feedback');
const payload=()=>({requestId:crypto.randomUUID(),code:502,helpful:true});
const request=(body:string,origin='https://example.test')=>new NextRequest('https://example.test/api/error-feedback',{method:'POST',headers:{host:'example.test',origin,'content-type':'application/json'},body});
test('persists feedback, deduplicates IDs, and enforces a shared rate limit',()=>{
 const value=payload();expect(saveFeedback(value,1000)).toBe('saved');expect(saveFeedback(value,1000)).toBe('duplicate');
 for(let i=1;i<100;i++)expect(saveFeedback(payload(),1000)).toBe('saved');
 expect(saveFeedback(payload(),1000)).toBe('limited');expect(saveFeedback(payload(),1061)).toBe('saved');
});
test('rejects malformed, cross-origin, oversized and unprivileged reads',async()=>{
 expect(validFeedback({...payload(),clientIp:'1.2.3.4'})).toBe(false);
 expect((await POST(request('{}'))).status).toBe(400);
 expect((await POST(request(JSON.stringify(payload()),'https://evil.test'))).status).toBe(403);
 expect((await POST(request('x'.repeat(2049)))).status).toBe(413);
 expect((await GET(new NextRequest('https://example.test/api/error-feedback'))).status).toBe(403);
});
test('acknowledges a saved vote only after server-side persistence',async()=>{
 const value=payload();expect((await POST(request(JSON.stringify(value)))).status).toBe(200);expect(saveFeedback(value)).toBe('duplicate');
});
