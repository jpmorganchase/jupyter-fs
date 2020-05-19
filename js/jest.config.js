module.exports = {
  preset: "ts-jest/presets/js-with-babel",
  transform: {
    "\\.svg$": "jest-raw-loader"
  },
  moduleNameMapper:{
    "\\.(css|less|sass|scss)$": "<rootDir>/testutils/styleMock.js",
    "\\.(jpg|jpeg|png|gif|eot)$": "<rootDir>/testutils/fileMock.js"
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  testRegex: "tests\/.*\.test\.ts[x]?$",
  transformIgnorePatterns: ['/node_modules/(?!(@jupyterlab/.*)/)'],
  globals: {
    "ts-jest": {
      // in tsconfig.test.json, rootDir is parent of both tests and src dirs
      tsConfig: 'tsconfig.test.json'
    }
  }
};
