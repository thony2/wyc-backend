<!DOCTYPE html>
<html lang="en-GB">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WYC | Principal Lead Management</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            /* Mandatory Palette */
            --brand-primary: #DE3848;
            --brand-dark: #2E2F36;
            --brand-light: #F0EEE4;
            --brand-neutral: #A2A8B0;
            
            /* Extended UI Palette */
            --bg-deep: #1A1B1F;
            --bg-card: #24252C;
            --bg-hover: #2F3039;
            --text-main: #E2E4E9;
            --text-dim: #8E95A2;
            --border-ui: rgba(255, 255, 255, 0.08);
            --shadow-sm: 0 2px 4px rgba(0,0,0,0.2);
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Inter', sans-serif; background: var(--bg-deep); color: var(--text-main); line-height: 1.5; overflow-x: hidden; }

        /* --- Layout --- */
        .app-shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
        
        /* --- Sidebar --- */
        .sidebar { 
            background: var(--brand-dark); 
            border-right: 1px solid var(--border-ui);
            padding: 32px 16px;
            display: flex;
            flex-direction: column;
        }

        .brand { 
            font-family: 'Cormorant Garamond', serif; 
            font-size: 1.6rem; 
            padding: 0 16px 40px;
            border-bottom: 1px solid var(--border-ui);
            margin-bottom: 24px;
        }

        .nav-link {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-radius: 8px;
            color: var(--brand-neutral);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            margin-bottom: 4px;
            transition: var(--transition);
        }

        .nav-link:hover, .nav-link.active { background: var(--bg-hover); color: white; }
        .nav-link.active { border-left: 4px solid var(--brand-primary); }
        .nav-link i { margin-right: 12px; width: 20px; text-align: center; }

        /* --- Main Content --- */
        main { padding: 40px; max-width: 1400px; margin: 0 auto; width: 100%; }
        
        .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .header-row h1 { font-family: 'Cormorant Garamond', serif; font-size: 2.2rem; }

        /* --- Executive Metrics --- */
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
            gap: 20px; 
            margin-bottom: 40px; 
        }

        .metric-card {
            background: var(--bg-card);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border-ui);
            position: relative;
            transition: var(--transition);
        }

        .metric-card:hover { transform: translateY(-2px); border-color: var(--brand-primary); }
        .metric-label { color: var(--brand-neutral); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .metric-value { font-size: 1.8rem; font-weight: 700; color: white; }
        .metric-trend { font-size: 0.8rem; margin-top: 8px; display: flex; align-items: center; gap: 4px; }
        .trend-up { color: #4ADE80; }

        /* --- Leads Table --- */
        .table-container {
            background: var(--bg-card);
            border-radius: 12px;
            border: 1px solid var(--border-ui);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
        }

        .filter-bar {
            padding: 20px 24px;
            background: rgba(255,255,255,0.02);
            border-bottom: 1px solid var(--border-ui);
            display: flex;
            gap: 16px;
            align-items: center;
        }

        .search-input {
            flex: 1;
            background: var(--brand-dark);
            border: 1px solid var(--border-ui);
            padding: 10px 16px;
            border-radius: 6px;
            color: white;
            font-family: inherit;
        }

        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { 
            background: rgba(0,0,0,0.1); 
            padding: 14px 24px; 
            font-size: 0.75rem; 
            text-transform: uppercase; 
            color: var(--brand-neutral); 
            font-weight: 600;
        }
        
        td { padding: 18px 24px; border-bottom: 1px solid var(--border-ui); font-size: 0.9rem; }
        tr:hover { background: var(--bg-hover); cursor: pointer; }

        /* --- Badges & Actions --- */
        .badge {
            padding: 4px 10px;
            border-radius: 99px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .status-new { background: rgba(222, 56, 72, 0.15); color: #FF6B6B; border: 1px solid rgba(222, 56, 72, 0.3); }
        .status-won { background: rgba(74, 222, 128, 0.1); color: #4ADE80; }

        .action-btns { display: flex; gap: 8px; }
        .btn-icon {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: grid;
            place-items: center;
            border: 1px solid var(--border-ui);
            color: var(--brand-neutral);
            transition: var(--transition);
        }
        .btn-icon:hover { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }

        /* --- Skeleton Loading Animation --- */
        @keyframes shimmer { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .skeleton { animation: shimmer 1.5s infinite; background: var(--bg-hover); border-radius: 4px; height: 1em; }
    </style>
</head>
<body>

<div class="app-shell">
    <aside class="sidebar">
        <div class="brand">West Yorkshire Carpets</div>
        <nav>
            <a href="#" class="nav-link active"><i class="fa-solid fa-grid-2"></i> Dashboard</a>
            <a href="#" class="nav-link"><i class="fa-solid fa-users"></i> Leads</a>
            <a href="#" class="nav-link"><i class="fa-solid fa-chart-line"></i> Analytics</a>
            <a href="#" class="nav-link"><i class="fa-solid fa-calendar"></i> Appointments</a>
        </nav>
        <div style="margin-top: auto;">
            <a href="#" class="nav-link"><i class="fa-solid fa-gear"></i> Settings</a>
        </div>
    </aside>

    <main>
        <header class="header-row">
            <div>
                <p style="color: var(--brand-neutral); font-size: 0.85rem;">Good morning, Admin</p>
                <h1>Sales Performance</h1>
            </div>
            <div class="action-btns">
                <button class="btn-icon" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
                <button style="background: var(--brand-primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    + New Lead
                </button>
            </div>
        </header>

        <section class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Total Pipeline</div>
                <div class="metric-value">£42,850</div>
                <div class="metric-trend trend-up"><i class="fa-solid fa-arrow-up"></i> 12% vs last month</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg. Response Time</div>
                <div class="metric-value">14m</div>
                <div class="metric-trend" style="color: var(--brand-neutral)">Top 5% in industry</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Conversion Rate</div>
                <div class="metric-value">24.2%</div>
                <div class="metric-trend trend-up"><i class="fa-solid fa-arrow-up"></i> 3.1%</div>
            </div>
        </section>

        <section class="table-container">
            <div class="filter-bar">
                <input type="text" class="search-input" placeholder="Quick search leads (Name, Postcode, Product)...">
                <select style="background: transparent; border: 1px solid var(--border-ui); color: white; padding: 8px; border-radius: 6px;">
                    <option>All Status</option>
                    <option>Hot Leads</option>
                </select>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Lead Details</th>
                        <th>Product</th>
                        <th>Status</th>
                        <th>Urgency</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="leads-table-body">
                    <tr>
                        <td>
                            <div style="font-weight: 600;">James Thompson</div>
                            <div style="font-size: 0.75rem; color: var(--brand-neutral);">LS1 2TP • 07700 900456</div>
                        </td>
                        <td><span style="color: var(--brand-neutral);">Carpet Fitting</span></td>
                        <td><span class="badge status-new">NEW REQUEST</span></td>
                        <td><span style="color: var(--brand-primary); font-size: 0.8rem;"><i class="fa-solid fa-bolt"></i> Urgent</span></td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon" title="Call"><i class="fa-solid fa-phone"></i></button>
                                <button class="btn-icon" title="Email"><i class="fa-solid fa-envelope"></i></button>
                                <button class="btn-icon" title="View Details"><i class="fa-solid fa-chevron-right"></i></button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    </main>
</div>

<script>
    // Principal State Management Mock
    const LeadManager = {
        init() {
            this.bindEvents();
            this.loadInitialData();
        },
        bindEvents() {
            // Global search with debouncing
            const search = document.querySelector('.search-input');
            search.addEventListener('input', (e) => this.handleSearch(e.target.value));
        },
        handleSearch(query) {
            // Logic for real-time filtering
            console.log('Filtering leads for:', query);
        },
        loadInitialData() {
            // Implementation for API calls with Skeleton States
        }
    };
    LeadManager.init();
</script>
</body>
</html>