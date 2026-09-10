/* BUF FMC 大屏 —— 全局配置（调整轮播节奏无需改业务代码）
 * dwell         自动换页间隔（默认 1 分钟）
 * manualRecovery     手动跳页后保持时长，超时恢复自动轮播
 * cruiseInterval     多报警点巡航取景切换间隔
 * 注：URL ?dwell= 的钳制界（1s~1h）硬编码在 main.js，不在此配置
 */
window.BUF_CONFIG = {
  dwell: 60000,
  manualRecovery: 60000,
  cruiseInterval: 20000
};
