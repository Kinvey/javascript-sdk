import chai from 'chai';
import totp from 'totp.js';
import * as Kinvey from '__SDK__';
import * as config from '../config';
import * as utilities from '../utils';

const expect = chai.expect;
chai.use(require('chai-as-promised'));
utilities.tryRequireBuffer();

var appCredentials;
const collectionName = config.collectionName;
const assertUserData = async (user, expectedUsername, shouldReturnPassword) => {
  expect(user.data._id).to.exist;
  expect(user.metadata.authtoken).to.exist;
  expect(user.metadata.lmt).to.exist;
  expect(user.metadata.llt).to.exist;
  expect(user.metadata.ect).to.exist;
  expect(user._acl.creator).to.exist;
  if (expectedUsername) {
    expect(user.data.username).to.equal(expectedUsername);
  } else {
    expect(user.data.username).to.exist;
  }
  if (shouldReturnPassword) {
    expect(user.data.password).to.exist;
  }
  expect(user.isActive()).to.eventually.equal(true);
  expect(user).to.deep.equal(await Kinvey.User.getActiveUser());
};

const getMissingUsernameErrorMessage = 'A username was not provided.';
const getMissingEmailErrorMessage = 'An email was not provided.';

const getNotAStringErrorMessage = (parameter) => {
  return `The provided ${parameter} is not a string.`;
};

const safelySignUpUser = (username, password, state, createdUserIds) => {
  return Kinvey.User.logout()
    .then(() => {
      return Kinvey.User.signup({
        username: username,
        password: password,
        email: utilities.randomEmailAddress()
      }, { state: state })
    })
    .then((user) => {
      createdUserIds.push(user.data._id);
      return user;
    });
};

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

describe('User tests', () => {
  before(() => {
    utilities.cleanUpCollection(appCredentials, 'user');
  });

  const missingCredentialsError = 'Username and/or password missing';
  const createdUserIds = [];

  before((done) => {
    utilities.cleanUpAppData(collectionName, createdUserIds)
      .then(() => done())
      .catch(done);
  });

  after((done) => {
    utilities.cleanUpAppData(collectionName, createdUserIds)
      .then(() => done())
      .catch(done);
  });

  describe('login', () => {
    before((done) => {
      Kinvey.User.logout()
        .then(() => done());
    });

    afterEach((done) => {
      Kinvey.User.logout()
        .then(() => done());
    });

    describe('login()', () => {
      it('should throw an error if an active user already exists', (done) => {
        Kinvey.User.signup()
          .then((user) => {
            createdUserIds.push(user.data._id);
            return Kinvey.User.login(utilities.randomString(), utilities.randomString());
          })
          .catch((error) => {
            expect(error.message).to.contain('An active user already exists.');
            done();
          })
          .catch(done);
      });

      it('should throw an error if a username is not provided', (done) => {
        Kinvey.User.login(null, utilities.randomString())
          .catch((error) => {
            expect(error.message).to.contain(missingCredentialsError);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the username is an empty string', (done) => {
        Kinvey.User.login(' ', utilities.randomString())
          .catch((error) => {
            expect(error.message).to.contain(missingCredentialsError);
            done();
          })
          .catch(done);
      });

      it('should throw an error if a password is not provided', (done) => {
        Kinvey.User.login(utilities.randomString())
          .catch((error) => {
            expect(error.message).to.contain(missingCredentialsError);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the password is an empty string', (done) => {
        Kinvey.User.login(utilities.randomString(), ' ')
          .catch((error) => {
            expect(error.message).to.contain(missingCredentialsError);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the username and/or password is invalid', (done) => {
        Kinvey.User.login(utilities.randomString(), utilities.randomString())
          .catch((error) => {
            expect(error.message).to.contain('Invalid credentials.');
            done();
          })
          .catch(done);
      });

      it('should login a user', () => {
        const username = utilities.randomString();
        const password = utilities.randomString();
        Kinvey.User.signup({ username: username, password: password })
          .then((user) => {
            createdUserIds.push(user.data._id);
            return Kinvey.User.logout();
          })
          .then(() => Kinvey.User.login(username, password))
          .then((user) => assertUserData(user, username));
      });
    });

    describe('login when MFA is enabled', () => {
      let createdUser;
      let userAuthenticator;
      let username;
      let password;

      before('setup user with MFA', async () => {
        ({ createdUser, userAuthenticator, username, password } = await utilities.setupUserWithMFA(appCredentials, true));
        createdUserIds.push(createdUser.data._id);
      });

      after('cleanup authenticator', async () => utilities.removeAuthenticator(createdUser, userAuthenticator.id));

      describe('login()', () => {
        it('should throw an error', async () => {
          await expect(Kinvey.User.login(username, password)).to.be.rejectedWith('MFA login is required.');
        });
      });

      describe('loginWithMFA()', () => {
        it('should login a user with correct credentials and code', async () => {
          const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
          const mfaComplete = () => { return { code: new totp(userAuthenticator.config.secret).genOTP() }};
          const user = await Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete);
          await assertUserData(user, username);
          const activeUser = await Kinvey.User.getActiveUser();
          expect(user).to.deep.equal(activeUser);
        });

        it('should retry and login a user with correct credentials and a mix of incorrect and correct code', async () => {
          const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
          const mfaComplete = (authenticator, context) => {
            expect(context).to.exist.and.to.be.an('object');
            expect(context.retries, 'Context.retries').to.be.a('number');
            if (context.retries === 0) {
              expect(context.error).to.not.exist;
              return { code: '111999' }; // to fail the login once
            }

            expect(context.retries).to.equal(1);
            expect(context.error).to.exist;
            expect(context.error.message).to.contain('Your request body contained invalid or incorrectly formatted data.');

            return { code: new totp(userAuthenticator.config.secret).genOTP() };
          };
          const user = await Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete);
          await assertUserData(user, username);
        });

        it('should call mfaComplete max 10 times when code is incorrect', async () => {
          let actualAttemptsCount = 0;
          const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
          const mfaComplete = () => {
            actualAttemptsCount +=1;
            expect(actualAttemptsCount).to.be.lessThan(11);
            return { code: '111999' };
          };
          await expect(Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete)).to.be.rejectedWith('Max retries count exceeded.');
          expect(actualAttemptsCount).to.equal(10);
        });

        it('should throw an error when selectAuthenticator returns null', async () => {
          const selectAuthenticator = () => null;
          const mfaComplete = () => { return { code: new totp(userAuthenticator.config.secret).genOTP() }};
          await expect(Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete)).to.be.rejectedWith('MFA authenticator ID is missing.');
        });

        it('should throw an error when mfaComplete returns code as null', async () => {
          const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
          const mfaComplete = () => { return { code: null }};
          await expect(Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete)).to.be.rejectedWith('MFA code is missing.');
        });

        it('should throw an error when mfaComplete returns null', async () => {
          const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
          const mfaComplete = () => { return { code: null }};
          await expect(Kinvey.User.loginWithMFA(username, password, selectAuthenticator, mfaComplete)).to.be.rejectedWith('MFA code is missing.');
        });

        it('should throw an error when credentials are incorrect', async () => {
          await expect(Kinvey.User.loginWithMFA(utilities.randomString(), utilities.randomString(), () => null, () => null))
            .to.be.rejectedWith('Invalid credentials.');
        });

        it('should throw an error when username is an empty string', async () => {
          await expect(Kinvey.User.loginWithMFA('', password, () => null, () => null))
            .to.be.rejectedWith(missingCredentialsError);
        });

        it('should throw an error when password is an empty string', async () => {
          await expect(Kinvey.User.loginWithMFA(username, '',  () => null, () => null))
            .to.be.rejectedWith(missingCredentialsError);
        });

        it('should throw an error when selectAuthenticator is null', async () => {
          await expect(Kinvey.User.loginWithMFA(username, password,  null, () => null))
            .to.be.rejectedWith('Function to select authenticator is missing.');
        });

        it('should throw an error when mfaComplete is null', async () => {
          await expect(Kinvey.User.loginWithMFA(username, password, () => null, null))
            .to.be.rejectedWith('Function to complete MFA is missing.');
        });

        describe('when an active user already exists', () => {
          before('setup active user', async () => {
            const existingActiveUser = await Kinvey.User.signup();
            createdUserIds.push(existingActiveUser.data._id);
          });

          it('should throw an error when an active user already exists', async () => {
            await expect(Kinvey.User.loginWithMFA(username, password, () => null, () => null)).to.be.rejectedWith('An active user already exists.');
          });
        });

        describe('when a user trusts the device', () => {
          let gullibleUserName;
          let gullibleUserPassword;
          let gullibleUserAuthenticator;
          let gullibleUser;

          before('setup new user with MFA', async () => {
            ({ createdUser: gullibleUser, userAuthenticator: gullibleUserAuthenticator, username: gullibleUserName, password: gullibleUserPassword } =
              await utilities.setupUserWithMFA(appCredentials, true));
            createdUserIds.push(gullibleUser.data._id);
          });

          after('cleanup authenticator', async () => utilities.removeAuthenticator(gullibleUser, gullibleUserAuthenticator.id));

          it('should not ask the same user for MFA code on second login', async () => {
            const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === gullibleUserAuthenticator.id).id);
            const mfaComplete = () => {
              return {
                code: new totp(gullibleUserAuthenticator.config.secret).genOTP(),
                trustDevice: true
              }
            };
            const user = await Kinvey.User.loginWithMFA(gullibleUserName, gullibleUserPassword, selectAuthenticator, mfaComplete);
            await assertUserData(user, gullibleUserName);
            const activeUser = await Kinvey.User.getActiveUser();
            expect(user).to.deep.equal(activeUser);

            await Kinvey.User.logout();

            await expect(
              Kinvey.User.loginWithMFA(gullibleUserName, gullibleUserPassword, selectAuthenticator, () => {throw new Error('MFA complete should not be called');})
            ).to.not.be.rejected;
          });

          it('should ask another user for MFA', async () => {
            // first, login a user who trusts the device and then, log them out
            const selectAuthenticator = (authenticators) => (authenticators.find((a) => a.id === gullibleUserAuthenticator.id).id);
            const mfaComplete = (authenticator, context) => {
              expect(context).to.exist;
              return {
                code: new totp(gullibleUserAuthenticator.config.secret).genOTP(),
                trustDevice: true
              }
            };
            const firstUser = await Kinvey.User.loginWithMFA(gullibleUserName, gullibleUserPassword, selectAuthenticator, mfaComplete);
            await assertUserData(firstUser, gullibleUserName);
            await Kinvey.User.logout();

            // login a completely different user from the first one and expect mfaComplete to be called
            const selectAuthenticatorAnotherUser = (authenticators) => (authenticators.find((a) => a.id === userAuthenticator.id).id);
            let mfaCompleteIsCalled = false;
            const mfaCompleteAnotherUser = () => {
              mfaCompleteIsCalled = true;
              return {
                code: new totp(userAuthenticator.config.secret).genOTP(),
              }
            };
            const user = await Kinvey.User.loginWithMFA(username, password, selectAuthenticatorAnotherUser, mfaCompleteAnotherUser);
            await assertUserData(user, username);
            expect(mfaCompleteIsCalled).to.equal(true);
          });
        });
      });

      describe('loginWithRecoveryCode()', () => {
        it('should login a user with correct credentials and code', async () => {
          const user = await Kinvey.User.loginWithRecoveryCode(username, password, userAuthenticator.recoveryCodes[0]);
          await assertUserData(user, username);
          const activeUser = await Kinvey.User.getActiveUser();
          expect(user).to.deep.equal(activeUser);
        });

        it('should throw an error when credentials are incorrect', async () => {
          await expect(Kinvey.User.loginWithRecoveryCode(utilities.randomString(), utilities.randomString(), utilities.randomString()))
            .to.be.rejectedWith('Invalid credentials.');
        });

        it('should throw an error when username is an empty string', async () => {
          await expect(Kinvey.User.loginWithRecoveryCode('', password, utilities.randomString()))
            .to.be.rejectedWith(missingCredentialsError);
        });

        it('should throw an error when password is an empty string', async () => {
          await expect(Kinvey.User.loginWithMFA(username, '',  utilities.randomString()))
            .to.be.rejectedWith(missingCredentialsError);
        });

        it('should throw an error when code is an empty string', async () => {
          await expect(Kinvey.User.loginWithRecoveryCode(username, password,  ''))
            .to.be.rejectedWith('Recovery code is missing.');
        });

        it('should throw an error when code is null', async () => {
          await expect(Kinvey.User.loginWithRecoveryCode(username, password,  null))
            .to.be.rejectedWith('Recovery code is missing.');
        });

        describe('when an active user already exists', () => {
          before('setup active user', async () => {
            const existingActiveUser = await Kinvey.User.signup();
            createdUserIds.push(existingActiveUser.data._id);
          });

          it('should throw an error when an active user already exists', async () => {
            await expect(Kinvey.User.loginWithRecoveryCode(username, password, userAuthenticator.recoveryCodes[5]))
              .to.be.rejectedWith('An active user already exists.');
          });
        });
      });
    });
  });

  describe('logout()', () => {
    let syncDataStore;
    const username = utilities.randomString();
    const password = utilities.randomString();

    before((done) => {
      syncDataStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
      safelySignUpUser(username, password, true, createdUserIds)
        .then(() => syncDataStore.save({ field: 'value' }))
        .then(() => done())
        .catch(done);
    });

    it('should logout the active user', async () => {
      expect(await Kinvey.User.getActiveUser()).to.not.equal(null);
      return Kinvey.User.logout()
        .then((user) => {
          expect(user.isActive()).to.eventually.equal(false);
          expect(Kinvey.User.getActiveUser()).to.eventually.equal(null);
          return Kinvey.User.signup();
        })
        .then((user) => {
          createdUserIds.push(user.data._id);
          const dataStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
          return dataStore.find().toPromise();
        })
        .then((entities) => {
          expect(entities).to.deep.equal([]);
        });
    });

    it('should logout when there is not an active user', async () => {
      return Kinvey.User.logout()
        .then(() => Kinvey.User.logout())
        .then(() => {
          expect(Kinvey.User.getActiveUser()).to.eventually.equal(null);
        });
    });
  });

  describe('invalidateTokens()', () => {
    let syncDataStore;
    const username = utilities.randomString();
    const password = utilities.randomString();

    before('setup data store and user', async () => {
      syncDataStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
      await safelySignUpUser(username, password, true, createdUserIds);
      if (!(await Kinvey.User.getActiveUser())) {
        throw new Error('No active user found.');
      }
      await syncDataStore.save({ field: 'value' });
    });

    it('should invalidate tokens, remove active user and clear data store', async () => {
      await Kinvey.User.invalidateTokens();
      expect(await Kinvey.User.getActiveUser()).to.not.exist;
      const dataStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync);
      const foundItems = await dataStore.find().toPromise();
      expect(foundItems).to.deep.equal([]);

      // should not throw when called a second time
      await expect(Kinvey.User.invalidateTokens()).to.not.be.rejected;
    });
  });

  describe('signup', () => {
    beforeEach((done) => {
      Kinvey.User.logout()
        .then(() => done());
    });

    it('should signup and set the user as the active user', () => {
      const username = utilities.randomString();
      return Kinvey.User.signup({ username: username, password: utilities.randomString() })
        .then((user) => {
          createdUserIds.push(user.data._id);
          return assertUserData(user, username, true);
        });
    });

    it('should signup with a user and set the user as the active user', () => {
      const username = utilities.randomString();
      return Kinvey.User.signup({ username: username, password: utilities.randomString() })
        .then((user) => {
          createdUserIds.push(user.data._id);
          return assertUserData(user, username, true);
        });
    });

    it('should signup with attributes and store them correctly', () => {
      const data = {
        username: utilities.randomString(),
        password: utilities.randomString(),
        email: utilities.randomEmailAddress(),
        additionalField: 'test'
      };

      return Kinvey.User.signup(data)
        .then(async (user) => {
          createdUserIds.push(user.data._id);
          await assertUserData(user, data.username, true);
          expect(user.data.email).to.equal(data.email);
          expect(user.data.additionalField).to.equal(data.additionalField);
        });
    });

    it('should signup user and not set the user as the active user if options.state = false', () => {
      return Kinvey.User.signup({ username: utilities.randomString(), password: utilities.randomString() }, { state: false })
        .then((user) => {
          createdUserIds.push(user.data._id);
          expect(user.isActive()).to.eventually.equal(false);
        });
    });

    it('should signup an implicit user and set the user as the active user', () => {
      return Kinvey.User.signup()
        .then((user) => {
          createdUserIds.push(user.data._id);
          return assertUserData(user, null, true);
        });
    });

    it.skip('should merge the signup data and set the user as the active user', async () => {
      const username = utilities.randomString();
      const password = utilities.randomString();

      const newUser = new Kinvey.User({
        username: utilities.randomString(),
        password
      });

      return newUser.signup({ username })
        .then(async (user) => {
          createdUserIds.push(user.data._id);
          expect(user.isActive()).to.eventually.equal(true);
          expect(user.data.username).to.equal(username);
          expect(user.data.password).to.equal(password);
          expect(user).to.deep.equal(await Kinvey.User.getActiveUser());
        });
    });

    it('should throw an error if an active user already exists', (done) => {
      Kinvey.User.signup()
        .then((user) => {
          createdUserIds.push(user.data._id);
          return Kinvey.User.signup();
        })
        .catch((error) => {
          expect(error.message).to.contain('An active user already exists.');
          done();
        })
        .catch(done);
    });

    it('should not throw an error with an active user and options.state set to false', async () => {
      return Kinvey.User.signup()
        .then((user) => {
          createdUserIds.push(user.data._id);
          return Kinvey.User.signup({
            username: utilities.randomString(),
            password: utilities.randomString()
          }, { state: false });
        })
        .then(async (user) => {
          createdUserIds.push(user.data._id);
          expect(user.isActive()).to.eventually.equal(false);
          expect(user).to.not.equal(await Kinvey.User.getActiveUser());
        });
    });
  });

  describe('me()', () => {
    let initialActiveUser;

    before(async () => {
      await safelySignUpUser(utilities.randomString(), null, true, createdUserIds);
      initialActiveUser = await Kinvey.User.getActiveUser();
      delete initialActiveUser.data.password;
    });

    it('should not change authtoken', async () => {
      const meUser = await Kinvey.User.me();
      const actualActiveUser = await Kinvey.User.getActiveUser();
      expect(actualActiveUser).to.deep.equal(initialActiveUser);
      expect(meUser).to.deep.equal(actualActiveUser);
    });
  });

  describe('update()', () => {
    const username = utilities.randomString();

    before(() => safelySignUpUser(username, null, true, createdUserIds));

    it('should update the active user', () => {
      const newEmail = `${utilities.randomString()}@example.com`;
      const newPassword = utilities.randomString();
      return Kinvey.User.update({
        email: newEmail,
        password: newPassword
      })
        .then(async (user) => {
          expect(user).to.deep.equal(await Kinvey.User.getActiveUser());
          expect(user.data.email).to.equal(newEmail);
          const query = new Kinvey.Query();
          query.equalTo('email', newEmail);
          return Kinvey.User.lookup(query).toPromise();
        })
        .then((users) => {
          expect(users.length).to.equal(1);
          expect(users[0].email).to.equal(newEmail);
          return Kinvey.User.logout();
        });
    });

    it.skip('should throw an error if the user does not have an _id', (done) => {
      Kinvey.User.update({
        email: utilities.randomString()
      })
        .then(() => {
          throw new Error('This test should fail.');
        })
        .catch((error) => {
          expect(error.message).to.equal('User must have an _id.');
          done();
        })
        .catch(done);
    });
  });

  describe('lookup()', () => {
    const username = utilities.randomString();

    before((done) => {
      safelySignUpUser(username, null, true, createdUserIds)
        .then(() => done())
        .catch(done);
    });

    it('should throw an error if the query argument is not an instance of the Query class', (done) => {
      Kinvey.User.lookup({})
        .toPromise()
        .catch((error) => {
          expect(error.message).to.equal('Invalid query. It must be an instance of the Query class.');
          done();
        })
        .catch(done);
    });

    it('should return an array of users matching the query', (done) => {
      const query = new Kinvey.Query();
      query.equalTo('username', username);
      Kinvey.User.lookup(query)
        .toPromise()
        .then((users) => {
          expect(users).to.be.an('array');
          expect(users.length).to.equal(1);
          const user = users[0];
          expect(user._id).to.exist;
          expect(user.username).to.equal(username);
          done();
        })
        .catch(done);
    });
  });

  describe('remove()', () => {
    let userToRemoveId1;
    let userToRemoveId2;
    const username1 = utilities.randomString();
    const username2 = utilities.randomString();

    before((done) => {
      safelySignUpUser(username1, null, false, createdUserIds)
        .then((user) => {
          userToRemoveId1 = user.data._id;
        })
        .then(() => Kinvey.User.signup({ username: username2 }, { state: false }))
        .then((user) => {
          userToRemoveId2 = user.data._id;
        })
        .then(() => Kinvey.User.signup())
        .then((user) => {
          createdUserIds.push(user.data._id);
          done();
        })
        .catch(done);
    });

    it('should throw a KinveyError if an id is not provided', (done) => {
      Kinvey.User.remove()
        .catch((error) => {
          expect(error.message).to.equal('An id was not provided.');
          done();
        })
        .catch(done);
    });

    it('should throw a KinveyError if an id is not a string', (done) => {
      Kinvey.User.remove(1)
        .catch((error) => {
          expect(error.message).to.equal('The id provided is not a string.');
          done();
        })
        .catch(done);
    });

    it('should return the error from the server if the id does not exist', (done) => {
      Kinvey.User.remove(utilities.randomString())
        .catch((error) => {
          expect(error.message).to.equal('This user does not exist for this app backend.');
          done();
        })
        .catch(done);
    });

    it('should remove the user that matches the id argument, but the user should remain in the Backend', (done) => {
      Kinvey.User.remove(userToRemoveId1)
        .then(() => Kinvey.User.exists(username1))
        .then((result) => {
          expect(result).to.be.true;
          const query = new Kinvey.Query();
          query.equalTo('username', username1);
          return Kinvey.User.lookup(query).toPromise();
        })
        .then((users) => {
          expect(users.length).to.equal(0);
          done();
        })
        .catch(done);
    });

    it('should not logout user after remove', () => {
      return Kinvey.User.remove(userToRemoveId1)
        .then(async () => {
          const activeUser = await Kinvey.User.getActiveUser();
          expect(activeUser).to.not.equal(null);
        });
    });

    it('should remove the user that matches the id argument permanently', (done) => {
      Kinvey.User.remove(userToRemoveId2, { hard: true })
        .then(() => Kinvey.User.exists(username2))
        .then((result) => {
          expect(result).to.be.false;
          done();
        })
        .catch(done);
    });
  });

  describe('exists()', () => {
    const username = utilities.randomString();

    before((done) => {
      safelySignUpUser(username, null, true, createdUserIds)
        .then(() => done())
        .catch(done);
    });

    it('should return true if the user exists in the Backend', (done) => {
      Kinvey.User.exists(username)
        .then((result) => {
          expect(result).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should return false if the user does not exist in the Backend', (done) => {
      Kinvey.User.exists(utilities.randomString())
        .then((result) => {
          expect(result).to.be.false;
          done();
        })
        .catch(done);
    });
  });

  describe('email sending operations', () => {
    const username = utilities.randomString();
    let email;

    before((done) => {
      safelySignUpUser(username, null, true, createdUserIds)
        .then((user) => {
          email = user.data.email;
          done();
        })
        .catch(done);
    });

    describe('verifyEmail()', () => {
      it('should start the email verification and User.me should get the updated user from the server', (done) => {
        Kinvey.User.verifyEmail(username)
          .then(() => {
            // Kinvey.User.me() is used to get the created emailVerification field from the server
            return Kinvey.User.me();
          })
          .then((user) => {
            expect(user.metadata.emailVerification).to.exist;
            expect(user.metadata.llt).to.exist;
            done();
          })
          .catch(done);
      });

      it('should throw an error if a username is not provided', (done) => {
        Kinvey.User.verifyEmail()
          .catch((error) => {
            expect(error.message).to.equal(getMissingUsernameErrorMessage);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the provided username is not a string', (done) => {
        Kinvey.User.verifyEmail(1)
          .catch((error) => {
            expect(error.message).to.equal(getNotAStringErrorMessage('username'));
            done();
          })
          .catch(done);
      });
    });

    describe('forgotUsername()', () => {
      it('should start the email sending process on the server', (done) => {
        Kinvey.User.forgotUsername(email)
          .then((result) => {
            expect(['', null]).to.include(result);
            done();
          })
          .catch(done);
      });

      it('should throw an error if an email is not provided', (done) => {
        Kinvey.User.forgotUsername()
          .catch((error) => {
            expect(error.message).to.equal(getMissingEmailErrorMessage);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the provided email is not a string', (done) => {
        Kinvey.User.forgotUsername(1)
          .catch((error) => {
            expect(error.message).to.equal(getNotAStringErrorMessage('email'));
            done();
          })
          .catch(done);
      });
    });

    describe('resetPassword()', () => {
      it('should start the reset password procedure on the server', (done) => {
        Kinvey.User.resetPassword(username)
          .then((result) => {
            expect(['', null]).to.include(result);
            done();
          })
          .catch(done);
      });

      it('should throw an error if a username is not provided', (done) => {
        Kinvey.User.resetPassword()
          .catch((error) => {
            expect(error.message).to.equal(getMissingUsernameErrorMessage);
            done();
          })
          .catch(done);
      });

      it('should throw an error if the provided username is not a string', (done) => {
        Kinvey.User.resetPassword(1)
          .catch((error) => {
            expect(error.message).to.equal(getNotAStringErrorMessage('username'));
            done();
          })
          .catch(done);
      });
    });
  });

  describe('restore', () => {
    before(() => {
      return Kinvey.User.logout()
        .then(() => Kinvey.User.signup())
        .then((user) => {
          createdUserIds.push(user.data._id);
        });
    });

    it('should return error when using the function', (done) => {
      Kinvey.User.restore('nonExistingUser')
        .then(() => {
          Promise.reject(new Error('This should not happen'));
        })
        .catch((err) => {
          expect(err.message).to.equal('This function requires a master secret to be provided for your application. We strongly advise not to do this.');
          done();
        });
    });
  });

  describe('signUpWithIdentity', () => {
    before(() => {
      return Kinvey.User.logout()
        .then(() => Kinvey.User.signup())
        .then((user) => {
          createdUserIds.push(user.data._id);
        });
    });

    it('should return error when using the function', function() {
      return Kinvey.User.signUpWithIdentity('identity')
        .then(() => {
          Promise.reject(new Error('This should not happen'));
        })
        .catch((err) => {
          expect(err.message).to.equal('This function has been deprecated. You should use MIC to login instead.');
        });
    });
  });
});
