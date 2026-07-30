// lambdas/upload-application/index.js
const { google } = require('googleapis');

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive.file'],
);

const drive = google.drive({ version: 'v3', auth });

exports.handler = async (event) => {
  try {
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
        body: pdfBuffer,
      },
    });

    const fileId = uploadRes.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

    return response(200, { fileUrl, fileId });
  } catch (err) {
    console.error('upload-application error:', err);
    return response(500, { error: 'Upload failed', details: err.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
