var tsConfig = require ('./tsconfig.json');

var tsOptions = tsConfig["compilerOptions"];
// Need as the test folder is not visible from the src folder
tsOptions["rootDir"] = null;

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
  testRegex: "test\/.*\.test\.ts[x]?$",
  transformIgnorePatterns: ['/node_modules/(?!(@jupyterlab/.*)/)'],
  globals: {
    "ts-jest": {
      tsConfig: tsOptions
    }
  }
};
