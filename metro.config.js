if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", {
    value() {
      return [...this].reverse();
    },
    writable: true,
    configurable: true,
  });
}

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...config.resolver.blockList,
  /[/\\]\.local[/\\]state[/\\]workflow-logs[/\\]/,
];

module.exports = config;
