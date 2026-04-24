/**
 * Lógica principal del Portal de Gestión (Supabase Edition) - Swimlane View
 */

// Supabase Setup
const supabaseUrl = 'https://miedzvvgfvhamjoqihqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZWR6dnZnZnZoYW1qb3FpaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDE4NjgsImV4cCI6MjA5MjQ3Nzg2OH0.JXj2M46-ck6yPjDiqv2xlqx5PjaYWbxcCi8hmVsazWA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// CATEGORIES is now dynamically loaded into categories object

// USERS constant removed - replaced by dynamic teamUsers state

// App State
let STAGES = [];
let RENDICION_STAGES = [];
let categories = {}; // object indexed by id for easy lookup
let projects = [];
let tasks = [];
let teamUsers = [];
let currentOpenTaskId = null;
let editingProjectId = null;
let editingTaskId = null;
let currentDeleteAction = null;

// DOM Elements
const boardElement = document.getElementById('kanbanBoard');
const taskTemplate = document.getElementById('taskCardTemplate');

// Helper para Avatares por defecto
function getDefaultAvatar(seed) {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// ==========================================
// Initialization & Data Management
// ==========================================
async function init() {
    setupInteractions();
    await loadData();
    populateSelects();
    renderBoard();
    renderRendicionBoard();
    renderGerencialBoard();
    renderSettings();
    renderTeam();
    renderDirectorio();
    setupDragAndDrop();
    // Show pipeline edit btn for the default tablero view
    document.getElementById('editPipelineBtn').style.display = 'block';
}

async function loadData() {
    try {
        const [stagesRes, projectsRes, tasksRes, usersRes, catRes, rendRes] = await Promise.all([
            supabaseClient.from('causas_stages').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('causas_projects').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('causas_tasks').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('causas_users').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('causas_categories').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('causas_rendicion_stages').select('*').order('created_at', { ascending: true })
        ]);
        
        if (stagesRes.error) throw stagesRes.error;
        if (projectsRes.error) throw projectsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (usersRes.error) throw usersRes.error;
        if (catRes.error) throw catRes.error;
        if (rendRes.error) throw rendRes.error;
        
        STAGES = stagesRes.data;
        RENDICION_STAGES = rendRes.data;
        projects = projectsRes.data;
        tasks = tasksRes.data;
        teamUsers = usersRes.data;
        
        // Populate categories object
        categories = {};
        catRes.data.forEach(c => {
            categories[c.id] = c;
        });
    } catch (error) {
        console.error("Error loading data from Supabase:", error);
    }
}

// Database Helpers
async function upsertProject(project) {
    const { error } = await supabaseClient.from('causas_projects').upsert(project);
    if (error) console.error("Error upserting project:", error);
}

// deleteProject and deleteStage are now directly handled with alerts inside the event listeners to provide user feedback.

async function upsertTask(task) {
    const { error } = await supabaseClient.from('causas_tasks').upsert(task);
    if (error) console.error("Error upserting task:", error);
}

async function insertStage(stage) {
    const { error } = await supabaseClient.from('causas_stages').insert(stage);
    if (error) console.error("Error inserting stage:", error);
}

// User & Category Database Helpers
async function upsertUser(user) {
    const { error } = await supabaseClient.from('causas_users').upsert(user);
    if (error) console.error("Error upserting user:", error);
}

async function deleteUser(userId) {
    const { error } = await supabaseClient.from('causas_users').delete().eq('id', userId);
    if (error) console.error("Error deleting user:", error);
}

async function insertCategory(cat) {
    const { error } = await supabaseClient.from('causas_categories').insert(cat);
    if (error) console.error("Error inserting category:", error);
}

async function deleteCategoryDB(catId) {
    const { error } = await supabaseClient.from('causas_categories').delete().eq('id', catId);
    if (error) console.error("Error deleting category:", error);
}

async function deleteTaskDB(taskId) {
    const { error } = await supabaseClient.from('causas_tasks').delete().eq('id', taskId);
    if (error) console.error("Error deleting task:", error);
}

// ==========================================
// Board Rendering (Swimlanes)
// ==========================================
function renderBoard() {
    boardElement.innerHTML = '';
    
    const filterAssigneeId = document.getElementById('filterAssignee')?.value || 'all';
    const filteredProjects = projects.filter(p => filterAssigneeId === 'all' || p.assignee === filterAssigneeId);

    if (STAGES.length === 0 || filteredProjects.length === 0) {
        boardElement.innerHTML = `<div style="padding: 2rem; color: var(--text-secondary);">${projects.length === 0 ? 'Agrega al menos un proyecto and una fase desde la configuración para ver el tablero.' : 'No hay causas asignadas a este miembro.'}</div>`;
        return;
    }

    // Header Row
    const headerRow = document.createElement('div');
    headerRow.className = 'swimlane-header-row';
    STAGES.forEach(stage => {
        const headerCell = document.createElement('div');
        headerCell.className = 'swimlane-stage-header';
        headerCell.innerHTML = `<i class="ph ${stage.icon}"></i> ${stage.title}`;
        headerRow.appendChild(headerCell);
    });
    boardElement.appendChild(headerRow);

    // Project Rows
    filteredProjects.forEach(project => {
        const rowElement = document.createElement('div');
        rowElement.className = 'swimlane-row';
        
        // Project Info (Left Column)
        const cat = categories[project.category];
        const badgeHtml = cat ? `<span class="category-badge" style="background-color: ${cat.color}33; color: ${cat.color};">${cat.label}</span>` : '';
        
        const infoElement = document.createElement('div');
        infoElement.className = 'swimlane-project-info';
        infoElement.innerHTML = `
            <div>${badgeHtml}</div>
            <div class="swimlane-project-title">${project.title}</div>
            <div style="font-size: 0.75rem; color: var(--accent-color); font-weight: 600; margin-bottom: 0.25rem;"><i class="ph ph-hand-heart"></i> ${project.donor || 'Sin Donante'}</div>
            <div class="swimlane-project-desc">${project.description || ''}</div>
            <div class="assignee" style="margin-top: auto;">
                <img src="${teamUsers.find(u => u.id === project.assignee)?.avatar || getDefaultAvatar(project.assignee || 'unassigned')}" alt="Avatar" class="avatar-sm">
                <span class="assignee-name">${teamUsers.find(u => u.id === project.assignee)?.name || 'Sin Asignar'}</span>
            </div>
        `;
        rowElement.appendChild(infoElement);

        // Stage Cells
        STAGES.forEach(stage => {
            const cellElement = document.createElement('div');
            cellElement.className = 'swimlane-cell';
            cellElement.dataset.stageId = stage.id;
            cellElement.dataset.projectId = project.id;
            
            // Render Tasks
            const stageTasks = tasks.filter(t => t.project_id === project.id && t.status === stage.id);
            stageTasks.forEach(task => {
                const card = createTaskCard(task);
                cellElement.appendChild(card);
            });

            // Add Task Button
            const addTaskBtn = document.createElement('button');
            addTaskBtn.className = 'add-task-btn';
            addTaskBtn.innerHTML = '<i class="ph ph-plus"></i> Añadir Tarea';
            addTaskBtn.addEventListener('click', () => {
                editingTaskId = null;
                document.getElementById('newTaskForm').reset();
                document.getElementById('newTaskModal').querySelector('h2').textContent = 'Nueva Tarea';
                document.getElementById('ntProjectId').value = project.id;
                document.getElementById('ntStageId').value = stage.id;
                openModal('newTaskModal');
            });
            cellElement.appendChild(addTaskBtn);

            rowElement.appendChild(cellElement);
        });

        boardElement.appendChild(rowElement);
    });
}

function createTaskCard(task) {
    const clone = taskTemplate.content.cloneNode(true);
    const card = clone.querySelector('.project-card'); // Reusing the same css class for visual
    
    card.id = task.id;
    card.dataset.taskId = task.id;
    
    card.querySelector('.card-title').textContent = task.title;
    card.querySelector('.card-desc').textContent = task.description || '';
    
    const project = projects.find(p => p.id === task.project_id);
    if (project && project.donor) {
        card.querySelector('.donor-tag').innerHTML = `<i class="ph ph-hand-heart"></i> ${project.donor}`;
        card.querySelector('.donor-tag').style.background = 'var(--accent-color)15';
        card.querySelector('.donor-tag').style.padding = '0.2rem 0.5rem';
        card.querySelector('.donor-tag').style.borderRadius = '20px';
        card.querySelector('.donor-tag').style.display = 'inline-flex';
        card.querySelector('.donor-tag').style.alignItems = 'center';
        card.querySelector('.donor-tag').style.gap = '0.3rem';
        card.querySelector('.donor-tag').style.color = 'var(--accent-color)';
    } else {
        card.querySelector('.donor-tag').innerHTML = '';
        card.querySelector('.donor-tag').style.display = 'none';
    }
    
    const user = teamUsers.find(u => u.id === task.assignee);
    if(user) {
        card.querySelector('.assignee-name').textContent = user.name;
        card.querySelector('.avatar-sm').src = user.avatar || getDefaultAvatar(user.id);
    } else {
        card.querySelector('.assignee-name').textContent = 'Sin Asignar';
        card.querySelector('.avatar-sm').src = getDefaultAvatar('unassigned');
    }
    card.querySelector('.date-text').textContent = task.date;
    
    // Edit Task
    card.querySelector('.btn-edit-task').addEventListener('click', (e) => {
        e.stopPropagation();
        editingTaskId = task.id;
        document.getElementById('newTaskModal').querySelector('h2').textContent = 'Editar Tarea';
        document.getElementById('ntProjectId').value = task.project_id;
        document.getElementById('ntStageId').value = task.status;
        document.getElementById('ntTitle').value = task.title;
        document.getElementById('ntDesc').value = task.description || '';
        document.getElementById('ntAssignee').value = task.assignee || '';
        openModal('newTaskModal');
    });

    // Delete Task
    card.querySelector('.btn-delete-task').addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirm(
            'Eliminar Tarea',
            '¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.',
            async () => {
                const taskIndex = tasks.findIndex(t => t.id === task.id);
                if (taskIndex > -1) {
                    tasks.splice(taskIndex, 1);
                }
                renderBoard();
                renderRendicionBoard();
                renderGerencialBoard();
                await deleteTaskDB(task.id);
            }
        );
    });

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

// Custom Delete Helper
function showDeleteConfirm(title, text, actionCallback) {
    document.getElementById('deleteModalTitle').textContent = title;
    document.getElementById('deleteModalText').innerHTML = text;
    currentDeleteAction = actionCallback;
    openModal('deleteConfirmModal');
}

// ==========================================
// Settings Rendering
// ==========================================
function renderSettings() {
    const stagesList = document.getElementById('settingsStagesList');
    stagesList.innerHTML = STAGES.map((stage, idx) => `
        <li>
            <span><i class="ph ${stage.icon}"></i> ${stage.title}</span>
            <button class="btn-icon btn-remove-stage" data-id="${stage.id}"><i class="ph ph-trash"></i></button>
        </li>
    `).join('');

    const categoriesList = document.getElementById('settingsCategoriesList');
    if(categoriesList) {
        categoriesList.innerHTML = Object.values(categories).map(cat => `
            <li>
                <span class="category-badge" style="background-color: ${cat.color}33; color: ${cat.color}; display: inline-block; margin-right: 0.5rem;">${cat.label}</span>
                <button class="btn-icon btn-remove-category" data-id="${cat.id}"><i class="ph ph-trash"></i></button>
            </li>
        `).join('');
    }

    // Rendicion Stages
    const rendicionList = document.getElementById('settingsRendicionStagesList');
    if(rendicionList) {
        rendicionList.innerHTML = RENDICION_STAGES.map(stage => `
            <li class="stage-item">
                <span><i class="ph ${stage.icon || 'ph-circles-three'}"></i> ${stage.title}</span>
                <button class="btn-icon btn-remove-rendicion-stage" data-id="${stage.id}"><i class="ph ph-trash"></i></button>
            </li>
        `).join('');
        
        rendicionList.querySelectorAll('.btn-remove-rendicion-stage').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const stageId = e.currentTarget.dataset.id;
                
                if(tasks.some(t => t.status === stageId)) {
                    alert("No puedes eliminar una fase que contiene tareas.");
                    return;
                }

                const stageIndex = RENDICION_STAGES.findIndex(s => s.id === stageId);
                if (stageIndex > -1) {
                    RENDICION_STAGES.splice(stageIndex, 1);
                    renderRendicionBoard();
                renderGerencialBoard();
                    renderSettings();
                    await supabaseClient.from('causas_rendicion_stages').delete().eq('id', stageId);
                }
            });
        });
    }

    const projectsList = document.getElementById('settingsProjectsList');
    projectsList.innerHTML = projects.map((project, idx) => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span><strong>${project.title}</strong></span>
            <div>
                <button class="btn-icon btn-edit-project" data-id="${project.id}" title="Editar Causa"><i class="ph ph-pencil"></i></button>
                <button class="btn-icon btn-remove-project" data-id="${project.id}" title="Eliminar Causa"><i class="ph ph-trash"></i></button>
            </div>
        </li>
    `).join('');

    // Attach Event Listeners for edits and deletes
    document.querySelectorAll('.btn-edit-project').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const projectId = e.currentTarget.dataset.id;
            const project = projects.find(p => p.id === projectId);
            if(project) {
                editingProjectId = project.id;
                document.getElementById('projectModalTitle').textContent = 'Editar Proyecto';
                document.getElementById('npTitle').value = project.title;
                document.getElementById('npDesc').value = project.description || '';
                document.getElementById('npCategory').value = project.category || '';
                document.getElementById('npAssignee').value = project.assignee || '';
                document.getElementById('npImportance').value = project.importance || '';
                document.getElementById('npDonor').value = project.donor || '';
                document.getElementById('npFrontliner').value = project.frontliner || '';
                document.getElementById('npDelivery').value = project.delivery_period || '';
                document.getElementById('npFolderLink').value = project.folder_link || '';
                
                openModal('newProjectModal');
            }
        });
    });
    document.querySelectorAll('.btn-remove-stage').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const stageId = e.currentTarget.dataset.id;
            
            if(tasks.some(t => t.status === stageId)) {
                alert("No puedes eliminar una fase que contiene tareas.");
                return;
            }
            
            const stageIndex = STAGES.findIndex(s => s.id === stageId);
            if (stageIndex > -1) {
                STAGES.splice(stageIndex, 1);
            }
            renderBoard();
            renderSettings();
            
            const { error } = await supabaseClient.from('causas_stages').delete().eq('id', stageId);
            if (error) {
                console.error("Error deleting stage:", error);
                alert("Hubo un error al eliminar la fase en la base de datos.");
            }
        });
    });

    document.querySelectorAll('.btn-remove-category').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const catId = e.currentTarget.dataset.id;
            
            if(projects.some(p => p.category === catId)) {
                alert("No puedes eliminar una categoría que está en uso por uno o más proyectos.");
                return;
            }
            
            showDeleteConfirm(
                'Eliminar Categoría', 
                '¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.',
                async () => {
                    delete categories[catId];
                    populateSelects();
                    renderBoard();
                    renderSettings();
                    
                    await deleteCategoryDB(catId);
                }
            );
        });
    });

    document.querySelectorAll('.btn-remove-project').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const projectId = e.currentTarget.dataset.id;
            showDeleteConfirm(
                'Eliminar Causa',
                '¿Estás seguro de que deseas eliminar esta causa y <strong>todas sus tareas</strong>? Esta acción no se puede deshacer.',
                async () => {
                    // Optimistic update
                    const projectIndex = projects.findIndex(p => p.id === projectId);
                    if (projectIndex > -1) {
                        projects.splice(projectIndex, 1);
                    }
                    tasks = tasks.filter(t => t.project_id !== projectId);
                    renderBoard();
                    renderRendicionBoard();
                renderGerencialBoard();
                    renderSettings();
                    
                    const { error } = await supabaseClient.from('causas_projects').delete().eq('id', projectId);
                    if (error) {
                        console.error("Error deleting project:", error);
                        alert("Hubo un error al eliminar el proyecto en la base de datos.");
                    }
                }
            );
        });
    });
}

// ==========================================
// Drag & Drop Logic
// ==========================================
// Team Rendering
// ==========================================
function renderTeam() {
    const teamGrid = document.getElementById('teamGrid');
    if(!teamGrid) return;
    
    if (teamUsers.length === 0) {
        teamGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No hay miembros en el equipo aún.</div>';
        return;
    }
    
    teamGrid.innerHTML = teamUsers.map(user => `
        <div class="team-member-card">
            <img src="${user.avatar || getDefaultAvatar(user.id)}" alt="Avatar" class="team-member-avatar">
            <div class="team-member-name">${user.name}</div>
            <div class="team-member-role">${user.role || 'Miembro del Equipo'}</div>
            <div class="team-member-actions">
                <button class="btn-icon btn-edit-user" data-id="${user.id}" title="Editar"><i class="ph ph-pencil"></i></button>
                <button class="btn-icon btn-remove-user" data-id="${user.id}" title="Eliminar"><i class="ph ph-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.id;
            const user = teamUsers.find(u => u.id === userId);
            if(user) {
                document.getElementById('userModalTitle').textContent = 'Editar Miembro';
                document.getElementById('nuName').value = user.name;
                document.getElementById('nuRole').value = user.role || '';
                document.getElementById('nuAvatar').value = user.avatar || '';
                document.getElementById('nuUsername').value = user.username || '';
                document.getElementById('nuPassword').value = user.password || '';
                
                // Hack: store editing ID in the form dataset
                document.getElementById('userForm').dataset.editingId = user.id;
                openModal('userModal');
            }
        });
    });
    
    document.querySelectorAll('.btn-remove-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = e.currentTarget.dataset.id;
            showDeleteConfirm(
                'Eliminar Miembro',
                '¿Estás seguro de que deseas eliminar este miembro del equipo? Las tareas y proyectos asignados a él se mostrarán "Sin Asignar".',
                async () => {
                    const userIndex = teamUsers.findIndex(u => u.id === userId);
                    if (userIndex > -1) {
                        teamUsers.splice(userIndex, 1);
                    }
                    renderTeam();
                    renderBoard(); // refresh assignees
                    populateSelects(); // refresh dropdowns
                    await deleteUser(userId);
                }
            );
        });
    });
}

// ==========================================
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    if (this.dataset.taskId) {
        e.dataTransfer.setData('text/plain', this.dataset.taskId);
    } else {
        e.dataTransfer.setData('text/plain', this.dataset.id);
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.swimlane-cell').forEach(col => col.classList.remove('drag-over'));
}

function setupDragAndDrop() {
    boardElement.addEventListener('dragover', e => {
        e.preventDefault();
        const cellContent = e.target.closest('.swimlane-cell');
        if (cellContent) {
            cellContent.classList.add('drag-over');
            const afterElement = getDragAfterElement(cellContent, e.clientY);
            // Insert before the add task button if we drop at the end
            const addTaskBtn = cellContent.querySelector('.add-task-btn');
            
            if (afterElement == null) {
                cellContent.insertBefore(draggedItem, addTaskBtn);
            } else {
                cellContent.insertBefore(draggedItem, afterElement);
            }
        }
    });
    
    boardElement.addEventListener('dragleave', e => {
        const cellContent = e.target.closest('.swimlane-cell');
        if (cellContent && !cellContent.contains(e.relatedTarget)) {
            cellContent.classList.remove('drag-over');
        }
    });
    
    boardElement.addEventListener('drop', e => {
        e.preventDefault();
        const cellContent = e.target.closest('.swimlane-cell');
        if (cellContent) {
            cellContent.classList.remove('drag-over');
            const newStageId = cellContent.dataset.stageId;
            const newProjectId = cellContent.dataset.projectId;
            const taskId = e.dataTransfer.getData('text/plain');
            
            const task = tasks.find(t => t.id === taskId);
            if (task && (task.status !== newStageId || task.project_id !== newProjectId)) {
                task.status = newStageId;
                task.project_id = newProjectId;
                renderBoard(); // Optimistic update
                renderRendicionBoard();
                renderGerencialBoard(); // Sync second board
                upsertTask(task); // Async push
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.project-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ==========================================
// Directory Rendering
// ==========================================
function renderDirectorio() {
    const grid = document.getElementById('directorioGrid');
    if (!grid) return;
    
    grid.innerHTML = projects.map(project => {
        const cat = categories[project.category];
        const badgeHtml = cat ? `<span class="category-badge" style="background-color: ${cat.color}33; color: ${cat.color}; display:inline-block; margin-bottom: 0.5rem;">${cat.label}</span>` : '';
        const assignee = teamUsers.find(u => u.id === project.assignee);
        const assigneeName = assignee ? assignee.name : 'Sin Asignar';
        
        let importanceHtml = '';
        if (project.importance) {
            const colors = { 
                'AAAA': '#ef4444', 
                'AAA': '#f97316', 
                'AA': '#eab308', 
                'A': '#3b82f6',
                'B,C': '#6366f1',
                'D': '#8b5cf6'
            };
            const color = colors[project.importance] || 'var(--text-secondary)';
            importanceHtml = `<span style="background-color: ${color}22; color: ${color}; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">${project.importance}</span>`;
        }
        
        return `
            <div class="team-member-card" style="align-items: flex-start; text-align: left; padding: 1.5rem; position: relative;">
                <button class="btn-icon btn-edit-directory-cause" data-id="${project.id}" style="position: absolute; top: 1rem; right: 1rem; opacity: 0; transition: opacity 0.2s;" title="Editar Causa">
                    <i class="ph ph-pencil"></i>
                </button>
                <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 1rem; padding-right: 2rem;">
                    <div>${badgeHtml}</div>
                    <div>${importanceHtml}</div>
                </div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">${project.title}</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.8em;">${project.description || 'Sin descripción'}</p>
                
                <div style="width: 100%; font-size: 0.85rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                    <div style="display: flex; margin-bottom: 0.5rem; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Donante:</span>
                        <span style="font-weight: 500;">${project.donor || '-'}</span>
                    </div>
                    <div style="display: flex; margin-bottom: 0.5rem; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Frontliner:</span>
                        <span style="font-weight: 500;">${project.frontliner || '-'}</span>
                    </div>
                    <div style="display: flex; margin-bottom: 0.5rem; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Periodo:</span>
                        <span style="font-weight: 500;">${project.delivery_period || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Responsable:</span>
                        <span style="font-weight: 500;">${assigneeName}</span>
                    </div>
                </div>
                
                ${project.folder_link ? `<a href="${project.folder_link}" target="_blank" class="btn-primary btn-sm" style="width: 100%; text-align: center; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;"><i class="ph ph-folder-open"></i> Abrir Carpeta</a>` : `<button class="btn-secondary btn-sm" style="width: 100%; opacity: 0.5; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"><i class="ph ph-folder"></i> Sin Carpeta</button>`}
            </div>
        `;
    }).join('');

    // Attach edit listeners
    grid.querySelectorAll('.btn-edit-directory-cause').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const projectId = e.currentTarget.dataset.id;
            const project = projects.find(p => p.id === projectId);
            if (project) {
                editingProjectId = project.id;
                document.getElementById('projectModalTitle').textContent = 'Editar Causa';
                document.getElementById('npTitle').value = project.title;
                document.getElementById('npDesc').value = project.description || '';
                document.getElementById('npCategory').value = project.category || '';
                document.getElementById('npAssignee').value = project.assignee || '';
                document.getElementById('npImportance').value = project.importance || '';
                document.getElementById('npDonor').value = project.donor || '';
                document.getElementById('npFrontliner').value = project.frontliner || '';
                document.getElementById('npDelivery').value = project.delivery_period || '';
                document.getElementById('npFolderLink').value = project.folder_link || '';
                
                openModal('newProjectModal');
            }
        });
    });
}

// ==========================================
// Gerencial Pipeline Rendering (Kanban view)
// ==========================================
function renderGerencialBoard(filterImportance = 'all', filterDonor = '', searchQuery = '') {
    const container = document.getElementById('gerencialGrid');
    if (!container) return;

    const filterAssigneeId = document.getElementById('filterAssignee')?.value || 'all';

    const importanceColors = {
        'AAAA': { bg: '#ef444422', color: '#ef4444' },
        'AAA':  { bg: '#f9731622', color: '#f97316' },
        'AA':   { bg: '#eab30822', color: '#d97706' },
        'A':    { bg: '#3b82f622', color: '#3b82f6' },
        'B,C':  { bg: '#6366f122', color: '#6366f1' },
        'D':    { bg: '#8b5cf622', color: '#8b5cf6' },
    };

    if (STAGES.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:4rem;color:var(--text-secondary);"><i class="ph ph-kanban" style="font-size:3rem;display:block;opacity:0.4;margin-bottom:1rem;"></i><h3>Sin fases configuradas</h3></div>';
        return;
    }

    const filtered = projects.filter(p => {
        const matchImp = filterImportance === 'all' || p.importance === filterImportance;
        const matchDonor = !filterDonor || (p.donor || '').toLowerCase().includes(filterDonor.toLowerCase());
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || p.title.toLowerCase().includes(q) || (p.donor || '').toLowerCase().includes(q);
        return matchImp && matchDonor && matchSearch;
    });

    function getCurrentStageId(project) {
        const pt = tasks.filter(t => t.project_id === project.id);
        if (pt.length === 0) return STAGES[0] ? STAGES[0].id : null;
        let furthestIdx = -1;
        let furthestId = STAGES[0] ? STAGES[0].id : null;
        STAGES.forEach((stage, idx) => {
            if (pt.some(t => t.status === stage.id) && idx > furthestIdx) {
                furthestIdx = idx;
                furthestId = stage.id;
            }
        });
        return furthestId;
    }

    container.innerHTML = '';
    container.style.cssText = 'display:flex; gap:1rem; overflow-x:auto; align-items:flex-start; padding:1.5rem 2.5rem; flex-grow:1; height:100%;';

    STAGES.forEach(stage => {
        const causesInStage = filtered.filter(p => getCurrentStageId(p) === stage.id);
        const col = document.createElement('div');
        col.style.cssText = 'min-width:260px; max-width:300px; flex:0 0 260px; display:flex; flex-direction:column; gap:0.5rem;';

        const hdr = document.createElement('div');
        hdr.style.cssText = 'background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.6rem 0.85rem; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem; color:var(--text-secondary); flex-shrink:0;';
        hdr.innerHTML = '<i class="ph ' + (stage.icon || 'ph-circles-three') + '"></i>' +
            stage.title +
            '<span style="margin-left:auto;background:var(--accent-color);color:white;border-radius:20px;padding:0.1rem 0.5rem;font-size:0.7rem;font-weight:700;">' + causesInStage.length + '</span>';
        col.appendChild(hdr);

        if (causesInStage.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:0.75rem;border:1px dashed var(--border-subtle);border-radius:var(--radius-md);text-align:center;font-size:0.75rem;color:var(--text-muted);';
            empty.textContent = 'Sin causas';
            col.appendChild(empty);
        } else {
            causesInStage.forEach(project => {
                const imp = project.importance;
                const impStyle = importanceColors[imp] || { bg: '#88888822', color: '#888' };
                const cat = categories[project.category];
                const assignee = teamUsers.find(u => u.id === project.assignee);
                const pt = tasks.filter(t => t.project_id === project.id);

                const card = document.createElement('div');
                card.className = 'gerencial-card';
                card.style.borderLeft = '3px solid ' + impStyle.color;
                card.style.cursor = 'default';

                card.innerHTML =
                    '<div class="gerencial-card-header">' +
                        '<div class="gerencial-card-title">' + project.title + '</div>' +
                        (imp ? '<span class="importance-pill" style="background:' + impStyle.bg + ';color:' + impStyle.color + ';">' + imp + '</span>' : '') +
                    '</div>' +
                    (project.donor ? '<div class="gerencial-card-donor"><i class="ph ph-hand-heart"></i> ' + project.donor + '</div>' : '') +
                    (cat ? '<div style="margin-bottom:0.5rem;"><span class="category-badge" style="background:' + cat.color + '22;color:' + cat.color + ';font-size:0.65rem;">' + cat.label + '</span></div>' : '') +
                    '<div class="gerencial-card-footer">' +
                        '<div class="gerencial-task-count">' +
                            '<img src="' + (assignee ? assignee.avatar || getDefaultAvatar(assignee.id) : getDefaultAvatar('x')) + '" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">' +
                            '<i class="ph ph-check-square"></i> ' + pt.length + ' tarea' + (pt.length !== 1 ? 's' : '') +
                        '</div>' +
                        '<div class="gerencial-hint"><i class="ph ph-arrows-out"></i> 2x clic</div>' +
                    '</div>';

                card.addEventListener('dblclick', () => openCauseDetail(project.id));
                col.appendChild(card);
            });
        }

        container.appendChild(col);
    });
}



function openCauseDetail(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const importanceColors = {
        'AAAA': { bg: '#ef444422', color: '#ef4444' },
        'AAA':  { bg: '#f9731622', color: '#f97316' },
        'AA':   { bg: '#eab30822', color: '#d97706' },
        'A':    { bg: '#3b82f622', color: '#3b82f6' },
        'B,C':  { bg: '#6366f122', color: '#6366f1' },
        'D':    { bg: '#8b5cf622', color: '#8b5cf6' },
    };
    const imp = project.importance;
    const impStyle = importanceColors[imp] || { bg: '#88888822', color: '#888' };

    // Title & badges
    document.getElementById('causeDetailTitle').textContent = project.title;
    const badgesEl = document.getElementById('causeDetailBadges');
    const cat = categories[project.category];
    badgesEl.innerHTML = [
        imp ? `<span class="importance-pill" style="background:${impStyle.bg}; color:${impStyle.color};">${imp}</span>` : '',
        cat ? `<span class="category-badge" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>` : '',
    ].join('');

    // Meta strip
    const assignee = teamUsers.find(u => u.id === project.assignee);
    const metaEl = document.getElementById('causeDetailMeta');
    metaEl.innerHTML = [
        { label: 'Donante', value: project.donor || '—' },
        { label: 'Frontliner', value: project.frontliner || '—' },
        { label: 'Responsable', value: assignee?.name || 'Sin asignar' },
        { label: 'Periodo de entrega', value: project.delivery_period || '—' },
    ].map(item => `
        <div class="cause-meta-item">
            <span class="cause-meta-label">${item.label}</span>
            <span class="cause-meta-value">${item.value}</span>
        </div>
    `).join('');

    // Render initial tab (tablero)
    renderDetailPipeline(projectId, 'tablero');

    // Tab switching
    const tabs = document.querySelectorAll('.cause-tab-btn');
    tabs.forEach(btn => {
        // Remove old listeners cleanly
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            document.querySelectorAll('.cause-tab-btn').forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');
            renderDetailPipeline(projectId, newBtn.dataset.tab);
        });
    });

    openModal('causeDetailModal');
}

function renderDetailPipeline(projectId, tab) {
    const pipeline = document.getElementById('causeDetailPipeline');
    const stages = tab === 'tablero' ? STAGES : RENDICION_STAGES;
    const projectTasks = tasks.filter(t => t.project_id === projectId);

    if (stages.length === 0) {
        pipeline.innerHTML = `<div style="color: var(--text-muted); padding: 2rem;">No hay fases configuradas para este pipeline.</div>`;
        return;
    }

    pipeline.innerHTML = stages.map(stage => {
        const stageTasks = projectTasks.filter(t => t.status === stage.id);
        const tasksHtml = stageTasks.length > 0
            ? stageTasks.map(t => `
                <div class="detail-task-chip">
                    ${t.title}
                    ${t.description ? `<span>${t.description.substring(0, 60)}${t.description.length > 60 ? '…' : ''}</span>` : ''}
                </div>
            `).join('')
            : `<div class="detail-empty-stage">Sin entregables</div>`;

        const countBadge = stageTasks.length > 0
            ? `<span class="detail-stage-count">${stageTasks.length}</span>`
            : '';

        return `
            <div class="detail-stage-col">
                <div class="detail-stage-header">
                    <i class="ph ${stage.icon || 'ph-circles-three'}"></i>
                    ${stage.title}
                    ${countBadge}
                </div>
                ${tasksHtml}
            </div>
        `;
    }).join('');
}

// Rendicion Board Rendering
// ==========================================
function renderRendicionBoard() {
    const board = document.getElementById('rendicionBoard');
    if (!board) return;
    board.innerHTML = '';

    if (RENDICION_STAGES.length === 0) {
        board.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-presentation-chart" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                <h3>No hay fases de rendición configuradas</h3>
                <p>Ve a Configuración para añadir etapas al pipeline de rendición.</p>
                <button class="btn-primary" style="margin-top: 1rem;" onclick="document.getElementById('nav-config').click()">Configurar Fases</button>
            </div>
        `;
        return;
    }

    const filterAssigneeId = document.getElementById('filterAssignee')?.value || 'all';
    const filteredProjects = projects.filter(p => filterAssigneeId === 'all' || p.assignee === filterAssigneeId);

    if (projects.length === 0 || filteredProjects.length === 0) {
        board.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-folder-open" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                <h3>${projects.length === 0 ? 'No hay causas activas' : 'No hay causas asignadas a este miembro'}</h3>
                <p>${projects.length === 0 ? 'Crea una nueva causa para verla en este tablero.' : ''}</p>
                ${projects.length === 0 ? '<button class="btn-primary" style="margin-top: 1rem;" id="rendicionNewProjectBtn">Nueva Causa</button>' : ''}
            </div>
        `;
        if (projects.length === 0) {
            document.getElementById('rendicionNewProjectBtn')?.addEventListener('click', () => {
                document.getElementById('newProjectBtn').click();
            });
        }
        return;
    }

    // Header Row
    const headerRow = document.createElement('div');
    headerRow.className = 'swimlane-header-row';
    RENDICION_STAGES.forEach(stage => {
        const headerCell = document.createElement('div');
        headerCell.className = 'swimlane-stage-header';
        headerCell.innerHTML = `<i class="ph ${stage.icon || 'ph-circles-three'}"></i> ${stage.title}`;
        headerRow.appendChild(headerCell);
    });
    board.appendChild(headerRow);

    // Project Rows (Same as main board)
    filteredProjects.forEach(project => {
        const rowElement = document.createElement('div');
        rowElement.className = 'swimlane-row';
        
        // Project Info (Left Column) - Identical to main board
        const cat = categories[project.category];
        const badgeHtml = cat ? `<span class="category-badge" style="background-color: ${cat.color}33; color: ${cat.color};">${cat.label}</span>` : '';
        
        let importanceHtml = '';
        if (project.importance) {
            const colors = { 'AAAA': '#ef4444', 'AAA': '#f97316', 'AA': '#eab308', 'A': '#3b82f6', 'B,C': '#6366f1', 'D': '#8b5cf6' };
            const color = colors[project.importance] || 'var(--text-secondary)';
            importanceHtml = `<span style="background-color: ${color}22; color: ${color}; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.7rem; display: inline-block;">${project.importance}</span>`;
        }

        const infoElement = document.createElement('div');
        infoElement.className = 'swimlane-project-info';
        infoElement.innerHTML = `
            <div style="display: flex; gap: 0.25rem; margin-bottom: 0.5rem;">
                ${badgeHtml}
                ${importanceHtml}
            </div>
            <div class="swimlane-project-title">${project.title}</div>
            <div style="font-size: 0.7rem; background: var(--accent-color)15; color: var(--accent-color); padding: 0.2rem 0.5rem; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; margin-bottom: 0.5rem;">
                <i class="ph ph-hand-heart"></i> ${project.donor || 'Sin Donante'}
            </div>
            <div class="swimlane-project-desc">${project.description || ''}</div>
            <div class="assignee" style="margin-top: auto;">
                <img src="${teamUsers.find(u => u.id === project.assignee)?.avatar || getDefaultAvatar(project.assignee || 'unassigned')}" alt="Avatar" class="avatar-sm">
                <span class="assignee-name">${teamUsers.find(u => u.id === project.assignee)?.name || 'Sin Asignar'}</span>
            </div>
        `;
        rowElement.appendChild(infoElement);

        // Stage Cells
        RENDICION_STAGES.forEach(stage => {
            const cellElement = document.createElement('div');
            cellElement.className = 'swimlane-cell';
            cellElement.dataset.stageId = stage.id;
            cellElement.dataset.projectId = project.id;
            
            // Render Tasks (Tasks assigned to this rendicion stage)
            const stageTasks = tasks.filter(t => t.project_id === project.id && t.status === stage.id);
            stageTasks.forEach(task => {
                const card = createTaskCard(task);
                cellElement.appendChild(card);
            });

            // Add Task Button
            const addTaskBtn = document.createElement('button');
            addTaskBtn.className = 'add-task-btn';
            addTaskBtn.innerHTML = '<i class="ph ph-plus"></i> Añadir Tarea';
            addTaskBtn.addEventListener('click', () => {
                editingTaskId = null;
                document.getElementById('newTaskForm').reset();
                document.getElementById('newTaskModal').querySelector('h2').textContent = 'Nueva Tarea (Rendición)';
                document.getElementById('ntProjectId').value = project.id;
                document.getElementById('ntStageId').value = stage.id;
                // Temporarily update stage dropdown to include rendicion stages
                updateTaskStageDropdown(true); 
                openModal('newTaskModal');
            });
            cellElement.appendChild(addTaskBtn);

            rowElement.appendChild(cellElement);
        });

        board.appendChild(rowElement);
    });
}

function updateTaskStageDropdown(isRendicion = false) {
    const stageSelect = document.getElementById('ntStageId');
    const stagesToUse = isRendicion ? RENDICION_STAGES : STAGES;
    stageSelect.innerHTML = stagesToUse.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
}

// ==========================================
// Modals, Navigation & Forms Logic
// ==========================================
function setupInteractions() {
    // Navigation
    const navTablero = document.getElementById('nav-tablero');
    const navConfig = document.getElementById('nav-config');
    const navEquipo = document.getElementById('nav-equipo');
    const navDirectorio = document.getElementById('nav-directorio');
    const navRendicion = document.getElementById('nav-rendicion');
    const navGerencial = document.getElementById('nav-gerencial');
    const navFaq = document.getElementById('nav-faq');
    
    const boardView = document.getElementById('boardView');
    const rendicionView = document.getElementById('rendicionView');
    const gerencialView = document.getElementById('gerencialView');
    const settingsView = document.getElementById('settingsView');
    const teamView = document.getElementById('teamView');
    const directorioView = document.getElementById('directorioView');
    const faqView = document.getElementById('faqView');

    function hideAllViews() {
        [navTablero, navConfig, navEquipo, navDirectorio, navRendicion, navGerencial, navFaq].forEach(n => n?.classList.remove('active'));
        [boardView, settingsView, teamView, directorioView, rendicionView, gerencialView, faqView].forEach(v => v?.classList.remove('active'));
        // Reset pipeline edit buttons
        document.getElementById('editPipelineBtn').style.display = 'none';
        document.getElementById('editRendicionPipelineBtn').style.display = 'none';
    }

    navGerencial?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navGerencial.classList.add('active');
        gerencialView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Pipeline Gerencial';
        document.getElementById('viewSubtitle').textContent = 'Vista ejecutiva de todas las causas — doble clic para detalles';
        renderGerencialBoard();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    navTablero?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navTablero.classList.add('active');
        boardView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Pipeline de Causas';
        document.getElementById('viewSubtitle').textContent = 'Gestiona el flujo de trabajo de tu equipo';
        
        // Toggle pipeline edit buttons
        document.getElementById('editPipelineBtn').style.display = 'block';
        document.getElementById('editRendicionPipelineBtn').style.display = 'none';
        
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    navRendicion?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navRendicion.classList.add('active');
        rendicionView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Rendición de Cuentas';
        document.getElementById('viewSubtitle').textContent = 'Seguimiento de entregables por causa';
        
        // Toggle pipeline edit buttons
        document.getElementById('editPipelineBtn').style.display = 'none';
        document.getElementById('editRendicionPipelineBtn').style.display = 'block';
        
        renderRendicionBoard();
                renderGerencialBoard();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    navConfig?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navConfig.classList.add('active');
        settingsView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Configuración';
        document.getElementById('viewSubtitle').textContent = 'Personaliza fases y categorías';
        renderSettings();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });
    
    navEquipo?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navEquipo.classList.add('active');
        teamView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Miembros del Equipo';
        document.getElementById('viewSubtitle').textContent = 'Gestiona los responsables de las causas';
        renderTeam();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    navDirectorio?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navDirectorio.classList.add('active');
        directorioView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Directorio de Causas';
        document.getElementById('viewSubtitle').textContent = 'Catálogo completo de proyectos y donantes';
        renderDirectorio();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    navFaq?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navFaq.classList.add('active');
        faqView.classList.add('active');
        document.getElementById('viewTitle').textContent = 'Glosario / FAQ';
        document.getElementById('viewSubtitle').textContent = 'Niveles de prioridad y servicios';
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });

    // Gerencial Filters
    let gerencialFilter = 'all';
    let gerencialDonor = '';
    let gerencialSearch = '';

    document.querySelectorAll('.gerencial-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.gerencial-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gerencialFilter = btn.dataset.filter;
            renderGerencialBoard(gerencialFilter, gerencialDonor, gerencialSearch);
        });
    });

    document.getElementById('gerencialDonorFilter')?.addEventListener('input', (e) => {
        gerencialDonor = e.target.value;
        renderGerencialBoard(gerencialFilter, gerencialDonor, gerencialSearch);
    });

    document.getElementById('gerencialSearch')?.addEventListener('input', (e) => {
        gerencialSearch = e.target.value;
        renderGerencialBoard(gerencialFilter, gerencialDonor, gerencialSearch);
    });

    // Filters logic (Directorio)
    const applyFilters = () => {
        const catId = document.getElementById('filterCategory').value;
        const imp = document.getElementById('filterImportance').value;
        const query = document.getElementById('searchInput').value.toLowerCase();

        document.querySelectorAll('#directorioGrid .team-member-card').forEach(card => {
            const projectId = card.querySelector('.btn-edit-directory-cause').dataset.id;
            const project = projects.find(p => p.id === projectId);
            
            const matchesCat = !catId || project.category === catId;
            const matchesImp = !imp || project.importance === imp;
            const title = project.title.toLowerCase();
            const desc = (project.description || '').toLowerCase();
            const matchesQuery = !query || title.includes(query) || desc.includes(query);

            card.style.display = (matchesCat && matchesImp && matchesQuery) ? 'block' : 'none';
        });
    };

    document.getElementById('filterAssignee')?.addEventListener('change', () => {
        renderBoard();
        renderRendicionBoard();
        renderGerencialBoard();
    });

    document.getElementById('filterCategory')?.addEventListener('change', applyFilters);
    document.getElementById('filterImportance')?.addEventListener('change', applyFilters);

    // Theme Toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const icon = themeToggleBtn.querySelector('i');
        if (document.body.classList.contains('light-theme')) {
            icon.classList.replace('ph-sun', 'ph-moon');
        } else {
            icon.classList.replace('ph-moon', 'ph-sun');
        }
    });

    // Sidebar
    document.getElementById('openSidebarBtn').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
    document.getElementById('closeSidebarBtn').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

    // Search Bar
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (directorioView.classList.contains('active')) {
            applyFilters();
        } else if (rendicionView.classList.contains('active')) {
            document.querySelectorAll('#rendicionBoard .project-card').forEach(card => {
                const title = card.querySelector('.card-title').textContent.toLowerCase();
                const desc = card.querySelector('.card-desc').textContent.toLowerCase();
                card.style.display = (title.includes(query) || desc.includes(query)) ? 'block' : 'none';
            });
        } else {
            document.querySelectorAll('.project-card').forEach(card => {
                const title = card.querySelector('.card-title').textContent.toLowerCase();
                const desc = card.querySelector('.card-desc').textContent.toLowerCase();
                card.style.display = (title.includes(query) || desc.includes(query)) ? 'block' : 'none';
            });
        }
    });

    // Modal Triggers
    const openNewProjectModal = () => {
        editingProjectId = null;
        document.getElementById('projectModalTitle').textContent = 'Nueva Causa';
        document.getElementById('newProjectForm').reset();
        openModal('newProjectModal');
    };
    
    document.getElementById('newProjectBtn').addEventListener('click', () => openNewProjectModal());
    document.getElementById('settingsNewProjectBtn').addEventListener('click', () => openNewProjectModal());
    
    // Close Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Edit Pipeline Buttons
    document.getElementById('editPipelineBtn')?.addEventListener('click', () => {
        document.getElementById('pipelineModalTitle').textContent = 'Gestionar Fases (Tablero)';
        renderStagesListForModal(STAGES, 'causas_stages', () => renderBoard());
        openModal('editPipelineModal');
    });

    document.getElementById('editRendicionPipelineBtn')?.addEventListener('click', () => {
        document.getElementById('pipelineModalTitle').textContent = 'Gestionar Fases (Rendición)';
        renderStagesListForModal(RENDICION_STAGES, 'causas_rendicion_stages', () => renderRendicionBoard());
        openModal('editPipelineModal');
    });

    // Helper for modal stages list
    async function renderStagesListForModal(stagesArray, tableName, refreshCallback) {
        const list = document.getElementById('pipelineStagesList');
        list.innerHTML = stagesArray.map(s => `
            <li class="stage-item">
                <span><i class="ph ${s.icon || 'ph-circles-three'}"></i> ${s.title}</span>
                <button class="btn-icon btn-remove-stage-modal" data-id="${s.id}"><i class="ph ph-trash"></i></button>
            </li>
        `).join('');

        list.querySelectorAll('.btn-remove-stage-modal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const idx = stagesArray.findIndex(s => s.id === id);
                if (idx > -1) {
                    stagesArray.splice(idx, 1);
                    refreshCallback();
                    renderSettings();
                    await supabaseClient.from(tableName).delete().eq('id', id);
                    renderStagesListForModal(stagesArray, tableName, refreshCallback);
                }
            });
        });

        // Add stage logic inside modal
        const addBtn = document.getElementById('addStageBtn');
        const input = document.getElementById('newStageInput');
        
        // Remove old listeners to avoid duplicates
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        
        newAddBtn.addEventListener('click', async () => {
            if (input.value.trim()) {
                const newStage = { 
                    id: (tableName === 'causas_stages' ? 's_' : 'rs_') + Date.now(), 
                    title: input.value.trim(), 
                    icon: tableName === 'causas_stages' ? 'ph-kanban' : 'ph-presentation-chart' 
                };
                stagesArray.push(newStage);
                input.value = '';
                refreshCallback();
                renderSettings();
                await supabaseClient.from(tableName).insert(newStage);
                renderStagesListForModal(stagesArray, tableName, refreshCallback);
            }
        });
    }

    // Custom Delete Confirm Logic
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        if (currentDeleteAction) {
            await currentDeleteAction();
            currentDeleteAction = null;
        }
        document.getElementById('deleteConfirmModal').classList.remove('active');
    });

    // User Form Submit
    document.getElementById('userForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const editingId = e.target.dataset.editingId;
        const name = document.getElementById('nuName').value;
        const role = document.getElementById('nuRole').value;
        const avatar = document.getElementById('nuAvatar').value;
        const username = document.getElementById('nuUsername').value;
        const password = document.getElementById('nuPassword').value;
        
        const userObj = {
            name: name,
            role: role || null,
            avatar: avatar || null,
            username: username || null,
            password: password || null
        };
        
        if (editingId) {
            userObj.id = editingId;
            const existing = teamUsers.find(u => u.id === editingId);
            if(existing) {
                Object.assign(existing, userObj);
            }
        } else {
            userObj.id = 'u_' + Date.now();
            teamUsers.push(userObj);
        }
        
        renderTeam();
        renderBoard(); // refresh assignees
        populateSelects(); // refresh dropdowns
        e.target.closest('.modal-overlay').classList.remove('active');
        
        await upsertUser(userObj);
    });

    // New User Button
    document.getElementById('newUserBtn')?.addEventListener('click', () => {
        document.getElementById('userForm').dataset.editingId = '';
        document.getElementById('userModalTitle').textContent = 'Añadir Miembro';
        document.getElementById('userForm').reset();
        openModal('userModal');
    });

    // New/Edit Project Form Submit
    document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (editingProjectId) {
            // Update existing project
            const project = projects.find(p => p.id === editingProjectId);
            if (project) {
                project.title = document.getElementById('npTitle').value;
                project.description = document.getElementById('npDesc').value || null;
                project.category = document.getElementById('npCategory').value || null;
                project.assignee = document.getElementById('npAssignee').value || null;
                project.importance = document.getElementById('npImportance').value || null;
                project.donor = document.getElementById('npDonor').value || null;
                project.frontliner = document.getElementById('npFrontliner').value || null;
                project.delivery_period = document.getElementById('npDelivery').value || null;
                project.folder_link = document.getElementById('npFolderLink').value || null;
                
                renderBoard();
                renderRendicionBoard();
                renderGerencialBoard();
                renderSettings();
                renderDirectorio();
                document.getElementById('newProjectModal').classList.remove('active');
                
                await upsertProject(project);
            }
        } else {
            // Create new project
            const newProject = {
                id: 'p_' + Date.now(),
                title: document.getElementById('npTitle').value,
                description: document.getElementById('npDesc').value || null,
                category: document.getElementById('npCategory').value || null,
                assignee: document.getElementById('npAssignee').value || null,
                importance: document.getElementById('npImportance').value || null,
                donor: document.getElementById('npDonor').value || null,
                frontliner: document.getElementById('npFrontliner').value || null,
                delivery_period: document.getElementById('npDelivery').value || null,
                folder_link: document.getElementById('npFolderLink').value || null,
                date: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            };
            
            projects.unshift(newProject);
            renderBoard();
            renderRendicionBoard();
                renderGerencialBoard();
            renderSettings();
            renderDirectorio();
            document.getElementById('newProjectModal').classList.remove('active');
            e.target.reset();
            
            await upsertProject(newProject);
        }
    });

    // New Task Form Submit
    document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (editingTaskId) {
            const task = tasks.find(t => t.id === editingTaskId);
            if (task) {
                task.title = document.getElementById('ntTitle').value;
                task.description = document.getElementById('ntDesc').value || null;
                task.assignee = document.getElementById('ntAssignee').value || null;
                // Not changing project_id or status here, drag&drop handles status
                
                renderBoard();
                renderRendicionBoard();
                renderGerencialBoard();
                document.getElementById('newTaskModal').classList.remove('active');
                e.target.reset();
                editingTaskId = null;
                await upsertTask(task);
            }
        } else {
            const newTask = {
                id: 't_' + Date.now(),
                project_id: document.getElementById('ntProjectId').value,
                status: document.getElementById('ntStageId').value,
                title: document.getElementById('ntTitle').value,
                description: document.getElementById('ntDesc').value || null,
                assignee: document.getElementById('ntAssignee').value || null,
                date: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            };
            
            tasks.push(newTask);
            renderBoard();
            renderRendicionBoard();
                renderGerencialBoard();
            document.getElementById('newTaskModal').classList.remove('active');
            e.target.reset();
            
            await upsertTask(newTask);
        }
    });

    // Add Rendicion Pipeline Stage (Settings)
    document.getElementById('settingsAddRendicionStageBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('settingsNewRendicionStageInput');
        if(input.value.trim()) {
            const newId = 'rs_' + Date.now();
            const newStage = { id: newId, title: input.value.trim(), icon: 'ph-presentation-chart' };
            
            RENDICION_STAGES.push(newStage);
            input.value = '';
            renderRendicionBoard();
                renderGerencialBoard();
            renderSettings();
            
            await supabaseClient.from('causas_rendicion_stages').insert(newStage);
        }
    });

    // Add Pipeline Stage (Settings)
    document.getElementById('settingsAddStageBtn').addEventListener('click', async () => {
        const input = document.getElementById('settingsNewStageInput');
        if(input.value.trim()) {
            const newId = 's_' + Date.now();
            const newStage = { id: newId, title: input.value.trim(), icon: 'ph-kanban' };
            
            STAGES.push(newStage);
            input.value = '';
            renderBoard();
            renderSettings();
            
            await insertStage(newStage);
        }
    });

    // Add Category (Settings)
    document.getElementById('settingsAddCatBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('settingsNewCatInput');
        const colorInput = document.getElementById('settingsNewCatColor');
        if(input.value.trim()) {
            const newId = 'cat_' + Date.now();
            const newCat = { id: newId, label: input.value.trim(), color: colorInput.value };
            
            categories[newId] = newCat;
            input.value = '';
            populateSelects();
            renderBoard();
            renderSettings();
            
            await insertCategory(newCat);
        }
    });
}

function populateSelects() {
    const catSelect = document.getElementById('npCategory');
    const filterCatSelect = document.getElementById('filterCategory');
    const catOptions = Object.values(categories).map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    
    if(catSelect) catSelect.innerHTML = '<option value="">Sin Categoría</option>' + catOptions;
    if(filterCatSelect) filterCatSelect.innerHTML = '<option value="">Todas las Categorías</option>' + catOptions;
    
    const projectUserSelect = document.getElementById('npAssignee');
    const taskUserSelect = document.getElementById('ntAssignee');
    const userOptions = teamUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    
    if(projectUserSelect) projectUserSelect.innerHTML = userOptions || '<option value="">Sin Asignar</option>';
    if(taskUserSelect) taskUserSelect.innerHTML = userOptions || '<option value="">Sin Asignar</option>';

    const filterAssigneeSelect = document.getElementById('filterAssignee');
    if (filterAssigneeSelect) {
        const currentVal = filterAssigneeSelect.value;
        filterAssigneeSelect.innerHTML = '<option value="all">Todos los miembros</option>' + userOptions;
        filterAssigneeSelect.value = currentVal || 'all';
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

// Start
document.addEventListener('DOMContentLoaded', init);
