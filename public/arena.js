const socket = io();

const screens = {
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

// TỰ ĐỘNG THAM GIA PHÒNG NGAY KHI MỞ TRANG (Vì server đã nắm giữ Session User)
socket.on('connect', () => {
    socket.emit('join_arena');
});

// Xử lý lỗi nếu chưa đăng nhập
socket.on('auth_error', (msg) => {
    alert(msg);
    window.location.href = 'index.html'; // Đuổi về sảnh đăng nhập
});

document.getElementById('btn-start').addEventListener('click', () => {
    socket.emit('start_arena_game');
});

socket.on('update_arena_players', (players) => {
    document.getElementById('player-count').innerText = players.length;
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = `👤 ${p.username}`; // Username do server trả về, không thể làm giả
        list.appendChild(li);
    });

    if (players.length > 0) {
        document.getElementById('btn-start').style.display = 'inline-block';
    }
});

socket.on('arena_game_started', () => {
    isAlive = true;
    document.getElementById('my-status').innerText = "Trạng thái: CÒN SỐNG";
    document.getElementById('my-status').className = "status alive";
});

socket.on('arena_new_question', (data) => {
    showScreen('game');
    document.getElementById('question-text').innerText = `Câu ${data.questionId}: ${data.text}`;
    document.getElementById('feedback-msg').innerText = '';
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    data.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        
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

function selectAnswer(index, btn) {
    if (!isAlive) return;
    
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => {
        b.classList.remove('selected');
        b.disabled = true;
    });
    btn.classList.add('selected');
    btn.disabled = false;

    socket.emit('submit_arena_answer', index);
    document.getElementById('feedback-msg').innerText = 'Đã chốt đáp án, hồi hộp chờ kết quả...';
}

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

socket.on('arena_round_result', (data) => {
    clearInterval(countdownInterval);
    
    const btns = document.querySelectorAll('.option-btn');
    if(btns[data.correctAnswerIndex]) {
        btns[data.correctAnswerIndex].classList.add('correct');
    }
    
    btns.forEach(b => {
        if(b.classList.contains('selected') && !b.classList.contains('correct')) {
            b.classList.add('wrong');
        }
    });

    setTimeout(() => {
        showScreen('result');
        document.getElementById('survivor-count').innerText = data.survivors;
        document.getElementById('eliminated-list').innerText = data.eliminated.join(', ') || 'Không có ai';

        // Do không tự nhập username nữa, ta kiểm tra việc bị loại qua trạng thái máy chủ gửi
        fetch('/auth/me').then(res=>res.json()).then(userResp => {
            const myName = userResp.loggedIn ? userResp.user.username : '';
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
        });
    }, 2000); 
});

socket.on('arena_end_game', (data) => {
    showScreen('end');
    document.getElementById('end-reason').innerText = data.reason;
    document.getElementById('winners').innerText = data.winners.length > 0 ? data.winners.join(', ') : 'Không có ai';
});
