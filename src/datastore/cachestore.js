import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import times from 'lodash/times';
import Query from '../query';
import { get as getConfig } from '../kinvey/config';
import { formatKinveyUrl } from '../http/utils';
import { KinveyRequest, RequestMethod } from '../http/request';
import { Auth } from '../http/auth';
import KinveyError from '../errors/kinvey';
import MissingConfigurationError from '../errors/missingConfiguration';
import ParameterValueOutOfRangeError from '../errors/parameterValueOutOfRange';
import NotFoundError from '../errors/notFound';
import BaseError from '../errors/base';
import { DataStoreCache, QueryCache } from './cache';
import { queryToSyncQuery, Sync } from './sync';
import { NetworkStore } from './networkstore';

const NAMESPACE = 'appdata';
const PAGE_LIMIT = 10000;

export default class InvalidDeltaSetQueryError extends BaseError {
  constructor(message = 'Invalid delta set query.', ...args) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message, ...args);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidDeltaSetQueryError);
    }

    // Custom debugging information
    this.name = 'InvalidDeltaSetQueryError';
  }
}

export class CacheStore {
  constructor(collectionName, options = { tag: undefined, useDeltaSet: false, useAutoPagination: false, autoSync: true }) {
    this.collectionName = collectionName;
    this.tag = options.tag;
    this.useDeltaSet = options.useDeltaSet === true;
    this.useAutoPagination = options.useAutoPagination === true || options.autoPagination;
    this.autoSync = options.autoSync === true;
  }

  get pathname() {
    const { appKey } = getConfig();
    return `/${NAMESPACE}/${appKey}/${this.collectionName}`;
  }

  async find(query, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);

    if (isFunction(options.callback)) {
      const cachedDocs = await cache.find(query);
      options.callBack(cachedDocs);
    }

    if (autoSync) {
      await this.pull(query, options);
    }

    return cache.find(query);
  }

  async count(query, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);

    if (isFunction(options.callback)) {
      const cacheCount = await cache.count(query);
      options.callback(cacheCount);
    }

    if (autoSync) {
      const network = new NetworkStore(this.collectionName);
      return network.count(query, options);
    }

    return cache.count(query);
  }

  async group(aggregation, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);

    if (isFunction(options.callback)) {
      const cacheResult = await cache.group(aggregation);
      options.callback(cacheResult);
    }

    if (autoSync) {
      const network = new NetworkStore(this.collectionName);
      return network.group(aggregation, options);
    }

    return cache.group(aggregation);
  }

  async findById(id, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const cachedDoc = await cache.findById(id);

    if (!cachedDoc) {
      if (!autoSync) {
        throw new NotFoundError();
      }

      if (isFunction(options.callback)) {
        options.callback(undefined);
      }
    } else if (isFunction(options.callback)) {
      options.callback(cachedDoc);
    }

    if (autoSync) {
      const doc = await this.pullById(id, options);
      return doc;
    }

    return cache.findById(id);
  }

  async create(doc, options = {}) {
    if (isArray(doc)) {
      throw new KinveyError('Unable to create an array of entities.', 'Please create entities one by one.');
    }

    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const sync = new Sync(this.collectionName, this.tag);
    const cachedDoc = await cache.save(doc);
    const syncDoc = await sync.addCreateSyncEvent(cachedDoc);

    if (autoSync) {
      const query = new Query().equalTo('_id', syncDoc._id);
      const pushResults = await sync.push(query, options);
      const pushResult = pushResults.shift();

      if (pushResult.error) {
        throw pushResult.error;
      }

      return pushResult.entity;
    }

    return cachedDoc;
  }

  async update(doc, options = {}) {
    if (isArray(doc)) {
      throw new KinveyError('Unable to update an array of entities.', 'Please update entities one by one.');
    }

    if (!doc._id) {
      throw new KinveyError('The entity provided does not contain an _id. An _id is required to update the entity.', doc);
    }

    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const sync = new Sync(this.collectionName, this.tag);
    const cachedDoc = await cache.save(doc);
    const syncDoc = await sync.addUpdateSyncEvent(cachedDoc);

    if (autoSync) {
      const query = new Query().equalTo('_id', syncDoc._id);
      const pushResults = await sync.push(query, options);
      const pushResult = pushResults.shift();

      if (pushResult.error) {
        throw pushResult.error;
      }

      return pushResult.entity;
    }

    return cachedDoc;
  }

  save(doc, options) {
    if (doc._id) {
      return this.update(doc, options);
    }

    return this.create(doc, options);
  }

  async remove(query, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const sync = new Sync(this.collectionName, this.tag);
    let count = 0;

    // Find the docs that will be removed from the cache that match the query
    const docs = await cache.find(query);

    if (docs.length > 0) {
      // Remove docs from the cache
      count = await cache.remove(query);

      // Add delete events for the removed docs to sync
      await sync.addDeleteSyncEvent(docs);
    }

    // Remove the docs from the backend
    if (autoSync) {
      const findQuery = queryToSyncQuery(query, this.collectionName);
      const syncDocs = await sync.find(findQuery);

      if (syncDocs.length > 0) {
        const pushQuery = new Query().contains('_id', syncDocs.map(doc => doc._id));
        const pushResults = await sync.push(pushQuery);
        count = pushResults.reduce((count, pushResult) => {
          if (pushResult.error) {
            return count - 1;
          }

          return count;
        }, count || syncDocs.length);
      }
    }

    return { count };
  }

  async removeById(id, options = {}) {
    const autoSync = options.autoSync === true || this.autoSync;
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const sync = new Sync(this.collectionName, this.tag);
    let count = 0;

    if (id) {
      // Find the doc that will be removed
      const doc = await cache.findById(id);

      if (doc) {
        // Remove the doc from the cache
        count = await cache.removeById(id);

        // Add delete event for the removed doc to sync
        const syncDoc = await sync.addDeleteSyncEvent(doc);

        // Remove the doc from the backend
        if (autoSync && syncDoc) {
          const query = new Query().equalTo('_id', syncDoc._id);
          const pushResults = await sync.push(query);

          if (pushResults.length > 0) {
            const pushResult = pushResults.shift();
            if (pushResult.error) {
              count -= 1;
            }
          }
        } else {
          count = 1;
        }
      } else {
        throw new NotFoundError();
      }
    }

    return { count };
  }

  async clear(query) {
    // Remove the docs from the cache
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const count = await cache.remove(query);

    // Remove the sync events
    await this.clearSync(query);

    // Clear the query cache
    if (!query) {
      const queryCache = new QueryCache(this.tag);
      queryCache.remove();
    }

    // Return the cound
    return { count };
  }

  push(query, options) {
    const sync = new Sync(this.collectionName, this.tag);
    return sync.push(null, options);
  }

  async pull(query, options = {}) {
    const network = new NetworkStore(this.collectionName);
    const cache = new DataStoreCache(this.collectionName, this.tag);
    const queryCache = new QueryCache(this.tag);
    const useDeltaSet = options.useDeltaSet === true || this.useDeltaSet;
    const useAutoPagination = options.useAutoPagination === true || options.autoPagination || this.useAutoPagination;

    // Push sync queue
    const count = await this.pendingSyncCount();
    if (count > 0) {
      // TODO in newer version
      // if (autoSync) {
      //   await sync.push();
      //   return this.pull(query, Object.assign({}, { useDeltaSet, useAutoPagination, autoSync }, options));
      // }

      if (count === 1) {
        throw new KinveyError(`Unable to pull entities from the backend. There is ${count} entity`
          + ' that needs to be pushed to the backend.');
      }

      throw new KinveyError(`Unable to pull entities from the backend. There are ${count} entities`
        + ' that need to be pushed to the backend.');
    }

    // Delta set
    if (useDeltaSet && (!query || (query.skip === 0 && query.limit === Infinity))) {
      try {
        const key = queryCache.serializeQuery(query);
        const queryCacheDoc = await queryCache.findByKey(key);

        if (queryCacheDoc && queryCacheDoc.lastRequest) {
          let queryObject = { since: queryCacheDoc.lastRequest };

          if (query) {
            queryObject = Object.assign({}, query.toQueryObject(), queryObject);
          }

          // Delta Set request
          const { apiProtocol, apiHost, appKey } = getConfig();
          const url = formatKinveyUrl(apiProtocol, apiHost, `/appdata/${appKey}/${this.collectionName}/_deltaset`, queryObject);
          const request = new KinveyRequest({ method: RequestMethod.GET, auth: Auth.Session, url });
          const response = await request.execute();
          const { changed, deleted } = response.data;

          // Delete the docs that have been deleted
          if (Array.isArray(deleted) && deleted.length > 0) {
            const removeQuery = new Query().contains('_id', deleted.map(doc => doc._id));
            await cache.remove(removeQuery);
          }

          // Save the docs that changed
          if (Array.isArray(changed) && changed.length > 0) {
            await cache.save(changed);
          }

          // Update the query cache
          await queryCache.save(query, response);

          // Return the number of changed docs
          return changed.length;
        }
      } catch (error) {
        if (!(error instanceof MissingConfigurationError) && !(error instanceof ParameterValueOutOfRangeError)) {
          throw error;
        }
      }
    }

    // Auto pagination
    if (useAutoPagination) {
      // Clear the cache
      await cache.clear();

      // Get the total count of docs
      const response = await network.count(query, Object.assign({}, options, { rawResponse: true }));
      const count = 'count' in response.data ? response.data.count : Infinity;

      // Create the pages
      const pageSize = options.autoPaginationPageSize || (options.autoPagination && options.autoPagination.pageSize) || PAGE_LIMIT;
      const pageCount = Math.ceil(count / pageSize);
      const pageQueries = times(pageCount, (i) => {
        const pageQuery = new Query(query);
        pageQuery.skip = i * pageSize;
        pageQuery.limit = Math.min(count - (i * pageSize), pageSize);
        return pageQuery;
      });

      // Process the pages
      const pagePromises = pageQueries.map((pageQuery) => {
        return network.find(pageQuery, options)
          .then(docs => cache.save(docs))
          .then(docs => docs.length);
      });
      const pageCounts = await Promise.all(pagePromises);
      const totalPageCount = pageCounts.reduce((totalCount, pageCount) => totalCount + pageCount, 0);

      // Update the query cache
      queryCache.save(query, response);

      // Return the total page count
      return totalPageCount;
    }

    // Find the docs on the backend
    const response = await network.find(query, Object.assign({}, options, { rawResponse: true }));
    const docs = response.data;

    // Clear the cache if a query was not provided
    if (!query) {
      await cache.clear();
    }

    // Update the cache
    await cache.save(docs);

    // Update the query cache
    await queryCache.save(query, response);

    // Return the number of docs
    return docs.length;
  }

  async pullById(id, options = {}) {
    const network = new NetworkStore(this.collectionName);
    const cache = new DataStoreCache(this.collectionName, this.tag);

    // Push sync queue
    const count = await this.pendingSyncCount();
    if (count > 0) {
      // TODO in newer version
      // if (autoSync) {
      //   await sync.push();
      //   return this.pull(query, Object.assign({}, { useDeltaSet, useAutoPagination, autoSync }, options));
      // }

      if (count === 1) {
        throw new KinveyError(`Unable to pull entities from the backend. There is ${count} entity`
          + ' that needs to be pushed to the backend.');
      }

      throw new KinveyError(`Unable to pull entities from the backend. There are ${count} entities`
        + ' that need to be pushed to the backend.');
    }

    try {
      // Find the doc on the backend
      const doc = await network.findById(id, options);

      // Update the doc in the cache
      await cache.save(doc);

      // Return the doc
      return doc;
    } catch (error) {
      if (error instanceof NotFoundError) {
        // Remove the doc from the cache
        await cache.removeById(id);
      }

      throw error;
    }
  }

  async sync(query, options) {
    const push = await this.push(null, options);
    const pull = await this.pull(query, options);
    return { push, pull };
  }

  pendingSyncDocs(query) {
    const sync = new Sync(this.collectionName, this.tag);
    const findQuery = queryToSyncQuery(query, this.collectionName);
    return sync.find(findQuery);
  }

  pendingSyncEntities(query) {
    return this.pendingSyncDocs(query);
  }

  pendingSyncCount(query) {
    const sync = new Sync(this.collectionName, this.tag);
    const findQuery = queryToSyncQuery(query, this.collectionName);
    return sync.count(findQuery);
  }

  async clearSync(query) {
    const sync = new Sync(this.collectionName, this.tag);
    const clearQuery = queryToSyncQuery(query, this.collectionName);
    return sync.remove(clearQuery);
  }

  async subscribe(receiver) {
    const network = new NetworkStore(this.collectionName);
    await network.subscribe(receiver);
    return this;
  }

  async unsubscribe() {
    const network = new NetworkStore(this.collectionName);
    await network.unsubscribe();
    return this;
  }
}
