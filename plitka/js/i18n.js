// Языки: русский (исходный, строки прямо в коде) и английский — словарь ниже.
// Перевод — на лету: MutationObserver переводит текстовые узлы и атрибуты (placeholder, title, aria-label)
// по точному совпадению или шаблону. Так не нужно оборачивать каждую строку в коде; новые строки ловит
// `node tests/i18n-scan.mjs` (печатает русские строки без перевода).
// Пользовательский текст (дела, заметки, названия ссылок, цитаты) не переводится — у контейнера translate="no".
const I18N = (() => {
  const EN = {
    // общее и панель
    'Новая вкладка': 'New Tab', 'Настройки': 'Settings', 'Закрыть': 'Close', 'Закрыть (Esc)': 'Close (Esc)', 'Готово': 'Done',
    'Фон': 'Background', 'Эффекты': 'Effects', 'Блоки': 'Blocks', 'Вкладка': 'Tab', 'Ещё': 'More',
    'Вкладка браузера': 'Browser tab', 'Название': 'Title', 'Иконка': 'Icon', 'Вставить:': 'Insert:',
    '{время}': '{time}', '{дата}': '{date}', '{день}': '{day}', 'Эмодзи': 'Emoji', 'Буква': 'Letter', 'Буква (1–2)': 'Letter (1–2)',
    'Часы': 'Clock', 'Помодоро': 'Pomodoro', 'Своя': 'Custom', 'Выбрать картинку': 'Choose image', 'Другая картинка': 'Another image',
    'Пока идёт помодоро — в иконке кольцо и минуты. Нужен виджет «Помодоро».': 'While a pomodoro runs, the icon shows a ring and minutes. Needs the Pomodoro widget.',
    'Приветствие': 'Greeting', 'Имя': 'Name', 'Как к тебе обращаться?': 'What should we call you?',
    'Свои приветствия': 'Custom greetings', 'Ещё вариант': 'Another one', 'Привет, {имя}!': 'Hey, {name}!', '+ Ещё приветствие': '+ Add greeting',
    'Любое время': 'Any time', 'Утро': 'Morning', 'День': 'Afternoon', 'Вечер': 'Evening', 'Ночь': 'Night',
    '{имя} подставит имя. Если вариантов несколько — показывается случайный; с временем суток — только в это время, иначе стандартное «Доброе утро».': '{name} inserts your name. With several options a random one is shown; those with a time of day only show then.',
    'Раскладка': 'Layout', 'Изменить раскладку': 'Edit layout', 'Двигать, растягивать, добавлять блоки': 'Move, resize and add blocks',
    'Сбросить раскладку': 'Reset layout', 'Точно? Нажми ещё раз': 'Sure? Click again', 'Раскладка сброшена на всех экранах': 'Layout reset on all screens',
    'Резервная копия': 'Backup', 'Настройки, блоки и раскладки — одним файлом. Пригодится при переезде на другой компьютер.': 'Settings, blocks and layouts in one file — handy when moving to another computer.',
    'Сохранить файл': 'Save file', 'Загрузить': 'Load', 'Это не мой бэкап, не могу прочитать': "That's not a Plitka backup, can't read it",
    'Клавиши': 'Shortcuts', 'Перейти к поиску': 'Focus search', 'Закрыть панель, выйти из редактора': 'Close panel, leave editor',
    'Поиск в новой вкладке': 'Search in a new tab', 'Поиск в инкогнито': 'Search in incognito',
    'Всё хранится у тебя': 'Everything stays on your device', 'Язык': 'Language', 'Как в браузере': 'Same as browser',
    // фон
    'Своя картинка': 'Your image', 'Или заготовка': 'Or a preset', 'Заменить': 'Replace', 'Убрать': 'Remove', 'Показывать': 'Show',
    'Как есть': 'As is', 'С эффектом': 'With effect', 'Затемнение': 'Dimming', 'Настроить': 'Customize', 'Свернуть': 'Collapse',
    'Случайный': 'Random', 'Случайные цвета и точки, узор тот же': 'Random colors and points, same pattern',
    'Движение': 'Motion', 'Живой фон': 'Live background', 'Выключи — фон и эффекты замрут (меньше нагрузка на ноутбуке).': 'Turn off to freeze the background and effects (easier on laptops).',
    'Слайд-шоу': 'Slideshow', 'Автосмена фона': 'Rotate backgrounds', 'Пока пусто.': 'Empty for now.',
    'Фон сам переключается на следующий из списка ниже — при открытии новой вкладки или по таймеру. Добавь сюда заготовки и свои картинки.': 'The background switches to the next one in the list below — on every new tab or on a timer. Add presets and your own images here.',
    '+ Текущий фон': '+ Current background', '+ Картинки': '+ Images', 'Следующий': 'Next', 'Менять': 'Change', 'Порядок': 'Order',
    'С каждой новой вкладкой': 'With every new tab', 'Каждые 10 минут': 'Every 10 minutes', 'Каждый час': 'Every hour', 'Раз в день': 'Once a day',
    'По порядку': 'In order', 'Случайно': 'Shuffle', 'Сейчас на экране': 'On screen now', 'Показать': 'Show', 'Убрать из слайд-шоу': 'Remove from slideshow',
    'Фон добавлен в слайд-шоу': 'Background added to slideshow', 'Картинка убрана': 'Image removed', 'Вернуть': 'Undo',
    'Узор': 'Pattern', 'Анимация': 'Animation', 'Сила анимации': 'Animation strength', 'Чистая область': 'Clear area',
    'Прямоугольник, где узора нет': 'A rectangle without the pattern', 'Чистая область: тащи, чтобы двигать, за угол — менять размер': 'Clear area: drag to move, drag a corner to resize',
    'Тени': 'Shadows', 'Света': 'Highlights', 'Мелкость стекла': 'Glass grain', 'Плотность': 'Density', 'Жидкость': 'Flow', 'Искажение': 'Distortion',
    'Скорость': 'Speed', 'стоит': 'still', 'Зерно': 'Grain', 'Цвет': 'Color', '+ Точка': '+ Point', 'Цвет выбранной точки': 'Selected point color',
    'Тащи, чтобы двигать': 'Drag to move',
    'Без узора': 'None', 'Матовое стекло': 'Frosted glass', 'Рифлёное стекло': 'Reeded glass', 'Полутон': 'Halftone', 'Дуотон': 'Duotone',
    'Неоновые линии': 'Neon lines', 'Рельеф': 'Relief', 'Нет': 'None', 'Дыхание': 'Breathe', 'Наезд камеры': 'Ken Burns', 'Марево': 'Heat haze',
    'Дождь по стеклу': 'Rain on glass', 'Глитч': 'Glitch', 'Блик': 'Shimmer',
    'Аврора': 'Aurora', 'Рифлёнка': 'Reeded', 'Лепесток': 'Petal', 'Неон': 'Neon', 'Дымка': 'Haze', 'Пламя': 'Flame', 'Монохром': 'Mono',
    'Шёлк': 'Silk', 'Закат': 'Sunset', 'Лагуна': 'Lagoon', 'Лес': 'Forest', 'Графит': 'Graphite',
    // эффекты
    'Эффекты поверх фона': 'Effects over the background', 'Виньетка': 'Vignette', 'Свечение': 'Bloom', 'Частицы': 'Particles',
    'Перспектива (фон движется от курсора)': 'Perspective (background follows the cursor)', 'Аберрация': 'Aberration', 'Сканлайны': 'Scanlines', 'Оттенок по времени суток': 'Tint by time of day', 'нет': 'off',
    'Работают и с мешем, и со своей картинкой. Узоры и анимации — во вкладке «Фон» → «Настроить».': 'Work with gradients and your own image. Patterns and animation are under Background → Customize.',
    // блоки
    'Текст в блоках': 'Text in blocks', 'Шрифт': 'Font', 'Тень': 'Shadow', 'Системный': 'System', 'С засечками': 'Serif', 'Моноширинный': 'Monospace',
    'Мягкая': 'Soft', 'Сильная': 'Strong', 'Стекло': 'Glass', 'Жидкое стекло': 'Liquid glass', 'Подложка блоков': 'Block backing',
    'Размытие': 'Blur', 'Читаемость': 'Legibility', 'Скругление': 'Corner radius', 'Акцент': 'Accent',
    'Стекло выравнивает яркость фона под собой. На пёстром фоне (и белое, и чёрное сразу) включается само.': 'Glass evens out the background brightness under it. Turns on by itself on busy backgrounds.',
    'У каждого блока можно поставить своё — в его настройках, «Оформление».': 'Each block can override this in its settings.',
    'Преломление по краям, как в iOS. Работает в Chrome, Edge и Яндекс Браузере. У каждого блока можно выбрать своё — в его «Оформлении».': 'Refraction at the edges, like iOS. Each block can choose its own.',
    // инспектор блока
    'Оформление': 'Appearance', 'Цвет текста': 'Text color', 'Авто': 'Auto', 'Светлый': 'Light', 'Тёмный': 'Dark', 'Тень текста': 'Text shadow',
    'Как везде': 'Default', 'как везде': 'default', 'Цвет подложки': 'Backing color', 'Подложка': 'Backing', 'Сбросить': 'Reset',
    'Скругление углов': 'Corner radius', 'Размытие стекла': 'Glass blur', 'Плотность стекла': 'Glass density', 'Стеклянная подложка': 'Glass backing',
    'Удалить': 'Delete', 'Выше': 'Move up', 'Добавить': 'Add', 'Отмена': 'Cancel', 'Адрес': 'URL', 'необязательно': 'optional',
    'Новая ссылка': 'New link', 'Добавить ссылку': 'Add link', '+ Ссылка': '+ Link', 'Из панели закладок': 'From bookmarks bar',
    'Забрать ссылки из строки закладок браузера': 'Import links from the bookmarks bar', 'Новых закладок нет': 'No new bookmarks',
    'Доступ есть — обнови вкладку и нажми ещё раз': 'Access granted — reload the tab and click again',
    'Вид': 'View', 'Формат': 'Format', '24 часа': '24-hour', '12 часов': '12-hour', 'Секунды': 'Seconds', 'Дата': 'Date', 'Выравнивание': 'Alignment',
    'Цифровые': 'Digital', 'Стрелочные': 'Analog', 'Сверху': 'Top', 'Снизу': 'Bottom', 'По центру': 'Center', 'по центру': 'center', 'слева': 'left', 'справа': 'right',
    'Содержимое': 'Content', 'Текст': 'Text', 'Показывать подложку': 'Show backing', 'Прозрачная': 'Transparent', 'Вид стекла': 'Glass type',
    'Расстояние между иконками': 'Icon spacing', 'Плотно': 'Tight', 'Обычно': 'Normal', 'Свободно': 'Loose',
    'Unbounded — широкий': 'Unbounded — wide', 'Playfair — изящный': 'Playfair — elegant', 'Oswald — узкий': 'Oswald — narrow',
    'Comfortaa — круглый': 'Comfortaa — rounded', 'Caveat — от руки': 'Caveat — handwritten', 'Lobster — вывеска': 'Lobster — signboard',
    'Браузер не дал доступ': 'The browser denied access', 'Браузер не умеет выдавать доступ расширениям': 'This browser can’t grant extension permissions',
    'Обнови расширение в chrome://extensions (↻) и попробуй ещё раз': 'Reload the extension in chrome://extensions (↻) and try again',
    'Доброе утро — крупно и своим шрифтом': 'Good morning — big, in your font',
    'Жидкое': 'Liquid', 'Жирный': 'Bold', 'Мини': 'Mini', 'Обычный': 'Regular', 'Тонкий': 'Thin', 'Толщина': 'Weight', 'Подпись': 'Caption',
    'Свой': 'Custom', 'Стиль': 'Style', 'Слабая': 'Soft', 'Слева': 'Left', 'Справа': 'Right', 'Тень блока': 'Block shadow', 'Тень блоков': 'Block shadow',
    'Прямоугольник, где узора нет — тащи на превью': 'A rectangle without the pattern — drag it on the preview',
    // редактор и меню
    'Тащи блоки, тяни за углы и края': 'Drag blocks, pull corners and edges', '+ Виджет': '+ Widget', 'Редактировать раскладку (E)': 'Edit layout (E)',
    'Места нет — освободи немного': 'No room — free up some space', 'Окно слишком узкое — растяни его, чтобы двигать блоки': 'Window is too narrow — widen it to move blocks',
    'Время': 'Time', 'Дела': 'Tasks', 'Навигация': 'Navigation', 'Информация': 'Info', 'Настроение': 'Mood',
    // виджеты: названия и описания
    'Поиск': 'Search', 'Ссылки': 'Links', 'Заметки': 'Notes', 'Погода': 'Weather', 'Список дел': 'To-do', 'Частые сайты': 'Top sites',
    'Недавно закрытые': 'Recently closed', 'Курсы ЦБ': 'Exchange rates', 'Обратный отсчёт': 'Countdown', 'Привычки': 'Habits', 'Цитата': 'Quote',
    'Слово дня': 'Word of the day', 'Картинка': 'Picture', 'Панель закладок': 'Bookmarks bar',
    'Цифровые или стрелочные, приветствие': 'Digital or analog, with greeting', 'Фокус и перерывы по таймеру': 'Focus and breaks on a timer',
    'Сколько осталось до события': 'Time left until an event', 'Список дел с галочками': 'Tasks with checkboxes', 'Быстрые заметки, сохраняются сами': 'Quick notes, saved automatically',
    'Отмечай привычки каждый день': 'Track habits daily', 'Яндекс, Google, DuckDuckGo, Bing': 'Google, DuckDuckGo, AI search and more',
    'Свои закладки плитками': 'Your bookmarks as tiles', 'Сайты, куда ходишь чаще всего': 'Sites you visit most', 'Вернуть случайно закрытую вкладку': 'Bring back a closed tab',
    'Твоя строка закладок, папки списком': 'Your bookmarks bar, folders included', 'Сейчас или на неделю': 'Now or for the week',
    'Доллар, евро, юань по ЦБ': 'USD, EUR, CNY (Bank of Russia)', 'Цитата из аниме каждый день': 'An anime quote every day',
    'Редкое слово и что оно значит': 'A rare word and its meaning', 'Котики, аниме-гифки или своя': 'Cats, anime GIFs or your own',
    // поиск
    'Выбрать поисковик': 'Choose search engine', 'Скопировать': 'Copy', 'Скопировано': 'Copied', 'Поисковик': 'Search engine',
    'Высота строки': 'Bar height', 'Тонкая': 'Thin', 'Обычная': 'Normal', 'Крупная': 'Large', 'Открывать в новой вкладке': 'Open in a new tab',
    'Помнить последние запросы': 'Remember recent searches', 'Кнопка выбора поисковика': 'Search engine button', 'Кнопка инкогнито': 'Incognito button',
    'Инкогнито': 'Incognito', 'Искать в окне инкогнито (или Shift+Enter)': 'Search in incognito (or Shift+Enter)', 'Инкогнито — следующий поиск': 'Incognito — next search',
    'Инкогнито недоступно — открыл в новой вкладке': 'Incognito unavailable — opened in a new tab', 'Убрать из истории': 'Remove from history',
    'Префикс — разовый поиск: «!yt котики»': 'Prefix for a one-off search: “!yt cats”',
    'Enter — искать здесь\nCtrl+Enter — в новой вкладке\nShift+Enter — в окне инкогнито': 'Enter — search here\nCtrl+Enter — new tab\nShift+Enter — incognito',
    'Яндекс': 'Yandex', 'Яндексе': 'Yandex', 'Википедия': 'Wikipedia', 'Википедии': 'Wikipedia',
    // ссылки
    'Плитки': 'Tiles', 'Список': 'List', 'Только иконки': 'Icons only', 'Иконки': 'Icons', 'Крупные': 'Large', 'Цвет бренда': 'Brand color', 'Буквы': 'Letters',
    'Папка': 'Folder', 'Папка пустая': 'Empty folder', 'В строке закладок пока пусто': 'The bookmarks bar is empty',
    'Нужен доступ к закладкам — покажу твою строку закладок': 'Needs bookmarks access to show your bookmarks bar',
    'Нужен доступ к недавно закрытым вкладкам': 'Needs access to recently closed tabs', 'Нужен доступ к часто посещаемым сайтам': 'Needs access to top sites',
    'Разрешить': 'Allow', 'Обновить': 'Reload', 'Доступ есть — обнови вкладку': 'Access granted — reload the tab', 'Сколько': 'How many',
    'Браузер ещё не знает твоих частых сайтов': "The browser doesn't know your top sites yet", 'Пока ничего не закрывали': 'Nothing closed yet',
    // заметки, дела, привычки
    'Заголовок': 'Title', 'Пиши сюда, всё сохранится само…': 'Type here, it saves itself…', 'Новая задача — Enter': 'New task — Enter',
    'Убрать сделанные': 'Clear completed', 'Двойной клик — изменить': 'Double-click to edit', 'Новая привычка — Enter': 'New habit — Enter', 'Дней подряд': 'Day streak',
    // помодоро
    'Работа, мин': 'Work, min', 'Перерыв, мин': 'Break, min', 'Звук в конце': 'Sound at the end', 'Фокус': 'Focus', 'Перерыв': 'Break',
    'Пауза': 'Pause', 'Старт': 'Start', 'Сначала': 'Restart', 'Следующая фаза': 'Skip phase',
    // погода, курсы, отсчёт
    'Город': 'City', 'Москва': 'Moscow', 'Сейчас': 'Now', 'Неделя': 'Week', 'Сегодня': 'Today', 'Смотрю в окно…': 'Looking out the window…',
    'Нет связи с погодой': "Can't reach the weather service", 'нет сети': 'offline',
    'Ясно': 'Clear', 'Малооблачно': 'Partly cloudy', 'Пасмурно': 'Overcast', 'Туман': 'Fog', 'Дождь': 'Rain', 'Снег': 'Snow', 'Гроза': 'Thunderstorm',
    'Курс ЦБ': 'Exchange rate', 'Узнаю курс…': 'Fetching rates…', 'Нет связи с ЦБ': "Can't reach the bank", 'Не нашёл таких валют': 'No such currencies',
    'Валюты (коды через запятую)': 'Currencies (comma-separated codes)', 'Событие': 'Event', 'Новый год': 'New Year',
    'ДД.ММ.ГГГГ, пусто — Новый год': 'DD.MM.YYYY, empty — New Year',
    // картинка, цитата, слово
    'Что показывать': 'Show', 'Котики': 'Cats', 'Аниме-гифки': 'Anime GIFs', 'Свой файл': 'Your file', 'Как вписать': 'Fit',
    'Заполнить': 'Fill', 'Целиком': 'Contain', 'Ищу…': 'Searching…', 'Картинка не загрузилась': "Image didn't load",
    'Не достучался до сервиса': "Can't reach the service", 'Выбрать файл': 'Choose file', 'Другой файл': 'Another file',
    'Свою картинку или гифку': 'Your image or GIF', 'Гифка больше 5 МБ — возьми поменьше': 'GIF is over 5 MB — pick a smaller one',
    'Другая цитата': 'Another quote', 'Другое слово': 'Another word',
  };

  // строки с подстановками
  const PATTERNS = [
    [/^Искать в (.+)$/, (m) => `Search ${tr(m[1])}`],
    [/^«(.+)» удалён$/, (m) => `“${tr(m[1])}” removed`],
    [/^(\d+) (осталась|осталось)$/, (m) => `${m[1]} left`],
    [/^Сегодня: (\d+)$/, (m) => `Today: ${m[1]}`],
    [/^Добавлено из закладок: (\d+)$/, (m) => `Imported from bookmarks: ${m[1]}`],
    [/^Добавлено: (\d+)$/, (m) => `Added: ${m[1]}`],
    [/^до «(.+)» · ещё (\d+) ч (\d+) мин$/, (m) => `until “${tr(m[1])}” · ${m[2]} h ${m[3]} min more`],
    [/^до «(.+)»$/, (m) => `until “${tr(m[1])}”`],
    [/^(.+) — уже!$/, (m) => `${tr(m[1])} — it's here!`],
    [/^(день|дня|дней)$/, () => 'days'],
    [/^Не знаю город «(.+)»$/, (m) => `Unknown city “${m[1]}”`],
    [/^(.+) · нет сети$/, (m) => `${tr(m[1])} · offline`],
    [/^(.+) · (-?\d+)° \/ (-?\d+)°$/, (m) => `${tr(m[1])} · ${m[2]}° / ${m[3]}°`],
    [/^(Доброе утро|Добрый день|Добрый вечер|Доброй ночи)(, .+)?$/, (m) => ({ 'Доброе утро': 'Good morning', 'Добрый день': 'Good afternoon', 'Добрый вечер': 'Good evening', 'Доброй ночи': 'Good night' }[m[1]] + (m[2] || ''))],
    [/^как везде · (.+)$/, (m) => `default · ${m[1]}`],
    [/^(Сверху|По центру|Снизу) · (слева|по центру|справа)$/, (m) => `${tr(m[1])} · ${tr(m[2])}`],
  ];
  // строки, которые переводить не нужно (служебные, логи)
  const SKIP = [/^(Русский|English)$/, /^\[/, /в фоне, вкладка/, /^(осталась|осталось|события)$/, /^У$|^у$/, /replace/, /^<svg/, /^(Вода 2 л|Спорт|Чтение|Хабр|Кинопоиск)$/];

  let lang = 'ru';
  function tr(s) {
    if (lang === 'ru' || typeof s !== 'string') return s;
    const t = s.trim();
    if (!t) return s;
    let r = EN[t];
    if (r == null) for (const [re, f] of PATTERNS) { const m = t.match(re); if (m) { r = f(m); break; } }
    return r == null ? s : s.replace(t, r);
  }

  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
  const skip = (el) => el && el.closest?.('[translate="no"], script, style, textarea');
  function walk(root) {
    if (root.nodeType === 3) { if (!skip(root.parentElement)) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || skip(root)) return;
    for (const a of ATTRS) if (root.hasAttribute(a)) { const v = root.getAttribute(a), n = tr(v); if (n !== v) root.setAttribute(a, n); }
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  function setLang(l) {
    const pick = l === 'en' || l === 'ru' ? l : (navigator.language || 'ru').slice(0, 2);
    lang = ['ru', 'uk', 'be', 'kk'].includes(pick) ? 'ru' : 'en';
    document.documentElement.lang = lang;
    if (lang === 'ru') return;
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') walk(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  return { t: tr, setLang, lang: () => lang, locale: () => (lang === 'en' ? 'en-US' : 'ru-RU'), EN, PATTERNS, SKIP };
})();
