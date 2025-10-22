/**
 * DiceBear 头像生成器
 * 使用CDN动态加载DiceBear 9.x ESM模块
 */
class AvatarGenerator {
  constructor() {
    this.availableStyles = ['icons','avataaars', 'big-smile', 'micah'];
    this.defaultSize = 64;
    this.defaultBackgroundColor = [
      '#B5F4BC',
      '#ECE2E1',
      '#C0EB75',
      '#FFC078',
      '#FCF7D1',
      '#66D9E8',
      '#C4DDD6',
      '#E599F7',
      '#FFD43B',
      '#FFA8A8',
      '#91A7FF',
    ],
    this.defaultRadius = 25;
    this.core = null;
    this.collection = null;
    this.initialized = false;
    console.log('DiceBear 头像生成器已初始化');
  }

  /**
   * 初始化DiceBear模块
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      // 使用Skypack CDN加载ESM模块
      console.log('正在加载DiceBear模块...');
      
      // 动态导入DiceBear核心模块
      this.core = await import('https://cdn.skypack.dev/@dicebear/core@9.2.4');
      
      // 动态导入DiceBear集合模块
      this.collection = await import('https://cdn.skypack.dev/@dicebear/collection@9.2.4');
      
      this.initialized = true;
      console.log('DiceBear 模块加载成功');
      return true;
    } catch (error) {
      console.error('DiceBear 模块加载失败:', error);
      return false;
    }
  }

  getRandomSeed() {
    return Math.random().toString(36).substring(2, 15);
  }

  getRandomStyle() {
    const randomIndex = Math.floor(Math.random() * this.availableStyles.length);
    return this.availableStyles[randomIndex];
  }

  /**
   * 使用 DiceBear 生成头像
   * @param {string} style - 头像风格
   * @param {string} seed - 随机种子
   * @returns {Promise<string>} SVG 格式的头像数据
   */
  async generateAvatarWithDiceBear(style, seed) {
    try {
      // 确保模块已初始化
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          throw new Error('DiceBear 模块初始化失败');
        }
      }

      // 获取风格模块
      let styleModule;
      switch (style) {
        case 'icons':
          styleModule = this.collection.icons;
          break;
        case 'avataaars':
          styleModule = this.collection.avataaars;
          break;
        case 'big-smile':
          styleModule = this.collection.bigSmile;
          break;
        case 'micah':
          styleModule = this.collection.micah;
          break;
        default:
          styleModule = this.collection.icons;
      }

      // 随机选择背景颜色
      const randomColor = this.defaultBackgroundColor[Math.floor(Math.random() * this.defaultBackgroundColor.length)];
      // 移除 # 号，DiceBear 需要不带 # 的颜色代码
      const cleanColor = randomColor.replace('#', '');
      
      // 生成头像
      const avatarOptions = {
        seed: seed,
        size: this.defaultSize,
        radius: this.defaultRadius,
        backgroundColor: [cleanColor],
        backgroundType: ['solid']
      };

      
      // 为不同风格添加特殊配置
      if (style === 'icons') {
        // icons 风格的特殊配置
        avatarOptions.scale = 100;
        avatarOptions.size = this.defaultSize;
      } else if (style === 'big-smile') {
        // big-smile 风格需要确保背景类型为 solid
        avatarOptions.backgroundType = ['solid'];
      } else if (style === 'avataaars') {
        // avataaars 风格配置
        avatarOptions.backgroundType = ['solid'];
      } else if (style === 'micah') {
        // micah 风格配置
        avatarOptions.backgroundType = ['solid'];
      }

      const avatar = this.core.createAvatar(styleModule, avatarOptions);

      return avatar.toString();
    } catch (error) {
      console.error('使用 DiceBear 生成头像失败:', error);
      return this.generateFallbackAvatar();
    }
  }

  /**
   * 生成备用头像（当 DiceBear 不可用时）
   * @returns {string} 简单的 SVG 头像
   */
  generateFallbackAvatar() {
    const randomColor = this.defaultBackgroundColor[Math.floor(Math.random() * this.defaultBackgroundColor.length)];
    return `
      <svg width="${this.defaultSize}" height="${this.defaultSize}" viewBox="0 0 ${this.defaultSize} ${this.defaultSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${this.defaultSize / 2}" cy="${this.defaultSize / 2}" r="${this.defaultSize / 2}" fill="${randomColor}"/>
        <text x="${this.defaultSize / 2}" y="${this.defaultSize / 2 + 8}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">AI</text>
      </svg>
    `;
  }

  /**
   * 生成随机头像
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 包含头像数据和元信息的对象
   */
  async generateRandomAvatar(options = {}) {
    const {
      style = this.getRandomStyle(),
      seed = this.getRandomSeed(),
      size = 64
    } = options;

    let avatarData;
    let isFallback = false;

    try {
      // 尝试使用 DiceBear 生成头像
      avatarData = await this.generateAvatarWithDiceBear(style, seed);
      isFallback = false;
    } catch (error) {
      console.warn('DiceBear 生成失败，使用备用方案:', error);
      // 使用备用方案
      avatarData = this.generateFallbackAvatar();
      isFallback = true;
    }

    return {
      svg: avatarData,
      style: style,
      seed: seed,
      size: size,
      isFallback: isFallback,
      timestamp: Date.now()
    };
  }

  /**
   * 将头像设置为指定元素
   * @param {string|HTMLElement} element - 目标元素选择器或元素对象
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 头像数据对象
   */
  async setAvatarToElement(element, options = {}) {
    const avatarData = await this.generateRandomAvatar(options);
    const targetElement = typeof element === 'string' ? 
      document.querySelector(element) : element;

    if (!targetElement) {
      console.error('未找到目标元素:', element);
      return null;
    }

    // 如果是 img 元素，设置 src
    if (targetElement.tagName === 'IMG') {
      // 清理 SVG 数据，移除多余的空白字符
      const cleanSvg = avatarData.svg.replace(/\s+/g, ' ').trim();
      // 使用 encodeURIComponent 来处理非 Latin1 字符
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
      targetElement.src = dataUri;
    } else {
      // 其他元素，使用 insertAdjacentHTML 来正确插入SVG
      targetElement.innerHTML = ''; // 清空现有内容
      targetElement.insertAdjacentHTML('beforeend', avatarData.svg);
    }

    // 添加调试信息
    console.log('头像已生成:', {
      style: avatarData.style,
      seed: avatarData.seed,
      isFallback: avatarData.isFallback
    });

    return avatarData;
  }

  /**
   * 获取所有可用的头像风格
   * @returns {Array} 风格列表
   */
  getAvailableStyles() {
    return this.availableStyles;
  }
}

// 创建全局实例
window.avatarGenerator = new AvatarGenerator();