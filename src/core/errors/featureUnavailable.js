import { BaseError } from './base';

export function FeatureUnavailableError(message, debug, code, kinveyRequestId) {
  this.name = 'FeatureUnavailableError';
  this.message = message || 'Requested functionality is unavailable in this API version.';
  this.debug = debug || undefined;
  this.code = code || undefined;
  this.kinveyRequestId = kinveyRequestId || undefined;
  this.stack = (new Error()).stack;
}
FeatureUnavailableError.prototype = Object.create(BaseError.prototype);
FeatureUnavailableError.prototype.constructor = FeatureUnavailableError;
