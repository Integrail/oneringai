/**
 * Apple Notarization Script for HOSEA
 * Called by electron-builder after signing the app.
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('  • Skipping notarization (not macOS)');
    return;
  }

  // Skip if credentials not provided
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('  • Skipping notarization (credentials not set)');
    console.log('    Set APPLE_ID, APPLE_APP_PASSWORD, and APPLE_TEAM_ID to enable');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`  • Notarizing ${appName}.app...`);
  console.log('    This may take a few minutes...');

  try {
    await notarize({
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log('  • Notarization complete!');
  } catch (error) {
    console.error('  • Notarization failed:', error.message);
    throw error;
  }
};
