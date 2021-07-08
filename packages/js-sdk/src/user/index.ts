import { Query } from '../query';
import { exists, ExistsOptions } from './exists';
import { forgotUsername, ForgotUsernameOptions } from './forgotUsername';
import { login, LoginOptions } from './login';
import { loginWithMFA, MFACompleteResult, MFAContext } from './loginWithMFA';
import { loginWithRecoveryCode } from './loginWithRecoveryCode';
import { loginWithRedirectUri, MICOptions } from './loginWithRedirectUri';
import { loginWithMICUsingResourceOwnerCredentials } from './loginWithMICUsingResourceOwnerCredentials';
import { loginWithMIC, AuthorizationGrant } from './loginWithMIC';
import { logout } from './logout';
import { lookup, LookupOptions } from './lookup';
import { me } from './me';
import { remove } from './remove';
import { resetPassword } from './resetPassword';
import { restore } from './restore';
import { signup } from './signup';
import { signUpWithIdentity } from './signupWithIdentity';
import { update } from './update';
import { getActiveUser } from './getActiveUser';
import { User as KinveyUser } from './user';
import { verifyEmail, VerifyEmailOptions } from './verifyEmail';
import { registerForLiveService } from './registerForLiveService';
import { unregisterFromLiveService } from './unregisterFromLiveService';
import { invalidateTokens } from './invalidateTokens';


export { AuthorizationGrant };

export class User extends KinveyUser {
  static exists(username: string, options?: ExistsOptions) {
    return exists(username, options);
  }

  static forgotUsername(email: string, options?: ForgotUsernameOptions) {
    return forgotUsername(email, options);
  }

  static invalidateTokens() {
    return invalidateTokens();
  }

  static login(username: string, password: string, options?: LoginOptions) {
    return login(username, password, options);
  }

  static loginWithMFA(
    username: string,
    password: string,
    selectAuthenticator: (authenticators: object[], context: MFAContext) => Promise<string>,
    mfaComplete: (authenticator: string, context: MFAContext) => Promise<MFACompleteResult>,
    options: LoginOptions = {}
  ) {
    return loginWithMFA(username, password, selectAuthenticator, mfaComplete, options);
  }

  static loginWithRecoveryCode(username: string, password: string, recoveryCode: string, options: LoginOptions = {}) {
    return loginWithRecoveryCode(username, password, recoveryCode, options);
  }

  static loginWithRedirectUri(redirectUri: string, options?: MICOptions) {
    return loginWithRedirectUri(redirectUri, options);
  }

  static loginWithMICUsingResourceOwnerCredentials(username: string, password: string, options?: MICOptions) {
    return loginWithMICUsingResourceOwnerCredentials(username, password, options);
  }

  static loginWithMIC(redirectUri: string, authorizationGrant: AuthorizationGrant, options?: any) {
    return loginWithMIC(redirectUri, authorizationGrant, options);
  }

  static logout(options?: any) {
    return logout(options);
  }

  static lookup(query?: Query, options?: LookupOptions) {
    return lookup(query, options);
  }

  static me(options?: { timeout?: number }) {
    return me(options);
  }

  static remove(id: string, options?: { timeout?: number, hard?: boolean }) {
    return remove(id, options);
  }

  static resetPassword(username: string, options?: { timeout?: number }) {
    return resetPassword(username, options);
  }

  static restore() {
    return restore();
  }

  static signup(data: object | User, options?: { timeout?: number, state?: boolean }) {
    return signup(data, options);
  }

  static signUpWithIdentity() {
    return signUpWithIdentity();
  }

  static update(data: any, options?: { timeout?: number }) {
    return update(data, options);
  }

  static getActiveUser() {
    return getActiveUser();
  }

  static verifyEmail(username: string, options?: VerifyEmailOptions) {
    return verifyEmail(username, options);
  }

  static registerForLiveService(options?: { timeout?: number }) {
    return registerForLiveService(options);
  }

  static unregisterFromLiveService(options?: { timeout?: number }) {
    return unregisterFromLiveService(options);
  }
}
