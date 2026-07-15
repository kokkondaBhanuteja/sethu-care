// Metro config for the customer app inside the pnpm monorepo.
// - watchFolders adds the workspace root so Metro sees the shared @sethu/* packages.
// - nodeModulesPaths lets Metro resolve deps from both the app and the hoisted workspace root.
// - withNativeWind wires the Tailwind/global.css pipeline.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./src/global.css" });
