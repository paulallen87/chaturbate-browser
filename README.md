Chaturbate Browser
=========

![build status](https://travis-ci.org/paulallen87/chaturbate-browser.svg?branch=master)
![coverage status](https://coveralls.io/repos/github/paulallen87/chaturbate-browser/badge.svg?branch=master)
![dependencies](https://img.shields.io/david/paulallen87/chaturbate-browser.svg)
![dev dependencies](https://img.shields.io/david/dev/paulallen87/chaturbate-browser.svg)
![npm version](https://img.shields.io/npm/v/@paulallen87/chaturbate-browser.svg)

A wrapper around a headless Chrome instance that intercepts WebSocket messages from Chaturbate.

## Requirements

* Chrome >= version 59

## Installation

```shell
npm install @paulallen87/chaturbate-browser
```

## Usage

```javascript
cb = new ChaturbateBrowser();

cb.on('init', (e) => {
  console.dir(e.settings);
  console.dir(e.chatSettings);
  console.log(e.csrftoken);
  console.log(e.hasWebsocket);
});

cb.on('message', (e) => {
  console.log(e.timestamp);
  console.log(e.method);
  console.dir(e.args);
});

await cb.start();

cb.navigate('<username>');

setTimeout(() => cb.stop(), 10 * 1000);
```

## Tests

```shell
npm test
```