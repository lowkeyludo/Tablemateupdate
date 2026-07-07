const { app, BrowserWindow, session, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function safeName(value) {
  return String(value || "file").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 180);
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }
function tableMateRoot() { return ensureDir(path.join(app.getPath("documents"), "TableMate")); }

function createAllTableMateFolders() {
  [
    path.join(tableMateRoot(), "Selfies"),
    path.join(tableMateRoot(), "Reports", "Date Booking Sheets"),
    path.join(tableMateRoot(), "Reports", "Kitchen Eisbein Lists"),
    path.join(tableMateRoot(), "Reports", "Day End Reports"),
    path.join(tableMateRoot(), "Reports", "CSV Exports"),
    path.join(tableMateRoot(), "Reports", "PDF Reports"),
    path.join(tableMateRoot(), "Downloads"),
    path.join(tableMateRoot(), "Backups")
  ].forEach(ensureDir);
}

function folderForFilename(filename) {
  const lower = String(filename || "").toLowerCase();
  if (lower.includes("selfie")) return path.join(tableMateRoot(), "Selfies");
  if (lower.includes("eisbein")) return path.join(tableMateRoot(), "Reports", "Kitchen Eisbein Lists");
  if (lower.includes("day_end") || lower.includes("day-end") || lower.includes("dayend") || lower.includes("day end") || lower.includes("day-end-report")) return path.join(tableMateRoot(), "Reports", "Day End Reports");
  if (lower.includes("booking_sheet") || lower.includes("booking-sheet") || lower.includes("date_booking") || lower.includes("bookings")) return path.join(tableMateRoot(), "Reports", "Date Booking Sheets");
  if (lower.endsWith(".csv")) return path.join(tableMateRoot(), "Reports", "CSV Exports");
  if (lower.endsWith(".pdf")) return path.join(tableMateRoot(), "Reports", "PDF Reports");
  return path.join(tableMateRoot(), "Downloads");
}

function uniquePath(dir, filename) {
  ensureDir(dir);
  const parsed = path.parse(safeName(filename || "TableMate_File"));
  const base = parsed.name || "TableMate_File";
  const ext = parsed.ext || "";
  let candidate = path.join(dir, `${base}${ext}`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}


function backupDir() {
  return ensureDir(path.join(tableMateRoot(), "Backups"));
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(text);
    if (data && Array.isArray(data.bookings)) {
      return {
        filePath,
        data,
        count: data.bookings.length,
        mtime: fs.statSync(filePath).mtimeMs
      };
    }
  } catch (_err) {}
  return null;
}

function listJsonFilesRecursive(dir, depth = 0) {
  if (depth > 4 || !fs.existsSync(dir)) return [];
  let files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(listJsonFilesRecursive(full, depth + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files.push(full);
      }
    }
  } catch (_err) {}
  return files;
}

function findPreviousTableMateData() {
  createAllTableMateFolders();

  const candidates = [
    path.join(backupDir(), "tablemate-auto-backup.json"),
    path.join(tableMateRoot(), "tablemate-auto-backup.json"),
    path.join(tableMateRoot(), "tablemate-bookings-data.json"),
    path.join(tableMateRoot(), "Downloads", "tablemate-bookings-data.json")
  ];

  const recursive = listJsonFilesRecursive(tableMateRoot())
    .filter(file => file.toLowerCase().includes("tablemate"));

  const parsed = [...candidates, ...recursive]
    .filter((file, index, arr) => file && arr.indexOf(file) === index)
    .map(readJsonSafe)
    .filter(Boolean)
    .filter(item => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.mtime - a.mtime;
    });

  return parsed[0] || null;
}

function setupTrueAutoSave() {
  session.defaultSession.on("will-download", (_event, item) => {
    const filename = safeName(item.getFilename() || "TableMate_File");
    const savePath = uniquePath(folderForFilename(filename), filename);
    item.setSavePath(savePath);
    item.once("done", (_doneEvent, state) => {
      if (state === "completed" && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("tablemate:auto-saved", savePath);
      }
    });
  });
}

function createWindow() {
  createAllTableMateFolders();
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: "#f2eee5",
    fullscreenable: true,
    autoHideMenuBar: true,
    title: "TableMate Bookings",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "app", "index.html"));
  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: { width: 1100, height: 800, autoHideMenuBar: true }
  }));
  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("tablemate:open-folder", async () => {
  createAllTableMateFolders();
  const root = tableMateRoot();
  await shell.openPath(root);
  return { ok: true, folder: root };
});


ipcMain.handle("tablemate:save-backup-data", async (_event, jsonText) => {
  createAllTableMateFolders();
  const filePath = path.join(backupDir(), "tablemate-auto-backup.json");
  fs.writeFileSync(filePath, String(jsonText || "{}"), "utf8");
  return { ok: true, filePath };
});

ipcMain.handle("tablemate:load-previous-data", async () => {
  const found = findPreviousTableMateData();
  if (!found) return { ok: false, reason: "No previous TableMate backup/export file found." };
  return {
    ok: true,
    source: found.filePath,
    count: found.count,
    data: found.data
  };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "media" || permission === "camera") return callback(true);
    callback(false);
  });
  setupTrueAutoSave();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
