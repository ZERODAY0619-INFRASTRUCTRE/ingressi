import { expect, test } from 'bun:test';
import { observedPublicIp } from '../../src/lib/analytics-geo';
const peer='100.113.109.93';
const sample={generated_at:110,snapshots:[{at:100,peers:{[peer]:'8.8.8.8'}},{at:110,peers:{[peer]:'1.1.1.1'}}]};
test('matches the endpoint observed before the request, not a later roaming address',()=>{
 expect(observedPublicIp(peer,105,sample,115)).toBe('8.8.8.8');
 expect(observedPublicIp(peer,111,sample,115)).toBe('1.1.1.1');
});
test('no attribution for history, stale collector, stale sample, or ordinary client IP',()=>{
 expect(observedPublicIp(peer,99,sample,115)).toBeNull();
 expect(observedPublicIp(peer,105,sample,150)).toBeNull();
 expect(observedPublicIp(peer,135,{...sample,generated_at:140},140)).toBeNull();
 expect(observedPublicIp('8.8.8.8',105,sample,115)).toBeNull();
});
test('empty latest snapshot clears a disconnected or relayed peer',()=>{
 expect(observedPublicIp(peer,112,{...sample,snapshots:[sample.snapshots[0],{at:110,peers:{}}]},115)).toBeNull();
 expect(observedPublicIp(peer,112,null,115)).toBeNull();
});
