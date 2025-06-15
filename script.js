// script.js

// Вставьте сюда ваши актуальные ссылки на опубликованные CSV-файлы из Google Таблиц.
// ОБЯЗАТЕЛЬНО: Получите эти ссылки через "Файл" -> "Поделиться" -> "Опубликовать в Интернете"
// и выберите формат ".csv". Ссылки должны начинаться с "/e/.../pub?gid=...".
const MATERIALS_CSV_URL = 'https://docs.google.com/sheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=0'; // ЗАМЕНИТЕ НА ВАШУ РЕАЛЬНУЮ ССЫЛКУ для материалов
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/sheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=224436106'; // ЗАМЕНИТЕ НА ВАШУ РЕАЛЬНУЮ ССЫЛКУ для транзакций


// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ХРАНЕНИЯ ЗАГРУЖЕННЫХ ДАННЫХ ---
// Эти переменные объявлены в глобальной области видимости, чтобы
// к ним мог получить доступ обработчик кнопки экспорта Excel.
let globalMaterialsData = [];
let globalTransactionsData = [];
// Также сохраним отфильтрованные данные для экспорта, если они отличаются от исходных
let exportedMaterialsData = [];


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
// Теперь она также ВОЗВРАЩАЕТ обработанные данные.
function renderTable(data, containerId, headersMap, uniqueByKey = null) {
    const container = document.getElementById(containerId);
    const loadingMessage = container.previousElementSibling; 
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none'; 
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют или таблица пуста.</p>';
        return []; // Возвращаем пустой массив, если данных нет
    }

    let processedData = data;

    // Логика для получения уникальных записей, если указан uniqueByKey
    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = data.filter(row => {
            const keyValue = row[uniqueByKey];
            if (keyValue === null || keyValue === undefined || String(keyValue).trim() === '' || seenKeys.has(keyValue)) {
                return false; 
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${uniqueByKey}". Проверьте данные или ключ.`);
            const keyLabel = headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey;
            container.innerHTML = `<p>Нет уникальных данных по полю "${keyLabel}".</p>`;
            return []; // Возвращаем пустой массив
        }
    }

    const table = document.createElement('table');
    const tableClass = containerId.replace('-table-container', ''); 
    table.classList.add(tableClass);


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
            cell.textContent = rowData[h.key] !== null && rowData[h.key] !== undefined ? rowData[h.key] : '';
        });
    });

    container.innerHTML = '';
    container.appendChild(table);

    return processedData; // Возвращаем обработанные данные
}


// --- ФУНКЦИЯ ДЛЯ ЭКСПОРТА ДАННЫХ В CSV (EXCEL) ---
function exportToCsv(filename, data, headersMap) {
    if (!data || data.length === 0) {
        alert(`Нет данных для экспорта в ${filename}. Пожалуйста, убедитесь, что таблица не пуста.`);
        return;
    }

    const headers = headersMap.map(h => h.label);

    const csvDataForUnparse = [];
    csvDataForUnparse.push(headers); 

    data.forEach(row => {
        const newRow = [];
        headersMap.forEach(h => {
            const value = row[h.key] !== null && row[h.key] !== undefined ? row[h.key] : '';
            newRow.push(value);
        });
        csvDataForUnparse.push(newRow);
    });

    const csvString = Papa.unparse(csvDataForUnparse, {
        quotes: true,  
        delimiter: ';', // Используем точку с запятой для совместимости с Excel
        newline: '\r\n' 
    });

    const BOM = '\uFEFF'; // UTF-8 BOM для корректного отображения в Excel
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename); 
        link.style.visibility = 'hidden'; 
        document.body.appendChild(link);
        link.click(); 
        document.body.removeChild(link); 
    } else {
        window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
    }
}


// Загрузка и отображение данных при загрузке страницы.
document.addEventListener('DOMContentLoaded', async () => {
    // --- Загружаем материалы ---
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Название' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        { key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Остаток', label: 'Количество' }, 
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    globalMaterialsData = await loadCsvData(MATERIALS_CSV_URL); 
    if (globalMaterialsData) {
        // Сохраняем обработанные (уникализированные) данные материалов для экспорта
        exportedMaterialsData = renderTable(globalMaterialsData, 'materials-table-container', materialHeaders, 'Название');
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
        exportedMaterialsData = []; // Устанавливаем пустой массив, если данные не загружены
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
document.getElementById('exportCsvButton').addEventListener('click', () => {
    // Для материалов используем уже обработанные данные, которые отображаются на странице
    const materialHeadersForExport = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Название' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        { key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Остаток', label: 'Количество' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    // Экспортируем данные, которые уже были уникализированы функцией renderTable
    exportToCsv('материалы.csv', exportedMaterialsData, materialHeadersForExport);

    // Для транзакций экспортируем все загруженные данные (без уникализации)
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
    const doc = new jsPDF('p', 'mm', 'a4'); 

    const container = document.querySelector('.container'); 

    document.getElementById('printPdfButton').classList.add('pdf-hidden');
    document.getElementById('exportCsvButton').classList.add('pdf-hidden'); 
    document.querySelector('h1').classList.add('pdf-hidden'); 

    html2canvas(container, {
        scale: 2,         
        useCORS: true,    
        logging: true     
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png'); 
        const imgWidth = 210; 
        const pageHeight = 297; 
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

        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.getElementById('exportCsvButton').classList.remove('pdf-hidden'); 
        document.querySelector('h1').classList.remove('pdf-hidden');
    }).catch(error => {
        console.error('Ошибка при генерации PDF:', error);
        alert('Не удалось сгенерировать PDF. Проверьте консоль для подробностей.');
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.getElementById('exportCsvButton').classList.remove('pdf-hidden'); 
        document.querySelector('h1').classList.remove('pdf-hidden');
    });
});
