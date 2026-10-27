using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

// This x86 helper only loads the installed SA-MP client into the game it creates.
// It does not attach to existing processes or accept an arbitrary DLL path.
internal static class DirectLaunch {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct StartupInfo {
        public uint cb; public string reserved, desktop, title;
        public uint x, y, width, height, charsX, charsY, fill, flags;
        public ushort show, reservedSize; public IntPtr reservedPtr, input, output, error;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process, thread; public uint pid, tid; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool CreateProcessW(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref StartupInfo si, out ProcessInfo pi);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr p, IntPtr address, UIntPtr size, uint type, uint protection);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool WriteProcessMemory(IntPtr p, IntPtr address, byte[] data, UIntPtr size, out UIntPtr written);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandleW(string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Ansi, ExactSpelling=true, SetLastError=true)] static extern IntPtr GetProcAddress(IntPtr module, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateRemoteThread(IntPtr p, IntPtr attr, UIntPtr stack, IntPtr start, IntPtr arg, uint flags, IntPtr id);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeThread(IntPtr thread, out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr p, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr p, IntPtr address, UIntPtr size, uint type);

    static Exception Error(string stage) { return new Exception(stage + ": " + new Win32Exception(Marshal.GetLastWin32Error()).Message); }
    static void CheckImage(string file, bool dll) {
        if (!File.Exists(file) || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) throw new Exception("Archivo ausente o enlace no permitido: " + Path.GetFileName(file));
        using (var reader = new BinaryReader(File.OpenRead(file))) {
            if (reader.BaseStream.Length < 64 || reader.ReadUInt16() != 0x5a4d) throw new Exception("Archivo PE no valido: " + Path.GetFileName(file));
            reader.BaseStream.Position = 60; int offset = reader.ReadInt32();
            if (offset < 64 || offset > reader.BaseStream.Length - 26) throw new Exception("Cabecera PE no valida.");
            reader.BaseStream.Position = offset;
            if (reader.ReadUInt32() != 0x4550 || reader.ReadUInt16() != 0x14c) throw new Exception("Se requiere GTA San Andreas clasico y SA-MP de 32 bits.");
            reader.BaseStream.Position = offset + 22; ushort flags = reader.ReadUInt16();
            if (((flags & 0x2000) != 0) != dll || reader.ReadUInt16() != 0x10b) throw new Exception("Tipo de ejecutable no valido: " + Path.GetFileName(file));
        }
    }
    static int Main(string[] args) {
        ProcessInfo pi = new ProcessInfo(); IntPtr memory = IntPtr.Zero, loader = IntPtr.Zero;
        bool success = false;
        try {
            if (args.Length != 4) throw new Exception("Uso: DirectLaunch carpeta IPv4 puerto nombre");
            string folder = Path.GetFullPath(args[0]);
            for (var dir = new DirectoryInfo(folder); dir != null; dir = dir.Parent)
                if ((dir.Attributes & FileAttributes.ReparsePoint) != 0) throw new Exception("No se admiten enlaces en la carpeta del juego.");
            IPAddress ip; int port;
            if (!IPAddress.TryParse(args[1], out ip) || ip.AddressFamily != AddressFamily.InterNetwork || !Int32.TryParse(args[2], out port) || port < 1 || port > 65535 || !Regex.IsMatch(args[3], @"\A[a-zA-Z0-9_\[\].()$@=]{3,24}\z")) throw new Exception("Servidor o nombre de jugador no valido.");
            string exe = Path.Combine(folder, "gta_sa.exe"), dll = Path.Combine(folder, "samp.dll");
            CheckImage(exe, false); CheckImage(dll, true);
            var si = new StartupInfo(); si.cb = (uint)Marshal.SizeOf(si);
            var command = new StringBuilder("\"" + exe + "\" -c -h " + ip + " -p " + port + " -n " + args[3]);
            if (!CreateProcessW(exe, command, IntPtr.Zero, IntPtr.Zero, false, 0x0c, IntPtr.Zero, folder, ref si, out pi)) throw Error("No se pudo iniciar GTA");
            byte[] bytes = Encoding.Unicode.GetBytes(dll + "\0");
            memory = VirtualAllocEx(pi.process, IntPtr.Zero, (UIntPtr)bytes.Length, 0x3000, 4);
            if (memory == IntPtr.Zero) throw Error("No se pudo preparar SA-MP");
            UIntPtr written;
            if (!WriteProcessMemory(pi.process, memory, bytes, (UIntPtr)bytes.Length, out written) || written.ToUInt64() != (ulong)bytes.Length) throw Error("No se pudo transferir la ruta de SA-MP");
            IntPtr address = GetProcAddress(GetModuleHandleW("kernel32.dll"), "LoadLibraryW");
            if (address == IntPtr.Zero) throw Error("No se encontro el cargador de Windows");
            loader = CreateRemoteThread(pi.process, IntPtr.Zero, UIntPtr.Zero, address, memory, 0, IntPtr.Zero);
            if (loader == IntPtr.Zero) throw Error("No se pudo cargar SA-MP");
            if (WaitForSingleObject(loader, 20000) != 0) throw new Exception("SA-MP no termino de cargar en 20 segundos. Se cancelo el inicio.");
            uint loaded;
            if (!GetExitCodeThread(loader, out loaded) || loaded == 0) throw new Exception("Windows no pudo cargar samp.dll. Revisa la instalacion del cliente y sus dependencias.");
            bool clientPresent = false;
            using (var target = Process.GetProcessById((int)pi.pid)) {
                foreach (ProcessModule module in target.Modules)
                    if (String.Equals(Path.GetFullPath(module.FileName), dll, StringComparison.OrdinalIgnoreCase)) clientPresent = true;
            }
            if (!clientPresent) throw new Exception("No se encontro el cliente SA-MP cargado. Se cancelo el inicio para no abrir el modo individual.");
            if (ResumeThread(pi.thread) == UInt32.MaxValue) throw Error("No se pudo reanudar GTA");
            if (WaitForSingleObject(pi.process, 2000) != 258) throw new Exception("GTA se cerro durante el inicio. Revisa la version del juego, SA-MP y los mods.");
            success = true; Console.WriteLine("{\"pid\":" + pi.pid + ",\"direct\":true}"); return 0;
        } catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
        finally {
            // Never leave a failed game suspended or free memory still used by a loader.
            if (!success && pi.process != IntPtr.Zero) { TerminateProcess(pi.process, 1); WaitForSingleObject(pi.process, 5000); }
            if (memory != IntPtr.Zero && success) VirtualFreeEx(pi.process, memory, UIntPtr.Zero, 0x8000);
            if (loader != IntPtr.Zero) CloseHandle(loader);
            if (pi.thread != IntPtr.Zero) CloseHandle(pi.thread);
            if (pi.process != IntPtr.Zero) CloseHandle(pi.process);
        }
    }
}
