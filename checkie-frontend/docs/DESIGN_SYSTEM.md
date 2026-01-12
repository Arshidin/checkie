# Checkie Design System

Дизайн-система Checkie основана на **Stripe Design System** и включает все необходимые токены, компоненты и утилиты для создания консистентного UI.

## ⚠️ Важно: Область применения

**Дизайн-система применяется ТОЛЬКО для Dashboard страниц.**

- ✅ **Dashboard страницы** (`pages/dashboard/*`) - используют новую дизайн-систему
- ❌ **Публичные страницы** (`pages/public/*`) - используют старые стили
- ❌ **Onboarding страницы** (`pages/onboarding/*`) - используют старые стили
- ❌ **Product страницы** (`pages/product/*`) - используют старые стили
- ❌ **CMS Templates** (`pages/cms-templates/*`) - используют старые стили

Это сделано для постепенной миграции. В будущем дизайн-система будет применена ко всем страницам.

## Структура

```
assets/css/design-system/
├── tokens.css          # CSS переменные (цвета, типографика, spacing)
├── base.css            # Базовые стили (body, headings, links)
├── utilities.css       # Utility классы
├── components.css      # Компоненты (buttons, forms, cards, alerts)
└── legacy-compat.css   # Совместимость со старыми переменными
```

## Использование

### Подключение

**Только для Dashboard страниц** (`pages/dashboard/*`):

Файлы дизайн-системы подключены в правильном порядке:

1. `normalize.css` - сброс стилей браузера
2. `webflow.css` - базовые Webflow стили
3. `design-system/tokens.css` - токены дизайн-системы
4. `design-system/base.css` - базовые стили
5. `design-system/utilities.css` - utility классы
6. `design-system/components.css` - компоненты
7. `design-system/legacy-compat.css` - совместимость
8. `checkie-stage.webflow.css` - старые стили (постепенно удаляются)

**Для остальных страниц** (public, onboarding, product, cms-templates):

Используются только старые стили:
1. `normalize.css`
2. `webflow.css`
3. `checkie-stage.webflow.css`

### CSS переменные

Используйте CSS переменные напрямую:

```css
.my-component {
  color: var(--text-primary);
  background-color: var(--bg-primary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
}
```

## Токены

### Цвета

#### Фирменные цвета Stripe (Keel Palette)

- `--keel-slate: #0a2540` - Основной темно-синий
- `--keel-white: #ffffff` - Белый
- `--keel-lemon: #ffd848` - Желтый акцент
- `--keel-raspberry: #ff5191` - Малиновый
- `--keel-cyan: #80e9ff` - Голубой
- `--keel-magenta: #ff80ff` - Пурпурный

#### Primary (Stripe Blue)

- `--stripe-primary-500: #533afd` - Основной синий
- `--stripe-primary-600: #4e11e2` - Hover состояние
- `--stripe-primary-700: #44139f` - Active состояние

#### Семантические цвета

- **Success**: `--success-50` до `--success-900`
- **Error**: `--error-50` до `--error-900`
- **Warning**: `--warning-50` до `--warning-900`
- **Info**: `--info-50` до `--info-900`

#### Текстовые цвета

- `--text-primary: var(--gray-950)` - Основной текст
- `--text-secondary: var(--gray-700)` - Вторичный текст
- `--text-tertiary: var(--gray-500)` - Третичный текст
- `--text-inverse: var(--gray-0)` - Инверсный текст (белый)

#### Фоновые цвета

- `--bg-primary: var(--gray-0)` - Основной фон (белый)
- `--bg-secondary: var(--gray-50)` - Вторичный фон
- `--bg-tertiary: var(--gray-100)` - Третичный фон
- `--bg-card: var(--gray-0)` - Фон карточек

### Типографика

#### Шрифты

- `--font-primary` - Системные шрифты (Apple/Google/Microsoft)
- `--font-mono` - Моноширинные (Menlo, Consolas)

#### Размеры текста

- `--text-2xs: 0.75rem` (12px)
- `--text-xs: 0.8125rem` (13px)
- `--text-sm: 0.875rem` (14px)
- `--text-base: 1rem` (16px)
- `--text-lg: 1.125rem` (18px)
- `--text-xl: 1.25rem` (20px)
- `--text-2xl: 1.5rem` (24px)
- `--text-3xl: 1.75rem` (28px)
- `--text-4xl: 2rem` (32px)

#### Веса шрифтов

- `--font-light: 300`
- `--font-normal: 400`
- `--font-medium: 500`
- `--font-semibold: 600`
- `--font-bold: 700`

### Spacing (4px grid)

- `--space-0: 0`
- `--space-1: 0.25rem` (4px)
- `--space-2: 0.5rem` (8px)
- `--space-3: 0.75rem` (12px)
- `--space-4: 1rem` (16px)
- `--space-6: 1.5rem` (24px)
- `--space-8: 2rem` (32px)
- `--space-12: 3rem` (48px)
- `--space-16: 4rem` (64px)

### Border Radius

- `--radius-xs: 0.125rem` (2px)
- `--radius-sm: 0.25rem` (4px)
- `--radius-base: 0.375rem` (6px)
- `--radius-md: 0.5rem` (8px)
- `--radius-lg: 0.75rem` (12px)
- `--radius-xl: 1rem` (16px)
- `--radius-full: 9999px`

### Тени

- `--shadow-xs` - Минимальная тень
- `--shadow-sm` - Малая тень
- `--shadow-base` - Базовая тень
- `--shadow-md` - Средняя тень
- `--shadow-lg` - Большая тень
- `--shadow-xl` - Очень большая тень
- `--shadow-focus-ring` - Кольцо фокуса

### Анимации

- `--duration-fast: 50ms`
- `--duration-base: 150ms`
- `--duration-slow: 300ms`
- `--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1)`

### Breakpoints

- `--screen-sm: 640px`
- `--screen-md: 768px`
- `--screen-lg: 1024px`
- `--screen-xl: 1280px`
- `--screen-2xl: 1536px`

## Utility классы

### Typography

```html
<p class="text-sm text-secondary">Малый вторичный текст</p>
<h1 class="text-4xl font-bold">Большой заголовок</h1>
```

### Colors

```html
<div class="bg-primary text-primary">Основной фон и текст</div>
<div class="bg-success text-success">Успешное сообщение</div>
```

### Spacing

```html
<div class="p-4 m-6">Padding 16px, Margin 24px</div>
<div class="px-4 py-2">Padding X: 16px, Y: 8px</div>
```

### Layout

```html
<div class="flex items-center justify-between gap-4">
  <span>Flex контейнер</span>
</div>
```

## Компоненты

### Кнопки

```html
<!-- Primary кнопка -->
<button class="btn btn-primary">Primary Button</button>

<!-- Secondary кнопка -->
<button class="btn btn-secondary">Secondary Button</button>

<!-- Destructive кнопка -->
<button class="btn btn-destructive">Delete</button>

<!-- Ghost кнопка -->
<button class="btn btn-ghost">Ghost Button</button>

<!-- Размеры -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>

<!-- Полная ширина -->
<button class="btn btn-primary btn-full">Full Width</button>
```

### Формы

```html
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input" placeholder="example@email.com">
  <div class="form-help">Введите ваш email адрес</div>
</div>

<!-- С ошибкой -->
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input error" value="invalid">
  <div class="form-error">Некорректный email адрес</div>
</div>

<!-- Select -->
<select class="form-input form-select">
  <option>Option 1</option>
</select>

<!-- Textarea -->
<textarea class="form-input form-textarea"></textarea>
```

### Карточки

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Заголовок карточки</h3>
    <p class="card-description">Описание карточки</p>
  </div>
  <div class="card-body">
    <p>Содержимое карточки</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Действие</button>
  </div>
</div>
```

### Алерты

```html
<div class="alert alert-success">
  <div class="alert-title">Успех!</div>
  <p>Операция выполнена успешно</p>
</div>

<div class="alert alert-error">
  <div class="alert-title">Ошибка</div>
  <p>Произошла ошибка</p>
</div>

<div class="alert alert-warning">
  <div class="alert-title">Предупреждение</div>
  <p>Обратите внимание</p>
</div>

<div class="alert alert-info">
  <div class="alert-title">Информация</div>
  <p>Полезная информация</p>
</div>
```

### Таблицы

```html
<table class="stripe-table">
  <thead>
    <tr>
      <th>ID</th>
      <th>Название</th>
      <th>Статус</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Платеж #123</td>
      <td><span class="status-badge status-succeeded">Успешно</span></td>
    </tr>
  </tbody>
</table>
```

### Status Badges

```html
<span class="status-badge status-succeeded">Успешно</span>
<span class="status-badge status-pending">Ожидание</span>
<span class="status-badge status-failed">Ошибка</span>
```

### Dashboard Cards

```html
<div class="dashboard-card">
  <div class="dashboard-card-title">Общий доход</div>
  <div class="dashboard-card-value">$12,345</div>
</div>
```

## Миграция со старых классов

**Примечание:** Миграция применяется только для Dashboard страниц. На остальных страницах продолжают использоваться старые классы.

### Кнопки

| Старый класс | Новый класс |
|--------------|-------------|
| `.button` | `.btn .btn-primary` |
| `.button.is-secondary` | `.btn .btn-secondary` |
| `.button.is-small` | `.btn .btn-sm` |
| `.button.is-large` | `.btn .btn-lg` |

### Формы

| Старый класс | Новый класс |
|--------------|-------------|
| `.form_input` | `.form-input` |
| `.form_label` | `.form-label` |
| `.form_form` | `.form-group` (для каждого поля) |

### Цвета

Старые CSS переменные автоматически маппятся на новые через `legacy-compat.css`. Старые классы продолжают работать, но рекомендуется использовать новые компоненты дизайн-системы.

## Best Practices

1. **Используйте CSS переменные** вместо хардкода значений
2. **Применяйте utility классы** для быстрой разработки
3. **Используйте компоненты** для консистентности
4. **Следуйте spacing системе** (4px grid)
5. **Используйте семантические цвета** (success, error, warning, info)

## План миграции

Текущий статус:
- ✅ **Dashboard страницы** - используют новую дизайн-систему
- ⏳ **Публичные страницы** - будут мигрированы позже
- ⏳ **Onboarding страницы** - будут мигрированы позже
- ⏳ **Product страницы** - будут мигрированы позже

При добавлении дизайн-системы на другие страницы:
1. Добавьте CSS файлы дизайн-системы в `<head>` страницы
2. Используйте компоненты и utility классы
3. Постепенно заменяйте старые классы на новые

## Темная тема

Архитектура дизайн-системы подготовлена для поддержки темной темы. Все цвета используют CSS переменные, что упростит будущую миграцию. Темная тема будет активирована в следующих версиях.

## Дополнительные ресурсы

- [Stripe Design System](https://stripe.com/docs/design-system) - Оригинальная дизайн-система Stripe
- `pages/dashboard/home.html` - Пример использования в Dashboard
- `docs/DESIGN_SYSTEM_TESTING.md` - Чеклист для тестирования

## Технические детали

### Какие страницы используют дизайн-систему

Дизайн-система загружается только в следующих файлах:
- `pages/dashboard/home.html`
- `pages/dashboard/payments.html`
- `pages/dashboard/balance.html`
- `pages/dashboard/faq.html`
- `pages/dashboard/help-center.html`
- `pages/product/dashboard.html` (если есть)

Все остальные страницы используют только старые стили (`checkie-stage.webflow.css`).
