const Sync = (() => {
    let cloudUrl = localStorage.getItem("cloud_url") || "";

    function saveConfig() {
        cloudUrl = document.getElementById("cloud-endpoint").value;
        localStorage.setItem("cloud_url", cloudUrl);
        alert("تنظیمات آدرس ابری ذخیره شد.");
        checkOnlineStatus();
    }

    function checkOnlineStatus() {
        const statusEl = document.getElementById("sync-status");
        if (navigator.onLine && cloudUrl) {
            statusEl.innerText = "☁️ متصل به ابر";
            statusEl.className = "status-online";
        } else {
            statusEl.innerText = "☁️ آفلاین";
            statusEl.className = "status-offline";
        }
    }

    window.addEventListener("online", checkOnlineStatus);
    window.addEventListener("offline", checkOnlineStatus);

    return { saveConfig, checkOnlineStatus };
})();