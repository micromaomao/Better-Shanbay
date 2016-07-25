const electron = require('electron');
const path = require('path');
const shanbay = require('./shanbay');
const ipc = electron.ipcMain;
const fs = require('fs');

const app = electron.app;

const winOpts = {
    center: true,
    titleBarStyle: "hidden",
    title: "Better Shanbay",
};
const modalPath = path.join('file://', __dirname, 'view', 'window.html');

app.on('ready', function () {
    let shan;
    const storedLoginFile = path.join(app.getPath('userData'), "shanbay.cookie");
    console.log("Cookie in " + storedLoginFile);

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
        }
        function saveLogin(cookie) {
            return new Promise((resolve, reject) => {
                if (cookie != null) {
                    fs.writeFile(storedLoginFile, cookie, {encoding: "utf-8", mode: 0o600}, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    fs.unlink(storedLoginFile, (err) => {
                        if (err) {
                            fs.access(storedLoginFile, fs.F_OK, (err2) => {
                                if (err2) {
                                    // Ignore, file not exist.
                                    resolve();
                                } else {
                                    reject();
                                }
                            });
                        } else {
                            resolve();
                        }
                    });
                }
            });
        }
        function handleLogin(event, arg) {
            let trialId = arg.trialId;
            switch (arg.loginMethod) {
                case 'cookie':
                    shan.cookie = arg.cookie;
                    shan.testLogin().then(() => {
                        saveLogin(arg.save ? arg.cookie : null).then(loginSuccess).catch((e) => {
                            console.error(e);
                            console.error("Can't save login...");
                        });
                    }).catch((err) => {
                        win.webContents.send('requireLogin', {method: 'cookie', errmsg: err.toString(), trialId: trialId});
                    });
                    break;
                default:
                    win.webContents.send('requireLogin', {method: arg.loginMethod, errmsg: "Unknow method " + arg.loginMethod, trialId: trialId});
            }
        }
        function handleRmStored(event, arg) {
            debugger;
            saveLogin(null).catch((e) => {
                console.error(e);
                console.error("Can't remove stored login...");
            });
        }
        let logined = false;
        win.on('close', function () {
            win = null;
            ipc.removeListener('login', handleLogin);
            ipc.removeListener('rmStoredLogin', handleRmStored);
            if (!logined) {
                app.quit();
            }
        });
        win.setMenu(null);
        win.loadURL(modalPath);
        win.on('ready-to-show', function () {
            win.show();
            win.webContents.send('view', 'login');
            initStored().then((cookie) => {
                if (!cookie) {
                    win.webContents.send('requireLogin', {method: null, errmsg: null, trialId: null});
                } else {
                    shan.cookie = cookie;
                    shan.testLogin().then(loginSuccess).catch((err) => {
                        win.webContents.send('requireLogin', {method: null, errmsg: "Stored login no longer works: " + err, trialId: null});
                    });
                }
            }).catch((err) => {
                win.webContents.send('requireLogin', {method: null, errmsg: "Can't read stored login: " + err, trialId: null});
            });
            ipc.on('login', handleLogin);
            ipc.on('rmStoredLogin', handleRmStored);
        });
    }
    function startBdc () {
    }
    shan = new shanbay();
    function initStored() {
        return new Promise((resolve, reject) => {
            fs.readFile(storedLoginFile, {encoding: 'utf-8'}, (err, data) => {
                if (err) {
                    fs.access(storedLoginFile, fs.F_OK, (err2) => {
                        if (err2) {
                            // File not exist, maybe first run.
                            resolve(null);
                        } else {
                            // File exist but not readable.
                            reject(err);
                        }
                    });
                } else {
                    resolve(data);
                }
            });
        });
    }
    // TODO: initalize it with stored data.
    startLogin();
});
