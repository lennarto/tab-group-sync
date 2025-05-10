// content.js

console.log("[MyExt] Content script loaded for URL:", window.location.href);

// --- Your Script Logic ---
function runMyScript() {
  console.log("[MyExt] runMyScript: Button clicked! Running the script...");
  //  ██████████████████████████████████████████████████████████████████
  //  █                                                              █
  //  █  >>>>>> PASTE OR CALL YOUR EXISTING SCRIPT LOGIC HERE <<<<<<  █
  //  █                                                              █
  //  ██████████████████████████████████████████████████████████████████
  alert("Your script has run!"); // Example action
}

// --- Button Creation and Placement ---
function addButtonToPage(site) {
  const buttonId = 'my-extension-button';
  if (document.getElementById(buttonId)) {
    console.log("[MyExt] addButtonToPage: Button already exists. Skipping.");
    return;
  }
  console.log(`[MyExt] addButtonToPage: Creating button for ${site}.`);

  const button = document.createElement('button');
  button.id = buttonId;
  button.textContent = 'Run My Script'; // Or any other text/icon
  button.classList.add('my-custom-button'); // For styling via styles.css

  button.addEventListener('click', runMyScript);

  let parentElement;
  // Default high z-index
  button.style.zIndex = '10000';

  if (site === 'notion') {
    parentElement = document.querySelector('.notion-page-content');
    if (parentElement) {
      console.log("[MyExt] Notion parent '.notion-page-content' confirmed in addButtonToPage.");
      // Ensure the parent can contain an absolutely positioned child
      if (window.getComputedStyle(parentElement).position === 'static') {
        parentElement.style.position = 'relative';
        console.log("[MyExt] Set '.notion-page-content' position to relative.");
      }
      button.style.position = 'absolute';
      button.style.top = '10px'; // Adjust as needed, considering padding
      button.style.right = '10px'; // Adjust as needed
    } else {
      console.error("[MyExt] ERROR: Notion parent '.notion-page-content' not found in addButtonToPage. Cannot append button.");
      return; // Stop if parent isn't found
    }
  } else if (site === 'jira') {
    parentElement = document.querySelector('#jira-issue-header-actions') ||
                    document.querySelector('[data-testid="issue-view-foundation-template-header"] header') ||
                    document.querySelector('header[role="banner"]'); // More general
    if (parentElement) {
        console.log("[MyExt] Jira parent found in addButtonToPage:", parentElement);
        if (window.getComputedStyle(parentElement).position === 'static') {
           parentElement.style.position = 'relative';
        }
        button.style.position = 'absolute';
        button.style.top = '10px'; // Adjust as needed
        button.style.right = '10px'; // Adjust as needed
    } else {
        console.warn("[MyExt] Jira specific parent not found, attempting to append to body (fixed position).");
        parentElement = document.body;
        button.style.position = 'fixed';
        button.style.top = '20px';
        button.style.right = '20px';
    }
  } else if (site === 'google_sheets') {
    parentElement = document.getElementById('docs-toolbar') ||
                    document.querySelector('.docs-titlebar-buttons');
    if (parentElement) {
        console.log("[MyExt] Google Sheets parent found in addButtonToPage:", parentElement);
        if (parentElement.id !== 'docs-toolbar' && window.getComputedStyle(parentElement).position === 'static') {
            parentElement.style.position = 'relative';
        }
        button.style.position = 'absolute';
        button.style.top = '5px';
        button.style.right = '5px';
        button.style.zIndex = '2000'; // Sheets UI can have high z-indexes
    } else {
        console.warn("[MyExt] Google Sheets specific parent not found, attempting to append to body (fixed position).");
        parentElement = document.body;
        button.style.position = 'fixed';
        button.style.top = '20px';
        button.style.right = '20px';
        button.style.zIndex = '2000';
    }
  } else {
    console.error(`[MyExt] Unknown site ('${site}') in addButtonToPage. Cannot determine parent.`);
    return;
  }

  if (parentElement) {
    parentElement.appendChild(button);
    console.log(`[MyExt] Button successfully appended to parent for ${site}. Parent:`, parentElement);
    // Log computed styles of the button AFTER appending it to the DOM
    setTimeout(() => { // Timeout to ensure styles are applied and computed
        if(document.getElementById(buttonId)){
            console.log("[MyExt] Button computed style after append:", window.getComputedStyle(button));
        } else {
            console.log("[MyExt] Button disappeared after trying to append?");
        }
    }, 100);
  } else {
    // This path should ideally not be reached if logic above is correct
    console.error(`[MyExt] CRITICAL: ParentElement is null for ${site} at append stage. Button not added.`);
  }
}

// --- Detect Site and Initialize ---
function initializeExtension() {
  console.log("[MyExt] Initializing extension for page:", window.location.href);

  // Function to attempt adding the button, potentially called by observer
  const attemptAddButtonForSite = (siteKey) => {
    console.log(`[MyExt] attemptAddButtonForSite called for ${siteKey}`);
    if (document.getElementById('my-extension-button')) {
        console.log("[MyExt] Button 'my-extension-button' already exists. Skipping add attempt.");
        return true; // Indicate button exists or was handled
    }

    let targetElementFound = false;
    if (siteKey === 'notion') {
      if (document.querySelector('.notion-page-content')) {
        console.log("[MyExt] Notion target '.notion-page-content' FOUND during attempt.");
        addButtonToPage('notion');
        targetElementFound = true;
      } else {
        console.log("[MyExt] Notion target '.notion-page-content' NOT found during attempt.");
      }
    } else if (siteKey === 'jira') {
      if (document.querySelector('#jira-issue-header-actions') || document.querySelector('[data-testid="issue-view-foundation-template-header"] header')) {
        console.log("[MyExt] Jira target element FOUND during attempt.");
        addButtonToPage('jira');
        targetElementFound = true;
      } else {
        console.log("[MyExt] Jira target element NOT found during attempt.");
      }
    } else if (siteKey === 'google_sheets') {
      if (document.getElementById('docs-toolbar')) {
        console.log("[MyExt] Google Sheets target element FOUND during attempt.");
        addButtonToPage('google_sheets');
        targetElementFound = true;
      } else {
        console.log("[MyExt] Google Sheets target element NOT found during attempt.");
      }
    }
    return targetElementFound;
  };

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  let siteKey = null;

  if (hostname.includes('notion.so') || hostname.includes('notion.site')) {
    siteKey = 'notion';
  } else if (hostname.includes('atlassian.net') && (pathname.includes('/jira/') || pathname.startsWith('/browse/'))) { // Broader Jira path matching
    siteKey = 'jira';
  } else if (hostname.includes('docs.google.com') && pathname.includes('/spreadsheets/')) {
    siteKey = 'google_sheets';
  }

  if (siteKey) {
    console.log(`[MyExt] Site identified as: ${siteKey}.`);
    // Initial attempt (in case element is already there)
    if (attemptAddButtonForSite(siteKey)) {
      console.log(`[MyExt] Button added on initial check for ${siteKey}.`);
      return;
    }

    console.log(`[MyExt] Initial attempt failed or element not ready for ${siteKey}. Setting up MutationObserver.`);
    const observer = new MutationObserver((mutationsList, obs) => {
      // No need to iterate mutationsList for this simple check, just try adding button
      if (attemptAddButtonForSite(siteKey)) {
        console.log(`[MyExt] Button added via MutationObserver for ${siteKey}. Disconnecting observer.`);
        obs.disconnect();
      } else {
        // console.log("[MyExt] MutationObserver fired, but target still not ready or button exists."); // Potentially noisy
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    console.log("[MyExt] MutationObserver is now observing documentElement for changes.");

  } else {
    console.log("[MyExt] Site not recognized for button addition based on hostname/pathname.");
  }
}

// --- Run Initialization Logic ---
// Ensure the script runs after the DOM is fully loaded for initial check,
// but rely on MutationObserver for SPAs.
if (document.readyState === 'loading') {
    console.log("[MyExt] DOM is in 'loading' state. Adding DOMContentLoaded listener.");
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    console.log("[MyExt] DOM is not 'loading' (current state: " + document.readyState + "). Running initializeExtension directly.");
    initializeExtension();
}