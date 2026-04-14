(function(){
  if(!window.GuguSite){return;}
  var readJSON = GuguSite.readJSON;
  var writeJSON = GuguSite.writeJSON;
  var formatCurrency = GuguSite.formatCurrency;
  var getDailyQuote = GuguSite.getDailyQuote;
  var STORAGE_KEY = GuguSite.STORAGE_KEYS.goals;

  var store = readJSON(STORAGE_KEY, {
    activePlans: [],
    archivedPlans: [],
    selectedPlanId: null
  });
  var editingPlanId = null;

  function qs(id){ return document.getElementById(id); }

  function createPlan(seed){
    seed = seed || {};
    return {
      id: seed.id || ("goal-" + Date.now() + "-" + Math.floor(Math.random() * 1000)),
      title: seed.title || "",
      currentAge: seed.currentAge || "",
      targetAge: seed.targetAge || "",
      targetAmount: seed.targetAmount || "",
      currentPrincipal: seed.currentPrincipal || "",
      monthlyContribution: seed.monthlyContribution || "",
      annualReturn: seed.annualReturn || "",
      createdAt: seed.createdAt || Date.now(),
      status: seed.status || "active",
      completedAt: seed.completedAt || null,
      milestoneClaimed: seed.milestoneClaimed || {}
    };
  }

  function saveStore(){
    writeJSON(STORAGE_KEY, store);
  }

  function inferAnnualReturn(){
    return 0.06;
  }

  function calculatePlan(plan){
    var currentAge = Number(plan.currentAge || 0);
    var targetAge = Number(plan.targetAge || 0);
    var targetAmount = Number(plan.targetAmount || 0);
    var currentPrincipal = Number(plan.currentPrincipal || 0);
    var monthlyContribution = Number(plan.monthlyContribution || 0);
    var annualReturn = Number(plan.annualReturn || inferAnnualReturn());
    var isReady = currentAge > 0 && targetAge > 0 && targetAmount > 0 && currentPrincipal >= 0 && monthlyContribution >= 0;
    if(!isReady){
      return {
        isReady: false,
        progressPct: null,
        remainingMonths: null,
        projectedFinalAmount: null,
        requiredMonthlyContribution: null,
        remainingAmount: null,
        annualReturn: annualReturn,
        milestones: []
      };
    }
    var n = Math.max((targetAge - currentAge) * 12, 0);
    var r = annualReturn / 12;
    var progressPct = targetAmount > 0 ? currentPrincipal / targetAmount : 0;
    var projected = 0;
    var required = 0;
    if(n <= 0){
      projected = currentPrincipal;
      required = 0;
    } else if(r > 0){
      projected = currentPrincipal * Math.pow(1 + r, n) + monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
      required = (targetAmount - currentPrincipal * Math.pow(1 + r, n)) * r / (Math.pow(1 + r, n) - 1);
    } else {
      projected = currentPrincipal + monthlyContribution * n;
      required = (targetAmount - currentPrincipal) / n;
    }
    required = Math.max(required, 0);
    var milestones = [
      { pct:.10, label:"起步发光", reward:10 },
      { pct:.25, label:"小有根基", reward:18 },
      { pct:.50, label:"半程发光", reward:30 },
      { pct:.75, label:"看见自由", reward:45 },
      { pct:1, label:"目标达成", reward:88 }
    ].map(function(item){
      var key = String(item.pct);
      var amount = targetAmount * item.pct;
      return {
        key: key,
        label: item.label,
        reward: item.reward,
        amount: amount,
        status: currentPrincipal >= amount ? "done" : progressPct >= item.pct - .12 ? "active" : "pending",
        claimed: !!plan.milestoneClaimed[key]
      };
    });
    return {
      isReady: true,
      progressPct: progressPct,
      remainingMonths: n,
      projectedFinalAmount: projected,
      requiredMonthlyContribution: required,
      remainingAmount: Math.max(targetAmount - currentPrincipal, 0),
      annualReturn: annualReturn,
      milestones: milestones
    };
  }

  function selectedPlan(){
    return store.activePlans.find(function(plan){ return plan.id === store.selectedPlanId; }) || null;
  }

  function ensureSelected(){
    if(!store.activePlans.length){
      store.selectedPlanId = null;
      return;
    }
    if(!store.activePlans.some(function(plan){ return plan.id === store.selectedPlanId; })){
      store.selectedPlanId = store.activePlans[0].id;
    }
  }

  function monthLabel(totalMonths){
    var years = Math.floor(totalMonths / 12);
    var months = totalMonths % 12;
    return years + "年" + months + "个月";
  }

  function renderQuote(){
    var quote = getDailyQuote();
    if(qs("goalQuoteDate")){qs("goalQuoteDate").textContent = quote.date;}
    if(qs("goalQuoteText")){qs("goalQuoteText").textContent = quote.text;}
  }

  function renderPlanList(){
    ensureSelected();
    var list = qs("planList");
    qs("planCount").textContent = "进行中 " + store.activePlans.length + " / 3";
    list.innerHTML = store.activePlans.length ? store.activePlans.map(function(plan){
      var calc = calculatePlan(plan);
      var title = plan.title || "未命名目标";
      var isEditing = editingPlanId === plan.id;
      var isActive = plan.id === store.selectedPlanId;
      return '<div class="plan-card' + (isActive ? ' active' : '') + '">' +
        '<div class="plan-top">' +
          '<div><strong>' + GuguSite.escapeHtml(title) + '</strong><p>' + (calc.isReady ? '进行中' : '待填写') + '</p></div>' +
          '<span class="pill">' + (calc.isReady ? Math.round(calc.progressPct * 1000) / 10 + '%' : '先设目标') + '</span>' +
        '</div>' +
        '<div class="grid-3" style="margin-top:14px">' +
          '<div class="kpi"><small>剩余</small><strong>' + (calc.isReady ? monthLabel(calc.remainingMonths) : '先写年龄') + '</strong></div>' +
          '<div class="kpi"><small>每月需存</small><strong>' + (calc.isReady ? formatCurrency(calc.requiredMonthlyContribution) : '先填金额') + '</strong></div>' +
          '<div class="kpi"><small>按现在</small><strong>' + (calc.isReady ? formatCurrency(calc.projectedFinalAmount) : '等待计算') + '</strong></div>' +
        '</div>' +
        '<div class="plan-actions">' +
          '<button class="mini-btn" type="button" data-plan-action="edit" data-plan-id="' + plan.id + '">更新</button>' +
          '<button class="mini-btn warn" type="button" data-plan-action="complete" data-plan-id="' + plan.id + '"' + (!calc.isReady ? ' disabled' : '') + '>完成</button>' +
          '<button class="mini-btn warn" type="button" data-plan-action="archive" data-plan-id="' + plan.id + '">归档</button>' +
          '<button class="mini-btn danger" type="button" data-plan-action="delete" data-plan-id="' + plan.id + '">删除</button>' +
        '</div>' +
        (isEditing ? renderEditor(plan) : '') +
      '</div>';
    }).join("") : '<div class="goal-empty">先新建一个目标。</div>';
  }

  function renderEditor(plan){
    return '<div class="inline-editor">' +
      '<div class="form-grid">' +
        '<div class="field full"><label>标题</label><input data-plan-field="title" data-plan-id="' + plan.id + '" value="' + GuguSite.escapeHtml(plan.title) + '" placeholder="35岁退休计划"></div>' +
        '<div class="field"><label>当前年龄</label><input data-plan-field="currentAge" data-plan-id="' + plan.id + '" type="number" value="' + GuguSite.escapeHtml(plan.currentAge) + '" placeholder="23"></div>' +
        '<div class="field"><label>目标年龄</label><input data-plan-field="targetAge" data-plan-id="' + plan.id + '" type="number" value="' + GuguSite.escapeHtml(plan.targetAge) + '" placeholder="35"></div>' +
        '<div class="field"><label>目标金额</label><input data-plan-field="targetAmount" data-plan-id="' + plan.id + '" type="number" value="' + GuguSite.escapeHtml(plan.targetAmount) + '" placeholder="3000000"></div>' +
        '<div class="field"><label>当前本金</label><input data-plan-field="currentPrincipal" data-plan-id="' + plan.id + '" type="number" value="' + GuguSite.escapeHtml(plan.currentPrincipal) + '" placeholder="28000"></div>' +
        '<div class="field"><label>每月投入</label><input data-plan-field="monthlyContribution" data-plan-id="' + plan.id + '" type="number" value="' + GuguSite.escapeHtml(plan.monthlyContribution) + '" placeholder="4300"></div>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:14px"><button class="btn-primary" type="button" data-plan-action="save" data-plan-id="' + plan.id + '">更新</button><button class="btn-secondary" type="button" data-plan-action="close" data-plan-id="' + plan.id + '">收起</button></div>' +
    '</div>';
  }

  function renderDetail(){
    var wrap = qs("goalDetail");
    var plan = selectedPlan();
    if(!plan){
      wrap.innerHTML = '<div class="goal-empty">先新建一个目标。</div>';
      return;
    }
    var calc = calculatePlan(plan);
    if(!calc.isReady){
      wrap.innerHTML = '<div class="summary-banner"><strong>当前进度</strong><p>先把年龄、金额和每月投入补齐。</p></div>' +
        '<div class="grid-3" style="margin-top:14px"><div class="kpi"><small>进度</small><strong>先设目标</strong></div><div class="kpi"><small>剩余</small><strong>先写年龄</strong></div><div class="kpi"><small>年化</small><strong>参考年化 --</strong></div></div>';
      qs("milestoneList").innerHTML = '<div class="goal-empty">保存后再看里程碑。</div>';
      return;
    }
    wrap.innerHTML = '<div class="summary-banner"><strong>' + GuguSite.escapeHtml(plan.title || "未命名目标") + '</strong><p>已走到 ' + Math.round(calc.progressPct * 1000) / 10 + '%，想按时到达，每月还需 ' + formatCurrency(calc.requiredMonthlyContribution) + '。</p></div>' +
      '<div class="grid-3" style="margin-top:14px">' +
        '<div class="kpi"><small>还差</small><strong>' + formatCurrency(calc.remainingAmount) + '</strong><span>目标总额还没补齐</span></div>' +
        '<div class="kpi"><small>剩余</small><strong>' + monthLabel(calc.remainingMonths) + '</strong><span>按现在年龄到目标年龄</span></div>' +
        '<div class="kpi"><small>年化</small><strong>' + (calc.annualReturn * 100).toFixed(1) + '%</strong><span>当前按参考年化计算</span></div>' +
      '</div>' +
      '<div class="grid-3" style="margin-top:12px">' +
        '<div class="kpi"><small>按现在</small><strong>' + formatCurrency(calc.projectedFinalAmount) + '</strong><span>按当前节奏预计</span></div>' +
        '<div class="kpi"><small>每月需存</small><strong>' + formatCurrency(calc.requiredMonthlyContribution) + '</strong><span>按时到达所需</span></div>' +
        '<div class="kpi"><small>每月已存</small><strong>' + formatCurrency(plan.monthlyContribution) + '</strong><span>你当前设定</span></div>' +
      '</div>';

    qs("milestoneList").innerHTML = calc.milestones.map(function(item){
      return '<div class="milestone-item"><strong>' + item.label + '</strong><p>达成 ' + formatCurrency(item.amount) + '</p><div class="meta"><span class="pill">' + (item.status === 'done' ? '已完成' : item.status === 'active' ? '进行中' : '未开始') + '</span><span class="pill">+' + item.reward + ' 星星</span></div></div>';
    }).join("");
  }

  function renderArchive(){
    qs("archiveCount").textContent = store.archivedPlans.length + " 条";
    qs("archiveList").innerHTML = store.archivedPlans.length ? store.archivedPlans.map(function(plan){
      return '<div class="rule-item"><strong>' + GuguSite.escapeHtml(plan.title || "未命名目标") + '</strong><p>' + (plan.status === "completed" ? "已完成" : "已归档") + '</p><div class="meta"><button class="mini-btn danger" type="button" data-plan-action="delete" data-plan-id="' + plan.id + '">删除</button></div></div>';
    }).join("") : '<div class="goal-empty">这里还没有归档计划。</div>';
  }

  function renderAll(){
    renderQuote();
    renderPlanList();
    renderDetail();
    renderArchive();
  }

  function newPlan(){
    if(store.activePlans.length >= 3){
      GuguSite.showToast("先完成、归档或删除一个计划。");
      return;
    }
    var plan = createPlan();
    store.activePlans.push(plan);
    store.selectedPlanId = plan.id;
    editingPlanId = plan.id;
    saveStore();
    renderAll();
  }

  function selectPlan(id){
    store.selectedPlanId = id;
    saveStore();
    renderDetail();
    renderPlanList();
  }

  function openEditor(id){
    store.selectedPlanId = id;
    editingPlanId = id;
    renderAll();
  }

  function closeEditor(){
    editingPlanId = null;
    renderAll();
  }

  function savePlan(id){
    var plan = store.activePlans.find(function(item){ return item.id === id; });
    if(!plan){return;}
    document.querySelectorAll('[data-plan-id="' + id + '"][data-plan-field]').forEach(function(input){
      plan[input.getAttribute("data-plan-field")] = input.value.trim();
    });
    if(!plan.title){
      plan.title = "新目标 " + (store.activePlans.findIndex(function(item){ return item.id === id; }) + 1);
    }
    plan.annualReturn = inferAnnualReturn();
    editingPlanId = null;
    saveStore();
    renderAll();
    GuguSite.showToast("计划已更新。");
  }

  function moveToArchive(id, completed){
    var index = store.activePlans.findIndex(function(item){ return item.id === id; });
    if(index < 0){return;}
    var plan = store.activePlans[index];
    plan.status = completed ? "completed" : "archived";
    if(completed){plan.completedAt = Date.now();}
    store.activePlans.splice(index, 1);
    store.archivedPlans.unshift(plan);
    if(store.selectedPlanId === id){
      store.selectedPlanId = store.activePlans[0] ? store.activePlans[0].id : null;
    }
    editingPlanId = null;
    saveStore();
    renderAll();
  }

  function deletePlan(id){
    if(!window.confirm("要删除这个计划吗？")){return;}
    var activeIndex = store.activePlans.findIndex(function(item){ return item.id === id; });
    if(activeIndex >= 0){
      store.activePlans.splice(activeIndex, 1);
    } else {
      var archivedIndex = store.archivedPlans.findIndex(function(item){ return item.id === id; });
      if(archivedIndex >= 0){store.archivedPlans.splice(archivedIndex, 1);}
    }
    if(store.selectedPlanId === id){
      store.selectedPlanId = store.activePlans[0] ? store.activePlans[0].id : null;
    }
    editingPlanId = null;
    saveStore();
    renderAll();
  }

  function bindActions(){
    document.body.addEventListener("click", function(event){
      var action = event.target.getAttribute("data-plan-action");
      var id = event.target.getAttribute("data-plan-id");
      if(!action){return;}
      if(action === "edit"){ openEditor(id); }
      if(action === "save"){ savePlan(id); }
      if(action === "close"){ closeEditor(); }
      if(action === "complete"){ moveToArchive(id, true); }
      if(action === "archive"){ moveToArchive(id, false); }
      if(action === "delete"){ deletePlan(id); }
    });
    qs("newPlanBtn").addEventListener("click", newPlan);
    qs("archiveToggle").addEventListener("click", function(){
      qs("archiveWrap").classList.toggle("collapsed");
    });
    document.body.addEventListener("click", function(event){
      var card = event.target.closest(".plan-card");
      if(card && event.target.getAttribute("data-plan-action") == null){
        var index = Array.prototype.indexOf.call(qs("planList").children, card);
        var plan = store.activePlans[index];
        if(plan){selectPlan(plan.id);}
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(!qs("goalPage")){return;}
    ensureSelected();
    renderAll();
    bindActions();
  });
})();
