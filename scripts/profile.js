/* eslint strict: 0, no-console: 0 */

((handler, settings, jsplayer) => {
  const PREFIX = '<PATCH_PREFIX>';

  /**
   * JSON replacer for deep objects.
   *
   * @param {string} key 
   * @param {*} value 
   * @return {*}
   */
  const replacer = (key, value) => {
    if (!key) return value;
    if (typeof value === 'object') return undefined;
    return value;
  };

  /**
   * Send a reply to the chrome debugger.
   *
   * @param {*} type 
   * @param {*} payload 
   */
  const reply = (type, payload = null) => {
    console.debug(PREFIX + JSON.stringify({
      payload: payload,
      type: type,
    }));
  };

  /**
   * Collects common settings.
   * 
   * @return {Object}
   */
  const getSettings = () => {
    const handlerSettings = settings.handler;
    const initializerSettings = handlerSettings.initializer;
    return {
      'chatSettings': JSON.stringify(settings, replacer),
      // eslint-disable-next-line no-undef
      'csrftoken': $.cookie('csrftoken'),
      'hasWebsocket': Boolean(handler.ws_socket),
      'initializerSettings': JSON.stringify(initializerSettings, replacer),
      'settings': JSON.stringify(handlerSettings, replacer),
    };
  };

  /**
   * Hooks the room's websocket.
   *
   * @param {Object} socket
   * @return {boolean}
   */
  const hookSocket = (socket) => {
    if (socket) {
      const origOnMessage = socket.onmessage;
      const origOnError = socket.onerror;
      const origOnClose = socket.onclose;
      const origOnOpen = socket.onopen;

      socket.onmessage = (event) => {
        reply('websocket_message', event);
        origOnMessage(event);
      };

      socket.onerror = (err) => {
        reply('websocket_error', err);
        origOnError(err);
      };

      socket.onclose = (event) => {
        reply('websocket_close', event);
        origOnClose(event);
      };

      socket.orig_onopen = () => {
        reply('websocket_open');
        origOnOpen();
      };

      return true;
    }

    console.error('Unable to hook websocket');
    return false;
  };

  /**
   * Disposes the video player.
   *
   * @param {Object} player
   * @return {boolean}
   */
  const disposePlayer = (player) => {
    if (player) {
      const SEC_IN_MS = 1000.0;

      player.src = '';
      player.pause();
      player.dispose();
      player.pause = () => undefined;
      player.play = () => undefined;
      player.src = () => undefined;
      player.currentTime = () => new Date().getTime() / SEC_IN_MS;

      return true;
    }

    console.error('Unable to dispose video player');
    return false;
  };

  /**
   * Attempts to hook the websocket or retries 10 times.
   *
   * @param {number} count 
   */
  const hookSocketOrRetry = (count = 1) => {
    if (count > 10) {
      console.error('Giving up on websocket hook');
      return;
    }

    if (!hookSocket(handler.ws_socket)) {
      setTimeout(() => hookSocketOrRetry(count + 1), count * 1000);
    }
  };

  /**
   * Attempts to dispose thevideo player or retries 10 times.
   *
   * @param {number} count 
   */
  const disposePlayerOrRetry = (count = 1) => {
    if (count > 10) {
      console.error('Giving up on player dispose');
      return;
    }

    if (!disposePlayer(jsplayer)) {
      setTimeout(() => disposePlayerOrRetry(count + 1), count * 1000);
    }
  };

  if (settings.handler.room) {
    disposePlayerOrRetry();
    hookSocketOrRetry();
  }
  reply('init', getSettings());

})(window.ws_handler, window.defchat_settings, window.jsplayer);
