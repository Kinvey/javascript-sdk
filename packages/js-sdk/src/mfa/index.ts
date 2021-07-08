import { getActiveUser } from '../user/getActiveUser';
import {
  createMFAAuthenticator,
  CreateMFAAuthenticatorResult,
  MFAAuthenticator,
  NewMFAAuthenticator,
  VerifyContext,
} from '../user/createMFAAuthenticator';
import { KinveyError } from '../errors/kinvey';
import { getMFASession } from '../http';

async function callOnActiveUser(funcName, ...args): Promise<any> {
  const activeUser = await getActiveUser();
  if (!activeUser) {
    throw new KinveyError('An active user does not exist. Please login one first.');
  }

  return activeUser[funcName](...args);
}

const Authenticators = {
  create: async function create(
    newAuthenticator: NewMFAAuthenticator,
    verify: (authenticator: MFAAuthenticator, context: VerifyContext) => Promise<string>
  ): Promise<CreateMFAAuthenticatorResult> {
    const activeUser = await getActiveUser();
    if (activeUser) {
      return createMFAAuthenticator(activeUser.data._id, newAuthenticator, verify);
    }

    const mfaUser = await getMFASession();
    if (!mfaUser) {
      throw new KinveyError('An active user, nor an MFA user exists. Please login one first.');
    }

    return createMFAAuthenticator(mfaUser.userId, newAuthenticator, verify);
  },
  list: function list(): Promise<MFAAuthenticator[]> {
    return callOnActiveUser('listAuthenticators');
  },
  remove: function remove(id: string): Promise<any> {
    return callOnActiveUser('removeAuthenticator', id);
  },
};

function listRecoveryCodes(): Promise<string[]> {
  return callOnActiveUser('listRecoveryCodes');
}

function regenerateRecoveryCodes(): Promise<string[]> {
  return callOnActiveUser('regenerateRecoveryCodes');
}

async function isEnabled(): Promise<boolean> {
  return callOnActiveUser('isMFAEnabled');
}

async function disable(): Promise<any> {
  return callOnActiveUser('disableMFA');
}

export { Authenticators, listRecoveryCodes, regenerateRecoveryCodes, isEnabled, disable };
