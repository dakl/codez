const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  // Skip notarization if env vars are not set (local dev builds)
  if (!process.env.APPLE_API_KEY_ID) {
    console.log("Skipping notarization: APPLE_API_KEY_ID not set");
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_KEY_ISSUER,
  });
};
