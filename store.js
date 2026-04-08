const Store = {
    DB_NAME: 'equitable_db',

    getInitialState() {
        return {
            users: [
                { id: 'u1', name: 'Alex Rivers', email: 'alex@equitable.com', role: 'Admin', avatar: null },
                { id: 'u2', name: 'Sarah Chen', email: 'sarah@equitable.com', role: 'Member', avatar: null },
                { id: 'u3', name: 'Jordan Smyth', email: 'jordan@equitable.com', role: 'Member', avatar: null },
                { id: 'u4', name: 'Elena Rodriguez', email: 'elena@equitable.com', role: 'Member', avatar: null }
            ],
            expenses: [
                { id: 'e1', description: 'Grocery Haul - Whole Foods', amount: 214.50, payerId: 'u4', recipients: ['u1', 'u2', 'u3', 'u4'], date: '2023-10-24', settled: true, category: 'Dining & Groceries' },
                { id: 'e2', description: 'Electricity & Gas Bill', amount: 185.00, payerId: 'u1', recipients: ['u1', 'u2', 'u3', 'u4'], date: '2023-10-22', settled: false, category: 'Fixed Bills' },
                { id: 'e3', description: 'Internet Subscription', amount: 80.00, payerId: 'u2', recipients: ['u1', 'u2', 'u3', 'u4'], date: '2023-10-20', settled: true, category: 'Utilities' }
            ],
            currentUser: 'u1'
        };
    },

    save(data) {
        localStorage.setItem(this.DB_NAME, JSON.stringify(data));
    },

    load() {
        const data = localStorage.getItem(this.DB_NAME);
        if (!data) {
            const initialState = this.getInitialState();
            this.save(initialState);
            return initialState;
        }
        return JSON.parse(data);
    },

    clear() {
        localStorage.removeItem(this.DB_NAME);
    }
};
