import chai from 'chai';
import _ from 'lodash';
import totp from 'totp.js';
import * as Kinvey from '__SDK__';
import * as config from '../config';
import * as utilities from '../utils';

const expect = chai.expect;
chai.use(require('chai-as-promised'));
utilities.tryRequireBuffer();

const namePrefix = 'js-sdk-tests-';

async function assertActiveUserError(func) {
  await expect(func())
    .to.be.rejectedWith('An active user does not exist. Please login one first.');
}

describe('MFA', () => {
  const createdUserIds = [];
  let appCredentials;
  let user;

  before(() => {
    const initProperties = {
      appKey: process.env.APP_KEY,
      appSecret: process.env.APP_SECRET,
      masterSecret: process.env.MASTER_SECRET,
      apiVersion: 6
    };

    if (process.env.INSTANCE_ID) {
      initProperties.instanceId = process.env.INSTANCE_ID;
    }

    appCredentials = Kinvey.init(utilities.setOfflineProvider(initProperties, process.env.OFFLINE_STORAGE));
  });

  after(() => utilities.deleteUsers(createdUserIds));

  describe('read', () => {
    let userAuthenticators = [];
    let userRecoveryCodes;

    // setup user and authenticators
    before(async () => {
      const result = await utilities.setupUserWithMFA(appCredentials, false);
      user = result.createdUser;
      createdUserIds.push(user.data._id);
      userRecoveryCodes = result.userAuthenticator.recoveryCodes;
      userAuthenticators.push(_.pick(result.userAuthenticator, ['id', 'name', 'type']));
      const oneMoreAuthenticator = await utilities.createVerifiedAuthenticator();
      userAuthenticators.push(_.pick(oneMoreAuthenticator, ['id', 'name', 'type']));
    });

    after(() => Kinvey.MFA.disable()); // clean authenticators

    it('Kinvey.MFA.Authenticators.list() should return authenticators', async () => {
      expect(await Kinvey.MFA.Authenticators.list()).to.deep.include.members(userAuthenticators);
    });

    it('user.listAuthenticators() should return authenticators', async () => {
      const activeUser = await Kinvey.User.getActiveUser();
      expect(await activeUser.listAuthenticators()).to.deep.include.members(userAuthenticators);
    });

    it('Kinvey.MFA.listRecoveryCodes() should return recovery codes', async () => {
      expect(await Kinvey.MFA.listRecoveryCodes()).to.deep.equal(userRecoveryCodes);
    });

    it('user.listRecoveryCodes() should return recovery codes', async () => {
      const activeUser = await Kinvey.User.getActiveUser();
      expect(await activeUser.listRecoveryCodes()).to.deep.equal(userRecoveryCodes);
    });

    it('Kinvey.MFA.isEnabled() should return true when user has authenticators', async () => {
      expect(await Kinvey.MFA.isEnabled()).to.equal(true);
    });
  });

  describe('modify', () => {
    before(async () => {
      ({createdUser: user} = await utilities.setupUserWithMFA(appCredentials, false));
      createdUserIds.push(user.data._id);
    });

    after(() => Kinvey.MFA.disable()); // clean authenticators

    describe('create', () => {
      describe('when user has no other authenticators', () => {
        before(() => Kinvey.MFA.disable());

        it('Kinvey.MFA.Authenticators.create() should return new authenticator and recovery codes', async () => {
          const verify = (authenticator) => {
            expect(authenticator).to.exist.and.to.be.an('object');
            expect(authenticator.config).to.exist.and.to.be.an('object');
            expect(authenticator.config.secret).to.exist;
            return new totp(authenticator.config.secret).genOTP();
          };
          const expectedName = utilities.randomString(20, namePrefix);
          const result = await Kinvey.MFA.Authenticators.create({ name: expectedName }, verify);
          expect(result).to.have.keys(['authenticator', 'recoveryCodes']);
          expect(result.authenticator).to.have.keys(['id', 'name', 'type', 'config']);
          expect(result.authenticator.name).to.equal(expectedName);
          expect(result.recoveryCodes).to.be.an('array').that.is.not.empty;
        });
      });

      it('user.createAuthenticator() with valid data and a mix of incorrect and correct code should retry and return new authenticator', async () => {
        const verify = (authenticator, context) => {
          expect(context).to.exist.and.to.be.an('object');
          expect(context.retries, 'Context.retries').to.be.a('number');
          if (context.retries === 0) {
            expect(context.error).to.not.exist;
            return '111999'; // to fail once
          }

          expect(context.retries).to.equal(1);
          expect(context.error).to.exist;
          expect(context.error.message).to.contain('Your request body contained invalid or incorrectly formatted data.');

          return new totp(authenticator.config.secret).genOTP();
        };
        const expectedName = utilities.randomString(20, namePrefix);
        const activeUser = await Kinvey.User.getActiveUser();
        const { authenticator: actualAuthenticator } = await activeUser.createAuthenticator({ name: expectedName, type: 'totp' }, verify);
        expect(actualAuthenticator).to.have.keys(['id', 'name', 'type', 'config']);
        expect(actualAuthenticator.name).to.equal(expectedName);
      });

      it('user.createAuthenticator() tries to verify the authenticator max 10 times', async () => {
        let actualRetriesCount = 0;
        const verify = (authenticator, context) => {
          actualRetriesCount += 1;
          expect(context).to.exist.and.to.be.an('object');
          expect(context.retries, 'Context.retries').to.be.a('number');
          expect(actualRetriesCount).to.be.lessThan(11);
          return '111999';
        };

        const activeUser = await Kinvey.User.getActiveUser();
        await expect(activeUser.createAuthenticator({ name: utilities.randomString(20, namePrefix) }, verify))
          .to.be.rejectedWith('Max retries count for authenticator verification exceeded.');
        expect(actualRetriesCount).to.equal(10);
      });

      it('user.createAuthenticator() without verify should throw an error', async () => {
        const activeUser = await Kinvey.User.getActiveUser();
        await expect(activeUser.createAuthenticator({ name: utilities.randomString(20, namePrefix) }))
          .to.be.rejectedWith('Function to verify authenticator is missing.');
      });
    });

    describe('delete', () => {
      let authenticatorIdToRemove;
      beforeEach(async () => {
        ({ id: authenticatorIdToRemove } = await utilities.createVerifiedAuthenticator());
        await utilities.createVerifiedAuthenticator();
      });

      it('Kinvey.MFA.Authenticators.remove() with existing ID should remove authenticator', async () => {
        await Kinvey.MFA.Authenticators.remove(authenticatorIdToRemove);
        const authenticatorsLeft = await Kinvey.MFA.Authenticators.list();
        expect(authenticatorsLeft.find(a => a.id === authenticatorIdToRemove)).to.not.exist;
      });

      it('user.removeAuthenticator() with non-existing ID should throw', async () => {
        const activeUser = await Kinvey.User.getActiveUser();
        await expect(activeUser.removeAuthenticator('nonExistingId'))
          .to.be.rejectedWith('Could not find the specified authenticator.');
      });

      it('Kinvey.MFA.disable() should remove all authenticators', async () => {
        await Kinvey.MFA.disable();
        const authenticatorsLeft = await Kinvey.MFA.Authenticators.list();
        expect(authenticatorsLeft.length).to.equal(0);
        expect(await Kinvey.MFA.isEnabled()).to.equal(false);
        // calling again should be fine
        await Kinvey.MFA.disable();
      });
    });

    describe('regenerate recovery codes', () => {
      let oldCodes;
      beforeEach(async () => {
        await utilities.createVerifiedAuthenticator();
        oldCodes = Kinvey.MFA.listRecoveryCodes();
      });

      it('Kinvey.MFA.regenerateRecoveryCodes() should return new recovery codes', async () => {
        const newCodes = await Kinvey.MFA.regenerateRecoveryCodes();
        expect(newCodes).to.be.an('array').that.is.not.empty;
        expect(newCodes).to.not.deep.equal(oldCodes);
      });

      it('user.regenerateRecoveryCodes() should return new recovery codes', async () => {
        const newCodes = await (await Kinvey.User.getActiveUser()).regenerateRecoveryCodes();
        expect(newCodes).to.be.an('array').that.is.not.empty;
        expect(newCodes).to.not.deep.equal(oldCodes);
      });
    });
  });

  describe('without an active user', () => {
    before(() => Kinvey.User.logout()); // ensure no active user

    [Kinvey.MFA.isEnabled, Kinvey.MFA.disable, Kinvey.MFA.Authenticators.list,Kinvey.MFA.Authenticators.remove, Kinvey.MFA.listRecoveryCodes].forEach((func) => {
      it(`${func.name} should throw`, async () => assertActiveUserError(() => func()));
    });

    it('Kinvey.MFA.Authenticators.create() should throw', async () => {
      await expect(Kinvey.MFA.Authenticators.create())
        .to.be.rejectedWith('An active user, nor an MFA user exists. Please login one first.');
    });
  });
});
