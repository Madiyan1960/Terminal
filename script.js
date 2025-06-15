// script.js

// Вставьте сюда ссылки на опубликованные CSV-файлы из вашей Google Таблицы
const MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=0';
const BALANCES_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=1133040566'; // ЗАМЕНИТЕ НА СВОЙ РЕАЛЬНЫЙ GID!
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=224436106'; // ЗАМЕНИТЕ НА СВОЙ РЕАЛЬНЫЙ GID!

// Объявляем переменные для хранения данных таблиц в глобальной области видимости
let materialsData = [];
let balancesData = [];
let transactionsData = [];

// --- Функция для загрузки CSV-данных с помощью Papa Parse ---
async function loadCsvData(url) {
    if (!url) {
        console.error('URL для загрузки CSV не предоставлен.');
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
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

// --- Функция для отображения данных в таблице ---
// Добавлен параметр 'tableClass' для применения CSS-классов к создаваемой таблице
function renderTable(data, containerId, headersMap, uniqueByKey = null, tableClass = null) {
    const container = document.getElementById(containerId);
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


// --- Загрузка и отображение данных при загрузке страницы ---
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем материалы -
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Материал' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        // { key: 'Мин. остаток', label: 'Мин. остаток' }, // Если не нужно отображать, закомментируйте
        { key: 'Кол-во на складе', label: 'Кол-во на складе' },
        { key: 'Остаток', label: 'Остаток' }, // Убедитесь, что этот столбец действительно есть в CSV
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    const loadedMaterials = await loadCsvData(MATERIALS_CSV_URL);
    if (loadedMaterials) {
        materialsData = loadedMaterials; // Сохраняем данные в глобальную переменную
        renderTable(materialsData, 'materials-table-container', materialHeaders, 'Название', 'materials-table');
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
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
    const loadedBalances = await loadCsvData(BALANCES_CSV_URL);

    if (loadedBalances) {
        let tempBalancesData = loadedBalances;

        // --- ФИЛЬТРАЦИЯ ДАННЫХ ДЛЯ ТАБЛИЦЫ "ОСТАТКИ/ДВИЖЕНИЕ": показываем только материалы с остатком > 0 ---
        const quantityKey = 'Остаток'; // Имя столбца, по которому будем фильтровать.
                                        // Убедитесь, что оно ТОЧНО совпадает с именем столбца в вашей таблице.

        tempBalancesData = tempBalancesData.filter(row => {
            const quantity = row[quantityKey];
            // Проверяем, что это число, не NaN, и больше 0
            return typeof quantity === 'number' && !isNaN(quantity) && quantity > 0;
        });

        balancesData = tempBalancesData; // Сохраняем отфильтрованные данные в глобальную переменную

        if (balancesData.length === 0) { // Используем balancesData
            document.getElementById('balances-table-container').innerHTML = '<p>В данный момент нет материалов на складе (остаток > 0).</p>';
            document.getElementById('balances-loading').style.display = 'none';
        } else {
            renderTable(balancesData, 'balances-table-container', balancesHeaders, null, 'balances-table');
        }
    } else {
        document.getElementById('balances-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные об остатках. Проверьте URL или настройки публикации.</p>';
        document.getElementById('balances-loading').style.display = 'none';
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
    const loadedTransactions = await loadCsvData(TRANSACTIONS_CSV_URL);
    if (loadedTransactions) {
        transactionsData = loadedTransactions; // Сохраняем данные в глобальную переменную
        renderTable(transactionsData, 'transactions-table-container', transactionHeaders, null, 'transactions-table');
    } else {
        document.getElementById('transactions-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        document.getElementById('transactions-loading').style.display = 'none';
    }

    // --- Обработчик для кнопки "Экспорт в Excel" ---
    // Убедитесь, что эта кнопка добавлена в index.html с id="exportExcelButton"
    document.getElementById('exportExcelButton').addEventListener('click', () => {
        exportToCsv(materialsData, 'Материалы', materialHeaders);
        exportToCsv(balancesData, 'ДвижениеМатериалов', balancesHeaders); // или 'Остатки'
        exportToCsv(transactionsData, 'Транзакции', transactionHeaders);
    });
});


// --- Функция для сохранения страницы в PDF ---
document.getElementById('printPdfButton').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const container = document.querySelector('.container');

    // Скрываем элементы, которые не должны попасть в PDF
    document.getElementById('printPdfButton').classList.add('pdf-hidden');
    // Убедитесь, что этот H1 является общим заголовком страницы, а не заголовком таблицы
    document.querySelector('h1').classList.add('pdf-hidden');

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
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.querySelector('h1').classList.remove('pdf-hidden');
    }
});
