// lambdas/notify-board/index.js
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-west-2' });

exports.handler = async (event) => {
  try {
    const body =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const { formData, fileUrl, applicationType } = body;

    if (!formData || !fileUrl) {
      return response(400, { error: 'Missing formData or fileUrl' });
    }

    const org = formData.requestingOrganization || 'Unknown organization';
    const contact = formData.contactPerson || 'Unknown contact';
    const email =
      formData.contactEmail || formData.applicantEmail || 'Unknown email';

    const subject = `New ${applicationType || 'grant'} Application Received`;
    const html = `
      <p>A new application has been submitted.</p>
      <p><strong>Organization:</strong> ${org}</p>
      <p><strong>Contact:</strong> ${contact}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>PDF:</strong> <a href="${fileUrl}">${fileUrl}</a></p>
    `;

    await ses
      .sendEmail({
        Source: process.env.SES_FROM_ADDRESS,
        ReplyToAddresses: [email], // ⭐ board replies to applicant
        Destination: { ToAddresses: [process.env.SES_BOARD_ADDRESS] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: html } },
        },
      })
      .promise();

    return response(200, { success: true });
  } catch (err) {
    console.error('notify-board error:', err);
    return response(500, {
      error: 'Email to board failed',
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
