import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {snapshot,simulate,integer,goalImpact} from './finance.mjs';
import {runDecision,runActionReview} from './agents.mjs';
import {enrich,validateProfile,compare,reviewFacts} from './intelligence.mjs';
import {loadNessieSnapshot,listCustomers} from './nessie.mjs';
const db=new DatabaseSync(process.env.DATABASE_PATH||'nextmove.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS goals(owner TEXT PRIMARY KEY,amount INTEGER,version INTEGER); CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,owner TEXT,amount INTEGER,version INTEGER,hash TEXT,expires INTEGER,status TEXT); CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,owner TEXT,action TEXT,created INTEGER);`);
const runs=new Map();
// Made-up starter goal for new demo sessions so the goal flow has something to show; users can edit or remove it.
const EXAMPLE_GOAL={id:'example-emergency',kind:'emergency',name:'Emergency fund (example)',targetCents:300000,savedCents:60000,monthlyCents:30000};
db.exec('CREATE TABLE IF NOT EXISTS planned_payments(id TEXT PRIMARY KEY,owner TEXT,amount INTEGER,date TEXT,created INTEGER)');
for(const [column,type] of [['kind','TEXT'],['date','TEXT']])if(!db.prepare('PRAGMA table_info(actions)').all().some(c=>c.name===column))db.exec(`ALTER TABLE actions ADD COLUMN ${column} ${type}`);
if(!db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='created'))db.exec('ALTER TABLE sessions ADD COLUMN created INTEGER');
db.prepare('UPDATE sessions SET created=? WHERE created IS NULL').run(Date.now());
db.exec('CREATE TABLE IF NOT EXISTS profiles(owner TEXT PRIMARY KEY,data TEXT); CREATE TABLE IF NOT EXISTS snapshots(owner TEXT PRIMARY KEY,data TEXT); CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,owner TEXT,data TEXT); CREATE TABLE IF NOT EXISTS action_context(id TEXT PRIMARY KEY,snapshotId TEXT,snapshotVersion INTEGER,receiptId TEXT);');
function profile(owner){return JSON.parse(db.prepare('SELECT data FROM profiles WHERE owner=?').get(owner)?.data||'{"goals":[]}');}
function source(owner){return JSON.parse(db.prepare('SELECT data FROM snapshots WHERE owner=?').get(owner)?.data||'null')||snapshot();}
function current(owner){const raw=source(owner);const p=profile(owner);const g=db.prepare('SELECT amount AS amountCents,version FROM goals WHERE owner=?').get(owner);if(p.goals[0])p.goals[0].monthlyCents=g.amountCents;const planned=db.prepare('SELECT id,amount AS amountCents,date FROM planned_payments WHERE owner=? ORDER BY date,created').all(owner);return {...enrich(raw,p,planned),goal:g,profile:p};}
function json(res,status,data){if(res.req&&!res.req.complete)res.setHeader('Connection','close');res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>16384)throw Error('BODY_TOO_LARGE');}return text?JSON.parse(text):{};}
const nessieCode=error=>['NESSIE_KEY_MISSING','NESSIE_AUTH_FAILED','NESSIE_RATE_LIMITED','NESSIE_EMPTY','CUSTOMER_REQUIRED'].includes(error?.message)?error.message:'NESSIE_UNAVAILABLE';
const nessieMessage=code=>({NESSIE_KEY_MISSING:'No Nessie key found. Save one with scripts/setup_keys.py and restart NextMove.',NESSIE_AUTH_FAILED:'Nessie rejected the saved key. Check the key and try again.',NESSIE_RATE_LIMITED:'Nessie is limiting requests. Wait a minute and try again.',NESSIE_EMPTY:'This sandbox customer has no accounts.',CUSTOMER_REQUIRED:'Choose a sandbox customer first.'})[code]||'Nessie couldn’t be reached. Try again shortly.';

// ---- Deployment configuration and request hardening ----
function positiveInt(name,fallback){const raw=process.env[name];if(raw==null||raw==='')return fallback;const n=Number(raw);if(!Number.isSafeInteger(n)||n<1)throw Error(`Invalid ${name}: expected a positive integer`);return n;}
const config={
 host:process.env.HOST||'127.0.0.1',
 port:positiveInt('PORT',3001),
 publicOrigin:process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).origin:null,
 trustProxy:process.env.TRUST_PROXY==='1',
 sessionTtlMs:positiveInt('SESSION_TTL_MS',7*86400000),
 ipRequestsPer5Min:positiveInt('IP_REQUESTS_PER_5MIN',300),
 sessionsPerHourPerIp:positiveInt('SESSION_LIMIT_PER_HOUR',20),
 runsPerHourPerSession:positiveInt('RUN_LIMIT_PER_HOUR',20),
 providerCallsPerHourPerSession:positiveInt('PROVIDER_LIMIT_PER_HOUR',30),
 aiRunsPerDay:positiveInt('AI_DAILY_RUN_LIMIT',500),
 receiptsPerSession:50,
};
const secureCookies=config.publicOrigin?.startsWith('https:')??false;
const cookieName=secureCookies?'__Host-nextmove_session':'nextmove_session';
const cookiePattern=new RegExp(`(?:^|;\\s*)${cookieName.replace(/[-_]/g,'\\$&')}=([a-f0-9]{64})(?:;|$)`);
const sessionCookie=req=>cookiePattern.exec(req.headers.cookie||'')?.[1];
const CSP=["default-src 'self'","script-src 'self' https://unpkg.com 'unsafe-eval'","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","font-src https://fonts.gstatic.com","img-src 'self' data:","connect-src 'self'","frame-ancestors 'none'","base-uri 'none'","form-action 'self'","object-src 'none'",...(secureCookies?['upgrade-insecure-requests']:[])].join('; ');
function securityHeaders(res){
 res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 if(secureCookies)res.setHeader('Strict-Transport-Security','max-age=15552000');
}
function clientIp(req){
 if(config.trustProxy){const hops=String(req.headers['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean);if(hops.length)return hops[hops.length-1];}
 return req.socket.remoteAddress||'unknown';
}
// Fixed-window limiter held in memory: limits reset on restart and are per process.
const windows=new Map();
function overLimit(key,limit,windowMs){
 const now=Date.now();let w=windows.get(key);
 if(!w||w.reset<=now){if(windows.size>=100000)windows.clear();w={count:0,reset:now+windowMs};windows.set(key,w);}
 w.count++;return w.count>limit?Math.max(1,Math.ceil((w.reset-now)/1000)):0;
}
function limited(res,retryAfter,code){res.setHeader('Retry-After',String(retryAfter));return json(res,429,{error:{code}});}
function parseAction(a){if(!a||typeof a!=='object'||Array.isArray(a))throw Error('INVALID_ACTION');if(a.kind==='debt_payment'){if(typeof a.date!=='string')throw Error('INVALID_DATE');return {kind:'debt_payment',amountCents:integer(a.amountCents),date:a.date};}if(a.kind==='goal_contribution')return {kind:'goal_contribution',amountCents:integer(a.amountCents),date:null};throw Error('UNSUPPORTED_ACTION');}
const deny=(res,status,code)=>{json(res,status,{error:{code}});return true;};
function requestGuard(req,res){
 if(config.publicOrigin&&req.headers.host!==new URL(config.publicOrigin).host)return deny(res,421,'HOST_DENIED');
 const expected=config.publicOrigin||`http://${req.headers.host}`;
 if(req.headers.origin&&req.headers.origin!==expected)return deny(res,403,'ORIGIN_DENIED');
 if(!['GET','HEAD'].includes(req.method)){
  const site=req.headers['sec-fetch-site'];if(!req.headers.origin&&site&&!['same-origin','none'].includes(site))return deny(res,403,'ORIGIN_DENIED');
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return deny(res,415,'UNSUPPORTED_MEDIA_TYPE');
  if(Number(req.headers['content-length']||0)>16384)return deny(res,413,'BODY_TOO_LARGE');
 }
 return false;
}
const validSession=id=>!!id&&!!db.prepare('SELECT id FROM sessions WHERE id=? AND created>?').get(id,Date.now()-config.sessionTtlMs);
function purgeExpiredSessions(){
 const ids=db.prepare('SELECT id FROM sessions WHERE created<=?').all(Date.now()-config.sessionTtlMs).map(r=>r.id);if(!ids.length)return;
 db.exec('BEGIN IMMEDIATE');
 try{for(const id of ids){for(const table of ['goals','profiles','snapshots','receipts','audit','planned_payments'])db.prepare(`DELETE FROM ${table} WHERE owner=?`).run(id);db.prepare('DELETE FROM action_context WHERE id IN (SELECT id FROM actions WHERE owner=?)').run(id);db.prepare('DELETE FROM actions WHERE owner=?').run(id);db.prepare('DELETE FROM sessions WHERE id=?').run(id);}db.exec('COMMIT');}
 catch(error){db.exec('ROLLBACK');throw error;}
}
function housekeeping(){
 const now=Date.now();for(const [key,w] of windows)if(w.reset<=now)windows.delete(key);
 for(const [id,r] of runs)if(r.status!=='running'&&now-r.created>15*60000)runs.delete(id);
 try{purgeExpiredSessions();}catch(error){console.error(JSON.stringify({level:'error',event:'session_purge_failed',reason:error?.code||error?.name||'unknown'}));}
}
const safeReason=e=>/^[A-Z][A-Z0-9_]{2,60}$/.test(e?.message||'')?e.message:(e?.name||'Error');
const server=http.createServer(async(req,res)=>{try{
 securityHeaders(res);
 const url=new URL(req.url,'http://localhost');const path=url.pathname;
 if(req.method==='GET'&&path==='/health')return json(res,200,{ok:true});
if(requestGuard(req,res))return;
 if(path.startsWith('/api/')){const wait=overLimit('ip:'+clientIp(req),config.ipRequestsPer5Min,300000);if(wait)return limited(res,wait,'RATE_LIMITED');}
 if(req.method==='GET'&&['/','/index.html','/support.js'].includes(path)){const file=path==='/support.js'?'support.js':'index.html';const content=await readFile(new URL('../frontend/'+file,import.meta.url));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(content);}
 if(path==='/api/v1/demo-session'&&req.method==='POST'){const existing=sessionCookie(req);if(validSession(existing)){if(!db.prepare('SELECT 1 FROM profiles WHERE owner=?').get(existing))db.prepare('INSERT INTO profiles VALUES (?,?)').run(existing,JSON.stringify({goals:[EXAMPLE_GOAL]}));return json(res,201,{mode:'synthetic_fixture'});}{const wait=overLimit('session:'+clientIp(req),config.sessionsPerHourPerIp,3600000);if(wait)return limited(res,wait,'RATE_LIMITED');}const id=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(id,created) VALUES (?,?)').run(id,Date.now());db.prepare('INSERT INTO goals VALUES (?,30000,1)').run(id);db.prepare('INSERT INTO profiles VALUES (?,?)').run(id,JSON.stringify({goals:[EXAMPLE_GOAL]}));res.setHeader('Set-Cookie',`${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(config.sessionTtlMs/1000)}${secureCookies?'; Secure':''}`);return json(res,201,{mode:'synthetic_fixture'});}
 const owner=sessionCookie(req);if(!validSession(owner))return json(res,401,{error:{code:'SESSION_REQUIRED'}});
 let s=current(owner);
 if((path==='/api/v1/customers'&&req.method==='GET')||(path==='/api/v1/sync'&&req.method==='POST')){const wait=overLimit('provider:'+owner,config.providerCallsPerHourPerSession,3600000);if(wait)return limited(res,wait,'RATE_LIMITED');}
 if(path==='/api/v1/customers'&&req.method==='GET'){try{return json(res,200,{customers:await listCustomers()});}catch(error){const code=nessieCode(error);return json(res,code==='NESSIE_AUTH_FAILED'?401:code==='NESSIE_RATE_LIMITED'?429:503,{error:{code,message:nessieMessage(code)}});}}
 if(path==='/api/v1/profile'&&req.method==='PUT'){const p=validateProfile(await body(req));s=current(owner);db.exec('BEGIN');try{db.prepare('INSERT OR REPLACE INTO profiles VALUES (?,?)').run(owner,JSON.stringify(p));db.prepare('UPDATE goals SET amount=?,version=version+1 WHERE owner=?').run(p.goals[0]?.monthlyCents??0,owner);const next={...source(owner),version:s.version+1};db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?)').run(owner,JSON.stringify(next));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,current(owner));}
 if(path==='/api/v1/receipts'&&req.method==='GET')return json(res,200,{receipts:db.prepare('SELECT data FROM receipts WHERE owner=? ORDER BY rowid DESC LIMIT 20').all(owner).map(r=>JSON.parse(r.data))});
 if(path==='/api/v1/snapshot'&&req.method==='GET')return json(res,200,{...s,goal:db.prepare('SELECT amount AS amountCents,version FROM goals WHERE owner=?').get(owner)});
 if(path==='/api/v1/scenarios'&&req.method==='POST'){const b=await body(req);s=current(owner);if(b.snapshotVersion!==s.version||b.snapshotId!==s.id)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});if(!Array.isArray(b.changes)||b.changes.some(c=>c.kind!=='extra_debt_payment'))throw Error('INVALID_CHANGES');return json(res,200,{baseline:compare(s,0,s.asOf),scenario:(b.changes?.length===1?compare(s,b.changes[0].amountCents,b.changes[0].date):simulate(s,b.changes))});}
 if(path==='/api/v1/runs'&&req.method==='POST'){const b=await body(req);s=current(owner);if(typeof b.message!=='string'||b.message.length>2000)throw Error('INVALID_MESSAGE');if(b.snapshotVersion!==s.version||b.snapshotId!==s.id)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});if([...runs.values()].some(r=>r.owner===owner&&r.status==='running'))return json(res,429,{error:{code:'RUN_ACTIVE'}});{const wait=overLimit('run:'+owner,config.runsPerHourPerSession,3600000);if(wait)return limited(res,wait,'RATE_LIMITED');}if(process.env.NVIDIA_API_KEY){const wait=overLimit('ai-day',config.aiRunsPerDay,86400000);if(wait)return limited(res,wait,'AI_DAILY_LIMIT');}const id=randomUUID();const record={owner,id,status:'running',created:Date.now()};runs.set(id,record);try{record.receipt=await runDecision(s,b);const latest=current(owner);if(latest.id!==s.id||latest.version!==s.version||latest.goal.version!==s.goal.version)throw Error('STALE_SNAPSHOT');record.receipt.id=id;record.receipt.createdAt=new Date().toISOString();record.status='completed';db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(id,owner,JSON.stringify(record.receipt));db.prepare('DELETE FROM receipts WHERE owner=? AND rowid NOT IN (SELECT rowid FROM receipts WHERE owner=? ORDER BY rowid DESC LIMIT ?)').run(owner,owner,config.receiptsPerSession);}catch(error){console.error(JSON.stringify({level:'warn',event:'run_failed',runId:id,reason:safeReason(error)}));delete record.receipt;record.status='failed';record.error='MODEL_OR_VALIDATION_FAILURE';}return json(res,200,{runId:id,status:record.status,receipt:record.receipt,error:record.error});}
 if(path.startsWith('/api/v1/runs/')&&req.method==='GET'){const r=runs.get(path.split('/').pop());if(!r||r.owner!==owner)return json(res,404,{error:{code:'NOT_FOUND'}});const {owner:_,...visible}=r;return json(res,200,visible);}
 if(path==='/api/v1/reviews'&&req.method==='POST'){
  const b=await body(req);s=current(owner);
  if(b.snapshotVersion!==s.version||b.snapshotId!==s.id)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});
  const action=parseAction(b.action);
  if([...runs.values()].some(r=>r.owner===owner&&r.status==='running'))return json(res,429,{error:{code:'RUN_ACTIVE'}});
  {const wait=overLimit('run:'+owner,config.runsPerHourPerSession,3600000);if(wait)return limited(res,wait,'RATE_LIMITED');}
  if(process.env.NVIDIA_API_KEY){const wait=overLimit('ai-day',config.aiRunsPerDay,86400000);if(wait)return limited(res,wait,'AI_DAILY_LIMIT');}
  const id=randomUUID(),record={owner,id,status:'running',created:Date.now()};runs.set(id,record);
  try{
   record.receipt=await runActionReview(s,action);
   const latest=current(owner);if(latest.id!==s.id||latest.version!==s.version||latest.goal.version!==s.goal.version)throw Error('STALE_SNAPSHOT');
   record.receipt.id=id;record.receipt.createdAt=new Date().toISOString();record.status='completed';
   db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(id,owner,JSON.stringify(record.receipt));
   db.prepare('DELETE FROM receipts WHERE owner=? AND rowid NOT IN (SELECT rowid FROM receipts WHERE owner=? ORDER BY rowid DESC LIMIT ?)').run(owner,owner,config.receiptsPerSession);
  }catch(error){
   if(['NO_GOAL','PAYMENT_EXCEEDS_DEBT','INVALID_AMOUNT','INVALID_DATE','DATE_OUTSIDE_HORIZON'].includes(error.message)){runs.delete(id);return json(res,400,{error:{code:error.message}});}
   console.error(JSON.stringify({level:'warn',event:'review_failed',runId:id,reason:safeReason(error)}));delete record.receipt;record.status='failed';record.error='MODEL_OR_VALIDATION_FAILURE';
  }
  return json(res,200,{runId:id,status:record.status,receipt:record.receipt,error:record.error});
 }
 if(path==='/api/v1/actions'&&req.method==='POST'){
  const b=await body(req);s=current(owner);const action=parseAction(b.kind?b:{...b,kind:'goal_contribution'});
  const goal=db.prepare('SELECT * FROM goals WHERE owner=?').get(owner);
  if(action.kind==='goal_contribution'&&!s.goals[0])return json(res,400,{error:{code:'NO_GOAL'}});
  if(b.receiptId){const row=db.prepare('SELECT data FROM receipts WHERE id=? AND owner=?').get(b.receiptId,owner);if(!row)throw Error('INVALID_RECEIPT');const receipt=JSON.parse(row.data);if(receipt.snapshotId!==s.id||receipt.snapshotVersion!==s.version||receipt.status!=='ready'||receipt.goalVersion!==goal.version)throw Error('STALE_RECEIPT');}
  let review;try{review=reviewFacts(s,action);}catch(error){if(['NO_GOAL','PAYMENT_EXCEEDS_DEBT','INVALID_AMOUNT'].includes(error.message))return json(res,400,{error:{code:error.message}});throw error;}
  // Server policy: an action that fails its safety check cannot be proposed or approved.
  if(review.policy==='blocked')return json(res,422,{error:{code:action.kind==='debt_payment'?'BELOW_CUSHION':'OVER_BUDGET'}});
  const id=randomUUID(),expires=Date.now()+300000;
  const hash=createHash('sha256').update(JSON.stringify({owner,id,kind:action.kind,amountCents:action.amountCents,date:action.date,goalVersion:goal.version,snapshotId:s.id,snapshotVersion:s.version,receiptId:b.receiptId||null})).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try{db.prepare('INSERT INTO actions(id,owner,amount,version,hash,expires,status,kind,date) VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner,action.amountCents,goal.version,hash,expires,'proposed',action.kind,action.date);db.prepare('INSERT INTO action_context VALUES (?,?,?,?)').run(id,s.id,s.version,b.receiptId||null);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  const base={id,kind:action.kind,proposalHash:hash,expectedGoalVersion:goal.version,snapshotVersion:s.version,expires,warnings:review.warnings};
  if(action.kind==='debt_payment')return json(res,201,{...base,amountCents:action.amountCents,date:action.date,comparison:review.comparison,effect:'Adds this extra payment to your NextMove plan and outlook. NextMove does not send money; pay your lender directly.'});
  return json(res,201,{...base,oldAmountCents:goal.amount,newAmountCents:action.amountCents,goalImpact:goalImpact(s.goals[0],goal.amount,action.amountCents),progressNow:review.progressNow,progressNew:review.progressNew,leftoverNowCents:review.leftoverNowCents,leftoverNewCents:review.leftoverNewCents,effect:'Changes your goal’s monthly amount in NextMove. No money moves and no transfer is scheduled.'});
 }
 if(/^\/api\/v1\/actions\/[^/]+\/approve$/.test(path)&&req.method==='POST'){
  const b=await body(req),id=path.split('/')[4];s=current(owner);
  db.exec('BEGIN IMMEDIATE');
  try{
   const a=db.prepare('SELECT * FROM actions WHERE id=? AND owner=?').get(id,owner);
   if(!a){db.exec('ROLLBACK');return json(res,404,{error:{code:'NOT_FOUND'}});}
   if(b.proposalHash!==a.hash)throw Error('INVALID_APPROVAL');
   if(a.status==='completed'){db.exec('COMMIT');return json(res,200,{id,status:'completed'});}
   const context=db.prepare('SELECT * FROM action_context WHERE id=?').get(id);const g=db.prepare('SELECT * FROM goals WHERE owner=?').get(owner);
   const kind=a.kind||'goal_contribution';
   const fresh=context&&context.snapshotId===s.id&&context.snapshotVersion===s.version&&a.expires>=Date.now()&&g.version===a.version&&b.expectedGoalVersion===g.version&&b.snapshotVersion===s.version;
   // Re-run the safety check at approval time as defense in depth.
   const stillAllowed=fresh&&(kind==='goal_contribution'?!!s.goals[0]:true)&&reviewFacts(s,{kind,amountCents:a.amount,date:a.date}).policy==='allowed';
   if(!stillAllowed){db.exec('ROLLBACK');return json(res,409,{error:{code:'STALE_APPROVAL'}});}
   if(kind==='debt_payment'){db.prepare('INSERT INTO planned_payments VALUES (?,?,?,?,?)').run(id,owner,a.amount,a.date,Date.now());db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?)').run(owner,JSON.stringify({...source(owner),version:s.version+1}));}
   else db.prepare('UPDATE goals SET amount=?,version=version+1 WHERE owner=?').run(a.amount,owner);
   db.prepare("UPDATE actions SET status='completed' WHERE id=?").run(id);db.prepare('INSERT INTO audit VALUES (?,?,?,?)').run(randomUUID(),owner,id,Date.now());
   if(context.receiptId){const row=db.prepare('SELECT data FROM receipts WHERE id=? AND owner=?').get(context.receiptId,owner);if(row){const receipt=JSON.parse(row.data);receipt.actionId=id;receipt.actionStatus='completed';db.prepare('UPDATE receipts SET data=? WHERE id=?').run(JSON.stringify(receipt),context.receiptId);}}
   db.exec('COMMIT');return json(res,200,{id,kind,status:'completed'});
  }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
 }
 if(/^\/api\/v1\/planned-payments\/[^/]+$/.test(path)&&req.method==='DELETE'){
  await body(req);s=current(owner);const id=path.split('/')[4];
  db.exec('BEGIN IMMEDIATE');
  try{const removed=db.prepare('DELETE FROM planned_payments WHERE id=? AND owner=?').run(id,owner).changes;if(!removed){db.exec('ROLLBACK');return json(res,404,{error:{code:'NOT_FOUND'}});}
   db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?)').run(owner,JSON.stringify({...source(owner),version:s.version+1}));db.prepare('INSERT INTO audit VALUES (?,?,?,?)').run(randomUUID(),owner,'remove-planned-'+id,Date.now());db.exec('COMMIT');}
  catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
  return json(res,200,current(owner));
 }
 if(path==='/api/v1/sync'&&req.method==='POST'){
   try{const b=await body(req);s=current(owner);const next=await loadNessieSnapshot(s.version+1,b.customerId||s.customerId);const latest=current(owner);if(latest.id!==s.id||latest.version!==s.version||latest.goal.version!==s.goal.version)return json(res,409,{error:{code:'STALE_SNAPSHOT'}});next.customerId=b.customerId||s.customerId;db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?)').run(owner,JSON.stringify(next));const refreshed=current(owner);return json(res,200,{ok:true,mode:'nessie_live',snapshot:refreshed,provider:refreshed.provider});}
   catch(error){
    const code=nessieCode(error);
    if(code==='NESSIE_EMPTY')return json(res,200,{ok:true,connected:true,empty:true,mode:'nessie_empty',snapshot:null,provider:{name:'Nessie v2',customers:0,accounts:0},message:'Connected to the Nessie sandbox, but this customer has no accounts. Your current data is unchanged.'});
    const status=code==='NESSIE_AUTH_FAILED'?401:code==='NESSIE_RATE_LIMITED'?429:503;
    return json(res,status,{error:{code,message:nessieMessage(code)}});
   }
 }
 return json(res,404,{error:{code:'NOT_FOUND'}});
 }catch(e){const requestId=randomUUID();const code=e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_REQUEST';console.error(JSON.stringify({level:'warn',event:'request_rejected',requestId,code,reason:safeReason(e),method:req.method,path:String(req.url||'').split('?')[0].slice(0,120)}));if(!res.headersSent)json(res,400,{error:{code,requestId}});else res.destroy();}});
server.headersTimeout=15000;server.requestTimeout=60000;server.keepAliveTimeout=5000;
housekeeping();setInterval(housekeeping,60000).unref();
process.on('unhandledRejection',error=>console.error(JSON.stringify({level:'error',event:'unhandled_rejection',reason:safeReason(error)})));
function shutdown(signal){console.log(`NextMove: ${signal} received, closing`);server.close(()=>{db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
if(config.host!=='127.0.0.1'&&config.host!=='localhost'&&!config.publicOrigin)console.error('NextMove warning: listening beyond localhost without PUBLIC_ORIGIN; set PUBLIC_ORIGIN=https://your-domain before exposing this server.');
server.listen(config.port,config.host,()=>console.log(`NextMove backend: http://${config.host}:${config.port}`));
