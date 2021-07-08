import { Inject, Injectable } from '@angular/core';
import { init, User, Query, LoginOptions, MFAContext, MFACompleteResult } from 'kinvey-html5-sdk';
import { KinveyConfigToken } from './utils';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(@Inject(KinveyConfigToken) config: any) {
    init(config);
  }

  exists(username: string, options?: any) {
    return User.exists(username, options);
  }

  forgotUsername(email: string, options?: any) {
    return User.forgotUsername(email, options);
  }

  login(username: string, password: string, options?: LoginOptions): Promise<User> {
    return User.login(username, password, options);
  }

  loginWithMFA(
    username: string,
    password: string,
    selectAuthenticator: (authenticators: object[], context: MFAContext) => Promise<string>,
    mfaComplete: (authenticator: string, context: MFAContext) => Promise<MFACompleteResult>,
    options: LoginOptions = {}
  ): Promise<User> {
    return User.loginWithMFA(username, password, selectAuthenticator, mfaComplete, options);
  }

  loginWithRecoveryCode(username: string, password: string, recoveryCode: string, options: LoginOptions = {}): Promise<User> {
    return User.loginWithRecoveryCode(username, password, recoveryCode, options);
  }

  loginWithRedirectUri(redirectUri: string, options?: any): Promise<User> {
    return User.loginWithRedirectUri(redirectUri, options);
  }

  loginWithMICUsingResourceOwnerCredentials(username: string, password: string, options?: any): Promise<User> {
    return User.loginWithMICUsingResourceOwnerCredentials(username, password, options);
  }

  loginWithMIC(redirectUri: string, authorizationGrant: any, options?: any): Promise<User> {
    return User.loginWithMIC(redirectUri, authorizationGrant, options);
  }

  logout(options?: any): Promise<User> {
    return User.logout(options);
  }

  lookup(query?: Query, options?: any) {
    return User.lookup(query, options);
  }

  me(options?: { timeout?: number }): Promise<User> {
    return User.me(options);
  }

  remove(id: string, options?: { timeout?: number, hard?: boolean }) {
    return User.remove(id, options);
  }

  resetPassword(username: string, options?: { timeout?: number }) {
    return User.resetPassword(username, options);
  }

  restore() {
    return User.restore();
  }

  signup(data: object | User, options?: { timeout?: number, state?: boolean }): Promise<User> {
    return User.signup(data, options);
  }

  signUpWithIdentity() {
    return User.signUpWithIdentity();
  }

  update(data: any, options?: { timeout?: number }): Promise<User> {
    return User.update(data, options);
  }

  getActiveUser(): Promise<User> {
    return User.getActiveUser();
  }

  verifyEmail(username: string, options?: any) {
    return User.verifyEmail(username, options);
  }

  registerForLiveService(options?: { timeout?: number }) {
    return User.registerForLiveService(options);
  }

  unregisterFromLiveService(options?: { timeout?: number }) {
    return User.unregisterFromLiveService(options);
  }
}
