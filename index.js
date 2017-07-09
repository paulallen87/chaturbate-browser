'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const debug = require('debug')('chaturbate:browser');
const {EventEmitter} = require('events');
const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const chromeRemoteInterface = require('chrome-remote-interface');
const {Console} = require('console');

const logging = new Console(process.stdout, process.stderr);

const SERVER_URL = 'https://chaturbate.com';
const PROFILE_PATCH_PREFIX = '##PROFILE--';

/**
 * Default browser config options.
 *
 * @type {Object}
 */
const DEFAULT_CONFIG = {

  /** The port used by the chrome debugger. */
  port: undefined,

  /** The proxy server used by the browser. */
  proxyServer: undefined,

  /** The chaturbate server to connect to. */
  server: SERVER_URL,
};

/**
 * Default browser flags.
 *
 * @type {Array<string>}
 */
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
  // '--enable-sandbox',
  // '--enable-sandbox-logging',
  '--isolate-extensions',
  '--isolate-sites-for-testing=*',
  // '--process-per-tab',
  // '--process-per-site',
  '--safe-plugins',
  '--disable-gpu',
  '--mute-audio',
  '--no-zygote',
  '--no-sandbox',
  '--single-process',
  '--headless',
];

/**
 * Parses Chaturbate websocket message arguments into native
 * javascript objects.
 *
 * @param {string} arg 
 * @return {*}
 * @private
 */
const _parseArg = (arg) => {
  if (arg === 'true' || arg === 'false') {
    return arg === 'true';
  }

  if (!isNaN(arg) && arg !== '') {
    return Number(arg);
  }

  if (arg.startsWith('{')) {
    return JSON.parse(arg);
  }

  return arg;
};

/**
 * Browser wrapper for interacting with Chaturbate.
 */
class ChaturbateBrowser extends EventEmitter {

  /**
   * Constructor.
   *
   * @param {Object} config
   * @extends EventEmitter
   * @constructor
   */
  constructor(config = {}) {
    super();

    this.config = Object.assign({}, DEFAULT_CONFIG, config);
    this.chrome = null;
    this.protocol = null;
  }

  /**
   * Launches the Chrome web browser.
   *
   * @return {Object} The chrome object that represents the browser process.
   * @private
   */
  _launchChrome() {
    const flags = CHROME_FLAGS.slice();

    if (this.config.proxyServer) {
      flags.push(`--proxy-server=${this.config.proxyServer}`);
      flags.push('--host-resolver-rules="MAP * 0.0.0.0, EXCLUDE localhost"');
    }

    return chromeLauncher.launch({
      chromeFlags: flags,
      port: this.config.port,
    });
  }

  /**
   * Launches the browser and connects the debugger.
   */
  async start() {
    debug('starting chrome...');
    this.chrome = await this._launchChrome();

    debug('starting remote debugging...');
    this.protocol = await chromeRemoteInterface({port: this.chrome.port});

    process.on('exit', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    process.on('uncaughtException', (e) => this.stop(e));

    debug('enabling debugging domains...');
    await [
      this.protocol.Page.enable(),
      this.protocol.Runtime.enable(),
      this.protocol.Network.enable(),
    ];

    debug('adding event listeners...');
    this.protocol.Page.loadEventFired(() => this._onPageLoad());
    this.protocol.Runtime.consoleAPICalled((params) => {
      return this._onConsoleAPICalled(params);
    });
  }

  /**
   * Executes a callback and waited for the page to load.
   *
   * @param {Function} cb 
   * @return {*}
   */
  async wait(cb) {
    const pagePromise = this._getPageLoadPromise();

    const result = await cb.call(this);

    await Promise.resolve(pagePromise);

    return result;
  }

  /**
   * Navigates to a URL.
   *
   * @param {string} url 
   * @return {*}
   */
  goto(url) {
    return this.wait(() => {
      return this.protocol.Page.navigate({
        url: `${this.config.server}/${url}`,
      });
    });
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
    const sessionCookie = cookies.find((cookie) => {
      return cookie.name === 'sessionid' &&
             cookie.session &&
             Boolean(cookie.value);
    });
    return Boolean(sessionCookie);
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

    await this.goto('auth/login/');

    await this.wait(async() => {
      await this._evaluateScript('login', {
        'LOGIN_PASSWORD': password,
        'LOGIN_USERNAME': username,
      });
    });

    const session = await this.session();

    if (session) {
      debug(`logged in`);
      this.emit('login', username);
      return true;
    }

    logging.error('login failed');
    return false;
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

    await this.wait(async() => {
      await this._evaluateScript('payment', {
        'PAYMENT_AMOUNT': amount,
      });
    });

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
      'PATCH_PREFIX': PROFILE_PATCH_PREFIX,
    });

    this.emit('profile', username);
  }

  /**
   * Stops the remote dubugger and kills the Chrome process.
   * 
   * @param {Error=} e
   */
  stop(e) {
    if (e) {
      debug('Stopping because of error');
      logging.error(e);
    }

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
   * @private
   */
  _getPageLoadPromise() {
    return new Promise((resolve, reject) => {
      this.once('page_load', () => resolve());
    });
  }

  /**
   * Called when the browser successfully loads a page.
   * 
   * @private
   */
  _onPageLoad() {
    debug('onPageLoad');

    this.emit('page_load');
  }

  /**
   * Called when a console message is intercepted.
   * 
   * @param {Object} params
   * @private
   */
  _onConsoleAPICalled(params) {
    const EXPECTED_LENGTH = 1;
    const FIRST_ARG = 0;

    debug(params);

    if (params.type.toUpperCase() !== 'DEBUG') return;
    if (params.args.length !== EXPECTED_LENGTH) return;

    const arg = params.args[FIRST_ARG].value;
    if (!arg.startsWith(PROFILE_PATCH_PREFIX)) return;

    const json = arg.slice(PROFILE_PATCH_PREFIX.length);
    const message = JSON.parse(json);
    this._onProfileMessage(message);
  }

  /**
   * Called when a message is received.
   *
   * @param {Object} message 
   * @private
   */
  _onProfileMessage(message) {
    debug(`received profile message: ${message.type}`);
    switch (message.type) {
      case 'init':
        this._onProfileInit(message.payload);
        return;
      case 'websocket_hooked':
        this._onProfileWebsocketHooked(message.payload);
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
   * @private
   */
  _onProfileInit(payload) {
    debug(`profile initialized`);

    const result = {
      chatSettings: JSON.parse(payload.chatSettings),
      csrftoken: payload.csrftoken,
      hasPlayer: payload.hasPlayer,
      hasWebsocket: payload.hasWebsocket,
      initializerSettings: JSON.parse(payload.initializerSettings),
      room: payload.room,
      settings: JSON.parse(payload.settings),
    };

    debug(result);

    this.emit('init', result);
  }

  /**
   * Called when the profile websocket is hooked.
   *
   * @param {Object} payload 
   * @private
   */
  _onProfileWebsocketHooked(payload) {
    debug(`websocket hook initialized`);

    const result = {
      chatSettings: JSON.parse(payload.chatSettings),
      csrftoken: payload.csrftoken,
      hasPlayer: payload.hasPlayer,
      hasWebsocket: payload.hasWebsocket,
      initializerSettings: JSON.parse(payload.initializerSettings),
      room: payload.room,
      settings: JSON.parse(payload.settings),
    };

    debug(result);

    this.emit('hooked', result);
  }

  /**
   * Called when the profile websocket is opened.
   * 
   * @private
   */
  _onProfileWebsocketOpen() {
    this.emit('open');
  }

  /**
   * Called when the profile websocket receives a message.
   *
   * @param {Object} payload 
   * @private
   */
  _onProfileWebsocketMessage(payload) {
    if (payload.type !== 'message') return;

    const data = JSON.parse(payload.data);
    debug(`websocket event message received`);

    this.emit('message', {
      args: data.args.map((arg) => _parseArg(arg)),
      callback: data.callback,
      method: data.method,
      timestamp: payload.timestamp,
    });
  }

  /**
   * Called when the profile websocket receives an error.
   *
   * @param {Error} err 
   * @private
   */
  _onProfileWebsocketError(err) {
    this.emit('error', err);
  }

  /**
   * Called when the profile websocket is closed.
   * 
   * @param {Event} event
   * @private
   */
  _onProfileWebsocketClose(event) {
    this.emit('close', event);
  }

  /**
   * Evaluates a script within the browser.
   *
   * @param {string} script 
   * @param {boolean} awaitPromise 
   * @param {boolean} returnByValue 
   * @return {*}
   */
  async evaluate(script, awaitPromise = false, returnByValue = true) {
    debug(`evaluating script: \n${script}`);
    const response = await this.protocol.Runtime.evaluate({
      awaitPromise: awaitPromise,
      expression: script,
      returnByValue: returnByValue,
    });

    if (response.exceptionDetails) {
      debug('script failed');
      debug(response.exceptionDetails);
      return null;
    }

    if (response.result) {
      debug(response.result.value);
      return response.result.value;
    }

    return undefined;
  }

  /**
   * Evaluates a prebuilt script within the browser.
   *
   * @param {string} name 
   * @param {Object} params 
   * @return {*}
   * @private
   */
  _evaluateScript(name, params = undefined) {
    debug(`inserting script: ${name}`);
    const normalizedPath = path.join(__dirname, `scripts/${name}.js`);

    let script = fs.readFileSync(normalizedPath, 'utf8');

    if (params) {
      Object.keys(params).forEach((key) => {
        script = script.replace(`<${key}>`, params[key]);
      });
    }

    return this.evaluate(script);
  }

  /**
   * Performs an HTTP fetch within the browser.
   *
   * @param {string} url 
   * @param {Object} params 
   * @param {?Object} options
   * @return {*}
   */
  fetch(url, params = {}, options) {
    debug(`making fetch call to: ${url}`);
    const qs = querystring.stringify(params);
    const opts = JSON.stringify(options || {
      credentials: 'include',
    });
    const expression = `fetch('${url}?${qs}', ${opts}).then((r) => r.text())`;

    return this.evaluate(expression, true);
  }
}

module.exports = ChaturbateBrowser;
