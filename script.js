// script.js

// Вставьте сюда ссылки на опубликованные CSV-файлы из вашей Google Таблицы
// Важно: для первого листа (Материалы) часто не указывают gid, или он равен gid=0
const MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfvwx5ehWEL28ttSX5pWRsOV42VLBHrIWIs6pHB7F4nRp3wRb0f04Jq-pfrPtN0OWaBiEKCGzNCkN3/pub?gid=0&single=true&output=csv'; 
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vSfvwx5ehWEL28ttSX5pWRsOV42VLBHrIWIs6pHB7F4nRp3wRb0f04Jq-pfrPtN0OWaBiEKCGzNCkN3/pub?gid=224436106&single=true&output=csv'; 


// --- НОВАЯ ФУНКЦИЯ loadCsvData, использующая Papa Parse ---
async function loadCsvData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true, // Первая строка CSV - это заголовки
                dynamicTyping: true, // Автоматически преобразует числа и булевы значения
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

// --- УДАЛИТЕ ИЛИ ЗАКОММЕНТИРУЙТЕ ЭТУ СТАРУЮ ФУНКЦИЮ parseCsv() ---
/*
function parseCsv(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {
            const rowData = {};
            for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = currentLine[j] ? currentLine[j].trim().replace(/^"|"$/g, '') : '';
            }
            data.push(rowData);
        } else {
            console.warn(`Пропущена строка из-за несоответствия количества столбцов: ${lines[i]}`);
        }
    }
    return data;
}
*/
// --- Конец старой функции ---


// Функция для отображения данных в таблице (остается без изменений)
function renderTable(data, containerId, headersMap) {
    const container = document.getElementById(containerId);
    const loadingMessage = container.previousElementSibling;
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    const displayHeaders = headersMap || Object.keys(data[0]).map(key => ({ key, label: key }));

    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        headerRow.appendChild(th);
    });

    data.forEach(rowData => {
        const row = tbody.insertRow();
        displayHeaders.forEach(h => {
            const cell = row.insertCell();
            // Papa Parse может возвращать null/undefined для пустых ячеек, обрабатываем это
            cell.textContent = rowData[h.key] !== null && rowData[h.key] !== undefined ? rowData[h.key] : '';
        });
    });

    container.innerHTML = '';
    container.appendChild(table);
}

// Загрузка и отображение данных при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Внимание: 'key' в materialHeaders и transactionHeaders ДОЛЖЕН ТОЧНО СОВПАДАТЬ
    // с заголовками столбцов в вашем CSV-файле, включая пробелы и регистр.
    // Скачайте CSV-файл и проверьте первую строку, чтобы убедиться!
    
    // --- Загружаем материалы ---
    // Проверьте названия столбцов в вашем CSV для листа "Материалы"
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Название' },
        { key: 'Ед.изм.', label: 'Ед.изм.' }, // Если у вас такой столбец
        { key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Наличие (принято по акту ед.)', label: 'Наличие (принято по акту ед.)' }, // Это очень длинное название, убедитесь что оно ТОЧНО такое в CSV
        { key: 'Остаток', label: 'Остаток' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    const materialsData = await loadCsvData(MATERIALS_CSV_URL);
    if (materialsData) {
        renderTable(materialsData, 'materials-table-container', materialHeaders);
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
    }


    // --- Загружаем транзакции ---
    // Проверьте названия столбцов в вашем CSV для листа "Транзакции"
    const transactionHeaders = [
        { key: 'ID Транзакции', label: 'ID' }, // Проверьте точное название в CSV
        { key: 'Дата', label: 'Дата' },
        { key: 'Время', label: 'Время' },
        { key: 'Название Материала', label: 'Материал' }, // Проверьте точное название в CSV
        { key: 'Тип Операции', label: 'Тип' },
        { key: 'Количество', label: 'Кол-во' },
        { key: 'Сотрудник (ID/ФИО)', label: 'Сотрудник' }, // Проверьте точное название в CSV
        { key: 'Поставщик (ID/Название)', label: 'Поставщик' }, // Проверьте точное название в CSV
        { key: 'Примечание', label: 'Примечание' }
    ];
    const transactionsData = await loadCsvData(TRANSACTIONS_CSV_URL);
    if (transactionsData) {
        renderTable(transactionsData, 'transactions-table-container', transactionHeaders);
    } else {
        document.getElementById('transactions-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о транзакциях. Проверьте URL или настройки публикации.</p>';
        document.getElementById('transactions-loading').style.display = 'none';
    }
});


// --- Функция для сохранения страницы в PDF ---
document.getElementById('printPdfButton').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // 'p' - portrait, 'mm' - миллиметры, 'a4' - формат листа

    const container = document.querySelector('.container'); // Весь контент для печати

    // Скрываем элементы, которые не должны попасть в PDF
    document.getElementById('printPdfButton').classList.add('pdf-hidden'); // Скрываем саму кнопку
    document.querySelector('h1').classList.add('pdf-hidden'); // Скрываем общий заголовок

    html2canvas(container, {
        scale: 2, // Увеличиваем масштаб для лучшего качества PDF
        useCORS: true, // Важно, если есть изображения с других доменов
        logging: true // Для отладки
    }).then(canvas => {
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

        // Возвращаем видимость скрытым элементам
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.querySelector('h1').classList.remove('pdf-hidden');
    }).catch(error => {
        console.error('Ошибка при генерации PDF:', error);
        alert('Не удалось сгенерировать PDF. Проверьте консоль для подробностей.');
        // В случае ошибки возвращаем видимость элементам
        document.getElementById('printPdfButton').classList.remove('pdf-hidden');
        document.querySelector('h1').classList.remove('pdf-hidden');
    });
});
