const express = require('express');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_FILE_PATH = './session.json';

let sessionData = null;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

let qrCodeData = null;
let clientReady = false;
let clientAuthenticated = false;

const client = new Client({
  session: sessionData,
  puppeteer: { headless: true }
});

app.use(express.json()); // pour lire le JSON des POST

// Gestion événements WhatsApp client

client.on('qr', async (qr) => {
  qrCodeData = await QRCode.toDataURL(qr);
  clientReady = false;
  clientAuthenticated = false;
  console.log('🟡 Nouveau QR code généré');
});

client.on('authenticated', (session) => {
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
  clientAuthenticated = true;
  console.log('🟢 Client authentifié, session sauvegardée');
});

client.on('ready', () => {
  qrCodeData = null;
  clientReady = true;
  console.log('✅ Client prêt');
});

client.on('auth_failure', () => {
  console.log('❌ Échec d\'authentification');
  clientReady = false;
  clientAuthenticated = false;
});

client.on('disconnected', () => {
  console.log('❌ Client déconnecté');
  clientReady = false;
  clientAuthenticated = false;
  qrCodeData = null;
  // Supprimer session pour forcer nouvelle auth
  if (fs.existsSync(SESSION_FILE_PATH)) {
    fs.unlinkSync(SESSION_FILE_PATH);
  }
  client.destroy();
  client.initialize();
});

client.initialize();

// === ROUTES ===

// Route pour récupérer le QR code en base64
app.get('/auth', (req, res) => {
  if (clientReady) {
    res.json({ status: 'connected', message: 'Client WhatsApp connecté.' });
  } else if (qrCodeData) {
    res.json({ status: 'qr', qr: qrCodeData });
  } else {
    res.status(404).json({ status: 'none', message: 'Pas de QR code disponible pour l\'instant.' });
  }
});

// Vérifier si le client est prêt (authentifié)
app.get('/checkauth', (req, res) => {
  res.json({
    authenticated: clientAuthenticated,
    ready: clientReady
  });
});

// Envoyer un message (POST)
// JSON attendu : { number: '33612345678', message: 'Bonjour' }
// Le numéro doit être au format international sans "+"
app.post('/sendmessage', async (req, res) => {
  if (!clientReady) {
    return res.status(400).json({ error: 'Client non prêt. Authentifie-toi d\'abord.' });
  }

  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: 'Paramètres manquants : number et message requis.' });
  }

  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    const sent = await client.sendMessage(chatId, message);
    res.json({ success: true, id: sent.id._serialized });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message', details: error.message });
  }
});

// Statut du client
app.get('/status', (req, res) => {
  res.json({
    authenticated: clientAuthenticated,
    ready: clientReady,
    qrAvailable: !!qrCodeData
  });
});

// Télécharger la session
app.get('/session', (req, res) => {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    res.download(path.resolve(SESSION_FILE_PATH));
  } else {
    res.status(404).send('Session non trouvée.');
  }
});

// Déconnexion (supprime session et redémarre client)
app.post('/logout', (req, res) => {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    fs.unlinkSync(SESSION_FILE_PATH);
  }
  qrCodeData = null;
  client.destroy().then(() => {
    client.initialize();
    clientReady = false;
    clientAuthenticated = false;
    res.json({ success: true, message: 'Client déconnecté et session supprimée.' });
  }).catch(err => {
    res.status(500).json({ error: 'Erreur lors de la déconnexion', details: err.message });
  });
});

// Serveur écoute
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
