const { getDriveClient } = require('../shared/google-drive');

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

  // CORS Preflight
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

    const validTemplates = ['grant', 'scholarship', 'organ-scholarship'];

    if (!validTemplates.includes(templateName)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Invalid template name',
        }),
      };
    }

    const drive = await getDriveClient();

    const fileName = `${templateName}.md`;

    // Locate template file inside ApplicationTemplates folder
    const searchResult = await drive.files.list({
      q: [
        `name='${fileName}'`,
        `'${process.env.GOOGLE_TEMPLATE_FOLDER_ID}' in parents`,
        'trashed=false',
      ].join(' and '),

      fields: 'files(id,name)',

      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const file = searchResult.data.files?.[0];

    if (!file) {
      throw new Error(`Template not found: ${fileName}`);
    }

    // Download markdown file contents
    const fileResponse = await drive.files.get(
      {
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'text',
      },
    );

    const markdown = fileResponse.data;

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
    console.error('Template load error:', JSON.stringify(err, null, 2));

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
