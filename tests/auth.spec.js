import { expect } from 'chai';
import { init, User } from '__SDK__';
import { randomString } from './utils';

before(() => {
  return init({
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    masterSecret: process.env.MASTER_SECRET
  });
});

describe('Auth', () => {
  describe('login()', () => {
    afterEach(() => {
      return User.logout();
    });

    it('should login', async () => {
      const username = randomString();
      const password = randomString();
      await User.signup({ username, password }, { state: false });
      const user = await User.login(username, password);
      expect(user.username).to.equal(username);
      await User.remove(user._id, { hard: true });
    });

    it('should login by providing credentials as an object', async () => {
      const username = randomString();
      const password = randomString();
      await User.signup({ username, password }, { state: false });
      const user = await User.login({ username, password });
      expect(user.username).to.equal(username);
      await User.remove(user._id, { hard: true });
    });
  });

  describe('logout()', () => {
    it('should logout', async () => {
      const username = randomString();
      const password = randomString();
      const user = await User.signup({ username, password });
      await User.logout();
      expect(User.getActiveUser()).to.be.null;
      await User.login({ username, password });
      await User.remove(user._id, { hard: true });
    });

    it('should logout when there is not an active user', async () => {
      expect(User.getActiveUser()).to.be.null;
      await User.logout();
      expect(User.getActiveUser()).to.be.null;
    });
  });

  describe('signup()', () => {
    afterEach(() => {
      return User.logout();
    });

    it('should signup and set the user as the active user', async () => {
      const username = randomString();
      const password = randomString();
      const user = await User.signup({ username, password });
      expect(User.getActiveUser()).to.deep.equal(user);
      await User.remove(user._id, { hard: true });
    });

    it('should signup with additional properties', async () => {
      const username = randomString();
      const password = randomString();
      const name = randomString();
      const user = await User.signup({ username, password, name });
      expect(user.data).to.have.property('name', name);
      await User.remove(user._id, { hard: true });
    });

    it('should signup and not set the user as the active user if options.state is false', async () => {
      const username = randomString();
      const password = randomString();
      const user = await User.signup({ username, password }, { state: false });
      expect(User.getActiveUser()).to.be.null;
      await User.login({ username, password });
      await User.remove(user._id, { hard: true });
    });

    it('should signup and not set the user as the active user if options.state is false', async () => {
      const user = await User.signup();
      expect(User.getActiveUser()).to.deep.equal(user);
      await User.remove(user._id, { hard: true });
    });
  });
});
