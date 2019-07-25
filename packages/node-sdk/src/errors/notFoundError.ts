import { KinveyError } from './kinveyError';

export class NotFoundError extends KinveyError {
  constructor(message = 'The doc was not found.', debug?: string) {
    super(message, debug);
    this.name = 'NotFoundError';
  }
}
