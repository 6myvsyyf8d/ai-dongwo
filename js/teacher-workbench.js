/**
 * teacher-workbench.js - 老师专业工作台
 * 聚合展示 ISP、能力评估、干预记录、情绪趋势
 */
window.TeacherWorkbench = (function () {
  'use strict';

  function render() {
    var user = AppState.currentUser;
    if (!user || user.role !== 'teacher') {
      window.location.hash = 'dashboard';
      return;
    }

    var youths = Permissions.getAccessibleYouths();
    var container = App.getContainer();

    container.innerHTML =
      '<div class="page-header">' +
        '<a href="#dashboard" class="page-back">‹ 返回</a>' +
        '<span class="page-title">🎓 专业工作台</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content" id="workbench-content">' +
        _renderContent(youths) +
      '</div>';

    _bindEvents(youths);
  }

  function _renderContent(youths) {
    if (youths.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">暂无学生</div></div>';
    }

    var html = '';
    for (var i = 0; i < youths.length; i++) {
      html += _renderStudentSection(youths[i]);
    }
    return html;
  }

  function _renderStudentSection(youth) {
    var profile = Storage.getProfile(youth.id);
    var records = Storage.getRecords(youth.id);

    var html = '<div class="workbench-student-card">';
    html += '<div class="workbench-student-name">' + Utils.escapeHtml(youth.name) + '</div>';

    // ISP（个案服务计划）
    var ispPlans = (profile && profile.workSupport && profile.workSupport.ispPlans) || [];
    html += '<div class="workbench-section">';
    html += '<div class="workbench-section-title">📋 个案服务计划 (ISP)</div>';
    if (ispPlans.length === 0) {
      html += '<div class="workbench-empty">暂无 ISP 计划</div>';
    } else {
      for (var pi = 0; pi < ispPlans.length; pi++) {
        html += '<div class="workbench-item">' +
          '<div class="workbench-item-title">' + Utils.escapeHtml(ispPlans[pi].title) + '</div>' +
          '<div class="workbench-item-status">' + (ispPlans[pi].status === 'active' ? '🟢 进行中' : '⚪ 已结束') + '</div>' +
          '<div class="workbench-item-detail">目标：' + (ispPlans[pi].goals || []).join('、') + '</div>' +
          '<div class="workbench-item-detail">开始：' + (ispPlans[pi].startDate || '-') + ' · 复核：' + (ispPlans[pi].reviewDate || '-') + '</div>' +
        '</div>';
      }
    }
    html += '</div>';

    // 能力评估（雷达图）
    var abilityRecords = records.filter(function(r) { return r.module === 'workSupport' && r.recordType === 'achievement'; });
    html += '<div class="workbench-section">';
    html += '<div class="workbench-section-title">📊 能力评估</div>';
    if (abilityRecords.length === 0) {
      html += '<div class="workbench-empty">暂无能力评估记录</div>';
    } else {
      // 计算各维度评分（基于记录标签）
      var scores = _calcAbilityScores(abilityRecords);
      html += _renderRadarChart(scores, abilityRecords);
    }
    html += '</div>';

    // 干预记录（事件记录）
    var incidentRecords = records.filter(function(r) { return r.recordType === 'incident'; });
    html += '<div class="workbench-section">';
    html += '<div class="workbench-section-title">📝 干预记录</div>';
    if (incidentRecords.length === 0) {
      html += '<div class="workbench-empty">暂无干预记录</div>';
    } else {
      var recentIncidents = incidentRecords.slice(-3).reverse();
      for (var ii = 0; ii < recentIncidents.length; ii++) {
        html += '<div class="workbench-item">' +
          '<div class="workbench-item-title">' + Utils.escapeHtml(recentIncidents[ii].content.text || '') + '</div>' +
          '<div class="workbench-item-detail">' + Utils.formatDate(recentIncidents[ii].recordedAt) + '</div>' +
        '</div>';
      }
    }
    html += '</div>';

    // 情绪趋势（最近 7 条情绪记录）
    var emotionRecords = records.filter(function(r) { return r.module === 'emotionBehavior'; });
    html += '<div class="workbench-section">';
    html += '<div class="workbench-section-title">📈 情绪趋势</div>';
    if (emotionRecords.length === 0) {
      html += '<div class="workbench-empty">暂无情绪记录</div>';
    } else {
      var recentEmotions = emotionRecords.slice(-7).reverse();
      // 简单柱状图
      html += '<div class="workbench-chart">';
      for (var ei = 0; ei < recentEmotions.length; ei++) {
        var tags = (recentEmotions[ei].content && recentEmotions[ei].content.tags) || [];
        var isPositive = tags.some(function(t) { return ['平静','愉悦','配合','专注'].indexOf(t) > -1; });
        var height = isPositive ? 80 : 40;
        var color = isPositive ? '#34c759' : '#ff9500';
        html += '<div class="workbench-bar" style="height:' + height + 'px;background:' + color + ';" title="' + Utils.escapeHtml(recentEmotions[ei].content.text || '') + '"></div>';
      }
      html += '</div>';
      html += '<div class="workbench-chart-labels">最近 ' + recentEmotions.length + ' 条情绪记录</div>';
    }
    html += '</div>';

    html += '</div>'; // student card
    return html;
  }

  function _bindEvents(youths) {
    // 暂无交互事件
  }

  /**
   * 从成就记录中计算能力维度评分
   */
  function _calcAbilityScores(abilityRecords) {
    var dimensions = [
      { key: 'communication', label: '沟通表达', positiveTags: ['主动表达', '清晰', '辅助沟通'], negativeTags: ['被动回应', '模糊'] },
      { key: 'independence', label: '独立自主', positiveTags: ['独立完成', '主动', '专注'], negativeTags: ['需要提示', '需要协助', '需要提醒'] },
      { key: 'social', label: '社交互动', positiveTags: ['社交互动', '配合', '愉悦'], negativeTags: ['抗拒', '情绪波动'] },
      { key: 'workQuality', label: '工作质量', positiveTags: ['完成质量高', '主动', '专注'], negativeTags: ['分心', '需要提示'] },
      { key: 'emotion', label: '情绪管理', positiveTags: ['平静', '愉悦', '配合'], negativeTags: ['低落', '焦虑', '易怒', '抗拒', '情绪波动'] }
    ];

    var scores = [];
    for (var d = 0; d < dimensions.length; d++) {
      var dim = dimensions[d];
      var total = 0;
      var count = 0;
      for (var i = 0; i < abilityRecords.length; i++) {
        var tags = (abilityRecords[i].content && abilityRecords[i].content.tags) || [];
        for (var t = 0; t < tags.length; t++) {
          if (dim.positiveTags.indexOf(tags[t]) > -1) { total += 5; count++; }
          else if (dim.negativeTags.indexOf(tags[t]) > -1) { total += 2; count++; }
        }
      }
      // 默认 3 分，有数据则取平均
      var score = count > 0 ? Math.round(total / count) : 3;
      scores.push({ label: dim.label, score: score, max: 5 });
    }
    return scores;
  }

  /**
   * 渲染 SVG 雷达图
   */
  function _renderRadarChart(scores, abilityRecords) {
    var n = scores.length;
    var cx = 140, cy = 140, r = 100;
    var levels = 5;
    var svgW = 280, svgH = 280;

    var html = '<div style="text-align:center;">' +
      '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">';

    // 背景网格
    for (var lv = 1; lv <= levels; lv++) {
      var points = [];
      for (var i = 0; i < n; i++) {
        var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        var pr = (r / levels) * lv;
        var px = cx + pr * Math.cos(angle);
        var py = cy + pr * Math.sin(angle);
        points.push(px.toFixed(1) + ',' + py.toFixed(1));
      }
      html += '<polygon points="' + points.join(' ') + '" fill="none" stroke="#e5e5ea" stroke-width="1"/>';
    }

    // 轴线
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var ex = cx + r * Math.cos(angle);
      var ey = cy + r * Math.sin(angle);
      html += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="#e5e5ea" stroke-width="1"/>';
    }

    // 数据多边形
    var dataPoints = [];
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var dr = (r / scores[i].max) * scores[i].score;
      var dx = cx + dr * Math.cos(angle);
      var dy = cy + dr * Math.sin(angle);
      dataPoints.push(dx.toFixed(1) + ',' + dy.toFixed(1));
    }
    html += '<polygon points="' + dataPoints.join(' ') + '" fill="rgba(0,122,255,0.15)" stroke="#007aff" stroke-width="2"/>';

    // 数据点
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var dr = (r / scores[i].max) * scores[i].score;
      var dx = cx + dr * Math.cos(angle);
      var dy = cy + dr * Math.sin(angle);
      html += '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="4" fill="#007aff"/>';
    }

    // 标签
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var lr = r + 24;
      var lx = cx + lr * Math.cos(angle);
      var ly = cy + lr * Math.sin(angle);
      var anchor = 'middle';
      if (lx < cx - 20) anchor = 'end';
      else if (lx > cx + 20) anchor = 'start';
      html += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + anchor + '" font-size="11" fill="#6e6e73">' + scores[i].label + ' ' + scores[i].score + '/' + scores[i].max + '</text>';
    }

    html += '</svg></div>';

    // 最近记录
    html += '<div style="font-size:11px;color:#6a6888;text-align:center;margin-top:4px;">基于 ' + abilityRecords.length + ' 条成就记录</div>';

    return html;
  }

  return {
    render: render
  };
})();
