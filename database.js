const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'game_users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE,
        email TEXT UNIQUE,
        reset_token TEXT,
        reset_expires INTEGER
    )`);
    
    // Nâng cấp bảng cũ (Sẽ lờ đi lỗi nếu các cột này đã tồn tại)
    const addColumns = [
        "ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN email TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN reset_token TEXT",
        "ALTER TABLE users ADD COLUMN reset_expires INTEGER"
    ];

    addColumns.forEach(query => {
        db.run(query, (err) => { /* Ignore duplicate column errors */ });
    });
});

module.exports = db;
