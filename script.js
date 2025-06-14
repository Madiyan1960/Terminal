// Внутри вашего document.addEventListener('DOMContentLoaded', async () => { ... }
// ИЛИ в обработчике exportCsvButton

// Пример фильтрации перед вызовом exportToCsv:

document.getElementById('exportCsvButton').addEventListener('click', () => {
    // --- Фильтрация данных материалов ---
    const filteredMaterialsData = globalMaterialsData.filter(row => {
        // Предполагаем, что каждая валидная строка материала имеет непустой 'Название'
        // Или 'ID', если он всегда заполнен для реальных позиций.
        return row['Название'] !== null && row['Название'] !== '' && row['Название'] !== undefined;
        // Можно использовать row['ID'] если ID - это точный критерий
    });

    const materialHeadersForExport = [ /* ... ваши заголовки ... */ ];
    exportToCsv('материалы.csv', filteredMaterialsData, materialHeadersForExport); // Экспортируем отфильтрованные данные

    // --- Фильтрация данных транзакций ---
    const filteredTransactionsData = globalTransactionsData.filter(row => {
        // Предполагаем, что каждая валидная строка транзакции имеет непустой 'Материал'
        // Или 'Дата' если это хороший критерий
        return row['Материал'] !== null && row['Материал'] !== '' && row['Материал'] !== undefined;
    });

    const transactionHeadersForExport = [ /* ... ваши заголовки ... */ ];
    exportToCsv('транзакции.csv', filteredTransactionsData, transactionHeadersForExport); // Экспортируем отфильтрованные данные
});
