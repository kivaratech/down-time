const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/.*_tmp_.*/,
  /google-auth-library_tmp_.*/,
];

module.exports = config;
