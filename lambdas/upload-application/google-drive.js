/**
 * NOTE:
 * This implementation is intentionally duplicated between upload-application
 * and load-template Lambdas.
 *
 * We avoid extracting a shared module because Lambdas are currently deployed
 * independently through ZIP packages.
 *
 * Update both copies together if authentication requirements change.
 */
const { google } = require('googleapis');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient();

let driveClient = null;

async function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const res = await ssm.send(
    new GetParameterCommand({
      Name: process.env.GOOGLE_PRIVATE_KEY_PARAM,
      WithDecryption: true,
    }),
  );

  let privateKey = res.Parameter.Value;

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  await auth.authorize();

  driveClient = google.drive({
    version: 'v3',
    auth,
  });

  return driveClient;
}

module.exports = {
  getDriveClient,
};
