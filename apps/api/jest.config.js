/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { ignoreCodes: [151001] } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/../web/src/$1', '^@fin/shared$': '<rootDir>/../../packages/shared/src/index.ts', '^@fin/api-client$': '<rootDir>/../../packages/api-client/src/index.ts' },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30000,
};
