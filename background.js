// Background script для расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('Dynast IO Coin Tracker установлен');
});

// Обработка сообщений от content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'COINS_UPDATE') {
        // Сохраняем данные о монетах
        chrome.storage.local.set({
            coins: request.coins,
            timestamp: Date.now(),
            tabId: sender.tab.id
        });
        
        // Уведомляем popup если он открыт
        chrome.runtime.sendMessage({
            type: 'COINS_UPDATED',
            coins: request.coins
        }).catch(() => {
            // Popup не открыт, игнорируем ошибку
        });
    }
    
    sendResponse({success: true});
});

// Периодическая проверка активных вкладок с игрой
setInterval(() => {
    chrome.tabs.query({url: "https://dynast.io/*"}, (tabs) => {
        tabs.forEach(tab => {
            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func: () => {
                    // Проверяем localStorage на наличие данных о монетах
                    const coinData = localStorage.getItem('dynastio_coins');
                    if (coinData) {
                        const data = JSON.parse(coinData);
                        chrome.runtime.sendMessage({
                            type: 'COINS_UPDATE',
                            coins: data.coins,
                            timestamp: data.timestamp
                        });
                    }
                }
            }).catch(() => {
                // Вкладка может быть недоступна
            });
        });
    });
}, 5000);