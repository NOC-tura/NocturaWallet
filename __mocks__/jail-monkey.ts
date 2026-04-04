const JailMonkey = {
  isJailBroken: jest.fn(() => false),
  isDebuggedMode: jest.fn(() => false),
  canMockLocation: jest.fn(() => false),
  isOnExternalStorage: jest.fn(() => false),
  hookDetected: jest.fn(() => false),

  __setJailbroken(value: boolean) {
    JailMonkey.isJailBroken.mockReturnValue(value);
  },

  __reset() {
    JailMonkey.isJailBroken.mockReturnValue(false);
    JailMonkey.isDebuggedMode.mockReturnValue(false);
    JailMonkey.canMockLocation.mockReturnValue(false);
    JailMonkey.isOnExternalStorage.mockReturnValue(false);
    JailMonkey.hookDetected.mockReturnValue(false);
  },
};

export default JailMonkey;
