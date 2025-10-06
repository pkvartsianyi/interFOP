        // Глобальні змінні
        let transactions = [];
        const PRIVATBANK_API_URL = "/";
        
        // --- Утиліти для роботи з датою та форматуванням ---

        /**
         * Перетворює YYYY-MM-DD на DD.MM.YYYY для API ПриватБанку.
         * @param {string} dateString - Дата у форматі 'YYYY-MM-DD'.
         * @returns {string} Дата у форматі 'DD.MM.YYYY'.
         */
        function formatDateForAPI(dateString) {
            const [year, month, day] = dateString.split('-');
            return `${day}.${month}.${year}`;
        }

        /**
         * Визначає, до якого кварталу належить дата.
         * @param {string} dateString - Дата у форматі 'YYYY-MM-DD'.
         * @returns {string} Назва кварталу, наприклад, "2025 Q3".
         */
        function getQuarter(dateString) {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11
            let quarter = Math.floor(month / 3) + 1;
            return `${year} Q${quarter}`;
        }

        /**
         * Форматує число як грошову суму в UAH.
         * @param {number} amount - Сума.
         * @returns {string} Відформатована сума.
         */
        function formatUAH(amount) {
            return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 2 }).format(amount);
        }

        /**
         * Форматує число для вказаної валюти.
         * @param {number} amount - Сума.
         * @param {string} currencyCode - Код валюти (USD, EUR, тощо).
         * @returns {string} Відформатована сума.
         */
        function formatCurrency(amount, currencyCode) {
            return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 }).format(amount);
        }

        /**
         * Відображає повідомлення у полі повідомлень.
         * @param {string} message - Текст повідомлення.
         * @param {string} type - Тип: 'success', 'error', 'info', 'warning'.
         */
        function showMessage(message, type = 'info') {
            const box = document.getElementById('message-box');
            let bgColor, textColor, icon;
            
            switch (type) {
                case 'success':
                    bgColor = 'bg-green-100';
                    textColor = 'text-green-800';
                    icon = '✅';
                    break;
                case 'error':
                    bgColor = 'bg-red-100';
                    textColor = 'text-red-800';
                    icon = '❌';
                    break;
                case 'warning':
                    bgColor = 'bg-yellow-100';
                    textColor = 'text-yellow-800';
                    icon = '⚠️';
                    break;
                case 'info':
                default:
                    bgColor = 'bg-blue-100';
                    textColor = 'text-blue-800';
                    icon = 'ℹ️';
                    break;
            }
            
            box.className = `mt-4 p-3 rounded-lg text-sm font-medium flex items-center ${bgColor} ${textColor}`;
            box.innerHTML = `<span class="mr-2">${icon}</span> ${message}`;
            box.classList.remove('hidden');
        }

        function hideMessage() {
            document.getElementById('message-box').classList.add('hidden');
        }

        // --- Логіка API для отримання курсу ---

        /**
         * Запитує курс НБУ на вказану дату з API ПриватБанку.
         * @param {string} formattedDate - Дата у форматі DD.MM.YYYY.
         * @param {string} currencyCode - Код валюти (USD, EUR, тощо).
         * @returns {Promise<number>} Об'єкт з курсом.
         */
        async function fetchPrivatBankRate(formattedDate, currencyCode) {
            const url = `${PRIVATBANK_API_URL}?date=${formattedDate}`;
            
            // Використовуємо експоненційний відступ для надійності, хоча тут це менш критично, ніж для Gemini API
            const MAX_RETRIES = 3;
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`Помилка мережі або API: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    if (!data.exchangeRate || data.exchangeRate.length === 0) {
                        throw new Error("Відповідь API не містить обмінних курсів.");
                    }

                    // Шукаємо курс для потрібної валюти
                    const rateData = data.exchangeRate.find(rate => rate.currency === currencyCode);
                    
                    if (!rateData) {
                        throw new Error(`Курс для валюти ${currencyCode} на дату ${formattedDate} не знайдено.`);
                    }
                    
                    // Використовуємо saleRateNB (Національний Банк Курс Продажу)
                    const rate = rateData.saleRateNB; 
                    
                    if (!rate || rate <= 0) {
                        throw new Error(`Отримано недійсний курс НБУ (${rate}) для ${currencyCode}.`);
                    }

                    return rate;

                } catch (error) {
                    if (i === MAX_RETRIES - 1) {
                        throw new Error(`Не вдалося отримати курс з PrivatBank API. ${error.message}`);
                    }
                    // Експоненційний відступ перед повтором
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // --- Логіка додатку та рендеринг ---

        /**
         * Додає нову транзакцію.
         */
        async function addTransaction(event) {
            event.preventDefault();
            hideMessage();

            const dateInput = document.getElementById('date');
            const amountInput = document.getElementById('amount');
            const currencyInput = document.getElementById('currency');
            const addButton = document.getElementById('addButton');

            const date = dateInput.value;
            const amount = parseFloat(amountInput.value);
            const currencyCode = currencyInput.value;
            const formattedDate = formatDateForAPI(date);

            if (!date || isNaN(amount) || amount <= 0 || !currencyCode) {
                showMessage('Будь ласка, введіть коректну дату, суму та валюту.', 'warning');
                return;
            }

            // Блокування форми
            addButton.disabled = true;
            addButton.textContent = 'Запит курсу...';

            try {
                // 1. Отримати курс НБУ
                const rate = await fetchPrivatBankRate(formattedDate, currencyCode);
                
                // 2. Розрахунок доходу в UAH
                const amountUAH = amount * rate;

                // 3. Створення об'єкта транзакції
                const newTransaction = {
                    id: Date.now(),
                    date: date,
                    currency: currencyCode,
                    amount: amount,
                    rate: rate,
                    amountUAH: amountUAH,
                };
                
                transactions.push(newTransaction);

                // 4. Оновлення інтерфейсу
                renderTransactions();
                renderSummary();
                
                showMessage(`Успішно додано: ${formatCurrency(amount, currencyCode)} за курсом ${rate.toFixed(4)} UAH = ${formatUAH(amountUAH)}.`, 'success');

                // Очищення полів (крім дати)
                amountInput.value = '';

            } catch (error) {
                showMessage(error.message, 'error');
            } finally {
                // Розблокування форми
                addButton.disabled = false;
                addButton.textContent = 'Додати';
            }
        }
        
        /**
         * Видаляє транзакцію за ID.
         * @param {number} id - ID транзакції.
         */
        function deleteTransaction(id) {
            // Використовуємо кастомне модальне вікно замість confirm()
            if (window.confirm("Ви впевнені, що хочете видалити цей запис?")) {
                transactions = transactions.filter(t => t.id !== id);
                renderTransactions();
                renderSummary();
            }
        }


        /**
         * Рендерить таблицю транзакцій.
         */
        function renderTransactions() {
            const list = document.getElementById('transactions-list');
            list.innerHTML = '';
            
            if (transactions.length === 0) {
                list.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-gray-500 italic">Надходжень поки немає.</td></tr>';
                return;
            }

            // Сортуємо за датою (від новіших до старіших)
            const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedTransactions.forEach(t => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition duration-100';
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${t.date}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">${t.currency}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${formatCurrency(t.amount, t.currency)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${t.rate.toFixed(4)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-primary">${formatUAH(t.amountUAH)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="deleteTransaction(${t.id})" class="text-red-500 hover:text-red-700 transition duration-150 p-1 rounded-full hover:bg-red-50" title="Видалити">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </td>
                `;
                list.appendChild(row);
            });
        }

        /**
         * Розраховує та рендерить підсумки за кварталами.
         */
        function renderSummary() {
            const summaryContainer = document.getElementById('quarterly-summary');
            summaryContainer.innerHTML = '';
            
            const quarterlyTotals = transactions.reduce((acc, t) => {
                const quarter = getQuarter(t.date);
                acc[quarter] = (acc[quarter] || 0) + t.amountUAH;
                return acc;
            }, {});

            const sortedQuarters = Object.keys(quarterlyTotals).sort().reverse(); // Сортування від новіших кварталів

            if (sortedQuarters.length === 0) {
                summaryContainer.innerHTML = '<p class="col-span-4 text-center text-gray-500 italic">Додайте транзакції для розрахунку підсумків за кварталами.</p>';
                return;
            }

            // Додаємо картку із загальним річним доходом
            const totalAnnualUAH = sortedQuarters.reduce((sum, quarter) => sum + quarterlyTotals[quarter], 0);
            const totalCard = document.createElement('div');
            totalCard.className = 'bg-indigo-100 p-4 rounded-lg border border-indigo-300 col-span-2 lg:col-span-1';
            totalCard.innerHTML = `
                <p class="text-sm font-medium text-indigo-700">Загальний дохід (рік)</p>
                <p class="text-xl font-bold text-indigo-800 mt-1">${formatUAH(totalAnnualUAH)}</p>
                <p class="text-xs text-indigo-500 mt-1">Всі операції</p>
            `;
            summaryContainer.appendChild(totalCard);

            // Додаємо картки по кварталах
            sortedQuarters.forEach(quarterName => {
                const totalUAH = quarterlyTotals[quarterName];
                const card = document.createElement('div');
                card.className = 'bg-gray-50 p-4 rounded-lg border border-gray-200';
                card.innerHTML = `
                    <p class="text-sm font-medium text-gray-500">${quarterName} (Квартал)</p>
                    <p class="text-xl font-bold text-gray-800 mt-1">${formatUAH(totalUAH)}</p>
                    <p class="text-xs text-primary mt-1">Дохід для декларації</p>
                `;
                summaryContainer.appendChild(card);
            });
        }

        // Ініціалізація
        document.addEventListener('DOMContentLoaded', () => {
            renderSummary();
            renderTransactions();
            
            // Встановлюємо сьогоднішню дату як дефолтну
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('date').value = today;
        });

        // Глобальна функція для видалення (доступна з HTML)
        window.deleteTransaction = deleteTransaction;
        
    