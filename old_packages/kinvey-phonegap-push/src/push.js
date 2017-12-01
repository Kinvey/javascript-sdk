const Promise = require('es6-promise');
const { EventEmitter } = require('events');
const url = require('url');
const { AuthType, RequestMethod, KinveyRequest, CacheRequest } = require('kinvey-request');
const { KinveyError, NotFoundError } = require('kinvey-errors');
const { User } = require('kinvey-user');
const { Client } = require('kinvey-client');
const { Device } = require('kinvey-phonegap-device');

const APP_DATA_NAMESPACE = process.env.KINVEY_DATASTORE_NAMESPACE || 'appdata';
const PUSH_NAMESPACE = process.env.KINVEY_PUSH_NAMESPACE || 'push';
const NOTIFICATION_EVENT = process.env.KINVEY_NOTIFICATION_EVENT || 'notification';
const DEVICE_COLLECTION = '__device';
let phonegapPush;

class PushNotification extends EventEmitter {
  get pathname() {
    return `/${PUSH_NAMESPACE}/${this.client.appKey}`;
  }

  get client() {
    if (!this._client) {
      return Client.sharedInstance();
    }

    return this._client;
  }

  set client(client) {
    if (!(client instanceof Client)) {
      throw new Error('client must be an instance of Client.');
    }

    this._client = client;
  }

  isSupported() {
    return Device.isPhoneGap() && (Device.isiOS() || Device.isAndroid());
  }

  onNotification(listener) {
    return this.on(NOTIFICATION_EVENT, listener);
  }

  onceNotification(listener) {
    return this.once(NOTIFICATION_EVENT, listener);
  }

  register(options = {}) {
    return Device.ready()
      .then(() => {
        if (this.isSupported() === false) {
          throw new KinveyError('Kinvey currently only supports push notifications on iOS and Android platforms.');
        }

        if (!global.device) {
          throw new KinveyError(
            'Cordova Device Plugin is not installed.',
            'Please refer to http://devcenter.kinvey.com/phonegap/guides/push#ProjectSetUp for help with setting up your project.'
          );
        }

        if (!global.PushNotification) {
          throw new KinveyError(
            'PhoneGap Push Notification Plugin is not installed.',
            'Please refer to http://devcenter.kinvey.com/phonegap/guides/push#ProjectSetUp for help with setting up your project.'
          );
        }

        return new Promise((resolve) => {
          if (phonegapPush) {
            return phonegapPush.unregister(() => {
              resolve();
            }, () => {
              resolve();
            });
          }

          return resolve();
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          phonegapPush = global.PushNotification.init(options);

          phonegapPush.on(NOTIFICATION_EVENT, (data) => {
            this.emit(NOTIFICATION_EVENT, data);
          });

          phonegapPush.on('registration', (data) => {
            resolve(data.registrationId);
          });

          phonegapPush.on('error', (error) => {
            reject(new KinveyError('An error occurred registering this device for push notifications.', error));
          });
        });
      })
      .then((deviceId) => {
        const user = User.getActiveUser(this.client);

        if (!deviceId) {
          throw new KinveyError('Unable to retrieve the device id to register this device for push notifications.');
        }

        if (!user && !options.userId) {
          throw new KinveyError(
            'Unable to register this device for push notifications.',
            'You must login a user or provide a userId to assign the device token.'
          );
        }

        const request = new KinveyRequest({
          method: RequestMethod.POST,
          url: url.format({
            protocol: this.client.apiProtocol,
            host: this.client.apiHost,
            pathname: `${this.pathname}/register-device`
          }),
          properties: options.properties,
          authType: user ? AuthType.Session : AuthType.Master,
          data: {
            platform: global.device.platform.toLowerCase(),
            framework: 'phonegap',
            deviceId: deviceId,
            userId: user ? undefined : options.userId
          },
          timeout: options.timeout,
          client: this.client
        });
        return request.execute()
          .then(() => deviceId);
      })
      .then((deviceId) => {
        const user = User.getActiveUser(this.client);
        const _id = user ? user._id : options.userId;

        const request = new CacheRequest({
          method: RequestMethod.PUT,
          url: url.format({
            protocol: this.client.apiProtocol,
            host: this.client.apiHost,
            pathname: `/${APP_DATA_NAMESPACE}/${this.client.appKey}/${DEVICE_COLLECTION}`
          }),
          data: {
            _id: _id,
            deviceId: deviceId
          },
          client: this.client
        });
        return request.execute()
          .then(() => deviceId);
      });
  }

  unregister(options = {}) {
    return Device.ready()
      .then(() => {
        if (this.isSupported() === false) {
          return null;
        }

        return new Promise((resolve) => {
          if (phonegapPush) {
            return phonegapPush.unregister(() => {
              resolve();
            }, () => {
              resolve();
            });
          }

          return resolve();
        });
      })
      .then(() => {
        const user = User.getActiveUser(this.client);
        const _id = user ? user._id : options.userId;

        if (!_id) {
          throw new KinveyError(
            'Unable to unregister this device for push notificaitons.',
            'You must login a user or provide a userId to unassign the device token.'
          );
        }

        const request = new CacheRequest({
          method: RequestMethod.GET,
          url: url.format({
            protocol: this.client.apiProtocol,
            host: this.client.apiHost,
            pathname: `/${APP_DATA_NAMESPACE}/${this.client.appKey}/${DEVICE_COLLECTION}/${_id}`
          }),
          client: this.client
        });
        return request.execute()
          .catch((error) => {
            if (error instanceof NotFoundError) {
              return {};
            }

            throw error;
          })
          .then((response) => {
            if (response) {
              return response.data;
            }

            return null;
          });
      })
      .then((device) => {
        const user = User.getActiveUser(this.client);
        const deviceId = device ? device.deviceId : undefined;

        if (!deviceId) {
          return null;
        }

        const request = new KinveyRequest({
          method: RequestMethod.POST,
          url: url.format({
            protocol: this.client.apiProtocol,
            host: this.client.apiHost,
            pathname: `${this.pathname}/unregister-device`
          }),
          properties: options.properties,
          authType: user ? AuthType.Session : AuthType.Master,
          data: {
            platform: global.device.platform.toLowerCase(),
            framework: 'phonegap',
            deviceId: deviceId,
            userId: user ? undefined : options.userId
          },
          timeout: options.timeout,
          client: this.client
        });
        return request.execute()
          .then(response => response.data);
      })
      .then(() => {
        const user = User.getActiveUser(this.client);
        const _id = user ? user._id : options.userId;

        const request = new CacheRequest({
          method: RequestMethod.DELETE,
          url: url.format({
            protocol: this.client.apiProtocol,
            host: this.client.apiHost,
            pathname: `/${APP_DATA_NAMESPACE}/${this.client.appKey}/${DEVICE_COLLECTION}/${_id}`
          }),
          client: this.client
        });

        return request.execute()
          .catch((error) => {
            if (error instanceof NotFoundError) {
              return {};
            }

            throw error;
          })
          .then(() => null);
      });
  }
}

// Export
exports.PushNotification = PushNotification;
exports.Push = new PushNotification();
