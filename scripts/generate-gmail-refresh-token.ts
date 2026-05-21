import http from 'node:http';
import { spawn } from 'node:child_process';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = parseInt(process.env.GMAIL_OAUTH_PORT || '8765', 10);
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
const scope = 'https://www.googleapis.com/auth/gmail.send';

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
  console.error('Run with: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run generate:gmail-refresh-token');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', scope);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', redirectUri);
    if (requestUrl.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not found');
      return;
    }

    const error = requestUrl.searchParams.get('error');
    if (error) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end(`OAuth error: ${error}`);
      server.close();
      return;
    }

    const code = requestUrl.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Missing authorization code.');
      server.close();
      return;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenPayload = await tokenResponse.json() as {
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokenPayload.refresh_token) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Token exchange failed. Check terminal output.');
      console.error(JSON.stringify(tokenPayload, null, 2));
      server.close();
      return;
    }

    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Gmail OAuth autorizado. Pode fechar esta aba.');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokenPayload.refresh_token);
    server.close();
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Unexpected OAuth error. Check terminal output.');
    console.error(err);
    server.close();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('Open this URL in Opera GX and authorize sistematizeai@gmail.com:');
  console.log(authUrl.toString());

  if (process.platform === 'win32') {
    spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath "C:\\Users\\AI\\AppData\\Local\\Programs\\Opera GX\\opera.exe" -ArgumentList "${authUrl.toString()}"`,
    ], { detached: true, stdio: 'ignore' }).unref();
  }
});
