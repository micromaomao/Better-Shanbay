const electron = require('electron');

class shanbay {
    constructor() {
        this.cookie = null;
        this._user = null;
    }
    testLogin(callback) {
        setTimeout(() => callback(false), 2000);
    }
}

module.exports = shanbay;
