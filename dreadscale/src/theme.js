export function initializeTheme() {
  // Check for saved theme preference or default to dark mode
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  // Apply theme immediately to prevent flash
  applyTheme(savedTheme);
  
  // Get theme toggle button
  const themeToggle = document.getElementById('themeToggle');
  
  if (themeToggle) {
    // Update button icon based on current theme
    updateThemeIcon(savedTheme);
    
    // Add click event listener
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Force navbar update after theme change
    setTimeout(() => {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        // Trigger a scroll event to update navbar styling
        window.dispatchEvent(new Event('scroll'));
      }
    }, 50);
  }
  
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply new theme
    applyTheme(newTheme);
    
    // Save preference
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    updateThemeIcon(newTheme);
    
    // Removed the notification - theme changes are now silent
  }
  
  function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      // Light bulb icon for both states, but different styling
      themeIcon.textContent = '💡';
      themeIcon.style.filter = theme === 'dark' ? 'brightness(1.2)' : 'brightness(0.8)';
    }
  }
}