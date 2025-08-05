const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js'); // inject.js 里放上面的拦截器代码
document.documentElement.appendChild(script);