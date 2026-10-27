const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),root=path.resolve(__dirname,'..'),page=pathToFileURL(path.join(root,'web/client.html')).href;
const legacyData=app.getPath('userData'),dataRoot=process.env.SAMPFORGE_TEST_DATA?path.resolve(process.env.SAMPFORGE_TEST_DATA):path.join(app.getPath('documents'),'SampForge');
require('node:fs').mkdirSync(dataRoot,{recursive:true});app.setPath('userData',dataRoot);app.setPath('sessionData',path.join(dataRoot,'Cache'));app.setAppLogsPath(path.join(dataRoot,'logs'));
app.commandLine.appendSwitch('disk-cache-size','16777216');
let win,settings,directory,busy=false,launchUntil=0,multi,stopMonitor=()=>{},retry=null;
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>{if(win){win.restore();win.focus();}});app.whenReady().then(start).catch(async e=>{if(process.argv.includes('--smoke-test'))await fs.writeFile(path.join(app.getPath('userData'),'smoke-error.txt'),e.stack);else dialog.showErrorBox('SampForge',e.message);app.quit();});app.on('window-all-closed',()=>app.quit());}
async function playing(){if(Date.now()<launchUntil)return true;const {stdout}=await run(path.join(process.env.SystemRoot,'System32/tasklist.exe'),['/FI','IMAGENAME eq gta_sa.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:10000});return /"gta_sa\.exe"/i.test(stdout);}
async function start(){
 const {ClientSettings,validateServer}=await import(pathToFileURL(path.join(root,'client-core.mjs')).href),{ServerDirectory}=await import(pathToFileURL(path.join(root,'servers.mjs')).href);
 const installed=await fs.readFile(path.join(dataRoot,'game-path.txt'),'utf8').then(s=>s.trim()).catch(()=>'');if(!process.env.SAMPFORGE_TEST_DATA){try{await fs.access(path.join(dataRoot,'client.json'));}catch{try{const old=JSON.parse(await fs.readFile(path.join(legacyData,'client.json'),'utf8'));await fs.writeFile(path.join(dataRoot,'client.json'),JSON.stringify({game:typeof old.game==='string'?old.game:'',nickname:/^[a-zA-Z0-9_\[\].()$@=]{3,24}$/.test(old.nickname)?old.nickname:'Player'}),{flag:'wx'});}catch{}}}settings=await new ClientSettings(app.getPath('userData')).init(process.env.SAMPFORGE_TEST_DATA?'':installed);directory=new ServerDirectory();
 const mv=await import(pathToFileURL(path.join(root,"multiversion.mjs")).href);const setupHelper=app.isPackaged?path.join(process.resourcesPath,"native/SampForge.GameSetup.exe"):path.join(root,"native/bin/SampForge.GameSetup.exe");multi=await new mv.MultiVersion(app.getPath("userData"),setupHelper).init();
 async function connect(input,isRetry=false){
  if(await playing())throw Error(isRetry?"Cierra GTA y pulsa Reintentar.":"GTA ya está abierto.");if(!settings.state.game)throw Error("Elige la carpeta de GTA en Configuración.");
  const attempt=isRetry?retry:null;if(isRetry&&(!attempt||attempt.game!==settings.state.game))throw Error("Selecciona el servidor y pulsa Jugar.");
  const server=validateServer(attempt?.server||input.server);await settings.setNickname(attempt?.nickname||input.nickname);
  stopMonitor();retry=null;win.webContents.send("connection-state",{retry:false});
  const enabled=await multi.enabled(settings.state.game);let id;
  if(enabled){let query;try{query=await mv.queryRules(server);}catch{query=null;}id=attempt?mv.otherClient(attempt.id):mv.selectClient(query?.rules,multi.choices[server]);await multi.activate(settings.state.game,id);}
  const tail=new mv.LogTail(path.join(app.getPath("documents"),"GTA San Andreas User Files/SAMP/chatlog.txt"));if(enabled)await tail.read(true).catch(()=>{});
  const {launchDirect}=await import(pathToFileURL(path.join(root,"launch.mjs")).href);const helper=app.isPackaged?path.join(process.resourcesPath,"native/SampForge.DirectLaunch.exe"):path.join(root,"native/bin/SampForge.DirectLaunch.exe");const result=await launchDirect({...settings.state,server},helper);launchUntil=Date.now()+3000;
  if(enabled){const lines=new mv.ConnectionLines(`${result.address}:${result.port}`),game=settings.state.game,nickname=settings.state.nickname,started=Date.now();let polling=false,stopped=false;const timer=setInterval(async()=>{if(polling||stopped)return;polling=true;try{if(Date.now()-started>120000){stopMonitor();return;}const event=lines.feed(await tail.read());if(event){stopMonitor();if(event==="connected")await multi.remember(server,id);else if(!isRetry){retry={server,id,game,nickname};win.webContents.send("connection-state",{retry:true,text:"Versión incompatible. Cierra GTA y reintenta."});}else win.webContents.send("connection-state",{retry:false,text:"El servidor rechazó ambos clientes."});}else{try{process.kill(result.pid,0);}catch{stopMonitor();}}}catch{}finally{polling=false;}},1500);stopMonitor=()=>{stopped=true;clearInterval(timer);};}
  return {...result,client:id};
 }
 session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));session.defaultSession.setPermissionCheckHandler(()=>false);
 win=new BrowserWindow({width:1120,height:760,minWidth:580,minHeight:500,frame:false,backgroundColor:'#111111',show:false,icon:path.join(root,'web/assets/client-icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:true,spellcheck:false}});
 win.removeMenu();win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.on('will-attach-webview',e=>e.preventDefault());
 ipcMain.handle('launcher',async(event,action,input={})=>{
  if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==page)throw Error('Origen no autorizado.');
  if(action==='window-minimize'){win.minimize();return;}
  if(action==='window-maximize'){win.isMaximized()?win.unmaximize():win.maximize();return;}
  if(action==='window-close'){if(!busy)win.close();return;}
  if(action==='state')return {...settings.state,version:app.getVersion()};
  if(action==='servers')return directory.list();
  if(busy)throw Error('Espera un momento.');busy=true;
  try{
   if(action==='choose-game'){if(await playing())throw Error('Cierra GTA antes de cambiar la carpeta.');const result=await dialog.showOpenDialog(win,{title:'Carpeta de GTA',properties:['openDirectory']});if(result.canceled)return null;const state=await settings.setGame(result.filePaths[0]);stopMonitor();retry=null;win.webContents.send("connection-state",{retry:false});return state;}
   if(action==='nickname')return await settings.setNickname(input.nickname);
   if(action==='play')return await connect(input);
   if(action==='retry')return await connect(input,true);
   throw Error('Acción no disponible.');
  }finally{busy=false;}
 });
 const windowState=()=>win.webContents.send('window-state',{maximized:win.isMaximized()});win.on('maximize',windowState);win.on('unmaximize',windowState);win.on('close',e=>{if(busy)e.preventDefault();else stopMonitor();});
 await win.loadFile(path.join(root,'web/client.html'));
 if(process.argv.includes('--smoke-test')){await win.webContents.executeJavaScript('document.fonts.ready');const result=await win.webContents.executeJavaScript(`({title:document.title,hasLauncher:!!window.launcher,nodeDisabled:typeof require==='undefined',tabs:[...document.querySelectorAll('[data-tab]')].map(x=>x.textContent),modUI:!!document.querySelector('#mods'),frameControls:document.querySelectorAll('[data-window]').length})`);await fs.writeFile(path.join(app.getPath('userData'),'smoke-result.json'),JSON.stringify({version:app.getVersion(),packaged:app.isPackaged,dataRoot:app.getPath('userData'),renderer:result,memory:app.getAppMetrics().map(p=>({type:p.type,workingSetKB:p.memory.workingSetSize}))},null,2));app.quit();}else win.show();
}
