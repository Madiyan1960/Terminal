// script.js

// Вставьте сюда ваши актуальные ссылки на опубликованные CSV-файлы из Google Таблиц.
// ОБЯЗАТЕЛЬНО: Получите эти ссылки через "Файл" -> "Поделиться" -> "Опубликовать в Интернете"
// и выберите формат ".csv". Ссылки должны начинаться с "/e/.../pub?gid=...".
const MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=0'; // ЗАМЕНИТЕ НА ВАШУ РЕАЛЬНУЮ ССЫЛКУ для материалов
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=224436106'; // ЗАМЕНИТЕ НА ВАШУ РЕАЛЬНУЮ ССЫЛКУ для транзакций


// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ХРАНЕНИЯ ЗАГРУЖЕННЫХ ДАННЫХ ---
// Эти переменные объявлены в глобальной области видимости, чтобы
// к ним мог получить доступ обработчик кнопки экспорта Excel.
let globalMaterialsData = [];
let globalTransactionsData = [];


// Функция для загрузки CSV-данных с помощью библиотеки Papa Parse.
async function loadCsvData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Если HTTP статус не 2xx (например, 404), бросаем ошибку
            throw new Error(`Ошибка HTTP! Статус: ${response.status} для URL: ${url}`);
        }
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,         // Первая строка CSV - это заголовки
                dynamicTyping: true,  // Автоматически преобразует числа и булевы значения
                skipEmptyLines: true, // Пропускает пустые строки
                complete: function(results) {
                    if (results.errors.length > 0) {
                        console.error('Ошибки парсинга CSV:', results.errors);
                        reject(new Error('Ошибка парсинга CSV. Проверьте консоль для деталей.'));
                    } else {
                        resolve(results.data);
                    }
                },
                error: function(err) {
                    console.error('Ошибка Papa Parse:', err);
                    reject(err);
                }
            });
        });
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        return null;
    }
}

// Функция для отображения данных в HTML-таблице.
function renderTable(data, containerId, headersMap, uniqueByKey = null) {
    const container = document.getElementById(containerId);
    const loadingMessage = container.previousElementSibling; // Находим сообщение о загрузке
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none'; // Скрываем сообщение о загрузке, когда данные готовы
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют или таблица пуста.</p>';
        return;
    }

    let processedData = data;

    // Логика для получения уникальных записей, если указан uniqueByKey (например, для материалов)
    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = data.filter(row => {
            const keyValue = row[uniqueByKey];
            // Пропускаем строки с null/undefined ключами или уже виденными ключами
            if (keyValue === null || keyValue === undefined || seenKeys.has(keyValue)) {
                return false; 
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${uniqueByKey}". Проверьте данные или ключ.`);
            const keyLabel = headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey;
            container.innerHTML = `<p>Нет уникальных данных по полю "${keyLabel}".</p>`;
            return;
        }
    }

    const table = document.createElement('table');
    // Добавляем класс таблице, чтобы применились стили из style.css
    // (например, для 'materials-table-container' класс станет 'materials-table')
    const tableClass = containerId.replace('-table-container', ''); 
    table.classList.add(tableClass);


    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    // Определяем заголовки для отображения, если headersMap не задан, берем из данных
    const displayHeaders = headersMap || Object.keys(processedData[0]).map(key => ({ key, label: key }));

    // Создаем заголовки таблицы (<th>)
    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        headerRow.appendChild(th);
    });

    // Заполняем тело таблицы (<td>)
    processedData.forEach(rowData => {
        const row = tbody.insertRow();
        displayHeaders.forEach(h => {
            const cell = row.insertCell();
            // Проверяем на null/undefined, чтобы не выводить 'null' или 'undefined' в таблице
            cell.textContent = rowData[h.key] !== null && rowData[h.key] !== undefined ? rowData[h.key] : '';
        });
    });

    // Очищаем контейнер и добавляем готовую таблицу
    container.innerHTML = '';
    container.appendChild(table);
}


// --- ФУНКЦИЯ ДЛЯ ЭКСПОРТА ДАННЫХ В CSV (EXCEL) ---
// Эта функция принимает имя файла, данные и карту заголовков для экспорта.
function exportToCsv(filename, data, headersMap) {
    // Если данных нет или они пусты, выводим предупреждение и выходим.
    if (!data || data.length === 0) {
        alert(`Нет данных для экспорта в ${filename}. Пожалуйста, убедитесь, что таблица не пуста.`);
        return;
    }

    // Собираем заголовки CSV в нужном порядке, используя 'label' из headersMap.
    // Это будут названия столбцов в вашем Excel-файле.
    const headers = headersMap.map(h => h.label);

    // Подготавливаем данные для PapaParse: массив массивов.
    // Первая строка - заголовки, затем строки с данными.
    const csvDataForUnparse = [];
    csvDataForUnparse.push(headers); // Добавляем заголовки как первую строку CSV

    data.forEach(row => {
        const newRow = [];
        headersMap.forEach(h => {
            // Используем h.key для доступа к соответствующему свойству объекта данных.
            // Если значение null/undefined, используем пустую строку, чтобы избежать 'null'/'undefined' в CSV.
            const value = row[h.key] !== null && row[h.key] !== undefined ? row[h.key] : '';
            newRow.push(value);
        });
        csvDataForUnparse.push(newRow);
    });

    // Используем Papa.unparse() для преобразования массива массивов в CSV-строку.
    const csvString = Papa.unparse(csvDataForUnparse, {
        quotes: true,  // Добавлять кавычки вокруг всех полей (хорошо для Excel, если есть запятые внутри текста)
        delimiter: ';', // Используем запятую как разделитель
        newline: '\r\n' // Стандартная новая строка для CSV (Windows-совместимая)
    });

    // --- ВАЖНО: Добавляем UTF-8 BOM в начало строки CSV ---
    // Это позволяет Excel автоматически распознавать кодировку и правильно отображать русские символы.
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });

    // Создаем ссылку для скачивания файла
    const link = document.createElement('a');
    if (link.download !== undefined) { // Проверяем поддержку атрибута 'download' (для современных браузеров)
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename); // Устанавливаем имя файла для скачивания
        link.style.visibility = 'hidden'; // Делаем ссылку невидимой
        document.body.appendChild(link);
        link.click(); // Программно нажимаем на ссылку для скачивания
        document.body.removeChild(link); // Удаляем ссылку после использования
    } else {
        // Fallback для очень старых браузеров (открывает CSV в новой вкладке)
        window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
    }
}


// Загрузка и отображение данных при загрузке страницы.
// Этот код выполняется, как только HTML-документ полностью загружен.
document.addEventListener('DOMContentLoaded', async () => {
    // --- Загружаем материалы ---
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Название' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        { key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Остаток', label: 'Количество' }, // Убедитесь, что это поле есть в вашей таблице и содержит числовые значения
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    // Данные материалов сохраняются в глобальную переменную.
    globalMaterialsData = await loadCsvData(MATERIALS_CSV_URL); 
    if (globalMaterialsData) {
        renderTable(globalMaterialsData, 'materials-table-container', materialHeaders, 'Название');
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
    }

    // --- Загружаем транзакции ---
    const transactionHeaders = [
        { key: 'Дата', label: 'Дата' },
        { key: 'Сотрудник', label: 'Сотрудник' },
        { key: 'Поставщик', label: 'Поставщик' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Тип', label: 'Тип' },
        { key: 'Кол-во', label: 'Кол-во' }, // Убедитесь, что это поле есть в вашей таблице и содержит числовые значения
        { key: 'Комментарий', label: 'Комментарий' },
    ];
    // Данные транзакций сохраняются в глобальную переменную.
    globalTransactionsData = await loadCsvData(TRANSACTIONS_CSV_URL); 
    if (globalTransactionsData) {
        renderTable(globalTransactionsData, 'transactions-table-container', transactionHeaders);
    } else {
        document.getElementById('transactions-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        document.getElementById('transactions-loading').style.display = 'none';
    }
});


// --- ОБРАБОТЧИКИ КНОПОК ---

// Обработчик события для кнопки "Сохранить как Excel (CSV)".
// Он активируется при нажатии на кнопку и вызывает функцию exportToCsv для обеих таблиц.
document.getElementById('exportCsvButton').addEventListener('click', () => {
    // Заголовки для таблицы "Материалы" при экспорте.
    // 'key' должен ТОЧНО совпадать с названием столбца в вашей Google Таблице.
    // 'label' - это название столбца, которое будет отображаться в Excel.
    const materialHeadersForExport = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Название' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        { key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Остаток', label: 'Количество' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    exportToCsv('материалы.csv', globalMaterialsData, materialHeadersForExport);

    // Заголовки для таблицы "Транзакции" при экспорте.
    const transactionHeadersForExport = [
        { key: 'Дата', label: 'Дата' },
        { key: 'Сотрудник', label: 'Сотрудник' },
        { key: 'Поставщик', label: 'Поставщик' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Тип', label: 'Тип' },
        { key: 'Кол-во', label: 'Кол-во' },
        { key: 'Комментарий', label: 'Комментарий' },
    ];
    exportToCsv('транзакции.csv', globalTransactionsData, transactionHeadersForExport);
});


// Обработчик события для кнопки "Сохранить как PDF".
document.getElementById('printPdfButton').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // 'p' - портретная ориентация, 'mm' - миллиметры, 'a4' - формат листа

    const container = document.querySelector('.container'); // Выбираем основной контейнер для печати

    // Скрываем элементы, которые не должны попасть в PDF (кнопки, заголовки и т.д.)
    document.getElementById('printPdfButton').classList.add('pdf-hidden');
    document.getElementById('exportCsvButton').classList.add('pdf-hidden'); // Скрываем кнопку Excel
    document.querySelector('h1').classList.add('pdf-hidden'); // Скрываем общий заголовок страницы

    html2canvas(container, {
        scale: 2,         // Увеличиваем масштаб для лучшего качества PDF
        useCORS: true,    // Важно, если есть изображения с других доменов
        logging: true     // Включаем логирование для отладки
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png'); // Получаем изображение контейнера
        const imgWidth = 210; // Ширина A4 в мм
        const pageHeight = 297; // Высота A4 в мм
        const imgHeight = canvas.height * imgWidth / canvas.width; // Вычисляем высоту изображения в мм
        let heightLeft = imgHeight; // Оставшаяся высота изображения для размещения на страницах

        let position = 0; // Текущая позиция на странице

        // Добавляем изображение на первую страницу
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Если изображение больше одной страницы, добавляем новые страницы
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight; // Смещаем позицию для следующей части изображения
            doc.addPage(); // Добавляем новую страницу
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); // Добавляем оставшуюся часть изображения
            heightLeft -= pageHeight;
        }

        doc.save('Отчет_Склад.pdf'); // Сохраняем PDF-файл

        // После сохранения PDF, возвращаем видимость скрытым элементам
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.getElementById('exportCsvButton').classList.remove('pdf-hidden'); // Возвращаем видимость кнопке Excel
        document.querySelector('h1').classList.remove('pdf-hidden');
    }).catch(error => {
        console.error('Ошибка при генерации PDF:', error);
        alert('Не удалось сгенерировать PDF. Проверьте консоль для подробностей.');
        // В случае ошибки также возвращаем видимость элементам
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.getElementById('exportCsvButton').classList.remove('pdf-hidden'); // Возвращаем видимость кнопке Excel
        document.querySelector('h1').classList.remove('pdf-hidden');
    });
});
