// Flat ESLint config for the whole mobile workspace. Fast (non-type-aware) TypeScript linting plus
// prettier-compat (formatting is Prettier's job, not ESLint's). Generated code and build output are
// ignored. Run with `pnpm lint`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/web-build/**",
      "**/src/generated/**",
      "**/*.gen.ts",
      "**/expo-env.d.ts",
      "**/next-env.d.ts",
      "**/nativewind-env.d.ts",
      "**/babel.config.js",
      "**/metro.config.js",
      "**/*.config.js",
      "**/tailwind-preset.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  prettier,
);
