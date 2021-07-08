const config = {
  preset: 'react-native',
  collectCoverage: true,
  moduleDirectories: ['node_modules', 'src', 'test'],
  transform: {
    '^.+\\.js$': '<rootDir>/node_modules/react-native/jest/preprocessor.js',
    '^.+\\.tsx?$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsConfigFile: 'tsconfig.jest.json'
    }
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testRegex: '(/test/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: ['node_modules/(?!(jest-)?react-native|@react-native)'],
  coveragePathIgnorePatterns: ['/node_modules/', '/jest', '/demo'],
  testPathIgnorePatterns: ['/node_modules/', '/demo']
};

module.exports = config;
