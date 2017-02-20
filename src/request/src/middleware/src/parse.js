import Middleware from './middleware';

export default class ParseMiddleware extends Middleware {
  constructor(name = 'Parse Middleware') {
    super(name);
  }

  handle(request, response) {
    if (response && response.data) {
      const contentType = response.headers['content-type'] || response.headers['Content-Type'];

      if (contentType) {
        if (contentType.indexOf('application/json') === 0) {
          try {
            response.data = JSON.parse(response.data);
          } catch (error) {
            // Just catch the error
          }
        }
      }
    }

    return Promise.resolve({ response: response });
  }
}
