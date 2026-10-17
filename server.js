const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// オンラインのユーザー（ソケットID）を管理
const users = new Map();

// 💬 メッセージの履歴を保存する配列
const messageHistory = [];

// これまでにログインしたことがある「全ユーザーのリスト」
const allRegisteredUsers = new Set();

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // ログイン処理
    socket.on('login', (userId) => {
        if (!userId) return;
        
        socket.userId = userId;
        users.set(userId, socket.id);
        allRegisteredUsers.add(userId); // 全ユーザー登録簿に追加
        
        socket.emit('login_success', userId);
        
        // 登録されている全ユーザーの一覧を全員に通知（オフラインの人も一覧に出すため）
        io.emit('user_list', Array.from(allRegisteredUsers));
    });

    // 📥 過去のトーク履歴を要求されたときの処理
    socket.on('get_history', (data) => {
        const { myId, withId } = data;
        
        // 自分と相手の間で交わされたメッセージだけを抜き出す
        const filteredHistory = messageHistory.filter(msg => 
            (msg.from === myId && msg.to === withId) || (msg.from === withId && msg.to === myId)
        );
        
        // 要求してきた本人にだけ履歴を返す
        socket.emit('load_history', filteredHistory);
    });

    // メッセージの送信処理（相手がオフラインでも保存する）
    socket.on('send_message', (data) => {
        const { to, message } = data;
        const targetSocketId = users.get(to);

        const payload = {
            from: socket.userId,
            to: to,
            message: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // 💡 相手のオンライン状態に関係なく、サーバーの履歴に保存
        messageHistory.push(payload);

        // 送信元（自分）にメッセージを届ける
        socket.emit('receive_message', payload);

        // 送信先（相手）がオンラインのときだけリアルタイムで届ける
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_message', payload);
        }
    });

    // ログアウト処理
    socket.on('logout', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            // ログアウトしても一覧からは消さず、全ユーザーリストを送り直す
            io.emit('user_list', Array.from(allRegisteredUsers));
            socket.userId = null;
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            io.emit('user_list', Array.from(allRegisteredUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
