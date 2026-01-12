# Checkie — Навигация по проекту

> Этот файл — карта проекта. Используй для быстрого поиска.

---

## Структура проекта

```
checkie-stage.webflow/
├── assets/
│   ├── css/              # Стили (3 файла)
│   ├── js/               # Скрипты (1 файл)
│   ├── images/           # Изображения (279)
│   ├── fonts/            # Шрифты (22)
│   ├── animations/       # Lottie JSON (9)
│   └── videos/           # Видео (24)
├── pages/
│   ├── public/           # Публичные (14)
│   ├── dashboard/        # Дашборд (5)
│   ├── onboarding/       # Онбординг (6)
│   ├── product/          # Продукты (9)
│   ├── solutions/        # Решения (2)
│   └── cms-templates/    # CMS шаблоны (28)
├── data/                 # CSV данные
├── docs/                 # Документация
├── index.html            # Редирект
└── netlify.toml          # Конфиг Netlify
```

---

## Публичные страницы

| Страница | Файл | URL |
|----------|------|-----|
| Главная | `pages/public/index.html` | `/` |
| Тарифы | `pages/public/pricing.html` | `/pricing` |
| Вход | `pages/public/login.html` | `/login` |
| Регистрация | `pages/public/sign-up.html` | `/sign-up` |
| Сброс пароля | `pages/public/reset-password.html` | `/reset-password` |
| Новый пароль | `pages/public/create-new-password.html` | `/create-new-password` |
| Успех | `pages/public/success-password.html` | `/success-password` |
| Способы оплаты | `pages/public/ways-to-pay.html` | `/ways-to-pay` |
| Приватность | `pages/public/privacy.html` | `/privacy` |
| Безопасность | `pages/public/legal-security.html` | `/legal-security` |
| Coming Soon | `pages/public/coming-soon.html` | `/coming-soon` |
| Style Guide | `pages/public/style-guide.html` | `/style-guide` |
| 404 | `pages/public/404.html` | (fallback) |
| 401 | `pages/public/401.html` | `/401` |

---

## Дашборд (требует авторизации)

| Страница | Файл | URL |
|----------|------|-----|
| Главная | `pages/dashboard/home.html` | `/dashboard` |
| Баланс | `pages/dashboard/balance.html` | `/dashboard/balance` |
| Платежи | `pages/dashboard/payments.html` | `/dashboard/payments` |
| FAQ | `pages/dashboard/faq.html` | `/dashboard/faq` |
| Помощь | `pages/dashboard/help-center.html` | `/dashboard/help-center` |

---

## Онбординг (требует авторизации)

| Страница | Файл | URL |
|----------|------|-----|
| Добро пожаловать | `pages/onboarding/welcome-page.html` | `/onboarding/welcome` |
| Добавить бренд | `pages/onboarding/add-your-brand.html` | `/onboarding/add-brand` |
| Настроить магазин | `pages/onboarding/set-up-store.html` | `/onboarding/set-up-store` |
| Пригласить команду | `pages/onboarding/invite-team-member.html` | `/onboarding/invite-team` |
| Тип чекаута | `pages/onboarding/create-type.html` | `/onboarding/create-type` |
| Создать страницу | `pages/onboarding/create-page.html` | `/onboarding/create-page` |

---

## Продукты

| Страница | Файл | URL |
|----------|------|-----|
| AdPay | `pages/product/adpay.html` | `/product/adpay` |
| Chat Checkout | `pages/product/chat-checkout.html` | `/product/chat-checkout` |
| Checkout | `pages/product/checkout.html` | `/product/checkout` |
| Dashboard | `pages/product/dashboard.html` | `/product/dashboard` |
| Payment Button | `pages/product/payment-button.html` | `/product/payment-button` |
| Payment Links | `pages/product/payment-links.html` | `/product/payment-links` |
| Product Catalog | `pages/product/product-catalog.html` | `/product/product-catalog` |
| Shop Builder | `pages/product/shop-builder.html` | `/product/shop-builder` |
| Subscriptions | `pages/product/subscriptions.html` | `/product/subscriptions` |

---

## Решения

| Страница | Файл | URL |
|----------|------|-----|
| Creators/Fitness | `pages/solutions/creators-health-fitness.html` | `/solutions/creators-health-fitness` |
| E-commerce | `pages/solutions/e-commerce-solution.html` | `/solutions/e-commerce-solution` |

---

## CMS шаблоны

| Шаблон | Файл |
|--------|------|
| AdPay Page | `pages/cms-templates/detail_adpay-page.html` |
| Balance Page | `pages/cms-templates/detail_balance-page.html` |
| Balance Method | `pages/cms-templates/detail_balance-method.html` |
| CMS Slider Cases | `pages/cms-templates/detail_cms-slider-cases.html` |
| Customers Pages | `pages/cms-templates/detail_customers-pages.html` |
| Email Confirmation | `pages/cms-templates/detail_email-confirmation.html` |
| FAQ | `pages/cms-templates/detail_faq.html` |
| Pages Data | `pages/cms-templates/detail_pages-data.html` |
| Pages Overview | `pages/cms-templates/detail_pages-overview.html` |
| Pages Page | `pages/cms-templates/detail_pages-page.html` |
| Payment Method | `pages/cms-templates/detail_payment-method.html` |
| Payment Method Location | `pages/cms-templates/detail_payment-method-location.html` |
| Payment Method Use Case | `pages/cms-templates/detail_payment-method-use-case.html` |
| Payments Page | `pages/cms-templates/detail_payments-page.html` |
| Plan Benefits Items | `pages/cms-templates/detail_plan-benefits-items.html` |
| Plan Collection | `pages/cms-templates/detail_plan-collection.html` |
| Script | `pages/cms-templates/detail_script.html` |
| Settings Page | `pages/cms-templates/detail_settings-page.html` |
| Subscriptions Page | `pages/cms-templates/detail_subscriptions-page.html` |
| Trusted Logos | `pages/cms-templates/detail_trusted-logos.html` |
| User Data | `pages/cms-templates/detail_user-data.html` |
| Users | `pages/cms-templates/detail_users.html` |
| Widget Page | `pages/cms-templates/detail_widget-page.html` |
| Widget Confirmation | `pages/cms-templates/detail_widget-confirmation.html` |
| Widget Custom Fields | `pages/cms-templates/detail_widget-custom-fields.html` |
| Widget Files | `pages/cms-templates/detail_widget-files.html` |
| Widget Layouts | `pages/cms-templates/detail_widget-layouts.html` |
| Widget Payment Methods | `pages/cms-templates/detail_widget-payment-methods.html` |

---

## Стили

| Файл | Описание | Строк |
|------|----------|-------|
| `assets/css/normalize.css` | Сброс стилей | 355 |
| `assets/css/webflow.css` | Webflow базовые | 1,790 |
| `assets/css/checkie-stage.webflow.css` | Основные стили | 16,684 |

---

## Скрипты

| Файл | Описание |
|------|----------|
| `assets/js/webflow.js` | Webflow взаимодействия |

### Встроенные скрипты (в HTML)
- Noise Effect (canvas шум)
- OwlCarousel (карусели)
- CounterUp (анимация чисел)

---

## Lottie анимации

| Файл | Продукт |
|------|---------|
| `assets/animations/Adpay.json` | AdPay |
| `assets/animations/Biolink.json` | Bio Link |
| `assets/animations/Chat-checkout.json` | Chat Checkout |
| `assets/animations/Checkout.json` | Checkout |
| `assets/animations/Dashboard.json` | Dashboard |
| `assets/animations/Pay-button.json` | Payment Button |
| `assets/animations/Product-Catalog.json` | Product Catalog |
| `assets/animations/Store-Builder.json` | Shop Builder |
| `assets/animations/Subscriptions.json` | Subscriptions |

---

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Auth System | Checkie API (api.js + auth.js) |
| Jetboost ID | `cm7m23x7h00gx0kq63i2lgub2` |
| Netlify Site | `checkiepay` |
| Backend API | `https://checkie-production.up.railway.app/api` |
| jQuery | 3.6.0 |
| OwlCarousel | 2.3.4 |

---

## Частые задачи

### Изменить глобальные стили
```
assets/css/checkie-stage.webflow.css
```

### Найти header/footer
Header и footer дублируются в каждом HTML. Используй поиск:
```bash
grep -r "navbar" pages/
grep -r "footer" pages/
```

### Добавить новую страницу
1. Скопировать шаблон из `pages/public/`
2. Обновить `<title>` и мета-теги
3. Исправить пути к assets (../../assets/...)
4. Добавить редирект в `netlify.toml`

### Изменить анимации
```
assets/animations/*.json
```
Открой в [Lottie Editor](https://edit.lottiefiles.com/)

### Обновить шрифты
Локальные шрифты: `assets/fonts/`
Google Fonts: изменить в `<head>` каждой страницы

### Проверить auth атрибуты
```bash
grep -r "data-auth=" pages/
grep -r "data-user=" pages/
grep -r "data-action=" pages/
```

### Деплой на Netlify
```bash
cd ~/Desktop/Checkie/checkie-stage.webflow
netlify deploy --prod
```

---

## Полезные ссылки

- [Jetboost Docs](https://www.jetboost.io/docs)
- [Lottie Files](https://lottiefiles.com/)
- [Netlify Docs](https://docs.netlify.com/)
- [Webflow University](https://university.webflow.com/)
