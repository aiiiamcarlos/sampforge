using System;using System.IO;using System.Net;using System.Diagnostics;using System.Security.Cryptography;using System.Threading.Tasks;using System.Web.Script.Serialization;using System.Reflection;
internal class SampVersion {public string label;public string url;public string sha256;public string clientHash;public long size;public override string ToString(){return label+(label.Contains("RC")?" · Prueba":"");}}
internal static class ClientSetup {
    public static string Hash(string file) { using (var s=File.OpenRead(file)) using(var h=SHA256.Create()) return BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant(); }
    public static void Plain(string file) {
        var current=Path.GetFullPath(file);
        while(!String.IsNullOrEmpty(current)) {
            if ((File.GetAttributes(current)&FileAttributes.ReparsePoint)!=0) throw new Exception("No se admiten enlaces ni junctions: " + current);
            current=Path.GetDirectoryName(current);
        }
    }
    public static void Validate(string game) {
        Plain(game);
        var exe=Path.Combine(game,"gta_sa.exe"); Plain(exe);
        using(var r=new BinaryReader(File.OpenRead(exe))) {
            if(r.BaseStream.Length<256 || r.ReadUInt16()!=0x5A4D) throw new Exception("gta_sa.exe no es un ejecutable válido.");
            r.BaseStream.Position=0x3c; var pe=r.ReadUInt32();
            if(pe>r.BaseStream.Length-96) throw new Exception("Cabecera del juego dañada.");
            r.BaseStream.Position=pe;
            if(r.ReadUInt32()!=0x4550 || r.ReadUInt16()!=0x14c) throw new Exception("Se necesita GTA San Andreas clásico de 32 bits.");
            r.BaseStream.Position=pe+24;
            if(r.ReadUInt16()!=0x10b) throw new Exception("Formato del juego no admitido.");
            r.BaseStream.Position=pe+40; var entry=r.ReadUInt32()+0x400000;
            // PE entry points documented by DK22Pac/plugin-sdk injector game detection.
            if(entry!=0x82457c && entry!=0x824570 && entry!=0x8245bc && entry!=0x8245b0)
                throw new Exception("No se reconoce este ejecutable como GTA San Andreas v1.0 US/EU. No se modificó el juego.");
        }
        foreach(var dir in new[]{"models","data","audio"}) {
            var p=Path.Combine(game,dir); if(!Directory.Exists(p)) throw new Exception("Falta la carpeta " + dir + ". Selecciona una instalación completa del juego."); Plain(p);
        }
    }
    public static void Idle() { if(Process.GetProcessesByName("gta_sa").Length!=0 || Process.GetProcessesByName("samp").Length!=0) throw new Exception("Cierra GTA San Andreas y el cliente SA-MP antes de continuar."); }

 public static SampVersion[] Versions(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("SampVersions.json"))using(var reader=new StreamReader(stream)){var entries=new JavaScriptSerializer().Deserialize<SampVersion[]>(reader.ReadToEnd());foreach(var v in entries)if(v.size<1024||v.size>64*1024*1024||!System.Text.RegularExpressions.Regex.IsMatch(v.sha256,"^[a-f0-9]{64}$")||!System.Text.RegularExpressions.Regex.IsMatch(v.clientHash??"","^[a-f0-9]{64}$"))throw new Exception("Catálogo no válido.");return entries;}}
 static bool Allowed(Uri u){return u.Scheme=="https"&&u.IsDefaultPort&&String.IsNullOrEmpty(u.UserInfo)&&(u.Host=="raw.githubusercontent.com"||u.Host=="www.gta-multiplayer.cz"||u.Host=="sampcenter.com");}
 public static void Download(SampVersion version,string target,Action<int> progress){
  var uri=new Uri(version.url);
  for(int hop=0;hop<5;hop++){
   if(!Allowed(uri))throw new Exception("Fuente no permitida.");
   var request=(HttpWebRequest)WebRequest.Create(uri);request.AllowAutoRedirect=false;request.Timeout=30000;request.ReadWriteTimeout=60000;request.UserAgent="SampForge/0.17";
   using(var response=(HttpWebResponse)request.GetResponse()){
    int status=(int)response.StatusCode;if(status>=300&&status<400){uri=new Uri(uri,response.Headers["Location"]);continue;}
    if(status!=200||response.ContentLength>version.size)throw new Exception("Descarga no válida.");
    using(var input=response.GetResponseStream())using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write)){byte[] buffer=new byte[65536];long total=0;int n;while((n=input.Read(buffer,0,buffer.Length))>0){total+=n;if(total>version.size)throw new Exception("Tamaño no válido.");output.Write(buffer,0,n);progress((int)(total*100/version.size));}if(total!=version.size)throw new Exception("Descarga incompleta.");}
    if(Hash(target)!=version.sha256)throw new Exception("La descarga cambió. No se instalará.");return;
   }
  }throw new Exception("Demasiadas redirecciones.");
 }
 public static void VerifyClient(SampVersion v,string game){var dll=Path.Combine(game,"samp.dll");Plain(dll);if(Hash(dll)!=v.clientHash)throw new Exception("No se instaló la versión elegida en esta carpeta.");}
 static int Main(string[] args){ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
  try{
   if(args.Length==2&&args[0]=="--install-multi"){int last=-1;MultiClient.Prepare(args[1],n=>{if(n!=last){last=n;Console.WriteLine("Descargando SA-MP · "+n+"%");}});Console.WriteLine("SA-MP instalado.");return 0;}
   if(args.Length==3&&args[0]=="--activate"){MultiClient.Activate(args[1],args[2]);return 0;}
   if(args.Length==4&&args[0]=="--extract-client"){MultiClient.Extract(args[1],args[2],args[3]);return 0;}
   if(args.Length==2&&args[0]=="--validate"){Validate(args[1]);return 0;}
   if(args.Length==2&&args[0]=="--catalog"){File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(Versions()));return 0;}
   throw new Exception("Abre el instalador de SampForge.");
  }catch(Exception e){Console.Error.WriteLine(e.Message);return 2;}
 }
}
