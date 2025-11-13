import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "dist/**", ".turbo/**"]
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use apiFetch from @/utils/apiFetch instead of native fetch in client components. Native fetch doesn't include authentication headers. If you really need native fetch (e.g., in API routes), add: // eslint-disable-next-line no-restricted-globals"
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            {
              "name": "firebase-admin/firestore",
              "message": "Direct Firestore access should only be used in repositories (src/repositories/). Use repository classes instead to maintain the repository pattern."
            },
            {
              "name": "firebase/firestore",
              "message": "Direct Firestore access should only be used in repositories (src/repositories/). Use repository classes instead to maintain the repository pattern."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/app/api/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}", "src/utils/**/*.{ts,tsx}", "src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": "off"
    }
  },
  {
    files: ["src/repositories/**/*.{ts,tsx}", "src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off"
    }
  }
];
