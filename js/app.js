/**
 * APP.JS - Moteur du Dashboard Personnel Privé (Version Corrigée et Sécurisée)
 */

const SUPABASE_URL = "https://nktxgfupohbntiaujhkz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdHhnZnVwb2hibnRpYXVqaGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjEwMDMsImV4cCI6MjEwNjY5NzAwM30.qkfj24D_i0CJeESsEx3MRW7c_claibcaQop6we0lrPQ";
const DEFAULT_HASH = "815024765";

let supabaseClient = null;

// ==========================================
// 1. DÉCLARATION GLOBALE & SÉCURITÉ
// ==========================================
// Initialisation propre de l'état global
let appState = window.appState || {
    isAuthenticated: false, currentView: 'dashboard', settings: { theme: 'light', passwordHash: DEFAULT_HASH }, customLists: [], data: {}
};

// Fonction de protection contre les failles XSS (Injections HTML)
const esc = (str) => {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') return String(str);
    return str.replace(/[&<>'"]/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[match]));
};

// ==========================================
// 2. SCHÉMAS DE DONNÉES ENRICHIS
// ==========================================
const coreSchemas = {
    courses: { title: "🛒 Courses", type: "custom", fields: [
        { name: "nom", label: "Article", type: "text", required: true },
        { name: "categorie", label: "Catégorie", type: "select", options: ["Alimentaire", "Maison", "Hygiène", "Animaux", "Informatique", "Autre"] },
        { name: "quantite", label: "Quantité", type: "number", default: 1 }
    ]},
    achats: { title: "🛍️ Achats", type: "custom", fields: [
        { name: "nom", label: "Nom de l'achat", type: "text", required: true },
        { name: "prix", label: "Prix (€)", type: "number" },
        { name: "date", label: "Date d'achat", type: "date" },
        { name: "categorie", label: "Catégorie", type: "select", options: ["Informatique", "Maison", "Loisirs", "Transport", "Alimentation", "Autre"] },
        { name: "lien", label: "Lien web", type: "url" }
    ]},
    budget: { title: "💰 Budget", type: "custom", fields: [
        { name: "type", label: "Type", type: "select", options: ["Dépense", "Revenu"] },
        { name: "montant", label: "Montant (€)", type: "number", required: true },
        { name: "categorie", label: "Catégorie", type: "select", options: ["Salaire", "Courses", "Loyer", "Abonnements", "Autre"] },
        { name: "date", label: "Date", type: "date", required: true }
    ]},
    wishlist: { title: "⭐ Wishlist", type: "custom", fields: [
        { name: "nom", label: "Nom", type: "text", required: true },
        { name: "prix", label: "Prix actuel (€)", type: "number" },
        { name: "prix_cible", label: "Prix cible (€)", type: "number" },
        { name: "lien", label: "Lien web", type: "url" },
        { name: "photo", label: "Photo (Optionnel)", type: "file" },
        { name: "priorite", label: "Priorité", type: "select", options: ["Basse", "Moyenne", "Haute"] }
    ]},
    cadeaux: { title: "🎁 Cadeaux", type: "custom", fields: [
        { name: "personne", label: "Pour qui ?", type: "text", required: true },
        { name: "idee", label: "Idée de cadeau", type: "text", required: true },
        { name: "prix", label: "Prix estimé (€)", type: "number" },
        { name: "statut", label: "Statut", type: "select", options: ["💡 Idée", "🛒 À acheter", "✅ Acheté", "🎁 Emballé"] }
    ]},
    taches: { title: "✅ Tâches", type: "custom", fields: [
        { name: "titre", label: "Titre", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "priorite", label: "Priorité", type: "select", options: ["⚪ Faible", "🟡 Normal", "🟠 Important", "🔴 Urgent"] },
        { name: "statut", label: "Statut", type: "select", options: ["À faire", "En cours", "Terminé"] },
        { name: "date", label: "Date limite", type: "date" }
    ]},
    projets: { title: "✈️ Projets & Voyages", type: "custom", fields: [
        { name: "nom", label: "Nom du projet", type: "text", required: true },
        { name: "type", label: "Type", type: "select", options: ["Projet", "Voyage"] },
        { name: "date_debut", label: "Date de début", type: "date" },
        { name: "date_fin", label: "Date de fin", type: "date" },
        { name: "budget", label: "Budget prévu (€)", type: "number" },
        { name: "photo", label: "Photo Principale", type: "file" },
        { name: "progression", label: "Progression (%)", type: "number" }
    ]},
    notes: { title: "📝 Notes", type: "card", fields: [
        { name: "titre", label: "Titre", type: "text", required: true },
        { name: "contenu", label: "Contenu", type: "textarea", required: true },
        { name: "epingler", label: "Épingler en haut", type: "select", options: ["Non", "Oui"] }
    ]}
};

// ==========================================
// 3. INITIALISATION ET SAUVEGARDE
// ==========================================
function generateId() { return Math.random().toString(36).substr(2, 9); }

async function initApp() {
    if (typeof supabase === 'undefined') return setTimeout(initApp, 100);
    if (!supabaseClient) supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Initialisation des événements globaux
    window.addEventListener('hashchange', handleRoute);
    setInterval(updateClock, 60000);

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await unlockApp();
    } else {
        document.getElementById('lock-screen').classList.remove('hidden');
    }
}

async function unlockApp() {
    appState.isAuthenticated = true;
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    await loadData();
    handleRoute(); // Lance l'affichage de la vue actuelle une fois les données chargées
}

async function loadData() {
    try {
        const { data } = await supabaseClient.from('dashboard_data').select('content').eq('id', 'main_config').single();
        if (data && data.content) {
            appState.settings = data.content.settings || appState.settings;
            appState.customLists = data.content.customLists || [];
            appState.data = data.content.data || {};
        }
    } catch (e) { console.warn("Mode local ou erreur de chargement", e); }
    
    const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
    for (let key in allSchemas) if (!appState.data[key]) appState.data[key] = [];
    
    document.body.setAttribute('data-theme', appState.settings.theme);
    buildSidebar();
}

async function saveData() {
    try {
        await supabaseClient.from('dashboard_data').upsert({ id: 'main_config', content: { settings: appState.settings, customLists: appState.customLists, data: appState.data } });
    } catch (e) { console.error("Erreur sauvegarde :", e); }
}

async function uploadFile(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${generateId()}.${fileExt}`;
    const { data, error } = await supabaseClient.storage.from('dashboard_assets').upload(fileName, file);
    if (error) { showToast("Erreur upload d'image", "error"); return null; }
    const { data: { publicUrl } } = supabaseClient.storage.from('dashboard_assets').getPublicUrl(fileName);
    return publicUrl;
}

// ==========================================
// 4. ROUTAGE ET RECHERCHE GLOBALE
// ==========================================
function getCustomSchemas() {
    let schemas = {};
    appState.customLists.forEach(list => { schemas[list.id] = { title: list.title, type: list.type || "card", fields: list.fields }; });
    return schemas;
}

function handleRoute() {
    if (!appState.isAuthenticated) return;
    appState.currentView = window.location.hash.substring(1) || 'dashboard';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-item[href="#${appState.currentView}"]`);
    if(activeLink) activeLink.classList.add('active');
    closeMobileMenu();
    renderCurrentView();
}

function handleGlobalSearch(query) {
    const container = document.getElementById('content-area');
    if(query.length < 2) return renderCurrentView();
    
    const q = query.toLowerCase();
    let resultsHTML = `<h2>Recherche : "${esc(query)}"</h2><div class="list-container" style="margin-top:1rem;">`;
    
    for (let key in appState.data) {
        appState.data[key].forEach(item => {
            const itemText = JSON.stringify(item).toLowerCase();
            if (itemText.includes(q)) {
                const title = item.nom || item.titre || item.personne || "Élément";
                resultsHTML += `
                <div class="search-result" onclick="window.location.hash='#${key}'">
                    <div>
                        <div style="font-size:0.8rem; color:var(--primary); font-weight:bold; text-transform:uppercase;">${esc(key)}</div>
                        <div>${esc(title)}</div>
                    </div>
                    <div>➡️</div>
                </div>`;
            }
        });
    }
    container.innerHTML = resultsHTML + `</div>`;
}

// ==========================================
// 5. MOTEUR DE RENDU DES PAGES
// ==========================================
function renderCurrentView() {
    const content = document.getElementById('content-area');
    const toolbarActions = document.getElementById('toolbar-actions');
    const view = appState.currentView;
    const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
    
    content.innerHTML = '';
    toolbarActions.innerHTML = '';
    document.getElementById('page-title').textContent = allSchemas[view] ? allSchemas[view].title : (view === 'settings' ? '⚙ Paramètres' : '🏠 Accueil');
    
    if (view === 'settings') return renderSettings(content);

    if (view === 'dashboard') {
        renderDashboardView(content);
    } else {
        // Protection : on n'affiche le bouton Ajouter que si le schéma existe
        if (allSchemas[view]) {
            toolbarActions.innerHTML = `<button class="btn-primary" onclick="openModal('${view}')">+ Ajouter</button>`;
        }
        
        if (view === 'courses') renderCoursesView(content);
        else if (view === 'achats') renderAchatsView(content);
        else if (view === 'budget') renderBudgetView(content);
        else if (view === 'taches') renderKanbanView(content);
        else if (view === 'projets') renderProjetsView(content);
        else if (view === 'cadeaux') renderCadeauxView(content);
        else if (view === 'wishlist') renderWishlistView(content);
        else if (allSchemas[view]) renderDataView(view, allSchemas[view], content);
        else content.innerHTML = '<p>Vue introuvable.</p>';
    }
}

function renderDashboardView(container) {
    const data = appState.data;
    
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = new Intl.DateTimeFormat('fr-FR', options).format(new Date());
    
    const urgentes = (data.taches || []).filter(t => t.statut !== 'Terminé' && (t.priorite === '🔴 Urgent' || t.priorite === '🟠 Important')).slice(0, 4);
    
    const currentMonth = new Date().toISOString().slice(0,7);
    let depensesMois = 0;
    (data.achats || []).forEach(a => { if(a.date && a.date.startsWith(currentMonth)) depensesMois += parseFloat(a.prix||0); });
    (data.budget || []).forEach(b => { if(b.type === 'Dépense' && b.date && b.date.startsWith(currentMonth)) depensesMois += parseFloat(b.montant||0); });
    
    let html = `
        <div class="dash-header">
            <div class="dash-greeting">Bonjour 👋</div>
            <div class="dash-date"><span style="text-transform: capitalize;">${dateStr}</span> — <span id="dash-clock"></span></div>
        </div>

        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
            <div class="card">
                <div class="card-header"><span class="card-title">🔴 Tâches Importantes</span></div>
                <div class="card-body">
                    ${urgentes.length === 0 ? '<p>Rien d\'urgent.</p>' : urgentes.map(t => `<div style="margin-bottom:0.5rem; display:flex; gap:0.5rem;"><input type="checkbox" onchange="toggleTaskDone('${t.id}')"> <span>${esc(t.titre)}</span></div>`).join('')}
                </div>
            </div>

            <div class="card" onclick="window.location.hash='#courses'" style="cursor:pointer;">
                <div class="card-header"><span class="card-title">🛒 Courses</span></div>
                <div class="card-body">
                    <h2 style="font-size:2rem; color:var(--text-main);">${(data.courses || []).filter(c => !c.achete).length}</h2>
                    <p>articles à acheter</p>
                </div>
            </div>

            <div class="card" onclick="window.location.hash='#budget'" style="cursor:pointer;">
                <div class="card-header"><span class="card-title">💰 Dépenses du mois</span></div>
                <div class="card-body">
                    <h2 style="font-size:2rem; color:var(--danger);">${depensesMois.toFixed(0)} €</h2>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header"><span class="card-title">✈ Projets Actifs</span></div>
                <div class="card-body">
                    ${(data.projets || []).slice(0,3).map(p => `
                        <div style="margin-bottom:1rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;"><span>${esc(p.nom)}</span> <span>${p.progression||0}%</span></div>
                            <div class="progress-container"><div class="progress-bar" style="width:${p.progression||0}%;"></div></div>
                        </div>
                    `).join('') || '<p>Aucun projet.</p>'}
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    updateClock();
}

function updateClock() {
    const el = document.getElementById('dash-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function renderCoursesView(container) {
    const items = appState.data.courses || [];
    const categories = [...new Set(items.map(i => i.categorie || 'Autre'))];
    
    let html = `
        <input type="text" placeholder="🔍 Rechercher un produit..." onkeyup="filterList(this.value, 'course-item')" style="max-width: 300px;">
    `;
    
    categories.forEach(cat => {
        const catItems = items.filter(i => (i.categorie || 'Autre') === cat);
        if(catItems.length === 0) return;
        
        html += `<div class="category-header">${esc(cat)}</div><div class="list-container">`;
        catItems.forEach(item => {
            html += `
            <div class="list-item course-item ${item.achete ? 'done' : ''}" data-title="${esc(item.nom).toLowerCase()}">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <input type="checkbox" style="width:20px; height:20px; accent-color:var(--primary);" ${item.achete ? 'checked' : ''} onchange="toggleCheck('courses', '${item.id}', 'achete')">
                    <strong>${esc(item.nom)}</strong> ${item.quantite > 1 ? `(x${item.quantite})` : ''}
                </div>
                <div>
                    <button class="icon-btn" onclick="openModal('courses', '${item.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('courses', '${item.id}')" style="color:var(--danger);">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

function renderKanbanView(container) {
    const tasks = appState.data.taches || [];
    const cols = { 'À faire': [], 'En cours': [], 'Terminé': [] };
    
    tasks.forEach(t => {
        if(cols[t.statut]) cols[t.statut].push(t);
        else cols['À faire'].push(t);
    });

    let html = `<div class="kanban-board">`;
    for(let status in cols) {
        html += `<div class="kanban-column">
            <div class="kanban-title">${esc(status)} <span>${cols[status].length}</span></div>
            <div class="kanban-items">`;
        cols[status].forEach(t => {
            const badgeClass = t.priorite.includes('Urgent') || t.priorite.includes('Important') ? 'urgent' : 'normal';
            html += `
            <div class="card" style="padding: 1rem;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem; display:flex; justify-content:space-between;">
                    <span class="badge ${badgeClass}">${esc(t.priorite)}</span>
                    <span>${t.date ? new Date(t.date).toLocaleDateString('fr-FR') : ''}</span>
                </div>
                <div style="font-weight:600; margin-bottom:0.5rem;">${esc(t.titre)}</div>
                <select onchange="updateTaskStatus('${t.id}', this.value)" style="margin:0; padding:0.4rem; font-size:0.8rem;">
                    <option value="À faire" ${status==='À faire'?'selected':''}>À faire</option>
                    <option value="En cours" ${status==='En cours'?'selected':''}>En cours</option>
                    <option value="Terminé" ${status==='Terminé'?'selected':''}>Terminé</option>
                </select>
                <div class="card-actions" style="margin-top:0.5rem; padding-top:0.5rem;">
                    <button class="icon-btn" onclick="openModal('taches', '${t.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('taches', '${t.id}')" style="color:var(--danger);">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderAchatsView(container) {
    const achats = (appState.data.achats || []).sort((a,b) => new Date(b.date) - new Date(a.date));
    let html = `<div class="grid-cards">`;
    achats.forEach(a => {
        html += `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${esc(a.nom)}</span>
                <span style="font-weight:800; font-size:1.2rem;">${a.prix} €</span>
            </div>
            <div class="card-body">
                <div>${esc(a.categorie)} | ${a.date ? new Date(a.date).toLocaleDateString('fr-FR') : ''}</div>
                ${a.lien ? `<a href="${esc(a.lien)}" target="_blank" style="color:var(--accent-blue);">🔗 Voir le lien</a>` : ''}
            </div>
            <div class="card-actions">
                <button class="icon-btn" onclick="openModal('achats', '${a.id}')">✏️</button>
                <button class="icon-btn" onclick="deleteItem('achats', '${a.id}')" style="color:var(--danger);">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html + `</div>`;
}

function renderBudgetView(container) {
    const achats = appState.data.achats || [];
    const budget = appState.data.budget || [];
    
    let totalRevenus = 0, totalDepenses = 0;
    
    budget.forEach(b => { if(b.type === 'Revenu') totalRevenus += parseFloat(b.montant||0); else totalDepenses += parseFloat(b.montant||0); });
    achats.forEach(a => { totalDepenses += parseFloat(a.prix||0); });
    
    const dispo = totalRevenus - totalDepenses;
    
    container.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom:2rem; display:flex; gap:1rem; flex-wrap:wrap;">
            <div class="card" style="flex:1; min-width:200px; border-color: var(--success);">
                <div style="color:var(--success); font-weight:bold;">Revenus Globaux</div>
                <div style="font-size:1.8rem; font-weight:800;">${totalRevenus} €</div>
            </div>
            <div class="card" style="flex:1; min-width:200px; border-color: var(--danger);">
                <div style="color:var(--danger); font-weight:bold;">Dépenses Globales</div>
                <div style="font-size:1.8rem; font-weight:800;">${totalDepenses} €</div>
            </div>
            <div class="card" style="flex:1; min-width:200px;">
                <div style="font-weight:bold;">Disponible</div>
                <div style="font-size:1.8rem; font-weight:800; color: ${dispo >= 0 ? 'var(--text-main)' : 'var(--danger)'};">${dispo} €</div>
            </div>
        </div>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:2rem;">💡 Les dépenses incluent automatiquement la liste des Achats.</p>
    `;
    renderDataView('budget', coreSchemas.budget, container);
}

function renderWishlistView(container) {
    const items = appState.data.wishlist || [];
    let html = `<div class="grid-cards">`;
    items.forEach(w => {
        const pCible = w.prix_cible ? `<div style="font-size:0.8rem; color:var(--success);">Cible: ${w.prix_cible}€</div>` : '';
        html += `
        <div class="card" style="padding:0; overflow:hidden;">
            ${w.photo ? `<img src="${esc(w.photo)}" style="width:100%; height:150px; object-fit:cover;">` : '<div style="height:20px;"></div>'}
            <div style="padding:1.5rem;">
                <div class="card-header">
                    <span class="card-title">${esc(w.nom)}</span>
                    <span class="badge ${w.priorite === 'Haute' ? 'urgent' : 'normal'}">${esc(w.priorite)}</span>
                </div>
                <div style="font-weight:800; font-size:1.5rem;">${w.prix || '-'} €</div>
                ${pCible}
                <div class="card-actions">
                    ${w.lien ? `<a href="${esc(w.lien)}" target="_blank" class="icon-btn">🔗</a>` : ''}
                    <button class="icon-btn" onclick="openModal('wishlist', '${w.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('wishlist', '${w.id}')" style="color:var(--danger);">🗑️</button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html + `</div>`;
}

function renderCadeauxView(container) {
    const items = appState.data.cadeaux || [];
    const personnes = [...new Set(items.map(i => i.personne))];
    
    let html = '';
    personnes.forEach(p => {
        const pItems = items.filter(i => i.personne === p);
        html += `<div class="category-header">${esc(p)} (${pItems.length} idées)</div><div class="grid-cards">`;
        pItems.forEach(c => {
            html += `
            <div class="card">
                <div class="card-header"><span class="card-title">${esc(c.idee)}</span></div>
                <div class="card-body">
                    <div>Prix estimé: ${c.prix || '-'} €</div>
                    <div style="font-weight:600; margin-top:0.5rem;">Statut: ${esc(c.statut)}</div>
                </div>
                <div class="card-actions">
                    <button class="icon-btn" onclick="openModal('cadeaux', '${c.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('cadeaux', '${c.id}')" style="color:var(--danger);">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

function renderProjetsView(container) {
    const items = appState.data.projets || [];
    let html = `<div class="grid-cards">`;
    items.forEach(p => {
        html += `
        <div class="card" style="padding:0; overflow:hidden;">
            ${p.photo ? `<img src="${esc(p.photo)}" style="width:100%; height:180px; object-fit:cover;">` : '<div style="height:20px;"></div>'}
            <div style="padding:1.5rem;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem;">${esc(p.type)}</div>
                <div class="card-title" style="font-size:1.4rem; margin-bottom:1rem;">${esc(p.nom)}</div>
                
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                    📅 ${p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : 'Date à définir'} 
                    ${p.date_fin ? ' ➡️ ' + new Date(p.date_fin).toLocaleDateString('fr-FR') : ''}
                </div>
                
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:0.3rem;">
                    <span>Progression</span> <span>${p.progression||0} %</span>
                </div>
                <div class="progress-container"><div class="progress-bar" style="width:${p.progression||0}%;"></div></div>
                
                <div class="card-actions">
                    <button class="icon-btn" onclick="openModal('projets', '${p.id}')">✏️</button>
                    <button class="icon-btn" onclick="deleteItem('projets', '${p.id}')" style="color:var(--danger);">🗑️</button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html + `</div>`;
}

function renderDataView(schemaKey, schema, container) {
    const data = appState.data[schemaKey] || [];
    let html = `<div class="grid-cards">`;
    data.forEach(item => {
        html += `<div class="card"><div class="card-header"><span class="card-title">${esc(item[schema.fields[0].name]) || "Sans titre"}</span></div><div class="card-body">`;
        schema.fields.forEach(f => {
            if (f.name === schema.fields[0].name || !item[f.name]) return;
            if (f.type === 'textarea') html += `<div style="white-space:pre-wrap; margin-top:0.5rem;">${esc(item[f.name])}</div>`;
            else if (f.type === 'url') html += `<a href="${esc(item[f.name])}" target="_blank" style="color:var(--accent-blue);">🔗 Lien</a>`;
            else html += `<div><strong>${f.label}:</strong> ${esc(item[f.name])}</div>`;
        });
        html += `</div><div class="card-actions"><button class="icon-btn" onclick="openModal('${schemaKey}', '${item.id}')">✏️</button><button class="icon-btn" onclick="deleteItem('${schemaKey}', '${item.id}')" style="color:var(--danger);">🗑️</button></div></div>`;
    });
    container.innerHTML += html + `</div>`;
}

// ==========================================
// 6. MODALES ET ACTIONS CRUD
// ==========================================
let currentEditContext = { schemaKey: null, itemId: null };

function openModal(schemaKey, itemId = null) {
    const allSchemas = { ...coreSchemas, ...getCustomSchemas() };
    const schema = allSchemas[schemaKey];
    
    if (!schema) {
        console.error("Schéma introuvable pour:", schemaKey);
        return; // Évite l'erreur "Cannot read properties of undefined"
    }

    currentEditContext = { schemaKey, itemId };
    document.getElementById('modal-title').textContent = itemId ? `Modifier` : `Ajouter`;
    
    let itemData = itemId ? appState.data[schemaKey].find(i => i.id === itemId) || {} : {};
    let formHtml = '';

    schema.fields.forEach(f => {
        const val = itemData[f.name] !== undefined ? itemData[f.name] : (f.default || '');
        const req = f.required ? 'required' : '';
        formHtml += `<div class="form-group"><label>${f.label}</label>`;
        
        if (f.type === 'textarea') formHtml += `<textarea name="${f.name}" rows="3" ${req}>${esc(val)}</textarea>`;
        else if (f.type === 'select') formHtml += `<select name="${f.name}">${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
        else if (f.type === 'file') formHtml += `<input type="file" name="${f.name}" accept="image/*"><input type="hidden" name="${f.name}_old" value="${esc(val)}">`;
        else formHtml += `<input type="${f.type}" name="${f.name}" value="${esc(val)}" ${req} ${f.type==='number'?'step="any"':''}>`;
        
        formHtml += `</div>`;
    });
    document.getElementById('dynamic-form').innerHTML = formHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('dynamic-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('modal-submit-btn');
    btn.textContent = "Enregistrement..."; btn.disabled = true;

    const formData = new FormData(this);
    const newItem = { id: currentEditContext.itemId || generateId() };
    
    if(currentEditContext.itemId) Object.assign(newItem, appState.data[currentEditContext.schemaKey].find(i => i.id === currentEditContext.itemId));

    const schema = { ...coreSchemas, ...getCustomSchemas() }[currentEditContext.schemaKey];
    for (let field of schema.fields) {
        if (field.type === 'file') {
            const file = formData.get(field.name);
            if (file && file.size > 0) newItem[field.name] = await uploadFile(file);
            else newItem[field.name] = formData.get(field.name + '_old');
        } else {
            newItem[field.name] = formData.get(field.name);
        }
    }
    
    const arr = appState.data[currentEditContext.schemaKey];
    if (currentEditContext.itemId) {
        const idx = arr.findIndex(i => i.id === currentEditContext.itemId);
        if (idx !== -1) arr[idx] = newItem;
    } else {
        arr.push(newItem);
    }
    
    await saveData();
    document.getElementById('modal-overlay').classList.add('hidden');
    btn.textContent = "Enregistrer"; btn.disabled = false;
    renderCurrentView();
});

async function deleteItem(schemaKey, itemId) {
    if (confirm("Supprimer cet élément ?")) {
        appState.data[schemaKey] = appState.data[schemaKey].filter(i => i.id !== itemId);
        await saveData();
        renderCurrentView();
    }
}

async function toggleCheck(schemaKey, itemId, prop) {
    const item = appState.data[schemaKey].find(i => i.id === itemId);
    if(item) { item[prop] = !item[prop]; await saveData(); renderCurrentView(); }
}

async function updateTaskStatus(itemId, newStatus) {
    const item = appState.data['taches'].find(i => i.id === itemId);
    if(item) { item.statut = newStatus; await saveData(); renderCurrentView(); }
}

async function toggleTaskDone(itemId) {
    const item = appState.data['taches'].find(i => i.id === itemId);
    if(item) { item.statut = item.statut === 'Terminé' ? 'À faire' : 'Terminé'; await saveData(); renderCurrentView(); }
}

function filterList(val, className) {
    document.querySelectorAll('.'+className).forEach(el => {
        el.style.display = el.getAttribute('data-title').includes(val.toLowerCase()) ? 'flex' : 'none';
    });
}

document.getElementById('close-modal-btn').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));
document.getElementById('modal-cancel-btn').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));

function buildSidebar() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = `<li><a href="#dashboard" class="nav-item">🏠 Accueil</a></li>`;
    for (let key in coreSchemas) nav.innerHTML += `<li><a href="#${key}" class="nav-item">${esc(coreSchemas[key].title)}</a></li>`;
}

document.getElementById('hamburger-btn').addEventListener('click', () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('active'); });
function closeMobileMenu() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
document.getElementById('close-sidebar-btn').addEventListener('click', closeMobileMenu);
document.getElementById('sidebar-overlay').addEventListener('click', closeMobileMenu);

function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = 'toast-message';
    t.style.background = `var(--${type})`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

function renderSettings(c) {
    c.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">🎨 Thème</span></div>
            <select onchange="appState.settings.theme = this.value; document.body.setAttribute('data-theme', this.value); saveData();">
                <option value="light" ${appState.settings.theme==='light'?'selected':''}>Clair</option>
                <option value="dark" ${appState.settings.theme==='dark'?'selected':''}>Sombre</option>
            </select>
        </div>
    `;
}

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button');
    btn.disabled = true;
    
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: document.getElementById('email-input').value,
        password: document.getElementById('password-input').value
    });
    
    if (error) {
        document.getElementById('login-error').classList.remove('hidden');
        btn.disabled = false;
    } else {
        document.getElementById('login-error').classList.add('hidden');
        await unlockApp();
        btn.disabled = false;
    }
});

document.getElementById('lock-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
});

window.addEventListener('DOMContentLoaded', initApp);
