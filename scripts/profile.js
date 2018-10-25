/* eslint strict: 0, no-console: 0 */

(w => {
  const PREFIX = "<PATCH_PREFIX>";

  /**
   * JSON replacer for deep objects.
   *
   * @param {string} key
   * @param {*} value
   * @return {*}
   */
  const replacer = (key, value) => {
    if (!key) return value;
    if (typeof value === "object") return undefined;
    return value;
  };

  /**
   * Send a reply to the chrome debugger.
   *
   * @param {*} type
   * @param {*} payload
   */
  const reply = (type, payload = null) => {
    console.debug(
      PREFIX +
        JSON.stringify({
          payload: payload,
          type: type
        })
    );
  };

  /**
   * Attempts to retrieve the websocket handler.
   *
   * @return {Object}
   */
  const getHandler = () => {
    return (window.defchat_settings || {}).handler || {};
  };

  /**
   * Returns the room name.
   *
   * @return {string}
   */
  const getRoomName = () => {
    return getHandler().room;
  };

  /**
   * Returns a reference to the video player.
   *
   * @return {Object}
   */
  const getPlayer = () => {
    return window.jsplayer;
  };

  /**
   * Collects common settings.
   *
   * @return {Object}
   */
  const getSettings = () => {
    const settings = window.defchat_settings || {};
    const handlerSettings = getHandler();
    const initializerSettings = handlerSettings.initializer || {};
    return {
      chatSettings: JSON.stringify(settings, replacer),
      // eslint-disable-next-line no-undef
      csrftoken: "", //$.cookie("csrftoken"),
      hasPlayer: Boolean(getPlayer()),
      initializerSettings: JSON.stringify(initializerSettings, replacer),
      room: getRoomName(),
      settings: JSON.stringify(handlerSettings, replacer)
    };
  };

  /**
   * Disposes the video player.
   *
   * @return {boolean}
   */
  const disposePlayer = () => {
    const player = getPlayer();
    if (player) {
      const SEC_IN_MS = 1000.0;

      player.src = "";
      player.pause();
      player.dispose();
      player.pause = () => undefined;
      player.play = () => undefined;
      player.src = () => undefined;
      player.currentTime = () => new Date().getTime() / SEC_IN_MS;

      return true;
    }

    console.error("Unable to dispose video player");
    return false;
  };

  /**
   * Attempts to dispose thevideo player or retries 10 times.
   *
   * @param {number} count
   */
  const disposePlayerOrRetry = (count = 1) => {
    if (count > 10) {
      console.error("Giving up on player dispose");
      return;
    }

    if (!disposePlayer()) {
      setTimeout(() => disposePlayerOrRetry(count + 1), count * 1000);
    }
  };

  /**
   * Main call.
   */
  const main = () => {
    reply("init", getSettings());

    if (getRoomName()) {
      disposePlayerOrRetry();
    } else {
      console.debug("room is probably offline");
    }
  };

  main();
})(window);
