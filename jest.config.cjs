/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>'],
  testMatch: ['**/?(*.)+(spec|test).ts', '<rootDir>/test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: false,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/upstream-puffscript/'],
  maxWorkers: 1
};
