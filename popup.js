// Popup script для отображения монет
document.addEventListener('DOMContentLoaded', function() {
    const coinsValue = document.getElementById('coinsValue');
    const status = document.getElementById('status');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Загружаем сохраненные данные
    function loadCoins() {
        chrome.storage.local.get(['coins', 'timestamp'], function(result) {
            if (result.coins !== undefined) {
                coinsValue.textContent = result.coins.toLocaleString();
                
                // Проверяем актуальность данных
                const now = Date.now();
                const dataAge = now - (result.timestamp || 0);
                
                if (dataAge < 30000) { // Данные свежие (менее 30 секунд)
                    status.textContent = 'Подключено';
                    status.className = 'status connected';
                } else {
                    status.textContent = 'Данные устарели';
                    status.className = 'status disconnected';
                }
            } else {
                status.textContent = 'Игра не найдена';
                status.className = 'status disconnected';
            }
        });
    }
    
    // Обновление данных
    function refreshData() {
        // Ищем активные вкладки с игрой
        chrome.tabs.query({url: "https://dynast.io/*"}, function(tabs) {
            if (tabs.length > 0) {
                // Выполняем скрипт для получения актуальных данных
                chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    func: () => {
                        // Проверяем localStorage
                        const coinData = localStorage.getItem('dynastio_coins');
                        if (coinData) {
                            const data = JSON.parse(coinData);
                            return data.coins;
                        }
                        
                        // Ищем в DOM
                        const selectors = [
                            '[class*="coin"]', '[class*="money"]', 
                            '.coins', '.currency', '.cash'
                        ];
                        
                        for (let selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                const match = element.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
                                if (match) {
                                    return parseInt(match[1].replace(/,/g, ''));
                                }
                            }
                        }
                        
                        return null;
                    }
                }, function(results) {
                    if (results && results[0] && results[0].result !== null) {
                        const coins = results[0].result;
                        chrome.storage.local.set({
                            coins: coins,
                            timestamp: Date.now()
                        });
                        loadCoins();
                    }
                });
                
                status.textContent = 'Обновление...';
            } else {
                status.textContent = 'Откройте dynast.io';
                status.className = 'status disconnected';
            }
        });
    }
    
    // Обработчики событий
    refreshBtn.addEventListener('click', refreshData);
    
    // Слушаем обновления от background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'COINS_UPDATED') {
            coinsValue.textContent = request.coins.toLocaleString();
            status.textContent = 'Подключено';
            status.className = 'status connected';
        }
    });
    
    // Загружаем данные при открытии
    loadCoins();
    
    // Автообновление каждые 5 секунд
    setInterval(loadCoins, 5000);
});