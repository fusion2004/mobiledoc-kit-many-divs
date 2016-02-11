let options = {
  enabled: false,
  all: false,
  types: [],
  logs: []
};

const Logger = class Logger {
  constructor(type) {
    this.type = type;
  }

  static for(type) {
    let logger = new Logger(type);
    let logFn = (...args) => {
      logger.log(...args);
    };
    return logFn;
  }

  log(...args) {
    args.unshift('[' + this.type + ']');
    options.logs.push(args);

    if (options.enabled &&
        (options.all || options.types.indexOf(this.type) !== -1)) {
      window.console.log(...args);
    }
  }

  static enable() {
    options.enabled = true;
  }

  static disable() {
    options.enabled = false;
  }

  static enableTypes(types=[]) {
    types.forEach(type => {
      if (options.types.indexOf(type) === -1) {
        options.types.push(type);
      }
    });
  }

  static enableAll() {
    options.all = true;
  }
};

export default Logger;
