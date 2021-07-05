function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const InAppBrowserMock = {
  isAvailable: jest.fn().mockReturnValue(true),
  openAuth: jest.fn().mockImplementation(url => delay(100).then(() => ({ type: 'success', url }))), // Wait for the event handlers to be attached
}

jest.mock('react-native-inappbrowser-reborn', () => ({
  InAppBrowser: InAppBrowserMock
}));

import { EventEmitter } from 'events';
import { open } from '../src/popup';

describe('popup for MIC login', () => {
  const redirectUrl = 'http://redirect.com';
  const testUrl = `http://example.com?redirect_uri=${redirectUrl}`;

  describe('open()', () => {
    test('should throw an error if in-app browser not available', async () => {
      InAppBrowserMock.isAvailable.mockReturnValueOnce(false);
      
      await expect(open(testUrl)).rejects.toEqual(new Error('In-app browser not available.'));
    });

    test('should return a popup window', async () => {
      const popupPromise = open(testUrl);
      expect(popupPromise instanceof Promise).toBe(true);

      const popup = await popupPromise;
      expect(popup instanceof EventEmitter).toBe(true);
      expect(popup.isClosed()).toBe(false);
    });

    test('should emit loaded event on success (iOS scenario)', async () => {
      const handlerMock = jest.fn();
      await open(testUrl).then(popup => popup.onLoaded(handlerMock));

      await delay(100);
      expect(handlerMock.mock.calls.length).toBe(1);
      expect(handlerMock.mock.calls[0][0]).toEqual({ url: testUrl });
    });

    test('should emit loaded event on dismiss and deeplink callback (Android scenario)', async () => {
      InAppBrowserMock.openAuth.mockReturnValueOnce(delay(100).then(() => ({ type: 'dismiss' })));

      const handlerMock = jest.fn();
      const popup = await open(testUrl);
      popup.onLoaded(handlerMock);

      // Simulate an external deeplink callback
      await delay(100);
      popup.handleDeeplinkCallback({ url: redirectUrl });

      expect(handlerMock.mock.calls.length).toBe(1);
      expect(handlerMock.mock.calls[0][0]).toEqual({ url: redirectUrl });
    });

    test('should not emit loaded event on dismiss and deeplink callback to unexpected url', async () => {
      InAppBrowserMock.openAuth.mockReturnValueOnce(delay(100).then(() => ({ type: 'dismiss' })));

      const handlerMock = jest.fn();
      const popup = await open(testUrl);
      popup.onLoaded(handlerMock);

      // Simulate an external deeplink callback
      await delay(100);
      popup.handleDeeplinkCallback({ url: 'http://fakeurl.com' });

      expect(handlerMock.mock.calls.length).toBe(0);
    });

    test('should not emit loaded event on success but without url in the result', async () => {
      InAppBrowserMock.openAuth.mockReturnValueOnce(delay(100).then(() => ({ type: 'success' })));

      const handlerMock = jest.fn();
      await open(testUrl).then(popup => popup.onLoaded(handlerMock));

      await delay(100);
      expect(handlerMock.mock.calls.length).toBe(0);
    });

    test('should not emit loaded event on dismiss', async () => {
      InAppBrowserMock.openAuth.mockReturnValueOnce(delay(100).then(() => ({ type: 'dismiss' })));

      const handlerMock = jest.fn();
      await open(testUrl).then(popup => popup.onLoaded(handlerMock));

      await delay(100);
      expect(handlerMock.mock.calls.length).toBe(0);
    });

    test('should not emit loaded event twice on success and deeplink callback', async () => {
      const handlerMock = jest.fn();
      const popup = await open(testUrl);
      popup.onLoaded(handlerMock);

      // Simulate an external deeplink callback
      await delay(100);
      popup.handleDeeplinkCallback({ url: redirectUrl }); // Should return immediately because request already redirected.

      expect(handlerMock.mock.calls.length).toBe(1);
      expect(handlerMock.mock.calls[0][0]).toEqual({ url: testUrl });
    });

    test('should emit error event on error', async () => {
      InAppBrowserMock.openAuth.mockReturnValueOnce(delay(100).then(() => Promise.reject(new Error('test error'))));

      const handlerMock = jest.fn();
      await open(testUrl).then(popup => popup.onError(handlerMock));

      await delay(100);
      expect(handlerMock.mock.calls.length).toBe(1);
      expect(handlerMock.mock.calls[0][0]).toEqual(new Error('test error'));
    });
  });

  describe('close()', () => {
    test('should mark the popup as closed', async () => {
      const popup = await open(testUrl);
      expect(popup.isClosed()).toBe(false);
      
      await popup.close();
      expect(popup.isClosed()).toBe(true);
    });

    test('should emit closed event', async () => {
      const popup = await open(testUrl);
      const handlerMock = jest.fn();
      popup.onClosed(handlerMock);

      await popup.close();
      expect(handlerMock.mock.calls.length).toBe(1);
    });
  })
});
