/**
 * UI控制器
 * 
 * 功能说明：
 * - 连接状态管理器和DOM操作，实现状态驱动的UI更新
 * - 处理所有用户交互事件（点击、键盘等）
 * - 管理动画效果和视觉反馈
 * - 实现响应式布局和缩放
 * 
 * 设计模式：
 * - 采用观察者模式订阅状态变化
 * - 使用事件委托处理用户交互
 * - 实现命令模式封装UI操作
 * 
 * @class UIController
 * @param {GameStateManager} stateManager - 状态管理器实例
 */
class UIController {
  /**
   * 构造函数
   * 初始化UI控制器，设置DOM元素引用、事件监听器和状态订阅
   * 
   * @param {GameStateManager} stateManager - 状态管理器实例
   */
  constructor(stateManager) {
    /** @type {GameStateManager} 状态管理器实例 */
    this.stateManager = stateManager;
    
    /** @type {AnimationManager} 动画管理器实例 */
    this.animationManager = null;
    
    /** @type {Object} DOM元素引用集合 */
    this.elements = this.initializeElements();
    
    // 设置事件监听器
    this.setupEventListeners();
    
    // 订阅状态变化
    this.subscribeToStateChanges();
    
    // 延迟初始化动画管理器
    this.initializeAnimationManager();
  }
  
  /**
   * 初始化动画管理器
   * 延迟初始化，确保AnimationManager类已加载
   */
  initializeAnimationManager() {
    // 检查AnimationManager是否已定义
    if (typeof AnimationManager !== 'undefined') {
      this.animationManager = new AnimationManager();
      console.log('动画管理器初始化成功');
    } else {
      // 如果AnimationManager未定义，延迟重试
      setTimeout(() => {
        this.initializeAnimationManager();
      }, 100);
    }
  }
  
  /**
   * 初始化DOM元素引用
   * 
   * 功能说明：
   * - 获取页面中所有需要操作的DOM元素
   * - 使用CSS选择器定位元素
   * - 验证关键元素是否存在
   * - 提供统一的元素访问接口
   * 
   * @returns {Object} DOM元素引用对象
   * 
   * @example
   * // 元素对象结构
   * {
   *   playerScore: HTMLElement,      // 玩家分数显示
   *   opponentScore: HTMLElement,    // 对手分数显示
   *   timerElement: HTMLElement,     // 计时器数字
   *   questionText: HTMLElement,     // 题目文本
   *   options: NodeList,             // 选项按钮列表
   *   // ... 更多元素
   * }
   */
  initializeElements() {
    const elements = {
      // ==================== 分数相关元素 ====================
      /** @type {HTMLElement} 玩家分数显示元素 */
      playerScore: document.querySelector('.player-score'),
      /** @type {HTMLElement} 对手分数显示元素 */
      opponentScore: document.querySelector('.opponent-score .score-number'),
      /** @type {HTMLElement} 对手头像显示元素 */
      opponentAvatar: document.querySelector('.opponent-avatar'),
      
      // ==================== 计时器相关元素 ====================
      /** @type {HTMLElement} 计时器数字显示元素 */
      timerElement: document.querySelector('.timer-circle span'),
      /** @type {HTMLElement} 计时器圆环容器 */
      timerCircle: document.querySelector('.timer-circle'),
      /** @type {HTMLElement} 计时器进度圆环 */
      timerProgress: document.querySelector('.timer-progress'),
      
      // ==================== 题目相关元素 ====================
      /** @type {HTMLElement} 题目文本显示元素 */
      questionText: document.querySelector('.question-text'),
      /** @type {HTMLElement} 选项容器元素 */
      optionsContainer: document.querySelector('.options-container'),
      /** @type {NodeList} 选项按钮列表 */
      options: document.querySelectorAll('.option'),
      
      // ==================== 进度条相关元素 ====================
      /** @type {HTMLElement} 左侧进度条填充 */
      leftProgressFill: document.getElementById('left-progress-fill'),
      /** @type {HTMLElement} 右侧进度条填充 */
      rightProgressFill: document.getElementById('right-progress-fill'),
      
      // ==================== 动画容器元素 ====================
      /** @type {HTMLElement} 加分动画容器 */
      scoreAnimationContainer: document.getElementById('score-animation-container'),
      /** @type {HTMLElement} 轮次提示文本元素 */
      rankText: document.getElementById('rank-text'),
      
      // ==================== 对手结果元素 ====================
      /** @type {NodeList} 对手结果图标列表 */
      opponentResults: document.querySelectorAll('.opponent-result')
    };
    
    // 验证关键元素是否存在，便于调试
    console.log('DOM元素初始化:', {
      playerScore: !!elements.playerScore,
      opponentScore: !!elements.opponentScore,
      timerElement: !!elements.timerElement,
      questionText: !!elements.questionText,
      options: elements.options.length,
      rankText: !!elements.rankText
    });
    
    return elements;
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 使用事件委托来处理选项点击
    const optionsContainer = document.querySelector('.options-container');
    if (optionsContainer) {
      // 处理点击事件
      optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.option');
        if (option) {
          const uiOptionIndex = parseInt(option.dataset.option); // 1-4
          const arrayOptionIndex = uiOptionIndex - 1; // 转换为0-3
          console.log('选项被点击:', uiOptionIndex, '(数组索引:', arrayOptionIndex, ')');
          if (uiOptionIndex && this.stateManager) {
            this.stateManager.selectAnswer(arrayOptionIndex);
          }
        }
      });
      
      // 处理触摸事件，改善移动端体验
      optionsContainer.addEventListener('touchstart', (e) => {
        const option = e.target.closest('.option');
        if (option) {
          // 添加触摸反馈类
          option.classList.add('touch-active');
        }
      }, { passive: true });
      
      optionsContainer.addEventListener('touchend', (e) => {
        const option = e.target.closest('.option');
        if (option) {
          // 延迟移除触摸反馈类，确保用户能看到反馈
          setTimeout(() => {
            option.classList.remove('touch-active');
          }, 150);
        }
      }, { passive: true });
      
      // 处理触摸取消事件
      optionsContainer.addEventListener('touchcancel', (e) => {
        const option = e.target.closest('.option');
        if (option) {
          option.classList.remove('touch-active');
        }
      }, { passive: true });
      
      console.log('选项事件监听器设置完成（事件委托）');
    }
    
    // 控制按钮事件
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('点击了控制按钮:', e.target.textContent);
      });
    });
    
    // 响应式缩放与文本自适应：在缩放更新后，下一帧再执行文本适配，避免尺寸尚未稳定
    const onWindowResized = () => {
      this.updateScale();
      // 在下一帧执行，确保 CSS 变量与布局已生效
      requestAnimationFrame(() => {
        this.refitAllOptionTexts();
      });
    };
    // 加去抖，减少频繁重排
    this._onWindowResizedDebounced = this.debounce(onWindowResized, 100);
    window.addEventListener('resize', this._onWindowResizedDebounced);
    window.addEventListener('orientationchange', this._onWindowResizedDebounced);
    
    // 初始化缩放
    this.updateScale();
    // 首次加载时，对当前文本执行一次适配
    requestAnimationFrame(() => this.refitAllOptionTexts());
    
    // 初始化按钮状态
    this.initializeButtonStates();
  }

  /**
   * 简单去抖函数
   * @param {Function} fn
   * @param {number} wait
   */
  debounce(fn, wait = 100) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  
  /**
   * 订阅状态变化
   */
  subscribeToStateChanges() {
    // 订阅所有状态变化
    this.stateManager.subscribe('*', (newState, oldState, changes) => {
      this.handleStateChange(newState, oldState, changes);
    });
    
    // 订阅特定状态变化
    this.stateManager.subscribe('playerScore', (newScore, oldScore) => {
      this.updatePlayerScore(newScore);
    });
    
    this.stateManager.subscribe('opponentScore', (newScore, oldScore) => {
      this.updateOpponentScore(newScore);
    });
    
    // 订阅对手配置变化（头像、AI参数）
    this.stateManager.subscribe('opponent', (newOpponent, oldOpponent) => {
      if (newOpponent?.avatar !== oldOpponent?.avatar) {
        this.updateOpponentAvatar(newOpponent?.avatar);
      }
    });
    
    this.stateManager.subscribe('timeLeft', (newTime, oldTime) => {
      // console.log(`UI收到倒计时变化: ${oldTime} -> ${newTime}`);
      this.updateTimer(newTime);
    });
    
    this.stateManager.subscribe('currentRound', (newRound, oldRound) => {
      if (newRound !== oldRound) {
        // 新题目开始时，确保计时器正确显示
        console.log(`轮次变化: ${oldRound} -> ${newRound}`);
        setTimeout(() => {
          const timeLeft = this.stateManager.getState('timeLeft');
          if (timeLeft !== undefined && timeLeft !== null) {
            console.log(`轮次变化后更新计时器: ${timeLeft}`);
            this.updateTimer(timeLeft);
          }
        }, 125);
      }
    });
    
    this.stateManager.subscribe('currentQuestion', (newQuestion, oldQuestion) => {
      if (newQuestion !== oldQuestion) {
        this.updateQuestion(newQuestion);
      }
    });
    
    this.stateManager.subscribe('questionOptions', (newOptions, oldOptions) => {
      if (newOptions !== oldOptions) {
        this.updateOptions(newOptions);
      }
    });
    
    this.stateManager.subscribe('buttonStates', (newButtonStates, oldButtonStates) => {
      if (newButtonStates !== oldButtonStates && newButtonStates.initialized) {
        this.updateButtonStates(newButtonStates);
      }
    });
    
    this.stateManager.subscribe('playerSelection', (newSelection, oldSelection) => {
      if (newSelection !== oldSelection) {
        this.updatePlayerSelection(newSelection, oldSelection);
      }
    });
    
    this.stateManager.subscribe('opponentSelection', (newSelection, oldSelection) => {
      if (newSelection !== oldSelection) {
        this.updateOpponentSelection(newSelection, oldSelection);
      }
    });
    
    this.stateManager.subscribe('animations', (newAnimations, oldAnimations) => {
      this.handleAnimations(newAnimations, oldAnimations);
    });
  }
  
  /**
   * 处理状态变化
   */
  handleStateChange(newState, oldState, changes) {
    // 更新进度条
    this.updateProgressBars(newState.playerScore, newState.opponentScore, newState.maxScore);
    
    // 处理游戏阶段变化
    if (changes.gamePhase) {
      this.handleGamePhaseChange(newState.gamePhase, oldState.gamePhase);
    }
  }
  
  /**
   * 处理游戏阶段变化
   */
  handleGamePhaseChange(newPhase, oldPhase) {
    console.log(`游戏阶段变化: ${oldPhase} -> ${newPhase}`);
    
    switch (newPhase) {
      case 'ready':
        this.resetUI();
        break;
      case 'question':
        this.showQuestion();
        break;
      case 'waiting':
        this.showWaiting();
        break;
      case 'result':
        this.showResult();
        // 阶段切换为结果时，如对手已有选择则显示其图标
        try {
          const opponentSelection = this.stateManager.getState('opponentSelection');
          if (opponentSelection !== null) {
            const uiOptionIndex = opponentSelection + 1;
            const opponentResult = document.querySelector(`.opponent-result[data-option="${uiOptionIndex}"]`);
            if (opponentResult && opponentResult.children.length === 0) {
              const isCorrect = this.stateManager.getState('opponentCorrect');
              this.showOpponentResult(opponentResult, isCorrect);
            }
          }
        } catch (e) {
          console.warn('结果阶段显示对手选择图标时发生异常:', e);
        }
        break;
      case 'ended':
        this.showGameEnd();
        // 游戏结束时确保显示对手图标（若尚未显示）
        try {
          const opponentSelection = this.stateManager.getState('opponentSelection');
          if (opponentSelection !== null) {
            const uiOptionIndex = opponentSelection + 1;
            const opponentResult = document.querySelector(`.opponent-result[data-option="${uiOptionIndex}"]`);
            if (opponentResult && opponentResult.children.length === 0) {
              const isCorrect = this.stateManager.getState('opponentCorrect');
              this.showOpponentResult(opponentResult, isCorrect);
            }
          }
        } catch (e) {
          console.warn('结束阶段显示对手选择图标时发生异常:', e);
        }
        break;
    }
  }
  
  /**
   * 更新玩家分数
   */
  updatePlayerScore(score) {
    // 直接更新分数，不使用动画
    if (this.elements.playerScore) {
      this.elements.playerScore.textContent = score;
    }
  }
  
  /**
   * 更新对手分数
   */
  updateOpponentScore(score) {
    // 直接更新分数，不使用动画
    if (this.elements.opponentScore) {
      this.elements.opponentScore.textContent = score;
    }
  }

  /**
   * 更新对手头像
   */
  updateOpponentAvatar(avatar) {
    const el = this.elements.opponentAvatar;
    if (!el) return;
    
    // 检查是否是SVG内容
    if (typeof avatar === 'string' && avatar.includes('<svg')) {
      // 如果是SVG内容，直接设置innerHTML
      el.innerHTML = avatar;
      el.style.backgroundImage = '';
      el.classList.remove('image');
    }
    // 简单支持：若是URL则作为背景图，否则显示字符
    else if (typeof avatar === 'string' && /^(https?:)?\/\//.test(avatar)) {
      el.style.backgroundImage = `url("${avatar}")`;
      el.textContent = '';
      el.classList.add('image');
    } else {
      el.style.backgroundImage = '';
      el.textContent = avatar || 'B';
      el.classList.remove('image');
    }
  }
  
  /**
   * 分数变化动画
   */
  async animateScoreChange(element, targetScore) {
    // 确保targetScore是有效数字
    const validTargetScore = isNaN(targetScore) ? 0 : targetScore;
    const currentScore = parseInt(element.textContent) || 0;
    const duration = 600;
    const steps = 30;
    const stepTime = duration / steps;
    const increment = Math.max(1, Math.ceil((validTargetScore - currentScore) / steps));
    
    // 使用动画管理器执行分数弹跳动画
    let animationPromise = Promise.resolve();
    if (this.animationManager) {
      animationPromise = this.animationManager.animateScoreBounce(element);
    } else {
      // 回退到原始动画方式
      element.classList.add('animate-tick');
    }
    
    let displayScore = currentScore;
    const scoreInterval = setInterval(() => {
      displayScore += increment;
      if (displayScore >= validTargetScore) {
        displayScore = validTargetScore;
        clearInterval(scoreInterval);
      }
      
      element.textContent = displayScore;
    }, stepTime);
    
    // 等待动画完成
    await animationPromise;
  }
  
  /**
   * 更新计时器
   */
  updateTimer(timeLeft) {
    if (!this.elements.timerElement) {
      console.warn('计时器元素未找到');
      return;
    }
    
    // 确保timeLeft是有效数字
    if (timeLeft === undefined || timeLeft === null || isNaN(timeLeft)) {
      console.warn('计时器时间无效:', timeLeft);
      return;
    }
    
    // 更新显示（显示整数秒）
    const displayTime = Math.ceil(timeLeft);
    this.elements.timerElement.textContent = displayTime;
    // console.log(`UI更新计时器显示: ${displayTime} (实际: ${timeLeft})`);
    
    const currentMaxTime = this.stateManager.getState('currentMaxTime') || this.stateManager.getState('maxTime') || 150;
    const progressPercent = Math.max(0, Math.min(1, timeLeft / currentMaxTime));
    const progress = progressPercent * 360;
    
    // 更新计时器颜色和样式
    let stateClass = '';
    if (progressPercent <= 0.2) { 
      stateClass = 'danger'; 
    } else if (progressPercent <= 0.5) { 
      stateClass = 'warning'; 
    } else if (progressPercent <= 0.8) { 
      stateClass = 'success'; 
    }
    
    this.elements.timerCircle.className = `timer-circle ${stateClass}`.trim();
    
    // 更新进度圆环
    this.elements.timerProgress.style.setProperty('--progress-angle', `${progress}deg`);
    const color = this.getProgressColor(progressPercent);
    this.elements.timerProgress.style.background = 
      `conic-gradient(${color} 0deg var(--progress-angle), transparent var(--progress-angle) 360deg)`;
  }
  
  /**
   * 根据进度获取颜色
   */
  getProgressColor(progressPercent) {
    const colors = [
      { percent: 1.0, color: '#2196F3' },
      { percent: 0.9, color: '#4CAF50' },
      { percent: 0.75, color: '#FFC107' },
      { percent: 0.5, color: '#FF9800' },
      { percent: 0.0, color: '#F44336' }
    ];
    
    for (let i = 0; i < colors.length - 1; i++) {
      const current = colors[i];
      const next = colors[i + 1];
      if (progressPercent >= next.percent && progressPercent <= current.percent) {
        const range = current.percent - next.percent;
        const position = progressPercent - next.percent;
        const factor = position / range;
        return this.interpolateColor(next.color, current.color, factor);
      }
    }
    return colors[0].color;
  }
  
  /**
   * 颜色插值
   */
  interpolateColor(color1, color2, factor) {
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { 
        r: parseInt(result[1], 16), 
        g: parseInt(result[2], 16), 
        b: parseInt(result[3], 16) 
      } : null;
    }
    
    function rgbToHex(r, g, b) {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return color1;
    
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
    return rgbToHex(r, g, b);
  }
  
  /**
   * 更新题目
   */
  async updateQuestion(question) {
    if (this.elements.questionText) {
      this.elements.questionText.textContent = question;
      
      // 使用动画管理器执行题目文本动画
      if (this.animationManager) {
        await this.animationManager.animateQuestionText(this.elements.questionText);
      } else {
        // 回退到原始动画方式
        this.elements.questionText.style.animation = 'none';
        this.elements.questionText.offsetHeight;
        this.elements.questionText.style.animation = 'questionTextAnimation 1.6s ease-in-out forwards';
      }
    }
  }
  
  /**
   * 更新选项
   */
  async updateOptions(options) {
    // 先清除所有选项的选择状态和图标
    this.clearPlayerSelection();
    this.clearOpponentResults();
    
    // 检查选项元素是否存在
    if (!this.elements.options || this.elements.options.length === 0) {
      console.warn('选项元素未找到，无法更新选项');
      return;
    }
    
    // 重新初始化所有按钮状态
    this.resetButtonAnimations();
    
    this.elements.options.forEach((option, index) => {
      const optionText = option.querySelector('.option-text');
      if (optionText && options[index]) {
        optionText.textContent = options[index];
        
        // 设置title属性，用于悬浮显示完整文本
        option.setAttribute('title', options[index]);
        optionText.setAttribute('title', options[index]);
        
        // 确保选项文本正确显示，处理可能的文本溢出
        optionText.style.whiteSpace = 'nowrap';
        optionText.style.overflow = 'hidden';
        optionText.style.textOverflow = 'ellipsis';
        // 自适应缩放，确保文本完整显示
        this.fitTextToContainer(optionText);
      }
      
      
    });
    
    // 使用动画管理器执行选项缩放入场动画
    if (this.animationManager) {
      await this.animationManager.animateOptionsScaleIn(this.elements.options);
    } else {
      // 回退到原始动画方式
      this.triggerButtonEntranceAnimations();
    }
  }

  /**
   * 遍历所有选项文本并执行自适应缩放
   */
  refitAllOptionTexts() {
    if (!this.elements.options || this.elements.options.length === 0) return;
    this.elements.options.forEach(option => {
      const optionText = option.querySelector('.option-text');
      if (optionText) {
        this.fitTextToContainer(optionText);
      }
    });
  }

  /**
   * 将给定元素字体缩小到在其容器宽度内完全显示
   * 规则：保持单行（nowrap），逐步减小字体直至不发生水平溢出
   * @param {HTMLElement} textEl
   * @param {number} minPx 最小字体（像素）
   */
  fitTextToContainer(textEl, minPx = 9) {
    if (!textEl) return;
    // 先清除内联字体大小，回到CSS基准（随 --scale-factor 变化）
    textEl.style.removeProperty('font-size');
    // 读取当前计算字体，作为起点
    const computed = window.getComputedStyle(textEl);
    const baseFontSizePx = parseFloat(computed.fontSize) || 16;
    // 以CSS基准为起点，避免上一次缩小影响本次判断
    textEl.style.fontSize = `${baseFontSizePx}px`;
    textEl.style.whiteSpace = 'nowrap';
    textEl.style.overflow = 'hidden';
    textEl.style.textOverflow = 'ellipsis';

    const fits = () => textEl.scrollWidth <= textEl.clientWidth + 0.5; // 容忍浮点误差

    if (fits()) {
      // 恢复为纯CSS控制，便于窗口放大时自动放大
      textEl.style.removeProperty('font-size');
      return;
    }

    // 使用线性递减，文本较短、范围不大，性能足够
    let size = baseFontSizePx;
    while (size > minPx && !fits()) {
      size -= 1;
      textEl.style.fontSize = `${size}px`;
    }
    // 若最后的字体大小与基准一致或仍然合适，清除内联以便放大时能恢复
    if (parseFloat(textEl.style.fontSize) >= baseFontSizePx - 0.5) {
      textEl.style.removeProperty('font-size');
    }
  }
  
  /**
   * 重置按钮动画状态
   */
  resetButtonAnimations() {
    if (!this.elements.options || this.elements.options.length === 0) {
      console.warn('选项元素未找到，跳过重置按钮动画');
      return;
    }
    
    this.elements.options.forEach((option, index) => {
      // 清除所有动画相关的类和样式
      option.classList.remove('animate-in', 'animate-out', 'animate-scale-in', 'animate-bounce-in', 'touch-active');
      option.style.animation = 'none';
      option.style.transition = 'none';
      
      // 清除选中状态和相关图标
      option.classList.remove('selected');
      const existingIcon = option.querySelector('.player-selection-icon');
      if (existingIcon) {
        existingIcon.remove();
      }
      
      // 清除焦点状态，防止焦点停留在按钮上
      if (document.activeElement === option) {
        option.blur();
      }
      
      // 重置为初始状态
      option.style.opacity = '0';
      option.style.transform = 'scale(2.5)'; // 从更大的缩放开始
      
      // 强制重排，确保样式重置生效
      option.offsetHeight;
    });
    
    // 清除选项容器的选择状态
    this.elements.optionsContainer.classList.remove('has-selection');
  }
  
  /**
   * 触发按钮入场动画
   * @deprecated 使用 animationManager.animateOptionsEntrance() 替代
   */
  triggerButtonEntranceAnimations() {
    if (!this.elements.options || this.elements.options.length === 0) {
      console.warn('选项元素未找到，跳过入场动画');
      return;
    }
    
    // 使用动画管理器执行选项入场动画
    if (this.animationManager) {
      this.animationManager.animateOptionsEntrance(this.elements.options);
    } else {
      // 回退到原始动画方式
      this.elements.options.forEach((option, index) => {
        setTimeout(() => {
          option.style.opacity = '1';
          option.style.transform = 'scale(1)';
          option.classList.add('animate-in');
        }, 1700 + (index * 100));
      });
    }
  }
  
  /**
   * 触发选项退出动画
   * 在轮次结束前触发，实现从上到下依次降低透明度和向上移动的效果
   */
  async triggerOptionsExitAnimation() {
    if (!this.elements.options || this.elements.options.length === 0) {
      console.warn('选项元素未找到，跳过退出动画');
      return;
    }
    
    // 使用动画管理器执行选项退出动画
    if (this.animationManager) {
      return await this.animationManager.animateOptionsExit(this.elements.options);
    } else {
      // 回退到原始动画方式
      return new Promise((resolve) => {
        let completedAnimations = 0;
        const totalOptions = this.elements.options.length;
        
        this.elements.options.forEach((option, index) => {
          setTimeout(() => {
            option.classList.add('animate-out');
            
            const handleAnimationEnd = () => {
              completedAnimations++;
              if (completedAnimations === totalOptions) {
                resolve();
              }
              option.removeEventListener('animationend', handleAnimationEnd);
            };
            
            option.addEventListener('animationend', handleAnimationEnd);
          }, index * 80);
        });
      });
    }
  }
  
  /**
   * 初始化按钮状态
   */
  initializeButtonStates() {
    this.elements.options.forEach((option, index) => {
      const optionText = option.querySelector('.option-text');
      if (optionText) {
        const currentText = optionText.textContent;
        if (currentText) {
          // 设置初始title属性
          option.setAttribute('title', currentText);
          optionText.setAttribute('title', currentText);
          
          // 确保选项文本正确显示，处理可能的文本溢出
          optionText.style.whiteSpace = 'nowrap';
          optionText.style.overflow = 'hidden';
          optionText.style.textOverflow = 'ellipsis';
          // 自适应缩放
          this.fitTextToContainer(optionText);
        }
      }
    });
  }
  
  /**
   * 更新按钮状态（包括title属性）
   */
  updateButtonStates(buttonStates) {
    if (!buttonStates.options || !Array.isArray(buttonStates.options)) {
      return;
    }
    
    this.elements.options.forEach((option, index) => {
      const optionText = option.querySelector('.option-text');
      const fullText = buttonStates.options[index];
      
      if (optionText && fullText) {
        // 更新文本内容
        optionText.textContent = fullText;
        
        // 设置title属性，用于悬浮显示完整文本
        option.setAttribute('title', fullText);
        optionText.setAttribute('title', fullText);
        
        // 确保选项文本正确显示，处理可能的文本溢出
        optionText.style.whiteSpace = 'nowrap';
        optionText.style.overflow = 'hidden';
        optionText.style.textOverflow = 'ellipsis';
        // 自适应缩放
        this.fitTextToContainer(optionText);
      }
    });
  }
  
  /**
   * 更新玩家选择
   */
  updatePlayerSelection(newSelection, oldSelection) {
    // 清除之前的选择
    this.clearPlayerSelection();
    
    if (newSelection !== null) {
      const selectedOption = this.elements.options[newSelection];
      if (selectedOption) {
        selectedOption.classList.add('selected');
        
        // 获取玩家答案是否正确
        const isPlayerCorrect = this.stateManager.getState('playerCorrect');
        this.addPlayerSelectionIcon(selectedOption, isPlayerCorrect);
        
        this.elements.optionsContainer.classList.add('has-selection');

        // 玩家已选择后，若对手已选择则显示对手图标
        try {
          const opponentSelection = this.stateManager.getState('opponentSelection');
          if (opponentSelection !== null) {
            const uiOptionIndex = opponentSelection + 1;
            const opponentResult = document.querySelector(`.opponent-result[data-option="${uiOptionIndex}"]`);
            if (opponentResult && opponentResult.children.length === 0) {
              const isCorrect = this.stateManager.getState('opponentCorrect');
              this.showOpponentResult(opponentResult, isCorrect);
            }
          }
        } catch (e) {
          console.warn('玩家选择后显示对手选择图标时发生异常:', e);
        }
      }
    }
  }
  
  /**
   * 清除玩家选择
   */
  clearPlayerSelection() {
    if (!this.elements.options || this.elements.options.length === 0) {
      console.warn('选项元素未找到，跳过清除玩家选择');
      return;
    }
    
    this.elements.options.forEach(option => {
      option.classList.remove('selected', 'touch-active');
      const existingIcon = option.querySelector('.player-selection-icon');
      if (existingIcon) {
        existingIcon.remove();
      }
      
      // 清除焦点状态，防止焦点停留在按钮上
      if (document.activeElement === option) {
        option.blur();
      }
    });
    this.elements.optionsContainer.classList.remove('has-selection');
  }
  
  /**
   * 添加玩家选择图标
   * @param {HTMLElement} optionElement - 选项元素
   * @param {boolean} isCorrect - 答案是否正确
   */
  addPlayerSelectionIcon(optionElement, isCorrect) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    if (isCorrect) {
      // 正确答案图标 (绿色对勾)
      path.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
      path.setAttribute('fill', '#4CAF50'); // 绿色
    } else {
      // 错误答案图标 (红色叉号)
      path.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      path.setAttribute('fill', '#F44336'); // 红色
    }
    
    svg.appendChild(path);
    
    const iconContainer = document.createElement('div');
    iconContainer.className = `player-selection-icon ${isCorrect ? 'correct' : 'incorrect'}`;
    iconContainer.appendChild(svg);
    
    optionElement.appendChild(iconContainer);
  }
  
  /**
   * 更新对手选择
   */
  updateOpponentSelection(newSelection, oldSelection) {
    // 清除之前的对手结果
    this.clearOpponentResults();
    
    if (newSelection !== null) {
      // 仅在玩家已选择或阶段为结果/结束时显示对手图标
      const playerHasSelected = this.stateManager.getState('playerSelection') !== null;
      const gamePhase = this.stateManager.getState('gamePhase');
      const canShowNow = playerHasSelected || gamePhase === 'result' || gamePhase === 'ended';

      if (!canShowNow) {
        return; // 暂不显示，等条件满足再显示（由其他钩子触发）
      }
      
      const uiOptionIndex = newSelection + 1; // 将0-3转换为1-4
      const opponentResult = document.querySelector(`.opponent-result[data-option="${uiOptionIndex}"]`);
      if (opponentResult) {
        const isCorrect = this.stateManager.getState('opponentCorrect');
        this.showOpponentResult(opponentResult, isCorrect);
      }
    }
  }
  
  /**
   * 清除对手结果
   */
  clearOpponentResults() {
    this.elements.opponentResults.forEach(result => {
      result.innerHTML = '';
      result.className = 'opponent-result';
    });
  }
  
  /**
   * 显示对手结果
   */
  showOpponentResult(resultElement, isCorrect) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    
    if (isCorrect) {
      
      // 正确图标 (对勾)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
      svg.appendChild(path);
    } else {
      // 错误图标 (叉号)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      svg.appendChild(path);
    }
    
    resultElement.appendChild(svg);
    resultElement.classList.add('show', isCorrect ? 'correct' : 'incorrect');
  }
  
  /**
   * 更新进度条
   */
  updateProgressBars(playerScore, opponentScore, maxScore) {
    const leftProgress = Math.min(100, (playerScore / maxScore) * 100);
    const rightProgress = Math.min(100, (opponentScore / maxScore) * 100);
    
    if (this.elements.leftProgressFill) {
      this.elements.leftProgressFill.style.height = `${leftProgress}%`;
    }
    if (this.elements.rightProgressFill) {
      this.elements.rightProgressFill.style.height = `${rightProgress}%`;
    }
  }
  
  /**
   * 处理动画
   */
  handleAnimations(newAnimations, oldAnimations) {
    // 处理轮次文本动画
    if (newAnimations.rankText && 
        (!oldAnimations.rankText || 
         newAnimations.rankText.text !== oldAnimations.rankText.text ||
         newAnimations.rankText.timestamp !== oldAnimations.rankText.timestamp)) {
      this.showRankText(newAnimations.rankText.text);
    }
    
    // 处理加分动画
    if (newAnimations.scoreAnimation && 
        (!oldAnimations.scoreAnimation || 
         newAnimations.scoreAnimation.timestamp !== oldAnimations.scoreAnimation.timestamp)) {
      const { score, isPlayer } = newAnimations.scoreAnimation;
      this.createScoreAnimation(score, isPlayer);
    }
    
    // 处理选项退出动画
    if (newAnimations.optionsExitAnimation && 
        (!oldAnimations.optionsExitAnimation || 
         newAnimations.optionsExitAnimation.timestamp !== oldAnimations.optionsExitAnimation.timestamp)) {
      this.triggerOptionsExitAnimation();
    }
  }
  
  /**
   * 显示轮次文本
   */
  async showRankText(text) {
    if (!this.elements.rankText) return;
    
    this.elements.rankText.textContent = text;
    
    // 使用动画管理器执行轮次文本动画
    if (this.animationManager) {
      await this.animationManager.animateRankText(this.elements.rankText);
    } else {
      // 回退到原始动画方式
      this.elements.rankText.classList.remove('animate');
      this.elements.rankText.offsetHeight;
      this.elements.rankText.classList.add('animate');
    }
    
    // 动画结束后清理
    this.elements.rankText.textContent = '';
  }
  
  /**
   * 创建加分动画
   */
  createScoreAnimation(scoreValue, isPlayer) {
    if (!this.elements.scoreAnimationContainer) return;
    
    const container = this.elements.scoreAnimationContainer;
    const animationText = document.createElement('div');
    animationText.className = 'score-animation-text';
    animationText.textContent = `+${scoreValue}`;
    
    // 先将元素添加到DOM中（设为不可见），以便获取其尺寸
    animationText.style.visibility = 'hidden';
    container.appendChild(animationText);
    const textWidth = animationText.offsetWidth;
    
    const containerRect = container.getBoundingClientRect();
    
    // 获取起始元素（rank-text位置）
    const startElement = this.elements.rankText;
    const startRect = startElement.getBoundingClientRect();
    
    // 计算起始坐标
    const startX = startRect.width > 0 ? 
      startRect.left + (startRect.width / 2) - containerRect.left - (textWidth / 2) :
      (containerRect.width / 2) - (textWidth / 2);
    const startY = startRect.height > 0 ? 
      startRect.bottom - containerRect.top - (startRect.height * 1.4) :
      containerRect.height * 0.3;
    
    // 获取目标元素（分数）
    const endElement = isPlayer ? 
      this.elements.playerScore : 
      this.elements.opponentScore;
    const endRect = endElement.getBoundingClientRect();
    
    // 计算目标坐标
    const targetX = endRect.left + (endRect.width / 2) - containerRect.left - (textWidth / 2);
    const targetY = endRect.bottom - containerRect.top * 1.015;
    
    // 设置CSS变量
    animationText.style.setProperty('--start-x', `${startX}px`);
    animationText.style.setProperty('--start-y', `${startY}px`);
    animationText.style.setProperty('--end-x', `${targetX}px`);
    animationText.style.setProperty('--end-y', `${targetY}px`);
    
    // 设为可见，并触发动画
    animationText.style.visibility = 'visible';
    
    setTimeout(() => {
      animationText.classList.add('animate');
      
      // 动画结束后自动移除元素
      animationText.addEventListener('animationend', () => {
        if (animationText.parentNode) {
          animationText.parentNode.removeChild(animationText);
        }
      });
    }, 20);
  }
  
  /**
   * 响应式缩放
   */
  updateScale() {
    const availableWidth = window.innerWidth - 40;
    const availableHeight = window.innerHeight - 40;
    const scaleByWidth = availableWidth / 400;
    const scaleByHeight = availableHeight / 600;
    const scale = Math.min(scaleByWidth, scaleByHeight, 1);
    document.documentElement.style.setProperty('--scale-factor', scale);
    if (window.innerWidth < 480) {
      document.documentElement.style.setProperty('--scale-factor', Math.min(scale, 0.8));
    }
  }
  
  /**
   * 重置UI
   */
  resetUI() {
    this.clearPlayerSelection();
    this.clearOpponentResults();
  }
  
  /**
   * 显示题目阶段
   */
  showQuestion() {
    console.log('显示题目阶段');
  }
  
  /**
   * 显示等待阶段
   */
  showWaiting() {
    console.log('显示等待阶段');
  }
  
  /**
   * 显示结果阶段
   */
  showResult() {
    console.log('显示结果阶段');
  }
  
  /**
   * 显示游戏结束
   */
  showGameEnd() {
    console.log('游戏结束');
    // 隐藏题目主体，但保留头部头像分数
    const questionSection = document.querySelector('.question-section');
    if (questionSection) questionSection.style.display = 'none';

    // 计算结果与颜文字
    const player = this.stateManager.getState('playerScore') || 0;
    const opponent = this.stateManager.getState('opponentScore') || 0;
    const endScreen = document.getElementById('end-screen');
    const endTitle = document.getElementById('end-title');
    const endEmoji = document.getElementById('end-emoji');
    const continueBtn = document.getElementById('continue-button');

    // 多组颜文字池
    const winEmojis = ['ヾ(＾∇＾)','ヽ(•‿•)ノ','٩(ˊᗜˋ*)و','\(￣▽￣)/'];
    const loseEmojis = ['(ｉДｉ)','(T▽T)','(0_0)','(；д；)'];
    const drawEmojis = ['(-__-°)','(・_・;)'];

    if (endScreen && endTitle && endEmoji && continueBtn) {
      let frame = 0;
      let frames = [];
      let intervalMs = 900;
      if (player > opponent) {
        endTitle.textContent = '你赢了';
        frames = winEmojis;
      } else if (player < opponent) {
        endTitle.textContent = '你输了';
        frames = loseEmojis;
      } else {
        endTitle.textContent = '平局';
        // 平局做镜像切换
        frames = drawEmojis.flatMap(e => [e, e.split('').reverse().join('')]);
      }
      endEmoji.textContent = frames[0];
      if (this._endEmojiTimer) clearInterval(this._endEmojiTimer);
      this._endEmojiTimer = setInterval(() => {
        frame = (frame + 1) % frames.length;
        endEmoji.textContent = frames[frame];
      }, intervalMs);
      endScreen.style.display = 'flex';

      // 按钮：继续挑战 -> 重开一局
      continueBtn.onclick = () => {
        endScreen.style.display = 'none';
        if (questionSection) questionSection.style.display = '';
        if (this._endEmojiTimer) {
          clearInterval(this._endEmojiTimer);
          this._endEmojiTimer = null;
        }
        this.stateManager.startNewGame();
      };
    }
  }
  
  /**
   * 销毁控制器
   */
  destroy() {
    // 清理动画管理器
    if (this.animationManager) {
      this.animationManager.destroy();
    }
    
    // 清理事件监听器等
  }
}

// 导出UI控制器
window.UIController = UIController;
