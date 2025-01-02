const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = {};
let rooms = {};

app.use(express.static('public'));

// Função para gerar uma chave de criptografia única
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    socket.on('joinRoom', ({ nickname, roomKey }) => {
        console.log(`Usuário tentando se juntar à sala: ${roomKey}`);
        if (!rooms[roomKey]) {
            rooms[roomKey] = {
                users: [],
                encryptionKey: generateEncryptionKey()
            };
            console.log(`Sala ${roomKey} criada`);
        }
        socket.join(roomKey);
        users[socket.id] = { nickname, roomKey };
        rooms[roomKey].users.push(socket.id);
        console.log(`${nickname} entrou na sala ${roomKey}`);
        io.to(roomKey).emit('message', { nickname: 'Sistema', text: `${nickname} entrou na sala.` });

        socket.emit('encryptionKey', rooms[roomKey].encryptionKey); // Envia a chave de criptografia para o cliente
        const room = io.sockets.adapter.rooms.get(roomKey);
        if (room) {
            io.to(roomKey).emit('userList', Array.from(room).map(id => users[id]?.nickname));
            console.log(`Lista de usuários na sala ${roomKey}:`, Array.from(room).map(id => users[id]?.nickname));
        }
    });

    socket.on('chatMessage', ({ encryptedMsg, roomKey, nickname }) => {
        const room = rooms[roomKey];
        if (room) {
            const timestamp = new Date().toLocaleTimeString();
            io.to(roomKey).emit('chatMessage', { encryptedMsg, timestamp, nickname });
            console.log(`Mensagem recebida na sala ${roomKey} de ${nickname} às ${timestamp}: ${encryptedMsg}`);
        } else {
            console.log(`Sala ${roomKey} não encontrada para a mensagem de ${nickname}`);
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.roomKey).emit('message', { nickname: 'Sistema', text: `${user.nickname} saiu da sala.` });
            rooms[user.roomKey].users = rooms[user.roomKey].users.filter(id => id !== socket.id);
            if (rooms[user.roomKey].users.length === 0) {
                delete rooms[user.roomKey]; // Remove a sala se não houver mais usuários
                console.log(`Sala ${user.roomKey} removida porque todos os usuários saíram`);
            }
            delete users[socket.id];
            const room = io.sockets.adapter.rooms.get(user.roomKey);
            if (room) {
                io.to(user.roomKey).emit('userList', Array.from(room).map(id => users[id]?.nickname));
                console.log(`Lista de usuários atualizada na sala ${user.roomKey}:`, Array.from(room).map(id => users[id]?.nickname));
            }
        }
        console.log('Usuário desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
