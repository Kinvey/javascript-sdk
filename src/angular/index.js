import Acl from '../acl';
import Aggregation from '../aggregation';
import { StorageProvider } from '../cache/store';
import { DataStoreType } from '../datastore';
import Query from '../query';
import { get as getAppVersion, set as setAppVersion } from '../kinvey/appVersion';
import Kmd from '../kmd';
import AuthorizationGrant from '../user/authorizationGrant';
import DataStoreService from './datastore.service';
import EndpointService from './endpoint.service';
import FilesService from './files.service';
import KinveyModule from './kinvey.module';
import PingService from './ping.service';
import UserService from './user.service';

export {
  // Kinvey
  KinveyModule,

  // App Version
  getAppVersion,
  setAppVersion,

  // Acl
  Acl,

  // Aggregation
  Aggregation,

  // DataStore
  StorageProvider,
  DataStoreType,
  DataStoreService,

  // Custom Endpoint
  EndpointService,

  // Files
  FilesService,

  // Kmd
  Kmd,
  Kmd as Metadata,

  // Query
  Query,

  // User
  AuthorizationGrant,
  UserService,

  // Ping
  PingService
};
