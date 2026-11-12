// lambdas/upload-application/index.js
const { getDriveClient } = require('./google-drive');
const { Readable } = require('stream');

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

    const applicant = formData.requestingOrganization
      ? formData.requestingOrganization
      : formData.applicantName;

    const applicationKind = formData.requestingOrganization
      ? 'Grant Application'
      : 'Scholarship Application';

    const safeApplicant = applicant.replace(/[^a-z0-9]/gi, '_');
    const safeKind = applicationKind.replace(/[^a-z0-9]/gi, '_');

    const fileName = `${safeApplicant}-${safeKind}-${Date.now()}.pdf`;

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
