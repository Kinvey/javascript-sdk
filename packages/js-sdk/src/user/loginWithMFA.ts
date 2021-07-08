import isObjectLike from 'lodash/isObjectLike';
import isBoolean from 'lodash/isBoolean';
import { KinveyError } from '../errors/kinvey';
import {
  setSession,
  setMFASession,
  removeMFASession,
  formatKinveyBaasUrl,
  HttpRequestMethod,
  KinveyHttpRequest,
  KinveyBaasNamespace,
  KinveyHttpAuth,
  setDeviceToken,
  getDeviceToken,
  hasDeviceToken,
  removeDeviceToken,
} from '../http';
import { User } from './user';
import { LoginOptions, validateNoActiveUser, executeLoginRequest, validateCredentials } from './login';

const errMsgNoAuthenticators = 'User has no MFA authenticators yet. Please enable MFA.';

export interface MFAContext {
  mfaSessionToken: string;
  retries: number;
  authenticator?: any;
  error?: any;
}

async function executeChallengeRequest(authenticatorId: string): Promise<any> {
  const request = new KinveyHttpRequest({
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.MFASessionToken,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.User, '/mfa/challenge'),
    body: { authenticatorId },
  });

  const response = await request.execute();
  return response.data;
}

async function executeCompleteRequest(code, trustDevice = false): Promise<object> {
  const request = new KinveyHttpRequest({
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.MFASessionToken,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.User, '/mfa/complete'),
    body: {
      code,
      createDeviceToken: trustDevice,
    },
  });

  const response = await request.execute();
  response.data.user._kmd.authtoken = response.data.authToken;
  return response.data;
}

async function completeMFALoginRetryable(
  mfaComplete: (authenticator: string, context: MFAContext) => Promise<MFACompleteResult>,
  context: MFAContext,
  maxRetriesCount: number
): Promise<any> {
  if (context.retries >= maxRetriesCount) {
    throw new KinveyError('Max retries count exceeded.');
  }

  const errMsgNoCode = 'MFA code is missing.';
  const errMsgTrustDevice = 'trustDevice should be boolean.';
  const mfaCompleteResult = await mfaComplete(context.authenticator.id, context);
  if (!isObjectLike(mfaCompleteResult) || mfaCompleteResult.code == null) {
    throw new KinveyError(errMsgNoCode);
  }

  if (mfaCompleteResult.trustDevice != null && !isBoolean(mfaCompleteResult.trustDevice)) {
    throw new KinveyError(errMsgTrustDevice);
  }

  try {
    const trustDevice = mfaCompleteResult.trustDevice || false;
    const mfaData = await executeCompleteRequest(mfaCompleteResult.code, trustDevice);
    return mfaData;
  } catch (err) {
    context.retries += 1; // eslint-disable-line no-param-reassign
    context.error = err; // eslint-disable-line no-param-reassign
    return completeMFALoginRetryable(mfaComplete, context, maxRetriesCount);
  }
}

export interface MFACompleteResult {
  code: string;
  trustDevice?: boolean;
}

async function _loginWithMFA(
  username: string,
  password: string,
  selectAuthenticator: (authenticators: object[], context: MFAContext) => Promise<string>,
  mfaComplete: (authenticator: string, context: MFAContext) => Promise<MFACompleteResult>,
  options: LoginOptions = {}
): Promise<User> {
  await validateNoActiveUser();

  const credentials = validateCredentials(username, password);
  if (!selectAuthenticator) {
    throw new KinveyError('Function to select authenticator is missing.');
  }

  if (!mfaComplete) {
    throw new KinveyError('Function to complete MFA is missing.');
  }

  const userHasDeviceToken = await hasDeviceToken(credentials.username);
  if (userHasDeviceToken) {
    credentials.deviceToken = await getDeviceToken(credentials.username);
  }

  const loginResult = await executeLoginRequest(credentials, options.timeout);
  if (!loginResult.mfaRequired) {
    await setSession(loginResult.user);
    return new User(loginResult.user);
  }

  if (userHasDeviceToken) {
    // MFA is still required which means that the device token has expired
    await removeDeviceToken(credentials.username);
  }

  await setMFASession({ mfaSessionToken: loginResult.mfaSessionToken, userId: loginResult.userId });
  if (loginResult.authenticators.length === 0) {
    throw new KinveyError(errMsgNoAuthenticators);
  }

  const context = {
    mfaSessionToken: loginResult.mfaSessionToken,
    retries: 0,
    authenticator: null,
  };
  const selectedAuthenticatorId = await selectAuthenticator(loginResult.authenticators, context);
  if (selectedAuthenticatorId == null) {
    throw new KinveyError('MFA authenticator ID is missing.');
  }

  context.authenticator = loginResult.authenticators.find((a) => a.id === selectedAuthenticatorId);
  await executeChallengeRequest(selectedAuthenticatorId);

  const mfaResult = await completeMFALoginRetryable(mfaComplete, context, 10);
  if (mfaResult.deviceToken) {
    await setDeviceToken(mfaResult.user.username, mfaResult.deviceToken);
  }
  await removeMFASession();
  await setSession(mfaResult.user);
  return new User(mfaResult.user);
}

export async function loginWithMFA(
  username: string,
  password: string,
  selectAuthenticator: (authenticators: object[], context: MFAContext) => Promise<string>,
  mfaComplete: (authenticator: string, context: MFAContext) => Promise<MFACompleteResult>,
  options: LoginOptions = {}
): Promise<User> {
  try {
    return _loginWithMFA(username, password, selectAuthenticator, mfaComplete, options);
  } catch (err) {
    if (err.message !== errMsgNoAuthenticators) {
      await removeMFASession();
    }

    throw err;
  }
}
