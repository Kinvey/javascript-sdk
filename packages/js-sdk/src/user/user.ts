import isArray from 'lodash/isArray';
import { Acl } from '../acl';
import { Kmd } from '../kmd';
import { getDeviceId } from '../device';
import {
  getSession,
  setSession,
  removeSession,
  removeMFASession,
  removeDeviceToken,
  formatKinveyBaasUrl,
  HttpRequestMethod,
  KinveyHttpRequest,
  KinveyBaasNamespace,
  KinveyHttpAuth,
} from '../http';
import { KinveyError } from '../errors/kinvey';
import { Entity } from '../storage';
import { DataStoreCache, QueryCache, SyncCache } from '../datastore/cache';
import { subscribe, unsubscribe, isSubscribed } from '../live';
import { logger } from '../log';
import { mergeSocialIdentity } from './utils';
import { signup } from './signup';
import {
  createMFAAuthenticator,
  CreateMFAAuthenticatorResult,
  MFAAuthenticator,
  NewMFAAuthenticator,
  VerifyContext,
} from './createMFAAuthenticator';

export interface UserData extends Entity {
  _socialIdentity?: object;
  username?: string;
  email?: string;
}

export class User {
  public data: UserData;

  constructor(data: UserData = {}) {
    this.data = data;
  }

  get _id() {
    if (this.data) {
      return this.data._id;
    }
    return undefined;
  }

  get _acl() {
    if (this.data) {
      return new Acl(this.data);
    }
    return undefined;
  }

  get _kmd() {
    if (this.data) {
      return new Kmd(this.data);
    }
    return undefined;
  }

  get metadata() {
    return this._kmd;
  }

  get authtoken() {
    const kmd = this._kmd;

    if (kmd) {
      return kmd.authtoken;
    }

    return undefined;
  }

  get _socialIdentity() {
    return this.data._socialIdentity;
  }

  get username() {
    if (this.data) {
      return this.data.username;
    }
    return undefined;
  }

  get email() {
    if (this.data) {
      return this.data.email;
    }
    return undefined;
  }

  async isActive(): Promise<boolean> {
    const activeUser = await getSession();
    if (activeUser && activeUser._id === this._id) {
      return true;
    }
    return false;
  }

  isEmailVerified() {
    const metadata = this.metadata;
    if (metadata) {
      return metadata.isEmailConfirmed();
    }
    return false;
  }

  async signup(options: { timeout?: number, state?: boolean } = {}) {
    return signup(this.data, options);
  }

  async me(options: { timeout?: number } = {}) {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.GET,
      auth: KinveyHttpAuth.Session,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, '/_me'),
      timeout: options.timeout,
    });
    const response = await request.execute();
    const { data } = response;

    // Remove sensitive data
    delete data.password;

    // Merge _socialIdentity
    if (data._socialIdentity) {
      data._socialIdentity = mergeSocialIdentity(this._socialIdentity, data._socialIdentity);
    }

    // Update the active session
    if (await this.isActive()) {
      data._kmd.authtoken = this.authtoken;
      await setSession(data);
    }

    this.data = data;
    return this;
  }

  async update(data: object, options: { timeout?: number } = {}) {
    const body = Object.assign({}, this.data, data);

    if (!data) {
      throw new KinveyError('No user was provided to be updated.');
    }

    if (isArray(data)) {
      throw new KinveyError('Only one user can be updated at one time.');
    }

    if (!body._id) {
      throw new KinveyError('User must have an _id.');
    }

    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.PUT,
      auth: KinveyHttpAuth.SessionOrMaster,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}`),
      body,
      timeout: options.timeout
    });
    const response = await request.execute();
    const updatedData = response.data;

    // Remove sensitive data
    delete updatedData.password;

    // Merge _socialIdentity
    if (updatedData._socialIdentity) {
      updatedData._socialIdentity = mergeSocialIdentity(this._socialIdentity, updatedData._socialIdentity);
    }

    // Update the active session
    if (await this.isActive()) {
      await setSession(updatedData);
    }

    this.data = updatedData;
    return this;
  }

  async registerForLiveService(options: { timeout?: number } = {}) {
    if (!isSubscribed()) {
      // Register the user
      const deviceId = await getDeviceId();
      const request = new KinveyHttpRequest({
        method: HttpRequestMethod.POST,
        auth: KinveyHttpAuth.Session,
        url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/register-realtime`),
        body: { deviceId },
        timeout: options.timeout
      });
      const response = await request.execute();
      const config = Object.assign({}, { authKey: this.authtoken }, response.data);

      // Subscribe to PubNub
      subscribe(config);
    }
    return true;
  }

  async unregisterFromLiveService(options: { timeout?: number } = {}) {
    if (isSubscribed()) {
      // Unsubscribe from PubNub
      unsubscribe();

      // Unregister the user
      const deviceId = await getDeviceId();
      const request = new KinveyHttpRequest({
        method: HttpRequestMethod.POST,
        auth: KinveyHttpAuth.Session,
        url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/unregister-realtime`),
        body: { deviceId },
        timeout: options.timeout
      });
      await request.execute();
    }

    return true;
  }

  async createAuthenticator(
    newAuthenticator: NewMFAAuthenticator,
    verify: (authenticator: MFAAuthenticator, context: VerifyContext) => Promise<string>
  ): Promise<CreateMFAAuthenticatorResult> {
    return createMFAAuthenticator(this._id, newAuthenticator, verify);
  }

  async listAuthenticators(): Promise<MFAAuthenticator[]> {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.GET,
      auth: KinveyHttpAuth.SessionOrMaster,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/authenticators`),
    });

    const { data } = await request.execute();
    return data.map((a) => {
      return { id: a.id, name: a.name, type: a.type };
    });
  }

  async removeAuthenticator(id: string) {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.DELETE,
      auth: KinveyHttpAuth.SessionOrMaster,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/authenticators/${id}/`),
    });

    await request.execute();
    return null;
  }

  async listRecoveryCodes(): Promise<string[]> {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.GET,
      auth: KinveyHttpAuth.SessionOrMaster,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/recovery-codes`),
    });

    const { data } = await request.execute();
    return data.recoveryCodes;
  }

  async regenerateRecoveryCodes(): Promise<string[]> {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.POST,
      auth: KinveyHttpAuth.SessionOrMaster,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/recovery-codes`),
    });

    const { data } = await request.execute();
    return data.recoveryCodes;
  }

  async isMFAEnabled(): Promise<boolean> {
    return (await this.listAuthenticators()).length > 0;
  }

  async disableMFA(): Promise<any> {
    const authenticators = await this.listAuthenticators();
    await Promise.all(authenticators.map((a) => this.removeAuthenticator(a.id)));
    return true;
  }

  async _cleanup(kinveyRequest, operationName, cleanEntireSessionStore = false) {
    if (!(await this.isActive())) {
      return this;
    }

    this.unregisterFromLiveService();
    // TODO: unregister push

    try {
      await kinveyRequest.execute();
    } catch (error) {
      logger.error(`${operationName} failed.`);
      logger.error(error.message);
    }

    await removeSession();
    if (cleanEntireSessionStore) {
      await removeMFASession();
      await removeDeviceToken(this.data.username);
    }

    await QueryCache.clear();
    await SyncCache.clear();
    await DataStoreCache.clear();
    return this;
  }

  async logout(options: { timeout?: number } = {}) {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.POST,
      auth: KinveyHttpAuth.Session,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, '/_logout'),
      timeout: options.timeout,
    });
    return this._cleanup(request, 'Logout request');
  }

  async invalidateTokens() {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.DELETE,
      auth: KinveyHttpAuth.Session,
      url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${this._id}/tokens`),
    });

    return this._cleanup(request, 'Tokens invalidation', true);
  }
}
