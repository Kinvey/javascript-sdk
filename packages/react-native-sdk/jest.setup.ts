import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

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
