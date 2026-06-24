// Common UI utilities

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Apply theme immediately on load
applyTheme();

function applyRoleStyles() {
    const user = getCurrentUser();
    if (!user) return;

    // Sidebar and Navigation links visibility based on role
    document.querySelectorAll('.role-admin, .role-manager, .role-staff').forEach(el => {
        const classes = Array.from(el.classList);
        const roleClass = `role-${user.role}`;
        if (!classes.includes(roleClass)) {
            el.classList.add('hidden');
        }
    });

    // Specific mapping for sidebar items
    const rolePermissions = {
        admin: ['nav-dashboard', 'nav-inventory', 'nav-production', 'nav-sales', 'nav-forecast', 'nav-reports', 'nav-users', 'nav-settings'],
        manager: ['nav-dashboard', 'nav-inventory', 'nav-sales', 'nav-forecast', 'nav-settings'],
        staff: ['nav-dashboard', 'nav-production', 'nav-settings']
    };

    const allowed = rolePermissions[user.role] || ['nav-dashboard'];
    document.querySelectorAll('.nav-menu li').forEach(li => {
        const id = li.id;
        if (id && !allowed.includes(id)) {
            li.classList.add('hidden');
        }
    });

    // Update display name and role badge
    const displayName = document.getElementById('display-name');
    const displayRole = document.getElementById('display-role');
    if (displayName) displayName.textContent = user.username;
    if (displayRole) displayRole.textContent = user.role.replace('_', ' ').toUpperCase();
}

// Grouped History UI Helpers
function groupActivitiesByDate(inventoryHistory, salesHistory) {
    const groups = {};
    
    inventoryHistory.forEach(h => {
        const d = new Date(h.rawDate);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!groups[ds]) groups[ds] = { date: ds, rawDate: h.rawDate, activities: [] };
        groups[ds].activities.push({ ...h, type: 'inventory' });
    });

    salesHistory.forEach(s => {
        const d = new Date(s.rawDate);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!groups[ds]) groups[ds] = { date: ds, rawDate: s.rawDate, activities: [] };
        groups[ds].activities.push({ ...s, type: 'sales' });
    });

    return Object.values(groups).sort((a, b) => b.rawDate - a.rawDate);
}

function openEditGroupModal(dateStr) {
    const log = getDailyLog(dateStr);
    const modal = document.getElementById('group-edit-modal');
    if (!modal) return;

    document.getElementById('edit-group-old-date').value = dateStr;
    document.getElementById('edit-group-date').value = dateStr;
    document.getElementById('edit-group-name').value = log.name;
    document.getElementById('edit-group-desc').value = log.description;
    
    modal.classList.add('active');
}

function closeEditGroupModal() {
    const modal = document.getElementById('group-edit-modal');
    if (modal) modal.classList.remove('active');
}

function handleGroupEditSubmit(e, callback) {
    e.preventDefault();
    const oldDate = document.getElementById('edit-group-old-date').value;
    const newDate = document.getElementById('edit-group-date').value;
    const name = document.getElementById('edit-group-name').value;
    const description = document.getElementById('edit-group-desc').value;

    if (oldDate !== newDate) {
        if (!confirm(`Moving this group will update all associated records to ${newDate}. Continue?`)) return;
        moveDailyLog(oldDate, newDate);
    }

    saveDailyLog(newDate, { name, description });
    closeEditGroupModal();
    if (callback) callback();
}

function populateDateFilter(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const inventoryHistory = getData('inventory_history');
    const salesHistory = getData('sales');
    const productionHistory = getData('production');
    
    const dates = new Set();
    
    [...inventoryHistory, ...salesHistory].forEach(h => {
        const d = new Date(h.rawDate);
        dates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    });

    productionHistory.forEach(p => {
        // Production dates might be strings like "MM/DD/YYYY" or "YYYY-MM-DD" depending on how they were saved
        // We'll try to normalize them
        const d = new Date(p.startDate);
        if (!isNaN(d)) {
            dates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        }
    });

    const sortedDates = Array.from(dates).sort().reverse();
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- All Dates --</option>';
    sortedDates.forEach(ds => {
        const opt = document.createElement('option');
        opt.value = ds;
        opt.textContent = new Date(ds).toLocaleDateString();
        select.appendChild(opt);
    });
    select.value = currentValue;
}

// Sidebar/Nav handling
function initSidebar() {
    const path = window.location.pathname;
    const page = path.split('/').pop();
    document.querySelectorAll('.nav-menu a').forEach(a => {
        if (a.getAttribute('href') === page) {
            a.classList.add('active');
        }
    });
}
