// 툴바의 확장 프로그램 아이콘을 클릭했을 때 실행됩니다.
chrome.action.onClicked.addListener((tab) => {
  // 현재 창(window)에서 사이드패널을 엽니다.
  chrome.sidePanel.open({ windowId: tab.windowId });
});