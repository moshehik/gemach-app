var fso = new ActiveXObject("Scripting.FileSystemObject");
var wsh = new ActiveXObject("WScript.Shell");
wsh.CurrentDirectory = "c:\\Users\\moshe\\Desktop\\??? ????? ???\\gemach-app";
WScript.Echo("Exists? " + fso.FileExists("deploy_log.txt"));
