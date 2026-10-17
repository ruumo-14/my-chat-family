const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// どのURL（Renderのドメイン）からでも安全に通信できるようにする設定（CORS対策）
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 静的ファイル（publicフォルダ内）を配信
app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 接続時に一度、最新のユーザーリストを届ける
    socket.emit('user_list', Array.from(users.keys()));

    // ログイン処理
    socket.on('login', (userId) => {
        if (!userId) return;
        
        socket.userId = userId;
        users.set(userId, socket.id);
        
        socket.emit('login_success', userId);
        io.emit('user_list', Array.from(users.keys()));
    });

    // メッセージの送信処理
    socket.on('send_message', (data) => {
        const { to, message } = data;
        const targetSocketId = users.get(to);

        const payload = {
            from: socket.userId,
            message: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.emit('receive_message', payload);

        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_message', payload);
        }
    });

    // ログアウト処理
    socket.on('logout', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            io.emit('user_list', Array.from(users.keys()));
            socket.userId = null;
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            io.emit('user_list', Array.from(users.keys()));
        }
    });
});

// 0.0.0.0 を指定して、Renderのネットワークから確実にアクセスできるようにします
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
