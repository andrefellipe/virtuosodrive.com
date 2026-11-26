// Tool configuration (the one kind of plain JavaScript file the project allows).
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const SQL_KEYWORDS =
  "/\\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\\b/";

// Rules that keep the project's "never" list out of the code (security design S6, S7).
const forbiddenSyntax = [
  {
    selector: `TemplateLiteral[expressions.length>0]:has(TemplateElement[value.raw=${SQL_KEYWORDS}])`,
    message:
      "Do not build SQL from template text. Write the statement with $1 placeholders and pass the values separately.",
  },
  {
    selector: `BinaryExpression[operator='+']:has(Literal[value=${SQL_KEYWORDS}])`,
    message:
      "Do not build SQL by joining text. Write the statement with $1 placeholders and pass the values separately.",
  },
  {
    selector:
      "CallExpression[callee.property.name='query'] > TemplateLiteral.arguments:first-child[expressions.length>0]",
    message:
      "Do not pass a template with values in it to query(). Use placeholders.",
  },
  {
    selector:
      "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
    message:
      "Never assign to innerHTML or outerHTML. Use textContent or React.",
  },
  {
    selector:
      "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=/^(pg|pg-pool|node-pg-migrate)$/]",
    message:
      "The database is never replaced by a stand-in. Use the real PostgreSQL from Testcontainers.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "app/**",
      "aidlc/**",
      ".claude/**",
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "infra/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...forbiddenSyntax],
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["web/**/*.ts", "web/**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "19.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "react/no-danger": "error",
      "react/no-danger-with-children": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Command-line tools report through the console; the edge function's only log is console.log.
    files: ["scripts/**/*.ts", "edge/src/handler.ts", "e2e/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
