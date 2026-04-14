(function(){
  var STORAGE_KEYS = {
    goals: "gugu_site_goal_plans_v1",
    quote: "gugu_site_quotes_v1",
    manifest: "gugu_site_manifest_v1",
    incense: "gugu_site_incense_v1",
    risk: "gugu_site_risk_v1"
  };

  var DAILY_QUOTES = [
    "今天认真留住的一点，会在几年后变成很大的从容。",
    "复利最温柔的地方，是它从不嫌弃起点小。",
    "你不是在追一串数字，你是在慢慢替未来铺路。",
    "今天的秩序感，会在未来替你挡住很多慌张。",
    "一点点继续，也是在向自己证明：我做得到。",
    "慢也没关系，只要没有停下，今天就算在前进。",
    "你留下来的每一笔钱，最后都会变成选择权。",
    "真正有力量的变化，常常是安静发生的。",
    "把大愿望拆成小动作，它就会开始靠近你。",
    "未来不会突然变好，它会先在今天发出一点光。",
    "你每次没有放弃记录，目标就又真实了一点。",
    "很多看似普通的坚持，最后会长成很亮的底气。",
    "你在攒的不是冷冰冰的数字，而是一种更自由的生活感。",
    "愿你慢慢学会，稳也是一种很厉害的速度。",
    "今天也在把远方，悄悄推近一点。",
    "越早看清自己的节奏，越不容易被别人的节奏带乱。",
    "不是所有前进都要被看见，有些前进只是更稳了。",
    "先把今天过稳，很多未来自然会慢慢靠近。",
    "长期感不是天生就有的，是在反复继续里练出来的。",
    "你每一次没有乱掉节奏，都是在给未来加固。"
  ];

  var AVATAR_SVG =
    '<svg viewBox="0 0 240 188" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="wingWash" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="#dfe9ef"/>' +
          '<stop offset="100%" stop-color="#b8ccda"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M42 110c12-23 33-40 62-48 23-6 50-4 79 9 28 12 45 28 52 49-18 14-41 22-67 24-39 3-72-4-100-20-13-7-21-12-26-14z" fill="#fdfcf9" stroke="#2b2b2a" stroke-width="3.8"/>' +
        '<path d="M86 82c17-13 40-20 69-17 23 2 41 12 55 29 7 8 11 17 13 28-19 5-35 11-47 18-12 7-21 17-26 28-28-1-53-8-72-22-10-7-16-15-18-25-2-12 7-25 26-39z" fill="url(#wingWash)" stroke="#323642" stroke-width="3.2"/>' +
        '<path d="M144 86c10 2 19 5 28 11 10 7 17 16 22 28" stroke="#8fa2b3" stroke-width="5.2"/>' +
        '<path d="M154 128c16 0 31 2 43 6 17 6 28 14 34 25-16 9-34 13-53 12-16 0-28-5-37-14-7-7-8-14-3-20 3-5 8-8 16-9z" fill="#ddd7d4" stroke="#2a2b2f" stroke-width="3.2"/>' +
        '<path d="M168 126c12 0 23 2 34 6 11 5 18 10 22 16-6 4-12 6-18 7-5 0-10-1-15-3-4 3-9 4-14 4-7 0-13-3-18-8 0-10 3-17 9-20z" fill="#1f2435" stroke="#202332" stroke-width="3.2"/>' +
        '<path d="M174 136c5 1 10 3 14 5" stroke="#fffdf8" stroke-width="3"/>' +
        '<path d="M191 140c4 2 8 4 11 7" stroke="#fffdf8" stroke-width="3"/>' +
        '<path d="M34 112c-8 0-18 4-28 11 8 4 20 4 36 1 9-2 16-5 21-9-5-4-11-5-18-3l-11 0z" fill="#c66446" stroke="#8d3d30" stroke-width="3"/>' +
        '<path d="M84 76c13-15 31-24 56-25" stroke="#efded4" stroke-width="3.2"/>' +
        '<circle cx="88" cy="92" r="12.6" fill="#fffefb" stroke="#2b2b2a" stroke-width="2.8"/>' +
        '<circle cx="89" cy="92" r="4.6" fill="#2a3240" stroke="none"/>' +
        '<circle cx="86" cy="89" r="1.4" fill="#ffffff" stroke="none"/>' +
        '<path d="M103 53c9 0 16 3 20 8" stroke="#edd5cf" stroke-width="3"/>' +
        '<path d="M82 144c0 16 1 29 3 41" stroke="#934f3d" stroke-width="5.2"/>' +
        '<path d="M99 144c0 16 1 29 3 41" stroke="#934f3d" stroke-width="5.2"/>' +
        '<path d="M76 184c8-2 15-2 22 1" stroke="#934f3d" stroke-width="5.2"/>' +
        '<path d="M92 184c8-2 15-2 22 1" stroke="#934f3d" stroke-width="5.2"/>' +
        '<path d="M118 157c-23 1-43-5-61-18" stroke="#d7d1ca" stroke-width="4.4"/>' +
        '<path d="M71 98c0 4 1 7 3 10" stroke="#c8c8c8" stroke-width="2.6"/>' +
      '</g>' +
    '</svg>';

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function readJSON(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error){
      return fallback;
    }
  }

  function writeJSON(key, value){
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error){}
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(value){
    return "¥" + Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    });
  }

  function percentLabel(value){
    return Math.round(Number(value || 0) * 100) + "%";
  }

  function getTodayKey(){
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function quoteIndexForDate(dateKey){
    var total = 0;
    for(var i = 0; i < dateKey.length; i += 1){
      total += dateKey.charCodeAt(i) * (i + 3);
    }
    return total % DAILY_QUOTES.length;
  }

  function getDailyQuote(){
    var today = getTodayKey();
    var stored = readJSON(STORAGE_KEYS.quote, null);
    if(stored && stored.date === today && DAILY_QUOTES[stored.index]){
      return { date: today, text: DAILY_QUOTES[stored.index] };
    }
    var nextIndex = quoteIndexForDate(today);
    writeJSON(STORAGE_KEYS.quote, { date: today, index: nextIndex });
    return { date: today, text: DAILY_QUOTES[nextIndex] };
  }

  function mountAvatar(){
    document.querySelectorAll("[data-gugu-avatar]").forEach(function(node){
      node.innerHTML = AVATAR_SVG;
    });
  }

  function activateNav(){
    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a").forEach(function(link){
      var href = link.getAttribute("href");
      if(href === path){
        link.classList.add("active");
      }
    });
  }

  function createToast(){
    if(document.getElementById("siteToast")){return;}
    var toast = document.createElement("div");
    toast.id = "siteToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  function showToast(message){
    createToast();
    var toast = document.getElementById("siteToast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function(){
      toast.classList.remove("show");
    }, 2600);
  }

  window.GuguSite = {
    STORAGE_KEYS: STORAGE_KEYS,
    DAILY_QUOTES: DAILY_QUOTES,
    AVATAR_SVG: AVATAR_SVG,
    clamp: clamp,
    readJSON: readJSON,
    writeJSON: writeJSON,
    escapeHtml: escapeHtml,
    formatCurrency: formatCurrency,
    percentLabel: percentLabel,
    getTodayKey: getTodayKey,
    getDailyQuote: getDailyQuote,
    showToast: showToast
  };

  document.addEventListener("DOMContentLoaded", function(){
    activateNav();
    mountAvatar();
  });
})();
