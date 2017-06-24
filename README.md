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

cb.profile(username);

setTimeout(() => cb.stop(), 10 * 1000);
```

## Methods

  ### **start**
  Starts the browser instance.

  ```javascript
  await cb.start();
  ```

  ### **profile**
  Navigates the browser to a specific profile page.

  ```javascript
  cb.profile('my username');
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

  ### **wait**
  Perform an action (form submittion) and wait for page to load.

  ```javascript
  await cb.wait(async () => {
    await cb.evaluate('document.querySelector(\'form\').submit()')
  });
  ```
  
  ### **goto**
  Navigate to a specific page.

  ```javascript
  await cb.goto('http://www.google.com');
  ```

  ### **cookies**
  Get a list of cookies.

  ```javascript
  const cookies = await cb.cookies();
  ```

  ### **session**
  Check if a login session exists.

  ```javascript
  const loggedIn = await cb.session();
  ```

  ### **login**
  Login and create a session.

  ```javascript
  await cb.login('username', 'password');
  ```

  ### **purchase**
  Request a token purchase with BitCoin.

  ```javascript
  const result = await cb.putchase(100);
  console.log(`amount to send: ${result.amount}`)
  console.log(`send to: ${result.address}`)
  ```

  ### **evaluate**
  Run a script.

  ```javascript
  const result = await cb.evaluate('document.querySelector(\/title\/).innerText');
  ```

## Events

  ### **login**
  Called after a login.

  ```javascript
  cb.on('login', (username) => {
    console.log(`logged in as '${username}'`);
  });
  ```

  ### **profile**
  Called after a page has loaded.

  ```javascript
  cb.on('profile', () => {
    console.log(`profile loaded for '${username}'`);
  });
  ```

  ### **profile**
  Called after a purchase has been setup.

  ```javascript
  cb.on('purchase', (e) => {
    console.log(`send '${e.amount}' to '${e.address}'`);
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