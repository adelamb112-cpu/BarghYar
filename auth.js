const Auth = {
    // بررسی وضعیت ورود کاربر هنگام بارگذاری صفحه
    checkAuth() {
        const currentUser = DB.get('currentUser');
        const loginOverlay = document.getElementById('modal-login');
        
        if (!currentUser) {
            if (loginOverlay) loginOverlay.classList.add('active');
        } else {
            if (loginOverlay) loginOverlay.classList.remove('active');
            const userNameEl = document.getElementById('current-user-name');
            if (userNameEl) userNameEl.innerText = currentUser.username || 'کاربر سیستم';
        }
    },

    // عملیات ورود به سیستم
    login() {
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            return alert('لطفا نام کاربری و رمز عبور را وارد کنید');
        }

        const users = DB.get('users') || [
            { username: 'admin', password: '123' } // رمز عبور پیش‌فرض اولیه
        ];

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            DB.set('currentUser', { username: user.username });
            usernameInput.value = '';
            passwordInput.value = '';
            const loginOverlay = document.getElementById('modal-login');
            if (loginOverlay) loginOverlay.classList.remove('active');
            alert('با موفقیت وارد شدید!');
            window.location.reload();
        } else {
            alert('نام کاربری یا رمز عبور اشتباه است!');
        }
    },

    // خروج از سیستم
    logout() {
        if (confirm('آیا قصد خروج از حساب کاربری را دارید؟')) {
            DB.remove('currentUser');
            window.location.reload();
        }
    },

    // باز کردن مودال تغییر رمز عبور
    openChangePassModal() {
        const modal = document.getElementById('modal-change-pass');
        if (modal) {
            document.getElementById('old-pass-input').value = '';
            document.getElementById('new-pass-input').value = '';
            modal.classList.add('active');
        }
    },

    // تغییر رمز عبور
    changePassword() {
        const currentUser = DB.get('currentUser');
        if (!currentUser) return alert('شما وارد سیستم نشده‌اید!');

        const oldPass = document.getElementById('old-pass-input').value.trim();
        const newPass = document.getElementById('new-pass-input').value.trim();

        if (!oldPass || !newPass) {
            return alert('لطفا تمام فیلدها را پر کنید');
        }

        let users = DB.get('users') || [
            { username: 'admin', password: '123' }
        ];

        const user = users.find(u => u.username === currentUser.username);

        if (user && user.password === oldPass) {
            user.password = newPass;
            DB.set('users', users);
            App.closeModals();
            alert('رمز عبور با موفقیت تغییر یافت!');
        } else {
            alert('رمز عبور فعلی اشتباه است!');
        }
    }
};

// اجرای خودکار بررسی ورود
document.addEventListener('DOMContentLoaded', () => {
    Auth.checkAuth();
});
