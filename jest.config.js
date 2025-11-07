module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File extensions to process
  moduleFileExtensions: ['js', 'gs'],
  
  // Transform .gs files using babel preset
  transform: {
    '^.+\\.gs$': 'babel-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'server/**/*.gs',
    'client/**/*.gs',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Error on unhandled promises
  errorOnDeprecated: true
};