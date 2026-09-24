const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // 是否让整层窗口穿透鼠标（true = 穿透，鼠标落到桌面上）
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', ignore),
  // 在宝宝上右键时，请主进程弹出菜单（x/y 为窗口内坐标）
  showMenu: (x, y) => ipcRenderer.send('context-menu', { x, y }),
  quit: () => ipcRenderer.send('quit'),
  // 页面把醒着/躲起来状态同步给主进程，用于切换菜单文案和召回按钮
  sleepState: (isAwake) => ipcRenderer.send('sleep-state', isAwake),
  // 召回按钮被点击
  summonClick: () => ipcRenderer.send('summon-click'),
  // 页面把探头跟随开/关同步给主进程，用于切换菜单文案
  peekState: (on) => ipcRenderer.send('peek-state', on),
  // 音乐模式状态同步
  danceState: (on) => ipcRenderer.send('dance-state', on),
  // 主进程菜单/dock 触发的动作（cmd + 可选参数）
  onCommand: (cb) => ipcRenderer.on('command', (_e, cmd, payload) => cb(cmd, payload)),
  ready: () => ipcRenderer.send('page-ready'),
});
