import log from "electron-log/main";

// Writes to ~/Library/Logs/Codez/main.log
// Also forwards renderer console output to the same file via IPC
log.initialize({ spyRendererConsole: true });

// Override console so all existing console.log/error/warn calls are captured
Object.assign(console, log.functions);

export default log;
