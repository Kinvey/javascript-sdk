import httpRequest = require('request');
import isFunction = require('lodash/isFunction');
import nock = require('nock');

import { Kinvey } from '../src/kinvey';
import { randomString } from '../src/utils/string';
import { Middleware } from '../src/rack/middleware';
import { isDefined } from '../src/utils/object';
import { TimeoutError, NetworkConnectionError } from '../src/errors';
import { NetworkRack } from '../src/rack';
import { Client } from '../src/client';

class HttpMiddleware extends Middleware {
  xhrRequest?: XMLHttpRequest;

  constructor(name = 'Http Middleware') {
    super(name);
  }

  handle(request) {
    const promise = new Promise((resolve, reject) => {
      const { url, method, headers, body, timeout, followRedirect } = request;

      httpRequest({
        method: method,
        url: url,
        headers: headers,
        body: body,
        followRedirect: followRedirect,
        timeout: timeout
      }, (error, response, body) => {
        if (isDefined(response) === false) {
          if (error.code === 'ESOCKETTIMEDOUT' || error.code === 'ETIMEDOUT') {
            return reject(new TimeoutError('The network request timed out.'));
          } else if (error.code === 'ENOENT') {
            return reject(new NetworkConnectionError('You do not have a network connection.'));
          }

          return reject(error);
        }

        return resolve({
          response: {
            statusCode: response.statusCode,
            headers: response.headers,
            data: body
          }
        });
      });
    });
    return promise;
  }

  cancel() {
    if (isDefined(this.xhrRequest) && isFunction(this.xhrRequest.abort)) {
      this.xhrRequest.abort();
    }

    return Promise.resolve();
  }
}

// Setup network rack
NetworkRack.useHttpMiddleware(new HttpMiddleware());

// Init Kinvey
before(function() {
  Kinvey.init({
    appKey: randomString(),
    appSecret: randomString()
  });
});

// Clean up nock
afterEach(function() {
  nock.cleanAll();
});