(function(){
  if(!window.GuguSite){return;}
  var readJSON = GuguSite.readJSON;
  var writeJSON = GuguSite.writeJSON;
  var formatCurrency = GuguSite.formatCurrency;
  var percentLabel = GuguSite.percentLabel;
  var clamp = GuguSite.clamp;
  var STORAGE_KEY = GuguSite.STORAGE_KEYS.risk;

  var riskAnswers = readJSON(STORAGE_KEY, {});
  var advisorState = { generated: false, step: "risk" };

  function qs(id){ return document.getElementById(id); }
  function qsa(selector){ return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function getRiskQuizScore(){
    var required = ["q1","q2","q3","q4","q5","q6","q7","q8"];
    var answered = required.filter(function(key){ return !!riskAnswers[key]; });
    if(!answered.length){ return { score: 50, complete: false }; }
    var weights = { q1:.16, q2:.14, q3:.14, q4:.16, q5:.10, q6:.10, q7:.10, q8:.10 };
    var totalWeight = answered.reduce(function(sum, key){ return sum + weights[key]; }, 0);
    var weighted = answered.reduce(function(sum, key){ return sum + Number(riskAnswers[key]) * weights[key]; }, 0);
    var average = totalWeight > 0 ? weighted / totalWeight : 2.5;
    return { score: clamp((average - 1) / 3 * 100, 0, 100), complete: answered.length === required.length };
  }

  function getObjectiveScore(inputs, totalAssets){
    var emergencyMonths = inputs.monthlyExpense > 0 ? inputs.liquidCash / inputs.monthlyExpense : 0;
    var coverageScore = emergencyMonths < 1 ? 10 : emergencyMonths < 2 ? 22 : emergencyMonths < 3 ? 35 : emergencyMonths < 6 ? 58 : emergencyMonths < 9 ? 72 : 85;
    var nearTermPressure = inputs.liquidCash <= 0 ? 100 : inputs.nearExpense / Math.max(inputs.liquidCash, 1);
    var nearTermScore = nearTermPressure > 1 ? 5 : nearTermPressure > 0.7 ? 18 : nearTermPressure > 0.45 ? 36 : nearTermPressure > 0.2 ? 58 : 78;
    var futurePressure = totalAssets <= 0 ? 100 : inputs.futureExpense / Math.max(totalAssets, 1);
    var futureScore = futurePressure > 0.5 ? 12 : futurePressure > 0.3 ? 28 : futurePressure > 0.15 ? 50 : 74;
    var horizonScore = inputs.horizonYears <= 1 ? 16 : inputs.horizonYears <= 3 ? 36 : inputs.horizonYears <= 5 ? 60 : 82;
    var incomeScore = [0, 22, 42, 66, 84][inputs.incomeStability] || 42;
    var experienceScore = [0, 18, 38, 58, 76][inputs.experience] || 38;
    var lossScore = inputs.maxLossPct <= 5 ? 16 : inputs.maxLossPct <= 8 ? 30 : inputs.maxLossPct <= 12 ? 52 : inputs.maxLossPct <= 18 ? 72 : 84;
    var investableRatio = totalAssets <= 0 ? 0 : inputs.investableCash / Math.max(totalAssets, 1);
    var investableScore = investableRatio < 0.1 ? 22 : investableRatio < 0.25 ? 40 : investableRatio < 0.45 ? 58 : 74;
    return {
      emergencyMonths: emergencyMonths,
      investableRatio: investableRatio,
      score: coverageScore * .26 + nearTermScore * .18 + futureScore * .12 + horizonScore * .14 + incomeScore * .12 + experienceScore * .08 + lossScore * .06 + investableScore * .04
    };
  }

  function calculateStudentAdvisor(inputs){
    var totalAssets = Math.max(inputs.liquidCash + inputs.investableCash + inputs.futureExpense * .35, 1);
    var subjective = getRiskQuizScore();
    var objective = getObjectiveScore(inputs, totalAssets);
    var combinedScore = subjective.score * .38 + objective.score * .62;
    var phase = "可配置增长期";
    var phaseReason = "现金缓冲相对完整，可以开始放大长期资金。";
    if(objective.emergencyMonths < 2 || inputs.liquidCash < inputs.nearExpense){
      phase = "现金修复期";
      phaseReason = "先补近 3 个月支出和生活缓冲。";
    } else if(objective.emergencyMonths < 6 || inputs.futureExpense > inputs.liquidCash * .6 || inputs.investableCash < inputs.monthlyExpense * 2){
      phase = "稳健积累期";
      phaseReason = "可以开始配置，但先兼顾未来支出。";
    }
    var grade = combinedScore < 28 ? 1 : combinedScore < 45 ? 2 : combinedScore < 62 ? 3 : combinedScore < 78 ? 4 : 5;
    if(phase === "现金修复期"){ grade = Math.min(grade, 2); }
    if(inputs.horizonYears <= 1){ grade = Math.min(grade, 2); }
    if(inputs.maxLossPct <= 8){ grade = Math.min(grade, 2); }
    if(objective.emergencyMonths < 4){ grade = Math.min(grade, 3); }
    var gradeMeta = {
      1:{ tag:"R1 · 现金防守", bars:1, stockMax:.12, base:{ stock:.12, bond:.20, cash:.68 } },
      2:{ tag:"R2 · 稳健保守", bars:2, stockMax:.22, base:{ stock:.28, bond:.27, cash:.45 } },
      3:{ tag:"R3 · 稳健平衡", bars:3, stockMax:.38, base:{ stock:.46, bond:.30, cash:.24 } },
      4:{ tag:"R4 · 进取增长", bars:4, stockMax:.52, base:{ stock:.60, bond:.24, cash:.16 } },
      5:{ tag:"R5 · 高波动增长", bars:5, stockMax:.62, base:{ stock:.72, bond:.18, cash:.10 } }
    };
    var meta = gradeMeta[grade];

    var lifeNeed = inputs.monthlyExpense * 2 + inputs.nearExpense;
    var stableNeed = Math.max(inputs.monthlyExpense * (phase === "现金修复期" ? 4 : 3), Math.max(inputs.futureExpense - inputs.nearExpense, 0));
    var remaining = totalAssets;
    var lifeAmount = Math.min(remaining, lifeNeed); remaining -= lifeAmount;
    var stableAmount = Math.min(remaining, stableNeed); remaining -= stableAmount;
    var growthAmount = Math.max(remaining, 0);

    var stableCashShare = phase === "现金修复期" ? .92 : phase === "稳健积累期" ? .76 : .60;
    var stockAmount = growthAmount * meta.base.stock;
    var bondAmount = stableAmount * (1 - stableCashShare) + growthAmount * meta.base.bond;
    var cashAmount = lifeAmount + stableAmount * stableCashShare + growthAmount * meta.base.cash;

    var stockPct = stockAmount / totalAssets;
    var bondPct = bondAmount / totalAssets;
    var cashPct = cashAmount / totalAssets;
    var cashFloor = Math.max((lifeAmount + Math.max(inputs.nearExpense, 0)) / totalAssets, phase === "现金修复期" ? .58 : phase === "稳健积累期" ? .35 : .18);
    var stockCap = clamp(meta.stockMax - (phase === "现金修复期" ? .08 : phase === "稳健积累期" ? .03 : 0), .05, .62);

    if(stockPct > stockCap){
      var excess = stockPct - stockCap;
      stockPct = stockCap;
      cashPct += excess * .65;
      bondPct += excess * .35;
    }

    function estimateDrawdown(stockShare, bondShare, cashShare){
      return stockShare * .38 + bondShare * .10 + cashShare * .01;
    }

    var estimatedDrawdown = estimateDrawdown(stockPct, bondPct, cashPct);
    while(estimatedDrawdown > inputs.maxLossPct / 100 && stockPct > .05){
      stockPct -= .03;
      bondPct += .01;
      cashPct += .02;
      estimatedDrawdown = estimateDrawdown(stockPct, bondPct, cashPct);
    }

    if(cashPct < cashFloor){
      var diff = cashFloor - cashPct;
      var shiftFromStock = Math.min(diff, Math.max(stockPct - .05, 0));
      stockPct -= shiftFromStock;
      cashPct += shiftFromStock;
      diff -= shiftFromStock;
      if(diff > 0){
        var shiftFromBond = Math.min(diff, Math.max(bondPct - .08, 0));
        bondPct -= shiftFromBond;
        cashPct += shiftFromBond;
      }
    }

    var totalPct = stockPct + bondPct + cashPct;
    stockPct /= totalPct;
    bondPct /= totalPct;
    cashPct /= totalPct;
    estimatedDrawdown = estimateDrawdown(stockPct, bondPct, cashPct);

    return {
      score: Math.round(combinedScore),
      subjectiveScore: Math.round(subjective.score),
      objectiveScore: Math.round(objective.score),
      emergencyMonths: objective.emergencyMonths,
      investableRatio: objective.investableRatio,
      phase: phase,
      phaseReason: phaseReason,
      gradeTag: meta.tag,
      bars: meta.bars,
      allocation: { cash: cashPct, bond: bondPct, stock: stockPct },
      expectedReturn: stockPct * .09 + bondPct * .032 + cashPct * .018,
      volatility: Math.sqrt(Math.pow(stockPct * .22, 2) + Math.pow(bondPct * .06, 2) + Math.pow(cashPct * .005, 2) + 2 * stockPct * bondPct * .22 * .06 * .20),
      estimatedDrawdown: estimatedDrawdown,
      buckets: [
        { label:"生活桶", amount:lifeAmount, percent:lifeAmount / totalAssets, color:"#6f8193", hint:"日常支出和近 3 个月确定花销。" },
        { label:"稳定桶", amount:stableAmount, percent:stableAmount / totalAssets, color:"#8d9988", hint:"应急金和一年内准备中的支出。" },
        { label:"增长桶", amount:growthAmount, percent:growthAmount / totalAssets, color:"#bf8e40", hint:"真正长期不用的钱，才慢慢走远。" }
      ],
      stockRules: [
        { title:"先宽基", text:"先让宽基指数做底仓。", tag:"核心仓优先" },
        { title:"控单一标的", text:"不要过重压单一股票。", tag:"上限 5%-10%" },
        { title:"控单一行业", text:"同一行业不要堆太多。", tag:"行业上限 30%-35%" },
        { title:"防伪分散", text:"高相关赛道不算真正分散。", tag:"单一市场 < 70%" }
      ],
      bondRules: [
        { title:"先短久期", text:"债券先承担缓冲。", tag:"短久期优先" },
        { title:"再看中短债", text:"现金稳住后再加中短债。", tag:"中短债次之" },
        { title:"长债只少量", text:"只有长期不用的钱才碰长债。", tag:"少量即可" },
        { title:"不做信用下沉", text:"新手优先高信用等级。", tag:"先保稳定" }
      ],
      constraints: [
        { title:"现金底线", text:"生活桶和近 3 个月支出不能进股票。", tag:"最低现金 " + percentLabel(cashFloor) },
        { title:"风险资产上限", text:"股票仓位不能越界。", tag:"股票上限 " + percentLabel(stockCap) },
        { title:"最大回撤", text:"回撤超阈值就降风险。", tag:"回撤上限 " + inputs.maxLossPct + "%" },
        { title:"集中度上限", text:"不要压在单一方向。", tag:"单一标的不重压" }
      ],
      rebalance: [
        { title:"触发条件", text:"偏离足够大才再调仓。", tag:"偏离 5%-10%" },
        { title:"检查频率", text:"按节奏检查，不用天天调。", tag: grade <= 2 ? "每月看一次" : "每季看一次" },
        { title:"调整顺序", text:"先补生活桶，再补稳定桶。", tag:"先稳后动" },
        { title:"解释方式", text:"支出上升时先补现金。", tag:"先补现金" }
      ],
      mptRules: [
        { title:"目标", text:"先稳，再微调。", tag:"先保现金流" },
        { title:"约束", text:"现金底线不能破。", tag:"最低现金优先" },
        { title:"上限", text:"股票和波动都不越界。", tag:"限制极端权重" },
        { title:"输出", text:"只给可执行区间。", tag:"不给极端解" }
      ]
    };
  }

  function renderRiskQuiz(){
    var progress = getRiskQuizScore();
    var count = Object.keys(riskAnswers).length;
    qs("riskProgressLabel").textContent = count + " / 8";
    qs("riskProgressFill").style.width = (count / 8 * 100) + "%";
    qs("riskQuizHint").textContent = progress.complete ? "测评完成，可以往下读了。" : "先把 8 题做完，结果会更稳定。";
    qsa("[data-risk-question]").forEach(function(group){
      var q = group.getAttribute("data-risk-question");
      qsa("button", group);
      group.querySelectorAll("button").forEach(function(btn){
        btn.classList.toggle("active", Number(btn.getAttribute("data-risk-value")) === Number(riskAnswers[q] || 0));
      });
    });
  }

  function renderRiskBars(count){
    var wrap = qs("riskBars");
    wrap.innerHTML =
      '<div class="paper-rails">' +
        '<div class="paper-rail"><strong>现金防守</strong></div>' +
        '<div class="paper-rail"><strong>稳健保守</strong></div>' +
        '<div class="paper-rail"><strong>稳健平衡</strong></div>' +
        '<div class="paper-rail"><strong>进取增长</strong></div>' +
      '</div>' +
      '<div class="paper-marker" style="left:' + (8 + (count - 1) * 18) + '%">R' + count + '</div>';
  }

  function updateStageGlyph(phase){
    var key = phase === "现金修复期" ? "cash" : phase === "稳健积累期" ? "steady" : "growth";
    qsa("[data-stage-dot]").forEach(function(dot){
      dot.classList.toggle("active", dot.getAttribute("data-stage-dot") === key || (key === "growth" && dot.getAttribute("data-stage-dot") === "extra"));
    });
  }

  function readInputs(){
    return {
      monthlyExpense: Number(qs("advisorMonthlyExpense").value || 0),
      liquidCash: Number(qs("advisorLiquidCash").value || 0),
      nearExpense: Number(qs("advisorNearExpense").value || 0),
      futureExpense: Number(qs("advisorFutureExpense").value || 0),
      investableCash: Number(qs("advisorInvestableCash").value || 0),
      horizonYears: Number(qs("advisorHorizon").value || 1),
      incomeStability: Number(qs("advisorIncomeStability").value || 1),
      experience: Number(qs("advisorExperience").value || 1),
      maxLossPct: Number(qs("advisorMaxLoss").value || 8)
    };
  }

  function populateFields(){
    var defaults = {
      advisorMonthlyExpense: 3200,
      advisorLiquidCash: 12000,
      advisorNearExpense: 2500,
      advisorFutureExpense: 6000,
      advisorInvestableCash: 10000
    };
    Object.keys(defaults).forEach(function(id){
      if(qs(id) && !qs(id).value){ qs(id).value = defaults[id]; }
    });
  }

  function renderRuleGrid(containerId, items){
    qs(containerId).innerHTML = items.map(function(item, index){
      return '<div class="rule-sheet"><span class="index">' + String(index + 1).padStart(2, "0") + '</span><strong>' + item.title + '</strong><p>' + item.text + '</p><div class="meta"><span class="pill">' + item.tag + '</span></div></div>';
    }).join("");
  }

  function renderBuckets(items){
    qs("bucketList").innerHTML = items.map(function(bucket){
      return '<div class="bucket-sheet"><strong>' + bucket.label + '</strong><p>' + bucket.hint + '</p><div class="meta"><span class="pill">' + formatCurrency(bucket.amount) + '</span><span class="pill">' + percentLabel(bucket.percent) + '</span></div><div class="track"><span class="fill" style="width:' + (bucket.percent * 100).toFixed(1) + '%;background:' + bucket.color + '"></span></div></div>';
    }).join("");
  }

  function renderAllocation(plan){
    qs("allocationList").innerHTML = [
      { label:"现金 / 货基", value: plan.allocation.cash, color:"#6f8193" },
      { label:"债券 / 短债", value: plan.allocation.bond, color:"#8d9988" },
      { label:"股票 / 宽基ETF", value: plan.allocation.stock, color:"#bf8e40" }
    ].map(function(item){
      return '<div class="allocation-row"><span>' + item.label + '</span><div class="track"><span class="fill" style="width:' + (item.value * 100).toFixed(1) + '%;background:' + item.color + '"></span></div><strong>' + percentLabel(item.value) + '</strong></div>';
    }).join("");

    qs("allocationPills").innerHTML =
      '<span class="pill">参考年化 ' + (plan.expectedReturn * 100).toFixed(1) + '%</span>' +
      '<span class="pill">波动率约 ' + (plan.volatility * 100).toFixed(1) + '%</span>' +
      '<span class="pill">可投资 ' + percentLabel(plan.investableRatio) + '</span>' +
      '<span class="pill">现金底线 ' + percentLabel(plan.allocation.cash) + '</span>';
  }

  function unlockSpreads(){
    qsa('[data-step-panel="bucket"], [data-step-panel="allocation"], [data-step-panel="execute"]').forEach(function(section){
      section.classList.remove("locked");
    });
    qsa("[data-step-btn]").forEach(function(btn){
      btn.classList.add("done");
    });
  }

  function renderPlan(){
    populateFields();
    var plan = calculateStudentAdvisor(readInputs());
    advisorState.generated = true;

    qs("riskTag").textContent = plan.gradeTag;
    qs("riskBarLabel").textContent = "主观与客观一起算";
    renderRiskBars(plan.bars);
    qs("riskPhase").textContent = plan.phase;
    qs("riskPhaseReason").textContent = plan.phaseReason;
    updateStageGlyph(plan.phase);
    qs("riskScore").textContent = String(plan.score);
    qs("riskScoreHint").textContent = "主观 " + plan.subjectiveScore + " · 客观 " + plan.objectiveScore;
    qs("riskScoreGauge").querySelector(".score-ring").style.setProperty("--score", String(plan.score));
    qs("riskEmergency").textContent = plan.emergencyMonths.toFixed(1) + "个月现金缓冲";
    qs("riskDrawdown").textContent = "-" + (plan.estimatedDrawdown * 100).toFixed(1) + "%";
    qs("riskDrawdown").style.left = clamp(plan.estimatedDrawdown * 100 * 4, 14, 92) + "%";

    renderBuckets(plan.buckets);
    renderAllocation(plan);
    renderRuleGrid("mptList", plan.mptRules);
    renderRuleGrid("stockRules", plan.stockRules);
    renderRuleGrid("bondRules", plan.bondRules);
    renderRuleGrid("constraintRules", plan.constraints);
    renderRuleGrid("rebalanceRules", plan.rebalance);
    unlockSpreads();
    GuguSite.showToast("结果已更新。");
  }

  function scrollToSection(step){
    var targetMap = {
      risk: "#advisor-risk",
      bucket: "#advisor-bucket",
      allocation: "#advisor-allocation",
      execute: "#advisor-diversify"
    };
    var target = document.querySelector(targetMap[step]);
    if(target){
      target.scrollIntoView({ behavior:"smooth", block:"start" });
    }
  }

  function openStep(step){
    if(step !== "risk" && !advisorState.generated){
      GuguSite.showToast("先完成风险与现金流。");
      return;
    }
    advisorState.step = step;
    scrollToSection(step);
  }

  function syncActiveStep(step){
    advisorState.step = step;
    qsa("[data-step-btn]").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-step-btn") === step);
    });
  }

  function switchExecution(mode){
    qsa("[data-execution-switch]").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-execution-switch") === mode);
    });
    qs("executionSplit").classList.toggle("hide", mode !== "split");
    qs("executionRebalance").classList.toggle("hide", mode !== "rebalance");
  }

  function switchDiversify(mode){
    qsa("[data-diversify-switch]").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-diversify-switch") === mode);
    });
    qs("stockRulesWrap").classList.toggle("hide", mode !== "stock");
    qs("bondRulesWrap").classList.toggle("hide", mode !== "bond");
  }

  function bindRiskQuiz(){
    qsa("[data-risk-question] button").forEach(function(btn){
      btn.addEventListener("click", function(){
        var q = btn.closest("[data-risk-question]").getAttribute("data-risk-question");
        riskAnswers[q] = Number(btn.getAttribute("data-risk-value"));
        writeJSON(STORAGE_KEY, riskAnswers);
        renderRiskQuiz();
      });
    });
  }

  function bindPageTurns(){
    qsa("[data-next-step]").forEach(function(link){
      link.addEventListener("click", function(event){
        var step = link.getAttribute("data-next-step");
        if(step !== "risk" && !advisorState.generated){
          event.preventDefault();
          GuguSite.showToast("先完成风险与现金流。");
          return;
        }
      });
    });
  }

  function bindStepScrollSync(){
    var sections = qsa("[data-step-panel]");
    if(!sections.length){return;}
    var observer = new IntersectionObserver(function(entries){
      var visible = entries.filter(function(entry){ return entry.isIntersecting; })
        .sort(function(a, b){ return b.intersectionRatio - a.intersectionRatio; });
      if(!visible.length){return;}
      syncActiveStep(visible[0].target.getAttribute("data-step-panel"));
    }, { threshold:[0.25, 0.5, 0.7] });
    sections.forEach(function(section){ observer.observe(section); });
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(!qs("advisorPage")){return;}
    populateFields();
    bindRiskQuiz();
    bindPageTurns();
    bindStepScrollSync();
    renderRiskQuiz();
    renderRiskBars(3);
    updateStageGlyph("稳健积累期");
    switchDiversify("stock");
    switchExecution("split");

    qs("generatePlanBtn").addEventListener("click", renderPlan);
    qsa("[data-step-btn]").forEach(function(btn){
      btn.addEventListener("click", function(){
        openStep(btn.getAttribute("data-step-btn"));
      });
    });
    qsa("[data-diversify-switch]").forEach(function(btn){
      btn.addEventListener("click", function(){
        switchDiversify(btn.getAttribute("data-diversify-switch"));
      });
    });
    qsa("[data-execution-switch]").forEach(function(btn){
      btn.addEventListener("click", function(){
        switchExecution(btn.getAttribute("data-execution-switch"));
      });
    });
  });
})();
