module.exports = function(io) {
    let players = []; 
    let gameState = 'WAITING'; 
    let turnIndex = 0;
    let phrase = "LAP TRINH MANG";
    let revealedLetters = []; 
    let currentAction = 'SPIN'; 
    let currentSpinValue = 0;
    let timer = null;

    const wheelOptions = [100, 200, 500, 1000, "MAT_LUOT", "CHIA_DOI"];

    function nextTurn() {
        clearTimeout(timer);
        if (players.length === 0) {
            gameState = 'WAITING';
            return;
        }
        currentAction = 'SPIN';
        turnIndex = (turnIndex + 1) % players.length;
        broadcastState();
        startTurnTimer();
    }

    function startTurnTimer() {
        clearTimeout(timer);
        if (gameState !== 'PLAYING' || players.length === 0) return;
        
        broadcastState();
        timer = setTimeout(() => {
            if (players.length > 0 && players[turnIndex]) {
                io.to('wheel_room').emit('wheel_chat', `⏱️ Hết 10s! [${players[turnIndex].username}] bị mất lượt.`);
                nextTurn();
            }
        }, 10000);
    }

    function broadcastState() {
        io.to('wheel_room').emit('wheel_state', {
            players,
            gameState,
            turnIndex,
            phrase,
            revealedLetters,
            currentAction,
            currentSpinValue,
            timeLimit: 10
        });
    }

    io.on('connection', (socket) => {
        const req = socket.request;
        const user = req.session && req.session.passport ? req.session.passport.user : null;

        socket.on('join_wheel', () => {
            if (!user) {
                socket.emit('auth_error', 'Bạn chưa đăng nhập!');
                socket.disconnect();
                return;
            }
            if (players.length >= 4) {
                socket.emit('wheel_chat', '❌ Phòng đã đầy (Tối đa 4 người).');
                return;
            }
            const username = user.username; // XÁC THỰC TÊN QUA DATABASE
            socket.join('wheel_room');
            players.push({ id: socket.id, username, score: 0 });
            io.to('wheel_room').emit('update_wheel_players', players);
        });

        socket.on('start_wheel_game', () => {
            if (gameState === 'WAITING' && players.length > 0) {
                gameState = 'PLAYING';
                turnIndex = 0;
                currentAction = 'SPIN';
                revealedLetters = [];
                players.forEach(p => p.score = 0);
                startTurnTimer();
            }
        });

        socket.on('wheel_spin', () => {
            if (gameState !== 'PLAYING' || !players[turnIndex] || players[turnIndex].id !== socket.id || currentAction !== 'SPIN') return;
            
            clearTimeout(timer);
            const spinResult = wheelOptions[Math.floor(Math.random() * wheelOptions.length)];
            
            io.to('wheel_room').emit('wheel_chat', `🎡 [${players[turnIndex].username}] quay vào ô: ${spinResult}`);
            
            if (spinResult === "MAT_LUOT") {
                setTimeout(nextTurn, 2000);
            } else if (spinResult === "CHIA_DOI") {
                players[turnIndex].score = Math.floor(players[turnIndex].score / 2);
                setTimeout(nextTurn, 2000);
            } else {
                currentSpinValue = spinResult;
                currentAction = 'GUESS';
                startTurnTimer(); 
            }
        });

        socket.on('wheel_guess', (letter) => {
            if (gameState !== 'PLAYING' || !players[turnIndex] || players[turnIndex].id !== socket.id || currentAction !== 'GUESS') return;
            
            clearTimeout(timer);
            letter = letter.toUpperCase();
            
            if (revealedLetters.includes(letter)) {
                io.to('wheel_room').emit('wheel_chat', `❌ Chữ ${letter} đã được lật rồi. Mất lượt!`);
                setTimeout(nextTurn, 2000);
                return;
            }

            let count = 0;
            for (let i = 0; i < phrase.length; i++) {
                if (phrase[i] === letter) count++;
            }

            if (count > 0) {
                revealedLetters.push(letter);
                let pointsEarned = currentSpinValue * count;
                players[turnIndex].score += pointsEarned;
                io.to('wheel_room').emit('wheel_chat', `✅ Có ${count} chữ ${letter}! Được cộng ${pointsEarned} điểm.`);
                
                let won = phrase.split('').every(c => c === ' ' || revealedLetters.includes(c));
                if (won) {
                    gameState = 'END';
                    io.to('wheel_room').emit('wheel_chat', `🎉 CHIẾN THẮNG! [${players[turnIndex].username}] đã giải được ô chữ! 🎉`);
                    broadcastState();
                    return;
                }

                currentAction = 'SPIN';
                setTimeout(startTurnTimer, 2000);
            } else {
                io.to('wheel_room').emit('wheel_chat', `❌ Không có chữ ${letter} nào! Mất lượt.`);
                setTimeout(nextTurn, 2000);
            }
        });

        socket.on('disconnect', () => {
            const idx = players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                const wasMyTurn = (idx === turnIndex);
                players.splice(idx, 1);
                io.to('wheel_room').emit('update_wheel_players', players);
                
                if (gameState === 'PLAYING') {
                    if (players.length === 0) {
                        gameState = 'WAITING';
                        clearTimeout(timer);
                    } else {
                        if (idx < turnIndex) {
                            turnIndex--; 
                        }
                        if (wasMyTurn) {
                            if (turnIndex >= players.length) turnIndex = 0;
                            currentAction = 'SPIN';
                            broadcastState();
                            startTurnTimer();
                        }
                    }
                }
            }
        });
    });
};
