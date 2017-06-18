window.__patch_prefix = '<PATCH_PREFIX>';

window.__patch_replacer = (key, value) => {
  if (!key) return value;
  if (typeof value == 'object') return undefined;
  return value;
};

window.__patch_reply = (type, payload=null) => {
  console.debug(window.__patch_prefix + JSON.stringify({
    type: type,
    payload: payload
  }));
};

if (ws_handler.ws_socket) {
  const orig_onmessage = ws_handler.ws_socket.onmessage;
  ws_handler.ws_socket.onmessage = (event) => {
    window.__patch_reply('websocket_message', event);
    orig_onmessage(event);
  };

  const orig_onerror = ws_handler.ws_socket.onerror;
  ws_handler.ws_socket.onerror = (err) => {
    window.__patch_reply('websocket_error', err);
    orig_onerror(err);
  };

  const orig_onclose = ws_handler.ws_socket.onclose;
  ws_handler.ws_socket.onclose = (event) => {
    window.__patch_reply('websocket_close', event);
    orig_onclose(event);
  };

  const orig_onopen = ws_handler.ws_socket.onopen;
  ws_handler.ws_socket.orig_onopen = () => {
    window.__patch_reply('websocket_open');
    orig_onopen();
  };
}

window.__patch_reply('init', {
  'settings': JSON.stringify(window.defchat_settings.handler, window.__patch_replacer),
  'chatSettings': JSON.stringify(window.defchat_settings, window.__patch_replacer),
  'csrftoken': $.cookie('csrftoken'),
  'hasWebsocket': !!ws_handler.ws_socket
});

ws_handler.ws_socket