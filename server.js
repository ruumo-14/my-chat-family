const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const users = {}; // socket.id -> { username, room }

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    socket.on('joinRoom', ({ username, room }) => {
        users[socket.id] = { username, room };
        socket.join(room);
        io.to(room).emit('systemMessage', `${username} が部屋【${room}】に参加しました。`);
    });

    socket.on('chatMessage', (msg) => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('chatMessage', {
                username: user.username,
                text: msg,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('systemMessage', `${user.username} が退室しました。`);
            delete users[socket.id];
        }
    });
});

http.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
});
