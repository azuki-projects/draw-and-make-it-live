const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'draw.html')));
app.get('/world', (req, res) => res.sendFile(path.join(__dirname, 'public', 'world.html')));

const players = new Map();

// ========== BIGGER WORLD ==========
const MAP_W = 3200, MAP_H = 2000;

// More rocks scattered across the larger map
const rocks = [
  {x:180,y:180,w:140,h:90},{x:520,y:120,w:110,h:110},{x:820,y:360,w:170,h:100},
  {x:300,y:480,w:90,h:140},{x:1080,y:170,w:130,h:95},{x:760,y:680,w:150,h:80},
  {x:130,y:730,w:100,h:100},{x:1180,y:580,w:110,h:120},{x:1380,y:300,w:120,h:100},
  {x:1300,y:800,w:140,h:90},{x:500,y:820,w:100,h:80},{x:950,y:100,w:90,h:90},
  // new rocks for expanded map
  {x:1600,y:200,w:160,h:100},{x:1900,y:500,w:120,h:130},{x:2200,y:180,w:140,h:90},
  {x:2500,y:420,w:100,h:110},{x:2800,y:260,w:150,h:95},{x:3000,y:600,w:130,h:100},
  {x:1700,y:900,w:110,h:100},{x:2100,y:820,w:170,h:85},{x:2450,y:750,w:120,h:120},
  {x:2750,y:950,w:140,h:90},{x:3020,y:1100,w:110,h:110},{x:200,y:1200,w:130,h:90},
  {x:550,y:1400,w:100,h:140},{x:900,y:1250,w:160,h:85},{x:1250,y:1500,w:120,h:110},
  {x:1600,y:1300,w:140,h:100},{x:1950,y:1600,w:150,h:95},{x:2300,y:1400,w:110,h:130},
  {x:2650,y:1700,w:130,h:100},{x:2950,y:1500,w:160,h:90},{x:400,y:1750,w:120,h:100},
  {x:800,y:1820,w:140,h:85},{x:1200,y:1850,w:100,h:110},{x:1700,y:1850,w:150,h:90},
  {x:2200,y:1880,w:130,h:80},{x:2700,y:1850,w:140,h:95}
];

function collide(nx, ny) {
  const r = 26;
  if (nx-r < 0 || nx+r > MAP_W || ny-r < 0 || ny+r > MAP_H) return true;
  for (const o of rocks)
    if (nx+r>o.x && nx-r<o.x+o.w && ny+r>o.y && ny-r<o.y+o.h) return true;
  return false;
}

io.on('connection', (socket) => {
  socket.on('join', ({ name, avatar }) => {
    if (!name || !avatar || typeof name !== 'string') return;
    const clean = name.slice(0,16).replace(/[^\w ]/g,'');
    let x=MAP_W/2, y=MAP_H/2, t=0;
    while (collide(x,y) && t++<500) { x=150+Math.random()*(MAP_W-300); y=150+Math.random()*(MAP_H-300); }
    players.set(socket.id, { id:socket.id, name:clean, avatar, x, y, lastChat:'', lastSeen:Date.now() });
    socket.emit('init', { selfId:socket.id, players:Array.from(players.values()), rocks, mapW:MAP_W, mapH:MAP_H });
    socket.broadcast.emit('playerJoin', players.get(socket.id));
  });

  socket.on('move', ({ dx, dy }) => {
    const p = players.get(socket.id); if (!p) return;
    const len = Math.hypot(dx,dy) || 1;
    const speed = 3.6;
    let nx = p.x + (dx/len)*speed;
    let ny = p.y + (dy/len)*speed;
    if (!collide(nx, p.y)) p.x = nx;
    if (!collide(p.x, ny)) p.y = ny;
    p.lastSeen = Date.now();
    io.emit('pos', { id:socket.id, x:p.x, y:p.y });
  });

  socket.on('chat', (raw) => {
    const p = players.get(socket.id);
    if (!p || !raw || typeof raw !== 'string') return;
    const msg = raw.slice(0, 80);
    p.lastChat = msg;
    io.emit('chatMsg', { id:socket.id, name:p.name, msg, ts:Date.now() });
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('leave', socket.id);
  });
});

server.listen(PORT, () => console.log(`🚀 Live on http://localhost:${PORT}  ·  Map: ${MAP_W}×${MAP_H}`));
