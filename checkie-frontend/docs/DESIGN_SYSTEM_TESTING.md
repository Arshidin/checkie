# Design System Testing Checklist

Чеклист для тестирования совместимости новой дизайн-системы.

## ⚠️ Важно

**Дизайн-система применяется ТОЛЬКО для Dashboard страниц.**

- ✅ Dashboard страницы должны использовать новую дизайн-систему
- ❌ Публичные, Onboarding, Product страницы НЕ должны использовать дизайн-систему

## Общая проверка

- [ ] Все страницы загружаются без ошибок в консоли
- [ ] Нет конфликтов CSS (проверить DevTools)
- [ ] Все CSS файлы загружаются в правильном порядке
- [ ] Нет 404 ошибок для CSS файлов

## Breakpoints

Проверить на всех breakpoints:

- [ ] Mobile Portrait (479px и меньше)
- [ ] Mobile Landscape (480px - 767px)
- [ ] Tablet (768px - 991px)
- [ ] Desktop (992px - 1279px)
- [ ] Large Desktop (1280px+)

### Проверка на каждом breakpoint:

- [ ] Типографика масштабируется корректно
- [ ] Spacing работает правильно
- [ ] Компоненты не ломаются
- [ ] Навигация работает
- [ ] Формы отображаются корректно

## Компоненты

### Кнопки

- [ ] Старые `.button` классы работают (через legacy-compat)
- [ ] Новые `.btn` классы работают
- [ ] Hover состояния работают
- [ ] Focus состояния работают (accessibility)
- [ ] Disabled состояния работают

### Формы

- [ ] Старые `.form_input` классы работают
- [ ] Новые `.form-input` классы работают
- [ ] Валидация отображается корректно
- [ ] Error состояния работают
- [ ] Select dropdowns работают
- [ ] Textarea работает

### Карточки

- [ ] Старые карточки не сломались
- [ ] Новые `.card` компоненты работают
- [ ] Card header/body/footer структура работает

### Алерты

- [ ] Старые алерты работают
- [ ] Новые `.alert` компоненты работают
- [ ] Все варианты (success, error, warning, info) отображаются

## Страницы для тестирования

### Dashboard Pages (✅ Должны использовать дизайн-систему)

Проверить, что дизайн-система загружается и работает:

- [ ] `/pages/dashboard/home.html` - Главная дашборда
  - [ ] CSS файлы дизайн-системы загружаются (DevTools → Network)
  - [ ] Компоненты Stripe Design System работают
  - [ ] Нет конфликтов со старыми стилями
  
- [ ] `/pages/dashboard/payments.html` - Платежи
- [ ] `/pages/dashboard/balance.html` - Баланс
- [ ] `/pages/dashboard/faq.html` - FAQ
- [ ] `/pages/dashboard/help-center.html` - Помощь

### Public Pages (❌ НЕ должны использовать дизайн-систему)

Проверить, что дизайн-система НЕ загружается:

- [ ] `/pages/public/index.html` - Главная страница
  - [ ] CSS файлы дизайн-системы НЕ загружаются
  - [ ] Используются только старые стили
  
- [ ] `/pages/public/login.html` - Вход
- [ ] `/pages/public/sign-up.html` - Регистрация
- [ ] `/pages/public/pricing.html` - Тарифы

### Onboarding Pages

- [ ] `/pages/onboarding/welcome-page.html`
- [ ] `/pages/onboarding/set-up-store.html`
- [ ] `/pages/onboarding/add-your-brand.html`
- [ ] `/pages/onboarding/invite-team-member.html`
- [ ] `/pages/onboarding/create-type.html`
- [ ] `/pages/onboarding/create-page.html`

### Product Pages

- [ ] `/pages/product/checkout.html`
- [ ] `/pages/product/payment-button.html`
- [ ] `/pages/product/subscriptions.html`

## CSS переменные

Проверить в DevTools, что все переменные определены:

- [ ] Цвета (--stripe-primary-*, --gray-*, --success-*, etc.)
- [ ] Типографика (--text-*, --font-*)
- [ ] Spacing (--space-*)
- [ ] Shadows (--shadow-*)
- [ ] Border radius (--radius-*)

## Legacy совместимость

- [ ] Старые CSS переменные маппятся на новые
- [ ] Старые классы продолжают работать
- [ ] Нет визуальных регрессий

## Производительность

- [ ] Время загрузки CSS не увеличилось значительно
- [ ] Нет дублирования стилей
- [ ] CSS файлы минифицируются (если используется)

## Accessibility

- [ ] Focus states видны (--shadow-focus-ring)
- [ ] Контрастность текста соответствует WCAG
- [ ] Keyboard navigation работает
- [ ] Screen readers работают корректно

## Браузеры

Проверить в:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Известные проблемы

Записать любые найденные проблемы:

1. 
2. 
3. 

## Результаты тестирования

- Дата тестирования: ___________
- Тестировал: ___________
- Общий статус: [ ] Pass [ ] Fail [ ] Partial

## Примечания
