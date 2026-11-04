const express = require('express');
const { exec } = require('child_process');
const _ = require('lodash');

const app = express();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Message de bienvenue
app.get('/hello', (req, res) => {
  const name = req.query.name || 'inconnu';
  res.send(`<h1>Bonjour ${name}</h1>`);
});

// Outil réseau : ping un hôte
app.get('/ping', (req, res) => {
  exec(`ping -c 1 ${req.query.host}`, (err, stdout) => {
    if (err) return res.status(500).send('Erreur');
    res.type('text').send(stdout);
  });
});

// Préférences utilisateur
app.get('/prefs', (req, res) => {
  const defaults = { theme: 'light', lang: 'fr' };
  res.json(_.merge({}, defaults, req.query));
});

module.exports = app;
