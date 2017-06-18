'use strict';

const fs = require('fs');
const path = require('path');
const debug = require('debug')('chaturbate:browser');
const EventEmitter = require('events').EventEmitter;
const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

const SERVER_URL = 'https://chaturbate.com';
const PATCH_PREFIX = '##PATCH--';

/**
 * Browser wrapper for interacting with Chaturbate.
 */
class ChaturbateBrowser extends EventEmitter {

  /**
   * Constructor.
   *
   * @param {string} server
   * @param {number} port
   */
  constructor(server=SERVER_URL, port=9222) {
    super();
    this.server = server;
    this.port = port;
    this.chrome = null;
    this.protocol = null;
  }

  /**
   * Launches the Chrome web browser.
   *
   * @return {Object} The chrome object that represents the browser process.
   */
  async _launchChrome() {
    return await chromeLauncher.launch({
      port: this.port,
      chromeFlags: [
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
      this.protocol.Runtime.enable()
    ];

    debug('adding event listeners...');
    this.protocol.Page.loadEventFired(() => this._onPageLoad());
    this.protocol.Runtime.consoleAPICalled((params) => this._onConsoleAPICalled(params))
  }

  /**
   * Navigates the browser to a user's profile.
   * 
   * @param {string} username
   */
  navigate(username) {
    debug('navigating...');
    this.protocol.Page.navigate({
      url: `${this.server}/${username}/`
    }); 
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
   * Called when the browser successfully loads a page.
   */
  async _onPageLoad() {
    debug('onPageLoad');

    this._insertPatch();
    debug(`patch inserted`);

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
    if (!arg.startsWith(PATCH_PREFIX)) return;

    const json = arg.slice(PATCH_PREFIX.length);
    const message = JSON.parse(json);
    this._onPatchedMessage(message);
  }

  _onPatchedMessage(message) {
    debug(`received patch message: ${message.type}`)
    switch (message.type) {
      case 'init':
        this._onPatchInit(message.payload);
        return;
      case 'websocket_open':
        this._onWebsocketOpen();
        return;
      case 'websocket_message':
        this._onWebsocketMessage(message.payload);
        return;
      case 'websocket_error':
        this._onWebsocketError(message.payload);
        return;
      case 'websocket_close':
        this._onWebsocketClose(message.payload);
        return;
      default:
        debug('unknown patch message');
    }
  }

  _onPatchInit(payload) {
    debug(`patch initialized`);

    this.emit('init', {
      settings: JSON.parse(payload.settings),
      chatSettings: JSON.parse(payload.chatSettings),
      csrftoken: payload.csrftoken,
      hasWebsocket: payload.hasWebsocket
    })
  }

  _onWebsocketOpen() {
    this.emit('connecting');
  }

  _onWebsocketMessage(payload) {
    if (payload.type != 'message') return;

    const data = JSON.parse(payload.data);
    debug(`websocket event message received`);

    this.emit('message', {
      timestamp: payload.timestamp,
      method: data.method,
      args: data.args.map((arg) => this._parseArg(arg))
    })
  }

  _onWebsocketError(err) {
    this.emit('error', err);
  }

  _onWebsocketClose(event) {
    this.emit('disconnected', event);
  }

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

  async _insertPatch() {
    const normalizedPath = path.join(__dirname, 'patch.js');
    const patch = fs.readFileSync(normalizedPath, 'utf8').replace('<PATCH_PREFIX>', PATCH_PREFIX)

    debug(`inserting patch: ${patch}`);
    const result = await this.protocol.Runtime.evaluate({expression: patch})

    if (result.exceptionDetails) {
      debug('patch failed')
      debug(result.exceptionDetails)
    }
  }

}

module.exports = ChaturbateBrowser;