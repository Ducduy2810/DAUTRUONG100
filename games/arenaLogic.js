module.exports = function(io) {
    let players = {}; 
    let gameState = 'WAITING'; 
    let currentQuestionIndex = 0;
    let timer = null;

    const questions = [
        { text: "Khái niệm 'Concurrency' trong lập trình mạng có nghĩa là gì?", options: ["Xử lý tuần tự", "Xử lý đồng thời", "Lỗi mạng", "Bảo mật"], correct: 1 },
        { text: "Giao thức nào đảm bảo độ tin cậy và thứ tự khi truyền dữ liệu?", options: ["UDP", "TCP", "IP", "ICMP"], correct: 1 },
        { text: "Trong kiến trúc Client-Server, thành phần nào lắng nghe yêu cầu?", options: ["Server", "Client", "Router", "Switch"], correct: 0 },
        { text: "Mô hình Socket.io sử dụng công nghệ nào dưới nền tảng?", options: ["Long Polling", "WebRTC", "WebSocket", "Cả A và C"], correct: 3 },
        { text: "Khi có 100 Client gửi đáp án cùng lúc, vấn đề gì dễ xảy ra nhất ở Server?", options: ["Tốn ổ cứng", "Race Condition / Lỗi đồng bộ", "Màn hình xanh", "Cháy RAM"], correct: 1 }
    ];

    io.on('connection', (socket) => {
        // Lấy thông tin user TỪ PHIÊN ĐĂNG NHẬP (Session) thay vì từ Client gửi lên
        const req = socket.request;
        const user = req.session && req.session.passport ? req.session.passport.user : null;

        socket.on('join_arena', () => {
            // TỪ CHỐI nếu chưa đăng nhập
            if (!user) {
                socket.emit('auth_error', 'Bạn phải đăng nhập để chơi game này!');
                socket.disconnect();
                return;
            }

            const username = user.username; // TÊN THẬT 100% ĐƯỢC BẢO MẬT BỞI SERVER
            socket.join('arena_room');
            players[socket.id] = { username, isAlive: true, answer: null };
            io.to('arena_room').emit('update_arena_players', Object.values(players));
        });

        socket.on('start_arena_game', () => {
            if (gameState === 'WAITING') startGame();
        });

        socket.on('submit_arena_answer', (answerIndex) => {
            if (gameState === 'QUESTION' && players[socket.id] && players[socket.id].isAlive) {
                players[socket.id].answer = answerIndex;
            }
        });

        socket.on('disconnect', () => {
            if(players[socket.id]) {
                delete players[socket.id];
                io.to('arena_room').emit('update_arena_players', Object.values(players));
            }
        });
    });

    function startGame() {
        gameState = 'PLAYING';
        currentQuestionIndex = 0;
        for (let id in players) {
            players[id].isAlive = true;
            players[id].answer = null;
        }
        io.to('arena_room').emit('arena_game_started');
        setTimeout(sendQuestion, 1000);
    }

    function sendQuestion() {
        if (currentQuestionIndex >= questions.length) {
            endGame("Đã hết ngân hàng câu hỏi!");
            return;
        }
        const aliveCount = Object.values(players).filter(p => p.isAlive).length;
        if (aliveCount <= 1 && currentQuestionIndex > 0) {
             endGame("Đã tìm ra người chiến thắng hoặc tất cả đã bị loại!");
             return;
        }
        gameState = 'QUESTION';
        const q = questions[currentQuestionIndex];
        for (let id in players) {
            if (players[id].isAlive) players[id].answer = null;
        }
        io.to('arena_room').emit('arena_new_question', {
            questionId: currentQuestionIndex + 1,
            text: q.text,
            options: q.options,
            timeLimit: 10
        });
        timer = setTimeout(processResults, 10000);
    }

    function processResults() {
        gameState = 'RESULT';
        const q = questions[currentQuestionIndex];
        const eliminated = [];
        for (let id in players) {
            if (players[id].isAlive) {
                if (players[id].answer !== q.correct) {
                    players[id].isAlive = false;
                    eliminated.push(players[id].username);
                }
            }
        }
        const aliveCount = Object.values(players).filter(p => p.isAlive).length;
        io.to('arena_room').emit('arena_round_result', {
            correctAnswerIndex: q.correct,
            eliminated: eliminated,
            survivors: aliveCount
        });
        currentQuestionIndex++;
        setTimeout(() => {
            if (aliveCount === 0) endGame("Tất cả đã bị loại!");
            else if (aliveCount === 1) endGame("Đã tìm ra quán quân duy nhất!");
            else sendQuestion();
        }, 5000);
    }

    function endGame(reason) {
        gameState = 'WAITING';
        const winners = Object.values(players).filter(p => p.isAlive).map(p => p.username);
        io.to('arena_room').emit('arena_end_game', { reason, winners });
    }
};
