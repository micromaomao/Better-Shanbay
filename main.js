const electron = require('electron');
const path = require('path');
const shanbay = require('./shanbay');
const ipc = electron.ipcMain;

const app = electron.app;

const winOpts = {
    center: true,
    titleBarStyle: "hidden",
    title: "Better Shanbay",
};
const modalPath = path.join('file://', __dirname, 'view', 'window.html');

let shan;

function startLogin () {
    let win = new electron.BrowserWindow(Object.assign({}, winOpts, {
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: "Login Shanbay",
        width: 500,
        height: 350,
        useContentSize: true
    }));
    let logined = false;
    win.on('close', function () {
        win = null;
        if (!logined) {
            app.quit();
        }
    });
    win.setMenu(null);
    win.shanbay_context = "login";
    win.loadURL(modalPath);
    win.show();
    win.openDevTools();
}
function startBdc () {
}

app.on('ready', function () {
    shan = new shanbay();
    // TODO: initalize it with stored data.
    startLogin();
});
