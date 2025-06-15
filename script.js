// script.js

// Вставьте сюда ссылки на опубликованные CSV-файлы из вашей Google Таблицы
// ИСПОЛЬЗУЕМ НОВЫЙ ФОРМАТ URL ДЛЯ CORS-СОВМЕСТИМОГО JSON
const SPREADSHEET_ID = '138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4';

const MATERIALS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
const BALANCES_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=1133040566`;
const TRANSACTIONS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=224436106`;

// Объявляем переменные для хранения данных таблиц в глобальной области видимости
let materialsData = [];
let balancesData = [];
let transactionsData = [];

// --- НОВАЯ ФУНКЦИЯ: Парсинг JSON-ответа от Google Sheets ---
function parseGoogleSheetJSON(jsonText) {
    // Google Sheets API returns JSON wrapped in "google.visualization.Query.setResponse(...);"
    const jsonString = jsonText.substring(jsonText.indexOf('{'), jsonText.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonString);

    const headers = data.table.cols.map(col => col.label || col.id);
    const rows = data.table.rows;

    const parsedData = rows.map(row => {
        const rowObject = {};
        headers.forEach((header, index) => {
            let value = row.c[index] ? row.c[index].v : null; // 'v' is the actual value
            // Handle specific data types if needed (e.g., dates)
            if (value === undefined || value === null) {
                value = ''; // Ensure empty string for null/undefined
            }
            rowObject[header] = value;
        });
        return rowObject;
    });

    return parsedData;
}

// --- Функция для загрузки данных (теперь для JSON) ---
async function loadGoogleSheetData(url) {
    if (!url) {
        console.error('URL для загрузки данных не предоставлен.');
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text(); // Fetch as text, then parse JSON manually
        return parseGoogleSheetJSON(text);

    } catch (error) {
        console.error('Ошибка загрузки данных Google Sheet:', error);
        return null;
    }
}

// --- Функция для отображения данных в таблице ---
// Добавлен параметр 'tableClass' для применения CSS-классов к создаваемой таблице
function renderTable(data, containerId, headersMap, uniqueByKey = null, tableClass = null) {
    const container = document.getElementById(containerId);
    // Проверяем, существует ли контейнер
    if (!container) {
        console.error(`Контейнер с ID "${containerId}" не найден.`);
        return;
    }

    const loadingMessage = container.previousElementSibling; // Предполагаем, что сообщение загрузки прямо перед контейнером

    if (loadingMessage) {
        loadingMessage.style.display = 'none'; // Скрываем сообщение о загрузке
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    let processedData = data;

    // Логика фильтрации для уникальных значений
    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = data.filter(row => {
            const keyValue = row[uniqueByKey];
            // Также проверяем на пустую строку для надежности
            if (keyValue === null || keyValue === undefined || keyValue === '' || seenKeys.has(keyValue)) {
                return false;
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            // Если после фильтрации данных не осталось, но исходные данные были
            const keyLabel = headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey;
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${keyLabel}". Проверьте данные или ключ.`);
            container.innerHTML = `<p>Нет уникальных данных по полю "${keyLabel}".</p>`;
            return;
        }
    }

    const table = document.createElement('table');
    if (tableClass) {
        table.classList.add(tableClass); // <--- Добавляем класс к таблице
    }
    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    const displayHeaders = headersMap || Object.keys(processedData[0]).map(key => ({ key, label: key }));

    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        headerRow.appendChild(th);
    });

    processedData.forEach(rowData => {
        const row = tbody.insertRow();
        displayHeaders.forEach(h => {
            const cell = row.insertCell();
            // Проверяем на null/undefined/пустую строку, чтобы отображать пустую строку, а не "null"
            cell.textContent = (rowData[h.key] !== null && rowData[h.key] !== undefined && rowData[h.key] !== '') ? rowData[h.key] : '';
        });
    });

    container.innerHTML = ''; // Очищаем контейнер перед добавлением таблицы
    container.appendChild(table);
}

// --- НОВАЯ ФУНКЦИЯ: Экспорт данных в CSV ---
// Эта функция останется без изменений, так как она работает с уже полученными данными.
function exportToCsv(data, filename, headersMap) {
    if (!data || data.length === 0) {
        console.warn(`Нет данных для экспорта в файл ${filename}.csv`);
        return;
    }

    // 1. Создаем строку заголовков CSV
    const csvHeaders = headersMap.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');

    // 2. Создаем строки данных CSV
    const csvRows = data.map(row => {
        return headersMap.map(h => {
            let value = row[h.key];
            if (value === null || value === undefined) {
                value = '';
            } else {
                value = String(value).replace(/"/g, '""');
                // Оборачиваем в кавычки, если значение содержит запятые, кавычки или переносы строк
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            return value;
        }).join(',');
    });

    // Объединяем заголовки и строки данных
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // 3. Создаем Blob и ссылку для скачивания
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Проверяем поддержку атрибута download
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden'; // Скрываем ссылку
        document.body.appendChild(link);
        link.click(); // Имитируем клик по ссылке
        document.body.removeChild(link); // Удаляем ссылку после клика
    }
}


// --- Загрузка и отображение данных при загрузке страницы (ЕДИНСТВЕННЫЙ DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем материалы -
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Материал' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        { key: 'Кол-во на складе', label: 'Кол-во на складе' },
        { key: 'Остаток', label: 'Остаток' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    // Используем новую функцию loadGoogleSheetData
    const loadedMaterials = await loadGoogleSheetData(MATERIALS_URL);
    if (loadedMaterials) {
        materialsData = loadedMaterials;
        renderTable(materialsData, 'materials-table-container', materialHeaders, 'Название', 'materials-table');
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        // Убедитесь, что 'materials-loading' существует в HTML
        const materialsLoading = document.getElementById('materials-loading');
        if (materialsLoading) materialsLoading.style.display = 'none';
    }

    // - Загружаем Движение материалов (Остатки) -
    const balancesHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Наличие (принято по акту ед.)', label: 'Кол-во на складе' },
        { key: 'Приход', label: 'Приход' },
        { key: 'Расход', label: 'Расход' },
        { key: 'Списание', label: 'Списание' },
        { key: 'Возврат', label: 'Возврат' },
        { key: 'Остаток', label: 'Остаток' }
    ];
    // Используем новую функцию loadGoogleSheetData
    const loadedBalances = await loadGoogleSheetData(BALANCES_URL);

    if (loadedBalances) {
        let tempBalancesData = loadedBalances;

        const quantityKey = 'Остаток';
        tempBalancesData = tempBalancesData.filter(row => {
            const quantity = row[quantityKey];
            return typeof quantity === 'number' && !isNaN(quantity) && quantity > 0;
        });

        balancesData = tempBalancesData;

        if (balancesData.length === 0) {
            document.getElementById('balances-table-container').innerHTML = '<p>В данный момент нет материалов на складе (остаток > 0).</p>';
            // Убедитесь, что 'balances-loading' существует в HTML
            const balancesLoading = document.getElementById('balances-loading');
            if (balancesLoading) balancesLoading.style.display = 'none';
        } else {
            renderTable(balancesData, 'balances-table-container', balancesHeaders, null, 'balances-table');
        }
    } else {
        document.getElementById('balances-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные об остатках. Проверьте URL или настройки публикации.</p>';
        // Убедитесь, что 'balances-loading' существует в HTML
        const balancesLoading = document.getElementById('balances-loading');
        if (balancesLoading) balancesLoading.style.display = 'none';
    }

    // --- Загружаем транзакции ---
    const transactionHeaders = [
        { key: 'Дата', label: 'Дата' },
        { key: 'Сотрудник', label: 'Сотрудник' },
        { key: 'Поставщик', label: 'Поставщик' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Тип', label: 'Тип' },
        { key: 'Кол-во', label: 'Кол-во' },
        { key: 'Комментарий', label: 'Комментарий' },
    ];
    // Используем новую функцию loadGoogleSheetData
    const loadedTransactions = await loadGoogleSheetData(TRANSACTIONS_URL);
    if (loadedTransactions) {
        transactionsData = loadedTransactions;
        renderTable(transactionsData, 'transactions-table-container', transactionHeaders, null, 'transactions-table');
    } else {
        document.getElementById('transactions-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        // Убедитесь, что 'transactions-loading' существует в HTML
        const transactionsLoading = document.getElementById('transactions-loading');
        if (transactionsLoading) transactionsLoading.style.display = 'none';
    }

    // --- Обработчики кнопок ---
    // Убедитесь, что кнопки с этими ID добавлены в ваш index.html
    const exportExcelButton = document.getElementById('exportExcelButton');
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', () => {
            exportToCsv(materialsData, 'Материалы', materialHeaders);
            exportToCsv(balancesData, 'ДвижениеМатериалов', balancesHeaders);
            exportToCsv(transactionsData, 'Транзакции', transactionHeaders);
        });
    } else {
        console.error('Кнопка "Экспорт в Excel" (id="exportExcelButton") не найдена.');
    }

    const printPdfButton = document.getElementById('printPdfButton');
    if (printPdfButton) {
        printPdfButton.addEventListener('click', async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            const container = document.querySelector('.container');

            // Скрываем элементы, которые не должны попасть в PDF
            printPdfButton.classList.add('pdf-hidden');
            const h1Element = document.querySelector('h1');
            if (h1Element) h1Element.classList.add('pdf-hidden');
            const controlsDiv = document.querySelector('.controls');
            if (controlsDiv) controlsDiv.classList.add('pdf-hidden');


            try {
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: true
                });

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 210; // Ширина A4 в мм
                const pageHeight = 297; // Высота A4 в мм
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;

                let position = 0;

                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight; // Corrected from pagePage
                }

                doc.save('Отчет_Склад.pdf');

            } catch (error) {
                console.error('Ошибка при генерации PDF:', error);
                alert('Не удалось сгенерировать PDF. Проверьте консоль для подробностей.');
            } finally {
                // Возвращаем видимость скрытым элементам в любом случае
                printPdfButton.classList.remove('pdf-hidden');
                if (h1Element) h1Element.classList.remove('pdf-hidden');
                if (controlsDiv) controlsDiv.classList.remove('pdf-hidden');
            }
        });
    } else {
        console.error('Кнопка "Сохранить в PDF" (id="printPdfButton") не найдена.');
    }
});
