(function(){
  if(!window.GuguSite){return;}
  var readJSON = GuguSite.readJSON;
  var writeJSON = GuguSite.writeJSON;
  var getDailyQuote = GuguSite.getDailyQuote;
  var getTodayKey = GuguSite.getTodayKey;
  var STORAGE_MANIFEST = GuguSite.STORAGE_KEYS.manifest;
  var STORAGE_INCENSE = GuguSite.STORAGE_KEYS.incense;

  function qs(id){ return document.getElementById(id); }

  var manifestState = readJSON(STORAGE_MANIFEST, {
    wallEntries: [],
    lastWish: "",
    lastRenderedAt: 0
  });

  function loadIncenseState(){
    var today = getTodayKey();
    var stored = readJSON(STORAGE_INCENSE, null);
    if(stored && stored.date === today){
      return {
        date: today,
        litCount: Number(stored.litCount || 0),
        slots: Array.isArray(stored.slots) ? stored.slots.slice(0, 3) : [false, false, false]
      };
    }
    return { date: today, litCount: 0, slots: [false, false, false] };
  }

  var incenseState = loadIncenseState();
  var canvas, ctx, dpr, width, height;
  var glow = null;
  var wallEntries = (manifestState.wallEntries || []).slice(-12);
  var smokeParticles = [];
  var hoverIncense = -1;
  var activeIncense = -1;

  function saveManifest(){
    manifestState.wallEntries = wallEntries.slice(-12);
    manifestState.lastRenderedAt = Date.now();
    writeJSON(STORAGE_MANIFEST, manifestState);
    writeJSON(STORAGE_INCENSE, incenseState);
  }

  function resize(){
    canvas = qs("manifestCanvas");
    if(!canvas){return;}
    dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomFont(){
    return [
      "600 12px 'PingFang SC'",
      "700 16px 'SF Pro Display'",
      "500 14px 'Kaiti SC'",
      "700 20px 'Helvetica Neue'"
    ][Math.floor(Math.random() * 4)];
  }

  function generateWallEntry(text){
    var items = [];
    for(var i = 0; i < 28; i += 1){
      items.push({
        text: text,
        x: Math.random() * width,
        y: 58 + Math.random() * (height - 180),
        size: 13 + Math.random() * 24,
        alpha: 0.08 + Math.random() * 0.2,
        rotate: (Math.random() - 0.5) * 0.22,
        font: randomFont(),
        color: ["#d8a35f", "#9aaad2", "#ffffff", "#b8c1c8", "#e6b67d"][Math.floor(Math.random() * 5)]
      });
    }
    return { text: text, items: items };
  }

  function hexToRgba(hex, alpha){
    var value = hex.replace("#", "");
    if(value.length === 3){
      value = value.split("").map(function(ch){ return ch + ch; }).join("");
    }
    var r = parseInt(value.slice(0,2),16);
    var g = parseInt(value.slice(2,4),16);
    var b = parseInt(value.slice(4,6),16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function drawBackground(){
    var grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#eef4f7");
    grad.addColorStop(0.34, "#f7eccc");
    grad.addColorStop(0.72, "#eed2a2");
    grad.addColorStop(1, "#ddb37b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    var sun = ctx.createRadialGradient(width * 0.5, height * 0.14, 20, width * 0.5, height * 0.14, 240);
    sun.addColorStop(0, "rgba(255,255,255,.96)");
    sun.addColorStop(0.2, "rgba(255,247,210,.9)");
    sun.addColorStop(1, "rgba(255,247,210,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    var mist = ctx.createLinearGradient(0, height * 0.58, 0, height);
    mist.addColorStop(0, "rgba(255,255,255,.08)");
    mist.addColorStop(1, "rgba(255,248,236,.36)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, height * 0.54, width, height * 0.46);
  }

  function drawWall(){
    wallEntries.forEach(function(entry){
      entry.items.forEach(function(item){
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotate);
        ctx.font = item.font.replace(/\d+px/, Math.round(item.size) + "px");
        ctx.fillStyle = item.color === "#ffffff" ? "rgba(255,255,255," + item.alpha.toFixed(2) + ")" : hexToRgba(item.color, item.alpha);
        ctx.fillText(item.text, 0, 0);
        ctx.restore();
      });
    });
  }

  function incensePoints(){
    return [
      { x: width * 0.45, y: height * 0.67, angle: -0.18 },
      { x: width * 0.50, y: height * 0.64, angle: 0 },
      { x: width * 0.55, y: height * 0.67, angle: 0.18 }
    ];
  }

  function incenseHitAreas(){
    return incensePoints().map(function(point){
      return {
        x: point.x - 18,
        y: point.y - 176,
        width: 36,
        height: 186
      };
    });
  }

  function drawPotShadow(){
    ctx.save();
    ctx.translate(width * 0.5, height * 0.82);
    ctx.fillStyle = "rgba(113,89,61,.14)";
    ctx.beginPath();
    ctx.ellipse(0, 22, 126, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawIncensePot(time){
    var pulse = 0.88 + Math.sin(time / 800) * 0.04;
    ctx.save();
    ctx.translate(width * 0.5, height * 0.77);

    var glowBack = ctx.createRadialGradient(0, -38, 20, 0, -18, 180);
    glowBack.addColorStop(0, "rgba(255,244,207,.46)");
    glowBack.addColorStop(1, "rgba(255,244,207,0)");
    ctx.fillStyle = glowBack;
    ctx.fillRect(-180, -190, 360, 260);

    var body = ctx.createLinearGradient(0, -78, 0, 84);
    body.addColorStop(0, "#8d6c50");
    body.addColorStop(0.55, "#6f543f");
    body.addColorStop(1, "#503d30");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 18, 108, 74, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,244,230,.18)";
    ctx.beginPath();
    ctx.ellipse(-18, -8, 48, 18, -0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5b4232";
    ctx.beginPath();
    ctx.ellipse(0, -18, 88, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    var ash = ctx.createLinearGradient(0, -36, 0, 2);
    ash.addColorStop(0, "#d8c0a0");
    ash.addColorStop(1, "#b38a63");
    ctx.fillStyle = ash;
    ctx.beginPath();
    ctx.ellipse(0, -20, 74, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,236,214,.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 94, 58, 0, 0.12, Math.PI - 0.12);
    ctx.stroke();

    if(incenseState.litCount > 0){
      var innerGlow = ctx.createRadialGradient(0, -28, 0, 0, -18, 90);
      innerGlow.addColorStop(0, "rgba(255,220,140," + (0.18 * pulse).toFixed(3) + ")");
      innerGlow.addColorStop(1, "rgba(255,220,140,0)");
      ctx.fillStyle = innerGlow;
      ctx.fillRect(-120, -120, 240, 160);
    }

    ctx.restore();
  }

  function drawIncenseSticks(time){
    incensePoints().forEach(function(point, index){
      var lit = incenseState.slots[index];
      var isHover = hoverIncense === index && !lit && incenseState.litCount < 3;
      var isActive = activeIncense === index;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(point.angle);

      ctx.strokeStyle = isHover ? "#92614f" : "#7b5342";
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -166);
      ctx.stroke();

      if(isHover){
        ctx.strokeStyle = "rgba(255,255,255,.28)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -166);
        ctx.stroke();
      }

      if(lit || isActive){
        var pulse = 0.78 + Math.sin(time / 220 + index) * 0.18;
        var ember = ctx.createRadialGradient(0, -166, 0, 0, -166, 20);
        ember.addColorStop(0, "rgba(255,249,222," + pulse.toFixed(2) + ")");
        ember.addColorStop(0.35, "rgba(255,183,82,.92)");
        ember.addColorStop(1, "rgba(255,183,82,0)");
        ctx.fillStyle = ember;
        ctx.beginPath();
        ctx.arc(0, -166, isActive ? 21 : 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffb24e";
        ctx.beginPath();
        ctx.arc(0, -166, isActive ? 4.6 : 4.1, 0, Math.PI * 2);
        ctx.fill();
      }

      if(lit && Math.random() < 0.15){
        smokeParticles.push({
          x: point.x,
          y: point.y - 166,
          life: 0,
          drift: (Math.random() - 0.5) * 0.36,
          size: 12 + Math.random() * 10
        });
      }
      ctx.restore();
    });
  }

  function drawSmoke(){
    smokeParticles = smokeParticles.filter(function(p){ return p.life < 1; });
    smokeParticles.forEach(function(p){
      p.life += 0.012;
      p.x += p.drift;
      p.y -= 0.68;
      ctx.fillStyle = "rgba(255,255,255," + (0.18 * (1 - p.life)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + p.life), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGlowAnimation(time){
    if(!glow){return;}
    glow.t += 0.018;
    var cx = width * 0.5;
    var cy = height * 0.42;
    if(glow.t < 0.24){
      ctx.save();
      ctx.font = "700 28px 'PingFang SC'";
      ctx.fillStyle = "rgba(67,78,111,.94)";
      ctx.textAlign = "center";
      ctx.fillText(glow.text, cx, cy);
      ctx.restore();
    } else if(glow.t < 0.46){
      var shrink = 1 - (glow.t - 0.24) / 0.22;
      ctx.save();
      ctx.fillStyle = "rgba(255,241,191,.94)";
      ctx.beginPath();
      ctx.arc(cx, cy, 50 * shrink + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "700 " + Math.max(11, Math.round(30 * shrink)) + "px 'PingFang SC'";
      ctx.fillStyle = "rgba(255,255,255,.96)";
      ctx.textAlign = "center";
      ctx.fillText(glow.text, cx, cy + 4);
      ctx.restore();
    } else if(glow.t < 0.72){
      var beamProgress = (glow.t - 0.46) / 0.26;
      ctx.save();
      for(var i = 0; i < 18; i += 1){
        var tx = 46 + (i % 6) * (width / 6.3) + (i > 11 ? 18 : 0);
        var ty = 76 + Math.floor(i / 6) * 170 + (i % 3) * 20;
        ctx.strokeStyle = "rgba(255,227,150," + (0.54 - beamProgress * 0.24).toFixed(2) + ")";
        ctx.lineWidth = 2 + Math.sin(i + time / 180) * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (tx - cx) * beamProgress, cy + (ty - cy) * beamProgress);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      wallEntries.push(generateWallEntry(glow.text));
      wallEntries = wallEntries.slice(-12);
      manifestState.lastWish = glow.text;
      saveManifest();
      qs("manifestHint").textContent = "这一句已经被留在这里了。";
      glow = null;
    }
  }

  function draw(time){
    if(!ctx){return;}
    drawBackground();
    drawWall();
    drawGlowAnimation(time);
    drawPotShadow();
    drawIncensePot(time);
    drawIncenseSticks(time);
    drawSmoke();
    requestAnimationFrame(draw);
  }

  function syncQuote(){
    var quote = getDailyQuote();
    qs("manifestQuoteDate").textContent = quote.date;
    qs("manifestQuoteText").textContent = quote.text;
  }

  function updateIncenseUi(){
    qs("incenseStatus").textContent = incenseState.litCount + " / 3";
    qs("incenseComplete").textContent = incenseState.litCount >= 3 ? "今日已圆满" : "每炷 +2 星星";
    qs("incenseNote").textContent = incenseState.litCount === 0 ? "把鼠标放到香上，再轻轻点亮它。" : incenseState.litCount < 3 ? "继续点亮下一炷。" : "今天的三炷香已经圆满。";
  }

  function lightIncense(index){
    if(index < 0 || incenseState.slots[index] || incenseState.litCount >= 3){return;}
    incenseState.slots[index] = true;
    incenseState.litCount += 1;
    saveManifest();
    updateIncenseUi();
    GuguSite.showToast("一炷香已点亮。");
  }

  function pointerPosition(event){
    var rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function hitTestIncense(pos){
    var hits = incenseHitAreas();
    for(var i = 0; i < hits.length; i += 1){
      var hit = hits[i];
      if(pos.x >= hit.x && pos.x <= hit.x + hit.width && pos.y >= hit.y && pos.y <= hit.y + hit.height){
        return i;
      }
    }
    return -1;
  }

  function bindCanvasInteraction(){
    canvas.addEventListener("pointermove", function(event){
      var hit = hitTestIncense(pointerPosition(event));
      hoverIncense = hit;
      canvas.style.cursor = hit >= 0 && !incenseState.slots[hit] && incenseState.litCount < 3 ? "pointer" : "default";
    });
    canvas.addEventListener("pointerleave", function(){
      hoverIncense = -1;
      activeIncense = -1;
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("pointerdown", function(event){
      var hit = hitTestIncense(pointerPosition(event));
      if(hit >= 0 && !incenseState.slots[hit] && incenseState.litCount < 3){
        activeIncense = hit;
      }
    });
    canvas.addEventListener("pointerup", function(event){
      var hit = hitTestIncense(pointerPosition(event));
      if(hit >= 0 && activeIncense === hit){
        lightIncense(hit);
      }
      activeIncense = -1;
    });
  }

  function submitWish(){
    var text = qs("wishInput").value.trim();
    if(!text){
      GuguSite.showToast("先写下这一刻的念头。");
      return;
    }
    manifestState.lastWish = text;
    qs("manifestHint").textContent = "它正在慢慢聚成一团光。";
    glow = { text: text, t: 0, done: false };
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(!qs("manifestPage")){return;}
    resize();
    syncQuote();
    updateIncenseUi();
    qs("manifestHint").textContent = manifestState.lastWish ? "上一次留下的话，还在这里。" : "写下这一刻最常停留的那句话。";
    wallEntries = (manifestState.wallEntries || []).slice(-12);
    window.addEventListener("resize", function(){
      resize();
      wallEntries = (manifestState.wallEntries || []).slice(-12);
    });
    bindCanvasInteraction();
    qs("manifestSubmit").addEventListener("click", submitWish);
    requestAnimationFrame(draw);
  });
})();
