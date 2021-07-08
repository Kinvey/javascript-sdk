jest.mock('react-native-push-notification');
jest.mock('kinvey-js-sdk/lib/http/request');

import PushNotification from 'react-native-push-notification';
import { KinveyHttpRequest } from 'kinvey-js-sdk/lib/http/request';
import { initialize } from '../src/init';
import { register, unregister } from '../src/push';

beforeAll(() => {
  initialize({
    appKey: 'kid_push_test',
    appSecret: 'secret_push_test',
  });
});

describe('register()', () => {
  test('should configure react native push notification module', async () => {
    const options = {
      senderID: 'senderId',
      permissions: {
        alert: true,
        badge: true,
        sound: true
      },
      popInitialNotification: true,
      onRegister: () => {},
      onNotification: () => {}
    };
    await register(options);
    // @ts-ignore
    const argsReceived = PushNotification.configure.mock.calls[0][0];
    // expect(argsReceived.senderID).toEqual(options.senderID);
    expect(argsReceived.permissions).toEqual(options.permissions);
    expect(argsReceived.popInitialNotification).toEqual(options.popInitialNotification);
    expect(argsReceived.onNotification).toEqual(options.onNotification);
  });

  test('should register the device with Kinvey', async () => {
    await register();
    expect(KinveyHttpRequest).toBeCalledWith({
      method: 'POST',
      auth: 'Session',
      url: 'https://baas.kinvey.com/push/kid_push_test/register-device',
      body: {
        platform: 'macos',
        framework: 'react-native',
        // @ts-ignore
        deviceId: 'push_test_token',
        service: 'firebase'
      }
    });
  });

  test('should return device token', async () => {
    const token = await register();
    // @ts-ignore
    expect(token).toEqual('push_test_token');
  });

  test('should call onRegister callback', async () => {
    const onRegister = jest.fn();
    await register({ onRegister });
    // @ts-ignore
    expect(onRegister).toBeCalledWith({
      os: 'macos',
      token: 'push_test_token'
    });
  });
});

describe('unregister()', () => {
  test('should unregister the device with Kinvey', async () => {
    await unregister();
    expect(KinveyHttpRequest).toBeCalledWith({
      method: 'POST',
      auth: 'Session',
      url: 'https://baas.kinvey.com/push/kid_push_test/register-device',
      body: {
        platform: 'macos',
        framework: 'react-native',
        // @ts-ignore
        deviceId: 'push_test_token',
        service: 'firebase'
      }
    });
  });

  test('should unregister react native push notification module', async () => {
    await unregister();
    expect(PushNotification.unregister).toBeCalled();
  });
});
