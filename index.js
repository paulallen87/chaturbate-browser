'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const debug = require('debug')('chaturbate:browser');
const EventEmitter = require('events').EventEmitter;
const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

const SERVER_URL = 'https://chaturbate.com';
const PROFILE_PATCH_PREFIX = '##PROFILE--';

const DEFAULT_CONFIG = {
  server: SERVER_URL,
  port: undefined,
  proxyServer: undefined
};

const CHROME_FLAGS = [
  '--new',
  '--args',
  '--start-maximized',
  '--disable-save-password-bubble',
  '--disable-presentation-api',
  '--disable-file-system',
  '--disable-contextual-search',
  '--disable-account-consistency',
  '--disable-translate',
  '--disable-background-mode',
  '--disable-plugins-discovery',
  '--disable-webgl',
  '--disable-webgl-image-chromium',
  '--disable-speech-api',
  '--disable-smart-virtual-keyboard',
  '--disable-print-preview',
  '--disable-password-generation',
  '--disable-overlay-scrollbar',
  '--disable-offer-upload-credit-cards',
  '--disable-ntp-popular-sites',
  '--disable-cloud-import',
  '--disable-component-cloud-policy',
  '--disable-credit-card-scan',
  '--disable-bundled-ppapi-flash',
  '--disable-java',
  '--disable-plugins',
  '--disable-ipv6',
  '--disable-people-search',
  '--disable-default-apps',
  '--incognito',
  '--disable-sync',
  '--disable-sync-backup',
  '--disable-sync-rollback',
  '--disable-sync-app-list',
  '--disable-sync-types',
  '--enable-sandbox',
  '--enable-sandbox-logging',
  '--isolate-extensions',
  '--isolate-sites-for-testing=*',
  '--process-per-tab',
  '--process-per-site',
  '--safe-plugins',
  '--disable-gpu',
  '--mute-audio',
  '--headless'
]

/**
 * Browser wrapper for interacting with Chaturbate.
 */
class ChaturbateBrowser extends EventEmitter {

  /**
   * Constructor.
   *
   * @param {Object} config
   */
  constructor(config={}) {
    super();

    this.config = Object.assign({}, DEFAULT_CONFIG, config);
    this.chrome = null;
    this.protocol = null;
  }

  /**
   * Launches the Chrome web browser.
   *
   * @return {Object} The chrome object that represents the browser process.
   */
  async _launchChrome() {
    const chromeFlags = CHROME_FLAGS.slice();

    if (this.config.proxyServer) {
      flags.push(`--proxy-server=${this.config.proxyServer}`)
      flags.push('--host-resolver-rules="MAP * 0.0.0.0, EXCLUDE localhost"')
    }

    return await chromeLauncher.launch({
      port: this.config.port,
      chromeFlags: chromeFlags
    });
  }

  /**
   * Launches the browser and connects the debugger.
   */
  async start() {
    debug('starting chrome...');
    this.chrome = await this._launchChrome();

    debug('starting remote debugging...');
    this.protocol = await CDP({port: this.chrome.port});

    debug('enabling debugging domains...');
    await [
      this.protocol.Page.enable(),
      this.protocol.Runtime.enable(),
      this.protocol.Network.enable()
    ];

    debug('adding event listeners...');
    this.protocol.Page.loadEventFired(() => this._onPageLoad());
    this.protocol.Runtime.consoleAPICalled((params) => {
      return this._onConsoleAPICalled(params);
    })
  }

  /**
   * Executes a callback and waited for the page to load.
   *
   * @param {Function} cb 
   * @return {*}
   */
  async wait(cb) {
    const pagePromise = this._getPageLoadPromise();

    const result = await cb.call(this)

    await Promise.resolve(pagePromise);

    return result;
  }

  /**
   * Navigates to a URL.
   *
   * @param {string} url 
   * @return {*}
   */
  async goto(url) {
    return await this.wait(async () => {
      return await this.protocol.Page.navigate({
        url: `${this.config.server}/${url}`
      });
    })
  }

  /**
   * Gets a list of cookies.
   * 
   * @return {Array<Object>}
   */
  async cookies() {
    const response = await this.protocol.Network.getCookies();
    return response.cookies;
  }

  /**
   * Checks the current login session.
   * 
   * @return {boolean}
   */
  async session() {
    const cookies = await this.cookies();
    const sessionCookie = cookies.find((c) => {
      return c.name = 'sessionid' && c.session && !!c.value;;
    });
    return !!sessionCookie;
  }

  /**
   * Performs a login as a user.
   *
   * @param {string} username 
   * @param {string} password 
   * @return {boolean}
   */
  async login(username, password) {
    debug(`logging in as '${username}'...`);

    await this.goto('auth/login/')

    await this.wait(async () => {
      await this._evaluateScript('login', {
        'LOGIN_USERNAME': username,
        'LOGIN_PASSWORD': password
      });
    })

    const session = await this.session();

    if (session) {
      debug(`logged in`);
      this.emit('login', username)
      return true;
    } else {
      console.error('login failed');
      return false;
    }
  }

  /**
   * Requests a token purchase with Bitcoin.
   *
   * @param {*} amount 
   * @return {Object}
   */
  async purchase(amount) {
    debug(`requesting ${amount} tokens...`);

    await this.goto('tipping/purchase_tokens/');

    await this.wait(async () => {
      await this._evaluateScript('payment', {
        'PAYMENT_AMOUNT': amount
      });
    })

    const results = await this._evaluateScript('bitcoin');

    this.emit('purchase', results);

    return results;
  }

  /**
   * Navigates the browser to a user's profile.
   * 
   * @param {string} username
   */
  async profile(username) {
    debug(`loading profile for '${username}'...`);

    await this.goto(`${username}/`);

    await this._evaluateScript('profile', {
      'PATCH_PREFIX': PROFILE_PATCH_PREFIX
    });

    this.emit('profile', username);
  }

  /**
   * Stops the remote dubugger and kills the Chrome process.
   */
  stop() {
    if (this.protocol) {
      debug('stopping remote debugging...');
      this.protocol.close();
      this.protocol = null;
    }

    if (this.chrome) {
      debug('stopping chrome...');
      this.chrome.kill();
      this.chrome = null;
    }
  }

  /**
   * Creates a promise for the next page load.
   * 
   * @return {Promise}
   */
  _getPageLoadPromise() {
    return new Promise((resolve, reject) => {
      this.once('page_load', () => resolve());
    });
  }

  /**
   * Called when the browser successfully loads a page.
   */
  async _onPageLoad() {
    debug('onPageLoad');

    this.emit('page_load');
  }

  /**
   * Called when a console message is intercepted.
   * 
   * @param {Object} params
   */
  _onConsoleAPICalled(params) {
    if (params.type.toUpperCase() != 'DEBUG') return;
    if (params.args.length != 1) return;

    const arg = params.args[0].value;
    if (!arg.startsWith(PROFILE_PATCH_PREFIX)) return;

    const json = arg.slice(PROFILE_PATCH_PREFIX.length);
    const message = JSON.parse(json);
    this._onProfileMessage(message);
  }

  /**
   * Called when a message is received.
   *
   * @param {Object} message 
   */
  _onProfileMessage(message) {
    debug(`received profile message: ${message.type}`)
    switch (message.type) {
      case 'init':
        this._onProfileInit(message.payload);
        return;
      case 'websocket_open':
        this._onProfileWebsocketOpen();
        return;
      case 'websocket_message':
        this._onProfileWebsocketMessage(message.payload);
        return;
      case 'websocket_error':
        this._onProfileWebsocketError(message.payload);
        return;
      case 'websocket_close':
        this._onProfileWebsocketClose(message.payload);
        return;
      default:
        debug('unknown profile message');
    }
  }

  /**
   * Called when the profile patch is initialized.
   *
   * @param {Object} payload 
   */
  _onProfileInit(payload) {
    debug(`profile initialized`);

    this.emit('init', {
      settings: JSON.parse(payload.settings),
      chatSettings: JSON.parse(payload.chatSettings),
      initializerSettings: JSON.parse(payload.initializerSettings),
      csrftoken: payload.csrftoken,
      hasWebsocket: payload.hasWebsocket
    })
  }

  /**
   * Called when the profile websocket is opened.
   */
  _onProfileWebsocketOpen() {
    this.emit('open');
  }

  /**
   * Called when the profile websocket receives a message.
   * @param {Object} payload 
   */
  _onProfileWebsocketMessage(payload) {
    if (payload.type != 'message') return;

    const data = JSON.parse(payload.data);
    debug(`websocket event message received`);

    this.emit('message', {
      timestamp: payload.timestamp,
      method: data.method,
      callback: data.callback,
      args: data.args.map((arg) => this._parseArg(arg))
    })
  }

  /**
   * Called when the profile websocket receives an error.
   *
   * @param {Error} err 
   */
  _onProfileWebsocketError(err) {
    this.emit('error', err);
  }

  /**
   * Called when the profile websocket is closed.
   * 
   * @param {Event} event
   */
  _onProfileWebsocketClose(event) {
    this.emit('close', event);
  }

  /**
   * Parses Chaturbate websocket message arguments into native
   * javascript objects.
   *
   * @param {string} arg 
   * @return {*}
   */
  _parseArg(arg) {
    if (arg == 'true' || arg == 'false') {
      return arg == 'true';
    }

    if (!isNaN(arg) && arg != "") {
      return Number(arg);
    }

    if (arg.startsWith('{')) {
      return JSON.parse(arg);
    }

    return arg;
  }

  /**
   * Evaluates a script within the browser.
   *
   * @param {string} script 
   * @param {boolean} awaitPromise 
   * @param {boolean} returnByValue 
   * @return {*}
   */
  async evaluate(script, awaitPromise=false, returnByValue=false) {
    debug(`evaluating script: \n${script}`);
    const response = await this.protocol.Runtime.evaluate({
      expression: script,
      awaitPromise: awaitPromise,
      returnByValue: returnByValue
    })

    if (response.exceptionDetails) {
      debug('script failed');
      debug(response.exceptionDetails);
      return null;
    }

    if (response.result) {
      debug(response.result.value)
      return response.result.value;
    }
  }

  /**
   * Evaluates a prebuilt script within the browser.
   *
   * @param {string} name 
   * @param {Object} params 
   * @return {*}
   */
  async _evaluateScript(name, params=undefined) {
    debug(`inserting script: ${name}`);
    const normalizedPath = path.join(__dirname, `scripts/${name}.js`);
    
    let script = fs.readFileSync(normalizedPath, 'utf8');

    if (params) {
      Object.keys(params).forEach((key) => {
        script = script.replace(`<${key}>`, params[key]);
      });
    }

    return await this.evaluate(script, false, true);
  }

  /**
   * Performs an HTTP fetch within the browser.
   *
   * @param {string} url 
   * @param {Object} params 
   * @return {*}
   */
  async fetch(url, params={}, options) {
    debug(`making fetch call to: ${url}`);
    const qs = querystring.stringify(params);
    const opts = JSON.stringify(options || {
      credentials: 'include'
    });
    const expression = `fetch('${url}?${qs}', ${opts}).then((r) => r.text())`;

    return await this.evaluate(expression, true, false);
  }

}

module.exports = ChaturbateBrowser;