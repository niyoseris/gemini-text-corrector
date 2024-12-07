// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'correctText',
    title: 'Correct with Gemini AI',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'correctText') {
    const selectedText = info.selectionText;
    correctText(selectedText, tab);
  }
});

async function correctText(text, tab) {
  try {
    // Get API key from storage
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = result.geminiApiKey;

    if (!apiKey) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: showError,
        args: ['Please set your Gemini AI API key in the extension popup']
      });
      return;
    }

    // Call Gemini AI API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Please correct the following text for grammar and style, maintaining its original meaning. Only return the corrected text without any explanations or additional text: "${text}"`
          }]
        }]
      })
    });

    if (!response.ok) {
      console.error('API Error:', await response.text());
      throw new Error('API request failed');
    }

    const data = await response.json();
    console.log('API Response:', data);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Unexpected API response format');
    }

    let correctedText = data.candidates[0].content.parts[0].text;
    // Remove any quotes that might be in the response
    correctedText = correctedText.replace(/^["']|["']$/g, '').trim();

    console.log('Corrected Text:', correctedText);

    // Show popup with corrected text
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: showCorrectionPopup,
      args: [correctedText]
    });
  } catch (error) {
    console.error('Error:', error);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: showError,
      args: ['Error correcting text. Please check your API key and try again.']
    });
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #f8d7da;
    color: #721c24;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 3000);
}

function showCorrectionPopup(correctedText) {
  // Remove existing popup if any
  const existingPopup = document.getElementById('gemini-correction-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'gemini-correction-popup';
  popup.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 300px;
    font-family: Arial, sans-serif;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  `;

  const title = document.createElement('div');
  title.textContent = 'Corrected Text';
  title.style.fontWeight = 'bold';

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    border: none;
    background: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 5px;
  `;
  closeButton.onclick = () => popup.remove();

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create text container
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    background: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  `;
  textContainer.textContent = correctedText;

  // Create copy button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy to Clipboard';
  copyButton.style.cssText = `
    background: #4285f4;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
  `;
  copyButton.onmouseover = () => copyButton.style.background = '#357abd';
  copyButton.onmouseout = () => copyButton.style.background = '#4285f4';
  copyButton.onclick = () => {
    navigator.clipboard.writeText(correctedText).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy to Clipboard';
      }, 2000);
    });
  };

  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(textContainer);
  popup.appendChild(copyButton);

  // Add popup to page
  document.body.appendChild(popup);
}
