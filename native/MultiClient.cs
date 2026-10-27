using System;using System.IO;using System.Linq;using System.Collections.Generic;using System.Diagnostics;using System.Reflection;using System.Web.Script.Serialization;
internal class PayloadFile {public string source,path,hash;}
internal class Payload {public string id,label;public PayloadFile[] files;}
internal class ClientState {public string active;public string game;}
internal class SwitchJournal {public string target;}
internal static class MultiClient {
 static JavaScriptSerializer json=new JavaScriptSerializer();
 internal static string DataRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"SampForge");
 internal static string Cache {get{return Path.Combine(DataRoot,"clients");}}
 public static Payload[] Catalog(){using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("ClientPayloads.json"))using(var r=new StreamReader(s))return json.Deserialize<Payload[]>(r.ReadToEnd());}
 static string[] Names(){return Catalog().SelectMany(p=>p.files).Select(f=>f.path).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();}
 static string StateDir(string game){using(var h=System.Security.Cryptography.SHA256.Create()){var key=BitConverter.ToString(h.ComputeHash(System.Text.Encoding.UTF8.GetBytes(Path.GetFullPath(game).TrimEnd('\\').ToUpperInvariant()))).Replace("-", "").ToLowerInvariant();return Path.Combine(DataRoot,"games",key);}}
 static string Safe(string root,string name){var p=Path.GetFullPath(Path.Combine(root,name));if(!p.StartsWith(Path.GetFullPath(root)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Ruta no válida.");var check=p;while(!File.Exists(check)&&!Directory.Exists(check))check=Path.GetDirectoryName(check);ClientSetup.Plain(check);if(Directory.Exists(p))throw new Exception("Se esperaba un archivo: "+name);return p;}
 static void Write(string file,string content){var tmp=file+".tmp-"+Guid.NewGuid().ToString("N");File.WriteAllText(tmp,content);if(File.Exists(file))File.Replace(tmp,file,null);else File.Move(tmp,file);}
 static string Digest(string root,string name){var p=Safe(root,name);return File.Exists(p)?ClientSetup.Hash(p):null;}
 static void Copy(string source,string root,string name){var p=Safe(root,name);Directory.CreateDirectory(Path.GetDirectoryName(p));var tmp=p+".sf-"+Guid.NewGuid().ToString("N");try{File.Copy(source,tmp);if(File.Exists(p))File.Replace(tmp,p,null);else File.Move(tmp,p);}finally{if(File.Exists(tmp))File.Delete(tmp);}}
 public static void Verify(string id){var p=Array.Find(Catalog(),x=>x.id==id);if(p==null)throw new Exception("Versión no válida.");foreach(var f in p.files)if(Digest(Path.Combine(Cache,id),f.path)!=f.hash)throw new Exception("Reinstala Multiversión. Falta un archivo del cliente.");}
 public static void Extract(string id,string installer,string destination){var p=Array.Find(Catalog(),x=>x.id==id);if(p==null)throw new Exception("Versión no válida.");var v=Array.Find(ClientSetup.Versions(),x=>x.label==p.label);if(ClientSetup.Hash(installer)!=v.sha256)throw new Exception("Instalador no válido.");Directory.CreateDirectory(destination);ClientSetup.Plain(destination);
  var unpack=Path.Combine(destination,"unpack-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(unpack);
  try{var exe=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"7zip","7z.exe");using(var process=Process.Start(new ProcessStartInfo(exe,"x \""+installer+"\" -o\""+unpack+"\" -y -bso0 -bsp0"){UseShellExecute=false,CreateNoWindow=true})){if(!process.WaitForExit(120000)){process.Kill();throw new Exception("No se pudo extraer SA-MP.");}if(process.ExitCode!=0)throw new Exception("Archivo no válido.");}
   foreach(var f in p.files){var source=Safe(unpack,f.source);if(ClientSetup.Hash(source)!=f.hash)throw new Exception("Archivo del cliente no válido.");Copy(source,destination,f.path);}
  }finally{if(Directory.Exists(unpack)){ClientSetup.Plain(unpack);Directory.Delete(unpack,true);}}
 }
 public static void Install(Action<int> progress){Directory.CreateDirectory(Cache);ClientSetup.Plain(Cache);int index=0;foreach(var p in Catalog()){bool ready=true;try{Verify(p.id);}catch{ready=false;}if(!ready){var v=Array.Find(ClientSetup.Versions(),x=>x.label==p.label);var temp=Path.Combine(Cache,"download-"+Guid.NewGuid().ToString("N")+".exe");try{int offset=index*50;ClientSetup.Download(v,temp,n=>progress(offset+n/2));Extract(p.id,temp,Path.Combine(Cache,p.id));Verify(p.id);}finally{if(File.Exists(temp))File.Delete(temp);}}index++;progress(index*50);}}
 public static void Activate(string game,string id,bool installing=false){using(var mutex=new System.Threading.Mutex(false,"Local\\SampForge.ClientSwitch")){bool held=false;try{try{held=mutex.WaitOne(0);}catch(System.Threading.AbandonedMutexException){held=true;}if(!held)throw new Exception("Espera a que termine la instalación de SA-MP.");ActivateLocked(game,id,installing);}finally{if(held)mutex.ReleaseMutex();}}}
 static void ActivateLocked(string game,string id,bool installing){
  ClientSetup.Validate(game);ClientSetup.Idle();Verify(id);
  var dir=StateDir(game);Directory.CreateDirectory(dir);ClientSetup.Plain(dir);string stateFile=Safe(dir,"client.json"),journalFile=Safe(dir,"pending.json");
  var next=Array.Find(Catalog(),p=>p.id==id);var state=File.Exists(stateFile)?json.Deserialize<ClientState>(File.ReadAllText(stateFile)):null;
  // Recovery completes a verified installation; no user files are copied or backed up.
  bool pending=File.Exists(journalFile);
  if(state!=null&&!pending&&!installing){var previous=Array.Find(Catalog(),p=>p.id==state.active);if(previous==null)throw new Exception("Reinstala SA-MP.");foreach(var f in previous.files)if(Digest(game,f.path)!=f.hash)throw new Exception("SA-MP fue modificado: "+f.path+". Reinstala SA-MP.");if(state.active==id)return;}
  foreach(var f in next.files)Safe(game,f.path);
  Write(journalFile,json.Serialize(new SwitchJournal{target=id}));
  foreach(var f in next.files)if(Digest(game,f.path)!=f.hash)Copy(Safe(Path.Combine(Cache,id),f.path),game,f.path);
  foreach(var f in next.files)if(Digest(game,f.path)!=f.hash)throw new Exception("No se pudo comprobar SA-MP. Reintenta la instalación.");
  Write(stateFile,json.Serialize(new ClientState{active=id,game=Path.GetFullPath(game)}));File.Delete(journalFile);
 }
 public static bool Enabled(string game){return File.Exists(Path.Combine(StateDir(game),"client.json"))||File.Exists(Path.Combine(StateDir(game),"pending.json"));}
 public static void Prepare(string game,Action<int> progress){ClientSetup.Validate(game);ClientSetup.Idle();Install(progress);Activate(game,"037",true);Directory.CreateDirectory(DataRoot);Write(Path.Combine(DataRoot,"game-path.txt"),Path.GetFullPath(game));var settingsFile=Path.Combine(DataRoot,"client.json");var settings=File.Exists(settingsFile)?json.Deserialize<Dictionary<string,object>>(File.ReadAllText(settingsFile)):new Dictionary<string,object>();settings["game"]=Path.GetFullPath(game);if(!settings.ContainsKey("nickname")){settings["nickname"]="Player";try{var old=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"sampforge","client.json");var previous=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(old));object nick;if(previous.TryGetValue("nickname",out nick)&&System.Text.RegularExpressions.Regex.IsMatch(Convert.ToString(nick),@"\A[a-zA-Z0-9_\[\].()$@=]{3,24}\z"))settings["nickname"]=nick;}catch{}}Write(settingsFile,json.Serialize(settings));}
}
