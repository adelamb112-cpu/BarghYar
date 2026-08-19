const Auth = (() => {
    let currentPin = localStorage.getItem("app_pin") || "1234";
    let isEnabled = localStorage.getItem("pin_enabled") !== "false";

    function init() {
        document.getElementById("pin-enable-toggle").checked = isEnabled;
        if (!isEnabled) {
            document.getElementById("auth-overlay").classList.remove("active");
        }
    }

    function verifyPin() {
        const val = document.getElementById("pin-input").value;
        if (val === currentPin) {
            document.getElementById("auth-overlay").classList.remove("active");
            document.getElementById("pin-input").value = "";
            document.getElementById("auth-error").innerText = "";
        } else {
            document.getElementById("auth-error").innerText = "رمز عبور نادرست است";
        }
    }

    function lock() {
        if (isEnabled) {
            document.getElementById("auth-overlay").classList.add("active");
        }
    }

    function togglePinEnable() {
        isEnabled = document.getElementById("pin-enable-toggle").checked;
        localStorage.setItem("pin_enabled", isEnabled);
    }

    function changePin() {
        const newPin = document.getElementById("new-pin-input").value;
        if (newPin.length >= 4) {
            currentPin = newPin;
            localStorage.setItem("app_pin", newPin);
            alert("رمز عبور با موفقیت تغییر یافت.");
            document.getElementById("new-pin-input").value = "";
        } else {
            alert("رمز عبور باید حداقل 4 رقم باشد.");
        }
    }

    window.addEventListener("blur", () => lock());

    return { init, verifyPin, lock, togglePinEnable, changePin };
})();