const app = {
    state: null,

    init() {
        this.state = Store.load();
        this.setupEventListeners();
        this.renderView('dashboard');
        this.updateTicker();
    },

    setupEventListeners() {
        // Navigation
        document.getElementById('main-nav').addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                e.preventDefault();
                this.renderView(navItem.dataset.view);
            }
        });

        // Add Member Form
        document.getElementById('add-member-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addMember();
        });

        // Add Expense Form
        document.getElementById('exp-amount').addEventListener('input', () => this.updateSplitPreview());
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Select All Split
        document.getElementById('select-all-split').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#split-members-list input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
            this.updateSplitPreview();
        });

        // History Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active', 'bg-white', 'shadow-sm', 'text-primary');
                    b.classList.add('text-slate-500');
                });
                btn.classList.add('active', 'bg-white', 'shadow-sm', 'text-primary');
                btn.classList.remove('text-slate-500');
                this.renderHistory(btn.dataset.filter);
            });
        });

        // Deep link handling
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            if (hash) this.renderView(hash);
        });
    },

    renderView(viewId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show target view
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.style.display = 'block';
            window.location.hash = viewId;
        }

        // Update Nav UI
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.view === viewId) {
                item.classList.add('text-blue-700', 'font-bold', 'bg-blue-50/50');
                item.classList.remove('text-slate-600');
            } else {
                item.classList.remove('text-blue-700', 'font-bold', 'bg-blue-50/50');
                item.classList.add('text-slate-600');
            }
        });

        // Render specific view data
        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'history') this.renderHistory();
        if (viewId === 'members') this.renderMembers();
        if (viewId === 'add-expense') this.renderAddExpenseForm();
    },

    // --- State Actions ---

    addMember() {
        const nameInput = document.getElementById('member-name');
        const emailInput = document.getElementById('member-email');
        
        const newMember = {
            id: 'u' + Date.now(),
            name: nameInput.value,
            email: emailInput.value,
            role: 'Member',
            avatar: null
        };

        this.state.users.push(newMember);
        Store.save(this.state);
        
        nameInput.value = '';
        emailInput.value = '';
        
        this.renderMembers();
        this.updateTicker();
    },

    editMember(userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (!user) return;

        const newName = prompt("Enter new name:", user.name);
        const newEmail = prompt("Enter new email:", user.email);

        if (newName !== null) user.name = newName;
        if (newEmail !== null) user.email = newEmail;

        Store.save(this.state);
        this.renderMembers();
        this.renderDashboard();
        this.updateTicker();
    },

    deleteMember(userId) {
        if (userId === this.state.currentUser) return alert("Cannot delete yourself!");
        this.state.users = this.state.users.filter(u => u.id !== userId);
        Store.save(this.state);
        this.renderMembers();
        this.updateTicker();
    },

    addExpense() {
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const description = document.getElementById('exp-description').value;
        const payerId = document.getElementById('exp-payer').value;
        const date = document.getElementById('exp-date').value;
        
        const recipientCheckboxes = document.querySelectorAll('#split-members-list input[type="checkbox"]:checked');
        const recipients = Array.from(recipientCheckboxes).map(cb => cb.value);

        if (recipients.length === 0) return alert("Please select at least one person to split with!");

        const newExpense = {
            id: 'e' + Date.now(),
            description,
            amount,
            payerId,
            recipients,
            date: date || new Date().toISOString().split('T')[0],
            settled: false,
            category: 'General'
        };

        this.state.expenses.push(newExpense);
        Store.save(this.state);
        
        document.getElementById('expense-form').reset();
        this.renderView('dashboard');
        this.updateTicker();
    },

    settleExpense(expenseId) {
        const exp = this.state.expenses.find(e => e.id === expenseId);
        if (exp) {
            exp.settled = true;
            Store.save(this.state);
            this.renderHistory();
            this.renderDashboard();
            this.updateTicker();
        }
    },

    // --- Calculations ---

    calculateBalances() {
        const balances = {}; // userId -> net balance
        this.state.users.forEach(u => balances[u.id] = 0);

        this.state.expenses.forEach(exp => {
            if (exp.settled) return;

            const share = exp.amount / exp.recipients.length;
            
            // Payer is "owed" the amount except their own share
            balances[exp.payerId] += (exp.amount - share);

            // Recipients "owe" their share (if not the payer)
            exp.recipients.forEach(rid => {
                if (rid !== exp.payerId) {
                    balances[rid] -= share;
                }
            });
        });

        return balances;
    },

    // --- Rendering ---

    renderDashboard() {
        const balances = this.calculateBalances();
        const myBalance = balances[this.state.currentUser] || 0;

        document.getElementById('total-net-balance').textContent = `$${myBalance.toFixed(2)}`;
        document.getElementById('total-net-balance').className = `text-6xl font-black tracking-tight mb-6 ${myBalance < 0 ? 'text-red-200' : 'text-white'}`;
        
        let totalOwed = 0;
        let totalOwe = 0;
        
        // Detailed owed/owe for "Me"
        this.state.users.forEach(u => {
            if (u.id === this.state.currentUser) return;
            const b = balances[u.id];
            // This is simplified. Real logic needs who owes WHOM specifically.
        });

        // Simplified for UI
        document.getElementById('stat-owed').textContent = `$${Math.max(0, myBalance).toFixed(2)}`;
        document.getElementById('stat-owe').textContent = `$${Math.abs(Math.min(0, myBalance)).toFixed(2)}`;

        // Roommate Grid
        const grid = document.getElementById('roommate-grid');
        grid.innerHTML = '';
        
        this.state.users.forEach(u => {
            if (u.id === this.state.currentUser) return;
            
            const b = balances[u.id];
            const statusLabel = b <= 0 ? 'Owes you' : 'Is Owed';
            const colorClass = b <= 0 ? 'text-primary' : 'text-tertiary';
            const bgClass = b <= 0 ? 'bg-blue-50' : 'bg-tertiary-fixed/20';

            const card = document.createElement('div');
            card.className = 'bg-surface-container-lowest p-6 rounded-2xl transition-all hover:bg-surface-bright group border border-slate-50 shadow-sm';
            card.innerHTML = `
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                        ${u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                        <p class="font-bold text-on-surface">${u.name}</p>
                        <span class="text-[10px] uppercase tracking-wider font-bold ${colorClass} ${bgClass} px-2 py-0.5 rounded">${statusLabel}</span>
                    </div>
                </div>
                <div class="space-y-1">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${statusLabel === 'Owes you' ? 'Amount owed' : 'You owe'}</p>
                    <p class="text-2xl font-black font-headline ${colorClass}">$${Math.abs(b).toFixed(2)}</p>
                </div>
                <button class="w-full mt-6 py-2 text-xs font-bold text-slate-400 bg-slate-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-100">Send Reminder</button>
            `;
            grid.appendChild(card);
        });

        // Recent Activity
        const recentTable = document.getElementById('recent-activity-table');
        recentTable.innerHTML = '';
        this.state.expenses.slice(-5).reverse().forEach(exp => {
            const payer = this.state.users.find(u => u.id === exp.payerId);
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors group';
            row.innerHTML = `
                <td class="px-6 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                             <span class="material-symbols-outlined text-sm">receipt_long</span>
                        </div>
                        <div>
                            <p class="font-bold text-sm">${exp.description}</p>
                            <p class="text-[11px] text-slate-400 font-medium">Paid by ${payer ? payer.name : 'Unknown'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-5">
                    <span class="px-2 py-1 ${exp.settled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'} text-[10px] font-bold rounded uppercase">
                        ${exp.settled ? 'Settled' : 'Pending'}
                    </span>
                </td>
                <td class="px-6 py-5 text-right">
                    <p class="text-sm font-black">$${exp.amount.toFixed(2)}</p>
                </td>
            `;
            recentTable.appendChild(row);
        });
    },

    renderHistory(filter = 'all') {
        const table = document.getElementById('full-history-table');
        table.innerHTML = '';
        
        let filtered = this.state.expenses;
        if (filter === 'pending') filtered = filtered.filter(e => !e.settled);
        if (filter === 'settled') filtered = filtered.filter(e => e.settled);

        filtered.slice().reverse().forEach(exp => {
            const payer = this.state.users.find(u => u.id === exp.payerId);
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors group';
            row.innerHTML = `
                <td class="px-8 py-6">
                    <p class="text-sm font-semibold text-on-surface">${exp.date}</p>
                </td>
                <td class="px-8 py-6">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <span class="material-symbols-outlined text-sm">payments</span>
                        </div>
                        <p class="text-sm font-bold font-headline text-on-surface">${exp.description}</p>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <span class="text-sm font-medium text-on-surface">${payer ? payer.name : 'Unknown'}</span>
                </td>
                <td class="px-8 py-6">
                    <span class="text-sm font-black font-headline">$${exp.amount.toFixed(2)}</span>
                </td>
                <td class="px-8 py-6">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${exp.settled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
                        ${exp.settled ? 'Settled' : 'Pending'}
                    </span>
                </td>
                <td class="px-8 py-6 text-right">
                    ${!exp.settled ? `<button onclick="app.settleExpense('${exp.id}')" class="text-[11px] font-black text-primary hover:underline">Settle</button>` : ''}
                </td>
            `;
            table.appendChild(row);
        });
    },

    renderMembers() {
        const table = document.getElementById('members-list-table');
        table.innerHTML = '';
        
        this.state.users.forEach(u => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors group';
            row.innerHTML = `
                <td class="px-8 py-5">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                             ${u.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <p class="font-bold text-on-surface">${u.name} ${u.id === this.state.currentUser ? '(You)' : ''}</p>
                            <p class="text-xs text-slate-400 font-medium">${u.role}</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <p class="text-sm font-medium text-on-surface">${u.email || 'No email'}</p>
                </td>
                <td class="px-8 py-5 text-right">
                    <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="p-2 hover:bg-slate-100 rounded-lg text-slate-400" onclick="app.editMember('${u.id}')">
                            <span class="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button class="p-2 hover:bg-slate-100 rounded-lg text-slate-400" onclick="app.deleteMember('${u.id}')">
                            <span class="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                    </div>
                </td>
            `;
            table.appendChild(row);
        });
    },

    renderAddExpenseForm() {
        // Payer select
        const payerSelect = document.getElementById('exp-payer');
        payerSelect.innerHTML = '';
        this.state.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.id === this.state.currentUser ? `You (${u.name})` : u.name;
            payerSelect.appendChild(opt);
        });

        // Split members list
        const splitList = document.getElementById('split-members-list');
        splitList.innerHTML = '';
        this.state.users.forEach(u => {
            const card = document.createElement('div');
            card.innerHTML = `
                <label class="flex flex-col items-center p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-primary has-[:checked]:bg-blue-50/30">
                    <input type="checkbox" value="${u.id}" checked class="hidden peer" onchange="app.updateSplitPreview()">
                    <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 mb-2 peer-checked:bg-primary peer-checked:text-white transition-colors">
                        ${u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span class="text-xs font-bold text-on-surface truncate w-full text-center">${u.id === this.state.currentUser ? 'You' : u.name.split(' ')[0]}</span>
                </label>
            `;
            splitList.appendChild(card);
        });

        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        this.updateSplitPreview();
    },

    updateSplitPreview() {
        const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
        const checked = document.querySelectorAll('#split-members-list input[type="checkbox"]:checked').length;
        const share = checked > 0 ? amount / checked : 0;
        document.getElementById('split-preview-text').textContent = `$${share.toFixed(2)} each`;
    },

    updateTicker() {
        const container = document.getElementById('ticker-container');
        container.innerHTML = '';
        const balances = this.calculateBalances();
        
        const items = [
            { label: 'System Status', value: 'Live & Operational', color: 'text-green-400' },
            { label: 'Household Members', value: `${this.state.users.length} Active`, color: 'text-blue-400' }
        ];

        this.state.users.forEach(u => {
            if (u.id === this.state.currentUser) return;
            const b = balances[u.id];
            if (b !== 0) {
                items.push({
                    label: u.name,
                    value: b < 0 ? `Owes You $${Math.abs(b).toFixed(2)}` : `Owed $${Math.abs(b).toFixed(2)}`,
                    color: b < 0 ? 'text-green-400' : 'text-red-400'
                });
            }
        });

        // Repeat items for seamless scroll
        const allItems = [...items, ...items];
        allItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2';
            div.innerHTML = `
                <span class="text-[10px] font-black uppercase tracking-widest opacity-50">${item.label}</span>
                <span class="text-xs font-bold font-headline ${item.color}">${item.value}</span>
            `;
            container.appendChild(div);
        });
    }
};

app.init();
window.app = app;
