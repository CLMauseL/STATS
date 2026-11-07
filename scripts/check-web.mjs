import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
const html=await readFile('team-web/index.html','utf8');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(match[1]);
for(const file of ['team-web/cloud.js','team-web/firebase-config.js','team-web/stats-model.js','team-web/tabs.js','team-web/pairing-client.js','team-web/minecraft-names.js']) execFileSync(process.execPath,['--check',file]);
console.log('Dashboard scripts: syntax OK');
