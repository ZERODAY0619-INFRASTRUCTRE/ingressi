import {statusHtml,errorCatalog} from './status-pages';
import {responseHeaders} from './status-response';
/** Only generated HTML gets template evaluation. Never wrap upstream/custom bodies. */
export function caddyStatusRoute(status:number,kind:'error'|'notFound'|'maintenance'='error',errorRoute=false) {
  const details={source:'proxy' as const,proxyLabel:process.env.CPM_EDGE_LABEL||'Service proxy',requestId:'CPM_REQUEST_ID_TOKEN',timestamp:'CPM_TIME_TOKEN',host:'CPM_HOST_TOKEN',path:'CPM_PATH_TOKEN',clientIp:'CPM_IP_TOKEN'};
  let body=statusHtml(kind,String(status),details);
  const tokens:Record<string,string>={
    CPM_REQUEST_ID_TOKEN:'{{placeholder "http.request.uuid" | html}}',
    CPM_TIME_TOKEN:'{{dateInZone "2006-01-02 15:04:05" now "UTC" | html}}',
    CPM_HOST_TOKEN:'{{placeholder "http.request.host" | html}}',
    CPM_PATH_TOKEN:'{{placeholder "http.request.orig_uri.path" | html}}',
    CPM_IP_TOKEN:'{{or (placeholder "http.vars.client_ip") (placeholder "http.request.remote.host") "Unavailable" | html}}',
  };
  for(const [token,value] of Object.entries(tokens))body=body.replaceAll(token,value);
  return {
    ...(errorRoute?{match:[{expression:`{http.error.status_code} == ${status}`}]}:{}),
    handle:[{handler:'templates',mime_types:['text/html']},{handler:'static_response',status_code:status,body,
      headers:{...Object.fromEntries(Object.entries(responseHeaders()).map(([k,v])=>[k,[v]])),'X-Request-ID':['{http.request.uuid}'],...(kind==='maintenance'?{'Retry-After':['300']}:{})}}],terminal:true,
  };
}
export function defaultErrorRoutes(){
  const routes:Record<string,unknown>[]=Object.keys(errorCatalog).map(Number).map(code=>caddyStatusRoute(code,code===404?'notFound':'error',true));
  // Generic explanations for other codes, retaining the actual HTTP status.
  for (const code of [400,500]) {
    const fallback:Record<string,unknown>=caddyStatusRoute(code);
    if(code===400)fallback.match=[{expression:"{http.error.status_code} < 500"}];
    const response=(fallback.handle as {body:string;status_code:number|string}[])[1];
    response.status_code='{http.error.status_code}';
    response.body=response.body.replaceAll(`data-status-code="${code}"`,'data-status-code="{{placeholder "http.error.status_code" | html}}"').replace(`<span class="status-designation">${code}</span>`,'<span class="status-designation">{{placeholder "http.error.status_code" | html}}</span>');
    routes.push(fallback);
  }
  return routes;
}
export function feedbackProxyRoute(upstream:string|undefined){
  if(!upstream)return null;
  if(!/^[a-zA-Z0-9.-]+:\d{1,5}$/.test(upstream))throw new Error('Invalid CPM_FEEDBACK_UPSTREAM');
  return {match:[{path:['/api/error-feedback'],method:['POST']}],handle:[
    {handler:'request_body',max_size:2048},
    {handler:'reverse_proxy',upstreams:[{dial:upstream}],headers:{request:{delete:['Cookie','Authorization']}},transport:{protocol:'http',dial_timeout:3_000_000_000,response_header_timeout:5_000_000_000}},
  ],terminal:true};
}
