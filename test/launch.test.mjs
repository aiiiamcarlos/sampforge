import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchArguments, launchDirect } from '../launch.mjs';
const exec = promisify(execFile);
const helper = fileURLToPath(new URL('../native/bin/SampForge.DirectLaunch.exe', import.meta.url));

test('direct launch resolves IPv4, separates arguments and rejects invalid input', async t => {
  const game = await fs.mkdtemp(path.join(os.tmpdir(), 'sampforge-args-'));
  t.after(() => fs.rm(game, { recursive:true, force:true }));
  const profile = { game, server:'example.test:07777', nickname:'[SF]Player' };
  assert.deepEqual(await launchArguments(profile, async (host, options) => {
    assert.equal(host, 'example.test'); assert.equal(options.family, 4);
    return {address:'127.0.0.1'};
  }), [game, '127.0.0.1', '7777', '[SF]Player']);
  await assert.rejects(launchArguments({...profile, nickname:'Bob -h evil'}), /jugador/);
  await assert.rejects(launchArguments({...profile, server:'host:99999'}), /Servidor/);
  await assert.rejects(launchArguments(profile, async () => { throw Error('dns'); }), /resolver/);
});

test('Windows helper launches an x86 fixture, loads a DLL before main, and never requires samp.exe', {skip:process.platform !== 'win32'}, async t => {
  const game = await fs.mkdtemp(path.join(os.tmpdir(), 'sampforge directo á '));
  let pid;
  t.after(async () => {
    if (pid) { try { process.kill(pid); } catch {} }
    await fs.rm(game, {recursive:true, force:true, maxRetries:20, retryDelay:100});
  });
  const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework/v4.0.30319/csc.exe');
  const source = path.join(game, 'Fixture.cs');
  await fs.writeFile(source, `using System; using System.IO; using System.Runtime.InteropServices;
class Fixture {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandleW(string name);
 static void Main(string[] args) {
  File.WriteAllText("observed.txt", (GetModuleHandleW("samp.dll") != IntPtr.Zero ? "loaded" : "missing") + "\\n" + String.Join("|", args));
  System.Threading.Thread.Sleep(15000);
 }
}`);
  await exec(compiler, ['/nologo','/platform:x86',`/out:${path.join(game,'gta_sa.exe')}`,source]);
  // A harmless Windows DLL stands in for the client; no game or network is used.
  await fs.copyFile(path.join(process.env.WINDIR,'SysWOW64/version.dll'),path.join(game,'samp.dll'));
  const result = await launchDirect({game,server:'127.0.0.1:7777',nickname:'[SF]Player'},helper);
  pid = result.pid;
  assert.equal(result.direct,true);
  assert.equal(await fs.readFile(path.join(game,'observed.txt'),'utf8'),'loaded\n-c|-h|127.0.0.1|-p|7777|-n|[SF]Player');
  await assert.rejects(fs.access(path.join(game,'samp.exe')));
  process.kill(pid); pid = null;
});

test('Windows helper rejects corrupt client files with a useful error', {skip:process.platform !== 'win32'}, async t => {
  const game = await fs.mkdtemp(path.join(os.tmpdir(), 'sampforge-invalid-'));
  t.after(() => fs.rm(game,{recursive:true,force:true}));
  await fs.writeFile(path.join(game,'gta_sa.exe'),'invalid');
  await fs.writeFile(path.join(game,'samp.dll'),'invalid');
  await assert.rejects(launchDirect({game,server:'127.0.0.1:7777',nickname:'Test_Player'},helper),/PE no valido/);
});
