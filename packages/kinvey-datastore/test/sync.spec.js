import { SyncStore, syncManagerProvider } from '../src';
const { SyncManager, SyncOperation } = require('../src/sync');
const { SyncError } = require('kinvey-errors');
const { randomString } = require('kinvey-utils/string');
const { Query } = require('kinvey-query');
const { NetworkRack } = require('kinvey-request');
const { User } = require('kinvey-user');
const { init } = require('kinvey');
const { HttpMiddleware } = require('./http');
const nock = require('nock');
const expect = require('expect');
const chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should();
const collection = 'Books';

describe('Sync', () => {
  let client;

  before(() => {
    NetworkRack.useHttpMiddleware(new HttpMiddleware());
  });

  before(() => {
    client = init({
      appKey: randomString(),
      appSecret: randomString()
    });
  });

  before(() => {
    const username = randomString();
    const password = randomString();
    const reply = {
      _id: randomString(),
      _kmd: {
        lmt: new Date().toISOString(),
        ect: new Date().toISOString(),
        authtoken: randomString()
      },
      username: username,
      _acl: {
        creator: randomString()
      }
    };

    nock(client.apiHostname)
      .post(`/user/${client.appKey}/login`, { username: username, password: password })
      .reply(200, reply);

    return User.login(username, password);
  });

  afterEach(() => {
    const sync = new SyncManager(collection);
    return sync.clear();
  });

  describe.skip('count()', () => {
    const entity1 = { _id: randomString() };
    const entity2 = { _id: randomString() };

    beforeEach(() => {
      const store = new SyncStore(collection);
      return store.save(entity1);
    });

    beforeEach(() => {
      const store = new SyncStore(collection);
      return store.save(entity2);
    });

    it('should return the count for all entities that need to be synced', () => {
      const sync = new SyncManager(collection);
      return sync.count()
        .then((count) => {
          expect(count).toEqual(2);
        });
    });

    it('should return the count for all entities that match the query that need to be synced', () => {
      const sync = new SyncManager(collection);
      const query = new Query().equalTo('_id', entity1._id);
      return sync.count(query)
        .then((count) => {
          expect(count).toEqual(1);
        });
    });
  });

  describe.skip('addCreateOperation()', () => {
    it('should throw an error when an entity does not contain and _id', () => {
      const collection = randomString();
      const sync = new SyncManager(collection);
      return sync.addCreateOperation(collection, { prop: randomString() })
        .then(() => {
          throw new Error('This test should fail.');
        })
        .catch((error) => {
          expect(error).toBeA(SyncError);
        });
    });

    it('should accept a single entity', () => {
      const entity = { _id: randomString() };
      const sync = new SyncManager(collection);
      return sync.addCreateOperation(entity)
        .then((syncEntity) => {
          expect(syncEntity).toEqual(entity);
        });
    });

    it('should accept an array of entities', () => {
      const entities = [{ _id: randomString() }];
      const sync = new SyncManager(collection);
      return sync.addCreateOperation(entities)
        .then((syncEntities) => {
          expect(syncEntities).toEqual(entities);
        });
    });

    it('should add entities to the sync table', () => {
      const entity = { _id: randomString() };
      const store = new SyncStore(collection);
      return store.create(entity)
        .then(() => {
          const sync = new SyncManager(collection);
          return sync.count();
        })
        .then((count) => {
          expect(count).toEqual(1);
        });
    });
  });

  describe.skip('addUpdateOperation()', () => {
    it('should throw an error when an entity does not contain and _id', () => {
      const collection = randomString();
      const sync = new SyncManager(collection);
      return sync.addUpdateOperation(collection, { prop: randomString() })
        .then(() => {
          throw new Error('This test should fail.');
        })
        .catch((error) => {
          expect(error).toBeA(SyncError);
        });
    });

    it('should accept a single entity', () => {
      const entity = { _id: randomString() };
      const sync = new SyncManager(collection);
      return sync.addUpdateOperation(entity)
        .then((syncEntity) => {
          expect(syncEntity).toEqual(entity);
        });
    });

    it('should accept an array of entities', () => {
      const entities = [{ _id: randomString() }];
      const sync = new SyncManager(collection);
      return sync.addUpdateOperation(entities)
        .then((syncEntities) => {
          expect(syncEntities).toEqual(entities);
        });
    });

    it('should add entities to the sync table', () => {
      const entity = { _id: randomString() };
      const store = new SyncStore(collection);
      return store.update(entity)
        .then(() => {
          const sync = new SyncManager(collection);
          return sync.count();
        })
        .then((count) => {
          expect(count).toEqual(1);
        });
    });
  });

  describe.skip('addDeleteOperation', () => {
    it('should throw an error when an entity does not contain and _id', () => {
      const collection = randomString();
      const sync = new SyncManager(collection);
      return sync.addDeleteOperation(collection, { prop: randomString() })
        .then(() => {
          throw new Error('This test should fail.');
        })
        .catch((error) => {
          expect(error).toBeA(SyncError);
        });
    });

    it('should accept a single entity', () => {
      const entity = { _id: randomString() };
      const sync = new SyncManager(collection);
      return sync.addUpdateOperation(entity)
        .then((syncEntity) => {
          expect(syncEntity).toEqual(entity);
        });
    });

    it('should accept an array of entities', () => {
      const entities = [{ _id: randomString() }];
      const sync = new SyncManager(collection);
      return sync.addUpdateOperation(entities)
        .then((syncEntities) => {
          expect(syncEntities).toEqual(entities);
        });
    });

    it('should add entities to the sync table', () => {
      const entity = { _id: randomString() };
      const store = new SyncStore(collection);
      return store.save(entity)
        .then(() => {
          return store.removeById(entity._id);
        })
        .then(() => {
          const sync = new SyncManager(collection);
          return sync.count();
        })
        .then((count) => {
          expect(count).toEqual(1);
        });
    });
  });

  describe('pull()', () => {
    it('should return entities from the backend', () => {
      const entity = { _id: randomString() };
      const sync = new SyncManager(collection);
      const manager = syncManagerProvider.getSyncManager();

      // Kinvey API Response
      nock(client.apiHostname)
        .get(sync.backendPathname, () => true)
        .query(true)
        .reply(200, [entity]);

      return manager.pull(collection)
        .then((entities) => {
          expect(entities).toBeA(Array);
          expect(entities.length).toEqual(1);
          expect(entities).toEqual([entity]);
        });
    });
  });

  describe('push()', () => {
    it('should execute pending sync operations', () => {
      const entity1 = { _id: randomString() };
      const entity2 = { _id: randomString() };
      let entity3 = {};
      const entity3Id = randomString();
      const sync = new SyncManager(collection);
      const store = new SyncStore(collection);
      const manager = syncManagerProvider.getSyncManager();

      return store.save(entity1)
        .then(() => store.save(entity2))
        .then(() => store.save(entity3))
        .then(entity => (entity3 = entity))
        .then(() => store.removeById(entity2._id))
        .then(() => {
          nock(sync.client.apiHostname)
            .put(`${sync.backendPathname}/${entity1._id}`, () => true)
            .query(true)
            .reply(200, entity1);

          nock(sync.client.apiHostname)
            .delete(`${sync.backendPathname}/${entity2._id}`, () => true)
            .query(true)
            .reply(200, { count: 1 });

          nock(sync.client.apiHostname)
            .post(sync.backendPathname, () => true)
            .query(true)
            .reply(200, { _id: entity3Id });

          return manager.push(collection);
        })
        .then((result) => {
          expect(result).toEqual([
            { _id: entity1._id, operation: SyncOperation.Update, entity: entity1 },
            { _id: entity2._id, operation: SyncOperation.Delete },
            { _id: entity3._id, operation: SyncOperation.Create, entity: { _id: entity3Id } }
          ]);
          return manager.getSyncItemCount(collection);
        })
        .then((count) => {
          expect(count).toEqual(0);
        });
    });

    it('should not stop syncing if one entity results in an error', () => {
      const entity1 = { _id: randomString() };
      const entity2 = { _id: randomString() };
      const sync = new SyncManager(collection);
      const store = new SyncStore(collection);
      const manager = syncManagerProvider.getSyncManager();
      return store.save(entity1)
        .then(() => store.save(entity2))
        .then(() => store.removeById(entity2._id))
        .then(() => {
          nock(sync.client.apiHostname)
            .put(`${sync.backendPathname}/${entity1._id}`, () => true)
            .query(true)
            .reply(500);

          nock(sync.client.apiHostname)
            .delete(`${sync.backendPathname}/${entity2._id}`, () => true)
            .query(true)
            .reply(200, { count: 1 });

          return manager.push(collection);
        })
        .then((results) => {
          expect(results[0]).toIncludeKey('error');
          expect(results[0]).toInclude({ _id: entity1._id, operation: SyncOperation.Update, entity: entity1 });
          expect(results[1]).toEqual({ _id: entity2._id, operation: SyncOperation.Delete });
          return manager.getSyncItemCount(collection);
        })
        .then((count) => {
          expect(count).toEqual(1);
        });
    });

    it('should not push when an existing push is in progress', (done) => {
      const entity1 = { _id: randomString() };
      const sync = new SyncManager(collection);
      const store = new SyncStore(collection);
      const manager = syncManagerProvider.getSyncManager();
      store.save(entity1)
        .then(() => {
          // Kinvey API Response
          nock(sync.client.apiHostname)
            .put(`${sync.backendPathname}/${entity1._id}`, () => true)
            .query(true)
            .reply(200, entity1);

          // Sync
          manager.push(collection)
            .catch(done);

          // Add second sync operation
          const entity2 = { _id: randomString() };
          return store.save(entity2);
        })
        .then(() => {
          return manager.push(collection);
        })
        .catch((err) => {
          expect(err).toExist();
          expect(err.message).toEqual('Data is already being pushed to the backend.'
            + ' Please wait for it to complete before pushing new data to the backend.');
          done();
        })
        .catch(done);
    });

    it('should push when an existing push is in progress on a different collection', function (done) {
      const entity1 = { _id: randomString() };
      const sync1 = new SyncManager(collection);
      const manager1 = syncManagerProvider.getSyncManager();
      const store1 = new SyncStore(collection);
      const promise = store1.save(entity1)
        .then(() => {
          // Kinvey API Response
          nock(sync1.client.apiHostname)
            .put(`${sync1.backendPathname}/${entity1._id}`, () => true)
            .query(true)
            .delay(1000) // Delay the response for 1 second
            .reply(200, entity1);

          // Sync
          manager1.push(collection)
            .then(() => promise.should.be.fulfilled)
            .then(() => done())
            .catch(done);

          // Add second sync operation
          const entity2 = { _id: randomString() };
          const sync2 = new SyncManager(randomString());
          const store2 = new SyncStore(randomString());
          const manager2 = syncManagerProvider.getSyncManager();
          return store2.save(entity2)
            .then(() => {
              return manager2.push(collection);
            });
        });
    });
  });
});
