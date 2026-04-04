const store = new Map<string, {username: string; password: string}>();

const Keychain = {
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    BIOMETRY_ANY: 'BiometryAny',
    USER_PRESENCE: 'UserPresence',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SECURE_HARDWARE',
    SECURE_SOFTWARE: 'SECURE_SOFTWARE',
  },

  setGenericPassword: jest.fn(
    async (username: string, password: string, options?: {service?: string}) => {
      const key = options?.service ?? 'default';
      store.set(key, {username, password});
      return true;
    },
  ),

  getGenericPassword: jest.fn(async (options?: {service?: string}) => {
    const key = options?.service ?? 'default';
    const entry = store.get(key);
    if (!entry) return false;
    return entry;
  }),

  resetGenericPassword: jest.fn(async (options?: {service?: string}) => {
    const key = options?.service ?? 'default';
    store.delete(key);
    return true;
  }),

  getSupportedBiometryType: jest.fn(async () => 'FaceID'),

  __reset() {
    store.clear();
    Keychain.setGenericPassword.mockClear();
    Keychain.getGenericPassword.mockClear();
    Keychain.resetGenericPassword.mockClear();
    Keychain.getSupportedBiometryType.mockClear();
  },
};

export default Keychain;
