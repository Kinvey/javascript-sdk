import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const mockSecureStore = new Map();

jest.mock('react-native-keychain', () => ({
  SECURITY_LEVEL_ANY: "MOCK_SECURITY_LEVEL_ANY",
  SECURITY_LEVEL_SECURE_SOFTWARE: "MOCK_SECURITY_LEVEL_SECURE_SOFTWARE",
  SECURITY_LEVEL_SECURE_HARDWARE: "MOCK_SECURITY_LEVEL_SECURE_HARDWARE",
  setGenericPassword: async (key, value) => {
    mockSecureStore.set(key, value);
    return true;
  },
  getGenericPassword: async ({ service }) => {
    return { password: mockSecureStore.get(service) };
  },
  resetGenericPassword: async ({ service }) => mockSecureStore.delete(service),
}));

jest.mock('react-native-push-notification', () => ({
  configure: jest.fn((options) => options.onRegister({
    os: 'macos',
    token: 'push_test_token'
  })),
  unregister: jest.fn()
}));

jest.mock('@react-native-community/push-notification-ios', () => {
  return {
    addEventListener: jest.fn(),
    requestPermissions: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve())
  };
});

jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => ({
  getConstants: () => ({
    isTesting: true
  })
}));
