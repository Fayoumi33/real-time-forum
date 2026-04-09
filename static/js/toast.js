// ==================== TOAST NOTIFICATIONS ====================
// Displays temporary non-blocking feedback messages.

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
