// State variables
let bionicReadingActive = false;
let originalTextElements = new Map();
let bionicSettings = {
  boldIntensity: 0.5, // Default bold intensity (percentage as decimal)
  boldColor: "#4a6fa5", // Default bold color
};

// Handle messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "enableBionicReading":
      enableBionicReading();
      sendResponse({ success: true });
      break;

    case "disableBionicReading":
      disableBionicReading();
      sendResponse({ success: true });
      break;

    case "getBionicStatus":
      sendResponse({ isEnabled: bionicReadingActive });
      break;

    case "updateBionicSettings":
      if (request.settings) {
        bionicSettings = request.settings;

        // Update existing bionic text with new settings if active
        if (bionicReadingActive) {
          updateBionicStyles();
          refreshBionicText();
        }
      }
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Check if bionic reading should be active on page load
chrome.storage.local.get(["bionicEnabled", "bionicSettings"], (data) => {
  if (data.bionicSettings) {
    bionicSettings = data.bionicSettings;
  }

  // Auto-enable if the global setting is on
  if (data.bionicEnabled) {
    setTimeout(enableBionicReading, 500); // Slight delay to let page load fully
  }
});

// Create a style element for bionic reading
function createOrUpdateStyles() {
  let styleElement = document.getElementById("rapid-reader-styles");

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "rapid-reader-styles";
    document.head.appendChild(styleElement);
  }

  // Update styles with current settings
  styleElement.textContent = `
    .rapid-reader-bionic b {
      color: ${bionicSettings.boldColor};
      font-weight: 700;
    }
  `;
}

// Update bionic styles when settings change
function updateBionicStyles() {
  createOrUpdateStyles();
}

// Enable bionic reading on the page
function enableBionicReading() {
  if (bionicReadingActive) return;

  // Create/update styles first
  createOrUpdateStyles();

  // Process text elements
  const textElements = findTextElements();

  textElements.forEach((element) => {
    // Skip if already processed or should be skipped
    if (shouldSkipElement(element)) return;

    // Store original content if not already stored
    if (!originalTextElements.has(element)) {
      originalTextElements.set(element, element.innerHTML);
    }

    // Apply bionic reading
    bionicifyElement(element);
  });

  bionicReadingActive = true;
  showStatusMessage("Bionic reading enabled");

  // Save state for this page
  chrome.storage.local.set({
    pageState: {
      url: window.location.href,
      bionicActive: true,
    },
  });

  // Set up mutation observer to handle dynamic content
  setupMutationObserver();
}

// Apply bionic reading to an element
function bionicifyElement(element) {
  // Process text nodes only
  const textNodes = getTextNodes(element);
  textNodes.forEach((node) => {
    const parentNode = node.parentNode;

    // Skip if parent is already a bionic span or if text is just whitespace
    if (
      !parentNode ||
      parentNode.classList.contains("rapid-reader-bionic") ||
      !node.nodeValue.trim()
    ) {
      return;
    }

    // Create a span with processed text
    const bionicSpan = document.createElement("span");
    bionicSpan.className = "rapid-reader-bionic";
    bionicSpan.innerHTML = processTextForBionic(node.nodeValue);

    // Replace the text node with our bionic span
    parentNode.replaceChild(bionicSpan, node);
  });
}

// Refresh bionic text (used when settings change)
function refreshBionicText() {
  const bionicSpans = document.querySelectorAll(".rapid-reader-bionic");

  bionicSpans.forEach((span) => {
    // Get the text content without formatting
    const text = span.textContent;
    // Reprocess with new settings
    span.innerHTML = processTextForBionic(text);
  });
}

// Disable bionic reading and restore original content
function disableBionicReading() {
  if (!bionicReadingActive) return;

  // Restore original content
  originalTextElements.forEach((originalHTML, element) => {
    if (element && element.parentNode) {
      element.innerHTML = originalHTML;
    }
  });

  // Clear stored elements
  originalTextElements.clear();

  // Remove any remaining bionic spans
  const bionicSpans = document.querySelectorAll(".rapid-reader-bionic");
  bionicSpans.forEach((span) => {
    if (span.parentNode) {
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    }
  });

  // Disconnect mutation observer
  if (window.bionicMutationObserver) {
    window.bionicMutationObserver.disconnect();
  }

  bionicReadingActive = false;
  showStatusMessage("Bionic reading disabled");

  // Save state for this page
  chrome.storage.local.set({
    pageState: {
      url: window.location.href,
      bionicActive: false,
    },
  });
}

// Find all text elements on the page
function findTextElements() {
  // Focus on elements that typically contain reading content
  return document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, td, th, div > span:not(:empty), article, section, main"
  );
}

// Get text nodes inside an element
function getTextNodes(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    },
    false
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  return textNodes;
}

// Better element filtering to skip UI elements
function shouldSkipElement(element) {
  // Skip already processed elements
  if (element.classList.contains("rapid-reader-bionic")) return true;

  // Skip based on tag names that are unlikely to be main reading content
  const skipTags = [
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "CODE",
    "PRE",
    "TEXTAREA",
    "INPUT",
    "BUTTON",
    "IFRAME",
    "SVG",
    "IMG",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "FORM",
  ];
  if (skipTags.includes(element.tagName)) return true;

  // Skip elements without meaningful text content
  if (!element.textContent || element.textContent.trim().length < 3)
    return true;

  // Check if element or its parents have classes/ids suggesting UI elements
  let currentElement = element;
  for (let i = 0; i < 3 && currentElement; i++) {
    // Check up to 3 levels up
    const className = (currentElement.className || "").toLowerCase();
    const id = (currentElement.id || "").toLowerCase();

    // Skip UI-related elements
    const skipPatterns = [
      "nav",
      "menu",
      "button",
      "icon",
      "logo",
      "header",
      "footer",
      "sidebar",
      "comment",
      "widget",
      "banner",
      "ad",
      "popup",
      "toolbar",
      "search",
      "-menu",
      "dropdown",
      "tab",
      "cookie",
    ];

    if (
      skipPatterns.some(
        (pattern) => className.includes(pattern) || id.includes(pattern)
      )
    ) {
      return true;
    }

    currentElement = currentElement.parentElement;
  }

  return false;
}

// Process text for bionic reading
function processTextForBionic(text) {
  const words = text.split(/(\s+)/);
  let result = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.trim() === "") {
      result += word;
      continue;
    }
    result += applyBionicReading(word);
  }

  return result;
}

// Improved bionic reading algorithm that uses proper fixation points
function applyBionicReading(word) {
  // Remove non-alphanumeric characters for length calculation
  const cleanWord = word.replace(/[^a-zA-Z0-9']/g, "");
  const len = cleanWord.length;

  // Handle special cases
  if (len === 0) return word;
  if (len === 1) return `<b>${word}</b>`; // Bold single-letter words entirely

  // Calculate bold length based on word length and intensity
  let boldLength;

  // Improved bionic reading algorithm based on research:
  // - Short words (2-3): Bold the first 1-2 letters
  // - Medium words (4-7): Bold approximately 30-40% of the word
  // - Long words (8+): Bold approximately 25-35% of the word
  // This is adjusted by the user's boldIntensity setting

  if (len <= 3) {
    // Short words: 1-2 letters
    boldLength = Math.min(
      len,
      Math.max(1, Math.round(2 * bionicSettings.boldIntensity))
    );
  } else if (len <= 7) {
    // Medium words: 30-40% of letters
    boldLength = Math.max(
      2,
      Math.round(len * (0.3 + 0.1 * bionicSettings.boldIntensity))
    );
  } else {
    // Long words: 25-35% of letters
    boldLength = Math.max(
      2,
      Math.round(len * (0.25 + 0.1 * bionicSettings.boldIntensity))
    );
  }

  // Ensure we don't bold more than 60% of the word in any case
  boldLength = Math.min(boldLength, Math.ceil(len * 0.6));

  // Handle special punctuation at the beginning of words
  let leadingPunctuation = "";
  let actualWord = word;

  const punctMatch = word.match(/^([^\w]+)(.*)/);
  if (punctMatch) {
    leadingPunctuation = punctMatch[1];
    actualWord = punctMatch[2];
    // Adjust bold length considering only the actual word portion
    boldLength = Math.min(boldLength, actualWord.length);
  }

  const boldPart = actualWord.substring(0, boldLength);
  const restPart = actualWord.substring(boldLength);

  return leadingPunctuation + `<b>${boldPart}</b>${restPart}`;
}

// Setup mutation observer to handle dynamic content
function setupMutationObserver() {
  // Disconnect any existing observer
  if (window.bionicMutationObserver) {
    window.bionicMutationObserver.disconnect();
  }

  // Create new observer
  const observer = new MutationObserver((mutations) => {
    let newElements = [];

    mutations.forEach((mutation) => {
      // Handle added nodes
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Check if it's an element node
          if (node.nodeType === Node.ELEMENT_NODE) {
            // If it's a text container, add it to our processing list
            if (!shouldSkipElement(node)) {
              newElements.push(node);
            }

            // Also check children that might be text containers
            const childElements = node.querySelectorAll(
              "p, h1, h2, h3, h4, h5, h6, li, td, th, div > span:not(:empty), article, section"
            );
            childElements.forEach((el) => {
              if (!shouldSkipElement(el)) {
                newElements.push(el);
              }
            });
          }
        });
      }
    });

    // Batch process new elements (more efficient)
    if (newElements.length > 0) {
      newElements.forEach((element) => {
        if (!originalTextElements.has(element)) {
          originalTextElements.set(element, element.innerHTML);
        }
        bionicifyElement(element);
      });
    }
  });

  // Start observing with a more specific config
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false, // Don't need to track text changes
  });

  // Store observer reference
  window.bionicMutationObserver = observer;
}

// Show status message
function showStatusMessage(message) {
  const existingMessage = document.querySelector(".rapid-reader-status");
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create new message
  const statusElement = document.createElement("div");
  statusElement.className = "rapid-reader-status";
  statusElement.textContent = message;
  document.body.appendChild(statusElement);

  setTimeout(() => {
    statusElement.style.opacity = "0";
    setTimeout(() => {
      if (statusElement.parentNode) {
        statusElement.parentNode.removeChild(statusElement);
      }
    }, 300);
  }, 2000);
}
