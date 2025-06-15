// script.js

// Вставьте сюда ID вашей Google Таблицы
const SPREADSHEET_ID = '138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4';

// URL-ы для получения данных из Google Таблиц в формате JSON
// Используем Google Visualization API для обхода CORS и получения UTF-8 кодировки
const MATERIALS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
const BALANCES_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=1133040566`;
const TRANSACTIONS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=224436106`;

// Объявляем переменные для хранения данных таблиц в глобальной области видимости
let materialsData = [];
let balancesData = [];
let transactionsData = [];

// --- НОВАЯ ФУНКЦИЯ: Парсинг JSON-ответа от Google Sheets ---
// Google Sheets API возвращает JSON, обернутый в функцию "google.visualization.Query.setResponse(...);"
function parseGoogleSheetJSON(jsonText) {
    try {
        // Извлекаем чистый JSON-строку из ответа
        const jsonString = jsonText.substring(jsonText.indexOf('{'), jsonText.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);

        // Извлекаем заголовки (используем label, если есть, иначе id)
        const headers = data.table.cols.map(col => col.label || col.id);
        const rows = data.table.rows;

        const parsedData = rows.map(row => {
            const rowObject = {};
            headers.forEach((header, index) => {
                // 'v' содержит фактическое значение, 'f' - отформатированное (например, для дат)
                let value = row.c[index] ? (row.c[index].v !== undefined ? row.c[index].v : row.c[index].f) : null;

                // Обработка специальных случаев для дат: Google может возвращать их в специфическом формате
                // Пример формата: [2023, 10, 26, 0, 0, 0] для 26 ноября 2023
                if (Array.isArray(value) && value.length === 6) {
                    const [year, month, day, hour, minute, second] = value;
                    // Месяц в JavaScript Date начинается с 0 (январь=0), в Google Sheets месяц обычно 0-11
                    const date = new Date(year, month, day, hour, minute, second);
                    // Форматируем дату в читаемый строковый формат для России
                    value = date.toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                }
                
                // Преобразование булевых значений в читаемые строки (если необходимо)
                if (typeof value === 'boolean') {
                    value = value ? 'Да' : 'Нет';
                }

                // Обеспечиваем пустую строку для null/undefined/пустых значений
                if (value === undefined || value === null) {
                    value = '';
                }

                rowObject[header] = value;
            });
            return rowObject;
        });

        return parsedData;
    } catch (e) {
        console.error('Ошибка парсинга JSON от Google Sheet:', e, 'Исходный текст:', jsonText);
        return null;
    }
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
            // Если статус 404, это может быть проблема публикации или URL
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const text = await response.text(); // Fetch as text, then parse JSON manually
        return parseGoogleSheetJSON(text);

    } catch (error) {
        console.error('Ошибка загрузки данных Google Sheet:', error);
        // Дополнительная информация для отладки CORS/404
        if (error.message.includes('blocked by CORS policy') || error.message.includes('404')) {
             console.error("Возможно, URL неверен, или лист не опубликован должным образом, или есть проблемы с доступом. Убедитесь, что лист опубликован 'для всех, у кого есть ссылка'.");
        }
        return null;
    }
}

// --- Функция для отображения данных в таблице ---
function renderTable(data, containerId, headersMap, uniqueByKey = null, tableClass = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Контейнер с ID "${containerId}" не найден.`);
        return;
    }

    const loadingMessage = container.previousElementSibling;
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
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
            if (keyValue === null || keyValue === undefined || keyValue === '' || seenKeys.has(keyValue)) {
                return false;
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            const keyLabel = headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey;
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${keyLabel}". Проверьте данные или ключ.`);
            container.innerHTML = `<p>Нет уникальных данных по полю "${keyLabel}".</p>`;
            return;
        }
    }

    const table = document.createElement('table');
    if (tableClass) {
        table.classList.add(tableClass);
    }
    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    // Определяем заголовки для отображения. Если headersMap не предоставлен, используем ключи из первого объекта данных.
    const displayHeaders = headersMap && headersMap.length > 0 ? headersMap : Object.keys(processedData[0]).map(key => ({ key, label: key }));

    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        headerRow.appendChild(th);
    });

    processedData.forEach(rowData => {
        const row = tbody.insertRow();
        displayHeaders.forEach(h => {
            const cell = row.insertCell();
            cell.textContent = (rowData[h.key] !== null && rowData[h.key] !== undefined && rowData[h.key] !== '') ? rowData[h.key] : '';
        });
    });

    container.innerHTML = '';
    container.appendChild(table);
}

// --- Функция: Экспорт данных в CSV ---
function exportToCsv(data, filename, headersMap) {
    if (!data || data.length === 0) {
        console.warn(`Нет данных для экспорта в файл ${filename}.csv`);
        return;
    }

    const csvHeaders = headersMap.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');

    const csvRows = data.map(row => {
        return headersMap.map(h => {
            let value = row[h.key];
            if (value === null || value === undefined) {
                value = '';
            } else {
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            return value;
        }).join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Создаем Blob с явным указанием UTF-8 BOM для совместимости с Excel на Windows
    const BOM = '\uFEFF'; // UTF-8 BOM
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// --- Загрузка и отображение данных при загрузке страницы (ЕДИНСТВЕННЫЙ DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем материалы -
    // ЗАГОЛОВКИ ДОЛЖНЫ БЫТЬ ТОЧНО ТАКИМИ ЖЕ, КАК В ВАШИХ GOOGLE ТАБЛИЦАХ (в UTF-8)!
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Материал' }, // Убедитесь, что 'Название' - точное название столбца в Google Sheets
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        // { key: 'Мин. остаток', label: 'Мин. остаток' }, // Если такого столбца нет, закомментируйте или удалите
        { key: 'Кол-во на складе', label: 'Кол-во на складе' },
        { key: 'Остаток', label: 'Остаток' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    const loadedMaterials = await loadGoogleSheetData(MATERIALS_URL);
    if (loadedMaterials) {
        materialsData = loadedMaterials;
        renderTable(materialsData, 'materials-table-container', materialHeaders, 'Название', 'materials-table');
    } else {
        const container = document.getElementById('materials-table-container');
        if (container) container.innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        const loading = document.getElementById('materials-loading');
        if (loading) loading.style.display = 'none';
    }

    // - Загружаем Движение материалов (Остатки) -
    // ЗАГОЛОВКИ ДОЛЖНЫ БЫТЬ ТОЧНО ТАКИМИ ЖЕ, КАК В ВАШИХ GOOGLE ТАБЛИЦАХ (в UTF-8)!
    const balancesHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Наличие (принято по акту ед.)', label: 'Кол-во на складе' }, // Возможно, это не совпадает с реальным заголовком в таблице.
                                                                           // Убедитесь, что 'Наличие (принято по акту ед.)' - точное название столбца.
        { key: 'Приход', label: 'Приход' },
        { key: 'Расход', label: 'Расход' },
        { key: 'Списание', label: 'Списание' },
        { key: 'Возврат', label: 'Возврат' },
        { key: 'Остаток', label: 'Остаток' }
    ];
    const loadedBalances = await loadGoogleSheetData(BALANCES_URL);

    if (loadedBalances) {
        let tempBalancesData = loadedBalances;

        const quantityKey = 'Остаток';
        tempBalancesData = tempBalancesData.filter(row => {
            const quantity = row[quantityKey];
            // Убедитесь, что Остаток - это число и больше 0
            return typeof quantity === 'number' && !isNaN(quantity) && quantity > 0;
        });

        balancesData = tempBalancesData;

        if (balancesData.length === 0) {
            const container = document.getElementById('balances-table-container');
            if (container) container.innerHTML = '<p>В данный момент нет материалов на складе (остаток > 0).</p>';
            const loading = document.getElementById('balances-loading');
            if (loading) loading.style.display = 'none';
        } else {
            renderTable(balancesData, 'balances-table-container', balancesHeaders, null, 'balances-table');
        }
    } else {
        const container = document.getElementById('balances-table-container');
        if (container) container.innerHTML = '<p class="error-message">Не удалось загрузить данные об остатках. Проверьте URL или настройки публикации.</p>';
        const loading = document.getElementById('balances-loading');
        if (loading) loading.style.display = 'none';
    }

    // --- Загружаем транзакции ---
    // ЗАГОЛОВКИ ДОЛЖНЫ БЫТЬ ТОЧНО ТАКИМИ ЖЕ, КАК В ВАШИХ GOOGLE ТАБЛИЦАХ (в UTF-8)!
    const transactionHeaders = [
        { key: 'Дата', label: 'Дата' },
        { key: 'Сотрудник', label: 'Сотрудник' },
        { key: 'Поставщик', label: 'Поставщик' },
        { key: 'Материал', label: 'Материал' },
        { key: 'Тип', label: 'Тип' },
        { key: 'Кол-во', label: 'Кол-во' },
        { key: 'Комментарий', label: 'Комментарий' },
    ];
    const loadedTransactions = await loadGoogleSheetData(TRANSACTIONS_URL);
    if (loadedTransactions) {
        transactionsData = loadedTransactions;
        renderTable(transactionsData, 'transactions-table-container', transactionHeaders, null, 'transactions-table');
    } else {
        const container = document.getElementById('transactions-table-container');
        if (container) container.innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        const loading = document.getElementById('transactions-loading');
        if (loading) loading.style.display = 'none';
    }

    // --- Обработчики кнопок ---
    const exportExcelButton = document.getElementById('exportExcelButton');
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', () => {
            exportToCsv(materialsData, 'Материалы', materialHeaders);
            exportToCsv(balancesData, 'ДвижениеМатериалов', balancesHeaders);
            exportToCsv(transactionsData, 'Транзакции', transactionHeaders);
        });
    } else {
        console.error('Кнопка "Экспорт в Excel" (id="exportExcelButton") не найдена. Убедитесь, что она есть в index.html.');
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
                    heightLeft -= pageHeight;
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
        console.error('Кнопка "Сохранить в PDF" (id="printPdfButton") не найдена. Убедитесь, что она есть в index.html.');
    }
});
