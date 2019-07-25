import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isEmpty from 'lodash/isEmpty';
import { KinveyError } from './errors';

export interface KinveySDKConfig {
  appKey: string;
  appSecret: string;
  appVersion?: string;
  instanceId?: string;
  defaultTimeout?: number;
  encryptionKey?: string;
  apiVersion?: number;
}

const config: KinveySDKConfig = {
  appKey: '',
  appSecret: '',
  defaultTimeout: 60000, // 1 minute
  apiVersion: 4
};

export function getAppKey(): string {
  if (isEmpty(config.appKey)) {
    throw new KinveyError('An appKey has not been set. Please initialize the SDK.');
  }
  return config.appKey;
}

export function setAppKey(appKey: string): void {
  if (!isString(appKey)) {
    throw new KinveyError('The appKey must be a string.');
  }
  config.appKey = appKey;
}

export function getAppSecret(): string {
  if (isEmpty(config.appSecret)) {
    throw new KinveyError('An appSecret has not been set. Please initialize the SDK.');
  }
  return config.appSecret;
}

export function setAppSecret(appSecret: string): void {
  if (!isString(appSecret)) {
    throw new KinveyError('The appSecret must be a string.');
  }
  config.appSecret = appSecret;
}

export function getInstanceId(): string | undefined {
  return config.instanceId;
}

export function setInstanceId(instanceId: string): void {
  if (!isString(instanceId)) {
    throw new KinveyError('The instanceId must be a string.');
  }
  config.instanceId = instanceId;
}

export function getDefaultTimeout(): number {
  return config.defaultTimeout;
}

export function setDefaultTimeout(timeout: number): void {
  if (!isNumber(timeout)) {
    throw new KinveyError('The default timeout must be a number.', `${timeout} was provided as a default timeout.`);
  }
  config.defaultTimeout = timeout;
}

export function getEncryptionKey(): string | undefined {
  return config.encryptionKey;
}

export function setEncryptionKey(encryptionKey: string): void {
  if (!isString(encryptionKey)) {
    throw new KinveyError('The encryptionKey must be a string.');
  }
  config.encryptionKey = encryptionKey;
}

export function getApiVersion(): number {
  return config.apiVersion;
}

export function setApiVersion(version: number): void {
  if (!isNumber(version)) {
    throw new KinveyError('The api version must be a number.');
  }
  config.apiVersion = version;
}

export function init(sdkConfig: KinveySDKConfig): void {
  // Check that an appKey was provided
  if (sdkConfig.appKey === null && sdkConfig.appKey === undefined) {
    throw new KinveyError('No app key was provided to initialize the Kinvey JavaScript SDK.');
  }

  // Check that an appSecret or masterSecret was provided
  if (sdkConfig.appSecret === null && sdkConfig.appSecret === undefined) {
    throw new KinveyError('No app secret was provided to initialize the Kinvey JavaScript SDK.');
  }

  setAppKey(sdkConfig.appKey);
  setAppSecret(sdkConfig.appSecret);

  if (sdkConfig.instanceId) {
    setInstanceId(sdkConfig.instanceId);
  }

  if (sdkConfig.defaultTimeout) {
    setDefaultTimeout(sdkConfig.defaultTimeout);
  }

  if (sdkConfig.encryptionKey) {
    setEncryptionKey(sdkConfig.encryptionKey);
  }

  if (sdkConfig.apiVersion) {
    setApiVersion(sdkConfig.apiVersion);
  }
}
