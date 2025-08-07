const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const SESSION_FILE_PATH = './session.json';

let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

const client = new Client({
    session: sessionData
});

// Afficher QR code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("🟡 QR code généré, scanne-le avec WhatsApp.");
});

// Authentification → Sauvegarde session
client.on('authenticated', (session) => {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
    console.log("🟢 Session sauvegardée dans session.json");
});

// Prêt
client.on('ready', () => {
    console.log("✅ Client WhatsApp prêt !");
});

// Démarre le client
client.initialize();


// ==========================
//       ROUTES API
// ==========================

app.get('/', (req, res) => {
    res.send("🟢 Serveur WhatsApp Web.js est en ligne.");
});

// Télécharger la session
app.get('/session', (req, res) => {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        res.download(path.resolve(SESSION_FILE_PATH));
    } else {
        res.status(404).send("❌ Aucune session trouvée.");
    }
});


// ==========================
//     Lancer le serveur
// ==========================

app.listen(PORT, () => {
    console.log(`🚀 Serveur Express lancé sur http://localhost:${PORT}`);
});
