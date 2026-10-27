import * as fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const catalog=JSON.parse(await fs.readFile(path.join(root,'samp-versions.json'),'utf8'));
const destination=path.resolve(root,'../tooling/samp-versions');
await fs.mkdir(destination,{recursive:true});
for(const client of catalog){
 const file=path.join(destination,path.basename(client.name));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{if(digest(await fs.readFile(file))===client.sha256){console.log(`${client.label}: verificado`);continue;}}catch(e){if(e.code!=='ENOENT')throw e;}
 const response=await fetch(client.url,{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Descarga ${client.label}: HTTP ${response.status}`);
 let size=0;const parts=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>client.size)throw Error('Tamaño no válido.');parts.push(chunk);}
 const bytes=Buffer.concat(parts);
 if(size!==client.size||digest(bytes)!==client.sha256)throw Error(`Hash no válido: ${client.label}`);
 await fs.writeFile(file+'.tmp',bytes);await fs.rename(file+'.tmp',file);
 console.log(`${client.label}: descargado y verificado`);
}
