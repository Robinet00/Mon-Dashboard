// ==========================================
// 0. INITIALISATION SUPABASE
// ==========================================
const SUPABASE_URL = "https://nktxgfupohbntiaujhkz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdHhnZnVwb2hibnRpYXVqaGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjEwMDMsImV4cCI6MjEwNjY5NzAwM30.qkfj24D_i0CJeESsEx3MRW7c_claibcaQop6we0lrPQ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 1. CONFIGURATION & SCHÉMAS DE DONNÉES
// ==========================================

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

const DEFAULT_HASH = hashString("admin123"); 

const coreSchemas = {
    courses: {
        title: "🛒 Courses",
        type: "list",
        fields: [
            { name: "nom", label: "Article", type: "text", required: true },
            { name: "categorie", label: "Catégorie", type: "select", options: ["Nourriture", "Boissons", "Hygiène", "Maison", "Autre"] },
            { name: "quantite", label: "Quantité", type: "number", default: 1 },
            { name: "prix", label: "Prix estimé (€)", type: "number" },
            { name: "note", label: "Note", type: "text" }
        ]
    },
    achats: {
        title: "🛍️ Achats",
        type: "card",
        fields: [
            { name: "nom", label: "Nom de l'achat", type: "text", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "prix", label: "Prix (€)", type: "number" },
            { name: "lien", label: "Lien web (URL)", type: "url" },
            { name: "statut", label: "Statut", type: "select", options: ["À acheter", "Prévu", "Commandé", "Reçu"] }
        ]
    },
    budget: {
        title: "💰 Budget",
        type: "list",
        fields: [
            { name: "type", label: "Type d'opération", type: "select", options: ["Dépense", "Revenu"] },
            { name: "montant", label: "Montant (€)", type: "number", required: true },
            { name: "categorie", label: "Catégorie", type: "select", options: ["Courses", "Achats", "Logement", "Transport", "Abonnements", "Loisirs", "Salaire", "Autre"] },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "description", label: "Description", type: "text" }
        ]
    },
    wishlist: {
        title: "⭐ Wishlist",
        type: "card",
        fields: [
            { name: "nom", label: "Nom", type: "text", required: true },
            { name: "prix", label: "Prix (€)", type: "number" },
            { name: "lien", label: "Lien web", type: "url" },
            { name: "priorite", label: "Priorité", type: "select", options: ["Basse", "Moyenne", "Haute"] }
        ]
    },
    cadeaux: {
        title: "🎁 Cadeaux",
        type: "card",
        fields: [
            { name: "type", label: "Pour qui ?", type: "select", options: ["Pour moi", "À offrir"] },
            { name: "personne", label: "Personne (si à offrir)", type: "text" },
            { name: "idee", label: "Idée de cadeau", type: "text", required: true },
            { name: "prix", label: "Prix estimé (€)", type: "number" },
            { name: "statut", label: "Statut", type: "select", options: ["Idée", "À acheter", "Acheté", "Offert"] }
        ]
    },
    taches: {
        title: "✅ Tâches",
        type: "list",
        fields: [
            { name: "titre", label: "Tâche", type: "text", required: true },
            { name: "priorite", label: "Priorité", type: "select", options: ["Normale", "Haute", "Urgente"] },
            { name: "date", label: "Date limite", type: "date" }
        ]
    },
    projets: {
        title: "✈️ Voyages & Projets",
        type: "card",
        fields: [
            { name: "nom", label: "Nom du projet", type: "text", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "date_debut", label: "Date de début", type: "date" },
            { name: "budget", label: "Budget prévu (€)", type: "number" },
            { name: "statut", label: "Statut", type: "select", options: ["En préparation", "En cours", "Terminé"] }
        ]
    },
    notes: {
        title: "📝 Notes",
        type: "card",
        fields: [
            { name: "titre", label: "Titre", type: "text", required: true },
            { name: "contenu", label: "Contenu", type: "textarea", required: true }
        ]
    }
};

// ==========================================
// 2. GESTION DES DONNÉES (SUPABASE & BACKUP LOCAL)
// ==========================================

window.appState = window.appState || {
    isAuthenticated: false,
    currentView: 'dashboard',
    settings: {
        theme: 'light',
        passwordHash: DEFAULT_HASH
    },
    customLists: [],
    data: {}
};

async function loadData() {
    try {
        const { data, error } = await supabaseClient
            .from('dashboard_data')
            .select('content')
            .eq('id', 'main_config')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.warn("Erreur Supabase, repli sur localStorage:", error);
            loadDataFromLocalStorage();
        } else if (data && data.content) {
            appState.settings = data.content.settings || appState.settings;
            appState.customLists = data.content.customLists || [];
            appState.data = data.content.data || {};
            
            localStorage.setItem('personalDashboardData', JSON.stringify(data.content));
        } else {
            loadDataFromLocalStorage();
        }
    } catch (e) {
        console.error("Erreur de connexion Supabase:", e);
        loadDataFromLocalStorage();
    }
    
    const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
    for (let key in allSchemas) {
        if (!appState.data[key]) appState.data[key] = [];
    }
    
    applyTheme(appState.settings.theme);
    buildSidebar();
    renderCurrentView();
}

function loadDataFromLocalStorage() {
    const saved = localStorage.getItem('personalDashboardData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState.settings = parsed.settings || appState.settings;
            appState.customLists = parsed.customLists || [];
            appState.data = parsed.data || {};
        } catch (e) {
            console.error("Erreur lecture localStorage", e);
        }
    }
}

async function saveData() {
    const dataToSave = {
        settings: appState.settings,
        customLists: appState.customLists,
        data: appState.data
    };

    localStorage.setItem('personalDashboardData', JSON.stringify(dataToSave));

    try {
        const { error } = await supabaseClient
            .from('dashboard_data')
            .upsert({ 
                id: 'main_config', 
                content: dataToSave,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Erreur de sauvegarde Supabase:", error);
            showToast("Erreur de synchro cloud (sauvegardé en local)", "error");
        }
    } catch (e) {
        console.error("Erreur de connexion lors de la sauvegarde Supabase:", e);
    }
}

function getCustomSchemas() {
    let schemas = {};
    appState.customLists.forEach(list => {
        schemas[list.id] = {
            title: list.title,
            type: list.type || "card",
            fields: list.fields
        };
    });
    return schemas;
}

// ==========================================
// 3. INTERFACE UTILISATEUR
// ==========================================

function handleRoute() {
    let hash = window.location.hash.substring(1) || 'dashboard';
    appState.currentView = hash;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-item[href="#${hash}"]`);
    if(activeLink) activeLink.classList.add('active');
    
    closeMobileMenu();
    renderCurrentView();
}

function buildSidebar() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.innerHTML = `<li><a href="#dashboard" class="nav-item">🏠 Accueil</a></li>`;
    
    for (let key in coreSchemas) {
        nav.innerHTML += `<li><a href="#${key}" class="nav-item">${coreSchemas[key].title}</a></li>`;
    }
    
    if (appState.customLists.length > 0) {
        nav.innerHTML += `<li style="padding: 1rem 1.5rem 0.5rem; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Listes perso</li>`;
        appState.customLists.forEach(list => {
            nav.innerHTML += `<li><a href="#${list.id}" class="nav-item">${list.title}</a></li>`;
        });
    }
}

function renderCurrentView() {
    const content = document.getElementById('content-area');
    const toolbarActions = document.getElementById('toolbar-actions');
    if (!content || !toolbarActions) return;

    const view = appState.currentView;
    
    content.innerHTML = '';
    toolbarActions.innerHTML = '';
    
    if (view === 'dashboard') {
        document.getElementById('page-title').textContent = "🏠 Accueil (Dashboard)";
        renderDashboard(content);
    } 
    else if (view === 'settings') {
        document.getElementById('page-title').textContent = "⚙ Paramètres";
        renderSettings(content);
    }
    else {
        const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
        const schema = allSchemas[view];
        
        if (schema) {
            document.getElementById('page-title').textContent = schema.title;
            toolbarActions.innerHTML = `<button class="btn-primary" onclick="openModal('${view}')">+ Ajouter</button>`;
            
            if (view === 'budget') renderBudgetSummary(content);
            
            renderDataView(view, schema, content);
        } else {
            content.innerHTML = `<p>Section introuvable.</p>`;
        }
    }
}

function renderDataView(schemaKey, schema, container) {
    const data = appState.data[schemaKey] || [];
    
    if (data.length === 0) {
        container.innerHTML += `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Aucun élément pour le moment. Cliquez sur "Ajouter".</div>`;
        return;
    }

    let html = '';
    
    if (schema.type === 'list' || schemaKey === 'courses' || schemaKey === 'taches') {
        html += `<div class="list-container">`;
        data.forEach(item => {
            const isDone = item.achete || item.statut === 'Terminé' || item.statut === 'Acheté';
            const mainField = schema.fields[0].name;
            const title = item[mainField] || "Sans titre";
            
            html += `
            <div class="list-item ${isDone ? 'done' : ''}">
                <div class="item-info">
                    ${schemaKey === 'courses' ? `<input type="checkbox" class="item-checkbox" ${item.achete ? 'checked' : ''} onchange="toggleCheck('${schemaKey}', '${item.id}', 'achete')">` : ''}
                    ${schemaKey === 'taches' ? `<input type="checkbox" class="item-checkbox" ${item.statut === 'Terminé' ? 'checked' : ''} onchange="toggleTaskDone('${item.id}')">` : ''}
                    <div>
                        <div class="item-title" style="font-weight: 500;">${title}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            ${formatSubInfo(schemaKey, item)}
                        </div>
                    </div>
                </div>
                <div class="card-actions" style="border: none; padding: 0; margin: 0;">
                    <button class="icon-btn" onclick="openModal('${schemaKey}', '${item.id}')" title="Modifier">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('${schemaKey}', '${item.id}')" title="Supprimer" style="color: var(--danger);">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="grid-cards">`;
        data.forEach(item => {
            const mainField = schema.fields[0].name;
            const title = item[mainField] || "Sans titre";
            
            html += `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">${title}</span>
                    ${item.priorite === 'Haute' || item.priorite === 'Urgente' ? '<span class="badge high">Prioritaire</span>' : ''}
                </div>
                <div class="card-body">
                    ${formatCardContent(schema, item)}
                </div>
                <div class="card-actions">
                    <button class="icon-btn" onclick="openModal('${schemaKey}', '${item.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('${schemaKey}', '${item.id}')" style="color: var(--danger);">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML += html;
}

function formatSubInfo(key, item) {
    if (key === 'courses') return `${item.quantite || 1}x ${item.categorie || ''} ${item.prix ? '- '+item.prix+'€' : ''}`;
    if (key === 'budget') return `${item.date} | ${item.categorie} | <strong style="color: ${item.type==='Revenu'?'var(--success)':'var(--text-main)'}">${item.montant}€</strong>`;
    if (key === 'taches') return `Priorité: ${item.priorite || 'Normale'} ${item.date ? '| Échéance: '+item.date : ''}`;
    return '';
}

function formatCardContent(schema, item) {
    let html = '';
    schema.fields.forEach(f => {
        if (f.name === schema.fields[0].name || !item[f.name]) return;
        if (f.type === 'url') html += `<div><a href="${item[f.name]}" target="_blank" style="color: var(--primary);">🔗 Lien web</a></div>`;
        else if (f.type === 'textarea') html += `<div style="margin-top:0.5rem; white-space: pre-wrap;">${item[f.name]}</div>`;
        else if (f.name === 'prix' || f.name === 'budget' || f.name === 'montant') html += `<div><strong>${f.label}:</strong> ${item[f.name]} €</div>`;
        else html += `<div><strong>${f.label}:</strong> ${item[f.name]}</div>`;
    });
    return html;
}

// ==========================================
// 4. LE DASHBOARD (ACCUEIL)
// ==========================================

function renderDashboard(container) {
    const data = appState.data;
    
    const coursesCount = (data.courses || []).filter(i => !i.achete).length;
    const tachesCount = (data.taches || []).filter(i => i.statut !== 'Terminé').length;
    const projetsCount = (data.projets || []).filter(i => i.statut === 'En cours').length;
    
    let html = `
        <div class="dashboard-stats">
            <div class="stat-card" onclick="window.location.hash='#courses'" style="background: #3B82F6;">
                <div>🛒 Courses à faire</div>
                <div class="stat-value">${coursesCount}</div>
            </div>
            <div class="stat-card" onclick="window.location.hash='#taches'" style="background: #10B981;">
                <div>✅ Tâches actives</div>
                <div class="stat-value">${tachesCount}</div>
            </div>
            <div class="stat-card" onclick="window.location.hash='#projets'" style="background: #8B5CF6;">
                <div>✈️ Projets en cours</div>
                <div class="stat-value">${projetsCount}</div>
            </div>
        </div>
        
        <h2 style="margin: 2rem 0 1rem;">🔥 À ne pas oublier (Priorités)</h2>
        <div class="grid-cards">
    `;

    let urgents = [];
    if(data.taches) urgents.push(...data.taches.filter(t => (t.priorite === 'Haute' || t.priorite === 'Urgente') && t.statut !== 'Terminé').map(t => ({...t, _source: 'Tâche'})));
    if(data.wishlist) urgents.push(...data.wishlist.filter(w => w.priorite === 'Haute').map(w => ({...w, _source: 'Wishlist'})));
    
    if (urgents.length === 0) {
        html += `<p style="color: var(--text-muted); grid-column: 1/-1;">Rien d'urgent pour le moment. Détendez-vous ! ☕</p>`;
    } else {
        urgents.forEach(u => {
            html += `
            <div class="card" style="border-left: 4px solid var(--danger);">
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">${u._source}</div>
                <div class="card-title">${u.titre || u.nom}</div>
            </div>`;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderBudgetSummary(container) {
    const ops = appState.data.budget || [];
    let revenus = 0;
    let depenses = 0;
    
    ops.forEach(op => {
        const amount = parseFloat(op.montant) || 0;
        if(op.type === 'Revenu') revenus += amount;
        else depenses += amount;
    });
    
    const solde = revenus - depenses;
    
    container.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom: 2rem;">
            <div class="stat-card" style="background: var(--success);">
                <div>Revenus</div>
                <div class="stat-value">+${revenus.toFixed(2)} €</div>
            </div>
            <div class="stat-card" style="background: var(--danger);">
                <div>Dépenses</div>
                <div class="stat-value">-${depenses.toFixed(2)} €</div>
            </div>
            <div class="stat-card" style="background: ${solde >= 0 ? 'var(--primary)' : 'var(--warning)'};">
                <div>Solde restant</div>
                <div class="stat-value">${solde.toFixed(2)} €</div>
            </div>
        </div>
    `;
}

// ==========================================
// 5. MODALES ET FORMULAIRES DYNAMIQUES
// ==========================================

let currentEditContext = { schemaKey: null, itemId: null };

function openModal(schemaKey, itemId = null) {
    currentEditContext = { schemaKey, itemId };
    const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
    const schema = allSchemas[schemaKey];
    
    document.getElementById('modal-title').textContent = itemId ? `Modifier : ${schema.title}` : `Ajouter : ${schema.title}`;
    
    let itemData = {};
    if (itemId) {
        itemData = appState.data[schemaKey].find(i => i.id === itemId) || {};
    }

    const form = document.getElementById('dynamic-form');
    let formHtml = '';

    schema.fields.forEach(field => {
        const val = itemData[field.name] !== undefined ? itemData[field.name] : (field.default || '');
        const required = field.required ? 'required' : '';
        
        formHtml += `<div class="form-group"><label>${field.label}</label>`;
        
        if (field.type === 'textarea') {
            formHtml += `<textarea name="${field.name}" rows="3" ${required}>${val}</textarea>`;
        } else if (field.type === 'select') {
            formHtml += `<select name="${field.name}">`;
            field.options.forEach(opt => {
                formHtml += `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`;
            });
            formHtml += `</select>`;
        } else {
            formHtml += `<input type="${field.type}" name="${field.name}" value="${val}" ${required} ${field.type==='number'?'step="any"':''}>`;
        }
        formHtml += `</div>`;
    });

    form.innerHTML = formHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

const dynamicForm = document.getElementById('dynamic-form');
if (dynamicForm) {
    dynamicForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const newItem = { id: currentEditContext.itemId || generateId() };
        
        if(currentEditContext.itemId) {
            const existing = appState.data[currentEditContext.schemaKey].find(i => i.id === currentEditContext.itemId);
            Object.assign(newItem, existing);
        }

        for (let [key, value] of formData.entries()) {
            newItem[key] = value;
        }
        
        const arr = appState.data[currentEditContext.schemaKey];
        if (currentEditContext.itemId) {
            const index = arr.findIndex(i => i.id === currentEditContext.itemId);
            arr[index] = newItem;
            showToast("Modification enregistrée", "success");
        } else {
            arr.push(newItem);
            showToast("Élément ajouté", "success");
        }
        
        await saveData();
        closeModal();
        renderCurrentView();
    });
}

async function deleteItem(schemaKey, itemId) {
    if (confirm("Voulez-vous vraiment supprimer cet élément ?")) {
        appState.data[schemaKey] = appState.data[schemaKey].filter(i => i.id !== itemId);
        await saveData();
        showToast("Élément supprimé", "success");
        renderCurrentView();
    }
}

async function toggleCheck(schemaKey, itemId, prop) {
    const item = appState.data[schemaKey].find(i => i.id === itemId);
    if(item) {
        item[prop] = !item[prop];
        await saveData();
        renderCurrentView();
    }
}

async function toggleTaskDone(itemId) {
    const item = appState.data['taches'].find(i => i.id === itemId);
    if(item) {
        item.statut = item.statut === 'Terminé' ? 'À faire' : 'Terminé';
        await saveData();
        renderCurrentView();
    }
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('dynamic-form');
    if (overlay) overlay.classList.add('hidden');
    if (form) form.reset();
}

const closeBtn = document.getElementById('close-modal-btn');
if (closeBtn) closeBtn.addEventListener('click', closeModal);

const cancelBtn = document.getElementById('modal-cancel-btn');
if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

// ==========================================
// 6. PARAMÈTRES, EXPORT, IMPORT ET THÈME
// ==========================================

function renderSettings(container) {
    container.innerHTML = `
        <div class="card" style="margin-bottom: 2rem;">
            <div class="card-header"><span class="card-title">🎨 Apparence</span></div>
            <div class="form-group">
                <label>Thème de l'application</label>
                <select id="theme-select" onchange="changeTheme(this.value)">
                    <option value="light" ${appState.settings.theme === 'light' ? 'selected' : ''}>Clair</option>
                    <option value="dark" ${appState.settings.theme === 'dark' ? 'selected' : ''}>Sombre</option>
                </select>
            </div>
        </div>

        <div class="card" style="margin-bottom: 2rem;">
            <div class="card-header"><span class="card-title">🔒 Sécurité</span></div>
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" id="new-password" placeholder="Laissez vide pour ne pas changer">
            </div>
            <button class="btn-primary" onclick="changePassword()">Mettre à jour le mot de passe</button>
        </div>

        <div class="card" style="margin-bottom: 2rem;">
            <div class="card-header"><span class="card-title">📋 Listes Personnalisées</span></div>
            <p style="font-size: 0.9rem; margin-bottom: 1rem;">Créez vos propres catégories de suivi !</p>
            <button class="btn-primary" onclick="promptCreateCustomList()">+ Créer une nouvelle liste</button>
            <div id="custom-lists-manager" style="margin-top: 1rem;"></div>
        </div>

        <div class="card" style="margin-bottom: 2rem; border-color: var(--danger);">
            <div class="card-header"><span class="card-title">💾 Données</span></div>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn-primary" onclick="exportData()">Exporter (JSON)</button>
                <label class="btn-secondary" style="cursor:pointer;">
                    Importer (JSON)
                    <input type="file" id="import-file" style="display:none;" accept=".json" onchange="importData(event)">
                </label>
                <button class="btn-danger" onclick="wipeData()">Réinitialiser TOUT</button>
            </div>
        </div>
    `;
    renderCustomListsManager();
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
}

async function changeTheme(theme) {
    appState.settings.theme = theme;
    applyTheme(theme);
    await saveData();
}

async function changePassword() {
    const input = document.getElementById('new-password').value;
    if (input) {
        appState.settings.passwordHash = hashString(input);
        await saveData();
        showToast("Mot de passe mis à jour", "success");
        document.getElementById('new-password').value = '';
    }
}

function exportData() {
    const dataStr = JSON.stringify({ settings: appState.settings, customLists: appState.customLists, data: appState.data });
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'dashboard_backup_' + new Date().toISOString().slice(0,10) + '.json';
    
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if(imported.data) {
                    if(confirm("Attention : L'importation va remplacer vos données actuelles. Continuer ?")) {
                        appState.settings = imported.settings || appState.settings;
                        appState.customLists = imported.customLists || [];
                        appState.data = imported.data;
                        await saveData();
                        showToast("Données importées avec succès", "success");
                        setTimeout(() => window.location.reload(), 1000);
                    }
                }
            } catch (err) {
                showToast("Fichier JSON invalide", "error");
            }
        };
        reader.readAsText(file);
    }
}

async function wipeData() {
    if(confirm("DANGER : Voulez-vous vraiment supprimer toutes vos données ? Cette action est irréversible.")) {
        if(confirm("Êtes-vous ABSOLUMENT certain ?")) {
            localStorage.removeItem('personalDashboardData');
            appState.data = {};
            appState.customLists = [];
            await saveData();
            window.location.reload();
        }
    }
}

async function promptCreateCustomList() {
    const name = prompt("Nom de la liste (ex: 🎬 Films à voir) :");
    if (!name) return;
    const listId = "list_" + generateId();
    
    const newList = {
        id: listId,
        title: name,
        type: "list",
        fields: [
            { name: "nom", label: "Nom / Titre", type: "text", required: true },
            { name: "note", label: "Note / Statut", type: "text" },
            { name: "lien", label: "Lien", type: "url" }
        ]
    };
    appState.customLists.push(newList);
    appState.data[listId] = [];
    await saveData();
    buildSidebar();
    renderSettings(document.getElementById('content-area'));
    showToast("Liste créée !", "success");
}

async function deleteCustomList(listId) {
    if(confirm("Supprimer cette liste personnalisée ET toutes les données qu'elle contient ?")) {
        appState.customLists = appState.customLists.filter(l => l.id !== listId);
        delete appState.data[listId];
        await saveData();
        buildSidebar();
        renderSettings(document.getElementById('content-area'));
    }
}

function renderCustomListsManager() {
    const container = document.getElementById('custom-lists-manager');
    if (!container) return;
    
    if(appState.customLists.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">Aucune liste personnalisée.</p>`;
        return;
    }
    let html = '<ul>';
    appState.customLists.forEach(l => {
        html += `<li style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border);">
            <span>${l.title}</span>
            <button class="icon-btn" style="color:var(--danger);" onclick="deleteCustomList('${l.id}')">🗑️️</button>
        </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// ==========================================
// 7. AUTHENTIFICATION SUPABASE & UTILITAIRES
// ==========================================

const lockScreen = document.getElementById('lock-screen');
const appScreen = document.getElementById('app-screen');

// Connexion via Supabase Auth
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        const errorEl = document.getElementById('login-error');

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            errorEl.textContent = "Identifiants incorrects";
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
            unlockApp();
        }
    });
}

// Vérification de la session au démarrage
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        unlockApp();
    } else {
        if (lockScreen) lockScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
    }

    window.addEventListener('hashchange', handleRoute);
}

function unlockApp() {
    appState.isAuthenticated = true;
    if (lockScreen) lockScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    loadData();
    handleRoute();
}

// Déconnexion Supabase
const lockBtn = document.getElementById('lock-btn');
if (lockBtn) {
    lockBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        appState.isAuthenticated = false;
        const passwordInput = document.getElementById('password-input');
        if (passwordInput) passwordInput.value = '';
        if (lockScreen) lockScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Menu Mobile
const hamburgerBtn = document.getElementById('hamburger-btn');
if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
    });
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

const closeSidebarBtn = document.getElementById('close-sidebar-btn');
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileMenu);

const sidebarOverlay = document.getElementById('sidebar-overlay');
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileMenu);

// DÉMARRAGE
window.addEventListener('DOMContentLoaded', initApp);
