jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => callback(null, 'mock ping')),
  execFile: jest.fn((file, args, options, callback) => callback(null, 'mock ping')),
}));

const request = require('supertest');
const { exec, execFile } = require('child_process');
const app = require('../src/app');

beforeEach(() => jest.clearAllMocks());

test('escapes HTML supplied to /hello', async () => {
  const response = await request(app).get('/hello').query({ name: '<script>alert(1)</script>' });
  expect(response.status).toBe(200);
  expect(response.text).not.toContain('<script>');
  expect(response.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('rejects shell commands before launching ping', async () => {
  const response = await request(app).get('/ping').query({ host: 'google.com;cat /etc/passwd' });
  expect(response.status).toBe(400);
  expect(exec).not.toHaveBeenCalled();
  expect(execFile).not.toHaveBeenCalled();
});

test('rejects prototype-related input instead of merging untrusted preferences', async () => {
  const response = await request(app)
    .get('/prefs?constructor[prototype][admin]=true&theme[constructor][prototype][admin]=true');
  expect(response.status).toBe(400);
  expect({}.admin).toBeUndefined();
  expect(Object.hasOwn(response.body, 'constructor')).toBe(false);
});

test.each([
  '', '-c', 'example.com\nwhoami', 'example.com$(id)', 'example.com && id',
  'example.com|id', 'https://example.com', 'bad host', 'a'.repeat(64) + '.com',
])('rejects malformed ping host %j', async (host) => {
  const response = await request(app).get('/ping').query({ host });
  expect(response.status).toBe(400);
  expect(execFile).not.toHaveBeenCalled();
});

test.each(['/ping', '/ping?host=a&host=b', '/ping?host[name]=example.com'])(
  'rejects missing or structured host: %s', async (url) => {
    expect((await request(app).get(url)).status).toBe(400);
    expect(execFile).not.toHaveBeenCalled();
  },
);

test.each(['example.com', '127.0.0.1', '::1'])('passes %s as a separate ping argument', async (host) => {
  const response = await request(app).get('/ping').query({ host });
  expect(response.status).toBe(200);
  expect(response.text).toBe('mock ping');
  expect(exec).not.toHaveBeenCalled();
  expect(execFile).toHaveBeenCalledWith('ping', ['-c', '1', host],
    expect.objectContaining({ shell: false, timeout: 5000, maxBuffer: 65536 }),
    expect.any(Function));
});

test('returns a controlled error when ping fails', async () => {
  execFile.mockImplementationOnce((file, args, options, callback) => callback(new Error('private details')));
  const response = await request(app).get('/ping?host=example.com');
  expect(response.status).toBe(502);
  expect(response.text).not.toContain('private details');
});

test.each([
  '__proto__[admin]=true', 'constructor[prototype][admin]=true', 'prototype[admin]=true',
  'admin=true', 'theme[admin]=true', 'theme=light&theme=dark', 'lang=javascript',
])('rejects unexpected preference input: %s', async (query) => {
  const response = await request(app).get('/prefs?' + query);
  expect(response.status).toBe(400);
  expect({}.admin).toBeUndefined();
});

test.each(['/hello?name=a&name=b', '/hello?name=' + 'a'.repeat(257)])(
  'rejects invalid greeting input: %s', async (url) => {
    expect((await request(app).get(url)).status).toBe(400);
  },
);

test('sets browser security headers', async () => {
  const response = await request(app).get('/hello');
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['content-security-policy']).toContain("default-src 'none'");
});
