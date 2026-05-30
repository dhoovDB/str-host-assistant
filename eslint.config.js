import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // Module-top-level `process.env` reads break client hydration silently —
      // they execute at module load, leak into the client bundle via the route
      // tree's type-import chain, and pre-empt React's event-handler attach.
      // The 2026-05-16 hydration incident is the canonical case. Lazy getters
      // (`export function getX() { return process.env.X; }`) move the read to
      // first call, which only happens server-side. Convention in this repo:
      // env loaders are FunctionDeclarations, not arrow consts — so this rule
      // also rejects `export const getX = () => process.env.X` even though
      // that's technically lazy. See CLAUDE.md "Env reads must be lazy" and
      // ROADMAP decision log 2026-05-16 / 2026-05-29.
      //
      // Known gap: a destructured access (`const { env } = process; const X
      // = env.FOO;`) bypasses the selector. That pattern doesn't appear in
      // this codebase; if it ever does, extend the selector with a second
      // entry blocking `VariableDeclarator[id.name='env'][init.name='process']`.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration) MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Module-top-level `process.env` read leaks into the client bundle and breaks hydration silently (decision log 2026-05-16). Wrap in a function so the read happens on first call: `export function getX() { return process.env.X; }`. See CLAUDE.md 'Env reads must be lazy' and `src/config/property.ts` for the pattern.",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
