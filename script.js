// script.js

// Вставьте сюда ссылки на опубликованные CSV-файлы из вашей Google Таблицы
const MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=0'; // или другой GID для вашего листа "Материалы"
const BALANCES_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=1133040566'; // ЗАМЕНИТЕ НА СВОЙ РЕАЛЬНЫЙ URL!
const TRANSACTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/138AarGc1IgO2AQwxQ4b2I62zqd-6re63VWZAh55TTn4/gviz/tq?tqx=out:csv&gid=224436106'; // используйте свой GID


// Функция для загрузки CSV-данных с помощью Papa Parse
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

// Функция для отображения данных в таблице
function renderTable(data, containerId, headersMap, uniqueByKey = null) {
    const container = document.getElementById(containerId);
    const loadingMessage = container.previousElementSibling;
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Данные отсутствуют.</p>';
        return;
    }

    let processedData = data;

    if (uniqueByKey && data.length > 0) {
        const seenKeys = new Set();
        processedData = data.filter(row => {
            const keyValue = row[uniqueByKey];
            if (keyValue === null || keyValue === undefined || seenKeys.has(keyValue)) {
                return false; 
            }
            seenKeys.add(keyValue);
            return true;
        });

        if (processedData.length === 0 && data.length > 0) {
            console.warn(`Все строки были отфильтрованы при попытке получить уникальные значения по ключу "${uniqueByKey}". Проверьте данные или ключ.`);
            container.innerHTML = `<p>Нет уникальных данных по полю "${headersMap.find(h => h.key === uniqueByKey)?.label || uniqueByKey}".</p>`;
            return;
        }
    }

    const table = document.createElement('table');
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
}

// Загрузка и отображение данных при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // - Загружаем материалы -
    const materialHeaders = [
        { key: 'ID', label: 'ID' },
        { key: 'Название', label: 'Материал' },
        { key: 'Ед.изм.', label: 'Ед.изм.' },
        //{ key: 'Мин. остаток', label: 'Мин. остаток' },
        { key: 'Кол-во на складе', label: 'Кол-во на складе' },
        { key: 'Остаток', label: 'Остаток' },
        { key: 'Оповещение', label: 'Оповещение' }
    ];
    const materialsData = await loadCsvData(MATERIALS_CSV_URL);
    if (materialsData) {
        renderTable(materialsData, 'materials-table-container', materialHeaders, 'Название');
    } else {
        document.getElementById('materials-table-container').innerHTML = '<p class="error-message">Не удалось загрузить данные о материалах. Проверьте URL или настройки публикации.</p>';
        document.getElementById('materials-loading').style.display = 'none';
    }

    // - Загружаем Остатки -
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
    let balancesData = await loadCsvData(BALANCES_CSV_URL);

    if (balancesData) {
        // --- ФИЛЬТРАЦИЯ ДАННЫХ ДЛЯ ТАБЛИЦЫ "ОСТАТКИ": показываем только материалы с остатком > 0 ---
        const quantityKey = 'Остаток'; // Имя столбца, по которому будем фильтровать.
                                        // Убедитесь, что оно ТОЧНО совпадает с именем столбца в вашей таблице.

        balancesData = balancesData.filter(row => {
            const quantity = row[quantityKey];
            return typeof quantity === 'number' && !isNaN(quantity) && quantity > 0;
        });

        if (balancesData.length === 0) {
            document.getElementById('balances-table-container').innerHTML = '<p>В данный момент нет материалов на складе (остаток > 0).</p>';
            document.getElementById('balances-loading').style.display = 'none';
            // Не нужно вызывать renderTable, так как данных нет
        } else {
            renderTable(balancesData, 'balances-table-container', balancesHeaders);
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
