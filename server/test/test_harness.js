import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

export function makeRequest(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqStream = new Readable({
      read() {
        if (bodyStr) {
          this.push(bodyStr);
        }
        this.push(null);
      }
    });

    const socket = Object.assign(new EventEmitter(), {
      remoteAddress: '127.0.0.1',
      destroy() {},
      end() {},
      write() {},
    });

    const req = Object.assign(reqStream, {
      method,
      url,
      originalUrl: url,
      headers: {
        host: 'localhost:5000',
        ...(bodyStr ? {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(bodyStr))
        } : {}),
        ...headers
      },
      connection: socket,
      socket: socket,
      ip: '127.0.0.1',
      hostname: 'localhost',
      protocol: 'http',
      secure: false,
    });

    let resHeaders = {};
    let statusCode = 200;
    const chunks = [];
    let headersSent = false;

    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      _header: false,
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name) {
        delete resHeaders[name.toLowerCase()];
      },
      writeHead(status, headers = {}) {
        headersSent = true;
        this._header = true;
        statusCode = status;
        this.statusCode = status;
        for (const [k, v] of Object.entries(headers)) {
          this.setHeader(k, v);
        }
        return this;
      },
      status(status) {
        statusCode = status;
        this.statusCode = status;
        return this;
      },
      write(chunk) {
        if (!headersSent && this.writeHead) {
          this.writeHead(this.statusCode);
        }
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end(chunk) {
        if (!headersSent && this.writeHead) {
          this.writeHead(this.statusCode);
        }
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const bodyBuffer = Buffer.concat(chunks);
        const text = bodyBuffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({
          status: this.statusCode || statusCode,
          headers: resHeaders,
          text,
          json
        });
      }
    });

    app.handle(req, res);
  });
}
