// Saves options to chrome.storage
const saveOptions = () => {
  const color = document.getElementById('color').value;
  const likesColor = document.getElementById('like').checked;
  const option3 = document.getElementById('option3').checked;

  chrome.storage.sync.set(
    { favoriteColor: color, likesColor: likesColor, option3: option3 },
    () => {
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => { status.textContent = ''; }, 750);
    }
  );
};

const restoreOptions = () => {
  chrome.storage.sync.get(
    { favoriteColor: 'red', likesColor: true, option3: false },
    (items) => {
      document.getElementById('color').value = items.favoriteColor;
      document.getElementById('like').checked = items.likesColor;
      document.getElementById('option3').checked = items.option3;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
