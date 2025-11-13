/**
 * 渲染进程脚本
 * 处理用户界面交互和与主进程的通信
 */

// DOM元素引用
const elements = {
    dropZone: document.getElementById('dropZone'),
    addFilesBtn: document.getElementById('addFilesBtn'),
    addFoldersBtn: document.getElementById('addFoldersBtn'),
    clearQueueBtn: document.getElementById('clearQueueBtn'),
    startShreddingBtn: document.getElementById('startShreddingBtn'),
    fileListBody: document.getElementById('fileListBody'),
    emptyState: document.getElementById('emptyState'),
    progressSection: document.getElementById('progressSection'),
    overallProgressBar: document.getElementById('overallProgressBar'),
    progressText: document.getElementById('progressText'),
    currentFileText: document.getElementById('currentFileText'),
    logContainer: document.getElementById('logContainer'),
    logTypeSelect: document.getElementById('logTypeSelect'),
    logDateSelect: document.getElementById('logDateSelect'),
    refreshLogsBtn: document.getElementById('refreshLogsBtn'),
    confirmDialog: document.getElementById('confirmDialog'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmOk: document.getElementById('confirmOk')
};

// 应用程序状态
let shreddingQueue = [];
let shreddingInProgress = false;
// 移除异常退出相关变量
// let abnormalExitDetected = false;
// let recoveryInfo = null;

/**
 * 初始化应用程序
 */
async function initApp() {
    setupEventListeners();
    
    // 修复：从主进程获取最新的队列状态
    try {
        const queueResult = await window.electronAPI.getQueueStatus();
        if (queueResult.success) {
            shreddingQueue = queueResult.queue;
        }
    } catch (error) {
        console.error('获取队列状态失败:', error);
    }
    
    updateUI();
    
    // 初始化日志类型和日期选择器
    await handleLogTypeChange();
    
    // 移除异常退出检查
    // checkForAbnormalExit();
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 文件拖放事件
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    // 修复：只在dropZone内容区域点击时触发文件选择，避免与按钮点击事件冲突
    elements.dropZone.addEventListener('click', (e) => {
        // 如果点击的不是按钮本身，则触发文件选择
        if (e.target !== elements.addFilesBtn && !elements.addFilesBtn.contains(e.target) &&
            e.target !== elements.addFoldersBtn && !elements.addFoldersBtn.contains(e.target)) {
            elements.addFilesBtn.click();
        }
    });

    // 按钮点击事件
    elements.addFilesBtn.addEventListener('click', handleAddFiles);
    elements.addFoldersBtn.addEventListener('click', handleAddFolders);
    elements.clearQueueBtn.addEventListener('click', handleClearQueue);
    elements.startShreddingBtn.addEventListener('click', handleStartShredding);
    elements.refreshLogsBtn.addEventListener('click', loadLogs);
    elements.logTypeSelect.addEventListener('change', handleLogTypeChange);
    elements.logDateSelect.addEventListener('change', loadLogs);

    // 模态对话框事件
    elements.confirmCancel.addEventListener('click', closeConfirmDialog);
    elements.confirmOk.addEventListener('click', confirmAction);
    
    // 点击模态对话框外部关闭
    elements.confirmDialog.addEventListener('click', (e) => {
        if (e.target === elements.confirmDialog) {
            closeConfirmDialog();
        }
    });
    
    // 恢复对话框事件 - 移除异常退出相关事件
    // const recoverButton = document.getElementById('recoverButton');
    // const ignoreButton = document.getElementById('ignoreButton');
    // if (recoverButton) {
    //     recoverButton.addEventListener('click', recoverFromAbnormalExit);
    // }
    // if (ignoreButton) {
    //     ignoreButton.addEventListener('click', ignoreAbnormalExit);
    // }

    // 监听队列更新
    window.electronAPI.onQueueUpdated((_, queue) => {
        shreddingQueue = queue;
        updateFileList();
        updateProgress();
        updateButtonStates();
    });
    
    // 移除异常退出检测监听
    // window.electronAPI.onAbnormalExitDetected((_, recoveryInfo) => {
    //     handleAbnormalExitDetection(recoveryInfo);
    // });
}

/**
 * 处理拖拽悬停
 */
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
}

/**
 * 处理文件拖放
 */
async function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');

    const filePaths = Array.from(e.dataTransfer.files).map(file => file.path);
    if (filePaths.length > 0) {
        await addFilesToQueue(filePaths);
    }
}

/**
 * 处理添加文件按钮点击
 */
async function handleAddFiles() {
    try {
        // 检查当前状态
        if (shreddingInProgress) {
            showError('粉碎操作正在进行中，无法添加文件');
            return;
        }
        
        // 限制队列大小，防止内存问题
        if (shreddingQueue.length >= 1000) {
            showError('队列已满，最多支持1000个文件');
            return;
        }
        
        const result = await window.electronAPI.showFileDialog();
        if (result.success && result.filePaths.length > 0) {
            await addFilesToQueue(result.filePaths);
        }
    } catch (error) {
        showError('添加文件失败: ' + error.message);
        console.error('添加文件错误详情:', error);
    }
}

/**
 * 处理添加文件夹按钮点击
 */
async function handleAddFolders() {
    try {
        // 检查当前状态
        if (shreddingInProgress) {
            showError('粉碎操作正在进行中，无法添加文件夹');
            return;
        }
        
        // 限制队列大小，防止内存问题
        if (shreddingQueue.length >= 1000) {
            showError('队列已满，最多支持1000个文件');
            return;
        }
        
        const result = await window.electronAPI.showFolderDialog();
        if (result.success && result.filePaths.length > 0) {
            await addFilesToQueue(result.filePaths);
        }
    } catch (error) {
        showError('添加文件夹失败: ' + error.message);
        console.error('添加文件夹错误详情:', error);
    }
}

/**
 * 添加文件到队列
 */
async function addFilesToQueue(filePaths) {
    try {
        // 检查文件数量，防止批量添加过多文件
        if (filePaths.length > 100) {
            showError('一次最多只能添加100个文件');
            return;
        }
        
        const result = await window.electronAPI.addFilesToQueue(filePaths);
        if (result.success) {
            // 修复：从主进程获取最新的队列状态，而不是使用返回的队列
            const queueResult = await window.electronAPI.getQueueStatus();
            if (queueResult.success) {
                shreddingQueue = queueResult.queue;
                updateUI();
            }
            
            // 根据结果提供更详细的反馈
            const successCount = result.results ? result.results.filter(r => r.success).length : filePaths.length;
            const failCount = filePaths.length - successCount;
            
            if (failCount === 0) {
                showSuccess(`已添加 ${successCount} 个文件到队列`);
            } else {
                showWarning(`已添加 ${successCount} 个文件到队列，${failCount} 个文件添加失败`);
            }
        } else {
            showError('添加文件失败: ' + result.error);
        }
    } catch (error) {
        showError('添加文件失败: ' + error.message);
        console.error('添加文件到队列错误详情:', error);
    }
}

/**
 * 处理清空队列
 */
async function handleClearQueue() {
    if (shreddingQueue.length === 0) return;

    if (shreddingInProgress) {
        showError('粉碎操作正在进行中，无法清空队列');
        return;
    }

    showConfirmDialog('确定要清空文件列表吗？', async () => {
        try {
            const result = await window.electronAPI.clearQueue();
            if (result.success) {
                // 修复：从主进程获取最新的队列状态，而不是直接清空本地队列
                const queueResult = await window.electronAPI.getQueueStatus();
                if (queueResult.success) {
                    shreddingQueue = queueResult.queue;
                    updateUI();
                }
                showSuccess('文件列表已清空');
            } else {
                showError('清空列表失败: ' + result.error);
            }
        } catch (error) {
            showError('清空列表失败: ' + error.message);
        }
    });
}

/**
 * 处理开始粉碎
 */
async function handleStartShredding() {
    if (shreddingQueue.length === 0) {
        showError('没有文件需要粉碎');
        return;
    }

    if (shreddingInProgress) {
        showError('粉碎操作正在进行中');
        return;
    }
    
    // 检查队列中是否有有效文件
    const validFiles = shreddingQueue.filter(item => item.status !== 'failed');
    if (validFiles.length === 0) {
        showError('队列中没有有效的文件可以粉碎');
        return;
    }

    showConfirmDialog('确定要开始粉碎文件吗？此操作不可撤销！', async () => {
        try {
            // 设置超时，防止长时间无响应
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('操作超时')), 300000); // 5分钟超时
            });
            
            elements.progressSection.style.display = 'block';
            elements.startShreddingBtn.disabled = true;
            elements.clearQueueBtn.disabled = true;
            elements.addFilesBtn.disabled = true;
            elements.addFoldersBtn.disabled = true;

            // 使用Promise.race实现超时控制
            const result = await Promise.race([
                window.electronAPI.startShredding(),
                timeoutPromise
            ]);
            
            if (result.success) {
                showSuccess('文件粉碎完成');
                // 修复：从主进程获取最新的队列状态，而不是直接清空
                const queueResult = await window.electronAPI.getQueueStatus();
                if (queueResult.success) {
                    shreddingQueue = queueResult.queue;
                    updateUI();
                }
                
                // 自动刷新日志
                loadLogs();
            } else {
                showError('文件粉碎失败: ' + result.error);
            }
        } catch (error) {
            if (error.message === '操作超时') {
                showError('文件粉碎操作超时，请检查是否有大文件或系统问题');
            } else {
                showError('文件粉碎失败: ' + error.message);
            }
            console.error('文件粉碎错误详情:', error);
        } finally {
            elements.startShreddingBtn.disabled = false;
            elements.clearQueueBtn.disabled = false;
            elements.addFilesBtn.disabled = false;
            elements.addFoldersBtn.disabled = false;
        }
    });
}

/**
 * 更新UI状态
 */
function updateUI() {
    updateFileList();
    updateButtonStates();
}

/**
 * 检查异常退出
 */
// 移除异常退出相关函数
/**
 * 检查异常退出
 */
// async function checkForAbnormalExit() {
//     try {
//         const result = await window.electronAPI.checkAbnormalExit();
//         if (result.success && result.recoveryInfo.hasAbnormalExit) {
//             handleAbnormalExitDetection(result.recoveryInfo);
//         }
//     } catch (error) {
//         console.error('检查异常退出失败:', error);
//     }
// }

/**
 * 处理异常退出检测
 */
// function handleAbnormalExitDetection(recoveryInfo) {
//     abnormalExitDetected = true;
//     recoveryInfo = recoveryInfo;
//     
//     // 显示恢复对话框
//     showRecoveryDialog(recoveryInfo);
// }

/**
 * 显示恢复对话框
 */
// function showRecoveryDialog(recoveryInfo) {
//     const modal = document.getElementById('recoveryModal');
//     const recoveryMessage = document.getElementById('recoveryMessage');
//     
//     // 构建恢复信息
//     let message = '检测到上次程序异常退出。\n\n';
//     
//     if (recoveryInfo.wasShreddingInProgress) {
//         message += `上次有 ${recoveryInfo.pendingItems} 个文件正在粉碎过程中。\n`;
//         message += '是否恢复这些未完成的粉碎任务？\n\n';
//     } else {
//         message += '上次程序异常退出，但未发现未完成的粉碎任务。\n\n';
//     }
//     
//     message += '点击"恢复"按钮尝试恢复状态，或点击"忽略"按钮继续使用。';
//     
//     recoveryMessage.textContent = message;
//     modal.style.display = 'flex';
// }

/**
 * 恢复异常退出状态
 */
// async function recoverFromAbnormalExit() {
//     try {
//         const result = await window.electronAPI.recoverFromAbnormalExit();
//         
//         if (result.success) {
//             // 修复：从主进程获取最新的队列状态，而不是使用返回的队列
//             const queueResult = await window.electronAPI.getQueueStatus();
//             if (queueResult.success) {
//                 shreddingQueue = queueResult.queue;
//                 updateUI();
//             }
//             
//             // 更新粉碎状态
//             if (result.wasShreddingInProgress) {
//                 shreddingInProgress = false; // 重置状态，让用户重新开始
//                 updateUI();
//             }
//             
//             // 关闭对话框
//             document.getElementById('recoveryModal').style.display = 'none';
//             abnormalExitDetected = false;
//             
//             showSuccess('状态恢复成功');
//         } else {
//             showError('状态恢复失败: ' + result.error);
//         }
//     } catch (error) {
//         console.error('恢复异常退出状态失败:', error);
//         showError('恢复状态时发生错误');
//     }
// }

/**
 * 忽略异常退出
 */
// function ignoreAbnormalExit() {
//     document.getElementById('recoveryModal').style.display = 'none';
//     abnormalExitDetected = false;
// }

/**
 * 更新文件列表
 */
function updateFileList() {
    // 清空列表
    elements.fileListBody.innerHTML = '';

    if (shreddingQueue.length === 0) {
        elements.emptyState.style.display = 'block';
        return;
    }

    elements.emptyState.style.display = 'none';

    // 添加文件到列表
    shreddingQueue.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // 文件名
        const fileNameCell = document.createElement('td');
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = item.path.split('\\').pop() || item.path.split('/').pop() || '未知文件';
        fileNameCell.appendChild(fileName);
        row.appendChild(fileNameCell);

        // 路径
        const pathCell = document.createElement('td');
        const path = document.createElement('div');
        path.className = 'file-path';
        path.textContent = item.path;
        pathCell.appendChild(path);
        row.appendChild(pathCell);

        // 大小
        const sizeCell = document.createElement('td');
        sizeCell.className = 'file-size';
        sizeCell.textContent = formatFileSize(item.size);
        row.appendChild(sizeCell);

        // 状态
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge status-${item.status}`;
        statusBadge.textContent = getStatusText(item.status);
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // 进度
        const progressCell = document.createElement('td');
        progressCell.className = 'progress-cell';
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar-container';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = `${item.progress}%`;
        progressContainer.appendChild(progressBar);
        progressCell.appendChild(progressContainer);
        row.appendChild(progressCell);

        elements.fileListBody.appendChild(row);
    });
}

/**
 * 更新按钮状态
 */
function updateButtonStates() {
    const hasFiles = shreddingQueue.length > 0;
    elements.startShreddingBtn.disabled = !hasFiles || shreddingInProgress;
    elements.clearQueueBtn.disabled = !hasFiles || shreddingInProgress;
}

/**
 * 更新总体进度
 */
function updateProgress() {
    if (shreddingQueue.length === 0) {
        elements.progressSection.style.display = 'none';
        return;
    }

    const totalProgress = shreddingQueue.reduce((sum, item) => sum + item.progress, 0) / shreddingQueue.length;
    elements.overallProgressBar.style.width = `${totalProgress}%`;
    elements.progressText.textContent = `${Math.round(totalProgress)}%`;

    // 找到当前正在处理的文件
    const currentFile = shreddingQueue.find(item => item.status === 'processing');
    if (currentFile) {
        const fileName = currentFile.path.split('\\').pop() || currentFile.path.split('/').pop() || '未知文件';
        elements.currentFileText.textContent = `正在处理: ${fileName}`;
    } else {
        const completedCount = shreddingQueue.filter(item => item.status === 'completed').length;
        const failedCount = shreddingQueue.filter(item => item.status === 'failed').length;
        elements.currentFileText.textContent = `已完成: ${completedCount}, 失败: ${failedCount}`;
    }
}

/**
 * 加载日志
 */
async function loadLogs() {
    try {
        const logType = elements.logTypeSelect.value;
        const selectedDate = elements.logDateSelect.value;
        
        let result;
        
        // 根据日志类型和日期加载日志
        if (logType === 'shredding' && selectedDate) {
            // 加载指定日期的文件粉碎日志
            result = await window.electronAPI.getLogsByDate(logType, selectedDate);
        } else {
            // 加载当前日志（应用程序日志或当天的文件粉碎日志）
            result = await window.electronAPI.getLogs(logType);
        }
        
        if (result.success) {
            // 清空日志容器
            elements.logContainer.innerHTML = '';
            
            if (!result.logs || result.logs.trim() === '') {
                elements.logContainer.innerHTML = '<div class="log-empty">暂无日志记录</div>';
                return;
            }
            
            // 处理日志内容
            const logLines = result.logs.split('\n').filter(line => line.trim() !== '');
            
            // 如果是应用程序日志，使用简单文本显示
            if (logType === 'app') {
                logLines.forEach(line => {
                    const logEntry = document.createElement('div');
                    logEntry.className = 'log-entry';
                    
                    // 根据日志级别设置样式
                    if (line.includes('[ERROR]')) {
                        logEntry.classList.add('log-error');
                    } else if (line.includes('[WARN]')) {
                        logEntry.classList.add('log-warn');
                    } else {
                        logEntry.classList.add('log-info');
                    }
                    
                    logEntry.textContent = line;
                    elements.logContainer.appendChild(logEntry);
                });
            } 
            // 如果是文件粉碎日志，使用卡片式显示
            else if (logType === 'shredding') {
                // 解析日志条目
                const logEntries = parseShreddingLogs(logLines);
                
                if (logEntries.length === 0) {
                    elements.logContainer.innerHTML = '<div class="log-empty">暂无文件粉碎记录</div>';
                    return;
                }
                
                // 创建日志卡片
                logEntries.forEach(entry => {
                    const logCard = createLogCard(entry);
                    elements.logContainer.appendChild(logCard);
                });
            }
        } else {
            elements.logContainer.innerHTML = `<div class="log-error">加载日志失败: ${result.error}</div>`;
        }
    } catch (error) {
        elements.logContainer.innerHTML = `<div class="log-error">加载日志失败: ${error.message}</div>`;
    }
}

/**
 * 解析文件粉碎日志
 * @param {Array} logLines - 日志行数组
 * @returns {Array} - 解析后的日志条目数组
 */
function parseShreddingLogs(logLines) {
    const entries = [];
    
    // 跳过注释行
    const filteredLines = logLines.filter(line => !line.startsWith('#'));
    
    // 每个条目由多行组成
    let currentEntry = null;
    
    for (const line of filteredLines) {
        if (line.startsWith('时间: ')) {
            // 新条目开始
            if (currentEntry) {
                entries.push(currentEntry);
            }
            
            currentEntry = {
                timestamp: line.substring(4).trim(),
                path: '',
                size: '',
                result: '',
                failureReason: '',
                startTime: '',
                endTime: ''
            };
        } else if (currentEntry) {
            // 解析条目内容
            if (line.startsWith('路径: ')) {
                currentEntry.path = line.substring(4).trim();
            } else if (line.startsWith('大小: ')) {
                currentEntry.size = line.substring(4).trim();
            } else if (line.startsWith('结果: ')) {
                currentEntry.result = line.substring(4).trim();
                // 修改成功状态的显示文本
                if (currentEntry.result === '成功') {
                    currentEntry.result = '粉碎成功';
                }
            } else if (line.startsWith('失败原因: ')) {
                currentEntry.failureReason = line.substring(6).trim();
            } else if (line.startsWith('开始时间: ')) {
                currentEntry.startTime = line.substring(6).trim();
            } else if (line.startsWith('结束时间: ')) {
                currentEntry.endTime = line.substring(6).trim();
            }
        }
    }
    
    // 添加最后一个条目
    if (currentEntry) {
        entries.push(currentEntry);
    }
    
    return entries;
}

/**
 * 创建日志卡片
 * @param {Object} entry - 日志条目
 * @returns {HTMLElement} - 日志卡片元素
 */
function createLogCard(entry) {
    const card = document.createElement('div');
    card.className = `log-card ${entry.result === '粉碎成功' ? 'log-success' : 'log-failure'}`;
    
    // 卡片头部
    const header = document.createElement('div');
    header.className = 'log-card-header';
    
    const statusIcon = document.createElement('span');
    statusIcon.className = `log-status-icon ${entry.result === '粉碎成功' ? 'icon-success' : 'icon-failure'}`;
    statusIcon.textContent = entry.result === '粉碎成功' ? '✓' : '✗';
    
    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = entry.timestamp;
    
    header.appendChild(statusIcon);
    header.appendChild(timestamp);
    
    // 卡片内容
    const content = document.createElement('div');
    content.className = 'log-card-content';
    
    // 文件路径
    const pathRow = document.createElement('div');
    pathRow.className = 'log-row';
    
    const pathLabel = document.createElement('span');
    pathLabel.className = 'log-label';
    pathLabel.textContent = '文件路径: ';
    
    const pathValue = document.createElement('span');
    pathValue.className = 'log-value log-path';
    pathValue.textContent = entry.path;
    pathValue.title = entry.path; // 添加完整路径作为提示
    
    pathRow.appendChild(pathLabel);
    pathRow.appendChild(pathValue);
    
    // 文件大小
    const sizeRow = document.createElement('div');
    sizeRow.className = 'log-row';
    
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'log-label';
    sizeLabel.textContent = '文件大小: ';
    
    const sizeValue = document.createElement('span');
    sizeValue.className = 'log-value';
    sizeValue.textContent = entry.size;
    
    sizeRow.appendChild(sizeLabel);
    sizeRow.appendChild(sizeValue);
    
    // 处理时间
    const timeRow = document.createElement('div');
    timeRow.className = 'log-row';
    
    const timeLabel = document.createElement('span');
    timeLabel.className = 'log-label';
    timeLabel.textContent = '处理时间: ';
    
    const timeValue = document.createElement('span');
    timeValue.className = 'log-value';
    
    // 计算处理时长
    if (entry.startTime && entry.endTime) {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        const duration = end - start;
        
        if (duration < 1000) {
            timeValue.textContent = `${duration} 毫秒`;
        } else {
            timeValue.textContent = `${(duration / 1000).toFixed(2)} 秒`;
        }
    } else {
        timeValue.textContent = '未知';
    }
    
    timeRow.appendChild(timeLabel);
    timeRow.appendChild(timeValue);
    content.appendChild(timeRow);
    
    // 处理结果
    const resultRow = document.createElement('div');
    resultRow.className = 'log-row';
    
    const resultLabel = document.createElement('span');
    resultLabel.className = 'log-label';
    resultLabel.textContent = '处理结果: ';
    
    const resultValue = document.createElement('span');
    resultValue.className = `log-value ${entry.result === '粉碎成功' ? 'log-success-text' : 'log-failure-text'}`;
    resultValue.textContent = entry.result;
    
    resultRow.appendChild(resultLabel);
    resultRow.appendChild(resultValue);
    content.appendChild(resultRow);
    
    // 失败原因（如果有）
    if (entry.failureReason) {
        const failureRow = document.createElement('div');
        failureRow.className = 'log-row';
        
        const failureLabel = document.createElement('span');
        failureLabel.className = 'log-label';
        failureLabel.textContent = '失败原因: ';
        
        const failureValue = document.createElement('span');
        failureValue.className = 'log-value log-failure-reason';
        failureValue.textContent = entry.failureReason;
        
        failureRow.appendChild(failureLabel);
        failureRow.appendChild(failureValue);
        content.appendChild(failureRow);
    }
    
    content.appendChild(pathRow);
    content.appendChild(sizeRow);
    content.appendChild(timeRow);
    
    // 组装卡片
    card.appendChild(header);
    card.appendChild(content);
    
    return card;
}

/**
 * 显示确认对话框
 */
function showConfirmDialog(message, onConfirm) {
    elements.confirmMessage.textContent = message;
    elements.confirmDialog.style.display = 'flex';
    
    // 保存确认回调
    window.currentConfirmAction = onConfirm;
}

/**
 * 关闭确认对话框
 */
function closeConfirmDialog() {
    elements.confirmDialog.style.display = 'none';
    window.currentConfirmAction = null;
}

/**
 * 确认操作
 */
function confirmAction() {
    if (window.currentConfirmAction) {
        window.currentConfirmAction();
    }
    closeConfirmDialog();
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
    switch (status) {
        case 'pending': return '等待中';
        case 'processing': return '粉碎中';
        case 'completed': return '已完成';
        case 'failed': return '失败';
        default: return '未知';
    }
}

/**
 * 显示成功消息
 */
function showSuccess(message) {
    showNotification(message, 'success');
}

/**
 * 显示警告消息
 */
function showWarning(message) {
    showNotification(message, 'warning');
}

/**
 * 显示错误消息
 */
function showError(message) {
    showNotification(message, 'error');
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '4px',
        color: 'white',
        fontWeight: '500',
        zIndex: '1000',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'opacity 0.3s, transform 0.3s',
        maxWidth: '400px',
        wordWrap: 'break-word'
    });
    
    // 设置背景色
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'warning':
            notification.style.backgroundColor = '#FF9800';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // 自动隐藏
    const hideDelay = type === 'error' ? 8000 : 5000; // 错误消息显示更长时间
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, hideDelay);
}

// 初始化应用程序
document.addEventListener('DOMContentLoaded', initApp);

/**
 * 处理日志类型变化
 */
async function handleLogTypeChange() {
    const logType = elements.logTypeSelect.value;
    
    // 根据日志类型显示或隐藏日期选择器
    if (logType === 'shredding') {
        elements.logDateSelect.style.display = 'block';
        await loadAvailableLogDates();
    } else {
        elements.logDateSelect.style.display = 'none';
    }
    
    // 加载日志
    loadLogs();
}

/**
 * 加载可用的日志日期
 */
async function loadAvailableLogDates() {
    try {
        const result = await window.electronAPI.getAvailableLogDates();
        
        if (result.success) {
            // 清空现有选项
            elements.logDateSelect.innerHTML = '<option value="">选择日期</option>';
            
            // 添加日期选项
            result.dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = date;
                elements.logDateSelect.appendChild(option);
            });
            
            // 默认选择最新日期
            if (result.dates.length > 0) {
                elements.logDateSelect.value = result.dates[0];
            }
        } else {
            console.error('加载可用日志日期失败:', result.error);
        }
    } catch (error) {
        console.error('加载可用日志日期失败:', error);
    }
}