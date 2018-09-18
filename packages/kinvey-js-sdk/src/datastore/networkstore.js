import { KinveyObservable } from '../observable';
import {
  execute,
  formatKinveyBaasUrl,
  KinveyRequest,
  RequestMethod,
  Auth
} from '../http';
import Live from './live';

const NAMESPACE = 'appdata';

export function createRequest(method, url, body) {
  return new KinveyRequest({
    method,
    auth: Auth.Session,
    url,
    body
  });
}

export default class NetworkStore {
  constructor(appKey, collectionName) {
    this.appKey = appKey;
    this.collectionName = collectionName;
  }

  get pathname() {
    return `/${NAMESPACE}/${this.appKey}/${this.collectionName}`;
  }

  find(query, rawResponse = false) {
    const stream = KinveyObservable.create(async (observer) => {
      const url = formatKinveyBaasUrl(this.pathname, query ? query.toQueryObject() : undefined);
      const request = createRequest(RequestMethod.GET, url);
      try {
        const response = await execute(request);

        if (rawResponse === true) {
          observer.next(response);
        } else {
          observer.next(response.data);
        }

        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
    return stream;
  }

  count(query, rawResponse = false) {
    const stream = KinveyObservable.create(async (observer) => {
      const url = formatKinveyBaasUrl(`${this.pathname}/_count`, query ? query.toQueryObject() : undefined);
      const request = createRequest(RequestMethod.GET, url);
      try {
        const response = await execute(request);

        if (rawResponse === true) {
          observer.next(response);
        } else {
          observer.next(response.data);
        }

        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
    return stream;
  }

  findById(id, rawResponse = false) {
    const stream = KinveyObservable.create(async (observer) => {
      const url = formatKinveyBaasUrl(`${this.pathname}/${id}`);
      const request = createRequest(RequestMethod.GET, url);
      try {
        const response = await execute(request);

        if (rawResponse === true) {
          observer.next(response);
        } else {
          observer.next(response.data);
        }

        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
    return stream;
  }

  async create(doc, rawResponse = false) {
    const url = formatKinveyBaasUrl(this.pathname);
    const request = createRequest(RequestMethod.POST, url, doc);
    const response = await execute(request);

    if (rawResponse === true) {
      return response;
    }

    return response.data;
  }

  async update(doc, rawResponse = false) {
    const url = formatKinveyBaasUrl(`${this.pathname}/${doc._id}`);
    const request = createRequest(RequestMethod.PUT, url, doc);
    const response = await execute(request);

    if (rawResponse === true) {
      return response;
    }

    return response.data;
  }

  save(doc, options) {
    if (doc._id) {
      return this.update(doc, options);
    }

    return this.create(doc, options);
  }

  async remove(query, rawResponse = false) {
    const url = formatKinveyBaasUrl(this.pathname, query ? query.toQueryObject() : undefined);
    const request = createRequest(RequestMethod.DELETE, url);
    const response = await execute(request);

    if (rawResponse === true) {
      return response;
    }

    return response.data;
  }

  async removeById(id, rawResponse = false) {
    const url = formatKinveyBaasUrl(`${this.pathname}/${id}`);
    const request = createRequest(RequestMethod.DELETE, url);
    const response = await execute(request);

    if (rawResponse === true) {
      return response;
    }

    return response.data;
  }

  async subscribe(receiver) {
    const live = new Live(this.appKey, this.collectionName);
    await live.subscribe(receiver);
  }

  async unsubscribe() {
    const live = new Live(this.appKey, this.collectionName);
    await live.unsubscribe();
  }
}
