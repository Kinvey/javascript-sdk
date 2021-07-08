import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import { ActiveUserError } from '../errors/activeUser';
import { KinveyError } from '../errors/kinvey';
import { setSession, formatKinveyBaasUrl, HttpRequestMethod, KinveyHttpRequest, KinveyBaasNamespace, KinveyHttpAuth } from '../http';
import { getActiveUser } from './getActiveUser';
import { User } from './user';

export async function signup(data?: object | User, options: { timeout?: number, state?: boolean } = {}) {
  const activeUser = await getActiveUser();
  const { state = true } = options;

  if (data && !isPlainObject(data)) {
    throw new KinveyError('The provided data must be an object.');
  }

  if (state === true && activeUser) {
    throw new ActiveUserError('An active user already exists. Please logout the active user before you signup.');
  }

  const request = new KinveyHttpRequest({
    method: HttpRequestMethod.POST,
    auth: KinveyHttpAuth.App,
    url: formatKinveyBaasUrl(KinveyBaasNamespace.User),
    timeout: options.timeout
  });

  if (data instanceof User) {
    request.body = isEmpty(data.data) ? null : data.data;
  } else {
    request.body = isEmpty(data) ? null : data;
  }

  const response = await request.execute();
  const session = response.data;

  if (state === true) {
    await setSession(session);
  }

  return new User(session);
}
