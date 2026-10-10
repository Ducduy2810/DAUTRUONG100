require('dotenv').config(); // 👈 LẤY BIẾN MÔI TRƯỜNG TỪ FILE .ENV (Phải nằm trên cùng)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const db = require('./database');

const setupArenaLogic = require('./games/arenaLogic');
const setupWheelLogic = require('./games/wheelLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'ma_bao_mat_vo_cung_kho_doan_123', 
    resave: false,
    saveUninitialized: false
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
io.engine.use(sessionMiddleware);

// --- CẤU HÌNH GỬI MAIL (ĐÃ LẤY TỪ .ENV) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

passport.use(new LocalStrategy(
    function(username, password, done) {
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (err) return done(err);
            if (!row) return done(null, false, { message: 'Tài khoản không tồn tại!' });
            if (!row.password) return done(null, false, { message: 'Tài khoản này được tạo bằng Google, vui lòng đăng nhập bằng Google!' });

            bcrypt.compare(password, row.password, (err, res) => {
                if (res) return done(null, row);
                return done(null, false, { message: 'Sai mật khẩu!' });
            });
        });
    }
));

// --- CẤU HÌNH GOOGLE OAUTH (ĐÃ LẤY TỪ .ENV) ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback" 
  },
  function(accessToken, refreshToken, profile, done) {
      db.get("SELECT * FROM users WHERE google_id = ?", [profile.id], (err, row) => {
          if (err) return done(err);
          if (row) return done(null, row); 
          
          const safeName = profile.displayName.replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const newUsername = safeName + '_' + Math.floor(Math.random() * 1000);
          const mockEmail = profile.id + '@google.com'; 
          
          db.run("INSERT INTO users (username, google_id, email) VALUES (?, ?, ?)", [newUsername, profile.id, mockEmail], function(err) {
              if (err) return done(err);
              return done(null, { id: this.lastID, username: newUsername });
          });
      });
  }
));

passport.serializeUser((user, done) => { done(null, { id: user.id, username: user.username }); });
passport.deserializeUser((obj, done) => done(null, obj));

// --- API BẢO MẬT ---
app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Hãy nhập đủ thông tin (cả email)!' });
    
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hash], function(err) {
            if (err) return res.status(400).json({ error: 'Tên tài khoản hoặc Email đã có người sử dụng!' });
            res.json({ success: true, message: 'Đăng ký thành công! Hãy tiến hành đăng nhập.' });
        });
    } catch (e) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(400).json({ error: info.message });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.json({ success: true, user });
        });
    })(req, res, next);
});

app.post('/auth/logout', (req, res) => { req.logout((err) => res.json({ success: true })); });
app.get('/auth/me', (req, res) => {
    if (req.isAuthenticated()) res.json({ loggedIn: true, user: req.user });
    else res.json({ loggedIn: false });
});

// --- API QUÊN MẬT KHẨU ---
app.post('/auth/forgot', (req, res) => {
    const { email } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(400).json({ error: 'Không tìm thấy tài khoản nào đăng ký bằng Email này.' });
        
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; 

        db.run("UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?", [token, expires, email], (err) => {
            const resetLink = `http://localhost:3000/reset.html?token=${token}`;
            
            console.log(`\n==============================================`);
            console.log(`[HỆ THỐNG] YÊU CẦU ĐỔI MẬT KHẨU CHO EMAIL: ${email}`);
            console.log(`Bấm vào link sau để đặt lại mật khẩu:`);
            console.log(resetLink);
            console.log(`==============================================\n`);

            const mailOptions = {
                to: user.email,
                from: 'no-reply@gameportal.com',
                subject: 'Yêu cầu khôi phục mật khẩu - Game Portal',
                text: `Bạn đã yêu cầu khôi phục mật khẩu.\n\nVui lòng click vào link sau để đặt lại mật khẩu mới:\n\n${resetLink}\n\nLink này sẽ hết hạn sau 1 giờ.`
            };
            
            transporter.sendMail(mailOptions, (err) => {
                if (err) {
                    console.error("Lỗi gửi Mail (Hãy kiểm tra lại GMAIL_USER và GMAIL_APP_PASSWORD trong file .env):", err);
                    return res.json({ success: true, message: 'Đã tạo link khôi phục! (Tuy nhiên gửi mail lỗi, hãy xem link ở cửa sổ Terminal).' });
                }
                res.json({ success: true, message: 'Đã gửi email khôi phục. Vui lòng kiểm tra hộp thư!' });
            });
        });
    });
});

app.post('/auth/reset', async (req, res) => {
    const { token, newPassword } = req.body;
    db.get("SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?", [token, Date.now()], async (err, user) => {
        if (!user) return res.status(400).json({ error: 'Mã khôi phục không hợp lệ hoặc đã hết hạn.' });

        const hash = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?", [hash, user.id], (err) => {
            res.json({ success: true, message: 'Đã cập nhật mật khẩu! Đang đưa bạn về trang chủ...' });
        });
    });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    function(req, res) { res.redirect('/'); }
);

setupArenaLogic(io);
setupWheelLogic(io);

const PORT = 3000;
server.listen(PORT, () => { console.log(`🚀 Cổng Game đang chạy tại http://localhost:${PORT}`); });
