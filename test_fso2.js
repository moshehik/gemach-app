var fso = new ActiveXObject("Scripting.FileSystemObject");
var wsh = new ActiveXObject("WScript.Shell");
WScript.Echo("Exists? " + fso.FileExists("deploy_log.txt"));
