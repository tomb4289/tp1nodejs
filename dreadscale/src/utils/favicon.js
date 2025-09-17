// Random favicon system
export function initializeRandomFavicon() {
  // List of all available favicon sets
  const faviconSets = [
    {
      name: 'Kill Bill',
      favicon16: '/kill-favicon-16x16.png',
      favicon32: '/kill-favicon-32x32.png',
      appleTouchIcon: '/kill-apple-touch-icon.png',
      android192: '/kill-android-chrome-192x192.png',
      android512: '/kill-android-chrome-512x512.png'
    },
    {
      name: 'req',
      favicon16: '/req-favicon-16x16.png',
      favicon32: '/req-favicon-32x32.png',
      appleTouchIcon: '/req-apple-touch-icon.png',
      android192: '/req-android-chrome-192x192.png',
      android512: '/req-android-chrome-512x512.png'
    },
    {
      name: 'mickey',
      favicon16: '/mickey-favicon-16x16.png',
      favicon32: '/mickey-favicon-32x32.png',
      appleTouchIcon: '/mickey-apple-touch-icon.png',
      android192: '/mickey-android-chrome-192x192.png',
      android512: '/mickey-android-chrome-512x512.png'
    },
    {
      name: 'no',
      favicon16: '/no-favicon-16x16.png',
      favicon32: '/no-favicon-32x32.png',
      appleTouchIcon: '/no-apple-touch-icon.png',
      android192: '/no-android-chrome-192x192.png',
      android512: '/no-android-chrome-512x512.png'
    },
    {
      name: 'mother',
      favicon16: '/mother-favicon-16x16.png',
      favicon32: '/mother-favicon-32x32.png',
      appleTouchIcon: '/mother-apple-touch-icon.png',
      android192: '/mother-android-chrome-192x192.png',
      android512: '/mother-android-chrome-512x512.png'
    },
    {
      name: 'mid',
      favicon16: '/mid-favicon-16x16.png',
      favicon32: '/mid-favicon-32x32.png',
      appleTouchIcon: '/mid-apple-touch-icon.png',
      android192: '/mid-android-chrome-192x192.png',
      android512: '/mid-android-chrome-512x512.png'
    }
  ];

  // Select a random favicon set
  const randomIndex = Math.floor(Math.random() * faviconSets.length);
  const selectedSet = faviconSets[randomIndex];
  
  console.log(`🎲 Random favicon selected: ${selectedSet.name}`);

  // Function to update or create a favicon link
  function updateFavicon(selector, href, rel = 'icon', sizes = null, type = null) {
    // Remove existing favicon with this selector
    const existing = document.querySelector(selector);
    if (existing) {
      existing.remove();
    }

    // Create new favicon link
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    
    if (sizes) link.sizes = sizes;
    if (type) link.type = type;
    
    document.head.appendChild(link);
  }

  // Update all favicon elements
  try {
    // Standard favicons
    updateFavicon('link[rel="icon"][sizes="16x16"]', selectedSet.favicon16, 'icon', '16x16', 'image/png');
    updateFavicon('link[rel="icon"][sizes="32x32"]', selectedSet.favicon32, 'icon', '32x32', 'image/png');
    
    // Apple touch icon
    updateFavicon('link[rel="apple-touch-icon"]', selectedSet.appleTouchIcon, 'apple-touch-icon', '180x180');
    
    // Android chrome icons (these are referenced in the manifest)
    // We'll update the manifest dynamically
    updateManifestIcons(selectedSet);
    
    console.log(`✅ Favicon successfully updated to: ${selectedSet.name}`);
  } catch (error) {
    console.warn('⚠️ Error updating favicon:', error);
    // Fallback to default favicon
    updateFavicon('link[rel="icon"]', '/favicon.ico', 'icon');
  }
}

// Update the web app manifest with the selected icons
function updateManifestIcons(selectedSet) {
  try {
    // Create or update the manifest
    const manifestContent = {
      "name": "DreadScale",
      "short_name": "DreadScale",
      "icons": [
        {
          "src": selectedSet.android192,
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": selectedSet.android512,
          "sizes": "512x512",
          "type": "image/png"
        }
      ],
      "theme_color": "#dc2626",
      "background_color": "#111827",
      "display": "standalone",
      "start_url": "/",
      "description": "A movie rating platform focused on content analysis and detailed user ratings across multiple categories"
    };

    // Create a blob URL for the manifest
    const manifestBlob = new Blob([JSON.stringify(manifestContent, null, 2)], {
      type: 'application/json'
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    // Update or create manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    
    // Revoke old URL if it exists
    if (manifestLink.href && manifestLink.href.startsWith('blob:')) {
      URL.revokeObjectURL(manifestLink.href);
    }
    
    manifestLink.href = manifestUrl;
    
    console.log('📱 Manifest updated with new icons');
  } catch (error) {
    console.warn('⚠️ Error updating manifest:', error);
  }
}

// Export for debugging
export function getFaviconInfo() {
  const currentFavicons = {
    favicon16: document.querySelector('link[rel="icon"][sizes="16x16"]')?.href,
    favicon32: document.querySelector('link[rel="icon"][sizes="32x32"]')?.href,
    appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href,
    manifest: document.querySelector('link[rel="manifest"]')?.href
  };
  
  console.log('Current favicon configuration:', currentFavicons);
  return currentFavicons;
}

// Force refresh favicon (useful for testing)
export function refreshFavicon() {
  console.log('🔄 Refreshing favicon...');
  initializeRandomFavicon();
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.getFaviconInfo = getFaviconInfo;
  window.refreshFavicon = refreshFavicon;
}