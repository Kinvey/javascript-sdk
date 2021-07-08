import RNPushNotification, { PushNotificationOptions } from 'react-native-push-notification';
import {
  formatKinveyBaasUrl,
  KinveyHttpRequest,
  HttpRequestMethod,
  KinveyHttpAuth,
  KinveyBaasNamespace
} from 'kinvey-js-sdk/lib/http';
import isFunction from 'lodash/isFunction';

export { PushNotificationOptions };

async function registerDeviceWithKinvey(os: string, token: string): Promise<void> {
  const requestOptions = {
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.Session,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.Push, '/register-device'),
    body: {
      platform: os.toLowerCase(),
      framework: 'react-native',
      deviceId: token,
      service: 'firebase'
    }
  };

  await new KinveyHttpRequest(requestOptions).execute();
}

export async function register(options: PushNotificationOptions = {}): Promise<string> {
  const promise = new Promise<string>((resolve, reject): void => {
    RNPushNotification.configure({
      permissions: options.permissions,
      popInitialNotification: options.popInitialNotification,
      onNotification: options.onNotification,

      async onRegister(info) {
        try {
          await registerDeviceWithKinvey(info.os, info.token);
          if (isFunction(options.onRegister)) {
            options.onRegister(info);
          }

          resolve(info.token);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  return promise;
}

async function unregisterDeviceWithKinvey(os: string, token: string): Promise<void> {
  const request = new KinveyHttpRequest({
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.Session,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.Push, '/unregister-device'),
    body: {
      platform: os.toLowerCase(),
      framework: 'react-native',
      deviceId: token,
      service: 'firebase'
    }
  });
  await request.execute();
}

export async function unregister(): Promise<string> {
  const promise = new Promise<string>((resolve, reject): void => {
    RNPushNotification.unregister();
    RNPushNotification.configure({
      async onRegister(info) {
        try {
          unregisterDeviceWithKinvey(info.os, info.token);
          RNPushNotification.unregister();
          resolve(info.token);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  return promise;
}
