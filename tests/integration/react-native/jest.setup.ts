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
