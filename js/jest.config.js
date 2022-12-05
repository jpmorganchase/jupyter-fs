module.exports = {
  preset: "ts-jest/presets/js-with-babel",
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "<rootDir>/tests/styleMock.js",
    "\\.(jpg|jpeg|png|gif|eot|svg)$": "<rootDir>/tests/fileMock.js",
  },
  moduleFileExtensions: ["ts", "tsx", "js"],
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  testRegex: "tests\/.*\.test\.ts[x]?$",  // eslint-disable-line no-useless-escape
  transform: {
    "\\.tsx?$": "ts-jest",
    "\\.jsx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!@jupyterlab|lib0|y\\-protocols|tree-finder)"
  ],
  globals: {
    "ts-jest": {
      // in tsconfig.test.json, rootDir is parent of both tests and src dirs
      tsconfig: "tsconfig.test.json",
    },
  },
};
