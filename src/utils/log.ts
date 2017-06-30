import Log = require('loglevel');
const originalFactory = Log.methodFactory;
Log.setDefaultLevel(Log.levels.SILENT);

Log.methodFactory = function methodFactory(methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);

  return function log(message, ...args) {
    message = `Kinvey: ${message}`;

    if (args.length > 0) {
      rawMethod(message, args);
    } else {
      rawMethod(message);
    }
  };
};

export { Log };
