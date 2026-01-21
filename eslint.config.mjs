import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import globals from "globals/index.js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";

const config = [...next, ...nextCoreWebVitals, ...nextTypescript, {
  ignores: [".next/**", "node_modules/**"],
}, {
  files: ["**/*.{js,mjs,cjs,ts,tsx}"],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    react: reactPlugin,
  },
  rules: {
    "react/no-unescaped-entities": "off",
    "@next/next/no-img-element": "off",
  },
}, ...tseslint.configs.recommended.map((config) => ({
  ...config,
  files: ["**/*.{ts,tsx}"],
  rules: {
    ...config.rules,
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-require-imports": "off",
  },
}))];

export default config;
