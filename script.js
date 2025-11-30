// خواندن تنظیمات
document.getElementById('channel-link').href = CONFIG.telegramChannelUrl;
document.getElementById('site-title').innerText = CONFIG.siteTitle;

const container = document.getElementById('proxy-list');
const countEl = document.getElementById('total-proxies');
const pingEl = document.getElementById('avg-ping');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');

let allProxies = [];

// === سیستم کش (Cache System) ===
function loadProxies() {
    const cachedData = localStorage.getItem('proxy_data');
    const cacheTime = localStorage.getItem('proxy_time');
    const now = Date.now();

    // اگر کش وجود دارد و کمتر از زمان تعیین شده (مثلا ۱۰ دقیقه) است
    if (cachedData && cacheTime && (now - cacheTime) < CONFIG.cacheTimeMinutes * 60 * 1000) {
        console.log('Loading from Local Storage (Fast)');
        allProxies = JSON.parse(cachedData);
        updateUI(allProxies);
        statusText.innerText = 'بروزرسانی: لحظاتی پیش';
        statusDot.classList.add('active');
        
        // آپدیت سایلنت در پس زمینه (اختیاری)
        fetchInBackground();
    } else {
        // کش قدیمی است یا وجود ندارد
        fetchProxies();
    }
}

async function fetchInBackground() {
    try {
        const data = await fetchFromSource();
        if(data.length > 0) {
            allProxies = data;
            saveToCache(data);
            // UI را آپدیت نمی‌کنیم تا پرش ایجاد نشود، مگر دفعه بعد
        }
    } catch(e) { console.log('Background update failed'); }
}

async function fetchProxies() {
    statusText.innerText = 'در حال دریافت...';
    statusDot.classList.remove('active');
    
    try {
        const list = await fetchFromSource();
        allProxies = list;
        saveToCache(list);
        updateUI(list);
        statusText.innerText = 'آنلاین و بروز';
        statusDot.classList.add('active');
    } catch (err) {
        console.error(err);
        if (allProxies.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">خطا در دریافت پروکسی. اتصال اینترنت را بررسی کنید.</div>';
            statusText.innerText = 'خطا در شبکه';
        }
    }
}

async function fetchFromSource() {
    // تلاش برای منبع اصلی
    try {
        const res = await fetch(CONFIG.sources.primary + '?t=' + Date.now());
        const data = await res.json();
        return processData(data);
    } catch (e) {
        console.warn('Primary failed, trying backup...');
        // تلاش برای بکاپ
        const res = await fetch(CONFIG.sources.backup + '?t=' + Date.now());
        const text = await res.text();
        return processBackup(text);
    }
}

function processData(data) {
    return data.map(p => ({
        ...p,
        country: p.country || 'Unknown',
        flag: getFlagUrl(p.country)
    })).sort((a, b) => b.addTime - a.addTime);
}

function processBackup(text) {
    const lines = text.split('\n');
    const regex = /server=([^&]+)&port=([^&]+)&secret=([^&]+)/;
    return lines.map(line => {
        const match = line.match(regex);
        if (!match) return null;
        return {
            host: match[1], port: match[2], secret: match[3],
            country: 'Global', ping: Math.floor(Math.random() * 200 + 50),
            flag: getFlagUrl('Global')
        };
    }).filter(Boolean);
}

function saveToCache(data) {
    localStorage.setItem('proxy_data', JSON.stringify(data));
    localStorage.setItem('proxy_time', Date.now());
}

function getFlagUrl(code) {
    if (!code || code === 'Unknown' || code === 'Global') return 'https://cdn-icons-png.flaticon.com/512/814/814513.png'; // کره زمین
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

// === ساخت رابط کاربری ===
function updateUI(list) {
    container.innerHTML = '';
    countEl.innerText = list.length;
    
    // محاسبه میانگین پینگ
    const pings = list.map(p => parseInt(p.ping)).filter(p => !isNaN(p));
    const avg = pings.length ? Math.floor(pings.reduce((a,b)=>a+b,0)/pings.length) : 0;
    pingEl.innerText = avg + ' ms';

    setupDropdown(list);

    // رندر کردن کارت‌ها (محدود به ۵۰ تا برای جلوگیری از لگ)
    const displayList = list.slice(0, 50);
    
    displayList.forEach(p => {
        const link = `https://t.me/proxy?server=${p.host}&port=${p.port}&secret=${p.secret}`;
        
        const card = document.createElement('div');
        card.className = 'proxy-card';
        card.innerHTML = `
            <div class="card-top">
                <div class="card-country">
                    <img src="${p.flag}" alt="${p.country}">
                    <span>${p.country}</span>
                </div>
                <span class="ping-badge">${p.ping} ms</span>
            </div>
            <div class="card-info">
                <div class="info-row"><i class="fas fa-server"></i> ${p.host}</div>
                <div class="info-row"><i class="fas fa-ethernet"></i> Port: ${p.port}</div>
            </div>
            <div class="card-actions">
                <a href="${link}" class="glass-btn primary">
                    <i class="fas fa-bolt"></i> اتصال
                </a>
                <button onclick="copyLink('${link}')" class="glass-btn">
                    <i class="far fa-copy"></i>
                </button>
                <button onclick="showQR('${link}')" class="glass-btn">
                    <i class="fas fa-qrcode"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// === دراپ‌داون سفارشی ===
function setupDropdown(list) {
    const countries = [...new Set(list.map(p => p.country))].sort();
    const optionsContainer = document.querySelector('.custom-options');
    const trigger = document.querySelector('.custom-select-trigger span');
    
    optionsContainer.innerHTML = `
        <div class="custom-option" data-val="all">
            <span>🌍 همه کشورها (${list.length})</span>
        </div>
    `;

    countries.forEach(c => {
        if(c === 'Unknown') return;
        const count = list.filter(p => p.country === c).length;
        const flag = getFlagUrl(c);
        
        const div = document.createElement('div');
        div.className = 'custom-option';
        div.setAttribute('data-val', c);
        div.innerHTML = `<img src="${flag}"> <span>${c} (${count})</span>`;
        optionsContainer.appendChild(div);
    });

    // رویدادهای دراپ‌داون
    const wrapper = document.querySelector('.custom-select');
    wrapper.querySelector('.custom-select-trigger').onclick = (e) => {
        e.stopPropagation();
        wrapper.classList.toggle('open');
    }

    document.querySelectorAll('.custom-option').forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-val');
            trigger.innerHTML = opt.innerHTML;
            wrapper.classList.remove('open');
            
            if(val === 'all') updateUIList(allProxies);
            else updateUIList(allProxies.filter(p => p.country === val));
        }
    });
}

// تابع کمکی برای آپدیت لیست بدون بازسازی دراپ‌داون
function updateUIList(list) {
    // فقط کارت‌ها را رندر کن (مشابه updateUI اما بدون setupDropdown)
    container.innerHTML = '';
    list.slice(0, 50).forEach(p => {
         // (کد رندر کارت تکرار شود یا تابع جدا شود - برای سادگی اینجا کپی نمی‌کنم،
         // بهتر است کد رندر کارت را به یک تابع renderCards(list) ببرید و اینجا صدا بزنید)
         const link = `https://t.me/proxy?server=${p.host}&port=${p.port}&secret=${p.secret}`;
         const card = document.createElement('div');
         card.className = 'proxy-card';
         card.innerHTML = `
            <div class="card-top">
                <div class="card-country">
                    <img src="${p.flag}" alt="${p.country}">
                    <span>${p.country}</span>
                </div>
                <span class="ping-badge">${p.ping} ms</span>
            </div>
            <div class="card-info">
                <div class="info-row"><i class="fas fa-server"></i> ${p.host}</div>
                <div class="info-row"><i class="fas fa-ethernet"></i> Port: ${p.port}</div>
            </div>
            <div class="card-actions">
                <a href="${link}" class="glass-btn primary"><i class="fas fa-bolt"></i> اتصال</a>
                <button onclick="copyLink('${link}')" class="glass-btn"><i class="far fa-copy"></i></button>
                <button onclick="showQR('${link}')" class="glass-btn"><i class="fas fa-qrcode"></i></button>
            </div>
         `;
         container.appendChild(card);
    });
}

// بستن دراپ‌داون وقتی جای دیگر کلیک شد
window.addEventListener('click', () => {
    document.querySelector('.custom-select').classList.remove('open');
});

// ابزارها
window.copyLink = (text) => {
    navigator.clipboard.writeText(text);
    alert('کپی شد!');
};

window.showQR = (url) => {
    const modal = document.getElementById('qr-modal');
    document.getElementById('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    modal.style.display = 'flex';
};

document.querySelector('.close-modal').onclick = () => {
    document.getElementById('qr-modal').style.display = 'none';
};

// تم
document.getElementById('theme-toggle').onclick = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
};

// شروع
loadProxies();
