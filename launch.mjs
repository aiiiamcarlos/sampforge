import path from 'node:path';
import { lookup } from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { plainDirectory, validateServer } from './client-core.mjs';
const execute = promisify(execFile);

export async function launchArguments(profile, resolve = lookup) {
  validateServer(profile.server);
  if (!/^[a-zA-Z0-9_\[\].()$@=]{3,24}$/.test(profile.nickname)) throw Error('Nombre de jugador inválido.');
  const split = profile.server.lastIndexOf(':');
  const host = profile.server.slice(0, split), port = profile.server.slice(split + 1);
  let address;
  try { ({ address } = await resolve(host, { family: 4 })); }
  catch { throw Error('No se pudo resolver la dirección del servidor. Revisa el dominio y tu conexión.'); }
  return [await plainDirectory(profile.game), address, String(Number(port)), profile.nickname];
}

export async function launchDirect(profile, helper) {
  const args = await launchArguments(profile);
  try {
    const { stdout } = await execute(helper, args, { cwd: path.dirname(helper), windowsHide: true, timeout: 35000, maxBuffer: 65536 });
    const result = JSON.parse(stdout.trim());
    if (result.direct !== true || !Number.isInteger(result.pid) || result.pid < 1) throw Error('Respuesta inválida del iniciador.');
    return {...result,address:args[1],port:Number(args[2])};
  } catch (error) {
    if(error.code==='UNKNOWN'||error.code==='EACCES'||error.code==='EPERM')throw Error('Windows no permitió abrir el iniciador de GTA.');
    throw Error(error.stderr?.trim() || `No se pudo iniciar GTA directamente: ${error.message}`);
  }
}
