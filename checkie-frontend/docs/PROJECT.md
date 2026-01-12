# Checkie Project Documentation

## Обзор проекта

Checkie — это платёжная платформа для приёма онлайн-платежей. Проект предоставляет инструменты для создания чекаутов, платёжных ссылок, подписок и интеграции с различными платёжными методами.

**Целевая аудитория:** E-commerce, создатели контента, фитнес-тренеры, малый и средний бизнес.

**Основной функционал:**
- Приём платежей через множество методов
- Создание платёжных страниц и ссылок
- Управление подписками
- Дашборд с аналитикой
- Управление командой и балансом

---

## Технологии

| Технология | Назначение |
|------------|------------|
| HTML/CSS/JS | Фронтенд |
| Webflow | Исходный конструктор |
| Checkie API | Авторизация (api.js + auth.js) |
| Jetboost | Поиск и фильтрация |
| Lottie | Анимации |
| OwlCarousel | Карусели |
| CounterUp | Анимация чисел |
| jQuery 3.6.0 | JavaScript библиотека |
| Netlify | Хостинг |

---

## Структура проекта

```
checkie-stage.webflow/
├── assets/
│   ├── css/           # Стили (3 файла, 352 KB)
│   ├── js/            # Скрипты (webflow.js)
│   ├── images/        # Изображения (279 файлов)
│   ├── fonts/         # Шрифты (22 файла — Gilroy, Impact)
│   ├── animations/    # Lottie JSON (9 файлов)
│   └── videos/        # Видео (24 файла)
├── pages/
│   ├── public/        # Публичные страницы (14)
│   ├── dashboard/     # Дашборд (5)
│   ├── onboarding/    # Онбординг (6)
│   ├── product/       # Продукты (9)
│   ├── solutions/     # Решения (2)
│   └── cms-templates/ # CMS шаблоны (28)
├── data/              # CSV данные (пусто)
├── docs/              # Документация
├── index.html         # Редирект на главную
└── netlify.toml       # Конфигурация Netlify
```

---

## Структура страниц

### Публичные (pages/public/)

| Страница | Файл | Описание |
|----------|------|----------|
| Главная | index.html | Лендинг с продуктами |
| Тарифы | pricing.html | Планы подписки |
| Вход | login.html | Авторизация |
| Регистрация | sign-up.html | Создание аккаунта |
| Сброс пароля | reset-password.html | Восстановление |
| Новый пароль | create-new-password.html | Смена пароля |
| Успех | success-password.html | Подтверждение |
| Способы оплаты | ways-to-pay.html | Платёжные методы |
| Приватность | privacy.html | Политика |
| Безопасность | legal-security.html | Юридическая информация |
| Coming Soon | coming-soon.html | Страница ожидания |
| Style Guide | style-guide.html | UI компоненты |
| 404 | 404.html | Страница не найдена |
| 401 | 401.html | Не авторизован |

### Дашборд (pages/dashboard/) — требует авторизации

| Страница | Файл | Описание |
|----------|------|----------|
| Главная | home.html | Обзор аккаунта |
| Баланс | balance.html | Управление балансом |
| Платежи | payments.html | История платежей |
| FAQ | faq.html | Частые вопросы |
| Помощь | help-center.html | Центр помощи |

### Онбординг (pages/onboarding/) — требует авторизации

| Страница | Файл | Описание |
|----------|------|----------|
| Добро пожаловать | welcome-page.html | Начало онбординга |
| Добавить бренд | add-your-brand.html | Настройка бренда |
| Настроить магазин | set-up-store.html | Конфигурация |
| Пригласить команду | invite-team-member.html | Приглашения |
| Тип чекаута | create-type.html | Выбор типа |
| Создать страницу | create-page.html | Создание чекаута |

### Продукты (pages/product/)

| Страница | Файл | Описание |
|----------|------|----------|
| AdPay | adpay.html | Рекламные платежи |
| Chat Checkout | chat-checkout.html | Оплата в чате |
| Checkout | checkout.html | Стандартный чекаут |
| Dashboard | dashboard.html | Про дашборд |
| Payment Button | payment-button.html | Кнопка оплаты |
| Payment Links | payment-links.html | Платёжные ссылки |
| Product Catalog | product-catalog.html | Каталог продуктов |
| Shop Builder | shop-builder.html | Конструктор магазина |
| Subscriptions | subscriptions.html | Подписки |

### Решения (pages/solutions/)

| Страница | Файл | Описание |
|----------|------|----------|
| Creators/Fitness | creators-health-fitness.html | Для тренеров |
| E-commerce | e-commerce-solution.html | Для магазинов |

### CMS шаблоны (pages/cms-templates/)

| Шаблон | Файл | Коллекция |
|--------|------|-----------|
| AdPay | detail_adpay-page.html | AdPay страницы |
| Balance | detail_balance-page.html | Страницы баланса |
| Balance Method | detail_balance-method.html | Методы пополнения |
| Customers | detail_customers-pages.html | Клиенты |
| FAQ | detail_faq.html | Вопросы |
| Pages Data | detail_pages-data.html | Данные страниц |
| Pages Overview | detail_pages-overview.html | Обзор страниц |
| Pages | detail_pages-page.html | Страницы |
| Payments | detail_payments-page.html | Платежи |
| Payment Method | detail_payment-method.html | Платёжные методы |
| Payment Method Location | detail_payment-method-location.html | Локации методов |
| Payment Method Use Case | detail_payment-method-use-case.html | Сценарии использования |
| Plan Collection | detail_plan-collection.html | Тарифные планы |
| Plan Benefits | detail_plan-benefits-items.html | Преимущества планов |
| Settings | detail_settings-page.html | Настройки |
| Subscriptions | detail_subscriptions-page.html | Подписки |
| Users | detail_users.html | Пользователи |
| User Data | detail_user-data.html | Данные пользователей |
| Widget | detail_widget-page.html | Виджеты |
| Widget Confirmation | detail_widget-confirmation.html | Подтверждения виджетов |
| Widget Custom Fields | detail_widget-custom-fields.html | Кастомные поля |
| Widget Files | detail_widget-files.html | Файлы виджетов |
| Widget Layouts | detail_widget-layouts.html | Макеты виджетов |
| Widget Payment Methods | detail_widget-payment-methods.html | Методы оплаты виджетов |
| CMS Slider Cases | detail_cms-slider-cases.html | Слайдер кейсов |
| Email Confirmation | detail_email-confirmation.html | Email подтверждения |
| Script | detail_script.html | Скрипты |
| Trusted Logos | detail_trusted-logos.html | Логотипы партнёров |

---

## CSS архитектура

| Файл | Назначение | Строк |
|------|------------|-------|
| normalize.css | Сброс стилей браузера | 355 |
| webflow.css | Базовые Webflow стили | 1,790 |
| checkie-stage.webflow.css | Основные стили проекта | 16,684 |

### CSS переменные (из checkie-stage.webflow.css)

```css
/* Основные цвета */
--background-color--background-primary: #333;
--background-color--background-secondary: #ee5a29;
--text-color-fonts-variants--text-primary: #333;
--text-color-fonts-variants--text-alternate: #f7f5f3;
--base-color-neutral--white: #fff;
--base-color-brand--blue: #2d62ff;
--base-color-brand--pink: #dd23bb;

/* Системные цвета */
--base-color-system--success-green: #cef5ca;
--base-color-system--warning-yellow: #fcf8d8;
--base-color-system--error-red: #f8e4e4;
--base-color-system--focus-state: #2d62ff;

/* Нейтральные */
--base-color-neutral--black: #000;
--base-color-neutral--neutral: #666;
--border-color--border-primary: #3333331a;
--border-color--border-gray: #e4e4e4;
```

---

## JavaScript

| Файл | Назначение |
|------|------------|
| assets/js/webflow.js | Webflow взаимодействия и анимации |

### Встроенные скрипты (в HTML)

1. **Noise Effect** — генерация статического шума на canvas для фонового эффекта
2. **OwlCarousel** — инициализация каруселей с кастомной навигацией
3. **CounterUp** — анимация чисел при скролле с IntersectionObserver

---

## Lottie анимации (assets/animations/)

| Файл | Продукт |
|------|---------|
| Product-Catalog.json | Каталог продуктов |
| Adpay.json | AdPay |
| Biolink.json | Bio Link |
| Chat-checkout.json | Chat Checkout |
| Checkout.json | Checkout |
| Dashboard.json | Dashboard |
| Pay-button.json | Кнопка оплаты |
| Store-Builder.json | Конструктор магазина |
| Subscriptions.json | Подписки |

---

## Интеграции

### Checkie API Auth
- **Скрипты:** `/assets/js/api.js`, `/assets/js/auth.js`
- **Атрибуты:** `data-auth="member"`, `data-auth="guest"`, `data-user="first-name"`, `data-user="email"`, `data-action="logout"`
- **Защищённые страницы:** dashboard/*, onboarding/*
- **Backend:** `https://checkie-production.up.railway.app/api`

### Jetboost
- **Site ID:** `cm7m23x7h00gx0kq63i2lgub2`
- **Скрипт:** `https://cdn.jetboost.io/jetboost.js`
- **Используется на:** Страницы с поиском/фильтрацией

### Google Fonts
- **Inter:** 100-900, italic (cyrillic, latin)
- **Plus Jakarta Sans:** 200-800 (cyrillic-ext, latin)

### CDN библиотеки
- jQuery 3.6.0
- OwlCarousel 2.3.4
- CounterUp 2.0.2
- WebFont Loader 1.6.26

---

## Дизайн-система

### Цветовая палитра

| Название | HEX | Использование |
|----------|-----|---------------|
| Primary Dark | #333 | Основной текст, фон |
| Secondary Orange | #ee5a29 | Акцентный цвет |
| Brand Blue | #2d62ff | Кнопки, ссылки, фокус |
| Brand Pink | #dd23bb | Акцент |
| White | #fff | Фоны |
| Light Orange | #ffe6c9 | Светлый акцент |
| Light Green | #e1f0da | Успех (светлый) |
| Light Blue | #deedf8 | Информация |
| Light Pink | #ffe6e6 | Акцент |
| Light Yellow | #fff7d4 | Предупреждение |
| Success Green | #cef5ca | Успешные действия |
| Error Red | #f8e4e4 | Ошибки |
| Warning Yellow | #fcf8d8 | Предупреждения |
| Gray | #595959 | Вторичный текст |
| Border | #e4e4e4 | Границы |

### Типографика

| Шрифт | Источник | Начертания | Использование |
|-------|----------|------------|---------------|
| Inter | Google Fonts | 100-900, italic | Основной текст |
| Plus Jakarta Sans | Google Fonts | 200-800 | Заголовки |
| Gilroy | Локальный | Thin-Black (20 вариантов) | Акценты |
| Impact | Локальный | Regular | Декоративный |

### Breakpoints

| Название | Ширина |
|----------|--------|
| Desktop | 1280px+ |
| Tablet | 991px |
| Mobile Landscape | 767px |
| Mobile Portrait | 479px |

### UI компоненты

- **Кнопки:** `.button`, `.button-primary`, `.button-secondary`
- **Карточки:** `.card`, `.card-pricing`
- **Формы:** `.form-input`, `.form-label`
- **Навигация:** `.navbar`, `.nav-link`
- **Модальные окна:** `.modal`, `.modal-overlay`
- **Уведомления:** `.alert`, `.alert-success`, `.alert-error`

---

## Netlify конфигурация

Файл `netlify.toml` содержит редиректы для чистых URL:

| URL | Файл |
|-----|------|
| `/` | `/pages/public/index.html` |
| `/pricing` | `/pages/public/pricing.html` |
| `/login` | `/pages/public/login.html` |
| `/dashboard` | `/pages/dashboard/home.html` |
| `/product/*` | `/pages/product/*.html` |
| `/*` (fallback) | `/pages/public/404.html` |

---

## Безопасность

- **Авторизация:** Checkie API (JWT tokens) управляет доступом к защищённым страницам
- **Атрибуты:** `data-auth="member"` для защищённого контента
- **Скрипты:** `/assets/js/auth.js` проверяет авторизацию и редиректит неавторизованных
- **Редиректы:** 401.html для неавторизованных пользователей

---

## Производительность

- **Шрифты:** Preconnect к Google Fonts
- **Изображения:** AVIF и WebP форматы
- **Видео:** Транскодированные версии (mp4, webm)
- **Lottie:** JSON анимации вместо GIF/видео
