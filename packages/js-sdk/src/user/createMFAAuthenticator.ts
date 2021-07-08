import pick from 'lodash/pick';
import defaults from 'lodash/defaults';

import { KinveyError } from '../errors';
import {
  formatKinveyBaasUrl,
  HttpRequestMethod,
  KinveyBaasNamespace,
  KinveyHttpAuth,
  KinveyHttpRequest,
} from '../http';

export interface MFAAuthenticator {
  id: string;
  name: string;
  type: string;
  config?: object;
}

export interface CreateMFAAuthenticatorResult {
  authenticator: MFAAuthenticator;
  recoveryCodes?: string[];
}

export enum MFAAuthenticatorType {
  TOTP = 'totp',
}

export interface NewMFAAuthenticator {
  name: string;
  type?: MFAAuthenticatorType;
}

export interface VerifyContext {
  retries: number;
  authenticator: MFAAuthenticator;
  error?: any;
}

async function _verifyAuthenticatorRetryable(
  userId: string,
  verify: (authenticator: MFAAuthenticator, context: VerifyContext) => Promise<string>,
  context: VerifyContext,
  maxRetriesCount: number
): Promise<any> {
  if (context.retries >= maxRetriesCount) {
    throw new KinveyError('Max retries count for authenticator verification exceeded.');
  }

  const code = await verify(context.authenticator, context);
  if (code == null) {
    throw new KinveyError('MFA code is missing.');
  }

  try {
    const request = new KinveyHttpRequest({
      method: HttpRequestMethod.POST,
      auth: KinveyHttpAuth.SessionOrMFASessionTokenOrMaster,
      url: formatKinveyBaasUrl(
        KinveyBaasNamespace.User,
        `/${userId}/authenticators/${context.authenticator.id}/verify`
      ),
      body: { code },
    });
    const { data } = await request.execute();
    return data;
  } catch (err) {
    context.retries += 1; // eslint-disable-line no-param-reassign
    context.error = err; // eslint-disable-line no-param-reassign
    return _verifyAuthenticatorRetryable(userId, verify, context, maxRetriesCount);
  }
}

export async function createMFAAuthenticator(
  userId: string,
  newAuthenticator: NewMFAAuthenticator,
  verify: (authenticator: MFAAuthenticator, context: VerifyContext) => Promise<string>
): Promise<CreateMFAAuthenticatorResult> {
  if (!verify) {
    throw new KinveyError('Function to verify authenticator is missing.');
  }

  const request = new KinveyHttpRequest({
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.SessionOrMFASessionTokenOrMaster,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.User, `/${userId}/authenticators`),
    body: defaults(newAuthenticator, { type: MFAAuthenticatorType.TOTP }),
  });

  const { data: authenticator } = await request.execute();
  const verifyResult = await _verifyAuthenticatorRetryable(userId, verify, { authenticator, retries: 0 }, 10);
  return {
    authenticator: pick(authenticator, ['id', 'name', 'type', 'config']),
    recoveryCodes: verifyResult.recoveryCodes || null,
  };
}
