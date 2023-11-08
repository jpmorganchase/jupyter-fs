/* eslint-disable no-undef */
//global.fetch = require("jest-fetch-mock");
const version = process.version.match(/^v((\d+)\.(\d+))/).slice(2, 4).map(v => parseInt(v));
if (version[0] === 18 && version[1] <= 16) {
  globalThis.crypto = require("crypto");
}
