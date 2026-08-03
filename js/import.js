/**
 * import.js - 心青年档案批量导入
 * 支持 JSON / CSV 两种格式
 */
window.ImportModule = (function () {
  'use strict';

  var parsedData = [];

  /**
   * 渲染批量导入页面
   */
  function renderImport() {
    var container = App.getContainer();
    parsedData = [];

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-back">‹</button>' +
        '<span class="page-title">批量导入档案</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="import-upload-zone" id="import-upload-zone">' +
          '<div class="import-upload-icon">📥</div>' +
          '<div class="import-upload-title">拖拽文件到此处，或点击选择文件</div>' +
          '<div class="import-upload-hint">支持 .json 和 .csv 格式</div>' +
          '<input type="file" id="import-file-input" accept=".json,.csv" style="display:none;">' +
        '</div>' +
        '<div class="import-preview" id="import-preview" style="display:none;"></div>' +
        '<div class="import-result" id="import-result" style="display:none;"></div>' +
      '</div>';

    _bindEvents();
  }

  /**
   * 绑定事件
   */
  function _bindEvents() {
    document.getElementById('btn-back').addEventListener('click', function () {
      history.back();
    });

    var uploadZone = document.getElementById('import-upload-zone');
    var fileInput = document.getElementById('import-file-input');

    // 点击上传区域
    uploadZone.addEventListener('click', function (e) {
      if (e.target === fileInput) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) {
        _handleFile(this.files[0]);
      }
    });

    // 拖拽事件
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        _handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * 处理文件解析
   */
  function _handleFile(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'json' && ext !== 'csv') {
      AppState.showToast('不支持的文件格式，请上传 .json 或 .csv 文件');
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var content = reader.result;
      var result;
      if (ext === 'json') {
        result = _parseJSON(content);
      } else {
        result = _parseCSV(content);
      }

      if (!result.success) {
        AppState.showToast(result.error);
        return;
      }

      parsedData = result.data;
      _renderPreview();
    };
    reader.onerror = function () {
      AppState.showToast('文件读取失败，请重试');
    };
    reader.readAsText(file);
  }

  /**
   * 解析 JSON 文件
   */
  function _parseJSON(content) {
    try {
      var data = JSON.parse(content);
      if (!Array.isArray(data)) {
        return { success: false, error: 'JSON 文件内容必须是数组格式' };
      }
      if (data.length === 0) {
        return { success: false, error: 'JSON 文件中没有数据' };
      }
      return { success: true, data: data };
    } catch (e) {
      return { success: false, error: 'JSON 解析失败：' + e.message };
    }
  }

  /**
   * 解析 CSV 文件
   */
  function _parseCSV(content) {
    var lines = content.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return { success: false, error: 'CSV 文件至少需要表头和一行数据' };
    }

    var headers = _parseCSVLine(lines[0]);
    var expectedHeaders = ['name', 'gender', 'birthDate', 'idNumber', 'region',
      'disabilityType', 'disabilityLevel', 'schoolStatus', 'schoolName', 'workStatus'];

    // 检查表头
    var lowerHeaders = headers.map(function (h) { return h.trim().toLowerCase(); });
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (lowerHeaders.indexOf(expectedHeaders[i]) === -1) {
        return { success: false, error: 'CSV 表头缺少字段：' + expectedHeaders[i] };
      }
    }

    var data = [];
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var values = _parseCSVLine(line);
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j].trim().toLowerCase();
        var val = j < values.length ? values[j].trim() : '';
        row[key] = val;
      }
      // 至少要有 name
      if (row.name) {
        data.push(row);
      }
    }

    if (data.length === 0) {
      return { success: false, error: 'CSV 文件中没有有效数据行' };
    }

    return { success: true, data: data };
  }

  /**
   * 解析 CSV 行（处理引号包裹的逗号）
   */
  function _parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * 渲染预览表格
   */
  function _renderPreview() {
    var previewEl = document.getElementById('import-preview');
    var uploadZone = document.getElementById('import-upload-zone');
    var resultEl = document.getElementById('import-result');

    uploadZone.style.display = 'none';
    resultEl.style.display = 'none';

    var previewRows = parsedData.slice(0, 10);
    var fieldLabels = ['姓名', '性别', '出生日期', '身份证号', '居住区域', '残疾类型', '残疾等级', '就学状态', '学校名称', '就业状态'];
    var fieldKeys = ['name', 'gender', 'birthDate', 'idNumber', 'region', 'disabilityType', 'disabilityLevel', 'schoolStatus', 'schoolName', 'workStatus'];

    var html = '<div class="import-preview-header">' +
      '<div class="import-preview-title">数据预览</div>' +
      '<div class="import-preview-summary">共解析 <strong>' + parsedData.length + '</strong> 条记录，以下为前 ' + Math.min(parsedData.length, 10) + ' 条</div>' +
      '</div>' +
      '<div class="import-table-wrap"><table class="import-table">' +
      '<thead><tr>';

    for (var i = 0; i < fieldLabels.length; i++) {
      html += '<th>' + fieldLabels[i] + '</th>';
    }

    html += '</tr></thead><tbody>';

    for (var i = 0; i < previewRows.length; i++) {
      var row = previewRows[i];
      html += '<tr>';
      for (var j = 0; j < fieldKeys.length; j++) {
        var val = row[fieldKeys[j]] || '';
        html += '<td>' + Utils.escapeHtml(String(val)) + '</td>';
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>' +
      '<div class="import-actions">' +
        '<button class="btn btn-outline" id="btn-cancel-import">取消</button>' +
        '<button class="btn btn-primary" id="btn-confirm-import">确认导入 ' + parsedData.length + ' 条</button>' +
      '</div>';

    previewEl.innerHTML = html;
    previewEl.style.display = 'block';

    document.getElementById('btn-cancel-import').addEventListener('click', function () {
      parsedData = [];
      uploadZone.style.display = 'flex';
      previewEl.style.display = 'none';
      resultEl.style.display = 'none';
      document.getElementById('import-file-input').value = '';
    });

    document.getElementById('btn-confirm-import').addEventListener('click', function () {
      _doImport();
    });
  }

  /**
   * 执行导入
   */
  function _doImport() {
    var successCount = 0;
    var failCount = 0;
    var failures = [];

    for (var i = 0; i < parsedData.length; i++) {
      var row = parsedData[i];
      try {
        var gender = row.gender || 'other';
        if (gender === '男') gender = 'male';
        else if (gender === '女') gender = 'female';
        else if (gender === 'male' || gender === 'female' || gender === 'other') { /* keep */ }
        else gender = 'other';

        var profile = {
          id: Utils.generateUUID(),
          name: row.name || '',
          gender: gender,
          birthDate: row.birthDate || '',
          idNumber: row.idNumber || '',
          avatar: '🌻',
          region: row.region || '',
          disabilityType: row.disabilityType || '',
          disabilityLevel: row.disabilityLevel || '',
          schoolStatus: row.schoolStatus || '',
          schoolName: row.schoolName || '',
          workStatus: row.workStatus || '',
          lifeCycleStatus: 'created',
          currentGuardianId: null,
          emergencyContacts: [],
          modules: {
            communicationGuide: { preferredMethods: [], expressionDifficulties: null, specialHabits: [], sensoryPreferences: null },
            emotionBehavior: { behaviorRedLines: [], emotionTrend: [], interventionHistory: [] },
            careMedical: { allergies: [], medications: [], medicalHistory: [], careNotes: [], dailyRoutine: null },
            workSupport: { ispPlans: [], capabilityAssessment: null, workPreferences: [], favoriteActivities: [], favoritePlaces: [], futureWishes: [] }
          },
          createdAt: Utils.formatDateTime(),
          updatedAt: Utils.formatDateTime(),
          deceasedAt: null
        };

        var result = Storage.saveProfile(profile);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          failures.push({ name: row.name || '(无姓名)', reason: result.error });
        }
      } catch (e) {
        failCount++;
        failures.push({ name: row.name || '(无姓名)', reason: e.message });
      }
    }

    _renderResult(successCount, failCount, failures);
  }

  /**
   * 渲染导入结果
   */
  function _renderResult(successCount, failCount, failures) {
    var previewEl = document.getElementById('import-preview');
    var resultEl = document.getElementById('import-result');

    previewEl.style.display = 'none';

    var html = '<div class="import-result-card">' +
      '<div class="import-result-icon">' + (failCount === 0 ? '✅' : '⚠️') + '</div>' +
      '<div class="import-result-title">导入完成</div>' +
      '<div class="import-result-summary">成功 <strong>' + successCount + '</strong> 条';

    if (failCount > 0) {
      html += '，失败 <strong>' + failCount + '</strong> 条';
    }
    html += '</div>';

    if (failCount > 0) {
      html += '<div class="import-failures">';
      for (var i = 0; i < failures.length; i++) {
        html += '<div class="import-failure-item">' +
          '<span class="import-failure-name">' + Utils.escapeHtml(failures[i].name) + '</span>' +
          '<span class="import-failure-reason">' + Utils.escapeHtml(failures[i].reason) + '</span>' +
        '</div>';
      }
      html += '</div>';
    }

    html += '<div class="import-actions">' +
      '<button class="btn btn-outline" id="btn-reset-import">重新导入</button>' +
      '<button class="btn btn-primary" id="btn-back-mgmt">返回管理页</button>' +
    '</div></div>';

    resultEl.innerHTML = html;
    resultEl.style.display = 'block';

    document.getElementById('btn-reset-import').addEventListener('click', function () {
      renderImport();
    });

    document.getElementById('btn-back-mgmt').addEventListener('click', function () {
      window.location.hash = 'management';
    });
  }

  return {
    renderImport: renderImport
  };
})();