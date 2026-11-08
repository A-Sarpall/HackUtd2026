import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {snapshot,simulate,integer} from './finance.mjs';
import {runDecision} from './agents.mjs';
import {loadNessieSnapshot} from './nessie.mjs';
const db=new DatabaseSync(process.env.DATABASE_PATH||'nextmove.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS goals(owner TEXT PRIMARY KEY,amount INTEGER,version INTEGER); CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,owner TEXT,amount INTEGER,version INTEGER,hash TEXT,expires INTEGER,status TEXT); CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,owner TEXT,action TEXT,created INTEGER);`);
const runs=new Map();
let activeSnapshot=snapshot();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>16384)throw Error('BODY_TOO_LARGE');}return text?JSON.parse(text):{};}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const path=url.pathname;
 if(req.method==='GET'&&['/','/index.html','/support.js'].includes(path)){const file=path==='/support.js'?'support.js':'index.html';const content=await readFile(new URL('../frontend/'+file,import.meta.url));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(content);}
 if(req.method==='GET'&&path==='/health')return json(res,200,{ok:true,mode:'local_demo'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:{code:'ORIGIN_DENIED'}});
 if(path==='/api/v1/demo-session'&&req.method==='POST'){const existing=/nextmove_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(existing&&db.prepare('SELECT id FROM sessions WHERE id=?').get(existing))return json(res,201,{mode:'synthetic_fixture'});const id=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?)').run(id);db.prepare('INSERT INTO goals VALUES (?,30000,1)').run(id);res.setHeader('Set-Cookie',`nextmove_session=${id}; HttpOnly; SameSite=Strict; Path=/`);return json(res,201,{mode:'synthetic_fixture'});}
 const owner=/nextmove_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(!owner||!db.prepare('SELECT id FROM sessions WHERE id=?').get(owner))return json(res,401,{error:{code:'SESSION_REQUIRED'}});
 const s=activeSnapshot;
 if(path==='/api/v1/snapshot'&&req.method==='GET')return json(res,200,{...s,goal:db.prepare('SELECT amount AS amountCents,version FROM goals WHERE owner=?').get(owner)});
 if(path==='/api/v1/scenarios'&&req.method==='POST'){const b=await body(req);if(b.snapshotVersion!==s.version||b.snapshotId!==s.id)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});return json(res,200,{baseline:simulate(s),scenario:simulate(s,b.changes)});}
 if(path==='/api/v1/runs'&&req.method==='POST'){const b=await body(req);if(typeof b.message!=='string'||b.message.length>2000)throw Error('INVALID_MESSAGE');if(b.snapshotVersion!==s.version||b.snapshotId!==s.id)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});if([...runs.values()].some(r=>r.owner===owner&&r.status==='running'))return json(res,429,{error:{code:'RUN_ACTIVE'}});const id=randomUUID();const record={owner,id,status:'running'};runs.set(id,record);try{record.receipt=await runDecision(s,b);record.status='completed';}catch{record.status='failed';record.error='MODEL_OR_VALIDATION_FAILURE';}return json(res,200,{runId:id,status:record.status,receipt:record.receipt,error:record.error});}
 if(path.startsWith('/api/v1/runs/')&&req.method==='GET'){const r=runs.get(path.split('/').pop());if(!r||r.owner!==owner)return json(res,404,{error:{code:'NOT_FOUND'}});const {owner:_,...visible}=r;return json(res,200,visible);}
 if(path==='/api/v1/actions'&&req.method==='POST'){const b=await body(req);integer(b.amountCents);const goal=db.prepare('SELECT * FROM goals WHERE owner=?').get(owner);if(b.amountCents>goal.amount)throw Error('ONLY_CONTRIBUTION_REDUCTION_SUPPORTED');const id=randomUUID(),hash=createHash('sha256').update(`${owner}:${id}:${b.amountCents}:${goal.version}`).digest('hex'),expires=Date.now()+300000;db.prepare('INSERT INTO actions VALUES (?,?,?,?,?,?,?)').run(id,owner,b.amountCents,goal.version,hash,expires,'proposed');return json(res,201,{id,proposalHash:hash,expectedGoalVersion:goal.version,snapshotVersion:s.version,expires,oldAmountCents:goal.amount,newAmountCents:b.amountCents,effect:'Changes an unscheduled app goal only; no funds move.'});}
 if(/^\/api\/v1\/actions\/[^/]+\/approve$/.test(path)&&req.method==='POST'){const b=await body(req),id=path.split('/')[4];db.exec('BEGIN IMMEDIATE');try{const a=db.prepare('SELECT * FROM actions WHERE id=? AND owner=?').get(id,owner);if(!a){db.exec('ROLLBACK');return json(res,404,{error:{code:'NOT_FOUND'}});}if(b.proposalHash!==a.hash)throw Error('INVALID_APPROVAL');if(a.status==='completed'){db.exec('COMMIT');return json(res,200,{id,status:'completed'});}const g=db.prepare('SELECT * FROM goals WHERE owner=?').get(owner);if(a.expires<Date.now()||g.version!==a.version||b.expectedGoalVersion!==g.version||b.snapshotVersion!==s.version){db.exec('ROLLBACK');return json(res,409,{error:{code:'STALE_APPROVAL'}});}db.prepare('UPDATE goals SET amount=?,version=version+1 WHERE owner=?').run(a.amount,owner);db.prepare("UPDATE actions SET status='completed' WHERE id=?").run(id);db.prepare('INSERT INTO audit VALUES (?,?,?,?)').run(randomUUID(),owner,id,Date.now());db.exec('COMMIT');return json(res,200,{id,status:'completed'});}catch(e){db.exec('ROLLBACK');throw e;}}
 if(path==='/api/v1/sync'&&req.method==='POST'){
   try{activeSnapshot=await loadNessieSnapshot(s.version+1);return json(res,200,{ok:true,mode:'nessie_live',snapshot:activeSnapshot,provider:activeSnapshot.provider});}
   catch(error){
    const code=['NESSIE_KEY_MISSING','NESSIE_AUTH_FAILED','NESSIE_RATE_LIMITED','NESSIE_EMPTY'].includes(error.message)?error.message:'NESSIE_UNAVAILABLE';
    if(code==='NESSIE_EMPTY')return json(res,200,{ok:true,connected:true,empty:true,mode:'nessie_empty',snapshot:null,provider:{name:'Nessie v2',customers:0,accounts:0},message:'Nessie v2 is connected. This sandbox has no accounts yet, so no financial snapshot was created.'});
    const status=code==='NESSIE_AUTH_FAILED'?401:code==='NESSIE_RATE_LIMITED'?429:503;
    return json(res,status,{error:{code,message:'Nessie v2 could not be connected. Check the saved key and try again.'}});
   }
 }
 return json(res,404,{error:{code:'NOT_FOUND'}});
 }catch(e){json(res,400,{error:{code:e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_REQUEST',requestId:randomUUID()}});}});
server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('NextMove backend: http://127.0.0.1:'+(process.env.PORT||3001)));
