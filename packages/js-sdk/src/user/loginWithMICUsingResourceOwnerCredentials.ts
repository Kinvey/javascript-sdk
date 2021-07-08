import isString from 'lodash/isString';
import { ActiveUserError } from '../errors/activeUser';
import { NotFoundError } from '../errors/notFound';
import { KinveyError } from '../errors/kinvey';
import { getAppKey } from '../kinvey';
import { login } from './login';
import { getTokenWithUsernamePassword, GetTokenWithUsernamePasswordOptions } from './mic';
import { signup } from './signup';
import { getActiveUser } from './getActiveUser';
import {loginWithSocialIdentity} from "./loginWithSocialIdentity";

export interface MICOptions extends GetTokenWithUsernamePasswordOptions {
  micId?: string;
  version?: string | number;
}

export async function loginWithMICUsingResourceOwnerCredentials(username: string, password: string, options: MICOptions = {}) {
  const activeUser = await getActiveUser();
  const { micId } = options;
  let clientId = getAppKey();

  if (activeUser) {
    throw new ActiveUserError('An active user already exists. Please logout the active user before you login with Mobile Identity Connect.');
  }
  if (!isString(username) || !isString(password)) {
    throw new KinveyError('A username and password are required and must be a string.');
  }

  if (isString(micId)) {
    clientId = `${clientId}.${micId}`;
  }

  const token = await getTokenWithUsernamePassword(username, password, clientId, options);
  const socialIdentity = { [token.identity]: token };
  const credentials = { _socialIdentity: socialIdentity };

  try {
    return await loginWithSocialIdentity(socialIdentity);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return await signup(credentials);
    }

    throw error;
  }
}
