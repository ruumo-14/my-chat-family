const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// オンラインのユーザーを管理するオブジェクト { socket.id: username }
const users = {};

io.on('connection', (socket) => {
    console.log('接続されました:', socket.id);

    // ログイン処理
    socket.on('login', (username) => {
        // すでに同じ名前の人がログインしていないかチェック
        if (Object.values(users).includes(username)) {
            socket.emit('loginResult', { success: false, message: 'そのユーザーIDは既に使用されています。' });
            return;
        }

        users[socket.id] = username;
        socket.emit('loginResult', { success: true, username: username });

        // 全員に最新のオンラインユーザーリストを送り直す
        io.emit('userList', Object.values(users));
        console.log(`${username} がログインしました`);
    });

    // 個人メッセージ（DM）の転送処理
    socket.on('privateMessage', ({ toUser, text }) => {
        const fromUser = users[socket.id];
        if (!fromUser) return;

        // 送信相手の socket.id を探す
        const toSocketId = Object.keys(users).find(key => users[key] === toUser);

        if (toSocketId) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // 相手にメッセージを送る
            io.to(toSocketId).emit('receivePrivateMessage', {
                fromUser: fromUser,
                toUser: toUser,
                text: text,
                time: time
            });

            // 自分自身の画面にもメッセージを表示させるために自分にも送る
            socket.emit('receivePrivateMessage', {
                fromUser: fromUser,
                toUser: toUser,
                text: text,
                time: time
            });
        }
    });

    // ログアウト・切断時の処理
    socket.on('disconnect', () => {
        const username = users[socket.id];
        if (username) {
            delete users[socket.id];
            // 全員に最新のリストを送り直す
            io.emit('userList', Object.values(users));
            console.log(`${username} がログアウトしました`);
        }
    });
});

http.listen(PORT, () => {
    console.log(`サーバーが起動しました。ポート: ${PORT}`);
});
