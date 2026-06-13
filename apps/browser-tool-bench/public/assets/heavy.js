// 故意的主线程长任务：同步占用约 800ms（T03 性能诊断的坑之一）。
function crunchAnalytics() {
  const t0 = performance.now();
  let acc = 0;
  while (performance.now() - t0 < 800) {
    acc += Math.sqrt(acc + 1);
  }
  return acc;
}
crunchAnalytics();
