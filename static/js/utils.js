// ==================== UTILITIES ====================
// Pure helper functions with no side effects.

function throttle(fn, delay) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const iso = dateStr.replace(" ", "T");
  const date = new Date(iso);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
