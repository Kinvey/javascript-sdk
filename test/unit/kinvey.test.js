import Kinvey from 'src/kinvey';
import { Client } from 'src/client';
import { TestUser as User } from './mocks';
import { randomString } from 'src/utils';
import { KinveyError } from 'src/errors';
import expect from 'expect';
import nock from 'nock';
const appdataNamespace = process.env.KINVEY_DATASTORE_NAMESPACE || 'appdata';
const defaultMicProtocol = process.env.KINVEY_MIC_PROTOCOL || 'https:';
const defaultMicHost = process.env.KINVEY_MIC_HOST || 'auth.kinvey.com';

describe('Kinvey', function () {
  afterEach(function() {
    // Reintialize with the previous client
    return Kinvey.init({
      appKey: this.client.appKey,
      appSecret: this.client.appSecret
    });
  });

  describe('appVersion', function() {
    it('should set the appVersion', function() {
      const appVersion = '1.0.0';
      Kinvey.appVersion = appVersion;
      expect(Kinvey.appVersion).toEqual(appVersion);
    });
  });

  describe('init()', function () {
    it('should throw an error if an appKey is not provided', function() {
      try {
        Kinvey.init({
          appSecret: randomString()
        });
      } catch (error) {
        expect(error).toBeA(KinveyError);
      }
    });

    it('should throw an error if an appSecret or masterSecret is not provided', function() {
      try {
        Kinvey.init({
          appKey: randomString()
        });
      } catch (error) {
        expect(error).toBeA(KinveyError);
      }
    });

    it('should return a client', function() {
      const client = Kinvey.init({
        appKey: randomString(),
        appSecret: randomString()
      });
      expect(client).toBeA(Client);
    });

    it('should set default MIC host name when a custom one is not provided', function() {
      const client = Kinvey.init({
        appKey: randomString(),
        appSecret: randomString()
      });
      expect(client).toInclude({ micProtocol: defaultMicProtocol });
      expect(client).toInclude({ micHost: defaultMicHost });
    });

    it('should set a custom MIC host name when one is provided', function() {
      const micHostname = 'https://auth.example.com';
      const client = Kinvey.init({
        appKey: randomString(),
        appSecret: randomString(),
        micHostname: micHostname
      });
      expect(client).toInclude({ micProtocol: 'https:' });
      expect(client).toInclude({ micHost: 'auth.example.com' });
    });

    it('should set additional modules after init', function() {
      // Initialize Kinvey
      Kinvey.init({
        appKey: randomString(),
        appSecret: randomString()
      });
      expect(Kinvey.Acl).toNotEqual(undefined);
      expect(Kinvey.Aggregation).toNotEqual(undefined);
      expect(Kinvey.AuthorizationGrant).toNotEqual(undefined);
      expect(Kinvey.CustomEndpoint).toNotEqual(undefined);
      expect(Kinvey.DataStore).toNotEqual(undefined);
      expect(Kinvey.DataStoreType).toNotEqual(undefined);
      expect(Kinvey.Files).toNotEqual(undefined);
      expect(Kinvey.Log).toNotEqual(undefined);
      expect(Kinvey.Metadata).toNotEqual(undefined);
      expect(Kinvey.Query).toNotEqual(undefined);
      expect(Kinvey.User).toNotEqual(undefined);
      expect(Kinvey.Users).toNotEqual(undefined);
      expect(Kinvey.UserStore).toNotEqual(undefined);
    });
  });

  describe('initialize()', function () {
    it('should throw an error if an appKey is not provided', function() {
      Kinvey.initialize({
        appSecret: randomString()
      }).catch((error) => {
        expect(error).toBeA(KinveyError);
        return null;
      });
    });

    it('should throw an error if an appSecret or masterSecret is not provided', function() {
      return Kinvey.initialize({
        appKey: randomString()
      }).catch((error) => {
        expect(error).toBeA(KinveyError);
        return null;
      });
    });

    it('should return null', function() {
      return Kinvey.initialize({
        appKey: randomString(),
        appSecret: randomString()
      }).then((activeUser) => {
        expect(activeUser).toEqual(null);
      });
    });

    it('should return the active user', function() {
      const appKey = randomString();
      const appSecret = randomString();

      // Initialize Kinvey
      return Kinvey.initialize({
        appKey: appKey,
        appSecret: appSecret
      })
        .then(() => User.login(randomString(), randomString())) // Login a user
        .then((user) => {
          // Setup nock response
          nock(user.client.apiHostname, { encodedQueryParams: true })
            .get(`${user.pathname}/_me`)
            .reply(200, {
              _id: randomString(),
              _kmd: {
                lmt: new Date().toISOString(),
                ect: new Date().toISOString(),
                authtoken: randomString()
              },
              _acl: {
                creator: randomString()
              }
            }, {
              'content-type': 'application/json; charset=utf-8'
            });

          // Initialize Kinvey again
          return Kinvey.initialize({
            appKey: appKey,
            appSecret: appSecret
          });
        })
        .then((activeUser) => {
          // expect(activeUser).toBeA(User);
          expect(activeUser._id).toEqual(User.getActiveUser()._id);
        })
        .then(() => User.logout()); // Logout
    });

    it('should set default MIC host name when a custom one is not provided', function() {
      return Kinvey.initialize({
        appKey: randomString(),
        appSecret: randomString()
      }).then(() => {
        const client = Kinvey.client;
        expect(client).toInclude({ micProtocol: defaultMicProtocol });
        expect(client).toInclude({ micHost: defaultMicHost });
      });
    });

    it('should set a custom MIC host name when one is provided', function() {
      const micHostname = 'https://auth.example.com';
      return Kinvey.initialize({
        appKey: randomString(),
        appSecret: randomString(),
        micHostname: micHostname
      }).then(() => {
        const client = Kinvey.client;
        expect(client).toInclude({ micProtocol: 'https:' });
        expect(client).toInclude({ micHost: 'auth.example.com' });
      });
    });

    it('should set additional modules after init', function() {
      // Initialize Kinvey
      return Kinvey.initialize({
        appKey: randomString(),
        appSecret: randomString()
      }).then(() => {
        // Expectations
        expect(Kinvey.Acl).toNotEqual(undefined);
        expect(Kinvey.Aggregation).toNotEqual(undefined);
        expect(Kinvey.AuthorizationGrant).toNotEqual(undefined);
        expect(Kinvey.CustomEndpoint).toNotEqual(undefined);
        expect(Kinvey.DataStore).toNotEqual(undefined);
        expect(Kinvey.DataStoreType).toNotEqual(undefined);
        expect(Kinvey.Files).toNotEqual(undefined);
        expect(Kinvey.Metadata).toNotEqual(undefined);
        expect(Kinvey.Query).toNotEqual(undefined);
        expect(Kinvey.User).toNotEqual(undefined);
      });
    });
  });

  describe('ping()', function() {
    it('should return a response when there is no active user', function() {
      const reply = {
        version: '3.9.19',
        kinvey: 'hello JavaScript SDK',
        appName: 'JavaScript SDK',
        environmentName: 'Test'
      };

      // Logout the active user
      return User.logout()
        .then(() => {
          // Kinvey API Response
          nock(this.client.baseUrl)
            .get(`/${appdataNamespace}/${this.client.appKey}`)
            .query(true)
            .reply(200, reply, {
              'content-type': 'application/json'
            });

          // Ping Kinvey
          return Kinvey.ping();
        })
        .then((response) => {
          expect(response).toEqual(reply);
        });
    });

    it('should return a response when there is an active user', function() {
      const reply = {
        version: '3.9.19',
        kinvey: 'hello JavaScript SDK',
        appName: 'JavaScript SDK',
        environmentName: 'Test'
      };

      // Kinvey API Response
      nock(this.client.baseUrl)
        .get(`/${appdataNamespace}/${this.client.appKey}`)
        .query(true)
        .reply(200, reply, {
          'content-type': 'application/json'
        });

      // Ping Kinvey
      return Kinvey.ping()
        .then((response) => {
          expect(response).toEqual(reply);
        });
    });
  });
});
