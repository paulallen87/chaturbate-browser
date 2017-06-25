((handler, settings, player) => {

  const PREFIX = '<PATCH_PREFIX>';

  const replacer = (key, value) => {
    if (!key) return value;
    if (typeof value == 'object') return undefined;
    return value;
  };

  const reply = (type, payload=null) => {
    console.debug(PREFIX + JSON.stringify({
      type: type,
      payload: payload
    }));
  };

  if (handler.ws_socket) {
    const orig_onmessage = handler.ws_socket.onmessage;
    const orig_onerror = handler.ws_socket.onerror;
    const orig_onclose = handler.ws_socket.onclose;
    const orig_onopen = handler.ws_socket.onopen;

    handler.ws_socket.onmessage = (event) => {
      reply('websocket_message', event);
      orig_onmessage(event);
    };

    handler.ws_socket.onerror = (err) => {
      reply('websocket_error', err);
      orig_onerror(err);
    };

    handler.ws_socket.onclose = (event) => {
      reply('websocket_close', event);
      orig_onclose(event);
    };

    handler.ws_socket.orig_onopen = () => {
      reply('websocket_open');
      orig_onopen();
    };
  }

  const getSettings = () => {
    const handlerSettings = settings.handler;
    const initializerSettings = handlerSettings.initializer;
    return {
      'settings': JSON.stringify(handlerSettings, replacer),
      'chatSettings': JSON.stringify(settings, replacer),
      'initializerSettings': JSON.stringify(initializerSettings, replacer),
      'csrftoken': $.cookie('csrftoken'),
      'hasWebsocket': !!handler.ws_socket
    };
  };

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