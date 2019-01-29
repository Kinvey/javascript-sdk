import isString from 'lodash/isString';
import KinveyError from '../errors/kinvey';
import { isValidTag, clear as _clear } from './cache';
import { NetworkStore } from './networkstore';
import { SyncStore } from './syncstore';
import AutoStore from './autostore';

export const DataStoreType = {
  Auto: 'Auto',
  Network: 'Network',
  Sync: 'Sync'
};

export function collection(collectionName, type = DataStoreType.Cache, options = {}) {
  let datastore;
  const tagWasPassed = options && ('tag' in options);

  if (collectionName == null || !isString(collectionName)) {
    throw new KinveyError('A collection is required and must be a string.');
  }
  if (tagWasPassed && !isValidTag(options.tag)) {
    throw new KinveyError('Please provide a valid data store tag.');
  }

  if (type === DataStoreType.Auto) {
    datastore = new AutoStore(collectionName, Object.assign({}, options));
  } else if (type === DataStoreType.Network) {
    if (tagWasPassed) {
      throw new KinveyError('The tagged option is not valid for data stores of type "Network"');
    }

    datastore = new NetworkStore(collectionName);
  } else if (type === DataStoreType.Sync) {
    datastore = new SyncStore(collectionName, Object.assign({}, options));
  } else {
    throw new Error('Unknown data store type.');
  }

  return datastore;
}

export function getInstance(collection, type, options) {
  return collection(collection, type, options);
}

export async function clear() {
  return _clear();
}

export async function clearCache() {
  return clear();
}
