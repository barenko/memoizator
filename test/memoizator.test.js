const memoizator = require('../index')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

jest.setTimeout(3000000);

test('memoizator must memoize calls without parameters', async() => {
    let myPromise = function() {
        return new Promise((res, rej) => {
            setTimeout(() => res(Math.random()), 10)
        })
    }

    const memoizedFn = memoizator(myPromise)

    const v1 = await memoizedFn()
    expect(v1).toBeDefined()
    expect(await memoizedFn()).toBe(v1)
    expect(await memoizedFn()).toBe(v1)
    expect(await memoizedFn()).toBe(v1)
    expect(await memoizedFn()).toBe(v1)
    expect(await memoizedFn()).toBe(v1)
    expect(await memoizedFn()).toBe(v1)
})

test('memoizator must reset cache when clear() is called', async() => {
    let myPromise = function() {
        return new Promise((res, rej) => {
            setTimeout(() => res(Math.random()), 10)
        })
    }

    const memoizedFn = memoizator(myPromise)

    const v1 = await memoizedFn()
    expect(v1).toBeDefined()
    expect(await memoizedFn()).toBe(v1)

    memoizedFn.clear()

    const v2 = await memoizedFn()
    expect(v2).not.toBe(v1)
    expect(await memoizedFn()).toBe(v2)
})


test('memoizator.size() must show the current sum of cache keys storage', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1))
    expect(memoizedFn.size()).toBe(0)

    await memoizedFn()
    expect(memoizedFn.size()).toBe(1)

    await memoizedFn()
    expect(memoizedFn.size()).toBe(1)

    await memoizedFn(1)
    expect(memoizedFn.size()).toBe(2)

    await memoizedFn("a")
    expect(memoizedFn.size()).toBe(3)

    memoizedFn.clear()

    expect(memoizedFn.size()).toBe(0)

    await memoizedFn(1)
    expect(memoizedFn.size()).toBe(1)
})

test('memoizator.on() and .once() are working well', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1))
    let addedCounter = 0
    let foundCounter = 0
    memoizedFn.on('entry.added', function() { addedCounter++ })
    memoizedFn.on('entry.found', function() { foundCounter++ })
    memoizedFn.once('entry.notFound', function(v) {
        expect(v).toBe("{}")
    })
    memoizedFn.once('entry.added', function(v) {
        expect(v).toBe("{}")
    })

    await memoizedFn()

    memoizedFn.once('entry.notFound', function(v) {
        expect(v).toBe("{\"0\":1}")
    })
    memoizedFn.once('entry.added', function(v) {
        expect(v).toBe("{\"0\":1}")
    })

    await memoizedFn(1)

    memoizedFn.once('entry.found', function(v) {
        expect(v).toBe("{\"0\":1}")
    })

    await memoizedFn(1)

    expect(addedCounter).toBe(2)
    expect(foundCounter).toBe(1)
})


test('memoizator must only return the error when the promise is rejected before be cached', async() => {
    const memoizedFn = memoizator(() => Promise.reject(new Error("cause")))
    let called = false
    memoizedFn.once('entry.error', function(err, v) {
        called = true
    })

    await expect(memoizedFn()).rejects.toThrow('cause')
    expect(called).toBeFalsy()
})

test('memoizator retry rejections in a transparent way when update is rejected after be cached', async() => {
    let counter = 0
    const memoizedFn = memoizator(() => {
        if (counter++ == 0) return Promise.resolve(1)
        return Promise.reject(new Error("cause"))
    }, { ttl: 1, refreshRate: 10 })
    let called = false
    let expired = false
    memoizedFn.once('entry.error', function(err, v) {
        called = true
    })
    memoizedFn.once('entry.expired', function(v) {
        expired = true
    })

    let v1 = await memoizedFn()
    expect(called).toBeFalsy()

    await sleep(15)
    let v2 = await memoizedFn()
    await sleep(15)
    let v3 = await memoizedFn()
    expect(v1).toBe(v2)
    expect(v3).toBe(v2)
    expect(expired).toBeTruthy()
    expect(called).toBeTruthy()
})

test('memoizator retry resolves in a transparent way when update is resolved after be cached', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1), { ttl: 4, refreshRate: 5 })
    let called = 0
    memoizedFn.on('entry.added', function(v) {
        called++
    })

    await memoizedFn()
    await memoizedFn()
    await memoizedFn()
    await sleep(10)
    await memoizedFn()
    await memoizedFn()
    await memoizedFn()
    await sleep(10)
    await memoizedFn()
    await memoizedFn()
    await memoizedFn()
    expect(called).toBe(3)
})

test('memoizator remove itens older than maxAge', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1), { ttl: 1, maxAge: 5, refreshRate: 5 })
    let removed = 0
    let expired = 0
    memoizedFn.on('entry.removed', function(v) {
        removed++
    })
    memoizedFn.on('entry.expired', function(v) {
        expired++
    })

    await memoizedFn()
    await memoizedFn(1)
    await sleep(15)
    await memoizedFn()
    await sleep(15)
    expect(expired).toBeGreaterThan(3)
    expect(removed).toBeGreaterThan(1)
})


test('memoizator remove itens above maxRecords', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1), { refreshRate: 10, maxRecords: 5 })
    let count = 0
    let removed = 0
    memoizedFn.on('cache.maxRecordsReached', function(v) {
        count++
    })
    memoizedFn.on('entry.removed', function(v) {
        removed++
    })

    await memoizedFn()
    await memoizedFn(1)
    await memoizedFn(2)
    await memoizedFn(3)
    await memoizedFn(4)
    await sleep(5)
    await memoizedFn(5)
    await memoizedFn(6)
    await memoizedFn(7)
    await memoizedFn(8)
    await sleep(5)
    expect(count).toBe(1)
    expect(removed).toBe(4)
})


test('memoizator remove itens above maxRecords', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1), { refreshRate: 0, ttl: 1 })
    let count = 0
    memoizedFn.on('entry.removed', function(v) {
        count++
    })
    memoizedFn.on('entry.expired', function(v) {
        count++
    })

    await memoizedFn()
    await memoizedFn(1)
    await memoizedFn(2)
    await memoizedFn(3)
    await memoizedFn(4)
    await sleep(5)
    await memoizedFn(5)
    await memoizedFn(6)
    await memoizedFn(7)
    await memoizedFn(8)
    await sleep(5)
    expect(count).toBe(0)
})

test('memoizator removeAllListeners', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1))
    let count = 0
    memoizedFn.on('entry.added', function(v) {
        count++
    })
    memoizedFn.on('entry.notFound', function(v) {
        count++
    })
    await memoizedFn()
    await memoizedFn(1)
    await sleep(5)
    expect(count).toBe(4)

    memoizedFn.removeAllListeners()

    await memoizedFn(2)
    await memoizedFn(3)
    await memoizedFn(4)
    await sleep(5)
    expect(count).toBe(4)
})

test('memoizator removeListener', async() => {
    const memoizedFn = memoizator(() => Promise.resolve(1))
    let count = 0
    let added = 0

    let l1 = function(v) { added++ }
    memoizedFn.on('entry.added', l1)

    let l2 = function(v) { count++ }
    memoizedFn.on('entry.notFound', l2)

    await memoizedFn()
    await memoizedFn(1)
    await sleep(5)
    expect(count).toBe(2)
    expect(added).toBe(2)

    memoizedFn.removeListener('entry.added', l1)

    await memoizedFn(2)
    await memoizedFn(3)
    await sleep(5)
    expect(count).toBe(4)
    expect(added).toBe(2)

    memoizedFn.removeListener('entry.notFound', l2)

    await memoizedFn(5)
    await memoizedFn(6)
    await sleep(5)
    expect(count).toBe(4)
    expect(added).toBe(2)
})