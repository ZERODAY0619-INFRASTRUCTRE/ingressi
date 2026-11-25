import {createHash, randomUUID} from 'node:crypto';
import {statusHeaders,statusScript,type StatusDetails} from './status-pages';
export function responseHeaders(){return {...statusHeaders,'Content-Security-Policy':`default-src 'none'; script-src 'sha256-${createHash('sha256').update(statusScript).digest('base64')}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`};}
export function requestDetails(headers:Headers,host:string,path:string):StatusDetails {
  return {requestId:headers.get('x-cpm-request-id')||randomUUID(),timestamp:headers.get('x-cpm-request-time')||new Date().toISOString(),host,path,source:'app'};
}
