const PRIMARY_URL = 'https://raw.githubusercontent.com/hookzof/socks5_list/master/tg/mtproto.json';
const BACKUP_URL = 'https://raw.githubusercontent.com/Firmfox/Proxify/refs/heads/main/telegram_proxies/mtproto.txt';

const container = document.getElementById('proxy-container');
const countEl = document.getElementById('total-proxies');
const filterSelect = document.getElementById('country-filter');
const statusText = document.getElementById('status-text');

let allProxies = [];

// مدیریت تم (Dark/Light)
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('.fa-moon').classList.replace('fa-moon', 'fa-sun');
    }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = document.querySelector('#theme-toggle i');
    if(newTheme === 'dark') icon.classList.replace('fa-moon', 'fa-sun');
    else icon.classList.replace('fa-sun', 'fa-moon');
});

// توابع اصلی دیتا
async function fetchProxies() {
    try {
        statusText.innerText = 'در حال دریافت از منبع اصلی...';
        // اضافه کردن timestamp برای جلوگیری از کش شدن توسط مرورگر
        const response = await fetch(PRIMARY_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error('Primary failed');
        const data = await response.json();
        
        // پردازش دیتای اصلی
        allProxies = processPrimaryData(data);
        statusText.innerText = 'بروزرسانی شد';
    } catch (err) {
        console.warn('Source 1 failed, trying backup...', err);
        statusText.innerText = 'استفاده از منبع کمکی...';
        try {
            const response = await fetch(BACKUP_URL + '?t=' + Date.now());
            const text = await response.text();
            allProxies = processBackupData(text);
            statusText.innerText = 'بروزرسانی شد (کمکی)';
        } catch (backupErr) {
            statusText.innerText = 'خطا در دریافت پروکسی';
            container.innerHTML = '<p style="text-align:center; padding:20px">خطا در دریافت اطلاعات. لطفا بعدا تلاش کنید.</p>';
            return;
        }
    }

    populateFilter();
    renderProxies(allProxies);
}

function processPrimaryData(data) {
    // دیتای جیسون را استاندارد میکنیم
    // فرض بر این است که دیتا آرایه‌ای از آبجکت‌هاست
    return data.map(p => ({
        host: p.host,
        port: p.port,
        secret: p.secret,
        country: p.country || 'Unknown',
        ping: p.ping || '?',
        // اگر addTime نداشت، زمان حال را میگذاریم تا در سورت به مشکل نخوریم
        addTime: p.addTime || 0
    })).sort((a, b) => b.addTime - a.addTime); // جدیدترین اول
}

function processBackupData(text) {
    // استخراج لینک‌های t.me با Regex
    const lines = text.split('\n');
    const proxies = [];
    const regex = /server=([^&]+)&port=([^&]+)&secret=([^&]+)/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            proxies.push({
                host: match[1],
                port: match[2],
                secret: match[3],
                country: 'Global', // در بکاپ کشور مشخص نیست
                ping: '?',
                addTime: 0
            });
        }
    });
    return proxies; // چون زمان ندارند، سورت نمیشوند
}

// ساخت کارت‌ها
function renderProxies(list) {
    container.innerHTML = '';
    countEl.innerText = list.length;

    if (list.length === 0) {
        container.innerHTML = '<p style="text-align:center">پروکسی یافت نشد.</p>';
        return;
    }

    // برای جلوگیری از فشار به مرورگر، فقط 50 تای اول را ابتدا رندر میکنیم (Lazy Loading ساده)
    // اما چون درخواست کاربر همه بود، همه را میگذاریم ولی پیشنهاد میشه محدود شه.
    // اینجا همه را میذاریم چون معمولا لیست جیسون حدود 50-100 تاست.
    
    list.forEach(p => {
        const link = `https://t.me/proxy?server=${p.host}&port=${p.port}&secret=${p.secret}`;
        const flagUrl = p.country !== 'Unknown' && p.country !== 'Global' 
            ? `https://flagcdn.com/48x36/${p.country.toLowerCase()}.png` 
            : 'https://via.placeholder.com/48x36?text=?';

        const card = document.createElement('div');
        card.className = 'proxy-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="country-info">
                    <img src="${flagUrl}" class="flag-icon" onerror="this.src='https://via.placeholder.com/48x36?text=?'">
                    <span>${p.country}</span>
                </div>
                <span class="ping">${p.ping}ms</span>
            </div>
            <div class="card-details">
                <div><i class="fas fa-network-wired"></i> ${p.host}</div>
                <div><i class="fas fa-door-open"></i> ${p.port}</div>
            </div>
            <div class="card-actions">
                <a href="${link}" class="action-btn btn-connect">
                    <i class="fas fa-bolt"></i> اتصال
                </a>
                <button class="action-btn btn-copy" onclick="copyToClipboard('${link}')">
                    <i class="far fa-copy"></i> کپی
                </button>
                <button class="action-btn btn-qr" onclick="showQR('${link}')">
                    <i class="fas fa-qrcode"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function populateFilter() {
    const countries = [...new Set(allProxies.map(p => p.country))].sort();
    filterSelect.innerHTML = '<option value="all">همه کشورها</option>';
    countries.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.innerText = `${c} (${allProxies.filter(p => p.country === c).length})`;
        filterSelect.appendChild(option);
    });
}

// فیلتر کردن
filterSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
        renderProxies(allProxies);
    } else {
        renderProxies(allProxies.filter(p => p.country === val));
    }
});

// ابزارها (کپی و QR)
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('لینک کپی شد!');
    }).catch(err => {
        console.error('Copy failed', err);
    });
};

window.showQR = (text) => {
    const modal = document.getElementById('qr-modal');
    const img = document.getElementById('qr-image');
    // استفاده از API رایگان QR Code
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
    modal.style.display = 'flex';
};

document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('qr-modal').style.display = 'none';
});

window.onclick = (event) => {
    const modal = document.getElementById('qr-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

// شروع برنامه
initTheme();
fetchProxies();
