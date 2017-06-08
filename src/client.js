import url from 'url';
import assign from 'lodash/assign';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import uuidV4 from 'uuid/v4';

import { KinveyError } from 'src/errors';
import { Log, isDefined } from 'src/utils';
import { CacheRequest } from './request';

const defaultTimeout = process.env.KINVEY_DEFAULT_TIMEOUT || 60000;
let sharedInstance = null;

/**
 * The Client class stores information about your application on the Kinvey platform. You can create mutiple clients
 * to send requests to different environments on the Kinvey platform.
 */
export default class Client {
  /**
   * Creates a new instance of the Client class.
   *
   * @param {Object}    options                                            Options
   * @param {string}    [options.apiHostname='https://baas.kinvey.com']    Host name used for Kinvey API requests
   * @param {string}    [options.micHostname='https://auth.kinvey.com']    Host name used for Kinvey MIC requests
   * @param {string}    [options.appKey]                                   App Key
   * @param {string}    [options.appSecret]                                App Secret
   * @param {string}    [options.masterSecret]                             App Master Secret
   * @param {string}    [options.encryptionKey]                            App Encryption Key
   * @param {string}    [options.appVersion]                               App Version
   * @return {Client}                                                      An instance of the Client class.
   *
   * @example
   * var client = new Kinvey.Client({
   *   appKey: '<appKey>',
   *   appSecret: '<appSecret>'
   * });
   */
  constructor(options = {}) {
    options = assign({
      apiHostname: 'https://baas.kinvey.com',
      micHostname: 'https://auth.kinvey.com'
    }, options);

    if (options.apiHostname && isString(options.apiHostname)) {
      const apiHostnameParsed = url.parse(options.apiHostname);
      options.apiProtocol = apiHostnameParsed.protocol || 'https:';
      options.apiHost = apiHostnameParsed.host;
    }

    if (options.micHostname && isString(options.micHostname)) {
      const micHostnameParsed = url.parse(options.micHostname);
      options.micProtocol = micHostnameParsed.protocol || 'https:';
      options.micHost = micHostnameParsed.host;
    }

    /**
     * @type {string}
     */
    this.deviceId = uuidV4();

    /**
     * @type {string}
     */
    this.apiProtocol = options.apiProtocol;

    /**
     * @type {string}
     */
    this.apiHost = options.apiHost;

    /**
     * @type {string}
     */
    this.micProtocol = options.micProtocol;

    /**
     * @type {string}
     */
    this.micHost = options.micHost;

    /**
     * @type {?string}
     */
    this.appKey = options.appKey;

    /**
     * @type {?string}
     */
    this.appSecret = options.appSecret;

    /**
     * @type {?string}
     */
    this.masterSecret = options.masterSecret;

    /**
     * @type {?string}
     */
    this.encryptionKey = options.encryptionKey;

    /**
     * @type {?string}
     */
    this.appVersion = options.appVersion;

    /**
     * @type {?number}
     */
    this.defaultTimeout = isDefined(options.defaultTimeout) ? options.defaultTimeout : defaultTimeout;

    // Freeze the client class
    Object.freeze(this);
  }

  /**
   * Get the active user.
   */
  get activeUser() {
    return CacheRequest.getActiveUser(this);
  }

  /**
   * API host name used for Kinvey API requests.
   */
  get apiHostname() {
    return url.format({
      protocol: this.apiProtocol,
      host: this.apiHost
    });
  }

  /**
   * Mobile Identity Connect host name used for MIC requests.
   */
  get micHostname() {
    return url.format({
      protocol: this.micProtocol,
      host: this.micHost
    });
  }

  /**
   * The version of your app. It will sent with Kinvey API requests
   * using the X-Kinvey-Api-Version header.
   */
  get appVersion() {
    return this._appVersion;
  }

  /**
   * Set the version of your app. It will sent with Kinvey API requests
   * using the X-Kinvey-Api-Version header.
   *
   * @param  {String} appVersion  App version.
   */
  set appVersion(appVersion) {
    if (appVersion && !isString(appVersion)) {
      appVersion = String(appVersion);
    }

    this._appVersion = appVersion;
  }

  get defaultTimeout() {
    return this._defaultTimeout;
  }

  set defaultTimeout(timeout) {
    timeout = parseInt(timeout, 10);

    if (isNumber(timeout) === false || isNaN(timeout)) {
      throw new KinveyError('Invalid timeout. Timeout must be a number.');
    }

    if (timeout < 0) {
      Log.info(`Default timeout is less than 0. Setting default timeout to ${defaultTimeout}ms.`);
      timeout = defaultTimeout;
    }

    this._defaultTimeout = timeout;
  }

  /**
   * Returns an object containing all the information for this Client.
   *
   * @return {Object} Object
   */
  toPlainObject() {
    return {
      deviceId: this.deviceId,
      apiHostname: this.apiHostname,
      apiProtocol: this.apiProtocol,
      apiHost: this.apiHost,
      micHostname: this.micHostname,
      micProtocol: this.micProtocol,
      micHost: this.micHost,
      appKey: this.appKey,
      appSecret: this.appSecret,
      masterSecret: this.masterSecret,
      encryptionKey: this.encryptionKey,
      appVersion: this.appVersion
    };
  }

  /**
   * Initializes the Client class by creating a new instance of the
   * Client class and storing it as a shared instance. The returned promise
   * resolves with the shared instance of the Client class.
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
   */
  static initialize(options) {
    const client = new Client(options);
    sharedInstance = client;
    return CacheRequest.loadActiveUser(client)
      .then(() => client);
  }

  /**
   * Returns the shared instance of the Client class used by the SDK.
   *
   * @throws {KinveyError} If a shared instance does not exist.
   *
   * @return {Client} The shared instance.
   *
   * @example
   * var client = Kinvey.Client.sharedInstance();
   */
  static sharedInstance() {
    if (isDefined(sharedInstance) === false) {
      throw new KinveyError('You have not initialized the library. ' +
        'Please call Kinvey.init() to initialize the library.');
    }

    return sharedInstance;
  }
}
