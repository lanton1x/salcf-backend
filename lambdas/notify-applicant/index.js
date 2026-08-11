// lambdas/notify-applicant/index.js
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
    pdfBase64,
    recipientEmail,
    applicant,
    whoToContact,
    applicationType,
  } = JSON.parse(event.body);
  const isGrant = applicationType === 'grant';

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const filename = isGrant
    ? 'grant-application.pdf'
    : 'scholarship-application.pdf';

  await resend.emails.send({
    from: 'Contact Form <contact@luis-flores.net>',
    to: recipientEmail,
    subject: 'Your St Andrew Lutheran Church Foundation Application',
    html: `<p>Hello ${whoToContact}, your application ${isGrant ? `on behalf of ${applicant}` : ''} was received. We will email you our resolution. Thanks.</p>`,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
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
