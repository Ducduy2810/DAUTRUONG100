document.addEventListener("DOMContentLoaded", () => {
    checkAuth();

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const msgBox = document.getElementById('auth-msg');

    function showForm(formElement) {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        forgotForm.classList.add('hidden');
        formElement.classList.remove('hidden');
        msgBox.innerText = '';
    }

    // Nút chuyển đổi giao diện
    document.getElementById('link-register').onclick = () => showForm(registerForm);
    document.getElementById('link-login').onclick = () => showForm(loginForm);
    document.getElementById('link-forgot').onclick = () => showForm(forgotForm);
    document.getElementById('link-back-login').onclick = () => showForm(loginForm);

    // 1. Xử lý Đăng ký (Có thêm Email)
    document.getElementById('btn-register').onclick = async () => {
        const user = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-password').value;
        
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            msgBox.style.color = '#10b981';
            msgBox.innerText = data.message;
            setTimeout(() => document.getElementById('link-login').click(), 1500);
        } else {
            msgBox.style.color = '#ef4444';
            msgBox.innerText = data.error;
        }
    };

    // 2. Xử lý Đăng nhập
    document.getElementById('btn-login').onclick = async () => {
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) checkAuth();
        else {
            msgBox.style.color = '#ef4444';
            msgBox.innerText = data.error || 'Sai tên đăng nhập hoặc mật khẩu!';
        }
    };

    // 3. Xử lý Gửi mail Quên mật khẩu
    document.getElementById('btn-forgot').onclick = async () => {
        const email = document.getElementById('forgot-email').value.trim();
        if(!email) {
            msgBox.innerText = "Vui lòng nhập email!";
            return;
        }
        
        msgBox.style.color = '#facc15';
        msgBox.innerText = "Đang xử lý...";
        
        const res = await fetch('/auth/forgot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const data = await res.json();
        if (data.success) {
            msgBox.style.color = '#10b981';
            msgBox.innerText = data.message;
        } else {
            msgBox.style.color = '#ef4444';
            msgBox.innerText = data.error;
        }
    };

    // 4. Xử lý Đăng xuất
    document.getElementById('btn-logout').onclick = async () => {
        await fetch('/auth/logout', { method: 'POST' });
        checkAuth();
    };
});

async function checkAuth() {
    const res = await fetch('/auth/me');
    const data = await res.json();
    
    if (data.loggedIn) {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('portal-section').classList.remove('hidden');
        document.getElementById('display-name').innerText = data.user.username;
    } else {
        document.getElementById('portal-section').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
    }
}
