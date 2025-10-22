/**
 * 头像选择器模块
 * 负责头像选择模态框的功能实现
 */
class AvatarSelector {
  constructor() {
    this.modal = null;
    this.currentAvatarDisplay = null;
    this.avatarGrid = null;
    this.selectedAvatar = null;
    this.avatarOptions = [];
    this.storageKey = 'sooon-avatar-data';
    this.isFirstOpen = true; // 标记是否为初次打开
    this.currentContext = 'opponent'; // 当前头像上下文：'player' 或 'opponent'
    
    this.init();
  }

  /**
   * 初始化头像选择器
   */
  init() {
    // 延迟初始化，确保DOM元素已加载
    setTimeout(() => {
      this.modal = document.getElementById('avatar-modal');
      this.currentAvatarDisplay = document.getElementById('current-avatar-display');
      this.avatarGrid = document.getElementById('avatar-grid');
      
      if (!this.modal || !this.currentAvatarDisplay || !this.avatarGrid) {
        console.error('头像选择器初始化失败：缺少必要的DOM元素');
        return;
      }

      this.setupEventListeners();
      this.loadSavedAvatar();
      console.log('头像选择器初始化成功');
    }, 100);
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 模态框关闭按钮
    const closeBtn = document.getElementById('avatar-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // 取消按钮
    const cancelBtn = document.getElementById('cancel-avatar');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeModal());
    }

    // 保存按钮
    const saveBtn = document.getElementById('save-avatar');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveAvatar());
    }

    // 清空选择按钮
    const clearBtn = document.getElementById('clear-avatar');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearSelection());
    }

    // 重新生成按钮
    const regenerateBtn = document.getElementById('regenerate-avatars');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => this.regenerateAvatars());
    }

    // 导出按钮
    const exportBtn = document.getElementById('export-avatar');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAvatar());
    }

    // 导入按钮
    const importBtn = document.getElementById('import-avatar');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importAvatar());
    }

    // 文件输入
    const fileInput = document.getElementById('avatar-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileImport(e));
    }

    // 点击模态框背景关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  /**
   * 打开头像选择模态框
   * @param {string} context - 头像上下文：'player' 或 'opponent'
   */
  openModal(context = 'opponent') {
    if (!this.modal) return;
    
    // 设置当前上下文
    this.currentContext = context;
    
    // 更新模态框标题
    const modalTitle = this.modal.querySelector('h3');
    if (modalTitle) {
      modalTitle.textContent = context === 'player' ? '修改用户头像' : '修改AI头像';
    }
    
    this.loadCurrentAvatar();
    
    // 只在初次打开时生成随机头像
    if (this.isFirstOpen) {
      this.generateAvatarOptions();
      this.isFirstOpen = false; // 标记已不是初次打开
    }
    
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * 关闭头像选择模态框
   */
  closeModal() {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  /**
   * 加载当前头像到显示区域
   */
  loadCurrentAvatar() {
    if (!this.currentAvatarDisplay) return;

    let currentAvatar;
    if (this.currentContext === 'player') {
      // 获取用户头像
      currentAvatar = document.querySelector('.player-info .avatar');
    } else {
      // 获取AI头像
      currentAvatar = document.querySelector('.opponent-avatar');
    }
    
    if (currentAvatar) {
      this.currentAvatarDisplay.innerHTML = currentAvatar.innerHTML;
    } else {
      this.currentAvatarDisplay.innerHTML = '<div style="color: #666;">暂无头像</div>';
    }
  }

  /**
   * 生成4x4头像选项
   */
  async generateAvatarOptions() {
    if (!this.avatarGrid) return;

    this.avatarGrid.innerHTML = '';
    this.avatarOptions = [];

    // 生成16个随机头像
    for (let i = 0; i < 16; i++) {
      try {
        const avatarData = await this.generateRandomAvatar();
        this.avatarOptions.push(avatarData);
        
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        avatarOption.dataset.index = i;
        
        // 设置头像内容，确保 SVG 正确渲染
        const svgElement = this.createAvatarElement(avatarData.svg);
        avatarOption.appendChild(svgElement);
        
        // 添加点击事件
        avatarOption.addEventListener('click', () => this.selectAvatar(i));
        
        this.avatarGrid.appendChild(avatarOption);
      } catch (error) {
        console.error('生成头像选项失败:', error);
        // 添加占位符
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        avatarOption.innerHTML = '<div style="color: #999;">?</div>';
        this.avatarGrid.appendChild(avatarOption);
      }
    }
  }

  /**
   * 生成随机头像
   */
  async generateRandomAvatar() {
    if (!window.avatarGenerator) {
      throw new Error('头像生成器未加载');
    }

    // 确保传递正确的参数，包括随机种子
    return await window.avatarGenerator.generateRandomAvatar({
      seed: 'selector-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
    });
  }

  /**
   * 创建头像元素
   */
  createAvatarElement(svgString) {
    // 创建一个容器来包装 SVG
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    
    // 创建 img 元素来显示 SVG
    const img = document.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';  // 改为 cover 确保背景颜色完整显示
    img.style.borderRadius = '50%';
    
    // 清理 SVG 数据并设置 src
    const cleanSvg = svgString.replace(/\s+/g, ' ').trim();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
    img.alt = '头像';
    
    container.appendChild(img);
    return container;
  }

  /**
   * 选择头像
   */
  selectAvatar(index) {
    // 清除之前的选择
    const previousSelected = this.avatarGrid.querySelector('.avatar-option.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // 标记当前选择
    const selectedOption = this.avatarGrid.querySelector(`[data-index="${index}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
      this.selectedAvatar = this.avatarOptions[index];
    }
  }

  /**
   * 清空选择
   */
  clearSelection() {
    const selectedOption = this.avatarGrid.querySelector('.avatar-option.selected');
    if (selectedOption) {
      selectedOption.classList.remove('selected');
    }
    this.selectedAvatar = null;
  }

  /**
   * 重新生成头像选项
   */
  async regenerateAvatars() {
    await this.generateAvatarOptions();
  }

  /**
   * 保存头像
   */
  saveAvatar() {
    if (!this.selectedAvatar) {
      alert('请先选择一个头像');
      return;
    }

    // 更新游戏中的头像
    this.updateGameAvatar(this.selectedAvatar);
    
    // 保存到本地存储
    this.saveToLocalStorage(this.selectedAvatar);
    
    // 更新设置面板中的头像预览（如果存在）
    this.updateSettingsPreviews();
    
    // 关闭模态框
    this.closeModal();
    
    console.log('头像已保存:', this.selectedAvatar);
  }

  /**
   * 更新游戏中的头像
   */
  updateGameAvatar(avatarData) {
    if (this.currentContext === 'player') {
      // 更新用户头像
      const playerAvatar = document.querySelector('.player-info .avatar');
      if (playerAvatar && avatarData.svg) {
        playerAvatar.innerHTML = avatarData.svg;
      }
      
      // 更新游戏状态管理器中的用户头像（如果需要的话）
      if (window.gameStateManager) {
        // 这里可以添加用户头像的状态管理
        console.log('用户头像已更新:', avatarData);
      }
    } else {
      // 更新AI头像
      const opponentAvatar = document.querySelector('.opponent-avatar');
      if (opponentAvatar && avatarData.svg) {
        opponentAvatar.innerHTML = avatarData.svg;
      }

      // 更新游戏状态管理器中的头像
      if (window.gameStateManager) {
        window.gameStateManager.configureOpponent({
          avatar: avatarData.svg,
          ai: { accuracy: 0, speedMsRange: [1280, 2900] }
        });
      }
    }
  }

  /**
   * 保存到本地存储
   */
  saveToLocalStorage(avatarData) {
    try {
      const avatarDataToSave = {
        svg: avatarData.svg,
        style: avatarData.style,
        seed: avatarData.seed,
        timestamp: Date.now(),
        context: this.currentContext
      };
      
      // 根据上下文使用不同的存储键
      const storageKey = this.currentContext === 'player' 
        ? 'sooon-player-avatar-data' 
        : 'sooon-avatar-data';
      
      localStorage.setItem(storageKey, JSON.stringify(avatarDataToSave));
      console.log('头像已保存到本地存储:', this.currentContext);
    } catch (error) {
      console.error('保存头像到本地存储失败:', error);
    }
  }

  /**
   * 从本地存储加载头像
   */
  loadSavedAvatar() {
    try {
      // 根据上下文使用不同的存储键
      const storageKey = this.currentContext === 'player' 
        ? 'sooon-player-avatar-data' 
        : 'sooon-avatar-data';
        
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const avatarData = JSON.parse(savedData);
        console.log('从本地存储加载头像:', avatarData, '上下文:', this.currentContext);
        return avatarData;
      }
    } catch (error) {
      console.error('从本地存储加载头像失败:', error);
    }
    return null;
  }

  /**
   * 获取当前游戏中正在使用的头像
   */
  getCurrentGameAvatar() {
    try {
      if (this.currentContext === 'player') {
        // 获取用户头像
        const playerAvatar = document.querySelector('.player-info .avatar');
        if (playerAvatar && playerAvatar.innerHTML) {
          return {
            svg: playerAvatar.innerHTML,
            style: 'current',
            seed: 'current-' + Date.now(),
            timestamp: Date.now(),
            isCurrent: true
          };
        }
      } else {
        // 从游戏状态管理器获取AI头像
        if (window.gameStateManager) {
          const opponentState = window.gameStateManager.getState('opponent');
          if (opponentState && opponentState.avatar) {
            // 如果头像是SVG格式，构造完整的头像数据对象
            if (typeof opponentState.avatar === 'string' && opponentState.avatar.includes('<svg')) {
              return {
                svg: opponentState.avatar,
                style: 'current',
                seed: 'current-' + Date.now(),
                timestamp: Date.now(),
                isCurrent: true
              };
            }
            // 如果是其他格式，也构造数据对象
            return {
              svg: opponentState.avatar,
              style: 'current',
              seed: 'current-' + Date.now(),
              timestamp: Date.now(),
              isCurrent: true
            };
          }
        }
      }
    } catch (error) {
      console.error('获取当前游戏头像失败:', error);
    }
    return null;
  }

  /**
   * 更新设置面板中的头像预览
   */
  updateSettingsPreviews() {
    try {
      // 检查是否存在全局的更新函数
      if (typeof window.updateAvatarPreviews === 'function') {
        window.updateAvatarPreviews();
      }
    } catch (error) {
      console.error('更新设置面板头像预览失败:', error);
    }
  }

  /**
   * 导出头像
   */
  exportAvatar() {
    // 优先获取当前正在使用的头像
    let currentAvatar = this.getCurrentGameAvatar();
    
    // 如果当前游戏中没有头像，则尝试从本地存储加载
    if (!currentAvatar) {
      currentAvatar = this.loadSavedAvatar();
    }
    
    if (!currentAvatar) {
      alert('没有可导出的头像数据');
      return;
    }

    try {
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        avatar: currentAvatar,
        source: currentAvatar === this.getCurrentGameAvatar() ? 'current' : 'saved'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `sooon-avatar-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('头像已导出:', exportData.source === 'current' ? '当前头像' : '保存的头像');
    } catch (error) {
      console.error('导出头像失败:', error);
      alert('导出头像失败');
    }
  }

  /**
   * 导入头像
   */
  importAvatar() {
    const fileInput = document.getElementById('avatar-file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * 处理文件导入
   */
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        if (importData.avatar && importData.avatar.svg) {
          // 立即更新游戏中的头像
          this.updateGameAvatar(importData.avatar);
          
          // 保存到本地存储
          this.saveToLocalStorage(importData.avatar);
          
          // 更新当前头像显示区域
          this.loadCurrentAvatar();
          
          // 显示成功消息，包含来源信息
          const sourceInfo = importData.source ? ` (来源: ${importData.source === 'current' ? '当前头像' : '保存的头像'})` : '';
          alert(`头像导入成功${sourceInfo}`);
          console.log('头像已导入:', importData.avatar);
        } else {
          throw new Error('无效的头像数据格式');
        }
      } catch (error) {
        console.error('导入头像失败:', error);
        alert('导入头像失败：文件格式不正确');
      }
    };
    
    reader.readAsText(file);
    
    // 清空文件输入
    event.target.value = '';
  }
}

// 创建全局实例
window.avatarSelector = new AvatarSelector();
