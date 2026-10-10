const socket = io();

// Quản lý các màn hình UI
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
    end: document.getElementById('end-screen')
};

function showScreen(screenName) {
    for (let key in screens) {
        screens[key].classList.remove('active');
    }
    screens[screenName].classList.add('active');
}

let isAlive = true;
let countdownInterval;

// 1. Tham gia phòng chờ
document.getElementById('btn-join').addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    if (username) {
        socket.emit('join', username);
        showScreen('waiting');
    } else {
        alert("Vui lòng nhập tên!");
    }
});

// Cho phép bấm Enter để đăng nhập
document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// Admin (hoặc người đầu tiên) bấm bắt đầu game
document.getElementById('btn-start').addEventListener('click', () => {
    socket.emit('start_game');
});

// 2. Lắng nghe cập nhật từ phòng chờ
socket.on('update_players', (players) => {
    document.getElementById('player-count').innerText = players.length;
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = `👤 ${p.username}`;
        list.appendChild(li);
    });

    // Hiện nút bắt đầu nếu có người chơi
    if (players.length > 0) {
        document.getElementById('btn-start').style.display = 'inline-block';
    }
});

// 3. Khởi tạo ván mới
socket.on('game_started', () => {
    isAlive = true;
    document.getElementById('my-status').innerText = "Trạng thái: CÒN SỐNG";
    document.getElementById('my-status').className = "status alive";
});

// 4. Nhận câu hỏi từ Server
socket.on('new_question', (data) => {
    showScreen('game');
    document.getElementById('question-text').innerText = `Câu ${data.questionId}: ${data.text}`;
    document.getElementById('feedback-msg').innerText = '';
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    // Render 4 đáp án
    data.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        
        // Vô hiệu hóa nút nếu đã bị loại
        if (!isAlive) {
            btn.disabled = true;
        }

        btn.onclick = () => selectAnswer(index, btn);
        container.appendChild(btn);
    });

    if (!isAlive) {
        document.getElementById('feedback-msg').innerText = 'Bạn đã bị loại, chỉ có thể xem với vai trò khán giả.';
    }

    startTimer(data.timeLimit);
});

// Xử lý logic chọn đáp án ở Client
function selectAnswer(index, btn) {
    if (!isAlive) return;
    
    // Giao diện: highlight nút vừa bấm
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => {
        b.classList.remove('selected');
        b.disabled = true; // Khóa sau khi chọn để chống spam
    });
    btn.classList.add('selected');
    btn.disabled = false; // Vẫn cho phép nút hiện tại sáng

    // Gửi sự kiện cho server
    socket.emit('submit_answer', index);
    document.getElementById('feedback-msg').innerText = 'Đã chốt đáp án, hồi hộp chờ kết quả...';
}

// Đồng hồ đếm ngược hiển thị ở Client (Giao diện)
function startTimer(seconds) {
    clearInterval(countdownInterval);
    const timeDisplay = document.getElementById('time-left');
    timeDisplay.innerText = seconds;

    countdownInterval = setInterval(() => {
        seconds--;
        timeDisplay.innerText = seconds;
        if (seconds <= 0) {
            clearInterval(countdownInterval);
            document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
            if (isAlive && document.getElementById('feedback-msg').innerText === '') {
                document.getElementById('feedback-msg').innerText = 'Đã hết giờ! Bạn không nộp đáp án.';
            }
        }
    }, 1000);
}

// 5. Lắng nghe kết quả từng vòng
socket.on('round_result', (data) => {
    clearInterval(countdownInterval);
    
    // Đánh dấu đáp án đúng trên màn hình Game trước
    const btns = document.querySelectorAll('.option-btn');
    if(btns[data.correctAnswerIndex]) {
        btns[data.correctAnswerIndex].classList.add('correct');
    }
    
    // Đánh dấu đáp án sai nếu người dùng đã chọn
    btns.forEach(b => {
        if(b.classList.contains('selected') && !b.classList.contains('correct')) {
            b.classList.add('wrong');
        }
    });

    // Trì hoãn 2 giây để người chơi xem đáp án, rồi mới chuyển màn hình kết quả
    setTimeout(() => {
        showScreen('result');
        document.getElementById('survivor-count').innerText = data.survivors;
        document.getElementById('eliminated-list').innerText = data.eliminated.join(', ') || 'Không có ai';

        const myName = document.getElementById('username').value.trim();
        
        // Kiểm tra xem mình có nằm trong danh sách bị loại không
        if (isAlive && data.eliminated.includes(myName)) {
            isAlive = false;
            document.getElementById('my-status').innerText = "Trạng thái: BỊ LOẠI";
            document.getElementById('my-status').className = 'status eliminated';
            document.getElementById('result-info').innerText = "❌ Rất tiếc! Bạn đã trả lời sai hoặc quá hạn. Bạn đã bị loại!";
            document.getElementById('result-info').style.color = "#dc3545";
        } else if (isAlive) {
            document.getElementById('result-info').innerText = "✅ Xuất sắc! Bạn đã vượt qua vòng này.";
            document.getElementById('result-info').style.color = "#28a745";
        } else {
            document.getElementById('result-info').innerText = "Bạn đang xem ở chế độ khán giả.";
            document.getElementById('result-info').style.color = "#a0a0a0";
        }
    }, 2000); 
});

// 6. Nhận sự kiện kết thúc toàn bộ Game
socket.on('end_game', (data) => {
    showScreen('end');
    document.getElementById('end-reason').innerText = data.reason;
    document.getElementById('winners').innerText = data.winners.length > 0 ? data.winners.join(', ') : 'Không có ai';
});
