module.exports = {
  transform: {
      "^.+\\.ts?$": "ts-jest",
      "^.+\\.js$": "babel-jest",
      ".+\\.(css|styl|less|sass|scss)$": "jest-transform-css"
  },
  "moduleNameMapper":{
       "\\.(css|less|sass|scss)$": "<rootDir>/jupyterfs/tests/js/styleMock.js",
       "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/jupyterfs/tests/js/fileMock.js"
  },
  preset: 'ts-jest',
  "transformIgnorePatterns": [
    "/node_modules/(?!@jupyterlab)"
  ]
};
