import { chatService } from './lib/chat-supabase.js';
import { showNotification } from './utils/notifications.js';

export function initializeChat() {
  // Create chat interface HTML
  const createChatInterface = (movieId) => {
    const currentUser = window.auth?.getCurrentUser();
    
    return `
      <div class="chat-section">
        <div class="chat-header">
          <h3>💬 Movie Discussion</h3>
          <p class="chat-subtitle">Share your thoughts about this movie with other viewers</p>
        </div>
        
        <div class="chat-container">
          <div class="chat-messages" id="chatMessages-${movieId}">
            <div class="loading-messages">
              <div class="loading-spinner"></div>
              <p>Loading messages...</p>
            </div>
          </div>
          
          <div class="chat-input-container">
            <div class="chat-form">
              <div class="chat-user-info">
                ${currentUser ? `
                  <div class="chat-user-avatar" style="background: ${currentUser.avatar.color}">
                    ${currentUser.avatar.initials}
                  </div>
                  <span class="chat-username">${currentUser.firstName}</span>
                ` : `
                  <div class="chat-user-avatar anonymous">
                    👤
                  </div>
                  <span class="chat-username">Anonymous</span>
                `}
              </div>
              
              <div class="chat-input-group">
                <textarea 
                  id="chatInput-${movieId}" 
                  class="chat-input" 
                  placeholder="Share your thoughts about this movie..."
                  rows="2"
                  maxlength="500"></textarea>
                <button 
                  class="btn btn-primary chat-send-btn" 
                  id="chatSend-${movieId}"
                  data-movie-id="${movieId}">
                  <span class="btn-icon">📤</span>
                  Send
                </button>
              </div>
            </div>
            
            <div class="chat-info">
              <span class="chat-count" id="chatCount-${movieId}">0 comments</span>
              <span class="chat-notice">• Comments are stored in the database and visible to all users</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Render chat messages
  const renderChatMessages = (chats) => {
    if (chats.length === 0) {
      return `
        <div class="chat-empty">
          <div class="chat-empty-icon">💭</div>
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      `;
    }

    return chats.map(chat => `
      <div class="chat-message ${chat.isRegistered ? 'registered' : 'anonymous'}">
        <div class="chat-message-header">
          <div class="chat-message-avatar ${chat.isRegistered ? '' : 'anonymous'}">
            ${chat.isRegistered ? getAvatarInitials(chat.username) : '👤'}
          </div>
          <div class="chat-message-info">
            <span class="chat-message-username">${chat.username}</span>
            <span class="chat-message-time">${formatChatTime(chat.timestamp)}</span>
            ${chat.isRegistered ? '<span class="chat-verified">✓</span>' : ''}
          </div>
        </div>
        <div class="chat-message-content">
          ${escapeHtml(chat.message)}
        </div>
      </div>
    `).join('');
  };

  // Load and display chat messages for a movie
  const loadChatMessages = async (movieId) => {
    try {
      const chats = await chatService.getMovieChats(movieId);
      const chatContainer = document.getElementById(`chatMessages-${movieId}`);
      const chatCount = document.getElementById(`chatCount-${movieId}`);
      
      if (chatContainer) {
        chatContainer.innerHTML = renderChatMessages(chats);
        scrollToBottomOfChat(movieId);
      }
      
      if (chatCount) {
        chatCount.textContent = `${chats.length} ${chats.length === 1 ? 'comment' : 'comments'}`;
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      const chatContainer = document.getElementById(`chatMessages-${movieId}`);
      if (chatContainer) {
        const isNetworkError = error.message?.includes('connect') || error.message?.includes('fetch');
        chatContainer.innerHTML = `
          <div class="chat-empty">
            <div class="chat-empty-icon">${isNetworkError ? '🌐' : '⚠️'}</div>
            <p>${isNetworkError ? 'Unable to connect to chat service. Please check your connection.' : 'Error loading messages. Please try again later.'}</p>
            <button class="btn btn-secondary" onclick="window.location.reload()">Retry</button>
          </div>
        `;
      }
    }
  };

  // Initialize event listeners
  const initializeEventListeners = () => {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.chat-send-btn')) {
        handleSendMessage(e);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('chat-input')) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          // Ctrl+Enter or Cmd+Enter to send
          e.preventDefault();
          const movieId = e.target.id.split('-')[1];
          const sendBtn = document.getElementById(`chatSend-${movieId}`);
          if (sendBtn) {
            handleSendMessage({ target: sendBtn });
          }
        }
      }
    });

    // Auto-resize textarea
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('chat-input')) {
        autoResizeTextarea(e.target);
      }
    });
  };

  // Handle sending a message
  const handleSendMessage = async (e) => {
    const button = e.target.closest('.chat-send-btn');
    const movieId = button.dataset.movieId;
    const inputElement = document.getElementById(`chatInput-${movieId}`);
    const message = inputElement.value.trim();

    if (!message) {
      showNotification('Please enter a message', 'error');
      return;
    }

    if (message.length > 500) {
      showNotification('Message is too long (max 500 characters)', 'error');
      return;
    }

    // Disable button during sending
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '<div class="loading-spinner-small"></div>Sending...';

    try {
      // Get current user info
      const currentUser = window.auth?.getCurrentUser();
      const username = currentUser ? currentUser.firstName : null;

      // Get movie data for Supabase
      const movieData = extractMovieDataFromPage(movieId);

      // Add the message to Supabase
      await chatService.addChatMessage(movieId, message, username, movieData);

      // Clear input
      inputElement.value = '';
      autoResizeTextarea(inputElement);

      // Reload chat messages
      await loadChatMessages(movieId);

      // Show success notification
      showNotification('Message sent!', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Error sending message. Please try again.', 'error');
    } finally {
      // Re-enable button
      button.disabled = false;
      button.innerHTML = originalText;
    }
  };

  // Extract movie data from the current page
  const extractMovieDataFromPage = (movieId) => {
    const title = document.querySelector('.movie-title')?.textContent || 
                  document.querySelector('h1')?.textContent ||
                  document.querySelector('h2')?.textContent || 'Unknown Title';
    const poster = document.querySelector('.movie-poster img')?.src || 
                   document.querySelector('.movie-poster-large img')?.src || '';
    const overview = document.querySelector('.movie-overview p')?.textContent || 
                     document.querySelector('.movie-overview')?.textContent || '';
    
    return {
      id: parseInt(movieId),
      title: title,
      poster_path: poster.includes('image.tmdb.org') ? poster.split('/').pop() : null,
      overview: overview
    };
  };

  // Auto-resize textarea
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Scroll to bottom of chat
  const scrollToBottomOfChat = (movieId) => {
    const chatContainer = document.getElementById(`chatMessages-${movieId}`);
    if (chatContainer) {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    }
  };

  // Utility functions
  const getAvatarInitials = (name) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const formatChatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Initialize
  initializeEventListeners();

  // Load chat messages when interface is created
  const originalCreateChatInterface = createChatInterface;
  const enhancedCreateChatInterface = (movieId) => {
    const html = originalCreateChatInterface(movieId);
    // Load messages after a short delay to allow DOM to render
    setTimeout(() => loadChatMessages(movieId), 100);
    return html;
  };

  // Public API
  return {
    createChatInterface: enhancedCreateChatInterface,
    loadChatMessages
  };
}