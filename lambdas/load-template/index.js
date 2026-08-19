const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});

exports.handler = async (event) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://salcf-grantapplications.vercel.app',
  ];

  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || allowedOrigins[0];
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  const method =
    event.requestContext?.http?.method || headers['x-http-method'] || 'POST';

  // Preflight
  if (method === 'OPTIONS') {
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
    const { templateName } = JSON.parse(event.body || '{}');

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `templates/${templateName}.md`,
    };

    const file = await s3.send(new GetObjectCommand(params));
    const markdown = await streamToString(file.Body);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Content-Type': 'text/plain',
      },
      body: markdown,
    };
  } catch (err) {
    console.error('Template load error:', err);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to load template',
        details: err.message,
      }),
    };
  }
};

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}
