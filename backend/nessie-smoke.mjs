// Read-only v2 connection check. Outputs counts, never keys or financial payloads.
import {checkNessie} from './nessie.mjs';
try{console.log(JSON.stringify({ok:true,...await checkNessie()}));}catch(error){console.error(JSON.stringify({ok:false,code:error.message}));process.exitCode=1;}
