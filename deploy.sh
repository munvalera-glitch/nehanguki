#!/bin/bash
# Скрипт для быстрой отправки изменений на сервер и перезапуска бота

echo "🚀 Начинаем деплой (отправку) на сервер..."

# 1. Синхронизируем файлы (без node_modules и git)
echo "📁 Копируем файлы..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'deploy.sh' /Users/macvalera/Documents/nehanguki/ macbookserver@192.168.219.115:"~/Documents/New\ project/nehanguki/"

# 2. Перезапускаем бота на сервере
echo "🔄 Перезапускаем бота через PM2..."
ssh macbookserver@192.168.219.115 'export PATH="/Users/macbookserver/.local/bin:$PATH" && cd ~/Documents/New\ project/nehanguki && npm install && npm run build && npx pm2 restart nehanguki'

echo "✅ Успешно! Бот обновлен и работает."
