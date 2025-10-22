/**
 * 答题对战游戏状态管理器
 * 
 * 功能说明：
 * - 统一管理游戏中的所有状态：分数、轮次、题目、选项、计时器等
 * - 提供状态订阅机制，支持组件间通信
 * - 实现游戏流程控制：开始、答题、结果、结束
 * - 管理计时器和分数计算逻辑
 * 
 * 设计模式：
 * - 采用观察者模式实现状态订阅
 * - 使用单一数据源原则管理状态
 * - 提供不可变状态更新机制
 * 
 * @class GameStateManager
 */
class GameStateManager {
  /**
   * 构造函数
   * 初始化游戏状态和订阅者系统
   */
  constructor() {
    /**
     * 游戏状态对象
     * 包含游戏运行所需的所有状态信息
     * @type {Object}
     */
    this.state = {
      // ==================== 游戏阶段状态 ====================
      /** @type {string} 当前游戏阶段：ready(准备), question(答题), waiting(等待), result(结果), ended(结束) */
      gamePhase: 'ready',
      /** @type {number} 当前轮次，从1开始 */
      currentRound: 1,
      /** @type {number} 总轮次数，默认10道题 */
      totalRounds: 5,
      
      // ==================== 分数状态 ====================
      /** @type {number} 玩家当前分数 */
      playerScore: 0,
      /** @type {number} 对手当前分数 */
      opponentScore: 0,
      /** @type {number} 最大分数，用于进度条计算 */
      maxScore: 1500,
      
      // ==================== 题目状态 ====================
      /** @type {string|null} 当前题目文本 */
      currentQuestion: null,
      /** @type {Array<string>} 当前题目的选项数组 */
      questionOptions: [],
      /** @type {number|null} 正确答案的索引(1-4) */
      correctAnswer: null,
      
      // ==================== 选择状态 ====================
      /** @type {number|null} 玩家选择的选项索引(1-4) */
      playerSelection: null,
      /** @type {number|null} 对手选择的选项索引(1-4) */
      opponentSelection: null,
      /** @type {boolean|null} 玩家是否答对 */
      playerCorrect: null,
      /** @type {boolean|null} 对手是否答对 */
      opponentCorrect: null,
      /** @type {boolean} 双方是否都已选择答案 */
      bothSelected: false,
      
      // ==================== 计时器状态 ====================
      /** @type {number} 剩余时间（秒） */
      timeLeft: 150,
      /** @type {number} 最大时间（秒） */
      maxTime: 150,
      /** @type {number} 当前轮次的最大时间（秒） */
      currentMaxTime: 150,
      /** @type {boolean} 计时器是否正在运行 */
      timerRunning: false,
      
      // ==================== UI状态 ====================
      /** @type {Object} 动画状态管理 */
      animations: {
        /** @type {Object|false} 轮次文本动画状态 */
        rankText: false,
        /** @type {Object|false} 加分动画状态 */
        scoreAnimation: false,
        /** @type {boolean} 选项动画状态 */
        optionAnimations: false,
        /** @type {Object|false} 选项退出动画状态 */
        optionsExitAnimation: false
      },
      
      // ==================== 对手配置（头像与AI参数） ====================
      /** @type {Object} 对手配置，包括头像与AI参数 */
      opponent: {
        /** @type {string} 对手头像。可为单字符/emoji或图片URL */
        avatar: 'B',
        /** @type {{ accuracy: number, speedMsRange: [number, number] }} AI参数：准确率与作答速度区间 */
        ai: {
          /**
           * @type {number}
           * 预估正确率（0-1）。例如 0.7 表示70%概率选对
           */
          accuracy: 0.5,
          /**
           * @type {[number, number]}
           * 作答速度区间（毫秒）。从最小到最大随机一个延迟
           */
          // 2200 为选项进入动画时间
          speedMsRange: [750, 1200]
        }
      },
      
      // ==================== 按钮状态管理 ====================
      /** @type {Object} 按钮状态管理 */
      buttonStates: {
        /** @type {Array<string>} 存储每个选项的完整文本内容 */
        options: [],
        /** @type {boolean} 标记按钮是否已初始化 */
        initialized: false
      },
      
      // ==================== 历史记录 ====================
      /** @type {Array<Object>} 游戏历史记录，存储每轮的结果 */
      history: [],
      
      // ==================== AI设置 ====================
      /** @type {[number, number]} AI速度范围(毫秒) */
      aiSpeedRange: [1280, 2900],
      /** @type {number} AI正确率(0-1) */
      aiAccuracy: 0
    };
    
    /**
     * 订阅者列表
     * 使用Map存储不同事件的订阅者回调函数
     * @type {Map<string, Array<Function>>}
     */
    this.subscribers = new Map();
    
    /**
     * 计时器引用
     * 用于清理定时器，防止内存泄漏
     * @type {number|null}
     */
    this.timerInterval = null;
    
    /** @type {number|null} 对手作答延迟定时器 */
    this.opponentTimeout = null;
    
    /** @type {Array<Object>} 题库（加载后缓存） */
    this.questionBank = [];
    /** @type {Array<Object>} 本局选出的10道题（不重复） */
    this.selectedQuestions = [];
    /** @type {boolean} 题库是否已加载 */
    this.questionsLoaded = false;
    
    // 绑定方法上下文，确保在回调中this指向正确
    this.updateState = this.updateState.bind(this);
    this.getState = this.getState.bind(this);
  }
  
  /**
   * 更新游戏状态
   * 
   * 功能说明：
   * - 使用深度合并方式更新状态，保持状态不可变性
   * - 自动通知所有订阅者状态变化
   * - 支持静默更新模式，用于内部状态同步
   * 
   * @param {Object} updates - 要更新的状态对象，支持嵌套属性
   * @param {boolean} [silent=false] - 是否静默更新（不触发订阅者回调）
   * 
   * @example
   * // 更新玩家分数
   * gameStateManager.updateState({ playerScore: 100 });
   * 
   * // 更新嵌套属性
   * gameStateManager.updateState({ 
   *   animations: { 
   *     scoreAnimation: { score: 50, isPlayer: true } 
   *   } 
   * });
   * 
   * // 静默更新（不触发订阅者）
   * gameStateManager.updateState({ timeLeft: 120 }, true);
   */
  updateState(updates, silent = false) {
    // 保存旧状态，用于订阅者比较
    const oldState = { ...this.state };
    
    // 使用深度合并更新状态，保持状态不可变性
    this.state = this.deepMerge(this.state, updates);
    
    // 触发状态变化事件（除非是静默更新）
    if (!silent) {
      this.notifySubscribers(this.state, oldState, updates);
    }
    
    // 输出调试信息，展开对象
    // console.log('状态更新:', updates, '新状态:', JSON.stringify(this.state, null, 2));
  }
  
  /**
   * 获取当前状态
   * 
   * 功能说明：
   * - 支持获取完整状态或特定路径的状态
   * - 使用点号分隔的路径访问嵌套属性
   * - 提供安全的属性访问，避免undefined错误
   * 
   * @param {string} [path=null] - 状态路径，如 'playerScore' 或 'animations.rankText'
   * @returns {*} 状态值，如果路径不存在返回undefined
   * 
   * @example
   * // 获取完整状态
   * const fullState = gameStateManager.getState();
   * 
   * // 获取玩家分数
   * const playerScore = gameStateManager.getState('playerScore');
   * 
   * // 获取嵌套属性
   * const rankText = gameStateManager.getState('animations.rankText');
   */
  getState(path = null) {
    if (!path) return this.state;
    
    // 使用reduce安全地访问嵌套属性
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
  
  /**
   * 订阅状态变化
   * 
   * 功能说明：
   * - 实现观察者模式，允许组件订阅特定状态变化
   * - 支持订阅所有状态变化（使用'*'作为事件名）
   * - 返回取消订阅函数，便于清理资源
   * 
   * @param {string} event - 事件名称，支持'*'订阅所有变化
   * @param {Function} callback - 回调函数，接收(newValue, oldValue, newState, oldState)参数
   * @returns {Function} 取消订阅函数
   * 
   * @example
   * // 订阅玩家分数变化
   * const unsubscribe = gameStateManager.subscribe('playerScore', (newScore, oldScore) => {
   *   console.log(`分数变化: ${oldScore} -> ${newScore}`);
   * });
   * 
   * // 订阅所有状态变化
   * gameStateManager.subscribe('*', (newState, oldState, changes) => {
   *   console.log('状态变化:', changes);
   * });
   * 
   * // 取消订阅
   * unsubscribe();
   */
  subscribe(event, callback) {
    // 如果事件不存在，创建空数组
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    
    // 添加回调函数到订阅者列表
    this.subscribers.get(event).push(callback);
    
    // 返回取消订阅函数
    return () => {
      const callbacks = this.subscribers.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * 通知订阅者
   * @param {Object} newState - 新状态
   * @param {Object} oldState - 旧状态
   * @param {Object} changes - 变化的内容
   */
  notifySubscribers(newState, oldState, changes) {
    // 通知所有状态变化的订阅者
    const allSubscribers = this.subscribers.get('*') || [];
    allSubscribers.forEach(callback => {
      try {
        callback(newState, oldState, changes);
      } catch (error) {
        console.error('状态订阅者回调错误:', error);
      }
    });
    
    // 通知特定路径变化的订阅者
    Object.keys(changes).forEach(path => {
      const pathSubscribers = this.subscribers.get(path) || [];
      pathSubscribers.forEach(callback => {
        try {
          callback(newState[path], oldState[path], newState, oldState);
        } catch (error) {
          console.error(`状态订阅者回调错误 (${path}):`, error);
        }
      });
    });
  }
  
  /**
   * 深度合并对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });
    
    return result;
  }
  
  // ==================== 游戏流程控制方法 ====================
  
  /**
   * 开始新游戏
   * 
   * 功能说明：
   * - 重置所有游戏状态到初始值
   * - 清空历史记录和分数
   * - 自动开始第一轮游戏
   * - 每次调用都视为一局全新的游戏
   * 
   * 使用场景：
   * - 页面加载时自动调用
   * - 用户手动重新开始游戏
   * - 游戏结束后重新开始
   * 
   * @example
   * // 开始新游戏
   * gameStateManager.startNewGame();
   */
  async startNewGame() {
    console.log('开始新一局游戏');
    
    // 重置所有游戏状态到初始值
    this.updateState({
      gamePhase: 'ready',           // 设置为准备阶段
      currentRound: 1,              // 重置为第一轮
      playerScore: 0,               // 重置玩家分数
      opponentScore: 0,             // 重置对手分数
      timeLeft: this.state.maxTime, // 重置倒计时
      currentMaxTime: this.state.maxTime, // 重置当前轮次最大时间
      timerRunning: false,          // 确保计时器停止
      history: [],                  // 清空历史记录
      totalRounds: this.state.totalRounds,               // 每局固定
    });
    
    // 重置题库选择
    this.selectedQuestions = [];
    
    // 准备题库与本局题目
    await this.ensureQuestionsPrepared(this.state.totalRounds);
    
    // 自动开始第一轮游戏
    this.startRound(1);
  }
  
  /**
   * 开始新轮次
   * 
   * 功能说明：
   * - 加载指定轮次的题目数据
   * - 重置答题状态和选择状态
   * - 根据轮次设置不同的倒计时时间
   * - 自动启动计时器开始答题
   * 
   * 特殊处理：
   * - 最后一题倒计时翻倍，给玩家更多时间
   * - 确保停止之前的计时器，避免冲突
   * - 延迟启动计时器，确保UI更新完成
   * 
   * @param {number} round - 轮次编号，从1开始
   * 
   * @example
   * // 开始第3轮
   * gameStateManager.startRound(3);
   */
  async startRound(round) {
    // group
    console.log('--------------------------------\n\n');
    console.log(`开始第 ${round} 轮`);
    
    // 确保停止之前的计时器，避免多个计时器同时运行
    this.stopTimer();
    
    // 确保题库已准备
    await this.ensureQuestionsPrepared(this.state.totalRounds);
    
    // 生成当前轮次的题目数据（来自题库）
    const questionData = this.generateMockQuestion(round);
    
    // 最后一题倒计时翻倍，给玩家更多时间思考
    const timeForThisRound = round === this.state.totalRounds ? 
      this.state.maxTime * 2 : this.state.maxTime;
    
    // 更新轮次相关状态
    this.updateState({
      currentRound: round,                    // 当前轮次
      currentQuestion: questionData.question, // 题目文本
      questionOptions: questionData.options,  // 选项数组
      correctAnswer: questionData.correctAnswer, // 正确答案
      gamePhase: 'question',                 // 设置为答题阶段
      playerSelection: null,                 // 重置玩家选择
      opponentSelection: null,               // 重置对手选择
      playerCorrect: null,                   // 重置玩家答题结果
      opponentCorrect: null,                 // 重置对手答题结果
      bothSelected: false,                   // 重置双方选择状态
      timeLeft: timeForThisRound,            // 设置倒计时
      currentMaxTime: timeForThisRound,       // 当前轮次的最大时间
      timerRunning: false,                   // 确保计时器停止
      buttonStates: {
        options: questionData.options,       // 存储选项完整文本
        initialized: true                    // 标记按钮已初始化
      },
      // 重置动画状态，避免上一轮的动画影响新轮次
      animations: {
        rankText: false,
        scoreAnimation: false,
        optionAnimations: false,
        optionsExitAnimation: false
      }
    });
    
    // 实现倒计时进度回滚过渡效果
    this.animateTimerTransition(timeForThisRound);
    
    // 清理上轮对手延迟定时器
    this.clearOpponentTimeout();
    
    console.log(`第 ${round} 轮倒计时设置为: ${timeForThisRound}秒`);
    
    // 显示轮次提示文本
    const roundText = round === this.state.totalRounds ? 
      '最后一题 双倍得分' : 
      `第 ${round} 题`;
    this.showRoundText(roundText);
    
    // 延迟启动计时器，确保状态更新和UI渲染完成
    setTimeout(() => {
      // 等待选项进入动画完成
      this.startTimer();
      // 本轮开始即安排对手作答（无需等待玩家）
      this.waitForOpponent();
      // AnimationManager.getConfig().delays.optionStart
    }, 1500);
  }
  
  /**
   * 玩家选择答案
   * @param {number} optionIndex - 选项索引 (1-4)
   */
  selectAnswer(optionIndex) {
    if (this.state.gamePhase !== 'question') {
      console.log('当前不在答题阶段，无法选择答案');
      return;
    }
    
    if (this.state.playerSelection !== null) {
      console.log('玩家已经选择过答案');
      return;
    }
    
    // 验证选项索引是否有效 (0-3)
    if (optionIndex < 0 || optionIndex > 3) {
      console.log('无效的选项索引:', optionIndex);
      return;
    }
    
    // 验证选项文本内容是否匹配
    const selectedOptionText = this.state.questionOptions[optionIndex];
    if (!selectedOptionText) {
      console.log('选项文本不存在:', optionIndex);
      return;
    }
    
    // 获取正确答案的文本内容进行验证
    const correctAnswerText = this.state.questionOptions[this.state.correctAnswer];
    // console.log(`玩家选择答案: ${optionIndex}`);
    // console.log(`选择的选项文本: "${selectedOptionText}"`);
    // console.log(`正确答案文本: "${correctAnswerText}"`);
    // console.log(`正确答案索引: ${this.state.correctAnswer}`);
    
    // 当前倒计时剩余
    const currentTimeLeft = this.state.timeLeft;
    // console.log(`当前倒计时剩余: ${currentTimeLeft}秒`);
    
    // 使用文本匹配而不是索引匹配来判断答案正确性
    const isCorrect = selectedOptionText === correctAnswerText;
    // console.log(`答案正确性判断: 选择文本="${selectedOptionText}" === 正确答案文本="${correctAnswerText}" = ${isCorrect}`);
    
    this.updateState({
      playerSelection: optionIndex,
      playerCorrect: isCorrect
    });
    
    // 计算得分
    const score = this.calculateScore(isCorrect, this.state.timeLeft);
    
    // 确保分数是有效数字
    const currentPlayerScore = this.state.playerScore || 0;
    const newPlayerScore = currentPlayerScore + score;
    
    // 更新分数
    this.updateState({
      playerScore: newPlayerScore
    });
    
    // 触发加分动画
    this.triggerScoreAnimation(score, true);
    
    console.log(`玩家加分动画触发: +${score}`);
    
    // 检查是否双方都已选择
    this.checkBothSelected();
  }
  
  /**
   * 检查双方是否都已选择
   */
  checkBothSelected() {
    const playerSelected = this.state.playerSelection !== null;
    const opponentSelected = this.state.opponentSelection !== null;
    
    console.log(`检查双方选择状态: 玩家=${playerSelected}, 对手=${opponentSelected}`);
    
    if (playerSelected && opponentSelected) {
      // 双方都已选择，停止计时器并进入结果阶段
      console.log('双方都已选择，进入结果阶段');
      this.stopTimer();
      // 为了让选择反馈有时间展示，延迟再触发退场动画与结果阶段
      setTimeout(() => {
        this.showResults();
      }, 1500);
    } else if (playerSelected && !opponentSelected) {
      // 玩家已选择，等待对手选择
      console.log('玩家已选择，等待对手选择');
      this.waitForOpponent();
    }
    // 如果对手已选择但玩家未选择，继续等待（由计时器处理）
  }
  
  /**
   * 等待对手选择
   */
  waitForOpponent() {
    console.log('等待对手选择...');
    
    if (this.state.gamePhase !== 'question' || this.state.opponentSelection !== null) {
      return;
    }
    // 若已存在未触发的对手作答定时器，则不重复安排
    if (this.opponentTimeout) {
      return;
    }
    
    // 基于AI速度参数添加随机延迟
    const [minMs, maxMs] = this.state.aiSpeedRange || [1280, 2900];
    console.log(`对手作答延迟范围: ${minMs}ms - ${maxMs}ms`);
    const delay = Math.random() * (maxMs - minMs) + minMs;
    console.log(`对手作答延迟: ${delay}ms`);
    this.opponentTimeout = setTimeout(() => {
      // 再次检查状态有效
      if (this.state.gamePhase === 'question' && this.state.opponentSelection === null) {
        this.simulateOpponentAnswer();
      }
    }, delay);
  }
  
  /**
   * 模拟对手答题
   */
  simulateOpponentAnswer() {
    if (this.state.opponentSelection !== null) {
      console.log('对手已经选择过答案，跳过重复计算');
      return;
    }
    
    console.log('对手开始选择答案...');
    
    let opponentChoice;
    
    // 根据AI准确率决定是否选择正确答案
    const accuracy = Math.max(0, Math.min(1, this.state.aiAccuracy ?? 0));
    const shouldAnswerCorrectly = Math.random() < accuracy;
    if (shouldAnswerCorrectly) {
      opponentChoice = this.state.correctAnswer; // 选择正确答案索引(0-3)
    } else {
      // 从错误选项中随机挑一个
      const wrongIndices = [0,1,2,3].filter(i => i !== this.state.correctAnswer);
      opponentChoice = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    }
    const opponentSelectedText = this.state.questionOptions[opponentChoice];
    const correctAnswerText = this.state.questionOptions[this.state.correctAnswer];
    
    // 使用文本匹配而不是索引匹配来判断答案正确性
    const opponentCorrect = opponentSelectedText === correctAnswerText;
    
    // console.log(`对手选择答案: ${opponentChoice}`);
    // console.log(`对手选择的选项文本: "${opponentSelectedText}"`);
    // console.log(`正确答案文本: "${correctAnswerText}"`);
    // console.log(`对手答案正确性判断: 选择文本="${opponentSelectedText}" === 正确答案文本="${correctAnswerText}" = ${opponentCorrect}`);
    
    const opponentScore = this.calculateScore(opponentCorrect, this.state.timeLeft);
    
    // 确保对手分数是数字
    const currentOpponentScore = this.state.opponentScore || 0;
    const newOpponentScore = currentOpponentScore + opponentScore;
    
    // console.log(`对手分数计算: 当前分数=${currentOpponentScore}, 本次得分=${opponentScore}, 新分数=${newOpponentScore}`);
    
    this.updateState({
      opponentSelection: opponentChoice,
      opponentCorrect: opponentCorrect,
      opponentScore: newOpponentScore
    });
    
    // console.log(`对手分数更新完成: ${newOpponentScore}`);
    
    // 触发对手加分动画
    this.triggerScoreAnimation(opponentScore, false);
    
    // console.log(`对手加分动画触发: +${opponentScore}`);
    
    // 检查是否双方都已选择
    this.checkBothSelected();
  }

  /**
   * 配置对手参数（头像、AI准确率、速度区间）
   * @param {{ avatar?: string, ai?: { accuracy?: number, speedMsRange?: [number, number] } }} config
   */
  configureOpponent(config = {}) {
    const current = this.state.opponent || {};
    const currentAi = current.ai || {};
    const next = {
      avatar: config.avatar ?? current.avatar ?? 'B',
      ai: {
        accuracy: typeof config?.ai?.accuracy === 'number' ? config.ai.accuracy : (currentAi.accuracy ?? 0.5),
        speedMsRange: Array.isArray(config?.ai?.speedMsRange) && config.ai.speedMsRange.length === 2
          ? config.ai.speedMsRange
          : (currentAi.speedMsRange ?? [750, 1200])
      }
    };
    this.updateState({ opponent: next });
  }

  /** 清理对手延迟定时器 */
  clearOpponentTimeout() {
    if (this.opponentTimeout) {
      clearTimeout(this.opponentTimeout);
      this.opponentTimeout = null;
    }
  }
  
  /**
   * 显示答题结果
   */
  showResults() {
    console.log('显示答题结果 - 当前游戏阶段:', this.state.gamePhase);
    if (this.state.gamePhase !== 'question') {
      console.log('游戏阶段不是question，跳过重复显示结果');
      return;
    }
    
    // 触发选项退出动画
    this.updateState({
      animations: {
        ...this.state.animations,
        optionsExitAnimation: { timestamp: Date.now() }
      }
    });
    
    this.updateState({
      gamePhase: 'result'
    });
    
    // 停止计时器
    this.stopTimer();
    
    // 记录到历史
    const roundResult = {
      round: this.state.currentRound,
      question: this.state.currentQuestion,
      playerSelection: this.state.playerSelection,
      opponentSelection: this.state.opponentSelection,
      playerCorrect: this.state.playerCorrect,
      opponentCorrect: this.state.opponentCorrect,
      playerScore: this.state.playerScore,
      opponentScore: this.state.opponentScore
    };
    
    this.updateState({
      history: [...this.state.history, roundResult]
    });
    
    // 延迟进入下一轮或结束游戏，但需要检查倒计时
    setTimeout(() => {
      // 确保倒计时为0或双方都已选择
      if (this.state.timeLeft === 0 || (this.state.playerSelection !== null && this.state.opponentSelection !== null)) {
        if (this.state.currentRound < this.state.totalRounds) {
          this.nextRound();
        } else {
          this.endGame();
        }
      } else {
        console.log('等待倒计时归0或双方选择完成');
        // 继续等待
        setTimeout(() => {
          if (this.state.currentRound < this.state.totalRounds) {
            this.nextRound();
          } else {
            this.endGame();
          }
        }, 1000);
      }
    }, 1000);
  }
  
  /**
   * 进入下一轮
   */
  nextRound() {
    // group
    console.log('--------------------------------\n\n');
    console.log(`进入下一轮: ${this.state.currentRound + 1}`);
    
    // 确保停止当前计时器
    this.stopTimer();
    
    // 开始下一轮
    this.startRound(this.state.currentRound + 1);
  }
  
  /**
   * 结束游戏
   */
  endGame() {
    console.log('游戏结束');
    
    // 显示最终结果
    const winner = this.state.playerScore > this.state.opponentScore ? '玩家' : 
                  this.state.playerScore < this.state.opponentScore ? '对手' : '平局';
    
    this.showRoundText(`游戏结束 - ${winner}获胜！`);
    
    this.updateState({
      gamePhase: 'ended'
    });
    
    this.stopTimer();
    this.clearOpponentTimeout();
    
    // 触发游戏结束事件
    const gameResult = {
      finalPlayerScore: this.state.playerScore,
      finalOpponentScore: this.state.opponentScore,
      winner: winner,
      history: this.state.history
    };
    
    console.log('游戏结果:', gameResult);
  }
  
  // ==================== 计时器管理 ====================
  
  /**
   * 启动计时器
   */
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // console.log(`启动计时器，初始时间: ${this.state.timeLeft}`);
    this.updateState({ timerRunning: true });
    
    this.timerInterval = setInterval(() => {
      const currentTime = this.state.timeLeft;
      if (currentTime > 0) {
        this.updateState({
          timeLeft: currentTime - 1
        });
        
        // // 每10秒输出一次倒计时状态
        // if (Math.floor(currentTime) % 10 === 0 && currentTime % 1 === 0) {
        //   console.log(`倒计时: ${Math.floor(currentTime)}秒`);
        // }
      } else {
        // console.log('倒计时归0，触发timeUp');
        this.timeUp();
      }
    }, 125); // 125ms间隔，更流畅的倒计时
  }
  
  /**
   * 停止计时器
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.updateState({ timerRunning: false });
  }
  
  /**
   * 实现倒计时进度回滚过渡效果
   * @param {number} targetTime - 目标倒计时时间
   */
  animateTimerTransition(targetTime) {
    const currentTime = this.state.timeLeft;
    const maxTime = this.state.maxTime;
    
    // 如果当前时间已经是目标时间，无需动画
    if (currentTime === targetTime) {
      return;
    }
    
    // 计算过渡步数和间隔
    const steps = 30; // 动画步数
    const duration = 1200; // 动画持续时间（毫秒）
    const stepInterval = duration / steps;
    
    // 计算每步的时间变化
    const timeStep = (targetTime - currentTime) / steps;
    
    let currentStep = 0;
    
    // 创建过渡动画
    const transitionInterval = setInterval(() => {
      currentStep++;
      const newTime = currentTime + (timeStep * currentStep);
      
      // 更新倒计时显示，但不触发其他逻辑
      this.updateState({
        timeLeft: newTime
      }, true); // 静默更新，避免触发其他订阅者
      
      // 动画完成
      if (currentStep >= steps) {
        clearInterval(transitionInterval);
        // 确保最终值准确
        this.updateState({
          timeLeft: targetTime
        }, true);
      }
    }, stepInterval);
  }
  
  /**
   * 时间到处理
   */
  timeUp() {
    console.log('时间到！倒计时归0 - 当前游戏阶段:', this.state.gamePhase);
    this.stopTimer();
    this.clearOpponentTimeout();
    
    if (this.state.gamePhase === 'question') {
      // 确保倒计时为0
      this.updateState({
        timeLeft: 0
      });
      
      // 如果玩家还没选择，设为未选择（0分）
      if (this.state.playerSelection === null) {
        console.log('玩家超时未选择');
        this.updateState({
          playerSelection: null,
          playerCorrect: false,
          playerScore: this.state.playerScore // 保持原分数
        });
      }
      
      // 如果对手还没选择，设为未选择（0分）
      if (this.state.opponentSelection === null) {
        console.log('对手超时未选择');
        this.updateState({
          opponentSelection: null,
          opponentCorrect: false
          // 注意：不更新opponentScore，避免触发额外的动画
        });
      } else {
        console.log('对手已选择，当前分数:', this.state.opponentScore);
        // 对手已选择，不需要更新任何状态
      }
      
      // 倒计时归0，进入结果阶段
      console.log('倒计时归0，进入结果阶段 - 对手分数:', this.state.opponentScore);
      this.showResults();
    }
  }
  
  // ==================== 分数和动画管理 ====================
  
  /**
   * 计算得分
   * @param {boolean} isCorrect - 是否正确
   * @param {number} timeLeft - 剩余时间
   */
  calculateScore(isCorrect, timeLeft) {
    if (!isCorrect) return 0;
    
    // 确保timeLeft是有效数字
    const validTimeLeft = isNaN(timeLeft) ? 0 : Math.max(0, timeLeft);
    
    // const baseScore = 100;
    // const timeBonus = Math.floor(validTimeLeft / 10) * 10;
    // const randomBonus = Math.floor(Math.random() * 100) + 100;
    
    // const totalScore = baseScore + timeBonus + randomBonus;
    // console.log('计算得分:', { isCorrect, timeLeft, validTimeLeft, baseScore, timeBonus, randomBonus, totalScore });
    
    return validTimeLeft;
  }
  
  /**
   * 触发加分动画
   * @param {number} score - 分数
   * @param {boolean} isPlayer - 是否是玩家
   */
  triggerScoreAnimation(score, isPlayer) {
    const numericScore = Number(score);
    if (!isFinite(numericScore) || numericScore <= 0) {
      return; // 0分或无效分数不触发加分动画（双方共用）
    }
    this.updateState({
      animations: {
        ...this.state.animations,
        scoreAnimation: { score: numericScore, isPlayer, timestamp: Date.now() }
      }
    });
  }
  
  /**
   * 显示轮次文本
   * @param {string} text - 显示文本
   */
  showRoundText(text) {
    this.updateState({
      animations: {
        ...this.state.animations,
        rankText: { text, timestamp: Date.now() }
      }
    });
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 生成题目数据（从题库中）
   * @param {number} round - 轮次
   */
  generateMockQuestion(round) {
    // 容错：若题库未准备，返回一个默认题目
    if (!this.selectedQuestions || this.selectedQuestions.length === 0) {
      return {
        question: '题库加载中，请稍后重试',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0
      };
    }
    const index = (round - 1);
    const bankItem = this.selectedQuestions[index % this.selectedQuestions.length];
    const originalOptions = bankItem.options || [];
    const correctAnswerText = originalOptions[bankItem.answer]; // 题库为0基
    const shuffledOptions = [...originalOptions];
    this.shuffleArray(shuffledOptions);
    const newCorrectAnswerIndex = shuffledOptions.findIndex(option => option === correctAnswerText);
    return {
      question: bankItem.question,
      options: shuffledOptions,
      correctAnswer: newCorrectAnswerIndex
    };
  }

  /**
   * 确保题库已加载并准备好本局的题目
   * @param {number} count - 本局需要的题目数量
   */
  async ensureQuestionsPrepared(count = 10) {
    if (!this.questionsLoaded) {
      await this.loadQuestionBank();
    }
    if (!Array.isArray(this.selectedQuestions) || this.selectedQuestions.length !== count) {
      this.prepareSelectedQuestions(count);
    }
  }

  /**
   * 从 assets/qb.json 加载题库
   */
  async loadQuestionBank() {
    try {
      const response = await fetch('assets/qb.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`题库加载失败: ${response.status}`);
      const data = await response.json();
      // qb.json 结构：{ "问题文本": { options: string[], answer: number, updated_at: string }, ... }
      this.questionBank = Object.entries(data).map(([question, payload]) => ({
        question,
        options: Array.isArray(payload?.options) ? payload.options.slice(0, 4) : [],
        answer: Number(payload?.answer ?? 0)
      })).filter(item => item.question && item.options.length === 4 && item.answer >= 0 && item.answer < 4);
      this.questionsLoaded = true;
    } catch (err) {
      console.error(err);
      this.questionBank = [];
      this.questionsLoaded = false;
    }
  }

  /**
   * 随机选取指定数量的不重复题目
   * @param {number} count
   */
  prepareSelectedQuestions(count = 10) {
    const pool = Array.isArray(this.questionBank) ? this.questionBank.slice() : [];
    if (pool.length === 0) {
      this.selectedQuestions = [];
      return;
    }
    // 打乱后取前count个
    this.shuffleArray(pool);
    const sliced = pool.slice(0, Math.min(count, pool.length));
    this.selectedQuestions = sliced;
  }
  
  /**
   * 使用Fisher-Yates算法随机打乱数组
   * @param {Array} array - 要打乱的数组
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * 重置游戏状态
   */
  reset() {
    this.stopTimer();
    this.clearOpponentTimeout();
    this.updateState({
      gamePhase: 'ready',
      currentRound: 1,
      playerScore: 0,
      opponentScore: 0,
      currentQuestion: null,
      questionOptions: [],
      correctAnswer: null,
      playerSelection: null,
      opponentSelection: null,
      playerCorrect: null,
      opponentCorrect: null,
      selectionLocked: false,
      timeLeft: this.state.maxTime,
      currentMaxTime: this.state.maxTime,
      timerRunning: false,
      history: [],
      animations: {
        rankText: false,
        scoreAnimation: false,
        optionAnimations: false
      }
    });
  }
  
  /**
   * 销毁管理器
   */
  destroy() {
    this.stopTimer();
    this.clearOpponentTimeout();
    this.subscribers.clear();
  }
}

// 导出状态管理器
window.GameStateManager = GameStateManager;

/**
 * 调试辅助：直接进入结算
 * 通过 window.debugSettle(mode) 调用
 * mode: 0 失败、1 胜利、2 平局
 */
GameStateManager.prototype.debugSettle = function(mode = 2) {
  try {
    // 停止一切计时/超时
    this.stopTimer();
    this.clearOpponentTimeout();
    
    const currentPlayer = Number(this.state.playerScore) || 0;
    const currentOpponent = Number(this.state.opponentScore) || 0;
    let player = currentPlayer;
    let opponent = currentOpponent;
    
    // 设定最小分差，确保明显结果
    const delta = 10;
    if (mode === 1) {
      if (player <= opponent) player = opponent + delta;
    } else if (mode === 0) {
      if (opponent <= player) opponent = player + delta;
    } else {
      // 平局
      const max = Math.max(player, opponent);
      player = max;
      opponent = max;
    }
    
    // 立即更新为结束状态
    this.updateState({
      playerScore: player,
      opponentScore: opponent,
      gamePhase: 'ended'
    });
    console.log('[Debug] 直接进入结算:', { mode, player, opponent });
  } catch (e) {
    console.error('[Debug] 进入结算失败:', e);
  }
};
