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
const username = '<username>';
const cb = new ChaturbateBrowser();

cb.on('init', async (e) => {
  console.dir(e.settings);
  console.dir(e.chatSettings);
  console.dir(e.initializerSettings);
  console.log(e.csrftoken);
  console.log(e.hasWebsocket);

  console.log(await cb.fetch(`/api/panel/${e.settings.room}/`));
});

cb.on('message', (e) => {
  console.log(e.timestamp);
  console.log(e.method);
  console.dir(e.args);
});

await cb.start();

cb.navigate(username);

setTimeout(() => cb.stop(), 10 * 1000);
```

## Methods

  ### **start**
  Starts the browser instance.

  ```javascript
  await cb.start();
  ```

  ### **navigate**
  Navigates the browser to a specific page.

  ```javascript
  cb.navigate('my username');
  ```

  ### **stop**
  Stops the browser instance.

  ```javascript
  cb.stop();
  ```

  ### **fetch**
  Fetchs the content from a specific URL.

  ```javascript
  const result = await cb.fetch('/some/url');
  ```

## Events

  ### **page_load**
  Called after a page has loaded.

  ```javascript
  cb.on('page_load', () => {
    console.log('page laoded');
  });
  ```

  ### **init**
  Called after the websocket hook is initialized.

  ```javascript
  cb.on('init', (e) => {
    const status = e.hasWebsockets ? 'online' : 'offline';
    console.log(`welcome to ${e.settings.room}'s room`);
    console.log(`the broadcaster is ${status}`)
  });
  ```

  ##### params
  * **settings** (Object)
  * **chatSettings** (Object)
  * **initializerSettings** (Object)
  * **csrftoken** (string)
  * **hasWebsocket** (boolean)

  ### **open**
  Called when the websocket is being opened.

  ```javascript
  cb.on('open', () => {
    console.log(`the socket is open`);
  });
  ```

  ### **message**
  Called when the websocket receives a message.

  ```javascript
  cb.on('message', (e) => {
    console.log(`method: ${e.method}`);
    console.log(`callback: ${e.callback}`);
    e.args.forEach((arg) => {
      console.log(`arg: ${arg}`);
    });
  });
  ```

  ##### params
  * **timestamp** (number)
  * **method** (string)
  * **callback** (?number)
  * **args** (Array)

  ### **error**
  Called when the websocket has an error.

  ```javascript
  cb.on('error', (e) => {
    console.error(`socket error: ${e}`);
  });
  ```

  ### **close**
  Called when the websocket is closed.

  ```javascript
  cb.on('close', (e) => {
    console.error(`socket closed`);
  });
  ```

## Tests

```shell
npm test
```