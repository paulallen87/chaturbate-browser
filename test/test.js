'use strict';

const expect = require('chai').expect;
const ChaturbateBrowser = require('../index');

describe('ChaturbateBrowser', () => {
  it('should be exported', () => {
    expect(ChaturbateBrowser).to.notEqual(undefined);
  });
});
