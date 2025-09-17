const activeNotifications = new Set();
const recentNotifications = new Map();

function showNotification(message, type = 'info') {
  const notificationKey = `${message}-${type}`;
  
  if (activeNotifications.has(notificationKey)) {
    return;
  }
  
  const now = Date.now();
  const recentKey = `${message}-${type}`;
  if (recentNotifications.has(recentKey)) {
    const lastShown = recentNotifications.get(recentKey);
    if (now - lastShown < 300) {
      return;
    }
  }
  
  activeNotifications.add(notificationKey);
  recentNotifications.set(recentKey, now);
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type} bolt-notification`;
  notification.textContent = message;
  notification.dataset.key = notificationKey;
  
  const existingNotifications = document.querySelectorAll('.bolt-notification');
  let topPosition = 20;
  
  existingNotifications.forEach(existing => {
    const rect = existing.getBoundingClientRect();
    topPosition += rect.height + 10;
  });
  
  notification.style.cssText = `
    position: fixed;
    top: ${topPosition}px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
  `;
  
  if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
  } else if (type === 'info') {
    notification.style.background = 'linear-gradient(135deg, #facc15, #eab308)';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  const removeTimeout = setTimeout(() => {
    removeNotification(notification, notificationKey);
  }, 3000);
  
  notification.addEventListener('click', () => {
    clearTimeout(removeTimeout);
    removeNotification(notification, notificationKey);
  });
  
  setTimeout(() => {
    for (const [key, timestamp] of recentNotifications.entries()) {
      if (now - timestamp > 2000) {
        recentNotifications.delete(key);
      }
    }
  }, 2000);
}

function removeNotification(notification, key) {
  if (!document.body.contains(notification)) {
    return;
  }
  
  notification.style.transform = 'translateX(100%)';
  notification.style.opacity = '0';
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
    
    activeNotifications.delete(key);
    repositionNotifications();
  }, 300);
}

function repositionNotifications() {
  const existingNotifications = document.querySelectorAll('.bolt-notification');
  let topPosition = 20;
  
  existingNotifications.forEach(existing => {
    existing.style.top = `${topPosition}px`;
    const rect = existing.getBoundingClientRect();
    topPosition += rect.height + 10;
  });
}
