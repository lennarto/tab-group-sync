// content_conditional.js
console.log("[MyExtCond] Content script loaded for URL:", window.location.href);

const BUTTON_ID = 'my-extension-conditional-button';

// This is where your actual script logic will go when the button is clicked
function runMyScriptConditional() {
  console.log("[MyExtCond] runMyScriptConditional: Button clicked!");
  alert("Conditional Button Script Ran! Implement your logic here.");
  //  ██████████████████████████████████████████████████████████████████
  //  █                                                              █
  //  █  >>>>>> PASTE OR CALL YOUR REAL SCRIPT LOGIC HERE <<<<<<      █
  //  █              (The one from your original idea)               █
  //  █                                                              █
  //  ██████████████████████████████████████████████████████████████████
}

// Function to create the button if it doesn't exist, or return existing one
function ensureButton() {
  let button = document.getElementById(BUTTON_ID);
  if (!button) {
    console.log("[MyExtCond] Creating conditional button.");
    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = 'Run Action'; // You can change the button text
    button.style.position = 'fixed';
    button.style.top = '70px'; // Position from top. Adjust if it overlaps important Notion UI.
    button.style.right = '20px'; // Position from right
    button.style.zIndex = '2147483646'; // Very high, but might need adjustment below Notion's own critical modals
    button.style.backgroundColor = '#007AFF'; // A nice blue
    button.style.color = 'white';
    button.style.padding = '10px 15px';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.boxShadow = '0px 2px 8px rgba(0,0,0,0.2)';
    button.style.display = 'none'; // IMPORTANT: Button is hidden initially

    button.addEventListener('click', runMyScriptConditional);
    document.body.appendChild(button);
    console.log("[MyExtCond] Conditional button appended to body (initially hidden).");
  }
  return button;
}

// This function checks the Notion DOM and decides if the button should be visible
function updateButtonVisibility() {
  const button = ensureButton(); // Creates the button if it's not already there
  if (!button) return;

  // --- !!! CRUCIAL: VERIFY AND REFINE THESE SELECTORS !!! ---
  // These selectors are educated guesses. You MUST verify them using Notion's Developer Tools.
  // See instructions below on how to do this.

  // Selector for when a page/DB entry is the main content (full page view)
  // We want .notion-page-content that is NOT inside a peek view.
  const FULL_PAGE_CONTENT_SELECTOR = '.notion-page-content:not(.notion-peek-renderer .notion-page-content)';

  // Selector for when a page/DB entry is open in a side panel/peek view
  // This looks for .notion-page-content inside what's typically a peek view container.
  const SIDE_PANEL_CONTENT_SELECTOR = '.notion-peek-renderer .notion-page-content';

  // You might also need to check for database entries that are open and might not always have .notion-page-content immediately.
  // Example: Check for any block content within a peek renderer.
  const SIDE_PANEL_DB_ENTRY_SELECTOR = '.notion-peek-renderer section[data-block-id]';


  const isFullPageContext = !!document.querySelector(FULL_PAGE_CONTENT_SELECTOR);
  const isSidePanelPageContext = !!document.querySelector(SIDE_PANEL_CONTENT_SELECTOR);
  const isSidePanelDBEntryContext = !!document.querySelector(SIDE_PANEL_DB_ENTRY_SELECTOR);

  // Log detected contexts for debugging
  if (isFullPageContext) console.log("[MyExtCond] Full page context detected.");
  if (isSidePanelPageContext) console.log("[MyExtCond] Side panel (page) context detected.");
  if (isSidePanelDBEntryContext) console.log("[MyExtCond] Side panel (DB entry) context detected.");


  if (isFullPageContext || isSidePanelPageContext || isSidePanelDBEntryContext) {
    if (button.style.display === 'none') {
      console.log("[MyExtCond] Context found. Showing button.");
      button.style.display = 'block';
    }
  } else {
    if (button.style.display !== 'none') {
      console.log("[MyExtCond] No active page/DB entry context found. Hiding button.");
      button.style.display = 'none';
    }
  }
}

// --- Initialization and MutationObserver ---
function initializeConditionalLogic() {
  console.log("[MyExtCond] Initializing conditional logic.");

  updateButtonVisibility(); // Initial check when the script loads

  // MutationObserver watches for changes in the DOM (e.g., opening/closing panels)
  const observer = new MutationObserver((mutationsList) => {
    // We don't need to inspect mutationsList in detail for this simple case.
    // Any significant DOM change *could* mean our context has changed.
    // Debounce or throttle this if it causes performance issues, but usually okay.
    // console.log("[MyExtCond] MutationObserver detected DOM change. Re-checking context."); // Can be very noisy, uncomment for deep debugging
    updateButtonVisibility();
  });

  // Observe the entire body for additions/removals of elements and changes in their subtrees.
  observer.observe(document.documentElement, { // Observe documentElement for broadest scope including body attributes if needed
    childList: true,
    subtree: true
  });

  console.log("[MyExtCond] MutationObserver is now observing for UI changes.");
}

// Run initialization logic once the basic DOM is ready.
// The MutationObserver will handle subsequent dynamic changes.
if (document.readyState === 'loading') {
  console.log("[MyExtCond] DOM is loading, adding DOMContentLoaded listener.");
  document.addEventListener('DOMContentLoaded', initializeConditionalLogic);
} else {
  console.log("[MyExtCond] DOM already loaded/interactive. Running initializeConditionalLogic.");
  initializeConditionalLogic();
}