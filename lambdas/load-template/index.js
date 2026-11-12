const { getDriveClient } = require('./google-drive');

exports.handler = async (event) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://vercel.app',
  ];

  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || allowedOrigins[0];
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];
  const method =
    event.requestContext?.http?.method || headers['x-http-method'] || 'POST';

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
    const bodyData = JSON.parse(event.body || '{}');
    const context = bodyData.context || 'grant_templates';
    const drive = await getDriveClient();

    // Helper to list files in a folder safely
    const listFolder = async (folderId) => {
      if (!folderId) return [];
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields:
          'files(id, name, mimeType, webViewLink, thumbnailLink, description)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 100,
      });
      return res.data.files || [];
    };

    // Helper to download a specific markdown file's text by name and folder
    const downloadMarkdown = async (fileName, folderId) => {
      if (!folderId) return '';
      const search = await drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const file = search.data.files?.[0];
      if (!file) {
        console.warn(`File not found: ${fileName} in folder ${folderId}`);
        return '';
      }
      const res = await drive.files.get(
        { fileId: file.id, alt: 'media', supportsAllDrives: true },
        { responseType: 'text' },
      );
      return res.data;
    };

    // ==========================================
    // PATH A: SINGLE-TRIP SITE BOOTSTRAP (1 API CALL)
    // ==========================================
    if (context === 'site_bootstrap') {
      const mdFolder = process.env.FOLDER_ID_MD_CONTENT;

      const [
        mission,
        board,
        giftpolicies,
        giftpolicies_faq,
        homeClips,
        memorialItems,
        legacyItems,
        annualReports,
      ] = await Promise.all([
        downloadMarkdown('mission.md', mdFolder),
        downloadMarkdown('board.md', mdFolder),
        downloadMarkdown('giftpolicies.md', mdFolder),
        downloadMarkdown('giftpolicies_faq.md', mdFolder),
        listFolder(process.env.FOLDER_ID_VIDEOS || process.env.BASE_FOLDER_ID),
        listFolder(process.env.FOLDER_ID_MEMORIALS),
        listFolder(process.env.FOLDER_ID_LEGACY_GIFTS),
        listFolder(process.env.FOLDER_ID_ANNUAL_REPORTS),
      ]);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mission,
          board,
          giftpolicies,
          giftpolicies_faq,
          homeClips,
          memorialItems,
          legacyItems,
          annualReports,
        }),
      };
    }

    // ==========================================
    // PATH B: LEGACY SPA GRANT TEMPLATES (UNCHANGED)
    // ==========================================
    const { templateName } = bodyData;
    const validTemplates = ['grant', 'scholarship', 'organ-scholarship'];

    if (!validTemplates.includes(templateName)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: `Invalid template name: ${templateName}`,
        }),
      };
    }

    const markdown = await downloadMarkdown(
      `${templateName}.md`,
      process.env.GOOGLE_TEMPLATE_FOLDER_ID,
    );

    if (!markdown) {
      throw new Error(`Template not found: ${templateName}.md`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Content-Type': 'text/plain',
      },
      body: markdown,
    };
  } catch (err) {
    // Properly serialize Error message and stack trace for CloudWatch
    console.error('Resource fetch execution error:', err.message, err.stack);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to load resources',
        details: err.message,
      }),
    };
  }
};
