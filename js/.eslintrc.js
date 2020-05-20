module.exports = {
    ignorePatterns: ["lib/**", "node_modules/**"],
    env: {
        browser: true,
        es6: true,
        commonjs: true
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking"
    ],
    parserOptions: {
        project: "tsconfig.eslint.json",
    },
    plugins: [
        "@typescript-eslint",
        "@typescript-eslint/tslint",
    ],
    rules: {
        "@typescript-eslint/array-type": [
            "error",
            {
                default: "array-simple",
            },
        ],
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        '@typescript-eslint/explicit-function-return-type': 'off',
        "@typescript-eslint/explicit-member-accessibility": ["error",
            {
                accessibility: "no-public",
            },
        ],
        "@typescript-eslint/indent": ["error", 2],
        "@typescript-eslint/no-explicit-any": "off",
        '@typescript-eslint/no-namespace': 'off',
        "@typescript-eslint/no-unused-expressions": "error",
        '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/quotes": [
            "error",
            "double",
            {
                avoidEscape: true,
                allowTemplateLiterals: true
            },
        ],
        "@typescript-eslint/semi": ["error"],
        "@typescript-eslint/unified-signatures": "error",
        "arrow-body-style": "error",
        "arrow-parens": [
            "error",
            "always",
        ],
        "brace-style": [
            "error",
            "1tbs",
        ],
        "comma-dangle": [
            "error",
            "always-multiline",
        ],
        "complexity": "off",
        "constructor-super": "error",
        "curly": "error",
        "eol-last": "error",
        "eqeqeq": [
            "error",
            "smart",
        ],
        "guard-for-in": "error",
        "id-blacklist": [
            "error",
            "any",
            "Number",
            "number",
            "String",
            "string",
            "Boolean",
            "boolean",
            "Undefined",
            "undefined",
        ],
        "id-match": "error",
        "max-classes-per-file": [
            "error",
            1,
        ],
        "max-len": [
            "error",
            {
                code: 200,
            },
        ],
        "new-parens": "error",
        "no-bitwise": "error",
        "no-caller": "error",
        "no-cond-assign": "error",
        "no-console": "error",
        "no-debugger": "error",
        "no-empty": "error",
        "no-eval": "error",
        "no-fallthrough": "off",
        "no-invalid-this": "off",
        "no-multiple-empty-lines": "error",
        "no-new-wrappers": "error",
        "no-shadow": [
            "error",
            {
                hoist: "all",
            },
        ],
        "no-throw-literal": "error",
        "no-trailing-spaces": "error",
        "no-undef-init": "error",
        "no-underscore-dangle": "error",
        "no-unsafe-finally": "error",
        "no-unused-labels": "error",
        "object-shorthand": "error",
        "one-var": [
            "error",
            "never",
        ],
        "prefer-arrow-callback": "error",
        "quote-props": [
            "error",
            "consistent-as-needed",
        ],
        "radix": "error",
        "space-before-function-paren": [
            "error",
            {
                anonymous: "never",
                asyncArrow: "always",
                named: "never",
            },
        ],
        "spaced-comment": [
            "off",
            "always",
            {
                markers: [
                    "/",
                ],
            },
        ],
        "use-isnan": "error",
        "valid-typeof": "off",
        "@typescript-eslint/tslint/config": [
            "error",
            {
                rules: {
                    "import-spacing": true,
                    "object-literal-sort-keys": true,
                    "whitespace": [
                        true,
                        "check-branch",
                        "check-decl",
                        "check-operator",
                        "check-separator",
                        "check-type",
                        "check-typecast",
                    ],
                },
            },
        ],

        // disabled to avoid conflict with @typescript-eslint rules
        "quotes": "off",
        "semi": "off"
    },
};
