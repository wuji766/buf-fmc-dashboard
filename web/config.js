/* BUF FMC 大屏 —— 全局配置（调整轮播节奏无需改业务代码）
 * dwell         自动换页间隔（默认 5 分钟）
 * minDwell/maxDwell  URL 参数 ?dwell=ms 的钳制范围
 * manualRecovery     手动跳页后保持时长，超时恢复自动轮播
 * cruiseInterval     多报警点巡航取景切换间隔
 */
window.BUF_CONFIG = {
  dwell: 300000,
  minDwell: 180000,
  maxDwell: 360000,
  manualRecovery: 60000,
  cruiseInterval: 20000
};
