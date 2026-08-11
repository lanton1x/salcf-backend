// lambdas/notify-board/index.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://salcf-grantapplications.vercel.app',
  ];
  const origin = event.headers.origin;
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  // Handle CORS preflight
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

  const {
    formData,
    fileUrl,
    recipient,
    applicant,
    whoToContact,
    applicationType,
  } = JSON.parse(event.body);
  const boardemail = process.env.BOARD_EMAIL;
  const isGrant = applicationType === 'grant';

  await resend.emails.send({
    from: 'Contact Form <contact@luis-flores.net>',
    to: boardemail,
    reply_to: recipient,
    subject: `New ${applicationType} application received`,
    html: `
      ${isGrant ? `<p>Organization: ${applicant}</p>` : ''}
      <p>Contact: ${whoToContact} (${recipient})</p>
      <p>Application Type: ${applicationType}</p>
      <p>PDF: <a href="${fileUrl}">View Application</a></p>
    `,
  });

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST',
    },
    body: JSON.stringify({ success: true }),
  };
};
