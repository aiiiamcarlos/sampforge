import * as fs from 'node:fs/promises';
import path from 'node:path';
export async function plainDirectory(p){p=path.resolve(p);let current=path.parse(p).root;for(const part of p.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);const s=await fs.lstat(current);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Carpeta no válida.');}return p;}
export function validateServer(server){const m=/^([a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?):([0-9]{1,5})$/.exec(server);if(!m||Number(m[2])<1||Number(m[2])>65535)throw Error('Servidor no válido.');return server;}
export function nickname(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_\[\].()$@=]{3,24}$/.test(value))throw Error('Nombre: entre 3 y 24 letras, números o guion bajo.');return value;}
export class ClientSettings{
 constructor(root){this.root=root;this.file=path.join(root,'client.json');this.state={game:'',nickname:'Player'};}
 async init(installedGame=''){await fs.mkdir(this.root,{recursive:true});try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));this.state={game:typeof data.game==='string'?data.game:'',nickname:nickname(data.nickname)};}catch(e){if(e.code!=='ENOENT')throw e;try{const old=JSON.parse(await fs.readFile(path.join(this.root,'state.json'),'utf8'));const p=old.profiles?.[0];if(p)this.state={game:p.game||'',nickname:nickname(p.nickname)};}catch{}}if(!this.state.game)this.state.game=installedGame;return this;}
 async save(changes){const next={...this.state,...changes};const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify(next,null,2));await fs.rename(temp,this.file);this.state=next;return next;}
 async setGame(folder){const game=await plainDirectory(folder);const exe=await fs.lstat(path.join(game,'gta_sa.exe')).catch(()=>null);if(!exe?.isFile()||exe.isSymbolicLink())throw Error('No se encontró gta_sa.exe.');return this.save({game});}
 async setNickname(value){return this.save({nickname:nickname(value)});}
}
