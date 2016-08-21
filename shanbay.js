const electron = require('electron')
const _request = require('request')
const request = (o, c) => {
  // Log all request to console.
  console.log(o.method.toUpperCase() + ' ' + (o.baseUrl || '') + o.url)
  _request(o, (err, icm, res) => {
    if (err) {
      console.log('   ... Failed: ' + err)
    }
    c(err, icm, res)
  })
}
const nativeImage = electron.nativeImage
const cheerio = require('cheerio')

class Cacher {
  // A stuff that cache all your stuff
  constructor () {
    this._caches = {}
    this._cacheWaits = {}
  }
  fetch (content, fetchPromise) {
    return new Promise((resolve, reject) => {
      if (typeof this._caches[content] !== 'undefined') {
        resolve(this._caches[content])
      } else if (Array.isArray(this._cacheWaits[content])) {
        this._cacheWaits[content].push([resolve, reject])
      } else {
        this._cacheWaits[content] = []
        fetchPromise(res => {
          this._caches[content] = res
          resolve(res)
          this._cacheWaits[content].forEach(a => a[0](res))
          delete this._cacheWaits[content]
        }, err => {
          reject(err)
          this._cacheWaits[content].forEach(a => a[1](err))
          delete this._cacheWaits[content]
        })
      }
    })
  }
}

class ReviewWord {
  // This class prase the json and send request to look up information from Shanbay. The result is cached in the object.
  constructor (json) {
    this.reParseJSON(json)
    this._cacher = new Cacher()
  }
  reParseJSON (json) {
    // Update word info without destorying cache.
    this._json = json
    if (!this._json.pronunciations) {
      this._json.pronunciations = {en: this._json.pron}
    }
    if (!this._json.en_definitions) {
      let defs = {}
      let defn = this._json.en_definition
      defs[defn.pos || '?'] = defn.defn
      this._json.en_definitions = defs
    }
    return this
  }
  get json () {
    return this._json
  }
  get def () {
    return this._json.en_definitions
  }
  get pron () {
    return this._json.pronunciations
  }
  get word () {
    return this._json.content
  }
  get wordId () {
    return this._json.content_id
  }
  get audioList () {
    if (!this._json.has_audio) return []
    if (!this._json.audio_addresses) return []
    return Object.keys(this._json.audio_addresses)
  }
  get reviewStatus () {
    return [
      'fresh',
      'passed',
      'reviewed',
      'failed'
    ][this._json.review_status]
  }
  get reviewId () {
    return this._json.id
  }
  get cnDef () {
    return this._json.cn_definition.defn
  }
  getAudio (name) {
    return this._cacher.fetch('audio:' + name, (resolve, reject) => {
      if (!this._json.has_audio) {
        reject('No audio')
        return
      }
      if (!this._json.audio_addresses || !this._json.audio_addresses[name]) {
        reject(`No audio named ${name}.`)
        return
      }
      let addrs = this._json.audio_addresses[name]
      // We will get a array of audio address. Try each one until we success.
      let tryAddr = (i, prevErr) => {
        let addr = addrs[i]
        if (!addr) {
          reject(prevErr)
          return
        }
        request({
          url: addr,
          method: 'get',
          headers: Object.assign({}, this._headers, {'Accept': 'audio/*'}),
          encoding: null
        }, (err, icm, res) => {
          if (err) {
            tryAddr(i + 1, err)
          } else if (Math.floor(icm.statusCode / 100) !== 2) {
            tryAddr(i + 1, res.toString('utf-8') || icm.statusCode)
          } else {
            let type = icm.headers['content-type']
            let ret = {buff: res, type: type}
            resolve(ret)
          }
        })
      }
      tryAddr(0, null)
    })
  }
  getNotes (_types, shan) {
    return this._cacher.fetch('notes:' + _types, (resolve, reject) => {
      let ownids = []
      let types = _types.split('|')
      let findShared = false
      types.forEach(x => {
        switch (x) {
          case 'own':
            ownids = this._json.learning_note_ids
            break
          case 'shared':
            findShared = true
            break
        }
      })
      let fetchShared = () => {
        return new Promise((resolve, reject) => {
          shan.api('get', 'bdc/note/', {vocabulary_id: this.wordId}, null).then((res) => {
            if (res.status_code !== 0) {
              reject(res.msg)
              return
            }
            resolve(res.data.map(x => new WordNote(x)))
          }).catch(reject)
        })
      }
      let fetchSys = ids => {
        return new Promise((resolve, reject) => {
          shan.api('get', 'bdc/note/', {ids: ids}, null).then((res) => {
            if (res.status_code !== 0) {
              reject(res.msg)
              return
            }
            resolve(res.data.map(x => new WordNote(x)))
          }).catch(reject)
        })
      }
      let findActions = []
      if (ownids.length > 0) {
        findActions.push(fetchSys(ownids))
      }
      if (findShared) {
        findActions.push(fetchShared())
      }
      Promise.all(findActions).then(ss => {
        let s = []
        ss.forEach(x => Array.prototype.push.apply(s, x))
        resolve(s)
      }).catch(reject)
    })
  }
  getExamples (_types, shan) {
    return this._cacher.fetch('examples:' + _types, (resolve, reject) => {
      let sysids = this._json.sys_example_ids
      let ownids = this._json.learning_example_ids
      let types = _types.split('|')
      let exids = []
      let findShared = false
      types.forEach(x => {
        switch (x) {
          case 'shanbay':
            Array.prototype.push.apply(exids, sysids)
            break
          case 'own':
            Array.prototype.push.apply(exids, ownids)
            break
          case 'shared':
            findShared = true
            break
        }
      })
      let fetchShared = () => {
        return new Promise((resolve, reject) => {
          shan.api('get', 'bdc/example/', {vocabulary_id: this.wordId}, null).then((res) => {
            if (res.status_code !== 0) {
              reject(res.msg)
              return
            }
            resolve(res.data.map(x => new ExampleSentence(x, false)))
          }).catch(reject)
        })
      }
      let fetchSys = ids => {
        return new Promise((resolve, reject) => {
          shan.api('get', 'bdc/example/', {ids: ids.join(',')}, null).then((res) => {
            if (res.status_code !== 0) {
              reject(res.msg)
              return
            }
            resolve(res.data.map(x => new ExampleSentence(x, true)))
          }).catch(reject)
        })
      }
      let findActions = []
      if (exids.length > 0) {
        findActions.push(fetchSys(exids))
      }
      if (findShared) {
        findActions.push(fetchShared())
      }
      Promise.all(findActions).then(ss => {
        let s = []
        ss.forEach(x => Array.prototype.push.apply(s, x))
        resolve(s)
      }).catch(err => {
        reject(err)
      })
    })
  }
  thesaurus () {
    return this._cacher.fetch('thesaurus', (resolve, reject) => {
      shanbay._thesaurus(this.word).then(syns => {
        resolve(syns)
      }).catch(err => {
        reject(err)
      })
    })
  }
  collins () {
    return this._cacher.fetch('collins', (resolve, reject) => {
      shanbay._collins(this.word).then(defs => {
        resolve(defs)
      }).catch(err => {
        reject(err)
      })
    })
  }
  wordsapi () {
    return this._cacher.fetch('wordsapi', (resolve, reject) => {
      shanbay._wordsapi(this.word).then(res => {
        resolve(res)
      }).catch(err => {
        reject(err)
      })
    })
  }
}
class ExampleSentence {
  // Prase the json.
  constructor (json, prefered) {
    this._json = json
    this._perfered = prefered || false
  }
  get sentenceParts () {
    return [this._json.first, this._json.mid, this._json.last]
  }
  get cn () {
    return this._json.translation
  }
  get id () {
    return this._json.id
  }
  get prefered () {
    return this._perfered
  }
}
class WordNote {
  // TODO
  constructor (json) {
    this._json = json
  }
}

class shanbay {
  // Send requests to Shanbay API.
  constructor () {
    this.cookie = null
    this._timeout = 8000
    this._user = null
    this._userid = -1
    this._avatarUrl = null
    this._apiBase = 'https://www.shanbay.com/api/v1/'
    this._nickname = null
    this._headers = {
      'User-Agent': 'BetterShanbay/0',
      'Accept-Language': 'en',
      'Accept': 'application/json'
    }
    this._cacher = new Cacher()
  }
  assertUser () {
    if (this._userid === -1) {
      throw new Error('call testLogin first.')
    }
  }
  get username () {
    this.assertUser()
    return this._user
  }
  get nickname () {
    this.assertUser()
    return this._nickname
  }
  get uid () {
    this.assertUser()
    return this._userid
  }
  getAvatar () {
    return this._cacher.fetch('avatar', (resolve, reject) => {
      this.assertUser()
      if (this._avatarUrl == null) reject('Illegal state.')
      request({
        url: this._avatarUrl,
        method: 'get',
        headers: Object.assign({}, this._headers, {'Accept': 'image/*'}),
        encoding: null
      }, (err, icm, res) => {
        if (err) {
          reject(err)
        } else if (Math.floor(icm.statusCode / 100) !== 2) {
          reject(res.toString('utf-8') || icm.statusCode)
        } else {
          resolve(nativeImage.createFromBuffer(res))
        }
      })
    })
  }
  api (method, path, qs, body) {
    // Call the shanbay API and handle HTTP errors.
    if (typeof qs !== 'object') {
      throw new Error('qs must be an object')
    }
    let promise = new Promise((resolve, reject) => {
      let reqOp = {
        baseUrl: this._apiBase,
        url: path,
        method: method,
        timeout: this._timeout,
        headers: Object.assign({}, this._headers, {Cookie: this.cookie})
      }
      Object.assign(reqOp, {qs: qs})
      if (body) {
        Object.assign(reqOp, {body: body})
        if (typeof body === 'object') {
          Object.assign(reqOp, {json: true})
        }
      }
      request(reqOp, (err, icm, res) => {
        if (err) {
          reject(err.toString())
        } else if (Math.floor(icm.statusCode / 100) !== 2) {
          if (!res) {
            reject(icm.statusCode)
          } else {
            reject((typeof res === 'object' ? JSON.stringify(res) : res.toString()))
          }
        } else {
          try {
            if (typeof res === 'string') {
              res = JSON.parse(res)
            }
          } catch (e) {
            reject('JSON response invalid.')
            return
          }
          resolve(res)
        }
      })
    })
    return promise
  }
  testLogin () {
    // Test if the cookie provided by this.cookie is logined. Init user if so.
    return new Promise((resolve, reject) => {
      this.api('get', 'user/', {}, null).then((res) => {
        if (!res.userid) {
          reject('Not logged-in.')
          return
        }
        this._user = res.username
        this._userid = res.userid
        this._avatarUrl = res.avatar
        this._nickname = res.nickname
        resolve()
      }).catch(reject)
    })
  }
  todayStats () {
    return new Promise((resolve, reject) => {
      this.api('get', 'bdc/stats/today/', {}, null).then((res) => {
        if (res['status_code'] !== 0) {
          reject(res.msg)
        } else {
          resolve(res.data)
        }
      }).catch(reject)
    })
  }
  fetchReview (amount) {
    // Get {amount} review(s) from Shanbay with one request. Won't lookup other information. See processReview in main.js .
    return new Promise((resolve, reject) => {
      if (!(amount > 0)) {
        reject(new Error('Invalid amount'))
        return
      }
      this.api('get', 'bdc/review/', {len: amount}, null).then((res) => {
        if (res.status_code !== 0) {
          reject(res.msg)
          return
        }
        resolve(res.data.reviews.map(reviewData => new ReviewWord(reviewData)))
      }).catch(reject)
    })
  }
  submitReview (resultMap) {
    return new Promise((resolve, reject) => {
      let ids = []
      let results = []
      let seconds = []
      Object.keys(resultMap).forEach(k => {
        let v = resultMap[k]
        let second = 1
        if (typeof v !== 'string') {
          v = resultMap[k].result
          second = resultMap[k].second
        }
        let rid = parseInt(k)
        let vi
        if (rid >= 0) {
          switch (v) {
            case 'forget':
              vi = 0
              break
            case 'pass':
              vi = 1
              break
            case 'master':
              vi = 2
              break
            default:
              throw new Error('Illegal result.')
          }
          ids.push(rid)
          results.push(vi)
          seconds.push(second)
        }
      })
      let subm = {ids: ids.join(','), results: results.join(','), seconds: seconds.join(',')}
      this.api('put', 'bdc/review/', {}, subm).then(res => {
        if (res.status_code !== 0) {
          reject(res.msg)
          return
        }
        resolve()
      }).catch(reject)
    })
  }
}

const pirateAPIHeaders = {
  'accept-language': 'en',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)'
}
shanbay._wordsapi = (() => {
  let currentWhen = null
  let currentEncrypted = null

  function fetchApiKey () {
    return new Promise((resolve, reject) => {
      request({
        url: 'https://www.wordsapi.com/',
        headers: Object.assign({}, pirateAPIHeaders, {
          'accept': 'text/html,*/*'
        }),
        method: 'get',
        timeout: 5000
      }, (err, icm, res) => {
        if (err) {
          reject(err)
        } else if (Math.floor(icm.statusCode / 100) !== 2) {
          reject(new Error("Can't access Wordsapi.com: " + icm.statusCode))
        } else {
          let whenMatch = res.match(/when = "(.+)"/)
          let encryptMatch = res.match(/encrypted = "(.+)"/)
          if (!whenMatch || !encryptMatch) {
            reject(new Error('Wordsapi.com API changed.'))
            return
          }
          currentWhen = whenMatch[1]
          currentEncrypted = encryptMatch[1]
          setTimeout(resolve, 100)
        }
      })
    })
  }
  function fetchWord (word) {
    return new Promise((resolve, reject) => {
      if (!currentWhen || !currentEncrypted) {
        fetchApiKey().then(fetch).catch(reject)
      } else {
        fetch()
      }
      function fetch () {
        request({
          url: 'https://www.wordsapi.com/words/' + encodeURIComponent(word),
          headers: Object.assign({}, pirateAPIHeaders, {
            'accept': 'application/json',
            'referer': 'https://www.wordsapi.com/'
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
            reject(err)
          } else if (icm.statusCode === 404) {
            reject(null)
          } else if (Math.floor(icm.statusCode / 100) !== 2 && icm.statusCode !== 400) {
            reject(new Error("Can't access Wordsapi.com: " + icm.statusCode))
          } else {
            if (res.status === 'error') {
              if (res.message.match(/expired/)) {
                fetchApiKey().then(fetch).catch(reject)
              } else {
                reject(res.message)
              }
            } else {
              resolve(res)
            }
          }
        })
      }
    })
  }
  return fetchWord
})()

shanbay._thesaurus = word => new Promise((resolve, reject) => {
  if (!word.match(/^[a-zA-Z\- ]{1,}$/)) {
    resolve([])
    return
  }
  request({
    url: 'http://www.thesaurus.com/browse/' + encodeURIComponent(word),
    headers: Object.assign({}, pirateAPIHeaders, {
      'accept': 'text/html,*/*'
    }),
    method: 'get',
    timeout: 5000
  }, (err, icm, res) => {
    if (err) {
      reject(err)
    } else if (icm.statusCode === 403) {
      setTimeout(() => shanbay._thesaurus(word).then(resolve, reject), 1000)
    } else if (icm.statusCode === 404) {
      resolve([])
    } else if (Math.floor(icm.statusCode / 100) !== 2) {
      reject(new Error("Can't access Thesaurus.com: " + icm.statusCode))
    } else {
      try {
        let $ = cheerio.load(res)
        let $syns = $('.relevancy-list span.text')
        let syns = []
        for (let i = 0; i < $syns.length; i++) {
          syns.push($syns.eq(i).text())
        }
        resolve(syns)
      } catch (e) {
        reject(e)
      }
    }
  })
})
shanbay._collins = word => new Promise((resolve, reject) => {
  request({
    url: 'https://www.collinsdictionary.com/dictionary/english/' + encodeURIComponent(word),
    headers: Object.assign({}, pirateAPIHeaders, {
      'accept': 'text/html,*/*'
    }),
    method: 'get',
    timeout: 5000
  }, (err, icm, res) => {
    if (err) {
      reject(err)
    } else if (icm.statusCode === 404) {
      resolve([])
    } else if (Math.floor(icm.statusCode / 100) !== 2) {
      reject(new Error("Can't access Collinsdictionary.com: " + icm.statusCode))
    } else {
      try {
        let $ = cheerio.load(res)
        let $defs = $('.cobuild .def')
        let defs = []
        for (let i = 0; i < $defs.length; i++) {
          defs.push($defs.eq(i).text())
        }
        resolve(defs)
      } catch (e) {
        reject(e)
      }
    }
  })
})

module.exports = shanbay
