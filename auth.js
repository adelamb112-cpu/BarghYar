const Auth = {
    openChangePassModal() {
        document.getElementById('pass-old').value = '';
        document.getElementById('pass-new').value = '';
        document.getElementById('modal-change-pass').classList.add('active');
    },

    changePassword() {
        const oldPass = document.getElementById('pass-old').value;
        const newPass = document.getElementById('pass-new').value;

        const currentPass = DB.get('app_password') || '1234';

        if (oldPass !== currentPass) {
            return alert('رمز عبور فعلی اشتباه است!');
        }
        if (!newPass) {
            return alert('رمز عبور جدید نمی‌تواند خالی باشد!');
        }

        DB.set('app_password', newPass);
        alert('رمز عبور با موفقیت تغییر کرد.');
        App.closeModals();
    }
};
