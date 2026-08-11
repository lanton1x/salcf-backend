// lambdas/upload-application/index.js
const { google } = require('googleapis');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { Readable } = require('stream');

const ssm = new SSMClient();

// Cache drive instance outside handler across warm invocations
let driveClient = null;

async function getDriveClient() {
  if (driveClient) return driveClient;

  const res = await ssm.send(
    new GetParameterCommand({
      Name: process.env.GOOGLE_PRIVATE_KEY_PARAM,
      WithDecryption: true,
    }),
  );

  // Clean formatting for private key
  let privateKey = res.Parameter.Value;
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Initialize JWT client
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  // Force token retrieval so auth headers attach properly
  await auth.authorize();

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function bufferToStream(buffer) {
  return Readable.from(buffer);
}

function response(statusCode, body, allowOrigin) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://salcf-grantapplications.vercel.app',
  ];
  const origin = event.headers.origin;
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: '',
    };
  }

  try {
    // Reuses cached client on warm starts, creates it once on cold start
    const drive = await getDriveClient();

    const body =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const { pdfBase64, formData } = body;

    if (!pdfBase64 || !formData) {
      return response(400, { error: 'Missing pdfBase64 or formData' });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const orgName = formData.requestingOrganization || 'application';
    const fileName = `${orgName}-${Date.now()}.pdf`;

    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_FOLDER_ID],
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferToStream(pdfBuffer),
      },
      supportsAllDrives: true,
    });

    const fileId = uploadRes.data.id;

    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

    return response(200, { fileUrl, fileId });
  } catch (err) {
    console.error('upload-application error:', JSON.stringify(err, null, 2));
    return response(500, { error: 'Upload failed', details: err.message });
  }
};
