document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const bionicToggle = document.getElementById("bionic-toggle");
  const statusMessage = document.getElementById("status-message");
  const boldIntensity = document.getElementById("bold-intensity");
  const intensityValue = document.getElementById("intensity-value");
  const boldColor = document.getElementById("bold-color");
  const applySettingsBtn = document.getElementById("apply-settings");

  loadPreferences();

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    if (document.body.classList.contains("dark-theme")) {
      themeIcon.textContent = "🌙";
      chrome.storage.local.set({ theme: "dark" });
    } else {
      themeIcon.textContent = "☀️";
      chrome.storage.local.set({ theme: "light" });
    }
  });

  bionicToggle.addEventListener("change", () => {
    const isEnabled = bionicToggle.checked;

    chrome.storage.local.set({ bionicEnabled: isEnabled });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: isEnabled ? "enableBionicReading" : "disableBionicReading",
      });
    });

    statusMessage.textContent = isEnabled
      ? "Bionic reading is enabled on this page"
      : "Bionic reading is disabled";
  });

  boldIntensity.addEventListener("input", () => {
    intensityValue.textContent = `${boldIntensity.value}%`;
  });

  applySettingsBtn.addEventListener("click", () => {
    const settings = {
      boldIntensity: parseInt(boldIntensity.value) / 100,
      boldColor: boldColor.value,
    };

    chrome.storage.local.set({ bionicSettings: settings });

    if (bionicToggle.checked) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateBionicSettings",
          settings: settings,
        });
      });
    }

    applySettingsBtn.textContent = "Settings Applied!";
    setTimeout(() => {
      applySettingsBtn.textContent = "Apply Settings";
    }, 1500);
  });

  function loadPreferences() {
    chrome.storage.local.get(
      ["theme", "bionicEnabled", "bionicSettings"],
      (data) => {
        if (data.theme === "dark") {
          document.body.classList.add("dark-theme");
          themeIcon.textContent = "🌙";
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "getBionicStatus" },
            (response) => {
              if (response && response.isEnabled) {
                bionicToggle.checked = true;
                statusMessage.textContent =
                  "Bionic reading is enabled on this page";
              } else {
                bionicToggle.checked = false;
                statusMessage.textContent = "Bionic reading is disabled";
              }
            }
          );
        });

        if (data.bionicSettings) {
          const settings = data.bionicSettings;
          boldIntensity.value = Math.round(settings.boldIntensity * 100);
          intensityValue.textContent = `${boldIntensity.value}%`;
          boldColor.value = settings.boldColor;
        }
      }
    );
  }
});
