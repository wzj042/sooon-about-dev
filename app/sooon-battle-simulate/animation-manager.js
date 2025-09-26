/**
 * 动画管理器
 * 
 * 功能说明：
 * - 统一管理所有动画效果，包括选项按钮、题目文本、轮次文本等
 * - 提供精确的动画时序控制和状态管理
 * - 优化动画性能，使用requestAnimationFrame
 * - 支持动画配置和自定义参数
 * - 提供动画队列和批量处理功能
 * 
 * 设计模式：
 * - 采用单例模式确保全局唯一实例
 * - 使用观察者模式监听动画状态变化
 * - 实现命令模式封装动画操作
 * 
 * @class AnimationManager
 */
class AnimationManager {
  /**
   * 构造函数
   * 初始化动画管理器，设置默认配置和状态
   */
  constructor() {
    /** @type {Object} 动画配置对象 */
    this.config = {
      // 动画开关
      enableAnimations: true,
      // 动画速度倍数
      animationSpeed: 1.0,
      // 缓动函数
      easing: 'ease-in-out',
      
      // 各类型动画持续时间（毫秒）
      durations: {
        questionText: 1600,
        rankText: 1600,
        optionEntrance: 200,
        optionScaleIn: 600,
        optionBounceIn: 800,
        optionExit: 600,
        scoreBounce: 600,
        scoreFly: 1100
      },
      
      // 动画延迟配置（毫秒）
      delays: {
        optionStart: 1400,      // 选项动画开始延迟
        optionStagger: 100,     // 选项间错开延迟
        optionExitStagger: 80,  // 选项退出错开延迟
        questionTextStart: 0,   // 题目文本开始延迟
        rankTextStart: 0        // 轮次文本开始延迟
      }
    };
    
    /** @type {Set} 当前活跃的动画ID集合 */
    this.activeAnimations = new Set();
    
    /** @type {Array} 动画队列 */
    this.animationQueue = [];
    
    /** @type {Map} 动画状态监听器 */
    this.animationListeners = new Map();
    
    /** @type {Object} 动画元素缓存 */
    this.elementCache = new Map();
    
    // 初始化CSS变量
    this.initializeCSSVariables();
  }
  
  /**
   * 初始化CSS变量
   * 将动画配置同步到CSS变量中
   */
  initializeCSSVariables() {
    const root = document.documentElement;
    
    // 设置动画持续时间变量
    Object.entries(this.config.durations).forEach(([key, value]) => {
      root.style.setProperty(`--animation-duration-${key}`, `${value}ms`);
    });
    
    // 设置动画延迟变量
    Object.entries(this.config.delays).forEach(([key, value]) => {
      root.style.setProperty(`--animation-delay-${key}`, `${value}ms`);
    });
    
    // 设置动画速度变量
    root.style.setProperty('--animation-speed', this.config.animationSpeed);
    root.style.setProperty('--animation-easing', this.config.easing);
  }
  
  /**
   * 更新动画配置
   * @param {Object} newConfig - 新的配置对象
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initializeCSSVariables();
  }
  
  /**
   * 获取动画配置
   * @returns {Object} 当前配置对象
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * 创建动画ID
   * @param {string} type - 动画类型
   * @param {string} elementId - 元素标识
   * @returns {string} 唯一动画ID
   */
  createAnimationId(type, elementId) {
    return `${type}_${elementId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 执行动画
   * @param {HTMLElement} element - 目标元素
   * @param {string} animationType - 动画类型
   * @param {Object} options - 动画选项
   * @returns {Promise} 动画完成Promise
   */
  async animateElement(element, animationType, options = {}) {
    if (!this.config.enableAnimations) {
      return Promise.resolve();
    }
    
    const animationId = this.createAnimationId(animationType, element.id || 'unknown');
    const config = this.getAnimationConfig(animationType, options);
    
    return new Promise((resolve, reject) => {
      try {
        this.activeAnimations.add(animationId);
        
        // 使用requestAnimationFrame优化性能
        requestAnimationFrame(() => {
          this.applyAnimation(element, config);
          
          // 监听动画结束事件
          const handleAnimationEnd = (event) => {
            if (event.target === element) {
              this.activeAnimations.delete(animationId);
              element.removeEventListener('animationend', handleAnimationEnd);
              element.removeEventListener('transitionend', handleAnimationEnd);
              resolve();
            }
          };
          
          element.addEventListener('animationend', handleAnimationEnd);
          element.addEventListener('transitionend', handleAnimationEnd);
          
          // 设置超时保护
          setTimeout(() => {
            if (this.activeAnimations.has(animationId)) {
              this.activeAnimations.delete(animationId);
              element.removeEventListener('animationend', handleAnimationEnd);
              element.removeEventListener('transitionend', handleAnimationEnd);
              resolve();
            }
          }, config.duration + 100);
        });
        
      } catch (error) {
        this.activeAnimations.delete(animationId);
        reject(error);
      }
    });
  }
  
  /**
   * 获取动画配置
   * @param {string} animationType - 动画类型
   * @param {Object} options - 自定义选项
   * @returns {Object} 动画配置对象
   */
  getAnimationConfig(animationType, options = {}) {
    const baseConfig = {
      duration: this.config.durations[animationType] || 300,
      delay: 0,
      easing: this.config.easing,
      ...options
    };
    
    // 应用动画速度倍数
    baseConfig.duration = Math.round(baseConfig.duration / this.config.animationSpeed);
    
    return baseConfig;
  }
  
  /**
   * 应用动画到元素
   * @param {HTMLElement} element - 目标元素
   * @param {Object} config - 动画配置
   */
  applyAnimation(element, config) {
    // 清除之前的动画状态
    element.style.animation = 'none';
    element.style.transition = 'none';
    
    // 强制重排
    element.offsetHeight;
    
    // 应用新的动画
    if (config.animationName) {
      element.style.animation = `${config.animationName} ${config.duration}ms ${config.easing} ${config.delay}ms forwards`;
    } else if (config.transition) {
      element.style.transition = `${config.transition} ${config.duration}ms ${config.easing} ${config.delay}ms`;
    }
    
    // 应用CSS类
    if (config.className) {
      element.classList.add(config.className);
    }
    
    // 应用内联样式
    if (config.styles) {
      Object.entries(config.styles).forEach(([property, value]) => {
        element.style[property] = value;
      });
    }
  }
  
  /**
   * 选项按钮入场动画
   * @param {NodeList|Array} options - 选项元素列表
   * @param {Object} animationOptions - 动画选项
   * @returns {Promise} 所有动画完成Promise
   */
  async animateOptionsEntrance(options, animationOptions = {}) {
    if (!options || options.length === 0) {
      return Promise.resolve();
    }
    
    const promises = [];
    const startDelay = this.config.delays.optionStart;
    const staggerDelay = this.config.delays.optionStagger;
    
    options.forEach((option, index) => {
      const delay = startDelay + (index * staggerDelay);
      const promise = this.animateElement(option, 'optionEntrance', {
        delay,
        className: 'animate-in',
        styles: {
          opacity: '1',
          transform: 'scale(1)'
        },
        ...animationOptions
      });
      promises.push(promise);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * 选项按钮缩放入场动画（从大到小）
   * @param {NodeList|Array} options - 选项元素列表
   * @param {Object} animationOptions - 动画选项
   * @returns {Promise} 所有动画完成Promise
   */
  async animateOptionsScaleIn(options, animationOptions = {}) {
    if (!options || options.length === 0) {
      return Promise.resolve();
    }
    
    const promises = [];
    const startDelay = this.config.delays.optionStart;
    const staggerDelay = this.config.delays.optionStagger;
    
    options.forEach((option, index) => {
      const delay = startDelay + (index * staggerDelay);
      const promise = this.animateElement(option, 'optionScaleIn', {
        delay,
        className: 'animate-scale-in',
        animationName: 'optionScaleInAnimation',
        ...animationOptions
      });
      promises.push(promise);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * 选项按钮弹性入场动画（带旋转效果）
   * @param {NodeList|Array} options - 选项元素列表
   * @param {Object} animationOptions - 动画选项
   * @returns {Promise} 所有动画完成Promise
   */
  async animateOptionsBounceIn(options, animationOptions = {}) {
    if (!options || options.length === 0) {
      return Promise.resolve();
    }
    
    const promises = [];
    const startDelay = this.config.delays.optionStart;
    const staggerDelay = this.config.delays.optionStagger;
    
    options.forEach((option, index) => {
      const delay = startDelay + (index * staggerDelay);
      const promise = this.animateElement(option, 'optionBounceIn', {
        delay,
        className: 'animate-bounce-in',
        animationName: 'optionBounceInAnimation',
        ...animationOptions
      });
      promises.push(promise);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * 选项按钮退出动画
   * @param {NodeList|Array} options - 选项元素列表
   * @param {Object} animationOptions - 动画选项
   * @returns {Promise} 所有动画完成Promise
   */
  async animateOptionsExit(options, animationOptions = {}) {
    if (!options || options.length === 0) {
      return Promise.resolve();
    }
    
    const promises = [];
    const staggerDelay = this.config.delays.optionExitStagger;
    
    options.forEach((option, index) => {
      const delay = index * staggerDelay;
      const promise = this.animateElement(option, 'optionExit', {
        delay,
        className: 'animate-out',
        animationName: 'optionExitAnimation',
        ...animationOptions
      });
      promises.push(promise);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * 题目文本动画
   * @param {HTMLElement} element - 题目文本元素
   * @param {Object} options - 动画选项
   * @returns {Promise} 动画完成Promise
   */
  async animateQuestionText(element, options = {}) {
    return this.animateElement(element, 'questionText', {
      animationName: 'questionTextAnimation',
      ...options
    });
  }
  
  /**
   * 轮次文本动画
   * @param {HTMLElement} element - 轮次文本元素
   * @param {Object} options - 动画选项
   * @returns {Promise} 动画完成Promise
   */
  async animateRankText(element, options = {}) {
    return this.animateElement(element, 'rankText', {
      animationName: 'rankTextAnimation',
      ...options
    });
  }
  
  /**
   * 分数弹跳动画
   * @param {HTMLElement} element - 分数元素
   * @param {Object} options - 动画选项
   * @returns {Promise} 动画完成Promise
   */
  async animateScoreBounce(element, options = {}) {
    return this.animateElement(element, 'scoreBounce', {
      className: 'animate-tick',
      animationName: 'scoreBounce',
      ...options
    });
  }
  
  /**
   * 批量执行动画
   * @param {Array} animations - 动画配置数组
   * @returns {Promise} 所有动画完成Promise
   */
  async batchAnimate(animations) {
    const promises = animations.map(animation => {
      const { element, type, options } = animation;
      return this.animateElement(element, type, options);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * 序列执行动画
   * @param {Array} animations - 动画配置数组
   * @returns {Promise} 所有动画完成Promise
   */
  async sequenceAnimate(animations) {
    for (const animation of animations) {
      const { element, type, options } = animation;
      await this.animateElement(element, type, options);
    }
  }
  
  /**
   * 停止所有动画
   */
  stopAllAnimations() {
    this.activeAnimations.clear();
    
    // 清除所有动画样式
    document.querySelectorAll('[style*="animation"], [style*="transition"]').forEach(element => {
      element.style.animation = 'none';
      element.style.transition = 'none';
    });
  }
  
  /**
   * 等待所有动画完成
   * @returns {Promise} 所有动画完成Promise
   */
  async waitForAllAnimations() {
    const activePromises = Array.from(this.activeAnimations).map(id => {
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.activeAnimations.has(id)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });
    });
    
    return Promise.all(activePromises);
  }
  
  /**
   * 获取动画状态
   * @returns {Object} 动画状态信息
   */
  getAnimationStatus() {
    return {
      activeCount: this.activeAnimations.size,
      activeAnimations: Array.from(this.activeAnimations),
      queueLength: this.animationQueue.length,
      config: this.getConfig()
    };
  }
  
  /**
   * 重置动画管理器
   */
  reset() {
    this.stopAllAnimations();
    this.activeAnimations.clear();
    this.animationQueue = [];
    this.elementCache.clear();
  }
  
  /**
   * 销毁动画管理器
   */
  destroy() {
    this.reset();
    this.animationListeners.clear();
  }
}

// 导出动画管理器
window.AnimationManager = AnimationManager;
