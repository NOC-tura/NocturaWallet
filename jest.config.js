module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.css$': '<rootDir>/__mocks__/fileMock.js',
    '^@noble/curves/(.+)\\.js$': '<rootDir>/node_modules/@noble/curves/$1.js',
    '^@noble/curves/(.+)$': '<rootDir>/node_modules/@noble/curves/$1',
    '^@noble/ciphers/(.+)\\.js$': '<rootDir>/node_modules/@noble/ciphers/$1.js',
    '^@noble/ciphers/(.+)$': '<rootDir>/node_modules/@noble/ciphers/$1',
    '^@noble/hashes/(.+)\\.js$': '<rootDir>/node_modules/@noble/hashes/$1.js',
    '^@noble/hashes/(.+)$': '<rootDir>/node_modules/@noble/hashes/$1',
    '^micro-key-producer/bls\\.js$': '<rootDir>/node_modules/micro-key-producer/bls.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|nativewind|react-native-css-interop|@scure/bip39|@scure/base|@scure/bip32|@noble/hashes|@noble/curves|@noble/ciphers|micro-key-producer)/)',
  ],
};
