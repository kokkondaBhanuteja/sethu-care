// NativeWind compiles Tailwind classes at build time via its Babel preset; `jsxImportSource:
// "nativewind"` is what makes `className` work on React Native components. babel-preset-expo (SDK
// 54+) auto-adds the react-native-worklets/reanimated plugin when installed, so it is not listed
// here.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
