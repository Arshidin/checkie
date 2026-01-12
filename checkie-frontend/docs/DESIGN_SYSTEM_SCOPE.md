# Область применения Design System

## ⚠️ Важно

**Stripe Design System применяется ТОЛЬКО для Dashboard страниц.**

## Текущий статус

### ✅ Используют Design System

- `pages/dashboard/home.html`
- `pages/dashboard/payments.html`
- `pages/dashboard/balance.html`
- `pages/dashboard/faq.html`
- `pages/dashboard/help-center.html`

**Всего: 5 страниц**

### ❌ НЕ используют Design System (старые стили)

- Все страницы в `pages/public/` (14 страниц)
- Все страницы в `pages/onboarding/` (6 страниц)
- Все страницы в `pages/product/` (9 страниц)
- Все страницы в `pages/solutions/` (2 страницы)
- Все страницы в `pages/cms-templates/` (28 страниц)

**Всего: 59 страниц**

## Как проверить

### Dashboard страница (должна иметь Design System)

В `<head>` должны быть:
```html
<link href="/assets/css/design-system/tokens.css" rel="stylesheet" type="text/css">
<link href="/assets/css/design-system/base.css" rel="stylesheet" type="text/css">
<link href="/assets/css/design-system/utilities.css" rel="stylesheet" type="text/css">
<link href="/assets/css/design-system/components.css" rel="stylesheet" type="text/css">
<link href="/assets/css/design-system/legacy-compat.css" rel="stylesheet" type="text/css">
```

### Публичная страница (НЕ должна иметь Design System)

В `<head>` должны быть только:
```html
<link href="/assets/css/normalize.css" rel="stylesheet" type="text/css">
<link href="/assets/css/webflow.css" rel="stylesheet" type="text/css">
<link href="/assets/css/checkie-stage.webflow.css" rel="stylesheet" type="text/css">
```

## План расширения

В будущем Design System будет применена к:
1. ⏳ Публичным страницам (landing, pricing, etc.)
2. ⏳ Onboarding страницам
3. ⏳ Product страницам

## Команды для проверки

```bash
# Проверить Dashboard страницы (должны иметь design-system)
grep -l "design-system/tokens.css" pages/dashboard/*.html

# Проверить публичные страницы (НЕ должны иметь design-system)
grep -l "design-system/tokens.css" pages/public/*.html
```
