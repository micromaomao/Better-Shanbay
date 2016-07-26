const electron = require('electron');
const _request = require('request');
const request = ((o, c) => {
    console.log(o.method.toUpperCase() + " " + (o.baseUrl || "") + o.url);
    _request(o, (err, icm, res) => {
        if (err) {
            console.log("   ... Failed: " + err);
        }
        c(err, icm, res);
    });
});
const nativeImage = electron.nativeImage;
const cheerio = require('cheerio')

class ReviewWord {
    constructor(json) {
        this._json = json;
        if (!this._json.en_definitions) {
            this._json.en_definitions = {en: this._json.pron};
        }
        if (!this._json.en_definitions) {
            let defs = {};
            let defn = this._json.en_definition;
            defs[defn.pos || "?"] = defn.defn;
            this._json.en_definitions = defs;
        }
        this._audioCache = {};
        this._audioCacheWait = {};
        this._exampleCache = {};
        this._exampleCacheWait = {};
    }
    get def() {
        return this._json.en_definitions;
    }
    get pron() {
        return this._json.pronunciations;
    }
    get word() {
        return this._json.content;
    }
    get wordId() {
        return this._json.content_id;
    }
    get audioList() {
        if (!this._json.has_audio) return [];
        if (!this._json.audio_addresses) return [];
        return Object.keys(this._json.audio_addresses);
    }
    get reviewStatus() {
        return [
            "fresh",
            "passed",
            "reviewed",
            "yellow"
        ][this._json.review_status];
    }
    get reviewId() {
        return this._json.id;
    }
    get cnDef() {
        return this._json.cn_definition.defn;
    }
    getAudio(name) {
        return new Promise(((resolve, reject) => {
            if (!this._json.has_audio) {
                reject("No audio");
                return;
            }
            if (!this._json.audio_addresses || !this._json.audio_addresses[name]) {
                reject("No " + name + " audio.");
                return;
            }
            if (this._audioCache[name]) {
                resolve(this._audioCache[name]);
                return;
            }
            if (Array.isArray(this._audioCacheWait[name])) {
                this._audioCacheWait[name].push((err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
                return;
            }
            this._audioCacheWait[name] = [];
            let addrs = this._json.audio_addresses[name];
            let tryAddr = (function (i, prevErr) {
                let ars = this._audioCacheWait[name];
                let addr = addrs[i];
                if (!addr) {
                    reject(prevErr);
                    ars.forEach(f => f(prevErr, null));
                    this._audioCacheWait[name] = null;
                    return;
                }
                request({
                    url: addr,
                    method: 'get',
                    headers: Object.assign({}, this._headers, {'Accept': 'audio/*'}),
                    encoding: null
                }, ((err, icm, res) => {
                    if (err) {
                        tryAddr(i + 1, err);
                    } else if (Math.floor(icm.statusCode / 100) != 2) {
                        tryAddr(i + 1, res.toString('utf-8') || icm.statusCode);
                    } else {
                        let type = icm.headers["content-type"];
                        let ret = {buff: res, type: type};
                        this._audioCache[name] = ret;
                        resolve(ret);
                        ars.forEach(f => f(null, ret));
                    }
                }).bind(this));
            }).bind(this);
            tryAddr(0, null);
        }).bind(this));
    }
    getNotes(types, shan) {
        return new Promise(((resolve, reject) => {
            let ownids = [];
            let types = type.split('|');
            let findShared = false;
            types.forEach((x => {
                switch (x) {
                    case 'own':
                        ownids = this._json.learning_note_ids;
                        break;
                    case 'shared':
                        findShared = true;
                        break;
                }
            }).bind(this));
            let fetchShared = (function () {
                return new Promise(((resolve, reject) => {
                    shan.api('get', 'bdc/note/', {vocabulary_id: this.wordId}, null).then((res) => {
                        if (res.status_code != 0) {
                            reject(res.msg);
                            return;
                        }
                        resolve(res.data.map(x => new WordNote(x)));
                    }).catch(reject);
                }).bind(this));
            }).bind(this);
            let fetchSys = (function (ids) {
                return new Promise(((resolve, reject) => {
                    shan.api('get', 'bdc/note/', {ids: ids}, null).then((res) => {
                        if (res.status_code != 0) {
                            reject(res.msg);
                            return;
                        }
                        resolve(res.data.map(x => new WordNote(x)));
                    }).catch(reject);
                }).bind(this));
            }).bind(this);
            let findActions = [];
            if (ownids.length > 0) {
                findActions.push(fetchSys(exids));
            }
            if (findShared) {
                findActions.push(fetchShared());
            }
            Promise.all(findActions).then(ss => {
                let s = [];
                ss.forEach(x => Array.prototype.push.apply(s, x));
                resolve(s);
            }).catch(reject);
        }).bind(this));
    }
    getExamples(_types, shan) {
        return new Promise(((resolve, reject) => {
            if (this._exampleCache[_types]) {
                resolve(this._exampleCache[_types]);
                return;
            }
            if (Array.isArray(this._exampleCacheWait[_types])) {
                this._exampleCacheWait[_types].push((err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
                return;
            }
            this._exampleCacheWait[_types] = [];
            let sysids = this._json.sys_example_ids;
            let ownids = this._json.learning_example_ids;
            let types = _types.split('|');
            let exids = [];
            let findShared = false;
            types.forEach(x => {
                switch (x) {
                    case 'shanbay':
                        Array.prototype.push.apply(exids, sysids);
                        break;
                    case 'own':
                        Array.prototype.push.apply(exids, ownids);
                        break;
                    case 'shared':
                        findShared = true;
                        break;
                }
            });
            let fetchShared = (function () {
                return new Promise(((resolve, reject) => {
                    shan.api('get', 'bdc/example/', {vocabulary_id: this.wordId}, null).then((res) => {
                        if (res.status_code != 0) {
                            reject(res.msg);
                            return;
                        }
                        resolve(res.data.map(x => new ExampleSentence(x, false)));
                    }).catch(reject);
                }).bind(this));
            }).bind(this);
            let fetchSys = (function (ids) {
                return new Promise(((resolve, reject) => {
                    shan.api('get', 'bdc/example/', {ids: ids.join(',')}, null).then((res) => {
                        if (res.status_code != 0) {
                            reject(res.msg);
                            return;
                        }
                        resolve(res.data.map(x => new ExampleSentence(x, true)));
                    }).catch(reject);
                }).bind(this));
            }).bind(this);
            let findActions = [];
            if (exids.length > 0) {
                findActions.push(fetchSys(exids));
            }
            if (findShared) {
                findActions.push(fetchShared());
            }
            Promise.all(findActions).then(ss => {
                let s = [];
                ss.forEach(x => Array.prototype.push.apply(s, x));
                this._exampleCache[_types] = s;
                resolve(s);
                this._exampleCacheWait[_types].forEach(f => f(null, s));
            }).catch(err => {
                reject(err);
                this._exampleCacheWait[_types].forEach(f => f(err, null));
                this._exampleCacheWait[_types] = null;
            });
        }).bind(this));
    }
}
class ExampleSentence {
    constructor(json, prefered) {
        this._json = json;
        this._perfered = prefered || false;
    }
    get sentenceParts() {
        return [this._json.first, this._json.mid, this._json.last];
    }
    get cn() {
        return this._json.translation;
    }
    get id() {
        return this._json.id;
    }
    get prefered() {
        return this._perfered;
    }
}
class WordNote {
    constructor(json) {
        this._json = json;
    }
}

class shanbay {
    constructor() {
        this.cookie = null;
        this._timeout = 8000;
        this._user = null;
        this._userid = -1;
        this._avatarUrl = null;
        this._apiBase = 'https://www.shanbay.com/api/v1/';
        this._nickname = null;
        this._avatarCached = null;
        this._avatarCacheWaits = null;
        this._headers = {
            'User-Agent': 'BetterShanbay/0',
            'Accept-Language': 'en',
            'Accept': 'application/json'
        };
    }
    assertUser() {
        if (this._userid == -1) {
            throw new Error("call testLogin first.");
        }
    }
    get username() {
        this.assertUser();
        return this._user;
    }
    get nickname() {
        this.assertUser();
        return this._nickname;
    }
    get uid() {
        this.assertUser();
        return this._userid;
    }
    getAvatar() {
        return new Promise(((resolve, reject) => {
            this.assertUser();
            if (this._avatarUrl == null) throw new Error("Illegal state.");
            let callbacks = [resolve, reject];
            if (this._avatarCached) {
                resolve(this._avatarCached);
            } else if (this._avatarCacheWaits != null) {
                this._avatarCacheWaits.push(callbacks);
            } else {
                this._avatarCacheWaits = [callbacks];
                resolve = (img => {
                    this._avatarCached = img;
                    this._avatarCacheWaits.forEach(x => x[0](img));
                    this._avatarCacheWaits = null;
                });
                reject = (err => {
                    this._avatarCacheWaits.forEach(x => x[1](err));
                    this._avatarCacheWaits = null;
                });
                request({
                    url: this._avatarUrl,
                    method: 'get',
                    headers: Object.assign({}, this._headers, {'Accept': 'image/*'}),
                    encoding: null
                }, ((err, icm, res) => {
                    if (err) {
                        reject(err);
                    } else if (Math.floor(icm.statusCode / 100) != 2) {
                        reject(res.toString('utf-8') || icm.statusCode);
                    } else {
                        resolve(nativeImage.createFromBuffer(res));
                    }
                }).bind(this));
            }
        }).bind(this));
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
                timeout: this._timeout,
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
                    if (!res) {
                        reject(icm.statusCode);
                    } else {
                        reject((typeof res == "object" ? JSON.stringify(res) : res.toString()));
                    }
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
            this.api('get', 'user/', {}, null).then(((res) => {
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
    todayStats() {
        return new Promise(((resolve, reject) => {
            this.api('get', 'bdc/stats/today/', {}, null).then(((res) => {
                if (res["status_code"] != 0) {
                    reject(res.msg);
                } else {
                    resolve(res.data);
                }
            }).bind(this)).catch(reject);
        }).bind(this));
    }
    fetchReview(amount) {
        return new Promise(((resolve, reject) => {
            if (!(amount > 0)) {
                reject(new Error("Invalid amount"));
                return;
            }
            this.api('get', 'bdc/review/', {len: amount}, null).then(((res) => {
                if (res.status_code != 0) {
                    reject(res.msg);
                    return;
                }
                let words = [];
                resolve(res.data.reviews.map(reviewData => new ReviewWord(reviewData)));
            }).bind(this)).catch(reject);
        }).bind(this));
    }
    submitReview(resultMap) {
        return new Promise(((resolve, reject) => {
            let ids = [];
            let results = [];
            let seconds = [];
            Object.keys(resultMap).forEach(k => {
                let v = resultMap[k];
                let rid = parseInt(k);
                let vi;
                if (rid >= 0) {
                    switch (v) {
                        case 'forget':
                            vi = 0;
                            break;
                        case 'pass':
                            vi = 1;
                            break;
                        case 'master':
                            vi = 2;
                            break;
                        default:
                            throw new Error("Illegal result.");
                    }
                    ids.push(rid);
                    results.push(vi);
                    seconds.push(1);
                }
            });
            let subm = {ids: ids.join(','), results: results.join(','), seconds: seconds.join(',')};
            this.api('put', 'bdc/review/', {}, subm).then(res => {
                let su = subm;
                if (res.status_code != 0) {
                    reject(res.msg);
                    return;
                }
                resolve();
            }).catch(reject);
        }).bind(this));
    }
}

const pirateAPIHeaders = {
    "accept-language": "en",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64)"
};
shanbay.wordsapi = (() => {
    let currentWhen = null;
    let currentEncrypted = null;

    function fetchApiKey() {
        return new Promise((resolve, reject) => {
            request({
                url: "https://www.wordsapi.com/",
                headers: Object.assign({}, pirateAPIHeaders, {
                    "accept": "text/html,*/*"
                }),
                method: 'get',
                timeout: 5000
            }, (err, icm, res) => {
                if (err) {
                    reject(err);
                } else if (Math.floor(icm.statusCode / 100) != 2) {
                    reject(new Error("Can't access Wordsapi.com: " + icm.statusCode));
                } else {
                    let whenMatch = res.match(/when = "(.+)"/);
                    let encryptMatch = res.match(/encrypted = "(.+)"/);
                    if (!whenMatch || !encryptMatch) {
                        reject(new Error("Wordsapi.com API changed."));
                        return;
                    }
                    currentWhen = whenMatch[1];
                    currentEncrypted = encryptMatch[1];
                    setTimeout(resolve, 100);
                }
            });
        });
    }
    function fetchWord(review) {
        return new Promise((resolve, reject) => {
            let word = review.word;
            if (review._wordsapiCache) {
                resolve(review._wordsapiCache);
                return;
            }
            if (Array.isArray(review._wordsapiCacheWait)) {
                review._wordsapiCacheWait.push((err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
                return;
            }
            review._wordsapiCacheWait = [];
            let _reject = reject;
            reject = (err => {
                _reject(err);
                review._wordsapiCacheWait.forEach(f => f(err, null));
                review._wordsapiCacheWait = null;
            });
            let _resolve = resolve;
            resolve = (res => {
                _resolve(res);
                review._wordsapiCache = res;
            });
            if (!currentWhen || !currentEncrypted) {
                fetchApiKey().then(fetch).catch(reject);
            } else {
                fetch();
            }
            function fetch() {
                request({
                    url: "https://www.wordsapi.com/words/" + encodeURIComponent(word),
                    headers: Object.assign({}, pirateAPIHeaders, {
                        "accept": "application/json",
                        "referer": "https://www.wordsapi.com/"
                    }),
                    method: 'get',
                    qs: {
                        when: currentWhen,
                        encrypted: currentEncrypted
                    },
                    timeout: 5000,
                    json: true
                }, (err, icm, res) => {
                    if (err) {
                        reject(err);
                    } else if (icm.statusCode == 404) {
                        reject(null);
                    } else if (Math.floor(icm.statusCode / 100) != 2 && icm.statusCode != 400) {
                        reject(new Error("Can't access Wordsapi.com: " + icm.statusCode));
                    } else {
                        if (res.status == "error") {
                            if (res.message.match(/expired/)) {
                                fetchApiKey().then(fetch).catch(reject);
                            } else {
                                reject(res.message);
                            }
                        } else {
                            resolve(res);
                        }
                    }
                });
            }
        });
    }
    return fetchWord;
})();

shanbay.thesaurus = (word => {
    return new Promise((resolve, reject) => {
        if (!word.match(/^[a-zA-Z\- ]{1,}$/)) {
            resolve([]);
            return;
        }
        request({
            url: "http://www.thesaurus.com/browse/" + encodeURIComponent(word),
            headers: Object.assign({}, pirateAPIHeaders, {
                "accept": "text/html,*/*"
            }),
            method: 'get',
            timeout: 5000
        }, (err, icm, res) => {
            if (err) {
                reject(err);
            } else if (icm.statusCode == 403) {
                setTimeout(() => shanbay.thesaurus(word).then(resolve, reject), 1000);
            } else if (icm.statusCode == 404) {
                resolve([]);
            } else if (Math.floor(icm.statusCode / 100) != 2) {
                reject(new Error("Can't access Thesaurus.com: " + icm.statusCode));
            } else {
                let matches = res.match(/<span class="text">[a-zA-Z\- ]{1,}/g);
                if (!matches) {
                    resolve([]);
                } else {
                    resolve(matches.map(x => x.substr('<span class="text">'.length)));
                }
            }
        });
    });
});
shanbay.collins = (word => {
    return new Promise((resolve, reject) => {
        request({
            url: "https://www.collinsdictionary.com/dictionary/english/" + encodeURIComponent(word),
            headers: Object.assign({}, pirateAPIHeaders, {
                "accept": "text/html,*/*"
            }),
            method: 'get',
            timeout: 5000
        }, (err, icm, res) => {
            if (err) {
                reject(err);
            } else if (icm.statusCode == 404) {
                resolve([]);
            } else if (Math.floor(icm.statusCode / 100) != 2) {
                reject(new Error("Can't access Collinsdictionary.com: " + icm.statusCode));
            } else {
                try {
                    let $ = cheerio.load(res);
                    let $defs = $('.cobuild .def');
                    let defs = [];
                    for (let i = 0; i < $defs.length; i ++) {
                        defs.push($defs.eq(i).text());
                    }
                    resolve(defs);
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
});

module.exports = shanbay;
