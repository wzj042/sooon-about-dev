const CACHE_NAME = 'ps-preview-v6';
const SW_VERSION = 'v6-offline-optimized';
const urlsToCache = [
  '/',
  '/app/preview-ref-pack/',
  '/app/preview-ref-pack/index.html',
  '/app/preview-ref-pack/manifest.json',
  '/app/preview-ref-pack/sw.js',
  '/app/preview-ref-pack/icon-32.png',
  '/app/preview-ref-pack/icon-64.png',
  '/app/preview-ref-pack/icon-192.png',
  '/app/preview-ref-pack/icon-512.png',
  '/app/preview-ref-pack/icon.svg'
];

// 检查请求是否可以被缓存
function canCacheRequest(request) {
  try {
    const url = new URL(request.url);
    
    // 检查协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.log('协议不支持:', url.protocol, request.url);
      return false;
    }
    
    // 检查方法
    if (request.method !== 'GET') {
      console.log('方法不支持:', request.method, request.url);
      return false;
    }
    
    // 检查是否是扩展请求
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'moz-extension:' ||
        url.protocol === 'safari-extension:' ||
        url.protocol === 'chrome:' ||
        url.protocol === 'moz:' ||
        url.protocol === 'about:' ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:') {
      console.log('扩展协议被拒绝:', url.protocol, request.url);
      return false;
    }
    
    // 额外的字符串检查
    if (request.url.includes('chrome-extension://') || 
        request.url.includes('moz-extension://') ||
        request.url.includes('safari-extension://') ||
        request.url.includes('chrome://') ||
        request.url.includes('about:') ||
        request.url.includes('data:')) {
      console.log('扩展URL被拒绝:', request.url);
      return false;
    }
    
    console.log('请求通过检查:', request.url);
    return true;
  } catch (error) {
    console.log('无法解析请求URL:', request.url, error.message);
    return false;
  }
}

// 安装事件
self.addEventListener('install', (event) => {
  console.log('Service Worker 安装开始，版本:', SW_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存已打开，版本:', SW_VERSION);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker 安装失败:', error);
        // 即使缓存失败，也继续安装
      })
      .then(() => {
        console.log('Service Worker 安装完成，版本:', SW_VERSION);
        // 强制跳过等待，立即激活
        return self.skipWaiting();
      })
  );
});

// 激活事件
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('当前缓存列表:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 激活完成，版本:', SW_VERSION, '缓存版本:', CACHE_NAME);
      // 强制控制所有客户端
      return self.clients.claim();
    })
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  // 添加版本和调试日志
  console.log('SW收到请求 (版本:', SW_VERSION, '):', event.request.url, event.request.method);
  
  // 检查是否是PWA模式（只在HTTPS或localhost下工作）
  const isPWAMode = self.location.protocol === 'https:' || 
                   self.location.hostname === 'localhost' || 
                   self.location.hostname === '127.0.0.1';
  
  // 如果是开发环境，只处理特定的PWA相关请求
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    // 在开发环境中，处理PWA相关请求和HTML页面
    const isPWARelated = event.request.url.includes('manifest.json') || 
                        event.request.url.includes('icon-') ||
                        event.request.url.includes('sw.js') ||
                        event.request.url.includes('index.html') ||
                        event.request.destination === 'document';
    
    if (!isPWARelated) {
      console.log('开发环境非PWA相关请求，不拦截:', event.request.url);
      return;
    }
  }
  
  // 立即检查并拒绝所有扩展请求
  const requestUrl = event.request.url;
  if (requestUrl.includes('chrome-extension://') || 
      requestUrl.includes('moz-extension://') ||
      requestUrl.includes('safari-extension://') ||
      requestUrl.includes('chrome://') ||
      requestUrl.includes('about:') ||
      requestUrl.includes('data:') ||
      requestUrl.includes('blob:') ||
      requestUrl.startsWith('chrome-extension:') ||
      requestUrl.startsWith('moz-extension:') ||
      requestUrl.startsWith('safari-extension:') ||
      requestUrl.startsWith('chrome:') ||
      requestUrl.startsWith('about:') ||
      requestUrl.startsWith('data:') ||
      requestUrl.startsWith('blob:')) {
    console.log('扩展请求被立即拒绝:', requestUrl);
    return;
  }

  // 检查是否是本地开发服务器请求
  if (requestUrl.includes('127.0.0.1') || 
      requestUrl.includes('localhost') ||
      requestUrl.includes(':5500') ||
      requestUrl.includes(':3000') ||
      requestUrl.includes(':8080') ||
      requestUrl.includes(':8000')) {
    console.log('本地开发服务器请求，不拦截:', requestUrl);
    return;
  }

  // 检查是否是开发环境的请求（包含端口号）
  try {
    const url = new URL(requestUrl);
    if (url.port && (url.port !== '80' && url.port !== '443')) {
      console.log('开发环境请求，不拦截:', requestUrl);
      return;
    }
  } catch (error) {
    // 如果无法解析URL，继续处理
  }
  
  // 使用安全检查函数
  if (!canCacheRequest(event.request)) {
    console.log('请求被过滤:', event.request.url);
    return;
  }

  // 更严格的请求过滤
  let url;
  try {
    url = new URL(event.request.url);
  } catch (error) {
    console.log('无法解析URL:', event.request.url);
    return;
  }

  // 只处理同源请求或特定的外部资源
  const currentOrigin = self.location.origin;
  if (url.origin !== currentOrigin) {
    // 对于跨域请求，只处理特定的静态资源
    const allowedExtensions = ['.css', '.js', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const hasAllowedExtension = allowedExtensions.some(ext => url.pathname.endsWith(ext));
    if (!hasAllowedExtension) {
      return;
    }
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果缓存中有，返回缓存
        if (response) {
          console.log('从缓存返回:', event.request.url);
          return response;
        }
        
        // 特殊处理：如果是根路径请求，直接返回子页面内容
        if (url.pathname === '/' && event.request.destination === 'document') {
          console.log('根路径请求，返回子页面内容');
          return caches.match('/app/preview-ref-pack/index.html');
        }
        
        // 特殊处理：如果是子页面请求，优先从缓存获取
        if (url.pathname.startsWith('/app/preview-ref-pack/') && event.request.destination === 'document') {
          console.log('子页面请求，优先从缓存获取');
          return caches.match('/app/preview-ref-pack/index.html');
        }
        
        // 否则从网络获取
        return fetch(event.request).then((response) => {
          // 检查是否是有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

            // 只缓存HTML、CSS、JS等静态资源
          const isStaticResource = url.pathname.endsWith('.html') || 
                                 url.pathname.endsWith('.css') || 
                                 url.pathname.endsWith('.js') || 
                                 url.pathname.endsWith('.json') ||
                                 url.pathname.endsWith('.woff') ||
                                 url.pathname.endsWith('.woff2') ||
                                 url.pathname.endsWith('.ttf') ||
                                 url.pathname.endsWith('.png') ||
                                 url.pathname.endsWith('.jpg') ||
                                 url.pathname.endsWith('.jpeg') ||
                                 url.pathname.endsWith('.gif') ||
                                 url.pathname.endsWith('.svg') ||
                                 url.pathname === '/' ||
                                 url.pathname === '/index.html' ||
                                 url.pathname === '/app/preview-ref-pack/' ||
                                 url.pathname === '/app/preview-ref-pack/index.html';

          if (isStaticResource) {
            // 再次检查请求是否可以被缓存
            if (canCacheRequest(event.request)) {
              console.log('准备缓存资源:', event.request.url);
              
              // 克隆响应
              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  try {
                    // 最后一次检查
                    const url = new URL(event.request.url);
                    if (url.protocol === 'chrome-extension:' || 
                        url.protocol === 'moz-extension:' ||
                        url.protocol === 'safari-extension:' ||
                        url.protocol === 'chrome:' ||
                        url.protocol === 'moz:' ||
                        url.protocol === 'about:' ||
                        url.protocol === 'data:' ||
                        url.protocol === 'blob:') {
                      console.log('最后检查失败，跳过缓存:', event.request.url);
                      return;
                    }
                    
                    cache.put(event.request, responseToCache);
                    console.log('成功缓存:', event.request.url);
                  } catch (error) {
                    console.log('缓存请求失败:', error.message, event.request.url);
                  }
                })
                .catch((error) => {
                  console.log('缓存操作失败:', error.message, event.request.url);
                });
            } else {
              console.log('请求未通过缓存检查:', event.request.url);
            }
          } else {
            console.log('不是静态资源，不缓存:', event.request.url);
          }

          return response;
        }).catch((error) => {
          console.log('网络请求失败，尝试从缓存获取:', error.message, event.request.url);
          // 网络错误时返回缓存的内容
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('从缓存返回离线内容:', event.request.url);
              return cachedResponse;
            }
            
            // 如果是HTML页面请求，返回离线页面
            if (event.request.destination === 'document') {
              console.log('返回离线页面');
              // 优先尝试子页面
              return caches.match('/app/preview-ref-pack/index.html').then((subPageResponse) => {
                if (subPageResponse) {
                  console.log('返回子页面离线内容');
                  return subPageResponse;
                }
                // 如果子页面也没有，尝试根路径
                return caches.match('/app/preview-ref-pack/');
              });
            }
            
            // 其他情况返回网络错误
            throw error;
          });
        });
      })
  );
});

// 监听消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
