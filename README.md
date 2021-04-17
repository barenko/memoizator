# Memoizator

  A promise-friendly memoize package



Uses the [memoization technique](https://en.wikipedia.org/wiki/Memoization) to optimize expensive function results storing their results. You can use this technique over a wide range of applications.

```js
const factorial = require('../lib/factorial')
const memoizator = require("memoizator")

const factorialMemoized = memoizator(factorial, { ttl: 600000 })


export default async function calcFactorial(req, res) {
    try {
        const { factor } = req.query
        
        const data = await factorialMemoized(factor)

        res.json({ data })
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error', details: e.message })
    }
}
```

This package allows you to use the memoization over promises functions and allow a fine-granded control over the cache configuration to avoid memory issues and others.

## Installation

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
$ npm install memoizator
```

## Features

  * Fine-granded control over internal cache
  * Easy to use
  * Promise (async/await) focused
  * Isolated: Each memoizator method is self-contained and fully isolated
  * EventEmitter: Allow listen events to a better understanding of the inner workings of the package
  * Very small: Less than 100 lines of code
  * 100% code coverage
  
## Issues

No issue found until now. If you discover any problem, please open a ticket in this repository.

## How to help

This project started from my project needs. If you think this package can help you and you'll be grateful to contribute but don't known how, please, take a look at this list.

  * Documentation improvement
  * Performance tests