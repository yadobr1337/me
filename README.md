# Мой список просмотренного

Небольшой статический сайт для списка просмотренных фильмов, сериалов и аниме.

## Что есть

- список на главной странице;
- фильтр по типу: фильмы, сериалы, аниме;
- сортировка по рейтингу и по недавно добавленным;
- поиск по названию;
- форма добавления через пароль `101112`;
- рейтинг через шкалу от 1 до 10;
- выбор обложки из 3 изображений через Яндекс Картинки;
- удаление записи из формы добавления;
- хранение данных в браузере через `localStorage`.

## Запуск на ПК

Самый простой способ:

1. Открой файл `index.html` двойным кликом.
2. Нажми плюс справа сверху.
3. Введи пароль `101112`.

Если поиск картинок не работает при открытии файла напрямую, запусти локальный сервер:

```powershell
python -m http.server 8080
```

Потом открой:

```text
http://localhost:8080
```

Если Python не установлен, можно установить Node.js и запустить любой простой static server, например:

```powershell
npx serve .
```

## Подключение GitHub

Сначала установи Git: https://git-scm.com/download/win

После установки открой PowerShell в этой папке и выполни:

```powershell
git init
git branch -M main
git remote add origin https://github.com/yadobr1337/me.git
git add .
git commit -m "Initial watched list site"
git push -u origin main
```

Если репозиторий уже был создан и в нем есть файлы, сначала сделай:

```powershell
git pull origin main --allow-unrelated-histories
```

Потом повтори `git add`, `git commit`, `git push`.

## Домен the1priority.ru

Для GitHub Pages:

1. Зайди в репозиторий `yadobr1337/me`.
2. Открой `Settings` -> `Pages`.
3. В `Build and deployment` выбери `Deploy from a branch`.
4. Branch: `main`, folder: `/root`.
5. В `Custom domain` укажи `the1priority.ru`.
6. В DNS домена добавь записи GitHub Pages:

```text
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
CNAME www   yadobr1337.github.io
```

Файл `CNAME` уже добавлен в проект.

DNS может обновляться до 24 часов. После появления сайта включи `Enforce HTTPS` в настройках Pages.
