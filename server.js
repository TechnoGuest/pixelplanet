const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Przechowywanie danych
let pixels = {}; // Format: {"x,y": "color"}
let players = new Set();
let pixelHistory = [];
let onlineCount = 0;

// Statyczne pliki
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint do pobrania stanu mapy
app.get('/api/map', (req, res) => {
    res.json({
        pixels: pixels,
        totalPixels: Object.keys(pixels).length,
        online: onlineCount
    });
});

// WebSocket
io.on('connection', (socket) => {
    console.log('Nowe połączenie:', socket.id);
    onlineCount++;
    players.add(socket.id);
    
    // Wyślij aktualny stan mapy
    socket.emit('map-data', {
        pixels: pixels,
        online: onlineCount
    });
    
    // Powiadom wszystkich o nowym graczu
    io.emit('player-count', onlineCount);
    
    // Odbierz nowy piksel
    socket.on('place-pixel', (data) => {
        const { x, y, color, player } = data;
        const key = `${x},${y}`;
        
        // Walidacja
        if (typeof x !== 'number' || typeof y !== 'number' || 
            x < 0 || x >= 2000 || y < 0 || y >= 2000) {
            return;
        }
        
        // Aktualizuj piksel
        pixels[key] = color;
        
        // Zapisz w historii
        pixelHistory.push({
            x, y, color, player,
            timestamp: Date.now(),
            socketId: socket.id
        });
        
        // Ogranicz historię
        if (pixelHistory.length > 1000) {
            pixelHistory = pixelHistory.slice(-1000);
        }
        
        // Wyślij do wszystkich
        io.emit('pixel-placed', { x, y, color, player });
        
        console.log(`Piksel: (${x},${y}) kolor:${color} przez ${player}`);
    });
    
    // Rozłączenie
    socket.on('disconnect', () => {
        console.log('Rozłączenie:', socket.id);
        onlineCount--;
        players.delete(socket.id);
        io.emit('player-count', onlineCount);
    });
});

// Endpoint do backupu
app.get('/api/backup', (req, res) => {
    res.json({
        pixels: pixels,
        history: pixelHistory,
        timestamp: Date.now()
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
    console.log(`🌐 Otwórz http://localhost:${PORT}`);
});