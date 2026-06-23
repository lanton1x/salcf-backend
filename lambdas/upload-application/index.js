// index.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const pdfBase64 = body.pdfBase64;

    if (!pdfBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing pdfBase64' }),
      };
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.create({
      requestBody: {
        name: `application-${Date.now()}.pdf`,
        parents: [process.env.GOOGLE_FOLDER_ID],
      },
      media: {
        mimeType: 'application/pdf',
        body: pdfBuffer,
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ success: true, fileId: res.data.id }),
    };
  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
