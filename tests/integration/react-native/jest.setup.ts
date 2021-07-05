import dotenv from 'dotenv';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Init environment
dotenv.config({ path: '../.env' });

// Setup mocks
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@react-native-community/push-notification-ios', () => ({
  addEventListener: jest.fn(),
  requestPermissions: jest.fn(() => Promise.resolve()),
  getInitialNotification: jest.fn(() => Promise.resolve())
}));

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
