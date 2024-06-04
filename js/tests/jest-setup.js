/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
/* eslint-disable no-undef */
//global.fetch = require("jest-fetch-mock");
const version = process.version.match(/^v((\d+)\.(\d+))/).slice(2, 4).map(v => parseInt(v));
if (version[0] === 18 && version[1] <= 16) {
  globalThis.crypto = require("crypto");
}
