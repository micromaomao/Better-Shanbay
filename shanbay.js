const electron = require('electron');

class shanbay {
    constructor() {
        this._ready = false;
        this._cookie = null;
        this._user = null;
    }
    get userReady() {
        return this._ready;
    }
}

module.exports = shanbay;
