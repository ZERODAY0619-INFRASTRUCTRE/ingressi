import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
let database:Database|undefined;
function db(){
  if(!database){
    const path=process.env.ERROR_FEEDBACK_PATH||join(dirname(process.env.DATABASE_PATH||'/app/data/caddy-proxy-manager.db'),'error-feedback.db');
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    database=new Database(path);
    database.exec('PRAGMA busy_timeout=2000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS feedback (request_id TEXT PRIMARY KEY, status INTEGER NOT NULL, helpful INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS feedback_time ON feedback(created_at)');
  }return database;
}
export function validFeedback(value:unknown):value is {requestId:string;code:number;helpful:boolean}{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===3&&typeof v.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.requestId)&&Number.isInteger(v.code)&&Number(v.code)>=400&&Number(v.code)<=599&&typeof v.helpful==='boolean';
}
export function saveFeedback(value:{requestId:string;code:number;helpful:boolean},now=Math.floor(Date.now()/1000)):'saved'|'duplicate'|'limited'{
  return db().transaction(()=>{
    const d=db();
    d.query('DELETE FROM feedback WHERE created_at < ?').run(now-30*86400);
    if(d.query('SELECT 1 FROM feedback WHERE request_id=?').get(value.requestId))return 'duplicate' as const;
    const recent=d.query('SELECT count(*) AS count FROM feedback WHERE created_at >= ?').get(now-60) as {count:number};
    if(recent.count>=100)return 'limited' as const;
    d.query('INSERT INTO feedback VALUES (?,?,?,?)').run(value.requestId,value.code,value.helpful?1:0,now);
    d.exec('DELETE FROM feedback WHERE request_id IN (SELECT request_id FROM feedback ORDER BY created_at DESC, request_id LIMIT -1 OFFSET 10000)');
    return 'saved' as const;
  })();
}
export function feedbackSummary(){return db().query('SELECT status, helpful, count(*) AS count FROM feedback WHERE created_at >= ? GROUP BY status, helpful ORDER BY status').all(Math.floor(Date.now()/1000)-30*86400);}
