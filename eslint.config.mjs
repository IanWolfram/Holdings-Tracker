// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // ── typescript-eslint recommended (no-unsafe-*, explicit-any, unused-vars…) ─
  ...tseslint.configs.recommended,

  // ── Project-wide overrides ─────────────────────────────────────────────────
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // ── TypeScript ─────────────────────────────────────────────────────────
      // Warn on `any`; use `unknown` for truly untyped values
      "@typescript-eslint/no-explicit-any": "warn",
      // Enforce `import type` for import-only tokens — explicit and tree-shakeable
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      // Unused vars; prefix with _ to opt out intentionally
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // Allow empty catch blocks (common in fallback/try-parse patterns here)
      "@typescript-eslint/no-empty-object-type": "warn",

      // ── General JS/TS style ────────────────────────────────────────────────
      // Prefer const; catches let declarations that never reassign
      "prefer-const": "warn",
      // No var — always use const/let
      "no-var": "error",
      // Strict equality; == with coercion is a frequent bug source
      "eqeqeq": ["error", "always", { null: "ignore" }],
      // Allow warn/error/info for intentional server-side logging; flag console.log
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],

      // ── React Hooks ────────────────────────────────────────────────────────
      // Missing deps = stale closure bugs; extra deps = unnecessary re-renders
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // ── Exclude generated and non-source files ─────────────────────────────────
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",
      "world-vault/**",
      "**/*.mjs",
    ],
  }
);
