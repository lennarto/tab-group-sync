// content_simple_fixed.js
console.log("[MyExtSimple] Content script loaded for URL:", window.location.href);

function runMyScriptSimple() {
  console.log("[MyExtSimple] runMyScriptSimple: Button clicked!");
  alert("Simple Fixed Button Script Ran!");
}

function addFixedButton() {
  const buttonId = 'my-extension-simple-fixed-button';
  // Check if button already exists
  if (document.getElementById(buttonId)) {
    console.log("[MyExtSimple] Fixed button already exists. Re-styling just in case.");
    // Optionally re-style or ensure visibility if it somehow got hidden
    const existingButton = document.getElementById(buttonId);
    existingButton.style.display = 'block'; // Ensure it's visible
    return;
  }

  console.log("[MyExtSimple] Creating simple fixed button.");
  const button = document.createElement('button');
  button.id = buttonId;
  button.textContent = 'Fixed Test Button';
  button.style.position = 'fixed';
  button.style.top = '20px';
  button.style.right = '20px';
  button.style.zIndex = '2147483647'; // Should be on top of everything
  button.style.backgroundColor = 'red';
  button.style.color = 'white';
  button.style.padding = '15px';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '16px';
  button.style.boxShadow = '0px 0px 10px black';

  button.addEventListener('click', runMyScriptSimple);

  // Ensure body exists before appending
  if (document.body) {
    document.body.appendChild(button);
    console.log("[MyExtSimple] Simple fixed button appended to body.");
    // Log computed styles to verify after appending
    setTimeout(() => { // Allow browser a moment to compute styles
        if(document.getElementById(buttonId)){
            console.log("[MyExtSimple] Button computed style after append:", window.getComputedStyle(button));
        }
    }, 100);
  } else {
    console.error("[MyExtSimple] Document.body does not exist at time of appending!");
  }
}

// --- Initialization ---
function initializeSimple() {
    console.log("[MyExtSimple] Initializing simple fixed button logic.");
    // Check if the document is already interactive or complete
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log("[MyExtSimple] Document already interactive/complete. Adding button.");
        addFixedButton();
    } else {
        // Wait for DOMContentLoaded if still loading
        console.log("[MyExtSimple] Document still loading. Waiting for DOMContentLoaded.");
        document.addEventListener('DOMContentLoaded', () => {
            console.log("[MyExtSimple] DOMContentLoaded fired for simple fixed button.");
            addFixedButton();
        });
    }
}

initializeSimple();