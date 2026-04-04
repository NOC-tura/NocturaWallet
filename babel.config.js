module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins:
    process.env.NODE_ENV === 'test'
      ? []
      : [
          'nativewind/babel',
          'react-native-reanimated/plugin', // MUST be last
        ],
};
