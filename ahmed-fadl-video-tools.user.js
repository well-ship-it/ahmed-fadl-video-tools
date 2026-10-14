// ==UserScript==
// @name         Ahmed Fadl – Video Tools
// @namespace    https://github.com/well-ship-it/ahmed-fadl-video-tools
// @version      1.0.0
// @description  Video statistics and convenience tools for course videos.
// @match        https://www.ahmed-fadl.com/watch_video.php?video_id=*&course_id=*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      www.ahmed-fadl.com
// @connect      ahmed-fadl.com
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/well-ship-it/ahmed-fadl-video-tools/main/ahmed-fadl-video-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/well-ship-it/ahmed-fadl-video-tools/main/ahmed-fadl-video-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG_URL =
    'https://raw.githubusercontent.com/well-ship-it/ahmed-fadl-video-tools/main/config.json';
  const PROGRESS_URL =
    'https://www.ahmed-fadl.com/update_video_progress.php';
  const LOCAL_KEY = 'ahmedFadlVideoToolsDisabled';
  const CHECK_INTERVAL = 5 * 60 * 1000;

  let enabled = false;
  let busy = false;
  let checkTimer = null;
  let injectTimer = null;

  const log = (...args) =>
    console.log('[Ahmed Fadl Video Tools]', ...args);

  function toast(message, success = true) {
    document.getElementById('aft-toast')?.remove();
    if (!document.body) return;

    const el = document.createElement('div');
    el.id = 'aft-toast';
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '2147483647',
      background: success ? '#218838' : '#c82333',
      color: '#fff',
      padding: '12px 18px',
      borderRadius: '8px',
      font: '15px Arial',
      direction: 'rtl',
      maxWidth: '90%'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function locallyDisabled() {
    try {
      return localStorage.getItem(LOCAL_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function setLocal(value) {
    try {
      localStorage.setItem(LOCAL_KEY, String(value));
      return true;
    } catch {
      return false;
    }
  }

  function registerMenu() {
    GM_registerMenuCommand(
      locallyDisabled() ? 'Enable tools locally' : 'Disable tools locally',
      () => {
        if (!setLocal(!locallyDisabled())) {
          toast('تعذر حفظ الإعداد المحلي', false);
          return;
        }
        location.reload();
      }
    );
  }

  function remoteConfig() {
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: CONFIG_URL + '?_=' + Date.now(),
        timeout: 8000,
        headers: { 'Cache-Control': 'no-cache' },
        onload(response) {
          try {
            if (response.status !== 200) throw Error('HTTP error');
            const cfg = JSON.parse(response.responseText);
            if (typeof cfg.enabled !== 'boolean') throw Error('Invalid config');
            resolve(cfg);
          } catch (error) {
            log('Config error:', error);
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
      });
    });
  }

  function removeUI() {
    document.getElementById('userscript-tools-container')?.remove();
    document.getElementById('aft-stats-row')?.remove();
    document.getElementById('aft-toast')?.remove();
  }

  function stop(message) {
    enabled = false;
    if (injectTimer) clearInterval(injectTimer);
    injectTimer = null;
    removeUI();
    if (message) toast(message, false);
  }

  async function checkConfig(initial = false) {
    if (locallyDisabled()) {
      stop('السكريبت متوقف محليًا');
      return false;
    }

    const cfg = await remoteConfig();
    if (!cfg) {
      stop('تعذر التحقق من الإعدادات؛ تم إيقاف السكريبت');
      return false;
    }

    if (!cfg.enabled) {
      stop(cfg.message || 'تم إيقاف السكريبت بواسطة المطور');
      return false;
    }

    const wasEnabled = enabled;
    enabled = true;

    if (!initial && !wasEnabled) {
      toast('تم التفعيل؛ حدّث الصفحة لتشغيل الأدوات');
      return false;
    }
    return true;
  }

  function pageData() {
    const params = new URLSearchParams(location.search);
    const data = {
      videoId: params.get('video_id'),
      courseId: params.get('course_id'),
      studentId: null,
      viewId: null,
      csrfToken: null,
      videoTime: null,
      viewed: 0
    };

    for (const script of document.scripts) {
      const s = script.textContent || '';
      const patterns = [
        ['studentId', /\bstudentId\s*=\s*['"]?(\d+)['"]?/],
        ['viewId', /\bviewId\s*=\s*['"]?(\d+)['"]?/],
        ['csrfToken', /\bcsrfToken\s*=\s*['"]?([a-f0-9]+)['"]?/i],
        ['videoTime', /\bvideoTime\s*=\s*['"]?(\d+)['"]?/],
        ['viewed', /\bcurrentViewedMinutes\s*=\s*['"]?(\d+)['"]?/]
      ];

      for (const [key, pattern] of patterns) {
        const match = s.match(pattern);
        if (match) {
          data[key] = ['videoTime', 'viewed'].includes(key)
            ? Number.parseInt(match[1], 10)
            : match[1];
        }
      }
    }

    if (!data.videoTime) {
      const video = document.querySelector('video');
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        data.videoTime = Math.ceil(video.duration / 60);
      }
    }

    return data;
  }

  function youtubeId() {
    const player = document.querySelector('[data-plyr-embed-id]');
    const raw = player?.getAttribute('data-plyr-embed-id');

    if (raw && /^[\w-]{11}$/.test(raw)) return raw;

    const iframe = document.querySelector(
      'iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]'
    );

    if (iframe) {
      try {
        const match = new URL(iframe.src).pathname.match(/\/embed\/([^/]+)/);
        if (match && /^[\w-]{11}$/.test(match[1])) return match[1];
      } catch {}
    }

    const style = document.querySelector('.plyr__poster')?.getAttribute('style') || '';
    return style.match(/https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\//)?.[1] || null;
  }

  function button(label, className, handler) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn ' + className + ' flex-fill';
    el.textContent = label;
    el.style.cssText = 'min-height:42px;';
    el.addEventListener('click', event => {
      event.preventDefault();
      handler(el);
    });
    return el;
  }

  function updateProgress(data) {
    return new Promise((resolve, reject) => {
      const body = new FormData();
      body.append('video_id', data.videoId);
      body.append('student_id', data.studentId);
      body.append('viewed_minutes', String(data.videoTime));
      body.append('view_id', data.viewId);
      body.append('csrf_token', data.csrfToken);

      GM_xmlhttpRequest({
        method: 'POST',
        url: PROGRESS_URL,
        data: body,
        timeout: 15000,
        onload: response => {
          if (response.status >= 200 && response.status < 300) resolve();
          else reject(Error('HTTP ' + response.status));
        },
        onerror: () => reject(Error('Network error')),
        ontimeout: () => reject(Error('Request timed out'))
      });
    });
  }

  async function markWatched(el) {
    if (!enabled || busy) return;
    busy = true;
    const original = el.textContent;
    el.disabled = true;
    el.textContent = 'جاري...';

    try {
      const data = pageData();
      if (!data.videoId || !data.studentId || !data.viewId || !data.csrfToken) {
        throw Error('بيانات الفيديو المطلوبة غير متاحة');
      }
      if (!Number.isInteger(data.videoTime) || data.videoTime <= 0) {
        throw Error('تعذر تحديد مدة الفيديو');
      }

      await updateProgress(data);
      if (!enabled) return;
      toast('تم إرسال طلب تحديث المشاهدة');
      el.textContent = 'تم إرسال الطلب';
    } catch (error) {
      log('Progress error:', error);
      if (enabled) {
        toast('فشل التحديث: ' + error.message, false);
        el.textContent = original;
        el.disabled = false;
      }
    } finally {
      busy = false;
    }
  }

  function inject() {
    if (!enabled || document.getElementById('userscript-tools-container')) return;

    let card = null;
    for (const candidate of document.querySelectorAll('.card')) {
      if (candidate.querySelector('.card-title')?.textContent.includes('معلومات الفيديو')) {
        card = candidate;
        break;
      }
    }

    const body = card?.querySelector('.card-body');
    if (!body) return;

    const data = pageData();
    const stats = document.createElement('div');
    stats.id = 'aft-stats-row';
    stats.className = 'row text-center mt-2';
    stats.style.direction = 'rtl';

    for (const [title, value] of [
      ['مدة الفيديو', data.videoTime ? data.videoTime + ' دقيقة' : 'غير متاح'],
      ['حالة المشاهدة', data.videoTime ? `${data.viewed} / ${data.videoTime} دقيقة` : 'غير متاح']
    ]) {
      const col = document.createElement('div');
      col.className = 'col-6 mb-2';
      const panel = document.createElement('div');
      panel.className = 'bg-light p-2 rounded';
      const caption = document.createElement('small');
      caption.textContent = title;
      const val = document.createElement('h5');
      val.textContent = value;
      panel.append(caption, val);
      col.append(panel);
      stats.append(col);
    }
    body.append(stats);

    const container = document.createElement('div');
    container.id = 'userscript-tools-container';
    container.className = 'mt-3 d-flex gap-2 flex-wrap justify-content-center';
    container.style.direction = 'rtl';

    container.append(
      button('تم المشاهدة', 'btn-success', markWatched),
      button('فتح يوتيوب', 'btn-primary', () => {
        if (!enabled) return;
        const id = youtubeId();
        if (!id) return toast('تعذر العثور على معرف يوتيوب', false);
        window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener,noreferrer');
      }),
      button('تحميل الفيديو', 'btn-danger', () => {
        if (!enabled) return;
        const id = youtubeId();
        if (!id) return toast('تعذر العثور على معرف يوتيوب', false);
        window.open('https://ssyoutube.is/convert/?videoId=' + encodeURIComponent(id),
          '_blank', 'noopener,noreferrer');
      })
    );

    body.append(container);
    toast('تمت إضافة أدوات الفيديو');
  }

  function startInjection() {
    if (!enabled || injectTimer) return;
    let attempts = 0;
    injectTimer = setInterval(() => {
      if (!enabled) {
        clearInterval(injectTimer);
        injectTimer = null;
        return;
      }
      inject();
      attempts++;
      if (document.getElementById('userscript-tools-container') || attempts >= 30) {
        clearInterval(injectTimer);
        injectTimer = null;
      }
    }, 500);
  }

  async function main() {
    registerMenu();
    if (!(await checkConfig(true)) || !enabled) return;

    startInjection();

    checkTimer = setInterval(async () => {
      await checkConfig(false);
    }, CHECK_INTERVAL);
  }

  main().catch(error => {
    log('Startup failure:', error);
    stop('حدث خطأ أثناء تشغيل السكريبت');
  });
})();
