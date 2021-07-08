import {
  getAppVersion,
  setAppVersion,
  logger,
  ping,
  Acl,
  Aggregation,
  CustomEndpoint,
  DataStore,
  DataStoreType,
  Errors,
  Files,
  Kmd,
  Query,
  User,
  AuthorizationGrant,
  MFA
} from 'kinvey-js-sdk';
import { init, initialize } from './init';

// SDK
export {
  // Init
  init,
  initialize,
  // StorageProvider,

  // App Version
  getAppVersion,
  setAppVersion,
  // Logger
  logger,
  // Ping
  ping,
  // Acl
  Acl,
  // Aggregation
  Aggregation,
  // Custom Endpoint
  CustomEndpoint,
  // DataStore
  DataStore,
  DataStoreType,
  // Errors
  Errors,
  // Files
  Files,
  // Kmd
  Kmd,
  Kmd as Metadata,
  // Query
  Query,
  // User
  User,
  AuthorizationGrant,
  MFA
};
