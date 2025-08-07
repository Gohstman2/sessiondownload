const express = require('express');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode'); // pour le QR base64

const app = express();
const PORT = 3000;

const SESSION_FILE_PATH = './session.json';
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

let qrCodeData = null; // stocker le dernier QR code ici

const client = new Client({
    session: sessionData
});

// Événement : QR à scanner
client.on('qr', async (qr) => {
    qrCodeData = await QRCode.toDataURL(qr); // base64 PNG
    console.log("🟡 QR code mis à jour (base64)");
});

// Événement : authentifié → on sauvegarde la session
client.on('authenticated', (session) => {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
    console.log("🟢 Session sauvegardée.");
});

// Prêt à l’emploi
client.on('ready', () => {
    console.log("✅ Client WhatsApp prêt !");
    qrCodeData = null; // plus besoin du QR
});

client.initialize();


// =================== ROUTES ===================

// Accueil
app.get('/', (req, res) => {
    res.send("✅ Serveur WhatsApp Web.js actif.");
});

// Route QR code en base64
app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else {
        res.status(404).json({ error: "Aucun QR code disponible (déjà authentifié ?)" });
    }
});

// Télécharger la session
app.get('/session', (req, res) => {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        res.download(path.resolve(SESSION_FILE_PATH));
    } else {
        res.status(404).send("❌ Session non trouvée.");
    }
});


// =================== LANCER ===================

app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
