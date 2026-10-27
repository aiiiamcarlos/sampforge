import test from 'node:test';
import assert from 'node:assert/strict';
import {ServerDirectory,normalizeServer} from '../servers.mjs';
test('directory validates addresses and counters and deduplicates servers',async()=>{let calls=0;const d=new ServerDirectory(async()=>{calls++;return new Response(JSON.stringify([{ip:'127.0.0.1:7777',hn:'Roleplay',pc:12,pm:100,la:'Español'},{ip:'127.0.0.1:7777',hn:'Roleplay',pc:13,pm:100,la:'Español'},{ip:'bad:99999',pc:0,pm:5}]));});const r=await d.list();assert.equal(r.items.length,1);assert.equal(r.items[0].players,13);await d.list();assert.equal(calls,1);assert.equal(normalizeServer({ip:'127.0.0.1:7777',pc:-2,pm:10}),null);d.cache.fetchedAt=0;d.request=async()=>{throw Error('offline');};assert.equal((await d.list()).stale,true);});
