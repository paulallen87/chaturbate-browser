'use strict';

const {expect} = require('chai');
const ChaturbateBrowser = require('../index');

describe('ChaturbateBrowser', () => {
  it('should be exported', () => {
    expect(ChaturbateBrowser).to.not.equal(undefined);
  });
});
