const esModules = ["@jupyter", "@jupyterlab", "@jupyter-widgets", "@lumino", "lib0", "nanoid", "y-protocols", "internmap", "delaunator", "robust-predicates", "lodash-es", "tree-finder"].join("|");

module.exports = {
  preset: "ts-jest/presets/js-with-babel",
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "<rootDir>/tests/styleMock.js",
    "\\.(jpg|jpeg|png|gif|eot|svg)$": "<rootDir>/tests/fileMock.js",
  },
  moduleFileExtensions: ["ts", "tsx", "js"],
  reporters: [ "default", "jest-junit" ],
  setupFilesAfterEnv: ["./tests/setup.js"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  testRegex: "tests\/.*\.test\.ts[x]?$",  // eslint-disable-line no-useless-escape
  transform: {
    "\\.tsx?$": [
      "ts-jest", {
        // in tsconfig.test.json, rootDir is parent of both tests and src dirs
        tsconfig: "tsconfig.test.json",
      },
    ],
    "\\.jsx?$": "babel-jest",
  },
  transformIgnorePatterns: [`node_modules/(?!(${esModules}))`],
};
