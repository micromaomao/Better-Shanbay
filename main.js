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

app.on('ready', function () {
    let shan;

    function startLogin () {
        let win = new electron.BrowserWindow(Object.assign({}, winOpts, {
            resizable: false,
            maximizable: false,
            fullscreenable: false,
            title: "Login Shanbay",
            width: 500,
            height: 350,
            useContentSize: true,
            show: false
        }));
        let logined = false;
        win.on('close', function () {
            win = null;
            if (!logined) {
                app.quit();
            }
        });
        win.setMenu(null);
        win.loadURL(modalPath);
        win.on('ready-to-show', function () {
            win.show();
            win.webContents.send('view', 'login');
            shan.testLogin(function (success) {
                if (success) {
                    logined = true;
                    win.close();
                } else {
                    win.webContents.send('requireLogin', {errmsg: null});
                }
            });
        });
    }
    function startBdc () {
    }
    shan = new shanbay();
    // TODO: initalize it with stored data.
    startLogin();
});
