((handler, settings, player) => {
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
    if (typeof value == 'object') return undefined;
    return value;
  };

  /**
   * Send a reply to the chrome debugger.
   *
   * @param {*} type 
   * @param {*} payload 
   */
  const reply = (type, payload=null) => {
    // eslint-disable-next-line no-console
    console.debug(PREFIX + JSON.stringify({
      type: type,
      payload: payload,
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
      'settings': JSON.stringify(handlerSettings, replacer),
      'chatSettings': JSON.stringify(settings, replacer),
      'initializerSettings': JSON.stringify(initializerSettings, replacer),
      // eslint-disable-next-line no-undef
      'csrftoken': $.cookie('csrftoken'),
      'hasWebsocket': !!handler.ws_socket,
    };
  };

  if (handler.ws_socket) {
    const origOnMessage = handler.ws_socket.onmessage;
    const origOnError = handler.ws_socket.onerror;
    const origOnClose = handler.ws_socket.onclose;
    const origOnOpen = handler.ws_socket.onopen;

    handler.ws_socket.onmessage = (event) => {
      reply('websocket_message', event);
      origOnMessage(event);
    };

    handler.ws_socket.onerror = (err) => {
      reply('websocket_error', err);
      origOnError(err);
    };

    handler.ws_socket.onclose = (event) => {
      reply('websocket_close', event);
      origOnClose(event);
    };

    handler.ws_socket.orig_onopen = () => {
      reply('websocket_open');
      origOnOpen();
    };
  }

  reply('init', getSettings());

  if (player) {
    player.src = '';
    player.pause();
    player.dispose();
    player.pause = () => undefined;
    player.play = () => undefined;
    player.src = () => undefined;
    player.currentTime = () => new Date().getTime() / 1000.0;
  }
})(window.ws_handler, window.defchat_settings, window.jsplayer);
