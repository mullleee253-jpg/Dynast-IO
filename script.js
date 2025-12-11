// Реальное отслеживание монет
let coins = 0;
let lastCoins = 0;
const coinElement = document.getElementById('coinCount');

// Функция для извлечения монет из игры
function extractCoinsFromGame() {
    try {
        const gameFrame = document.querySelector('iframe');
        if (gameFrame && gameFrame.contentWindow) {
            // Попытка получить доступ к содержимому iframe
            const gameDocument = gameFrame.contentDocument || gameFrame.contentWindow.document;
            
            // Поиск элементов с монетами в различных возможных селекторах
            const coinSelectors = [
                '.coins', '.coin-count', '.money', '.currency',
                '[class*="coin"]', '[class*="money"]', '[id*="coin"]',
                '.ui-coins', '.player-coins', '.game-coins'
            ];
            
            for (let selector of coinSelectors) {
                const coinElement = gameDocument.querySelector(selector);
                if (coinElement) {
                    const coinText = coinElement.textContent || coinElement.innerText;
                    const coinMatch = coinText.match(/[\d,]+/);
                    if (coinMatch) {
                        return parseInt(coinMatch[0].replace(/,/g, ''));
                    }
                }
            }
        }
    } catch (error) {
        console.log('Не удалось получить доступ к iframe (CORS ограничения)');
    }
    return null;
}

// Альтернативный метод: отслеживание через localStorage игры
function trackCoinsFromStorage() {
    try {
        // Проверяем localStorage на наличие данных игры
        const gameData = localStorage.getItem('dynastio_data') || 
                        localStorage.getItem('dynast_coins') ||
                        localStorage.getItem('game_coins');
        
        if (gameData) {
            const data = JSON.parse(gameData);
            if (data.coins !== undefined) {
                return data.coins;
            }
        }
        
        // Проверяем все ключи localStorage на наличие монет
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('coin') || key.includes('money') || key.includes('dynast'))) {
                try {
                    const value = localStorage.getItem(key);
                    const parsed = JSON.parse(value);
                    if (parsed && typeof parsed.coins === 'number') {
                        return parsed.coins;
                    }
                } catch (e) {
                    // Если не JSON, проверяем как число
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        return numValue;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Ошибка при чтении localStorage:', error);
    }
    return null;
}

// Метод отслеживания через WebSocket (если игра использует)
let gameWebSocket = null;
function setupWebSocketTracking() {
    // Перехватываем создание WebSocket соединений
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        // Если это соединение с игровым сервером
        if (url.includes('dynast') || url.includes('io')) {
            gameWebSocket = ws;
            
            ws.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Ищем данные о монетах в сообщениях
                    if (data.coins !== undefined) {
                        updateCoinsDisplay(data.coins);
                    } else if (data.player && data.player.coins !== undefined) {
                        updateCoinsDisplay(data.player.coins);
                    } else if (data.money !== undefined) {
                        updateCoinsDisplay(data.money);
                    }
                } catch (e) {
                    // Сообщение не в JSON формате
                }
            });
        }
        
        return ws;
    };
}

// Обновление отображения монет
function updateCoinsDisplay(newCoins) {
    if (newCoins !== coins && newCoins !== null && newCoins !== undefined) {
        lastCoins = coins;
        coins = newCoins;
        
        // Анимация изменения
        coinElement.style.transform = 'scale(1.1)';
        coinElement.style.color = newCoins > lastCoins ? '#00ff00' : '#ff6b6b';
        coinElement.textContent = coins.toLocaleString();
        
        setTimeout(() => {
            coinElement.style.transform = 'scale(1)';
            coinElement.style.color = '#ffffff';
        }, 500);
        
        // Показываем изменение
        if (lastCoins > 0) {
            const change = newCoins - lastCoins;
            showCoinChange(change);
        }
    }
}

// Показ изменения монет
function showCoinChange(change) {
    const changeElement = document.createElement('div');
    changeElement.className = 'coin-change';
    changeElement.textContent = (change > 0 ? '+' : '') + change.toLocaleString();
    changeElement.style.cssText = `
        position: absolute;
        top: -30px;
        right: 0;
        color: ${change > 0 ? '#00ff00' : '#ff6b6b'};
        font-weight: bold;
        font-size: 1.2em;
        animation: coinChangeAnim 2s ease-out forwards;
        pointer-events: none;
        z-index: 1000;
    `;
    
    document.querySelector('.coins').style.position = 'relative';
    document.querySelector('.coins').appendChild(changeElement);
    
    setTimeout(() => {
        if (changeElement.parentNode) {
            changeElement.parentNode.removeChild(changeElement);
        }
    }, 2000);
}

// Слушаем сообщения от расширения браузера
window.addEventListener('message', function(event) {
    if (event.data.type === 'DYNAST_COINS_UPDATE') {
        updateCoinsDisplay(event.data.coins);
    }
});

// Основная функция отслеживания
function trackCoins() {
    // Метод 1: Попытка извлечь из iframe
    let detectedCoins = extractCoinsFromGame();
    
    // Метод 2: Проверка localStorage
    if (detectedCoins === null) {
        detectedCoins = trackCoinsFromStorage();
    }
    
    // Метод 3: Проверка данных от расширения
    if (detectedCoins === null) {
        const extensionData = localStorage.getItem('dynastio_coins');
        if (extensionData) {
            try {
                const data = JSON.parse(extensionData);
                const dataAge = Date.now() - data.timestamp;
                if (dataAge < 30000) { // Данные свежие
                    detectedCoins = data.coins;
                }
            } catch (e) {}
        }
    }
    
    // Обновляем отображение если найдены монеты
    if (detectedCoins !== null) {
        updateCoinsDisplay(detectedCoins);
    } else {
        // Показываем инструкции если монеты не найдены
        showTrackingInstructions();
    }
}

// Показ инструкций по настройке отслеживания
function showTrackingInstructions() {
    const instructionsElement = document.getElementById('tracking-instructions');
    if (!instructionsElement && coins === 0) {
        const instructions = document.createElement('div');
        instructions.id = 'tracking-instructions';
        instructions.innerHTML = `
            <div style="background: rgba(255, 193, 7, 0.2); border: 1px solid #ffc107; border-radius: 10px; padding: 15px; margin: 10px 0; color: #ffc107;">
                <h4>📋 Настройка отслеживания монет:</h4>
                <ol style="margin: 10px 0; padding-left: 20px;">
                    <li>Установите расширение браузера (файлы в папке)</li>
                    <li>Откройте dynast.io в новой вкладке</li>
                    <li>Начните играть - монеты будут отслеживаться автоматически</li>
                </ol>
                <p><strong>Альтернативно:</strong> Нажмите 🔄 для ручного обновления</p>
            </div>
        `;
        document.querySelector('.controls-panel').appendChild(instructions);
    }
}

// Запуск отслеживания
setInterval(trackCoins, 1000); // Проверяем каждую секунду

// Симуляция смены сервера
const servers = [
    'EU-West #1',
    'EU-East #2', 
    'US-West #3',
    'Asia #1',
    'RU-Moscow #1'
];

let currentServerIndex = 0;
const serverElement = document.getElementById('serverName');

function changeServer() {
    currentServerIndex = (currentServerIndex + 1) % servers.length;
    serverElement.textContent = servers[currentServerIndex];
    
    // Анимация смены сервера
    serverElement.style.opacity = '0.5';
    setTimeout(() => {
        serverElement.style.opacity = '1';
    }, 300);
}

// Смена сервера каждые 30 секунд (для демонстрации)
setInterval(changeServer, 30000);

// Добавление эффектов при наведении на клавиши
document.querySelectorAll('kbd').forEach(key => {
    key.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
        this.style.boxShadow = '0 4px 8px rgba(255, 215, 0, 0.3)';
    });
    
    key.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    });
});

// Добавление звукового эффекта при клике на монеты (опционально)
document.querySelector('.coins').addEventListener('click', function() {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 100);
    
    // Добавляем немного монет при клике
    coins += Math.floor(Math.random() * 50) + 10;
    coinElement.textContent = coins.toLocaleString();
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dynast IO Tab загружен!');
    
    // Устанавливаем начальное значение монет
    coinElement.textContent = '0';
    
    // Настраиваем отслеживание WebSocket
    setupWebSocketTracking();
    
    // Ждем загрузки iframe и начинаем отслеживание
    const gameFrame = document.querySelector('iframe');
    gameFrame.addEventListener('load', function() {
        console.log('Игра загружена, начинаем отслеживание монет...');
        
        // Даем игре время на инициализацию
        setTimeout(() => {
            trackCoins();
        }, 3000);
    });
    
    // Добавляем кнопку для ручного обновления
    const manualUpdateBtn = document.createElement('button');
    manualUpdateBtn.textContent = '🔄';
    manualUpdateBtn.title = 'Обновить монеты вручную';
    manualUpdateBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        color: white;
        cursor: pointer;
        margin-left: 10px;
        transition: all 0.3s ease;
    `;
    
    manualUpdateBtn.addEventListener('click', function() {
        this.style.transform = 'rotate(360deg)';
        trackCoins();
        setTimeout(() => {
            this.style.transform = 'rotate(0deg)';
        }, 500);
    });
    
    document.querySelector('.coins').appendChild(manualUpdateBtn);
});