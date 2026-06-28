// Store management for Vermicast Prototype

const DEFAULT_SETTINGS = {
    rop: 50,
    safetyStock: 20,
    leadTime: 5,
    alpha: 0.3
};

const DEFAULT_INVENTORY = [
    { id: 'v_cast', name: 'Vermicast', stock: 120, unit: 'sacks', type: 'product' }
];

const DEFAULT_USERS = [
    { username: 'admin', password: 'password123', role: 'admin', status: 'Active' },
    { username: 'staff1', password: 'password123', role: 'staff', status: 'Active' },
    { username: 'manager1', password: 'password123', role: 'manager', status: 'Active' }
];


function initData() {
    if (!localStorage.getItem('settings')) {
        localStorage.setItem('settings', JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem('inventory')) {
        localStorage.setItem('inventory', JSON.stringify(DEFAULT_INVENTORY));
    }
    if (!localStorage.getItem('sales')) {
        localStorage.setItem('sales', JSON.stringify([]));
    }
    if (!localStorage.getItem('production')) {
        localStorage.setItem('production', JSON.stringify([]));
    }
    if (!localStorage.getItem('users')) {
        localStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem('inventory_history')) {
        localStorage.setItem('inventory_history', JSON.stringify([]));
    }
    if (!localStorage.getItem('forecast_history')) {
        localStorage.setItem('forecast_history', JSON.stringify([]));
    }
    if (!localStorage.getItem('calendar_data')) {
        localStorage.setItem('calendar_data', JSON.stringify({}));
    }
    if (!localStorage.getItem('daily_logs')) {
        localStorage.setItem('daily_logs', JSON.stringify({}));
    }
}

function getData(key) {
    const data = localStorage.getItem(key);
    if (key === 'calendar_data' || key === 'daily_logs') return data ? JSON.parse(data) : {};
    return data ? JSON.parse(data) : [];
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Map legacy loadData/saveData to calendar_data for the forecast view
function loadData() { return getData('calendar_data'); }
function saveDataToCalendar(d) { saveData('calendar_data', d); }

// Daily Logs Metadata Helpers
function getDailyLog(dateStr) {
    const logs = getData('daily_logs');
    return logs[dateStr] || { name: '', description: '' };
}

function getAggregatedDataForDate(dateStr) {
    const sales = getData('sales');
    const history = getData('inventory_history');
    
    // Sum sales for this day
    const daySales = sales.reduce((sum, s) => {
        const d = new Date(s.rawDate);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return ds === dateStr ? sum + s.amount : sum;
    }, 0);

    // Get last stock level for v_cast on this day
    let lastStock = null;
    history.forEach(h => {
        if (h.itemId === 'v_cast') {
            const d = new Date(h.rawDate);
            const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (ds === dateStr) {
                lastStock = h.newStock;
            }
        }
    });

    // Fallback to previous day's stock if no activity today? 
    // For forecasting, we usually want the stock level at the END of that historical day.
    
    const calData = loadData();
    const manualData = calData[dateStr] || {};

    return {
        sales: daySales || manualData.sales || 0,
        stock: lastStock !== null ? lastStock : manualData.stock,
        isOffDay: manualData.isOffDay || false
    };
}

function saveDailyLog(dateStr, data) {
    const logs = getData('daily_logs');
    logs[dateStr] = { 
        name: data.name || '', 
        description: data.description || '' 
    };
    saveData('daily_logs', logs);
}

function moveDailyLog(oldDate, newDate) {
    if (oldDate === newDate) return;

    // 1. Move Metadata
    const logs = getData('daily_logs');
    if (logs[oldDate]) {
        logs[newDate] = logs[oldDate];
        delete logs[oldDate];
        saveData('daily_logs', logs);
    }

    // 2. Move Calendar Data
    const calData = loadData();
    if (calData[oldDate]) {
        // If target already exists, merge or overwrite. Here we merge sales.
        if (calData[newDate]) {
            calData[newDate].sales += calData[oldDate].sales;
            // Stock usually reflects end of day, so we'll take the one from the new date or old date
            calData[newDate].stock = calData[newDate].stock || calData[oldDate].stock;
        } else {
            calData[newDate] = calData[oldDate];
        }
        delete calData[oldDate];
        saveDataToCalendar(calData);
    }

    // 3. Update Individual Records (Sales and Inventory History)
    const targetDate = new Date(newDate);
    
    // Update Sales
    const sales = getData('sales');
    sales.forEach(s => {
        const d = new Date(s.rawDate);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (ds === oldDate) {
            // Keep time, change date
            d.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            s.rawDate = d.getTime();
            s.timestamp = d.toLocaleString();
            // Optional: update s.month if it's formatted as M/D/YYYY
        }
    });
    saveData('sales', sales);

    // Update Inventory History
    const history = getData('inventory_history');
    history.forEach(h => {
        const d = new Date(h.rawDate);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (ds === oldDate) {
            d.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            h.rawDate = d.getTime();
            h.timestamp = d.toLocaleString();
        }
    });
    saveData('inventory_history', history);
}

function updateStock(id, amount, note = 'Manual Adjustment') {
    const inventory = getData('inventory');
    const item = inventory.find(i => i.id === id);
    if (item) {
        item.stock += amount;
        saveData('inventory', inventory);
        
        // Log transaction
        const history = getData('inventory_history');
        history.push({
            itemId: id,
            itemName: item.name,
            change: amount,
            newStock: item.stock,
            note: note,
            timestamp: new Date().toLocaleString(),
            rawDate: Date.now()
        });
        saveData('inventory_history', history);
    }
}

function recordSale(month, amount) {
    const sales = getData('sales');
    const now = new Date();
    const ds = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    sales.push({ 
        month, 
        amount, 
        timestamp: now.toLocaleString(),
        rawDate: Date.now()
    });
    saveData('sales', sales);

    // Also sync to calendar_data
    const calData = loadData();
    if(!calData[ds]) calData[ds] = { sales: 0, stock: null, isOffDay: false };
    calData[ds].sales += amount;
    saveDataToCalendar(calData);
}

function saveForecastHistory(prediction, settings) {
    const history = getData('forecast_history');
    history.push({
        prediction: Math.round(prediction),
        alpha: settings.alpha,
        timestamp: new Date().toLocaleString(),
        rawDate: Date.now()
    });
    saveData('forecast_history', history);
}

async function loadTemplate(days) {
    // Legacy 7/30-day loader retained for backward compatibility.
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    return loadMonthTemplate(month, year, days);
}

async function loadMonthTemplate(monthIndex, year, legacyDays) {
    saveData('sales', []);
    saveData('production', []);
    saveData('inventory_history', []);
    saveData('forecast_history', []);
    saveDataToCalendar({});

    const daysInMonth = 30;
    const dayMs = 24 * 60 * 60 * 1000;
    const monthStart = new Date(year, monthIndex, 1, 12, 0, 0, 0).getTime();
    const settings = getSettings();

    const inventory = [
        { id: 'v_cast', name: 'Vermicast', stock: legacyDays === 7 ? 200 : 500, unit: 'Sacks', type: 'product' }
    ];
    saveData('inventory', inventory);

    let baseValue = 40;
    const calData = {};

    const HOLIDAY_DAYS = new Set([
        `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
        `${year}-${String(monthIndex + 1).padStart(2, '0')}-15`
    ]);

    for (let d = 1; d <= daysInMonth; d++) {
        const simTime = monthStart + ((d - 1) * dayMs);
        const date = new Date(simTime);
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const label = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = HOLIDAY_DAYS.has(ds);
        const isOffDay = isWeekend || isHoliday;

        let safeAmount = 0;
        const targetAmount = (() => {
            baseValue += (Math.random() * 5 - 2);
            if (baseValue > 80) baseValue = 80;
            return Math.max(10, Math.round(baseValue));
        })();

        const invBefore = getData('inventory');
        const vcastBefore = invBefore.find(x => x.id === 'v_cast');
        safeAmount = vcastBefore && vcastBefore.stock - targetAmount < 0
            ? Math.max(0, vcastBefore.stock)
            : targetAmount;

        const sales = getData('sales');
        sales.push({ month: label, amount: safeAmount, timestamp: date.toLocaleString(), rawDate: simTime });
        saveData('sales', sales);

        const currentInv = getData('inventory');
        const currentVStock = currentInv.find(x => x.id === 'v_cast').stock;
        calData[ds] = { sales: safeAmount, stock: currentVStock, isOffDay };

        const logs = getData('daily_logs');
        if (!logs[ds]) {
            let dayName, dayDesc;
            if (isHoliday) {
                dayName = 'Holiday';
                dayDesc = `Public holiday on ${label} — sales log entry recorded to keep history continuous.`;
            } else if (isWeekend) {
                dayName = 'Weekend (Off Day)';
                dayDesc = `Weekend on ${label} — sales log entry recorded to keep history continuous.`;
            } else if (d % 7 === 0) {
                dayName = 'Weekly Harvest';
                dayDesc = `Simulated weekly harvest and store delivery for ${label}.`;
            } else if (d % 3 === 0) {
                dayName = 'Store Delivery';
                dayDesc = `Simulated mid-cycle store delivery for ${label}.`;
            } else {
                dayName = 'Routine Operations';
                dayDesc = `Simulated routine operations for ${label}.`;
            }
            logs[ds] = { name: dayName, description: dayDesc };
            saveData('daily_logs', logs);
        }

        updateStock('v_cast', -safeAmount, `Daily Sale: ${label}`);

        if (d % 7 === 0) {
            const replenishQty = legacyDays === 7 ? 100 : 150;
            updateStock('v_cast', replenishQty, `Scheduled Production: ${label}`);

            const prod = getData('production');
            prod.push({ id: `B-SIM-${d}`, qty: replenishQty, startDate: date.toLocaleDateString(), status: 'Harvested' });
            saveData('production', prod);

            const updatedInv = getData('inventory');
            calData[ds].stock = updatedInv.find(x => x.id === 'v_cast').stock;
        }
    }
    saveDataToCalendar(calData);

    const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][monthIndex];
    alert(`Success: Loaded monthly template for ${monthName} ${year} (${daysInMonth} days). Open Forecast View and select this month to forecast.`);
    window.location.reload();
}

function getAvailableMonthTemplates() {
    return [
        { month: 5, year: 2025, label: 'June 2025' },
        { month: 7, year: 2025, label: 'August 2025' },
        { month: 4, year: 2025, label: 'May 2025' },
        { month: 9, year: 2025, label: 'October 2025' }
    ];
}

function getMonthsWithHistory() {
    const calData = getData('calendar_data');
    const months = {};
    Object.keys(calData).forEach(ds => {
        const [y, m] = ds.split('-');
        const key = `${y}-${m}`;
        if (!months[key]) months[key] = { year: parseInt(y), month: parseInt(m) - 1, dates: [] };
        months[key].dates.push(ds);
    });
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return Object.values(months)
        .sort((a, b) => (b.year - a.year) || (b.month - a.month))
        .map(x => ({
            key: `${x.year}-${String(x.month + 1).padStart(2, '0')}`,
            year: x.year,
            month: x.month,
            label: `${MONTHS[x.month]} ${x.year}`,
            dayCount: x.dates.length
        }));
}

function getSettings() {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
}

function getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

function checkAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
    }
    return user;
}
