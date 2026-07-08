var fso = new ActiveXObject("Scripting.FileSystemObject");
var currentDir = "c:\\Users\\moshe\\Desktop\\??? ????? ???\\gemach-app";
var wsh = new ActiveXObject("WScript.Shell");
wsh.CurrentDirectory = currentDir;
try {
    var stream = new ActiveXObject("ADODB.Stream");
    stream.Type = 2;
    stream.CharSet = "utf-8";
    stream.Open();
    stream.LoadFromFile("deploy_log.txt");
    WScript.Echo("SUCCESS: " + stream.ReadText().length);
    stream.Close();
} catch(e) {
    WScript.Echo("ERROR: " + e.message);
}
