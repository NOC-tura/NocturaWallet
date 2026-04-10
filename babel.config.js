module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    ...(process.env.NODE_ENV === 'test' ? [] : ['nativewind/babel']),
  ],
  plugins:
    process.env.NODE_ENV === 'test'
      ? []
      : [
          'react-native-reanimated/plugin', // MUST be last
        ],
};
