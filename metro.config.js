const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Keeps function and component names in release builds, so a problem report names the screen that
// failed instead of a letter. The bundle grows a little.
const minifier = config.transformer.minifierConfig ?? {}
config.transformer.minifierConfig = {
  ...minifier,
  keep_classnames: true,
  keep_fnames: true,
  mangle: { ...(minifier.mangle ?? {}), keep_classnames: true, keep_fnames: true },
}

module.exports = config
