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
let transactionsData = []; // Будет хранить все загруженные транзакции

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
                let value = null;
                const cell = row.c[index];

                if (cell) {
                    // В первую очередь пробуем использовать отформатированное значение 'f',
                    // если оно похоже на дату (например, "15.06.2025")
                    // Это самый надежный способ получить нужный формат сразу
                    if (cell.f && typeof cell.f === 'string' && /^\d{2}\.\d{2}\.\d{4}/.test(cell.f)) {
                        value = cell.f;
                    } else if (cell.v !== undefined) {
                        value = cell.v;
                    }
                }
                
                // Обработка специальных случаев для дат из поля 'v'
                // Google Sheets API возвращает даты в формате [год, месяц(0-11), день, час, минута, секунда] в поле 'v'
                if (Array.isArray(value) && value.length >= 3) { // Проверяем минимум на год, месяц, день
                    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
                    // Месяц в JavaScript Date начинается с 0 (январь=0), в Google Sheets месяц также 0-11
                    const date = new Date(year, month, day, hour, minute, second);
                    // Форматируем дату в читаемый строковый формат для России (ДД.ММ.ГГГГ ЧЧ:ММ:СС)
                    value = date.toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',    // Оставляем час, минуту, секунду для форматирования времени
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    // Удаляем время, если оно 00:00:00, чтобы осталось только ДД.ММ.ГГГГ
                    if (value.endsWith(' 00:00:00')) {
                        value = value.substring(0, value.length - 9); // Удаляем " 00:00:00"
                    }
                } else if (typeof value === 'string' && value.startsWith('Date(') && value.endsWith(')')) {
                    // Это обработка случая, если 'v' или 'f' пришел как строка типа "Date(2025,5,15)"
                    try {
                        const dateParts = value.substring(5, value.length - 1).split(',').map(Number);
                        if (dateParts.length >= 3) {
                            const year = dateParts[0];
                            const month = dateParts[1]; // Месяц в этой строке уже 0-индексирован от Google
                            const day = dateParts[2];
                            const hour = dateParts[3] || 0;
                            const minute = dateParts[4] || 0;
                            const second = dateParts[5] || 0;

                            const date = new Date(year, month, day, hour, minute, second);
                            value = date.toLocaleDateString('ru-RU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                             if (value.endsWith(' 00:00:00')) {
                                value = value.substring(0, value.length - 9);
                            }
                        }
                    } catch (parseError) {
                        console.warn('Could not parse date string (Date(Y,M,D) format):', value, parseError);
                        value = ''; // В случае ошибки парсинга, устанавливаем пустую строку
                    }
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
// Добавлен параметр `limit` для ограничения количества отображаемых записей
function renderTable(data, containerId, headersMap, uniqueByKey = null, tableClass = null, limit = 'all') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Контейнер с ID "${containerId}" не найден.`);
        return;
    }

    const loadingMessage = container.previousElementSibling;
    if (loadingMessage && loadingMessage.classList.contains('loading')) {
        loadingMessage.style.display = 'none';
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    let processedData = [...data]; // Создаем копию, чтобы не изменять исходные данные

    // Логика фильтрации для уникальных значений
    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = processedData.filter(row => {
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

    // Логика ограничения количества записей (для таблицы транзакций)
    if (limit !== 'all' && typeof limit === 'number' && processedData.length > limit) {
        // Берем последние N записей
        processedData = processedData.slice(-limit);
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

    const csvHeaders = headersMap.map(h => `"${h.label.replace(/"/g, '""')}"`).join(';');

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
        }).join(';');
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

// --- Функция: Экспорт всех таблиц в один Excel файл с несколькими листами ---
function exportToExcelMultipleSheets() {
    // Проверяем наличие данных
    if (!materialsData.length && !balancesData.length && !transactionsData.length) {
        alert('Нет данных для экспорта');
        return;
    }

    // Создаем новую рабочую книгу
    const workbook = XLSX.utils.book_new();

    // Лист 1: Материалы
    if (materialsData.length > 0) {
        const materialHeaders = [
            { key: 'ID', label: 'ID' },
            { key: 'Материал', label: 'Материал' },
            { key: 'Ед.изм.', label: 'Ед.изм.' },
            { key: 'Кол-во на складе', label: 'Кол-во на складе' },
            { key: 'Остаток', label: 'Остаток' },
            { key: 'Оповещение', label: 'Оповещение' }
        ];
        
        // Преобразуем данные в формат для XLSX
        const materialsForExport = materialsData.map(row => {
            const exportRow = {};
            materialHeaders.forEach(header => {
                exportRow[header.label] = row[header.key] || '';
            });
            return exportRow;
        });

        const materialsWorksheet = XLSX.utils.json_to_sheet(materialsForExport);
        XLSX.utils.book_append_sheet(workbook, materialsWorksheet, 'Материалы');
    }

    // Лист 2: Движение материалов
    if (balancesData.length > 0) {
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

        const balancesForExport = balancesData.map(row => {
            const exportRow = {};
            balancesHeaders.forEach(header => {
                exportRow[header.label] = row[header.key] || '';
            });
            return exportRow;
        });

        const balancesWorksheet = XLSX.utils.json_to_sheet(balancesForExport);
        XLSX.utils.book_append_sheet(workbook, balancesWorksheet, 'Движение материалов');
    }

    // Лист 3: Транзакции (с учетом фильтра)
    if (transactionsData.length > 0) {
        const transactionHeaders = [
            { key: 'Дата', label: 'Дата' },
            { key: 'Сотрудник', label: 'Сотрудник' },
            { key: 'Поставщик', label: 'Поставщик' },
            { key: 'Материал', label: 'Материал' },
            { key: 'Тип', label: 'Тип' },
            { key: 'Кол-во', label: 'Кол-во' },
            { key: 'Комментарий', label: 'Комментарий' },
            { key: 'Текущий остаток', label: 'Текущий остаток' }
        ];

        // Получаем текущий лимит для транзакций
        const transactionLimitSelect = document.getElementById('transaction-limit');
        const currentLimit = transactionLimitSelect ? (transactionLimitSelect.value === 'all' ? 'all' : parseInt(transactionLimitSelect.value)) : 10;
        
        let dataToExport = [...transactionsData];
        if (currentLimit !== 'all' && typeof currentLimit === 'number' && dataToExport.length > currentLimit) {
            dataToExport = dataToExport.slice(-currentLimit);
        }

        const transactionsForExport = dataToExport.map(row => {
            const exportRow = {};
            transactionHeaders.forEach(header => {
                exportRow[header.label] = row[header.key] || '';
            });
            return exportRow;
        });

        const transactionsWorksheet = XLSX.utils.json_to_sheet(transactionsForExport);
        XLSX.utils.book_append_sheet(workbook, transactionsWorksheet, 'Транзакции');
    }

    // Сохраняем файл
    const currentDate = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    const filename = `warehouse_report_${currentDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

// --- Загрузка и отображение данных при загрузке страницы (ЕДИНСТВЕННЫЙ DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем материалы -
    // ЗАГОЛОВКИ ДОЛЖНЫ БЫТЬ ТОЧНО ТАКИМИ ЖЕ, КАК В ВАШИХ GOOGLE ТАБЛИЦАХ (в UTF-8)!
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Материал', label: 'Материал' }, // Убедитесь, что 'Название' - точное название столбца в Google Sheets
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        // { key: 'Мин. остаток', label: 'Мин. остаток' }, // Если такого столбца нет, закомментируйте или удалите
        { key: 'Кол-во на складе', label: 'Кол-во на складе' },
        { key: 'Остаток', label: 'Остаток' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    const loadedMaterials = await loadGoogleSheetData(MATERIALS_URL);
    if (loadedMaterials) {
        materialsData = loadedMaterials;
        renderTable(materialsData, 'materials-table-container', materialHeaders, 'Материал', 'materials-table');
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
            
            // Создаем график после успешной загрузки данных
            createMovementChart(balancesData);
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
        { key: 'Текущий остаток', label: 'Текущий остаток' }
    ];
    const loadedTransactions = await loadGoogleSheetData(TRANSACTIONS_URL);
    if (loadedTransactions) {
        transactionsData = loadedTransactions; // Сохраняем все транзакции
        
        // Получаем выбранный лимит из выпадающего списка или используем значение по умолчанию (10)
        const transactionLimitSelect = document.getElementById('transaction-limit');
        const currentLimit = transactionLimitSelect ? (transactionLimitSelect.value === 'all' ? 'all' : parseInt(transactionLimitSelect.value)) : 10;

        renderTable(transactionsData, 'transactions-table-container', transactionHeaders, null, 'transactions-table', currentLimit);

        // Добавляем обработчик события для изменения лимита
        if (transactionLimitSelect) {
            transactionLimitSelect.addEventListener('change', (event) => {
                const newLimit = event.target.value === 'all' ? 'all' : parseInt(event.target.value);
                renderTable(transactionsData, 'transactions-table-container', transactionHeaders, null, 'transactions-table', newLimit);
            });
        }

    } else {
        const container = document.getElementById('transactions-table-container');
        if (container) container.innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        const loading = document.getElementById('transactions-loading');
        if (loading) loading.style.display = 'none';
    }

    // --- Обработчики кнопок ---
    const exportExcelButton = document.getElementById('exportExcelButton');
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', exportToExcelMultipleSheets);
    }

    const printPdfButton = document.getElementById('printPdfButton');
    if (printPdfButton) {
        printPdfButton.addEventListener('click', async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            const margin = 20;
            const element = document.querySelector('.container'); // Элемент, который нужно сохранить в PDF

            // Скрываем элементы управления перед созданием PDF
            const controls = document.querySelector('.controls');
            if (controls) controls.style.display = 'none';
            const transactionControls = document.querySelector('.transaction-controls');
            if (transactionControls) transactionControls.style.display = 'none';

            try {
                // Увеличиваем масштаб и улучшаем качество
                const canvas = await html2canvas(element, { 
                    scale: 1.5, // Увеличиваем масштаб для лучшего качества
                    useCORS: true,
                    allowTaint: true,
                    scrollX: 0,
                    scrollY: 0,
                    width: element.scrollWidth,
                    height: element.scrollHeight
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 595 - 2 * margin; // A4 width in pt minus margins
                const pageHeight = 842 - 2 * margin; // A4 height in pt minus margins
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;

                // Добавляем первую страницу
                doc.addImage(imgData, 'PNG', margin, margin + position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                // Добавляем дополнительные страницы при необходимости
                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', margin, margin + position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                const currentDate = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
                doc.save(`warehouse_report_${currentDate}.pdf`);
            } catch (error) {
                console.error('Ошибка при создании PDF:', error);
                alert('Не удалось создать PDF. Пожалуйста, попробуйте еще раз.');
            } finally {
                // Возвращаем видимость элементов управления
                if (controls) controls.style.display = 'flex'; // Предполагаем, что controls были flex
                if (transactionControls) transactionControls.style.display = 'block'; // Предполагаем, что transaction-controls были block
            }
        });
    }
});



// --- НОВАЯ ФУНКЦИЯ: Создание графика движения материалов ---
function createMovementChart(balancesData) {
    const chartLoading = document.getElementById('chart-loading');
    const chartContainer = document.getElementById('chart-container');
    
    if (!balancesData || balancesData.length === 0) {
        if (chartLoading) chartLoading.textContent = 'Нет данных для построения графика';
        return;
    }

    // Скрываем индикатор загрузки
    if (chartLoading) chartLoading.style.display = 'none';
    
    // Показываем контейнер с графиком
    if (chartContainer) chartContainer.style.display = 'block';

    // Подготавливаем данные для графика
    const labels = [];
    const incomingData = [];
    const outgoingData = [];

    balancesData.forEach(item => {
        if (item['Материал']) {
            labels.push(item['Материал']);
            
            // Получаем значения прихода и расхода, преобразуем в числа
            const incoming = parseFloat(item['Приход']) || 0;
            const outgoing = parseFloat(item['Расход']) || 0;
            
            incomingData.push(incoming);
            outgoingData.push(outgoing);
        }
    });

    // Конфигурация графика
    const ctx = document.getElementById('movementChart').getContext('2d');
    
    // Уничтожаем предыдущий график, если он существует
    if (window.movementChartInstance) {
        window.movementChartInstance.destroy();
    }

    window.movementChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Приход',
                    data: incomingData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Расход',
                    data: outgoingData,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Приход vs Расход по материалам',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Количество (ед.)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Материалы'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

