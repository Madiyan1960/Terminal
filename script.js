// script.js

// Вставьте сюда ссылки на опубликованные CSV-файлы из вашей Google Таблицы
const MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfvwx5ehWEL28ttSX5pWRsOV42VLBHrIWIs6pHB7F4nRp3wRb0f04Jq-pfrPtN0OWaBiEKCGzNCkN3/pub?output=csv'; // Например: https://docs.google.com/spreadsheets/d/e/2PACX-1vR.../pub?gid=...&single=true&output=csv
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfvwx5ehWEL28ttSX5pWRsOV42VLBHrIWIs6pHB7F4nRp3wRb0f04Jq-pfrPtN0OWaBiEKCGzNCkN3/pub?gid=224436106&single=true&output=csv'; // Например: https://docs.google.com/spreadsheets/d/e/2PACX-1vR.../pub?gid=...&single=true&output=csv

// Функция для загрузки CSV и преобразования в массив объектов
async function loadCsvData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseCsv(csvText);
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        return null; // Возвращаем null в случае ошибки
    }
}

// Простая функция для парсинга CSV
function parseCsv(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== ''); // Удаляем пустые строки
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) { // Проверяем, что количество столбцов совпадает
            const rowData = {};
            for (let j = 0; j < headers.length; j++) {
                // Удаляем кавычки, если есть, и лишние пробелы
                rowData[headers[j]] = currentLine[j] ? currentLine[j].trim().replace(/^"|"$/g, '') : '';
            }
            data.push(rowData);
        } else {
            console.warn(`Пропущена строка из-за несоответствия количества столбцов: ${lines[i]}`);
        }
    }
    return data;
}

// Функция для отображения данных в таблице
function renderTable(data, containerId, headersMap) {
    const container = document.getElementById(containerId);
    const loadingMessage = container.previousElementSibling; // Элемент <p class="loading">
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none'; // Скрываем сообщение о загрузке
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = table.createTHead();
    const tbody = table.createTBody();
    const headerRow = thead.insertRow();

    // Создаем заголовки таблицы на основе headersMap (если предоставлен) или из первых ключей данных
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
            cell.textContent = rowData[h.key] || ''; // Отображаем данные по ключу
        });
    });

    container.innerHTML = ''; // Очищаем контейнер перед добавлением новой таблицы
    container.appendChild(table);
}

// Загрузка и отображение данных при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем материалы
    const materialsData = await loadCsvData(MATERIALS_CSV_URL);
    if (materialsData) {
        // Определяем, какие столбцы отображать и в каком порядке, и их названия
        const materialHeaders = [
            { key: 'ID', label: 'ID' },
            { key: 'Название', label: 'Название' },
            { key: 'Артикул', label: 'Артикул' },
            { key: 'Ед. измерения', label: 'Ед. изм.' }, // Убедитесь, что название в CSV совпадает
            { key: 'Мин. остаток', label: 'Мин. остаток' },
            { key: 'Текущий_Остаток', label: 'Остаток' }, // Возможно, у вас 'Текущий_Остаток'
            { key: 'Описание', label: 'Описание' }
        ];
        renderTable(materialsData, 'materials-table-container', materialHeaders);
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
    }


    // Загружаем транзакции
    const transactionsData = await loadCsvData(TRANSACTIONS_CSV_URL);
    if (transactionsData) {
        const transactionHeaders = [
            { key: 'ID Транзакции', label: 'ID' },
            { key: 'Дата', label: 'Дата' },
            { key: 'Время', label: 'Время' },
            { key: 'Название Материала', label: 'Материал' }, // Или 'ID Материала' если вы так решили
            { key: 'Тип Операции', label: 'Тип' },
            { key: 'Количество', label: 'Кол-во' },
            { key: 'Сотрудник (ID/ФИО)', label: 'Сотрудник' }, // Или фактическое название из CSV
            { key: 'Поставщик (ID/Название)', label: 'Поставщик' }, // Или фактическое название из CSV
            { key: 'Примечание', label: 'Примечание' }
        ];
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

    // Для лучшего отображения таблиц в PDF
    // Можно обернуть таблицы в div и передавать их по отдельности для сохранения
    // Или увеличить DPI для лучшего качества изображения

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
