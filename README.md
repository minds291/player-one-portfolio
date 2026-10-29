# Статическая версия PLAYER ONE

Откройте `index.html` в браузере или разместите содержимое этой папки на статическом хостинге. Все ссылки, шрифты и изображения относительные; PHP, база данных и WordPress не требуются.

Страницы: `index.html`, `projects.html`, `about.html`, `contact.html`. Стили — `styles.css`, поведение — `app.js`, изображения и шрифты — `assets/`.

Карточки проектов открывают окна с подробностями через JavaScript. Контактная форма создаёт локальный черновик и не отправляет сообщения; адрес `hello@example.com` служит примером. Без JavaScript создание черновика недоступно.

HTML создаётся командой `node assets/build-pages.cjs` из общего шаблона; изменяя разметку страниц, обновляйте шаблон. Проверки запускаются из этой папки: `node assets/check-project.cjs`, `node assets/check-interactions.cjs`, `node assets/check-intro.cjs`, `node assets/check-sounds.cjs`.
