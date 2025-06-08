module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'next/core-web-vitals'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'template-curly-spacing': 'warn',
    'arrow-spacing': 'warn',
    'no-multiple-empty-lines': 'warn',
    'eol-last': 'warn',
    'comma-dangle': 'off',
    'quotes': 'off',
    'semi': 'off',
    'no-useless-escape': 'off',
    'no-useless-catch': 'off'
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        'quotes': ['error', 'single'],
        'semi': ['error', 'always']
      }
    },
    {
      files: ['*.ts', '*.tsx', '*.jsx'],
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off'
      }
    },
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
}; 