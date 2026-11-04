const express = require('express');
const { execFile } = require('child_process');
const { isIP } = require('net');
const { escape } = require('lodash');

const app = express();
app.disable('x-powered-by');
app.set('query parser', 'simple');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Message de bienvenue
app.get('/hello', (req, res) => {
  const name = req.query.name ?? 'inconnu';
  if (typeof name !== 'string' || name.length > 256) {
    return res.status(400).json({ error: 'Nom invalide' });
  }
  return res.type('html').send(`<h1>Bonjour ${escape(name)}</h1>`);
});

function isValidHost(host) {
  if (typeof host !== 'string' || host.length === 0 || host.length > 253) return false;
  if (isIP(host)) return true;
  return host.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

// Outil réseau : ping un hôte
app.get('/ping', (req, res) => {
  const { host } = req.query;
  if (!isValidHost(host)) return res.status(400).json({ error: 'Hôte invalide' });
  return execFile('ping', ['-c', '1', host], {
    timeout: 5000,
    maxBuffer: 64 * 1024,
    shell: false,
  }, (error, stdout) => {
    if (error) return res.status(502).json({ error: 'Hôte inaccessible' });
    return res.type('text').send(stdout);
  });
});

// Préférences utilisateur
app.get('/prefs', (req, res) => {
  const allowed = { theme: ['light', 'dark'], lang: ['fr', 'en'] };
  for (const key of Object.keys(req.query)) {
    if (!Object.hasOwn(allowed, key) || !allowed[key].includes(req.query[key])) {
      return res.status(400).json({ error: 'Préférence invalide' });
    }
  }
  return res.json({
    theme: req.query.theme ?? 'light',
    lang: req.query.lang ?? 'fr',
  });
});

module.exports = app;
