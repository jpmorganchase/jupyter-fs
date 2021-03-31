module.exports = {
  preset: "ts-jest/presets/js-with-babel",
  transform: {
    "\\.svg$": "jest-raw-loader",
  },
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "<rootDir>/tests/styleMock.js",
    "\\.(jpg|jpeg|png|gif|eot)$": "<rootDir>/tests/fileMock.js",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  testRegex: "tests\/.*\.test\.ts[x]?$",  // eslint-disable-line no-useless-escape
  transformIgnorePatterns: ["/node_modules/(?!(@jupyterlab/.*)|(tree-finder)/)"],
  globals: {
    "ts-jest": {
      // in tsconfig.test.json, rootDir is parent of both tests and src dirs
      tsconfig: "tsconfig.test.json",
    },
  },
};
