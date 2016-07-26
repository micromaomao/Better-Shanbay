// TODO: determine what to send to PUT /review.
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
const reviewStackLength = 6; // TODO: changeable;

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
        function loginSuccess() {
            logined = true;
            win.close();
            startBdc();
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
            saveLogin(null).catch((e) => {
                console.error(e);
                console.error("Can't remove stored login...");
            });
        }
        let logined = false;
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
        let win = new electron.BrowserWindow(Object.assign({}, winOpts, {
            resizable: true,
            maximizable: true,
            fullscreenable: true,
            title: "Shanbay Words",
            width: 1024,
            height: 768,
            minWidth: 750,
            minHeight: 550,
            show: false
        }));
        win.on('close', function () {
            win = null;
            app.quit();
        });
        win.setMenu(null);
        win.loadURL(modalPath);
        win.on('ready-to-show', function () {
            win.show();
            win.webContents.send('view', 'main');
            ipc.on('user', (evt, arg) => {
                let ipcResponse = {nickname: shan.nickname, username: shan.username, id: shan.uid};
                shan.getAvatar().then(img => {
                    ipcResponse.avatar = img.toDataURL();
                    win.webContents.send('user', ipcResponse);
                }).catch(err => {
                    ipcResponse.avatar = null;
                    win.webContents.send('user', ipcResponse);
                });
            });
            let tellingStats = false;
            function tellStats() {
                if (tellingStats) return;
                tellingStats = true;
                shan.todayStats().then(stat => {
                    win.webContents.send('todayStats', stat);
                    tellingStats = false;
                }).catch(err => {
                    win.webContents.send('todayStats', {err: err});
                    tellingStats = false;
                    setTimeout(tellStats, 1000);
                });
            }
            ipc.on('todayStats', (evt, arg) => {
                tellStats();
            });
            ipc.on('avatar', (evt, arg) => {
                shan.getAvatar().then(img => {
                    win.webContents.send('avatar', {avatar: img.toDataURL()});
                }).catch(err => win.webContents.send('avatar', {err: err}));
            });
            class SubmitQueue {
                constructor() {
                    this._queue = {};
                    this._processing = null;
                    this._error = null;
                    this._waiters = [];
                }
                push(results) {
                    Object.assign(this._queue, results);
                    if (this._processing === null) {
                        this._submit();
                    }
                    this._statsChange();
                }
                wait(waiter) {
                    this._waiters.push(waiter);
                    this._statsChange();
                }
                _submit() {
                    if (this._processing !== null) {
                        return;
                    }
                    this._processing = this._queue;
                    this._queue = {};
                    if (Object.keys(this._processing).length == 0) {
                        this._processing = null;
                        return;
                    }
                    shan.submitReview(this._processing).then((() => {
                        this._processing = null;
                        if (Object.keys(this._queue).length > 0) {
                            this._submit();
                        }
                        this._statsChange();
                    }).bind(this)).catch((err => {
                        this._queue = Object.assign({}, this._processing, this._queue);
                        this._error = err;
                        this._processing = null;
                        this._statsChange();
                        setTimeout(this._submit.bind(this), 1000);
                    }).bind(this));
                    this._statsChange();
                }
                get length() {
                    return Object.keys(this._queue).length + Object.keys(this._processing || {}).length;
                }
                _statsChange() {
                    if (this._processing === null && Object.keys(this._queue).length == 0) {
                        this._waiters.forEach(x => x());
                        this._error = null;
                        this._waiters = [];
                        tellStats();
                    }
                    win.webContents.send('submitQueue', {length: this.length, prevErr: this._error ? this._error.toString() : null});
                }
            }
            let queue = new SubmitQueue();
            function processReview(review) {
                return new Promise((resolve, reject) => {
                    let toRender = {
                        wordId: review.wordId,
                        word: review.word,
                        def: review.def,
                        pron: review.pron,
                        submitId: review.reviewId,
                        cndef: review.cnDef,
                        reviewStatus: review.reviewStatus,
                        audios: {}
                    };
                    let quest = [];
                    let audioList = review.audioList;
                    if (audioList.length > 0) {
                        audioList.forEach(audioName => {
                            quest.push(new Promise((resolve, reject) => {
                                review.getAudio(audioName).then(audio => {
                                    toRender.audios[audioName] = "data:" + audio.type + ";base64," + audio.buff.toString("base64")
                                    resolve();
                                }).catch(reject);
                            }));
                        })
                    }
                    quest.push(new Promise((resolve, reject) => {
                        shanbay.wordsapi(review).then(wordsapi => {
                            toRender.wordsapi = wordsapi;
                            resolve();
                        }).catch(err => {
                            if (err === null) {
                                toRender.wordsapi = null;
                                resolve();
                            } else {
                                reject(err);
                            }
                        });
                    }));
                    quest.push(new Promise((resolve, reject) => {
                        shanbay.thesaurus(review.word).then(syns => {
                            toRender.therSyns = syns;
                            resolve();
                        }).catch(reject);
                    }));
                    quest.push(new Promise((resolve, reject) => {
                        shanbay.collins(review.word).then(defs => {
                            toRender.collinsDefs = defs;
                            resolve();
                        }).catch(reject);
                    }));
                    quest.push(new Promise((resolve, reject) => {
                        review.getExamples('own|shanbay|shared', shan).then(sentences => {
                            toRender.examples = sentences.map(s => {
                                return {
                                    id: s.id,
                                    parts: s.sentenceParts,
                                    cn: s.cn,
                                    prefered: s.prefered
                                };
                            });
                            resolve();
                        }).catch(err => {
                            console.error(err);
                            reject(err);
                        });
                    }));
                    Promise.all(quest).then(() => {
                        resolve(toRender);
                    }).catch(e => {
                        reject(e);
                    });
                });
            }
            class CachedReviewStack {
                constructor() {
                    this._rawReviewStack = [];
                    this._stack = [];
                    this._waiting = [];
                    this._err = null;
                    this._fetching = false;
                    this._ended = false;
                    this._fetchingRaw = false;
                    this._runCache();
                }
                pop() {
                    this._stateChange();
                    return new Promise(((resolve, reject) => {
                        this._waiting.push((err, res) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(res);
                            }
                        });
                        this._stateChange();
                    }).bind(this));
                }
                pushRawReview(rev) {
                    Array.prototype.push.apply(this._rawReviewStack, revs);
                    this._stateChange();
                }
                get hasRawReview() {
                    return this._rawReviewStack.length > 0;
                }
                fetchRawReview() {
                    if (this._fetchingRaw) return;
                    this._fetchingRaw = true;
                    queue.wait((function () {
                        shan.fetchReview(reviewStackLength).then((reviews => {
                            this._fetchingRaw = false;
                            if (reviews.length == 0) {
                                this._ended = true;
                            }
                            this._rawReviewStack = reviews;
                            this._stateChange();
                        }).bind(this)).catch((err => {
                            this._fetchingRaw = false;
                            this._err = err;
                            this._stateChange();
                        }).bind(this));
                    }).bind(this));
                }
                _runCache() {
                    if (this._fetching) return;
                    this._fetching = true;
                    this._stateChange();
                    if (this._rawReviewStack.length == 0) {
                        this._fetching = false;
                        return;
                    }
                    processReview(this._rawReviewStack[0]).then((arg => {
                        this._stack.push(arg);
                        this._rawReviewStack.splice(0, 1);
                        this._stateChange();
                        this._fetching = false;
                        this._runCache();
                    }).bind(this)).catch((err => {
                        this._err = err;
                        this._stateChange();
                        this._fetching = false;
                    }).bind(this));
                }
                get end() {
                    return this._ended;
                }
                _stateChange() {
                    if (this._stack.length > 0 && this._waiting.length > 0) {
                        this._waiting.forEach(x => x(null, this._stack[0]));
                        this._stack.splice(0, 1);
                        this._waiting = [];
                        this._runCache();
                    } else if (this._stack.length == 0 && this._err && this._waiting.length > 0) {
                        this._waiting.forEach(x => x(this._err, null));
                        this._waiting = [];
                        this._err = null;
                        setTimeout(this._runCache.bind(this), 1000);
                    }
                    if (!this._ended && this._waiting.length > 0 && !this.hasRawReview) {
                        this.fetchRawReview();
                    }
                    if (this._ended) {
                        this._waiting.forEach(x => x(null, null));
                        this._waiting = [];
                    }
                    if (this._rawReviewStack.length > 0) {
                        this._runCache();
                    }
                }
            }
            let cachedReviewStack = new CachedReviewStack();
            ipc.on('review', (evt, arg) => {
                if (arg.prevResults) {
                    queue.push(arg.prevResults);
                }
                cachedReviewStack.pop().then(review => win.webContents.send('review', review))
                    .catch(err => {
                        win.webContents.send('review', {err: err.toString()});
                    });
            });
        });
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
    startLogin();
});
app.on('window-all-closed', function (evt) {
    evt.preventDefault();
});
