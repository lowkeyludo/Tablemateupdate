const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tablemateAutoSave", {
  openTableMateFolder: () => ipcRenderer.invoke("tablemate:open-folder"),
  saveBackupData: (jsonText) => ipcRenderer.invoke("tablemate:save-backup-data", jsonText),
  loadPreviousTableMateData: () => ipcRenderer.invoke("tablemate:load-previous-data")
});
ipcRenderer.on("tablemate:auto-saved", (_event, filePath) => {
  window.dispatchEvent(new CustomEvent("tablemate-auto-saved", { detail: filePath }));
});
