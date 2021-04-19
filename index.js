const EventEmitter = require('events')
const logCacheD = require('debug')('memoizator:cache')
const logEntryD = require('debug')('memoizator:entry')
const logEntryErrorD = require('debug')('memoizator:entry:error')


function memoizator(promiseFn, { name, ttl = 60000, maxAge = 36000000, refreshRate = 10000, maxRecords = 10000, logFn } = {}) {
    const emitter = new EventEmitter()
    const logEntryError = logFn || logEntryErrorD
    const logEntry = logFn || logEntryD
    const logCache = logFn || logCacheD

    let cache = {}

    if (refreshRate > 0) {
        setInterval(() => {
            const t = new Date().getTime()
            Object.entries(cache).forEach((kv, idx) => {
                let v = kv[1]
                let k = kv[0]
                if (!v.dt || v.dt < t - ttl) {
                    v.expired = true;
                    logEntry(`entry.expired [${name}] ${k}`)
                    emitter.emit('entry.expired', k)
                }
                if (v.expired && v.dt < t - maxAge) {
                    delete cache[k]
                    logEntry(`entry.removed [${name}] ${k}`)
                    emitter.emit('entry.removed', k)
                }
            })
        }, refreshRate)
    }

    function setCache(key, value) {
        cache[key] = { dt: new Date().getTime(), value }
        logEntry(`entry.added [${name}] ${key}`)
        emitter.emit('entry.added', key)

        process.nextTick(() => {
            let mustRemoveQtd = Object.keys(cache).length - maxRecords
            if (mustRemoveQtd > 0) {
                logCache(`cache.maxRecordsReached [${name}]`)
                emitter.emit('cache.maxRecordsReached')
                let keys = Object.entries(cache).sort((c1, c2) => c1[1].dt - c2[1].dt).slice(0, mustRemoveQtd).map(v => v[0])
                keys.forEach(k => {
                    logEntry(`entry.removed [${name}] ${k}`)
                    emitter.emit('entry.removed', k)
                    delete cache[k]
                })
            }
        })
    }

    const fn = async function() {
        const fArgs = JSON.stringify(arguments)
        let hit = cache[fArgs]

        if (hit) {
            if (hit.expired) {
                promiseFn.apply(null, arguments).then(value => {
                    setCache(fArgs, value)
                }).catch(err => {
                    logEntryError(`entry.error [${name}] Key=${fArgs}, Error=${err.message}`)
                    emitter.emit('entry.error', err, fArgs)
                })
            }
            logEntry(`entry.found [${name}] ${fArgs}`)
            emitter.emit('entry.found', fArgs)
            return hit.value
        } else {
            logEntry(`entry.notFound [${name}] ${fArgs}`)
            emitter.emit('entry.notFound', fArgs)
            try {
                const value = await promiseFn.apply(null, arguments)
                setCache(fArgs, value)
                return value
            } catch (e) {
                return Promise.reject(e)
            }
        }
    }

    fn.clear = () => {
        cache = {}
        logCache(`cache.cleared [${name}]`)
        emitter.emit('cache.cleared')
    }

    fn.size = () => Object.keys(cache).length

    fn.on = function() { emitter.on.apply(emitter, arguments) }
    fn.once = function() { emitter.once.apply(emitter, arguments) }
    fn.removeAllListeners = function() { emitter.removeAllListeners.apply(emitter, arguments) }
    fn.removeListener = function() { emitter.removeListener.apply(emitter, arguments) }

    return fn
}

module.exports = memoizator;

/* 
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async() => {

    let myPromise = function() {
        return new Promise((res, rej) => {
            setTimeout(() => rej(new Error('cause')), 10)
        })
    }


    let fn = memoizator(myPromise)

    fn.once('cache.*', function(v1) {
        (logCache)(`${this.event} ${v1 || ''}`)
    })


    let i = 10
    while (i-- > 0) {
        console.log(await fn())
        await sleep(1000)
        fn.clear()
    }
})()
/**/