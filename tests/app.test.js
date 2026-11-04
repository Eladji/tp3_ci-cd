const request = require('supertest');
const app = require('../src/app');

test('should return ok when calling /health', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('should greet the user when name is given', async () => {
  const res = await request(app).get('/hello?name=Lina');
  expect(res.text).toContain('Lina');
});

test('greets an unknown visitor by default', async () => {
  const response = await request(app).get('/hello');
  expect(response.status).toBe(200);
  expect(response.text).toBe('<h1>Bonjour inconnu</h1>');
});

test('returns default preferences', async () => {
  const response = await request(app).get('/prefs');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ theme: 'light', lang: 'fr' });
});

test('updates only supported preferences', async () => {
  const response = await request(app).get('/prefs?theme=dark&lang=en');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ theme: 'dark', lang: 'en' });
});
