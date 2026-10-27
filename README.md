# SampForge 0.17.1

Launcher de código abierto para Windows, con lista de servidores y SA-MP multiversión. Primera publicación de prueba.

**[Descargar para Windows](https://github.com/aiiiamcarlos/sampforge/releases/tag/v0.17.1)** · [Reportar un problema](https://github.com/aiiiamcarlos/sampforge/issues)

Interfaz simple con Servidores y Configuración, filtros por nombre, jugadores e idioma y entrada directa al juego.

## Instalación

Un único instalador pide la carpeta de GTA San Andreas v1.0. Instala automáticamente **SA-MP 0.3.7 original y 0.3.DL-R1**; no hay selector de versiones ni asistente SA-MP adicional. Las licencias aparecen dentro del instalador principal. Los paquetes se descargan de URLs fijadas, se verifica SHA-256 y se extraen archivos con hashes conocidos. No se ejecutan los instaladores originales ni se descarga GTA.

No crea backups del GTA ni de archivos del usuario. Solo escribe los archivos de cliente enumerados en client-payloads.json. Los archivos ajenos, como winmm.dll, permanecen intactos. Los backups de versiones anteriores no se borran automáticamente. Si se interrumpe la escritura, conserva un pequeño registro y completa la instalación al reintentar; no recupera archivos antiguos.

Los datos del launcher, clientes descargados, ajustes, registros y caché están en **Documentos/SampForge** (respetando la ubicación de Documentos de Windows). El ejecutable permanece en la carpeta elegida para el programa. Migra la ruta y el nombre del estado anterior al abrir sin borrar los datos antiguos. El juego mantiene sus propios datos en GTA San Andreas User Files.

Instalación silenciosa: /S /GTA="C:\Games\GTA San Andreas". Las actualizaciones pueden recuperar la ruta guardada; una instalación nueva sin ruta devuelve error. No hay ventanas auxiliares.

## Multiversión

Consulta version y allowed_clients antes de jugar. Si no hay respuesta usa la versión recordada o 0.3.7. El cambio verifica los archivos y se hace con GTA cerrado. Tras un rechazo exacto por versión, ofrece Reintentar con el otro cliente; primero hay que cerrar GTA. Recuerda la versión después de confirmar conexión. El seguimiento del registro termina al conectar, al rechazar, al cerrar GTA o al cumplirse dos minutos; requiere el chatlog estándar habilitado.

## Recursos

Lista paginada a 60 filas, búsquedas con espera de 120 ms y textos normalizados una sola vez, resultados de filtrado reutilizados, selección sin reconstruir filas. Directorio con caché de un minuto y sin consultas periódicas en reposo. Registro comprobado cada 1,5 segundos solo durante la conexión; sin releer contenido si no cambió. Corrector ortográfico deshabilitado, reducción de actividad de Chromium en segundo plano y caché de disco limitada a 16 MB. No se promete un consumo fijo de RAM: sigue usando Electron.

## Desarrollo y validación

Windows, Node.js 24 y .NET Framework 4.x. npm ci; npm test; npm start; npm run dist. Resultado: dist/SampForge-Setup-0.17.1-x64.exe.

14 pruebas de configuración, lanzamiento con un ejecutable de prueba, directorio, versión, registro y preparación nativa pasan. La prueba nativa usa los dos instaladores verificados en ../tooling/samp-versions y un GTA ficticio; comprueba instalación, cambio, recuperación sin backups y archivos ajenos intactos. Ejecuta `node scripts/prepare-test-clients.mjs` para preparar las dos descargas verificadas. CI ejecuta este paso antes de probar. Sin ellas, la prueba nativa se omite expresamente. Interfaz comprobada a 1120 y 600 px y con 30.000 servidores ficticios; solo 60 filas se crean.

El instalador y sus componentes todavía no están firmados. Windows puede bloquearlos según su política de seguridad. En la comprobación local más reciente el componente se ejecutó y pasaron las pruebas de inicio directo con un ejecutable de prueba. Todavía no se ha validado una partida real; esta publicación se ofrece como versión preliminar.

Fuentes: https://github.com/Se8870/SAMP-File-Archive (URLs fijadas a revisión); https://open.mp/docs/tutorials/QueryMechanism . Hashes locales, no firmas del editor. No se redistribuyen los instaladores originales. 7-Zip: vendor/7zip/License.txt. Assets: licenses/USER-ASSETS.md. MIT corresponde al código del launcher.
