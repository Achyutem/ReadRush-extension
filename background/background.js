chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    theme: "light",
    bionicEnabled: false,
    bionicSettings: {
      boldIntensity: 0.5,
      boldColor: "#4a6fa5",
    },
  });

  console.log("ReadRush extension installed successfully");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.storage.local.get(["bionicEnabled"], (data) => {
      if (data.bionicEnabled) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: "enableBionicReading" });
        }, 1000);
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggleBionic",
    title: "Toggle Bionic Reading",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggleBionic") {
    chrome.tabs.sendMessage(
      tab.id,
      { action: "getBionicStatus" },
      (response) => {
        if (response && response.isEnabled) {
          chrome.tabs.sendMessage(tab.id, { action: "disableBionicReading" });
        } else {
          chrome.tabs.sendMessage(tab.id, { action: "enableBionicReading" });
        }
      }
    );
  }
});
