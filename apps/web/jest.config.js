/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/test/**/*.spec.ts?(x)'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^@fin/shared$': '<rootDir>/../../packages/shared/src/index.ts', '^@fin/api-client$': '<rootDir>/../../packages/api-client/src/index.ts', '\\.css$': '<rootDir>/test/empty.js' },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
