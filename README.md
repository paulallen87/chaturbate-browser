Chaturbate Browser
=========

![build status](https://travis-ci.org/paulallen87/chaturbate-browser.svg?branch=master)
![coverage status](https://coveralls.io/repos/github/paulallen87/chaturbate-browser/badge.svg?branch=master)

A wrapper around a headless Chrome instance that allows for interacting with a Chaturbate.com profile.

## Requirements

* Chrome >= version 59

## Installation

```shell
npm install @paulallen87/chaturbate-browser
```

## Usage

```javascript
cb = new ChaturbateBrowser();

cb.on('page_load', async () => {
  // needed for 'child_inserted' events
  await cb.querySelector('.chat-list');
})

cb.on('child_inserted', (e) => {
  console.log(e.html);
})

await cb.start();

cb.navigate('<username>');

setTimeout(() => cb.stop(), 10 * 1000);
```

## Tests

```shell
npm test
```