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
  expect(response.body).not.toHaveProperty('constructor');
});
