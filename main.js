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
        function loginSuccess() {
            logined = true;
            win.close();
            console.log(shan.nickname);
            app.quit();
        }
        function handleLogin(event, arg) {
            let trialId = arg.trialId;
            switch (arg.loginMethod) {
                case 'cookie':
                    shan.cookie = arg.cookie;
                    shan.testLogin().then(loginSuccess).catch((err) => {
                        win.webContents.send('requireLogin', {method: 'cookie', errmsg: err, trialId: trialId});
                    });
                    break;
                default:
                    win.webContents.send('requireLogin', {method: arg.loginMethod, errmsg: "Unknow method " + arg.loginMethod, trialId: trialId});
            }
        }
        let logined = false;
        win.on('close', function () {
            win = null;
            ipc.removeListener('login', handleLogin);
            if (!logined) {
                app.quit();
            }
        });
        win.setMenu(null);
        win.loadURL(modalPath);
        win.openDevTools();
        win.on('ready-to-show', function () {
            win.show();
            win.webContents.send('view', 'login');
            win.webContents.send('requireLogin', {method: null, errmsg: null, trialId: null});
            ipc.on('login', handleLogin);
        });
    }
    function startBdc () {
    }
    shan = new shanbay();
    // TODO: initalize it with stored data.
    startLogin();
});
