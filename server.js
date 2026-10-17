const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイル（publicフォルダ内）を配信する設定
app.use(express.static(path.join(__dirname, 'public')));

// ユーザーのオンライン状態を管理
const users = new Map();

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // ログイン処理
    socket.on('login', (userId) => {
        if (!userId) return;
        
        // ソケットIDとマイIDを紐付け
        socket.userId = userId;
        users.set(userId, socket.id);
        
        // ログイン成功を本人に通知
        socket.emit('login_success', userId);
        
        // 全員に最新のオンラインユーザーリストを送信
        io.emit('user_list', Array.from(users.keys()));
        console.log(`ユーザーログイン: ${userId}`);
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

        // 送信元（自分）にメッセージを届ける
        socket.emit('receive_message', payload);

        // 送信先（相手）がオンラインなら届ける
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_message', payload);
        }
    });

    // ログアウト処理
    socket.on('logout', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            io.emit('user_list', Array.from(users.keys()));
            console.log(`ユーザーログアウト: ${socket.userId}`);
            socket.userId = null;
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            io.emit('user_list', Array.from(users.keys()));
            console.log('ユーザーが切断しました:', socket.userId);
        }
    });
});

// Renderなどの環境変数のポート、または3000番で起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
