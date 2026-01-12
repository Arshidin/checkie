# Быстрый справочник Checkie

## Команды

```bash
# Перейти в проект
cd ~/Desktop/Checkie/checkie-stage.webflow

# Локальный сервер
netlify dev

# Деплой preview
netlify deploy

# Деплой на продакшн
netlify deploy --prod

# Статус сайта
netlify status

# Открыть сайт в браузере
netlify open

# Логи
netlify logs
```

---

## Пути к ключевым файлам

| Что | Где |
|-----|-----|
| Главный CSS | `assets/css/checkie-stage.webflow.css` |
| Webflow CSS | `assets/css/webflow.css` |
| Normalize CSS | `assets/css/normalize.css` |
| Webflow JS | `assets/js/webflow.js` |
| Главная страница | `pages/public/index.html` |
| Netlify конфиг | `netlify.toml` |

---

## ID интеграций

```
Jetboost:    cm7m23x7h00gx0kq63i2lgub2
```

> **Note:** Memberstack has been replaced with Checkie API auth (api.js + auth.js)

---

## Шрифты

| Шрифт | Источник | Файлы |
|-------|----------|-------|
| Inter | Google Fonts | CDN |
| Plus Jakarta Sans | Google Fonts | CDN |
| Gilroy | Локальный | `assets/fonts/Gilroy-*.otf` |
| Impact | Локальный | `assets/fonts/Impact.ttf` |

---

## Цвета

| Название | HEX | CSS переменная |
|----------|-----|----------------|
| Primary Dark | `#333` | `--background-color--background-primary` |
| Secondary Orange | `#ee5a29` | `--background-color--background-secondary` |
| Brand Blue | `#2d62ff` | `--base-color-brand--blue` |
| Brand Pink | `#dd23bb` | `--base-color-brand--pink` |
| White | `#fff` | `--base-color-neutral--white` |
| Success | `#cef5ca` | `--base-color-system--success-green` |
| Error | `#f8e4e4` | `--base-color-system--error-red` |
| Warning | `#fcf8d8` | `--base-color-system--warning-yellow` |
| Focus | `#2d62ff` | `--base-color-system--focus-state` |
| Border | `#e4e4e4` | `--border-color--border-gray` |
| Gray Text | `#595959` | `--text-color-fonts-variants--text-color-gray` |

---

## Breakpoints

| Название | Ширина | Media Query |
|----------|--------|-------------|
| Desktop | 1280px+ | (default) |
| Tablet | 991px | `@media (max-width: 991px)` |
| Mobile Landscape | 767px | `@media (max-width: 767px)` |
| Mobile Portrait | 479px | `@media (max-width: 479px)` |

---

## Структура HTML страницы

```html
<!DOCTYPE html>
<html data-wf-page="..." data-wf-site="..." lang="en">
<head>
  <meta charset="utf-8">
  <title>Page Title</title>
  <meta content="width=device-width, initial-scale=1" name="viewport">

  <!-- CSS -->
  <link href="../../assets/css/normalize.css" rel="stylesheet">
  <link href="../../assets/css/webflow.css" rel="stylesheet">
  <link href="../../assets/css/checkie-stage.webflow.css" rel="stylesheet">

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com" rel="preconnect">
  <script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js"></script>
  <script>WebFont.load({google: {families: ["Inter:...", "Plus Jakarta Sans:..."]}});</script>

  <!-- Favicon -->
  <link href="../../assets/images/favicon.jpg" rel="shortcut icon">

  <!-- jQuery -->
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

  <!-- Jetboost -->
  <script>
    window.JETBOOST_SITE_ID = "cm7m23x7h00gx0kq63i2lgub2";
    // loader script...
  </script>
</head>
<body class="body">
  <div class="page-wrapper">
    <div class="global-styles w-embed">...</div>

    <!-- Navbar -->
    <div class="navbar">...</div>

    <!-- Main Content -->
    <main>...</main>

    <!-- Footer -->
    <footer>...</footer>
  </div>

  <!-- Webflow JS -->
  <script src="../../assets/js/webflow.js"></script>

  <!-- Custom Scripts -->
  <script>/* Noise effect, CounterUp, etc. */</script>
</body>
</html>
```

---

## Checkie Auth атрибуты

```html
<!-- Скрыть для гостей, показать членам -->
<div data-auth="member">Только для авторизованных</div>

<!-- Скрыть для членов, показать гостям -->
<div data-auth="guest">Только для гостей</div>

<!-- Показать имя пользователя -->
<span data-user="first-name"></span>
<span data-user="email"></span>

<!-- Кнопка выхода -->
<a data-action="logout">Выйти</a>

<!-- Формы -->
<form id="wf-form-sign-up">...</form>
<form id="wf-form-login">...</form>
```

> **Note:** Auth is handled by `/assets/js/api.js` and `/assets/js/auth.js`

---

## Lottie использование

```html
<!-- В HTML -->
<div data-w-id="..."
     data-animation-type="lottie"
     data-src="../../assets/animations/Dashboard.json"
     data-loop="1"
     data-direction="1"
     data-autoplay="1">
</div>
```

---

## Полезные grep команды

```bash
# Найти все auth атрибуты
grep -r "data-auth=" pages/

# Найти все user data атрибуты
grep -r "data-user=" pages/

# Найти все Lottie анимации
grep -r "data-animation-type" pages/

# Найти все формы
grep -r "<form" pages/

# Найти использование изображения
grep -r "logo.svg" pages/

# Найти внешние ссылки
grep -rE 'href="https?://' pages/
```

---

## Файловая статистика

| Категория | Количество |
|-----------|------------|
| HTML страниц | 64 |
| CSS файлов | 3 |
| JS файлов | 1 |
| Изображений | 279 |
| Видео | 24 |
| Шрифтов | 22 |
| Lottie анимаций | 9 |

---

## Размеры файлов

| Файл | Размер |
|------|--------|
| CSS (всего) | ~352 KB |
| Webflow JS | ~85 KB |
| Шрифты (всего) | ~2.9 MB |
| Видео (всего) | ~150 MB |

---

## Чеклист перед деплоем

- [ ] Проверить все ссылки: `grep -r 'href="' pages/ | grep -v "http"`
- [ ] Проверить изображения: открыть в браузере
- [ ] Проверить формы авторизации
- [ ] Протестировать на мобильных
- [ ] Проверить консоль на ошибки
- [ ] Запустить `netlify deploy` для preview
- [ ] Проверить preview URL
- [ ] Запустить `netlify deploy --prod`
