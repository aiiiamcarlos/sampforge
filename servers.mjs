import { validateServer } from './client-core.mjs';
const clean = (s,n=160) => String(s || '').replace(/[\x00-\x1f]/g,' ').slice(0,n);
export function normalizeServer(raw) {
  let address;try{address=validateServer(String(raw.ip));}catch{return null;}
  if(!Number.isInteger(raw.pc)||raw.pc<0||!Number.isInteger(raw.pm)||raw.pm<0)return null;
  return {address,name:clean(raw.hn)||address,players:raw.pc,maxPlayers:raw.pm,language:clean(raw.la,80)||'Sin indicar',mode:clean(raw.gm,80),password:raw.pa===true};
}
export class ServerDirectory {
  constructor(request=fetch){this.request=request;this.cache=null;this.pending=null;}
  async list(){
    if(this.cache && Date.now()-this.cache.fetchedAt<60000)return {...this.cache,cached:true};
    if(this.pending)return this.pending;
    this.pending=this.load();try{return await this.pending;}finally{this.pending=null;}
  }
  async load(){
    try{
      const r=await this.request('https://api.open.mp/servers',{redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw Error(`Directorio no disponible (${r.status}).`);
      let size=0;const parts=[];for await(const p of r.body){size+=p.length;if(size>8*1024*1024)throw Error('Directorio demasiado grande.');parts.push(p);}
      const raw=JSON.parse(Buffer.concat(parts));if(!Array.isArray(raw)||raw.length>30000)throw Error('Formato del directorio no válido.');
      const unique=new Map(raw.map(normalizeServer).filter(Boolean).map(s=>[s.address,s]));
      return this.cache={items:[...unique.values()],fetchedAt:Date.now(),stale:false,source:'open.mp'};
    }catch(e){if(this.cache)return {...this.cache,stale:true};throw Error('No se pudo actualizar la lista. '+e.message);}
  }
}
