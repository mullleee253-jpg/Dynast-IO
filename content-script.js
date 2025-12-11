// Скрипт для извлечения данных из игры Dynast.IO
(function() {
    'use strict';
    
    let lastCoins = 0;
    let gameData = {};
    
    // Функция поиска монет в DOM
    function findCoinsInDOM() {
        const selectors = [
            // Общие селекторы для монет
            '[class*="coin"]', '[class*="money"]', '[class*="currency"]',
            '[id*="coin"]', '[id*="money"]', '[id*="currency"]',
            '.coins', '.money', '.currency', '.cash', '.gold',
            // Специфичные для .io игр
            '.ui-coins', '.player-coins', '.game-coins', '.hud-coins',
            '.stats-coins', '.resource-coins', '.inventory-coins'
        ];
        
        for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
                const text = element.textContent || element.innerText || '';
                const match = text.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
                if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
                    return parseInt(match[1].replace(/,/g, ''));
                }
            }
        }
        return null;
    }
    
    // Перехват WebSocket сообщений
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data);
                
                // Ищем монеты в различных форматах
                let coins = null;
                if (data.coins !== undefined) coins = data.coins;
                else if (data.money !== undefined) coins = data.money;
                else if (data.currency !== undefined) coins = data.currency;
                else if (data.player && data.player.coins !== undefined) coins = data.player.coins;
                else if (data.user && data.user.coins !== undefined) coins = data.user.coins;
                else if (data.stats && data.stats.coins !== undefined) coins = data.stats.coins;
                
                if (coins !== null && coins !== lastCoins) {
                    lastCoins = coins;
                    gameData.coins = coins;
                    
                    // Отправляем данные в popup/extension
                    window.postMessage({
                        type: 'DYNAST_COINS_UPDATE',
                        coins: coins,
                        timestamp: Date.now()
                    }, '*');
                    
                    // Сохраняем в localStorage для доступа из основной страницы
                    localStorage.setItem('dynastio_coins', JSON.stringify({
                        coins: coins,
                        timestamp: Date.now()
                    }));
                }
            } catch (e) {
                // Не JSON сообщение, игнорируем
            }
        });
        
        return ws;
    };
    
    // Перехват fetch запросов
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            // Клонируем ответ для анализа
            const clonedResponse = response.clone();
            
            if (response.url.includes('api') || response.url.includes('game')) {
                clonedResponse.json().then(data => {
                    if (data && data.coins !== undefined) {
                        gameData.coins = data.coins;
                        window.postMessage({
                            type: 'DYNAST_COINS_UPDATE',
                            coins: data.coins,
                            timestamp: Date.now()
                        }, '*');
                    }
                }).catch(() => {});
            }
            
            return response;
        });
    };
    
    // Периодическая проверка DOM
    function checkForCoins() {
        const coins = findCoinsInDOM();
        if (coins !== null && coins !== lastCoins) {
            lastCoins = coins;
            gameData.coins = coins;
            
            window.postMessage({
                type: 'DYNAST_COINS_UPDATE',
                coins: coins,
                timestamp: Date.now()
            }, '*');
            
            localStorage.setItem('dynastio_coins', JSON.stringify({
                coins: coins,
                timestamp: Date.now()
            }));
        }
    }
    
    // Запускаем проверку каждые 2 секунды
    setInterval(checkForCoins, 2000);
    
    // Проверяем при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkForCoins);
    } else {
        checkForCoins();
    }
    
    console.log('Dynast.IO Coin Tracker активирован');
})();