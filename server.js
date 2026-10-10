const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Phục vụ các file tĩnh (HTML, CSS, JS) cho Client
app.use(express.static(path.join(__dirname, 'public')));

// --- GAME STATE (Nguồn sự thật) ---
let players = {}; // Lưu trữ danh sách { username, isAlive, answer }
let gameState = 'WAITING'; // Trạng thái: WAITING, PLAYING, QUESTION, RESULT
let currentQuestionIndex = 0;
let timer = null;

// Ngân hàng câu hỏi giả lập
const questions = [
    { text: "Khái niệm 'Concurrency' trong lập trình mạng có nghĩa là gì?", options: ["Xử lý tuần tự", "Xử lý đồng thời", "Lỗi mạng", "Bảo mật"], correct: 1 },
    { text: "Giao thức nào đảm bảo độ tin cậy và thứ tự khi truyền dữ liệu?", options: ["UDP", "TCP", "IP", "ICMP"], correct: 1 },
    { text: "Trong kiến trúc Client-Server, thành phần nào đóng vai trò lắng nghe yêu cầu?", options: ["Server", "Client", "Router", "Switch"], correct: 0 },
    { text: "Mô hình Socket.io sử dụng công nghệ nào dưới nền tảng để giao tiếp thời gian thực?", options: ["Long Polling", "WebRTC", "WebSocket", "Cả A và C"], correct: 3 },
    { text: "Khi có 100 Client gửi đáp án cùng lúc, vấn đề gì dễ xảy ra nhất nếu code không cẩn thận ở Server?", options: ["Tốn ổ cứng", "Race Condition / Lỗi đồng bộ", "Màn hình xanh", "Cháy RAM"], correct: 1 }
];

io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);

    // 1. Nhận sự kiện đăng nhập
    socket.on('join', (username) => {
        players[socket.id] = { username, isAlive: true, answer: null };
        io.emit('update_players', Object.values(players));
    });

    // 2. Nhận lệnh bắt đầu game
    socket.on('start_game', () => {
        if (gameState === 'WAITING') {
            startGame();
        }
    });

    // 3. Nhận sự kiện Client nộp đáp án
    socket.on('submit_answer', (answerIndex) => {
        // Chỉ nhận khi game đang hỏi và người chơi này còn sống
        if (gameState === 'QUESTION' && players[socket.id] && players[socket.id].isAlive) {
            players[socket.id].answer = answerIndex;
        }
    });

    // 4. Xử lý ngắt kết nối
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
        delete players[socket.id];
        io.emit('update_players', Object.values(players));
    });
});

// --- GAME LOGIC ---

function startGame() {
    gameState = 'PLAYING';
    currentQuestionIndex = 0;
    
    // Reset sinh mệnh toàn bộ người chơi
    for (let id in players) {
        players[id].isAlive = true;
        players[id].answer = null;
    }
    io.emit('game_started');
    
    // Chờ 1s rồi bắn câu hỏi đầu tiên
    setTimeout(sendQuestion, 1000);
}

function sendQuestion() {
    // Kịch bản kết thúc: Hết câu hỏi
    if (currentQuestionIndex >= questions.length) {
        endGame("Đã hết ngân hàng câu hỏi!");
        return;
    }

    // Kịch bản kết thúc: Còn <= 1 người chơi
    const aliveCount = Object.values(players).filter(p => p.isAlive).length;
    if (aliveCount <= 1 && currentQuestionIndex > 0) {
         endGame("Đã tìm ra người chiến thắng hoặc tất cả đã bị loại!");
         return;
    }

    gameState = 'QUESTION';
    const q = questions[currentQuestionIndex];

    // Reset đáp án của câu trước
    for (let id in players) {
        if (players[id].isAlive) {
            players[id].answer = null; // Bắt buộc phải trả lời lại
        }
    }

    // Broadcast câu hỏi cho 100 Clients
    io.emit('new_question', {
        questionId: currentQuestionIndex + 1,
        text: q.text,
        options: q.options,
        timeLimit: 10 // Quy định 10 giây
    });

    // SERVER LÀ NGƯỜI QUẢN LÝ THỜI GIAN
    timer = setTimeout(() => {
        processResults(); // Hết 10s khóa thu đáp án, tiến hành chấm
    }, 10000);
}

function processResults() {
    gameState = 'RESULT';
    const q = questions[currentQuestionIndex];
    const eliminated = [];

    // Chấm điểm
    for (let id in players) {
        if (players[id].isAlive) {
            // Ai trả lời sai hoặc KHÔNG TRẢ LỜI (null) đều bị loại
            if (players[id].answer === q.correct) {
                // Sống sót
            } else {
                players[id].isAlive = false;
                eliminated.push(players[id].username);
            }
        }
    }

    const aliveCount = Object.values(players).filter(p => p.isAlive).length;

    // Gửi kết quả vòng này
    io.emit('round_result', {
        correctAnswerIndex: q.correct,
        eliminated: eliminated,
        survivors: aliveCount
    });

    currentQuestionIndex++;

    // Nghỉ 5 giây xem kết quả rồi nhảy sang vòng tiếp theo
    setTimeout(() => {
        if (aliveCount === 0) {
            endGame("Tất cả đã bị loại!");
        } else if (aliveCount === 1) {
            endGame("Đã tìm ra quán quân duy nhất!");
        } else {
            sendQuestion();
        }
    }, 5000);
}

function endGame(reason) {
    gameState = 'WAITING';
    const winners = Object.values(players).filter(p => p.isAlive).map(p => p.username);
    io.emit('end_game', { reason, winners });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
