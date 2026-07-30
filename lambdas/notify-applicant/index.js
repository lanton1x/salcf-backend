// lambdas/notify-applicant/index.js
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-west-2' });

exports.handler = async (event) => {
  try {
    const body =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const { formData, pdfBase64, recipientEmail } = body;

    if (!formData || !pdfBase64 || !recipientEmail) {
      return response(400, {
        error: 'Missing formData, pdfBase64, or recipientEmail',
      });
    }

    const contactName =
      formData.contactPerson || formData.applicantName || 'Applicant';

    const subject = 'Your Application Has Been Received';

    // Build MIME message with PDF attachment
    const boundary = `----=_Part_${Date.now()}`;
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const rawEmail =
      `From: ${process.env.SES_FROM_ADDRESS}\n` +
      `To: ${recipientEmail}\n` +
      `Subject: ${subject}\n` +
      `MIME-Version: 1.0\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\n\n` +
      `--${boundary}\n` +
      `Content-Type: text/html; charset=UTF-8\n\n` +
      `<p>Dear ${contactName},</p>
       <p>Your application has been successfully received, and it is</p>
       <p>attached to this email, in PDF form, for your records.</p>
       <p>Thank you,<br/>St. Andrew Lutheran Church Foundation</p>\n\n` +
      `--${boundary}\n` +
      `Content-Type: application/pdf; name="application.pdf"\n` +
      `Content-Disposition: attachment; filename="application.pdf"\n` +
      `Content-Transfer-Encoding: base64\n\n` +
      pdfBase64 +
      `\n--${boundary}--`;

    await ses
      .sendRawEmail({
        RawMessage: { Data: rawEmail },
      })
      .promise();

    return response(200, { success: true });
  } catch (err) {
    console.error('notify-applicant error:', err);
    return response(500, {
      error: 'Email to applicant failed',
      details: err.message,
    });
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
