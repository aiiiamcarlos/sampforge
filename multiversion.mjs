import {createHash} from 'node:crypto';
import dgram from 'node:dgram';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {lookup} from 'node:dns/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateServer,plainDirectory} from './client-core.mjs';
const run=promisify(execFile);
export const otherClient=id=>id==='dl'?'037':'dl';
export function selectClient(rules={},saved){
 const allowed=rules.allowed_clients||rules.version||'';
 const dl=/0\.3\.?DL\b/i.test(allowed),normal=/0\.3\.7\b/.test(allowed);
 if(dl&&!normal)return 'dl';if(normal&&!dl)return '037';
 return ['037','dl'].includes(saved)?saved:'037';
}
export function parseRules(packet,header){
 if(packet.length<13||packet.length>65507||!packet.subarray(0,11).equals(header))throw Error('Respuesta no válida.');
 const count=packet.readUInt16LE(11);if(count>256)throw Error('Demasiadas reglas.');
 let offset=13;const rules=Object.create(null);
 const string=()=>{if(offset>=packet.length)throw Error('Respuesta incompleta.');const size=packet[offset++];if(offset+size>packet.length)throw Error('Respuesta incompleta.');const value=packet.toString('latin1',offset,offset+size);offset+=size;return value;};
 for(let i=0;i<count;i++){const key=string(),value=string();rules[key.toLowerCase()]=value;}return rules;
}
export async function queryRules(server,timeout=1800){
 validateServer(server);const split=server.lastIndexOf(':'),port=Number(server.slice(split+1));
 const {address}=await Promise.race([lookup(server.slice(0,split),{family:4}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Tiempo agotado.')),timeout);t.unref();})]);
 const header=Buffer.alloc(11);header.write('SAMP');address.split('.').forEach((n,i)=>header[4+i]=Number(n));header.writeUInt16LE(port,8);header[10]=0x72;
 return new Promise(resolve=>{const socket=dgram.createSocket('udp4');let done=false;const finish=rules=>{if(done)return;done=true;clearTimeout(timer);socket.close();resolve({rules,address,port});};const timer=setTimeout(()=>finish({}),timeout);
  socket.on('error',()=>finish({}));socket.on('message',(data,peer)=>{if(peer.address!==address||peer.port!==port)return;try{finish(parseRules(data,header));}catch{}});socket.send(header,port,address,e=>{if(e)finish({});});
 });
}
export class ConnectionLines {
 constructor(server){this.server=server;this.connecting=false;this.finished=false;this.pending='';}
 feed(chunk){if(this.finished)return null;this.pending+=chunk;const lines=this.pending.split(/\r?\n/);this.pending=lines.pop().slice(-2048);
  for(let line of lines){line=line.replace(/\{[0-9a-f]{6}\}/gi,'').replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/,'').trim();
   if(line===`Connecting to ${this.server}...`)this.connecting=true;
   if(!this.connecting)continue;
   if(line==='CONNECTION REJECTED: Incorrect Version.'){this.finished=true;return 'mismatch';}
   if(/^Connected to .+/.test(line)&&line!=='Connected to remote command console.'){this.finished=true;return 'connected';}
  }return null;
 }
}
export class LogTail {
 constructor(file){this.file=file;this.offset=0;this.prefix=Buffer.alloc(0);this.stamp=null;}
 async read(initial=false){let file;try{file=await fs.open(this.file,'r');const stat=await file.stat();const stamp=stat.mtimeMs+':'+stat.size;if(this.stamp===stamp)return '';this.stamp=stamp;const prefix=Buffer.alloc(Math.min(this.prefix.length||64,stat.size));await file.read(prefix,0,prefix.length,0);
  if(stat.size<this.offset||!prefix.subarray(0,this.prefix.length).equals(this.prefix))this.offset=0;
  this.prefix=prefix;
  const from=initial?stat.size:Math.max(this.offset,stat.size-262144),bytes=Buffer.alloc(stat.size-from);await file.read(bytes,0,bytes.length,from);this.offset=stat.size;return bytes.toString('latin1');
 }catch(e){if(e.code==='ENOENT'){this.offset=0;this.prefix=Buffer.alloc(0);return '';}throw e;}finally{await file?.close();}}
}
export class MultiVersion {
 constructor(root,helper){this.file=path.join(root,'server-clients.json');this.helper=helper;this.choices={};}
 async init(){try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));for(const [key,value]of Object.entries(data)){try{validateServer(key);if(['037','dl'].includes(value))this.choices[key]=value;}catch{}}}catch(e){if(e.code!=='ENOENT')this.choices={};}return this;}
 async enabled(game){await plainDirectory(game);game=await fs.realpath(game);const key=createHash('sha256').update(path.resolve(game).replace(/[\\/]+$/,'').toUpperCase()).digest('hex'),dir=path.join(path.dirname(this.file),'games',key);try{await plainDirectory(dir);for(const name of ['client.json','pending.json']){const state=path.join(dir,name);const stat=await fs.lstat(state).catch(()=>null);if(stat?.isFile()&&!stat.isSymbolicLink())return true;}return false;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
 async activate(game,id){if(!['037','dl'].includes(id))throw Error('Versión no válida.');try{await run(this.helper,['--activate',game,id],{windowsHide:true,timeout:120000,maxBuffer:65536});}catch(e){throw Error(e.stderr?.trim()||'No se pudo cambiar SA-MP. Reinstala Multiversión.');}}
 async remember(server,id){validateServer(server);if(!['037','dl'].includes(id))return;const entries=Object.entries({...this.choices,[server]:id}).slice(-2000);this.choices=Object.fromEntries(entries);await fs.writeFile(this.file+'.tmp',JSON.stringify(this.choices));await fs.rename(this.file+'.tmp',this.file);}
}
