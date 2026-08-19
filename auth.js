const Auth = (() => {
    const DEFAULT_PASS = "1234";

    function getPass() {
        return localStorage.getItem("app_pin") || DEFAULT_PASS;
    }

    function init() {
        showOverlay();
    }

    function showOverlay() {
        let overlay = document.getElementById("auth-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "auth-overlay";
            overlay.className = "modal-overlay active";
            overlay.style.zIndex = "9999";
            overlay.innerHTML = `
                <div class="modal-card">
                    <h3>🔐 ورود به نرم‌افزار</h3>
                    <div class="form-group">
                        <label>رمز عبور را وارد کنید:</label>
                        <input type="password" id="auth-pass-input" placeholder="رمز عبور">
                    </div>
                    <button onclick="Auth.verify()" class="btn btn-primary" style="width:100%;">ورود</button>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.classList.add("active");
        }
    }

    function verify() {
        const input = document.getElementById("auth-pass-input").value;
        if (input === getPass()) {
            document.getElementById("auth-overlay").classList.remove("active");
            document.getElementById("auth-pass-input").value = "";
        } else {
            alert("رمز عبور اشتباه است!");
        }
    }

    function openChangePassModal() {
        document.getElementById("modal-change-pass").classList.add("active");
    }

    function changePassword() {
        const oldP = document.getElementById("pass-old").value;
        const newP = document.getElementById("pass-new").value;

        if (oldP !== getPass()) {
            return alert("رمز فعلی اشتباه است.");
        }
        if (!newP) {
            return alert("رمز جدید را وارد کنید.");
        }

        localStorage.setItem("app_pin", newP);
        alert("رمز عبور با موفقیت تغییر یافت.");
        App.closeModals();
    }

    return { init, verify, openChangePassModal, changePassword };
})();
