const socket = io();

let myId = null;
let isPlaying = false;
let countdownInterval;

// TỰ ĐỘNG JOIN BẰNG SESSION USERNAME
socket.on('connect', () => { 
    myId = socket.id; 
    socket.emit('join_wheel');
});

socket.on('auth_error', (msg) => {
    alert(msg);
    window.location.href = 'index.html';
});

// Chat Log
socket.on('wheel_chat', (msg) => {
    const chat = document.getElementById('chat-box');
    chat.innerHTML += `<div>> ${msg}</div>`;
    chat.scrollTop = chat.scrollHeight; 
});

// Update Waiting Room
socket.on('update_wheel_players', (players) => {
    if (!isPlaying) {
        if (players.length > 0) {
            document.getElementById('btn-start').style.display = 'inline-block';
            document.getElementById('wait-controls').style.display = 'block';
        }
    }
    renderPlayers(players, -1);
});

// Bấm Bắt đầu
document.getElementById('btn-start').addEventListener('click', () => {
    socket.emit('start_wheel_game');
});

// Bấm Quay Nón
document.getElementById('btn-spin').addEventListener('click', () => {
    socket.emit('wheel_spin');
});

// Bấm Đoán Chữ (hoặc nhấn Enter)
document.getElementById('btn-guess').addEventListener('click', () => {
    const letter = document.getElementById('guess-input').value.trim();
    if (letter.length === 1) {
        socket.emit('wheel_guess', letter);
        document.getElementById('guess-input').value = '';
    }
});
document.getElementById('guess-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-guess').click();
});

// Đồng bộ State từ Server
socket.on('wheel_state', (state) => {
    isPlaying = state.gameState === 'PLAYING';
    document.getElementById('btn-start').style.display = 'none';

    renderPlayers(state.players, state.turnIndex);

    const container = document.getElementById('phrase-container');
    container.innerHTML = '';
    for (let char of state.phrase) {
        const div = document.createElement('div');
        if (char === ' ') {
            div.className = 'letter-space';
        } else {
            div.className = 'letter-box';
            if (state.revealedLetters.includes(char) || state.gameState === 'END') {
                div.innerText = char;
            }
        }
        container.appendChild(div);
    }

    if (state.gameState === 'PLAYING') {
        const myTurn = state.players[state.turnIndex].id === myId;
        document.getElementById('turn-indicator').innerText = myTurn ? "🟢 ĐẾN LƯỢT BẠN THAO TÁC!" : `🔴 Đang là lượt của [${state.players[state.turnIndex].username}]`;
        
        if (myTurn) {
            document.getElementById('wait-controls').style.display = 'none';
            document.getElementById('play-controls').style.display = 'block';
            
            if (state.currentAction === 'SPIN') {
                document.getElementById('spin-control').style.display = 'block';
                document.getElementById('guess-control').style.display = 'none';
            } else {
                document.getElementById('spin-control').style.display = 'none';
                document.getElementById('guess-control').style.display = 'block';
                document.getElementById('spin-value-display').innerText = state.currentSpinValue;
                document.getElementById('guess-input').focus();
            }
        } else {
            document.getElementById('wait-controls').style.display = 'block';
            document.getElementById('play-controls').style.display = 'none';
        }
        
        startVisualTimer(state.timeLimit);
    } else if (state.gameState === 'END') {
        document.getElementById('turn-indicator').innerText = "TRÒ CHƠI KẾT THÚC";
        document.getElementById('wait-controls').style.display = 'none';
        document.getElementById('play-controls').style.display = 'none';
        document.getElementById('btn-start').style.display = 'inline-block';
        document.getElementById('btn-start').innerText = "Chơi lại ván mới";
        clearInterval(countdownInterval);
    }
});

function renderPlayers(players, turnIndex) {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'player-card' + (idx === turnIndex ? ' active-turn' : '');
        div.innerHTML = `<strong>${p.username}</strong><br><span style="color:#facc15">${p.score} đ</span>`;
        container.appendChild(div);
    });
}

function startVisualTimer(timeLimit) {
    clearInterval(countdownInterval);
    let seconds = timeLimit;
    document.getElementById('time-left').innerText = seconds;
    countdownInterval = setInterval(() => {
        seconds--;
        if (seconds >= 0) document.getElementById('time-left').innerText = seconds;
        else clearInterval(countdownInterval);
    }, 1000);
}
