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
    // Route all @solana/web3.js imports to the manual mock so native bindings
    // (secp256k1, ed25519) are never loaded in the Jest/Node environment.
    '^@solana/web3\\.js$': '<rootDir>/__mocks__/@solana/web3.js',
    // react-native-config uses ESM syntax that Jest cannot parse; use a CJS mock.
    '^react-native-config$': '<rootDir>/__mocks__/react-native-config.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  coverageThreshold: {
    global: {
      lines: 60,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|nativewind|react-native-css-interop|@scure/bip39|@scure/base|@scure/bip32|@noble/hashes|@noble/curves|@noble/ciphers|micro-key-producer|@solana/web3\\.js|poseidon-lite)/)',
  ],
};
