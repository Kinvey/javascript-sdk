import { Promise } from 'es6-promise';
import url from 'url';
import { Log, isDefined } from 'src/utils';
import { Client, ClientConfig } from './client';
import CustomEndpoint from './endpoint';
import { Query } from '../query';
import Aggregation from './aggregation';
import DataStore, { DataStoreType, FileStore, SyncOperation } from './datastore';
import { Acl, Metadata, User } from './entity';
import { AuthorizationGrant } from './identity';
import { AuthType, CacheRack, NetworkRack, Rack, RequestMethod, KinveyRequest } from './request';

const appdataNamespace = process.env.KINVEY_DATASTORE_NAMESPACE || 'appdata';

/**
 * The Kinvey class is used as the entry point for the Kinvey JavaScript SDK.
 */
export const Kinvey = {
  /**
   * Returns the shared instance of the Client class used by the SDK.
   *
   * @throws {KinveyError} If a shared instance does not exist.
   *
   * @return {Client} The shared instance.
   *
   * @example
   * var client = Kinvey.client;
   */
  get client() {
    return Client.sharedInstance();
  },

  /**
   * The version of your app. It will sent with Kinvey API requests
   * using the X-Kinvey-Api-Version header.
   *
   * @return {String} The version of your app.
   *
   * @example
   * var appVersion = Kinvey.appVersion;
   */
  get appVersion() {
    return this.client.appVersion;
  },

  /**
   * Set the version of your app. It will sent with Kinvey API requests
   * using the X-Kinvey-Api-Version header.
   *
   * @param  {String} appVersion  App version.
   *
   * @example
   * Kinvey.appVersion = '1.0.0';
   * // or
   * Kinvey.appVersion = 'v1';
   */
  set appVersion(appVersion) {
    this.client.appVersion = appVersion;
  },

  /**
   * Initializes the SDK with your app's information. The SDK is initialized when the returned
   * promise resolves.
   *
   * @param {Object}    options                                            Options
   * @param {string}    [options.apiHostname='https://baas.kinvey.com']    Host name used for Kinvey API requests
   * @param {string}    [options.micHostname='https://auth.kinvey.com']    Host name used for Kinvey MIC requests
   * @param {string}    [options.appKey]                                   App Key
   * @param {string}    [options.appSecret]                                App Secret
   * @param {string}    [options.masterSecret]                             App Master Secret
   * @param {string}    [options.encryptionKey]                            App Encryption Key
   * @param {string}    [options.appVersion]                               App Version
   * @return {Promise}                                                     A promise.
   *
   * @throws  {KinveyError}  If an `options.appKey` is not provided.
   * @throws  {KinveyError}  If neither an `options.appSecret` or `options.masterSecret` is provided.
   *
   * @example
   * Kinvey.initialize({
   *   appKey: 'appKey',
   *   appSecret: 'appSecret'
   * }).then(function(client) {
   *   // ...
   * }).catch(function(error) {
   *   // ...
   * });
   */
  initialize(config: ClientConfig): Promise<any> {
    // Check that an appKey or appId was provided
    if (isDefined(config.appKey) === false) {
      return Promise.reject(
        new KinveyError('No App Key was provided. ' +
          'Unable to init the SDK without an App Key.')
      );
    }

    // Check that an appSecret or masterSecret was provided
    if (isDefined(config.appSecret) === false && isDefined(config.masterSecret) === false) {
      return Promise.reject(
        new KinveyError('No App Secret or Master Secret was provided. ' +
          'Unable to init the SDK without an App Key.')
      );
    }

    // Initialize the client
    return Client.initialize(config)
      .then(() => {
        // Return the active user
        return User.getActiveUser();
      });
  },

  /**
   * Pings the Kinvey API service.
   *
   * @returns {Promise<Object>} The response from the ping request.
   *
   * @example
   * var promise = Kinvey.ping().then(function(response) {
   *   console.log('Kinvey Ping Success. Kinvey Service is alive, version: ' + response.version + ', response: ' + response.kinvey);
   * }).catch(function(error) {
   *   console.log('Kinvey Ping Failed. Response: ' + error.description);
   * });
   */
  ping(client = Client.sharedInstance()): Promise<any> {
    const request = new KinveyRequest({
      method: RequestMethod.GET,
      authType: AuthType.All,
      url: url.format({
        protocol: client.apiProtocol,
        host: client.apiHost,
        pathname: `${appdataNamespace}/${client.appKey}`
      })
    });

    return request.execute()
      .then(response => response.data);
  }
}
