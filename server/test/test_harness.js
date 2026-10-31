import http from 'node:http';

let serverInstance = null;
let serverPort = null;

async function getServer(app) {
  if (serverInstance) return { server: serverInstance, port: serverPort };
  return new Promise((resolve, reject) => {
    serverInstance = http.createServer(app);
    serverInstance.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      serverInstance.unref();
      resolve({ server: serverInstance, port: serverPort });
    });
    serverInstance.on('error', reject);
  });
}

export async function makeRequest(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  const { port } = await getServer(app);
  const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

  const reqHeaders = {
    host: `127.0.0.1:${port}`,
    origin: `http://127.0.0.1:${port}`,
    referer: `http://127.0.0.1:${port}/`,
    ...(bodyStr ? { 'content-type': 'application/json' } : {}),
    ...headers
  };

  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: reqHeaders,
    body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : bodyStr,
    redirect: 'manual'
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  const resHeaders = {};
  if (typeof res.headers.getSetCookie === 'function') {
    resHeaders['set-cookie'] = res.headers.getSetCookie();
  } else {
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
  }

  return {
    status: res.status,
    headers: resHeaders,
    text,
    json
  };
}
