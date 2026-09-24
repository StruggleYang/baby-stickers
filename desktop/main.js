const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let win = null;          // 全屏透明浮层
let summonWin = null;    // 「躲起来」时右下角的召回按钮
let tray = null;
let awake = true;
let peekOn = true;
let danceOn = false;

const BABY_NAMES = ['喜欢你', '谢谢你哦', '我可以', '怎么啦?', '保密', '太开心啦', '睡觉觉', '羞羞', '拜拜呀'];

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setName('宝宝表情包');

  // 全屏工作区（自动避开菜单栏和 Dock）
  const bounds = () => screen.getPrimaryDisplay().workArea;
  const send = (cmd, payload) => win && win.webContents.send('command', cmd, payload);

  function trayIcon() {
    // 醒着用「我可以」宝宝，躲起来时换成打瞌睡的宝宝
    const file = awake ? 'baby-3.png' : 'baby-7.png';
    const img = nativeImage.createFromPath(path.join(__dirname, 'stickers', file));
    return img.resize({ height: 22 });
  }

  function placeSummon() {
    if (!summonWin) return;
    const b = bounds();
    summonWin.setPosition(b.x + b.width - 76, b.y + b.height - 76);
  }

  function setAutoStart(on) {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on });
    else app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: [__dirname] });
  }

  function toggleLogin() {
    setAutoStart(!app.getLoginItemSettings().openAtLogin);
    rebuildMenus();
  }

  function menuTemplate() {
    const login = app.getLoginItemSettings().openAtLogin;
    return [
      awake
        ? { label: '💤 躲起来', click: () => send('sleep') }
        : { label: '👋 宝宝回来', click: () => send('wake') },
      {
        label: '👶 换个宝宝',
        submenu: BABY_NAMES.map((n, i) => ({ label: n, click: () => send('pick', i) })),
      },
      { label: '🎉 全体上场（9 个）', click: () => send('mode', 'all') },
      { label: '👶 只留一个', click: () => send('mode', 'single') },
      { label: peekOn ? '👀 关闭探头跟随' : '👀 开启探头跟随', click: () => send('toggle-peek') },
      { label: '📍 回到屏幕边', click: () => send('goto-edge') },
      { label: danceOn ? '🎵 关闭音乐模式' : '🎵 音乐模式（跟着节奏蹦迪）', click: () => send('toggle-dance') },
      { label: '🔄 归位', click: () => send('home') },
      { type: 'separator' },
      { label: '🔊/🔇 切换音效', click: () => send('toggle-mute') },
      { label: login ? '📌 取消开机自启' : '📌 开机自启', click: toggleLogin },
      { type: 'separator' },
      { label: '🚪 退出宝宝表情包', click: () => app.quit() },
    ];
  }

  function trayTemplate() {
    return [
      awake
        ? { label: '💤 躲起来', click: () => send('sleep') }
        : { label: '👋 宝宝回来', click: () => send('wake') },
      {
        label: '👶 换个宝宝',
        submenu: BABY_NAMES.map((n, i) => ({ label: n, click: () => send('pick', i) })),
      },
      { type: 'separator' },
      { label: '🚪 退出', click: () => app.quit() },
    ];
  }

  function rebuildMenus() {
    if (tray) {
      tray.setImage(trayIcon());
      tray.setToolTip(awake ? '宝宝在桌面上' : '宝宝躲起来了');
      tray.setContextMenu(Menu.buildFromTemplate(trayTemplate()));
    }
    app.dock?.setMenu(Menu.buildFromTemplate(menuTemplate()));
  }

  function createWindow() {
    const b = bounds();
    win = new BrowserWindow({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // 默认整个窗口穿透鼠标，只有移到宝宝身上才可交互（由页面通知切换）
    win.setIgnoreMouseEvents(true, { forward: true });
    const q = [];
    if (process.env.BABY_TEST_PEEK === '1') q.push('testpeek=1');
    if (process.env.BABY_TEST_BEDTIME === '1') q.push('bedtime=1');
    if (process.env.BABY_TEST_ACTIVE) q.push('forceactive=' + process.env.BABY_TEST_ACTIVE);
    if (process.env.BABY_TEST_PIN === '1') q.push('testpin=1');
    if (process.env.BABY_CLEAR_PIN === '1') q.push('clearpin=1');
    if (process.env.BABY_TEST_DANCE === '1') q.push('testdance=1');
    if (process.env.BABY_TEST_TIP === '1') q.push('testtip=1');
    win.loadFile('overlay.html', q.length ? { search: '?' + q.join('&') } : undefined);
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => { win = null; });
  }

  function createSummon() {
    summonWin = new BrowserWindow({
      width: 60,
      height: 60,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    summonWin.setAlwaysOnTop(true, 'screen-saver');
    summonWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    summonWin.loadFile('summon.html');
    placeSummon();
  }

  function setSummonVisible(v) {
    if (!summonWin) return;
    if (v) { placeSummon(); summonWin.showInactive(); }
    else summonWin.hide();
  }

  ipcMain.on('set-ignore', (_e, ignore) => {
    if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('context-menu', (_e, { x, y }) => {
    Menu.buildFromTemplate(menuTemplate()).popup({ window: win, x: Math.round(x), y: Math.round(y) });
  });
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('page-ready', () => {
    console.log('[baby-stickers] overlay ready');
    // 测试钩子：BABY_TEST_SLEEP=1 时 5 秒后自动「躲起来」，用于验证召回按钮
    if (process.env.BABY_TEST_SLEEP === '1') setTimeout(() => send('sleep'), 5000);
  });
  ipcMain.on('sleep-state', (_e, isAwake) => {
    awake = !!isAwake;
    setSummonVisible(!awake);
    rebuildMenus();
  });
  ipcMain.on('peek-state', (_e, on) => {
    peekOn = !!on;
    rebuildMenus();
  });
  ipcMain.on('dance-state', (_e, on) => {
    danceOn = !!on;
    rebuildMenus();
  });
  ipcMain.on('summon-click', () => {
    send('wake');
    setSummonVisible(false);
  });

  app.whenReady().then(() => {
    try {
      app.dock.setIcon(path.join(__dirname, 'stickers', 'baby-3.png'));
    } catch (e) {}
    try {
      tray = new Tray(trayIcon());
      rebuildMenus();
    } catch (e) {}
    createWindow();
    createSummon();
    // 接显示器/分辨率变化：窗口跟着工作区走
    screen.on('display-metrics-changed', () => {
      if (win && !win.isDestroyed()) win.setBounds(bounds());
      placeSummon();
    });
    if (process.env.BABY_ENABLE_AUTOSTART === '1') setAutoStart(true);
    console.log('[baby-stickers] app ready, openAtLogin =', app.getLoginItemSettings().openAtLogin);
  });

  // 已在运行时再次启动（双击 .app）→ 把宝宝召回
  app.on('second-instance', () => send('wake'));
  // 运行中点击 Dock 图标 → 把宝宝召回
  app.on('activate', () => send('wake'));
  app.on('window-all-closed', () => app.quit());
}
