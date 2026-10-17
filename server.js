const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// 1. オンラインのユーザーを管理するオブジェクト { socket.id: username }
const onlineUsers = {};

// 2. メッセージ履歴をすべて記録する配列（相手がオフラインでもここに残ります）
const messageDb = []; 

io.on('connection', (socket) => {
    console.log('接続されました:', socket.id);

    // ログイン処理
    socket.on('login', (username) => {
        // すでに別のブラウザで同じ名前の人がオンラインなら弾く
        if (Object.values(onlineUsers).includes(username)) {
            socket.emit('loginResult', { success: false, message: 'そのユーザーIDは既に使用されています。' });
            return;
        }

        onlineUsers[socket.id] = username;
        socket.emit('loginResult', { success: true, username: username });

        // ★重要：ログインした人に、自分に関係のある過去のメッセージ履歴をすべて一括で送る
        const myHistory = messageDb.filter(msg => msg.fromUser === username || msg.toUser === username);
        socket.emit('loadChatHistory', myHistory);

        // 全員に最新のオンラインユーザーリストを通知
        io.emit('userList', Object.values(onlineUsers));
    });

    // 個人メッセージ（DM）の送信
    socket.on('privateMessage', ({ toUser, text }) => {
        const fromUser = onlineUsers[socket.id];
        if (!fromUser) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // メッセージデータを作成
        const newMsg = { fromUser, toUser, text, time };
        
        // ★重要：相手がオンラインか関係なく、サーバーの記録用配列に必ず保存する
        messageDb.push(newMsg);

        // 送信相手が「今オンラインかどうか」を探す
        const toSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === toUser);

        if (toSocketId) {
            // 相手がオンラインなら、リアルタイムに直接メッセージを届ける
            io.to(toSocketId).emit('receivePrivateMessage', newMsg);
        }
        
        // 送信元（自分自身）の画面にもリアルタイムで表示させる
        socket.emit('receivePrivateMessage', newMsg);
    });

    // 切断時の処理
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
