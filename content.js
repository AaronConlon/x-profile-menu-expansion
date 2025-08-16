(() => {
  'use strict';

  // Storage keys
  const STORAGE_KEYS = {
    modalWidth: 'modalWidth',
    modalHeight: 'modalHeight'
  };

  // Default dimensions
  const DEFAULT_DIMENSIONS = {
    width: 600,
    height: 820
  };

  // State
  let currentTarget = null;
  let hoverTimeout = null;
  let currentSection = 'posts';
  let currentSectionIndex = 0;
  let currentIframeUrl = null; // Track current iframe URL to avoid unnecessary reloads
  let isResizing = false;
  let justResized = false;
  let mousePos = { x: 0, y: 0 };
  let modalDimensions = { ...DEFAULT_DIMENSIONS };
  let lastClickedSection = null; // Track last clicked menu item
  
  // Global hidden variable to track modal creation - encoded as window property
  window.__xProfileExtensionModalCreated = false;

  const menuItems = ['posts', 'replies', 'highlights', 'articles', 'media', 'likes'];

  // Create shadow DOM container
  const shadowHost = document.createElement('div');
  shadowHost.id = 'x-profile-menu-extension';
  document.body.appendChild(shadowHost);

  const shadow = shadowHost.attachShadow({ mode: 'closed' });

  // Load external CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles.css');

  shadow.appendChild(link);

  // Load saved dimensions
  async function loadDimensions() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.modalWidth, STORAGE_KEYS.modalHeight]);
      modalDimensions.width = result[STORAGE_KEYS.modalWidth] || DEFAULT_DIMENSIONS.width;
      modalDimensions.height = result[STORAGE_KEYS.modalHeight] || DEFAULT_DIMENSIONS.height;
    } catch (error) {
      // Fallback to default dimensions
      modalDimensions.width = DEFAULT_DIMENSIONS.width;
      modalDimensions.height = DEFAULT_DIMENSIONS.height;
    }
  }

  // Save dimensions
  async function saveDimensions() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.modalWidth]: modalDimensions.width,
        [STORAGE_KEYS.modalHeight]: modalDimensions.height
      });
    } catch (error) {
    }
  }

  // Track mouse position for menu positioning
  let lastMousePos = { x: 0, y: 0 };
  document.addEventListener('mousemove', (e) => {
    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;
  });

  // Create menu element
  const menu = document.createElement('div');
  menu.className = 'profile-hover-menu';

  menuItems.forEach((item, index) => {
    const menuItem = document.createElement('a');
    menuItem.className = 'menu-item';
    menuItem.textContent = item;
    menuItem.href = '#';
    menuItem.dataset.section = item;
    menuItem.dataset.index = index;

    // Left click - open link in current window
    menuItem.addEventListener('click', (e) => {
      if (e.button === 0) { // Left click
        e.preventDefault();
        const url = buildUrl(item);
        
        // Check if current URL matches target URL to prevent unnecessary refresh
        if (window.location.href !== url) {
          window.location.href = url;
        }
        hideMenu();
      }
    });
    
    // Right click - show modal (old left click behavior)
    menuItem.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      
      // Create modal if it doesn't exist
      if (!modalOverlay) {
        createModal();
      }
      
      // Check if clicking the same item and modal is already visible
      const isVisible = modalOverlay.style.getPropertyValue('--modal-visibility') === 'visible';
      const isSameSection = lastClickedSection === item;
      
      if (isVisible && isSameSection) {
        // Same item clicked while modal is visible - toggle hide
        hideModal();
      } else {
        // Different item or modal is hidden - show modal with this item
        await showModal(item);
      }
      
      hideMenu();
    });

    menuItem.addEventListener('mouseenter', () => {
      // Disable hover if modal was ever created
      if (window.__xProfileExtensionModalCreated) {
        return;
      }
      
      // Only preload URL if modal exists (no longer create modal on hover)
      if (modalOverlay) {
        const url = buildUrl(item);
        if (iframe && currentIframeUrl !== url) {
          iframe.src = url;
          currentIframeUrl = url;
        }
      }
    });

    menu.appendChild(menuItem);
  });

  shadow.appendChild(menu);

  // Create floating debug button
  const debugButton = document.createElement('button');
  debugButton.className = 'debug-toggle-button';
  
  // Create X/Twitter SVG icon
  debugButton.innerHTML = `
    <svg class="debug-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  `;
  
  debugButton.title = 'Toggle Modal Debug';
  debugButton.style.display = 'none'; // Hide until modal is created
  shadow.appendChild(debugButton);

  // Add debug button click handler
  debugButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Create modal if it doesn't exist
    if (!modalOverlay) {
      createModal();
      // Set a default URL for testing
      if (iframe) {
        const testUrl = buildUrl('posts');
        iframe.src = testUrl;
        currentIframeUrl = testUrl;
      }
    }
    
    // Pure toggle - debug button ignores lastClickedSection logic
    const isVisible = modalOverlay.style.getPropertyValue('--modal-visibility') === 'visible';
    if (isVisible) {
      // Simply hide without affecting lastClickedSection
      modalOverlay.style.setProperty('--modal-visibility', 'hidden');
      document.body.style.overflow = '';
    } else {
      // Show modal without changing iframe URL if it already exists
      // Load latest dimensions and apply
      await loadDimensions();
      if (modalContainer) {
        modalContainer.style.width = `${modalDimensions.width}px`;
        modalContainer.style.height = `${modalDimensions.height}px`;
        modalContainer.style.setProperty('--modal-width', `${modalDimensions.width}px`);
        modalContainer.style.setProperty('--modal-height', `${modalDimensions.height}px`);
      }
      
      // Show modal
      modalOverlay.style.setProperty('--modal-visibility', 'visible');
      document.body.style.overflow = 'hidden';
      
      // Only set iframe URL if it doesn't have one yet
      if (iframe && !currentIframeUrl) {
        const testUrl = buildUrl('posts');
        iframe.src = testUrl;
        currentIframeUrl = testUrl;
        currentSection = 'posts';
        currentSectionIndex = 0;
      }
    }
  });

  // Modal elements will be created on first hover
  let modalOverlay = null;
  let modalContainer = null;
  let modalContent = null;
  let iframe = null;
  let resizeHandle = null;

  // Create modal elements on first use
  function createModal() {
    if (modalOverlay) return; // Already created
    
    // Set global flag to indicate modal was created
    window.__xProfileExtensionModalCreated = true;
    
    // Show debug button now that modal is created
    debugButton.style.display = 'flex';

    modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';

    modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    iframe = document.createElement('iframe');
    iframe.className = 'modal-iframe';
    iframe.allow = 'fullscreen';
    iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-presentation';
    
    // Add message listener for iframe communication
    window.addEventListener('message', (event) => {
      // Only handle messages from our iframe
      if (event.source !== iframe.contentWindow) return;
      
      
      if (event.data && event.data.source === 'x-profile-extension-iframe') {
        if (event.data.type === 'IFRAME_READY') {
        } else if (event.data.type === 'FULLSCREEN_REQUEST') {
          // Limit fullscreen to modal container bounds
          event.preventDefault();
          // Try to make modal content fullscreen instead of individual video
          try {
            if (modalContent.requestFullscreen) {
              modalContent.requestFullscreen();
            }
          } catch (error) {
          }
        }
      }
    });
    
    // Listen for iframe load to enable media control
    iframe.addEventListener('load', () => {
    });

    resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

    modalContent.appendChild(iframe);
    modalContent.appendChild(resizeHandle);
    modalContainer.appendChild(modalContent);
    modalOverlay.appendChild(modalContainer);
    shadow.appendChild(modalOverlay);

    // Setup resize functionality
    setupResize();

    // Setup overlay click to hide modal
    setupOverlayClick();

    // Apply saved dimensions immediately when modal is created
    modalContainer.style.width = `${modalDimensions.width}px`;
    modalContainer.style.height = `${modalDimensions.height}px`;
    modalContainer.style.setProperty('--modal-width', `${modalDimensions.width}px`);
    modalContainer.style.setProperty('--modal-height', `${modalDimensions.height}px`);
    
    // Initially hidden
    modalOverlay.style.setProperty('--modal-visibility', 'hidden');
  }

  // Pause iframe media using Chrome extension APIs
  function pauseIframeMedia() {
    if (!iframe) return;
    
    try {
      // Try direct iframe document access first
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc) {
          const videos = iframeDoc.querySelectorAll('video');
          const audios = iframeDoc.querySelectorAll('audio');
          
          videos.forEach(video => {
            if (!video.paused) {
              video.pause();
            }
          });
          
          audios.forEach(audio => {
            if (!audio.paused) {
              audio.pause();
            }
          });
        }
      } catch (crossOriginError) {
        // If cross-origin blocked, try message passing as last resort
        try {
          iframe.contentWindow.postMessage({
            type: 'PAUSE_ALL_MEDIA',
            source: 'x-profile-extension'
          }, '*');
        } catch (messageError) {
          // Silent fail
        }
      }
    } catch (error) {
      // Silent fail
    }
  }

  // Pause/mute page media when opening modal
  function pausePageMedia() {
    try {
      // Pause all video elements
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (!video.paused) {
          video.pause();
          // Mark video as paused by extension for potential restoration
          video.dataset.pausedByExtension = 'true';
        }
      });

      // Pause all audio elements
      const audios = document.querySelectorAll('audio');
      audios.forEach(audio => {
        if (!audio.paused) {
          audio.pause();
          // Mark audio as paused by extension for potential restoration
          audio.dataset.pausedByExtension = 'true';
        }
      });

      // Try to pause Twitter's video player (specific to X.com)
      const twitterVideos = document.querySelectorAll('[data-testid="videoPlayer"] video, [aria-label*="video"] video');
      twitterVideos.forEach(video => {
        if (!video.paused) {
          video.pause();
          video.dataset.pausedByExtension = 'true';
        }
      });

      // Try to mute any Web Audio API contexts (more advanced)
      if (window.AudioContext || window.webkitAudioContext) {
        // Store reference to potentially restore later
        if (!window.extensionAudioContexts) {
          window.extensionAudioContexts = [];
        }
      }
    } catch (error) {
    }
  }

  // Build URL for section
  function buildUrl(section) {
    const username = document.querySelector('nav[role="navigation"] a[aria-label="Profile"]').getAttribute('href').replace('/', '');
    if (!username) {
      alert('No username found');
      return null;
    }
    let url = `https://x.com/${username}`;

    switch (section) {
      case 'replies':
        url += '/with_replies';
        break;
      case 'highlights':
        url += '/highlights';
        break;
      case 'articles':
        url += '/articles';
        break;
      case 'media':
        url += '/media';
        break;
      case 'likes':
        url += '/likes';
        break;
      default:
        // posts - use base URL
        break;
    }

    // Add extension control parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('x_ext_modal', 'true');
    urlObj.searchParams.set('x_ext_fullscreen_limit', 'true');
    
    return urlObj.toString();
  }


  // Navigation functions
  function navigatePrevious() {
    const newIndex = (currentSectionIndex - 1 + menuItems.length) % menuItems.length;
    const newSection = menuItems[newIndex];
    switchToSection(newSection, newIndex);
  }

  function navigateNext() {
    const newIndex = (currentSectionIndex + 1) % menuItems.length;
    const newSection = menuItems[newIndex];
    switchToSection(newSection, newIndex);
  }

  function switchToSection(section, index) {
    currentSection = section;
    currentSectionIndex = index;

    const url = buildUrl(section);
    if (iframe && currentIframeUrl !== url) {
      iframe.src = url;
      currentIframeUrl = url;
    }
  }

  function showMenu(target, e = null) {
    currentTarget = target;

    // Use mouse event coordinates or last known mouse position
    const posX = e ? e.clientX : lastMousePos.x;
    const posY = e ? e.clientY : lastMousePos.y;

    // Position menu to the right of mouse, and up 50% to center it
    menu.style.left = `${posX + 10}px`;
    menu.style.top = `${posY}px`;

    // Adjust position after menu is rendered to get actual dimensions
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();

      // Move menu up by 50% of its height to center it vertically with mouse
      const centeredY = posY - (menuRect.height / 2);
      menu.style.top = `${centeredY}px`;

      // Adjust horizontal position if menu would go off-screen
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${posX - menuRect.width - 10}px`;
      }

      // Adjust vertical position if menu would go off-screen
      const finalMenuRect = menu.getBoundingClientRect();
      if (finalMenuRect.top < 0) {
        menu.style.top = '10px';
      } else if (finalMenuRect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
      }
    }, 0);

    menu.classList.add('show');

    // Modal will only be created when user right-clicks a menu item
  }

  function hideMenu() {
    menu.classList.remove('show');
    currentTarget = null;

    // Note: We keep the modal and iframe intact for faster reopening
  }

  async function showModal(section) {
    // Check if modal already exists
    const modalExists = !!modalOverlay;
    
    // Check if we're switching to a different section
    const isSectionChange = currentSection !== section;

    // Ensure modal is created
    createModal();

    // Only pause media on first creation or when switching sections
    if (!modalExists || isSectionChange) {
      // Pause/mute any playing audio or video on the page
      pausePageMedia();
    }

    // Load latest dimensions from storage and apply
    await loadDimensions();
    if (modalContainer) {
      modalContainer.style.width = `${modalDimensions.width}px`;
      modalContainer.style.height = `${modalDimensions.height}px`;
      modalContainer.style.setProperty('--modal-width', `${modalDimensions.width}px`);
      modalContainer.style.setProperty('--modal-height', `${modalDimensions.height}px`);
    }

    // Show modal immediately
    if (modalOverlay) {
      modalOverlay.style.setProperty('--modal-visibility', 'visible');
    }

    // Only set iframe URL if it's different from current (before updating currentSection)
    const url = buildUrl(section);
    if (iframe && currentIframeUrl !== url) {
      iframe.src = url;
      currentIframeUrl = url;
    }

    // Update current section after URL check
    currentSection = section;
    currentSectionIndex = menuItems.indexOf(section);
    lastClickedSection = section; // Remember the section being shown

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  function hideModal() {
    if (!modalOverlay) return;

    // Save current dimensions before hiding
    if (modalContainer) {
      modalDimensions.width = modalContainer.offsetWidth;
      modalDimensions.height = modalContainer.offsetHeight;
      saveDimensions();
    }

    // Pause iframe media before hiding
    pauseIframeMedia();

    // Simply hide the modal using CSS variable
    modalOverlay.style.setProperty('--modal-visibility', 'hidden');

    // Restore body scroll
    document.body.style.overflow = '';

    // Clear last clicked section so next click will show modal
    lastClickedSection = null;

    // Note: We keep iframe.src and all state intact for instant reopening
  }

  // Setup overlay click functionality
  function setupOverlayClick() {
    modalOverlay.addEventListener('click', (e) => {
      // Only hide modal if clicking directly on overlay, not on container or resize handle
      if (e.target === modalOverlay && !justResized && !isResizing) {
        // Pause iframe media before hiding
        pauseIframeMedia();
        hideModal();
      }
    });
    
    // Prevent modal container clicks from bubbling up to overlay
    modalContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Setup resize functionality
  function setupResize() {
    // Prevent resize handle clicks from bubbling up
    resizeHandle.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = modalContainer.offsetWidth;
      const startHeight = modalContainer.offsetHeight;

      function handleMouseMove(e) {
        if (!isResizing) return;
        e.preventDefault();

        const newWidth = Math.max(DEFAULT_DIMENSIONS.width, startWidth + (e.clientX - startX));
        const newHeight = Math.max(DEFAULT_DIMENSIONS.height, startHeight + (e.clientY - startY));

        modalDimensions.width = newWidth;
        modalDimensions.height = newHeight;

        modalContainer.style.width = `${newWidth}px`;
        modalContainer.style.height = `${newHeight}px`;
        modalContainer.style.setProperty('--modal-width', `${newWidth}px`);
        modalContainer.style.setProperty('--modal-height', `${newHeight}px`);
      }

      function handleMouseUp(e) {
        if (!isResizing) return;
        e.preventDefault();
        isResizing = false;
        justResized = true;
        
        // Save the new dimensions
        saveDimensions();
        
        // Clear justResized flag after a delay
        setTimeout(() => {
          justResized = false;
        }, 100);
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.style.getPropertyValue('--modal-visibility') === 'visible') {
      hideModal();
    }
  });

  // Arrow key navigation in modal
  document.addEventListener('keydown', (e) => {
    if (!modalOverlay || modalOverlay.style.getPropertyValue('--modal-visibility') !== 'visible') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigatePrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateNext();
    }
  });

  // Find and attach to profile links
  function attachToProfileLinks() {
    const profileLinks = document.querySelectorAll('header>nav[role="navigation"]>a[aria-label="Profile"][role="link"]');

    profileLinks.forEach(link => {
      if (link.dataset.menuAttached) return;
      link.dataset.menuAttached = 'true';

      link.addEventListener('mouseenter', (e) => {
        // Disable hover if modal was ever created
        if (window.__xProfileExtensionModalCreated) {
          return;
        }
        
        clearTimeout(hoverTimeout);
        showMenu(link, e);
      });

      link.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(hideMenu, 300);
      });
    });

    // Keep menu open when hovering over it
    menu.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
    });

    menu.addEventListener('mouseleave', () => {
      hideMenu();
    });
  }

  // Initialize
  loadDimensions().then(() => {
    // Initial attachment
    attachToProfileLinks();

    // Observe for new profile links (dynamic loading)
    const observer = new MutationObserver(() => {
      attachToProfileLinks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  });
})();