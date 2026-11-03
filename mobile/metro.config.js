// Deixa o Metro enxergar o core compartilhado com o app de PC (../core).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../core")];
module.exports = config;
