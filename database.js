const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'game_users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Tạo bảng với đầy đủ các cột ngay từ đầu
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE,
        email TEXT UNIQUE,
        reset_token TEXT,
        reset_expires INTEGER
    )`);
    
    // Nếu bảng đã lỡ tạo thiếu, thêm cột thủ công (bỏ chữ UNIQUE đi vì SQLite không hỗ trợ ALTER TABLE ADD COLUMN UNIQUE)
    const addColumns = [
        "ALTER TABLE users ADD COLUMN google_id TEXT",
        "ALTER TABLE users ADD COLUMN email TEXT",
        "ALTER TABLE users ADD COLUMN reset_token TEXT",
        "ALTER TABLE users ADD COLUMN reset_expires INTEGER"
    ];

    addColumns.forEach(query => {
        db.run(query, (err) => { 
            // Sẽ văng lỗi ngầm nếu cột đã tồn tại, ta cứ bỏ qua
        });
    });
});

module.exports = db;
