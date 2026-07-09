# Облачная синхронизация (Firebase)

Чтобы галочки, хотелки и заметки были **одинаковы на телефоне и ПК**, нужен бесплатный Firebase (5 минут, один раз).

## 1. Создать проект

1. Откройте [console.firebase.google.com](https://console.firebase.google.com)
2. **Добавить проект** → имя `nashe-chudo` → Google Analytics можно отключить
3. После создания: **Build → Realtime Database → Create Database**
4. Регион: ближайший (например `europe-west1`)
5. **Start in test mode** (на шаге правил)

## 2. Правила доступа

В Realtime Database → **Rules** вставьте:

```json
{
  "rules": {
    "families": {
      "$familyId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Нажмите **Publish**.  
Для личного сайта семьи этого достаточно (путь скрыт длинным `familyId`).

## 3. Ключи в сайт

1. **Project settings** (шестерёнка) → **Your apps** → **Web** `</>`
2. Имя приложения: `nashe-chudo-web` → Register app
3. Скопируйте `firebaseConfig`
4. В файле `script.js` в блок `CONFIG.sync.firebase` вставьте свои значения:

```javascript
sync: {
  familyId: 'nashe_chudo_ira_pavel',
  firebase: {
    apiKey: '...',
    authDomain: '....firebaseapp.com',
    databaseURL: 'https://....firebasedatabase.app',
    projectId: '...',
    appId: '...'
  }
}
```

5. Закоммитьте и запушьте — деплой как обычно.

## 4. Проверка

- Откройте сайт на телефоне и ПК
- В **Настройках** должно быть: «Общая база работает»
- Поставьте галочку на телефоне — через 1–2 сек появится на ПК

## Если на телефоне уже есть данные

Сначала отметьте всё на телефоне (там актуальное), потом откройте ПК — он подтянет из облака.  
Либо на ПК: **Настройки → Синхронизировать сейчас** после первого открытия на телефоне.
