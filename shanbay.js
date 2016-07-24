const electron = require('electron');
const request = require('request');

class shanbay {
    constructor() {
        this.cookie = null;
        this._user = null;
        this._userid = -1;
        this._avatarUrl = null;
        this._apiBase = 'https://www.shanbay.com/api/v1/';
        this._nickname = null;
        this._headers = {
            'User-Agent': 'BetterShanbay/0',
            'Accept-Language': 'en',
            'Accept': 'application/json'
        };
    }
    get username() {
        return this._user;
    }
    get nickname() {
        return this._nickname;
    }
    api(method, path, qs, body) {
        if (typeof qs != "object") {
            throw new Error("qs must be an object");
        }
        let promise = new Promise(((resolve, reject) => {
            let reqOp = {
                baseUrl: this._apiBase,
                url: path,
                method: method,
                headers: Object.assign({}, this._headers, {Cookie: this.cookie})
            };
            Object.assign(reqOp, {qs: qs});
            if (body) {
                Object.assign(reqOp, {body: body});
                if (typeof body == 'object') {
                    Object.assign(reqOp, {json: true});
                }
            }
            request(reqOp, (err, icm, res) => {
                if (err) {
                    reject(err.toString());
                } else if (Math.floor(icm.statusCode / 100) != 2) {
                    reject(res || icm.statusCode);
                } else {
                    try {
                        if (typeof res == 'string') {
                            res = JSON.parse(res);
                        }
                    } catch (e) {
                        reject('JSON response invalid.');
                        return;
                    }
                    resolve(res);
                }
            });
        }).bind(this));
        return promise;
    }
    testLogin() {
        return new Promise(((resolve, reject) => {
            this.api('get', 'user', {}, null).then(((res) => {
                if (!res.userid) {
                    reject('Not logged-in.');
                    return;
                }
                this._user = res.username;
                this._userid = res.userid;
                this._avatarUrl = res.avatar;
                this._nickname = res.nickname;
                resolve();
            }).bind(this)).catch(reject);
        }).bind(this));
    }
}

module.exports = shanbay;
