const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const onlineUsers = {};
const messageDb = []; 

io.on('connection', (socket) => {
    console.log('接続されました:', socket.id);

    socket.on('login', (username) => {
        if (Object.values(onlineUsers).includes(username)) {
            socket.emit('loginResult', { success: false, message: 'そのユーザーIDは既に使用されています。' });
            return;
        }

        onlineUsers[socket.id] = username;
        socket.emit('loginResult', { success: true, username: username });

        const myHistory = messageDb.filter(msg => msg.fromUser === username || msg.toUser === username);
        socket.emit('loadChatHistory', myHistory);

        io.emit('userList', Object.values(onlineUsers));
    });

    socket.on('privateMessage', ({ toUser, text }) => {
        const fromUser = onlineUsers[socket.id];
        if (!fromUser) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMsg = { fromUser, toUser, text, time };
        
        messageDb.push(newMsg);

        const toSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === toUser);
        if (toSocketId) {
            io.to(toSocketId).emit('receivePrivateMessage', newMsg);
        }
        socket.emit('receivePrivateMessage', newMsg);
    });

    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            io.emit('userList', Object.values(onlineUsers));
        }
    });
});

http.listen(PORT, () => {
    console.log(`サーバーが起動しました。ポート: ${PORT}`);
});
