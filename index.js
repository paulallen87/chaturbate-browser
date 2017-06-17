'use strict';

const debug = require('debug')('chaturbate:browser');
const EventEmitter = require('events').EventEmitter;
const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

const SERVER_URL = 'https://chaturbate.com';

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
    this.documentNode = null;
    this.queue = [];
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
      this.protocol.DOM.enable(),
      this.protocol.Network.enable()
    ];

    debug('adding event listeners...');
    this.protocol.Page.loadEventFired(() => this._onPageLoad());
    this.protocol.DOM.childNodeInserted((params) => this._onChildInserted(params));   
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
   * Returns a NodeID from a QuerySelector.
   * 
   * @param {string} selector
   * @return {number}
   */
  async querySelector(selector) {
    const result = await this.protocol.DOM.querySelector({
        nodeId: this.documentNode.root.nodeId,
        selector: selector
    });

    debug(`selector '${selector}' returned node ${result.nodeId}`)

    return result.nodeId;
  }

  /**
   * Returns multiple NodeIDs from a QuerySelector.
   * 
   * @param {string} selector
   * @return {Array<number>}
   */
  async querySelectorAll(selector) {
    const result = await this.protocol.DOM.querySelectorAll({
        nodeId: this.documentNode.root.nodeId,
        selector: selector
    });

    debug(`selector '${selector}' returned nodes ${result.nodeIds}`)

    return result.nodeIds;
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

    this.queue.length = 0;
    this.documentNode = null;
  }

  /**
   * Called when the browser successfully loads a page.
   */
  async _onPageLoad() {
    debug('onPageLoad');

    this.documentNode = await this.protocol.DOM.getDocument();
    debug(`document node retrieved: ${this.documentNode.root.nodeId}`);

    this.emit('page_load', {
      dom: this.protocol.DOM,
      documentNodeId: this.documentNode.root.nodeI
    });
  }

  /**
   * Called when a new child is inserted into the page.
   * 
   * @param {Object} params
   */
  _onChildInserted(params) {
    debug(`onChildInserted: ${params.node.nodeId}`);

    this.queue.push({
      nodeId: params.node.nodeId,
      parentNodeId: params.parentNodeId,
      previousNodeId: params.previousNodeId,
      promise: this.protocol.DOM.getOuterHTML({nodeId: params.node.nodeId})
    });

    this._next();
  }

  /**
   * Attempts to process the next item in the queue.
   */
  _next() {
    if (!this.queue.length) return;

    setTimeout(() => this._processQueue(), 1);
  }

  /**
   * Processes the next item in the queue.
   */
  async _processQueue() {
    debug(`processQueue: ${this.queue.length}`);

    const child = this.queue.pop(0);

    try {
      const html = await child.promise;

      this.emit('child_inserted', {
        nodeId: child.nodeId,
        parentNodeId: child.parentNodeId,
        previousNodeId: child.previousNodeId,
        html: html.outerHTML
      })
    } catch(e) {
      debug(`failed to retrieve html for node ${child.nodeId}`);
    } finally {
      this._next();
    } 
  }
  
}

module.exports = ChaturbateBrowser;