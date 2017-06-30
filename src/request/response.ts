import assign = require('lodash/assign');

import { Headers } from './headers';
import {
  APIVersionNotAvailableError,
  APIVersionNotImplementedError,
  AppProblemError,
  BadRequestError,
  BLError,
  CORSDisabledError,
  DuplicateEndUsersError,
  FeatureUnavailableError,
  IncompleteRequestBodyError,
  IndirectCollectionAccessDisallowedError,
  InsufficientCredentialsError,
  InvalidCredentialsError,
  InvalidIdentifierError,
  InvalidQuerySyntaxError,
  JSONParseError,
  KinveyError,
  KinveyInternalErrorRetry,
  KinveyInternalErrorStop,
  MissingQueryError,
  MissingRequestHeaderError,
  MissingRequestParameterError,
  NotFoundError,
  ParameterValueOutOfRangeError,
  ServerError,
  StaleRequestError,
  UserAlreadyExistsError,
  WritesToCollectionDisallowedError
} from '../errors';

export enum StatusCode {
  Ok = 200,
  Created = 201,
  Empty = 204,
  MovedPermanently = 301,
  Found = 302,
  NotModified = 304,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,
  Unauthorized = 401,
  NotFound = 404,
  ServerError = 500
}

export interface ResponseOptions {
  statusCode?: StatusCode;
  headers?: Headers;
  data?: any;
}

export interface ResponseObject {
  statusCode: number;
  headers?: any;
  data?: any;
}

export class Response {
  statusCode: number;
  data?: any;
  private _headers: Headers;

  constructor(options: ResponseOptions) {
    this.statusCode = options.statusCode || StatusCode.Empty;
    this.headers = options.headers || new Headers();
    this.data = options.data;
  }

  get headers() {
    return this._headers;
  }

  set headers(headers) {
    if ((headers instanceof Headers) === false) {
      headers = new Headers(headers);
    }

    this._headers = headers;
  }

  get error(): Error {
    if (this.isSuccess()) {
      return null;
    }

    const data = this.data || {};
    const message = data.message || data.description;
    return new Error(message);
  }

  isSuccess(): boolean {
    return (this.statusCode >= 200 && this.statusCode < 300)
      || this.statusCode === StatusCode.MovedPermanently
      || this.statusCode === StatusCode.Found
      || this.statusCode === StatusCode.NotModified
      || this.statusCode === StatusCode.TemporaryRedirect
      || this.statusCode === StatusCode.PermanentRedirect;
  }
}

export class KinveyResponse extends Response {
  get error(): Error {
    if (this.isSuccess()) {
      return null;
    }

    const data = this.data || {};
    const name = data.name || data.error;
    const message = data.message || data.description;
    const debug = data.debug;
    const code = this.statusCode;
    const kinveyRequestId = this.headers.get('X-Kinvey-Request-ID');
    let error;

    if (name === 'APIVersionNotAvailable') {
      error = new APIVersionNotAvailableError(message, debug, code, kinveyRequestId);
    } else if (name === 'APIVersionNotImplemented') {
      error = new APIVersionNotImplementedError(message, debug, code, kinveyRequestId);
    } else if (name === 'AppProblem') {
      error = new AppProblemError(message, debug, code, kinveyRequestId);
    } else if (name === 'AppProblem') {
      error = new AppProblemError(message, debug, code, kinveyRequestId);
    } else if (name === 'BadRequest') {
      error = new BadRequestError(message, debug, code, kinveyRequestId);
    } else if (name === 'BLInternalError'
      || name === 'BLRuntimeError'
      || name === 'BLSyntaxError'
      || name === 'BLTimeoutError'
      || name === 'BLViolationError') {
      error = new BLError(message, debug, code, kinveyRequestId);
    } else if (name === 'CORSDisabled') {
      error = new CORSDisabledError(message, debug, code, kinveyRequestId);
    } else if (name === 'DuplicateEndUsers') {
      error = new DuplicateEndUsersError(message, debug, code, kinveyRequestId);
    } else if (name === 'FeatureUnavailable') {
      error = new FeatureUnavailableError(message, debug, code, kinveyRequestId);
    } else if (name === 'IncompleteRequestBody') {
      error = new IncompleteRequestBodyError(message, debug, code, kinveyRequestId);
    } else if (name === 'IndirectCollectionAccessDisallowed') {
      error = new IndirectCollectionAccessDisallowedError(message, debug, code, kinveyRequestId);
    } else if (name === 'InsufficientCredentials') {
      error = new InsufficientCredentialsError(message, debug, code, kinveyRequestId);
    } else if (name === 'InvalidCredentials') {
      error = new InvalidCredentialsError(message, debug, code, kinveyRequestId);
    } else if (name === 'InvalidIdentifier') {
      error = new InvalidIdentifierError(message, debug, code, kinveyRequestId);
    } else if (name === 'InvalidQuerySyntax') {
      error = new InvalidQuerySyntaxError(message, debug, code, kinveyRequestId);
    } else if (name === 'JSONParseError') {
      error = new JSONParseError(message, debug, code, kinveyRequestId);
    } else if (name === 'KinveyInternalErrorRetry') {
      error = new KinveyInternalErrorRetry(message, debug, code, kinveyRequestId);
    } else if (name === 'KinveyInternalErrorStop') {
      error = new KinveyInternalErrorStop(message, debug, code, kinveyRequestId);
    } else if (name === 'MissingQuery') {
      error = new MissingQueryError(message, debug, code, kinveyRequestId);
    } else if (name === 'MissingRequestHeader') {
      error = new MissingRequestHeaderError(message, debug, code, kinveyRequestId);
    } else if (name === 'MissingRequestParameter') {
      error = new MissingRequestParameterError(message, debug, code, kinveyRequestId);
    } else if (name === 'EntityNotFound'
        || name === 'CollectionNotFound'
        || name === 'AppNotFound'
        || name === 'UserNotFound'
        || name === 'BlobNotFound'
        || name === 'DocumentNotFound') {
      error = new NotFoundError(message, debug, code, kinveyRequestId);
    } else if (name === 'ParameterValueOutOfRange') {
      error = new ParameterValueOutOfRangeError(message, debug, code, kinveyRequestId);
    } else if (name === 'ServerError') {
      error = new ServerError(message, debug, code, kinveyRequestId);
    } else if (name === 'StaleRequest') {
      error = new StaleRequestError(message, debug, code, kinveyRequestId);
    } else if (name === 'UserAlreadyExists') {
      error = new UserAlreadyExistsError(message, debug, code, kinveyRequestId);
    } else if (name === 'WritesToCollectionDisallowed') {
      error = new WritesToCollectionDisallowedError(message, debug, code, kinveyRequestId);
    } if (code === StatusCode.Unauthorized) {
      error = new InsufficientCredentialsError(message, debug, code, kinveyRequestId);
    } else if (code === StatusCode.NotFound) {
      error = new NotFoundError(message, debug, code, kinveyRequestId);
    } else if (code === StatusCode.ServerError) {
      error = new ServerError(message, debug, code, kinveyRequestId);
    } else {
      error = new KinveyError(message, debug, code, kinveyRequestId);
    }

    return error;
  }
}
