const js = require("@eslint/js");
const { FlatCompat } = require("@eslint/eslintrc");

const { ignorePatterns = [], ...eslintrc } = require("./.eslintrc.js");
const ignores = ignorePatterns.flatMap(pattern =>
  pattern.includes("/") ? [pattern] : [pattern, `**/${pattern}`]
);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { ignores },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  ...compat.config(eslintrc),
];
