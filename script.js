/**
 * DevBoard Kanban - Learning Tracker
 * Handles cards (add, delete, drag between columns), modal form, and localStorage persistence.
 */

(function () {
  'use strict';

  // --- Constants ---
  const STORAGE_KEY = 'devboard-kanban-cards';
  const COLUMNS = ['to-learn', 'in-progress', 'blocked', 'completed'];

  /** Default cards when no saved data exists */
  const DEFAULT_CARDS = [
    { id: '1', title: 'Setup Development Environment', description: 'Install IDE, Node, and tooling.', column: 'completed', tags: ['DevOps'] },
    { id: '2', title: 'Build Kanban Board', description: 'Create this board with drag and drop.', column: 'completed', tags: ['Front-End'] },
    { id: '3', title: 'Learn API Integration', description: 'REST and async patterns.', column: 'completed', tags: ['Back-End'] },
    {id: "4", title: "Deploy to GitHub Pages", description: "Make board accessible online", column: "completed", tags: ['DevOps']},
    {id: "10", title: "Week 2: API Integration", description: "Learn to fetch external data", column: "to-learn", tags: ['Back-End']},
    {id: "6", title: "Feature - Card Tags", description: "Categorize cards with tags", column: "complete", tags: ['Front-End']},
    {id: "7", title: "Feature - due dates", description: "Insights when cards are due", column: "to-learn", tags: ['Front-End']},
    {id: "8", title: "Feature - Priority levels", description: "Prioritize cards based on importance", column: "to-learn", tags: ['Front-End']},
    {id: "9", title: "Feature - Search filter", description: "Search cards by title or description", column: "to-learn", tags: ['Front-End']},
    ];

  // --- State (in-memory list of cards) ---
  let cards = [];

  /** When set, modal is in edit mode for this card id; when null, modal is in add mode */
  let editingCardId = null;

  // --- DOM references (set in init) ---
  let modalOverlay;
  let addCardForm;
  let cardTitleInput;
  let cardDescriptionInput;
  let cardDueDateInput;
  let modalCancelBtn;
  let modalTitleEl;
  let modalHeaderActions;
  let modalActionsAdd;
  let modalActionsEdit;
  let modalDeleteBtn;

  /**
   * Generate a unique id for a new card.
   * @returns {string}
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /**
   * Load cards from localStorage. Returns default cards if none saved or parse fails.
   * @returns {Array<{id: string, title: string, description: string, column: string}>}
   */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...DEFAULT_CARDS];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CARDS];
      return parsed;
    } catch (_) {
      return [...DEFAULT_CARDS];
    }
  }

  /**
   * Save current cards to localStorage.
   */
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
      console.warn('DevBoard: could not save to localStorage', e);
    }
  }

  /**
   * Get the column id (to-learn | in-progress | completed) for a column or its child.
   * @param {Element} element
   * @returns {string|null}
   */
  function getColumnId(element) {
    const column = element.closest('.column');
    return column ? column.getAttribute('data-column') : null;
  }

  /**
   * Get human-readable due date label: "Due in X days", "Due today", "Overdue", "X days overdue".
   * @param {string} dueDateStr - YYYY-MM-DD
   * @returns {string}
   */
  function getDueDateLabel(dueDateStr) {
    if (!dueDateStr || typeof dueDateStr !== 'string') return '';
    const due = new Date(dueDateStr);
    if (Number.isNaN(due.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffMs = due - today;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return 'Due in ' + diffDays + ' day' + (diffDays === 1 ? '' : 's');
    if (diffDays === 0) return 'Due today';
    const abs = Math.abs(diffDays);
    return abs === 1 ? '1 day overdue' : abs + ' days overdue';
  }

  /**
 * Build the DOM element for one card (title, tags, description, delete button, draggable).
 * @param {{id: string, title: string, description: string, column: string, tags?: string[], dueDate?: string}} card
 * @returns {HTMLElement}
 */
  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('data-card-id', card.id);
    el.draggable = true;

    // Card header: title + delete button
    const header = document.createElement('div');
    header.className = 'card-header';

    const titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    titleEl.textContent = card.title;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'card-delete card-edit-btn';
    editBtn.setAttribute('aria-label', 'Edit card');
    editBtn.setAttribute('data-card-id', card.id);
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

    header.append(titleEl, editBtn);

    // Tags (between header and description)
    let tagsContainer = null;
    if (Array.isArray(card.tags) && card.tags.length > 0) {
      tagsContainer = document.createElement('div');
      tagsContainer.className = 'card-tags';
      card.tags.forEach(tagName => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tagName;
        tagSpan.setAttribute('data-tag', tagName);
        tagsContainer.appendChild(tagSpan);
      });
    }

    // Description
    const descEl = document.createElement('p');
    descEl.className = 'card-description';
    descEl.textContent = card.description || '';

    // Show more / Show less toggle (only when description is long enough to clamp)
    let descToggleEl = null;
    const descText = (card.description || '').trim();
    if (descText.length > 80) {
      descToggleEl = document.createElement('button');
      descToggleEl.type = 'button';
      descToggleEl.className = 'card-description-toggle';
      descToggleEl.setAttribute('aria-expanded', 'false');
      descToggleEl.textContent = 'Show more';
    }

    // Due date indicator (below description)
    let dueEl = null;
    const dueDateStr = card.dueDate && String(card.dueDate).trim();
    if (dueDateStr) {
      const dueLabel = getDueDateLabel(dueDateStr);
      if (dueLabel) {
        dueEl = document.createElement('div');
        dueEl.className = 'card-due-indicator';
        dueEl.textContent = dueLabel;
        dueEl.setAttribute('aria-label', 'Due: ' + dueLabel);
        const due = new Date(dueDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        if (due < today) el.classList.add('card-overdue');
      }
    }

    el.append(header);
    if (tagsContainer) el.append(tagsContainer);
    el.append(descEl);
    if (descToggleEl) el.append(descToggleEl);
    if (dueEl) el.append(dueEl);

    return el;
  }

  /**
   * Clear all column card containers and re-render every card into its column.
   */
  function renderBoard() {
    const containers = {};
    COLUMNS.forEach(col => {
      const section = document.querySelector(`.column[data-column="${col}"]`);
      const container = section ? section.querySelector('.column-cards') : null;
      if (container) {
        container.innerHTML = '';
        containers[col] = container;
      }
    });

    cards.forEach(card => {
      const container = containers[card.column];
      if (!container) return;
      const el = createCardElement(card);
      container.appendChild(el);
    });
  }

  /**
   * Open the add-card modal (empty form) and focus the title input.
   */
  function openModal() {
    if (!modalOverlay) return;
    editingCardId = null;
    if (modalTitleEl) modalTitleEl.textContent = 'Add New Card';
    if (modalHeaderActions) modalHeaderActions.classList.add('hidden');
    if (modalActionsAdd) modalActionsAdd.classList.remove('hidden');
    if (modalActionsEdit) modalActionsEdit.classList.add('hidden');
    addCardForm.reset();
    cardTitleInput.value = '';
    cardDescriptionInput.value = '';
    if (cardDueDateInput) cardDueDateInput.value = '';
    document.querySelectorAll('.tag-checkbox').forEach(cb => { cb.checked = false; });
    updateTagCheckboxes();
    modalOverlay.classList.add('modal-open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => cardTitleInput.focus(), 50);
  }

  /**
   * Open the modal in edit mode with form filled from the given card.
   * @param {string} cardId
   */
  function openEditModal(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card || !modalOverlay) return;
    editingCardId = cardId;
    if (modalTitleEl) modalTitleEl.textContent = 'Edit Card';
    if (modalHeaderActions) modalHeaderActions.classList.remove('hidden');
    if (modalActionsAdd) modalActionsAdd.classList.add('hidden');
    if (modalActionsEdit) modalActionsEdit.classList.remove('hidden');
    cardTitleInput.value = card.title || '';
    cardDescriptionInput.value = card.description || '';
    if (cardDueDateInput) cardDueDateInput.value = card.dueDate || '';
    document.querySelectorAll('.tag-checkbox').forEach(cb => {
      cb.checked = Array.isArray(card.tags) && card.tags.includes(cb.value);
    });
    updateTagCheckboxes();
    modalOverlay.classList.add('modal-open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => cardTitleInput.focus(), 50);
  }

  /**
   * Close the modal and reset state.
   */
  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('modal-open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    editingCardId = null;
    if (modalHeaderActions) modalHeaderActions.classList.add('hidden');
    if (modalActionsAdd) modalActionsAdd.classList.remove('hidden');
    if (modalActionsEdit) modalActionsEdit.classList.add('hidden');
    document.querySelectorAll('.tag-checkbox').forEach(cb => { cb.checked = false; });
    updateTagCheckboxes();
    if (cardDueDateInput) cardDueDateInput.value = '';
  }

  /**
   * Handle "Add Card" form submit: create card, add to "to-learn", save, render, close modal.
   * @param {Event} e
   */
  function handleAddCardSubmit(e) {
    e.preventDefault();
    const title = (cardTitleInput.value || '').trim();
    if (!title) return;

    const description = (cardDescriptionInput.value || '').trim();
    const tagCheckboxes = Array.from(document.querySelectorAll('input[name="tags"], .tag-checkbox'));
    const checkedTags = tagCheckboxes.filter(cb => cb.checked);
    const tags = checkedTags.map(cb => cb.value);
    if (tags.length > 2) {
      alert("You may select up to 2 tags only.");
      return;
    }
    const dueDate = (cardDueDateInput && cardDueDateInput.value) ? cardDueDateInput.value.trim() : '';

    // Edit mode: update existing card
    if (editingCardId) {
      const card = cards.find(c => c.id === editingCardId);
      if (card) {
        card.title = title;
        card.description = description;
        card.tags = tags;
        card.dueDate = dueDate || undefined;
        saveToStorage();
        renderBoard();
      }
      closeModal();
      return;
    }

    // Add mode: create new card
    const newCard = {
      id: generateId(),
      title,
      description,
      tags,
      column: 'to-learn',
      dueDate: dueDate || undefined,
    };
    cards.push(newCard);
    saveToStorage();
    renderBoard();
    closeModal();
  }

/**
 * Update tag checkboxes: disable unchecked ones when 2 are selected.
 */
function updateTagCheckboxes() {
  const checkboxes = document.querySelectorAll('.tag-checkbox');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    const option = cb.closest('.tag-option');
    
    if (!cb.checked && checked.length >= 2) {
      // Disable and fade unchecked boxes when 2 are selected
      cb.disabled = true;
      option.style.opacity = '0.5';
      option.style.cursor = 'not-allowed';
    } else {
      // Enable all when less than 2 selected
      cb.disabled = false;
      option.style.opacity = '1';
      option.style.cursor = 'pointer';
    }
  });
}

  /**
   * Handle delete button click: remove card by id, save, render.
   * @param {string} cardId
   */
  function deleteCard(cardId) {
    cards = cards.filter(c => c.id !== cardId);
    saveToStorage();
    renderBoard();
  }

  /**
   * Handle drag start: store card id in dataTransfer.
   * @param {DragEvent} e
   */
  function handleDragStart(e) {
    if (e.target.closest('.card-description-toggle')) return;
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    const id = cardEl.getAttribute('data-card-id');
    if (id) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      cardEl.classList.add('card-dragging');
    }
  }

  /**
   * Handle drag end: remove dragging class.
   * @param {DragEvent} e
   */
  function handleDragEnd(e) {
    const cardEl = e.target.closest('.card');
    if (cardEl) cardEl.classList.remove('card-dragging');
  }

  /**
   * Allow drop on column card areas.
   * @param {DragEvent} e
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const columnCards = e.target.closest('.column-cards');
    if (columnCards) columnCards.classList.add('column-cards-drag-over');
  }

  /**
   * Remove drag-over styling when leaving a drop zone.
   * @param {DragEvent} e
   */
  function handleDragLeave(e) {
    const columnCards = e.target.closest('.column-cards');
    if (columnCards && !columnCards.contains(e.relatedTarget)) {
      columnCards.classList.remove('column-cards-drag-over');
    }
  }

  /**
   * Handle drop: move card to the column that received the drop, save, render.
   * @param {DragEvent} e
   */
  function handleDrop(e) {
    e.preventDefault();
    const columnCards = e.target.closest('.column-cards');
    if (columnCards) columnCards.classList.remove('column-cards-drag-over');

    const columnId = getColumnId(e.target);
    if (!columnId || !COLUMNS.includes(columnId)) return;

    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    card.column = columnId;
    saveToStorage();
    renderBoard();
  }

  /**
   * Set up event listeners: Add Card button, modal form/cancel, overlay click,
   * delete delegation on board, drag and drop on board container.
   */
  function bindEvents() {
    const addCardBtn = document.querySelector('.add-card-btn');
    if (addCardBtn) addCardBtn.addEventListener('click', openModal);

    if (addCardForm) addCardForm.addEventListener('submit', handleAddCardSubmit);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
    const modalCancelEdit = document.getElementById('modal-cancel-edit');
    if (modalCancelEdit) modalCancelEdit.addEventListener('click', closeModal);
    if (modalDeleteBtn) {
      modalDeleteBtn.addEventListener('click', () => {
        if (editingCardId && confirm('Are you sure you want to delete this card? This cannot be undone.')) {
          deleteCard(editingCardId);
          closeModal();
        }
      });
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('modal-open')) {
        closeModal();
      }
    });

    // Edit card: gear button opens edit modal
    const board = document.querySelector('.board-container');
    if (board) {
      board.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.card-description-toggle');
        if (toggleBtn) {
          e.preventDefault();
          const cardEl = toggleBtn.closest('.card');
          if (cardEl) {
            const expanded = cardEl.classList.toggle('card-description-expanded');
            toggleBtn.setAttribute('aria-expanded', expanded);
            toggleBtn.textContent = expanded ? 'Show less' : 'Show more';
          }
          return;
        }
        const btn = e.target.closest('.card-delete');
        if (!btn) return;
        const cardId = btn.getAttribute('data-card-id') || (btn.closest('.card') && btn.closest('.card').getAttribute('data-card-id'));
        if (cardId) {
          e.preventDefault();
          openEditModal(cardId);
        }
      });
    }

    // Drag and drop: delegate for dragstart/dragend on cards, dragover/drop on column-cards
    if (board) {
      board.addEventListener('dragstart', handleDragStart);
      board.addEventListener('dragend', handleDragEnd);
      board.addEventListener('dragover', handleDragOver);
      board.addEventListener('dragleave', handleDragLeave);
      board.addEventListener('drop', handleDrop);
    }

    // Tag checkboxes: limit selection to max 2
    document.querySelectorAll('.tag-checkbox').forEach(cb => {
      cb.addEventListener('change', updateTagCheckboxes);
    });
  }

  /**
   * Initialize app: load data, cache DOM refs, bind events, render.
   */
  function init() {
    cards = loadFromStorage();
    saveToStorage(); // ensure defaults are written if first run

    modalOverlay = document.getElementById('modal-overlay');
    addCardForm = document.getElementById('add-card-form');
    cardTitleInput = document.getElementById('card-title-input');
    cardDescriptionInput = document.getElementById('card-description-input');
    cardDueDateInput = document.getElementById('card-due-date-input');
    modalCancelBtn = document.getElementById('modal-cancel');
    modalTitleEl = document.getElementById('modal-title');
    modalHeaderActions = document.getElementById('modal-header-actions');
    modalActionsAdd = document.getElementById('modal-actions-add');
    modalActionsEdit = document.getElementById('modal-actions-edit');
    modalDeleteBtn = document.getElementById('modal-delete');

    bindEvents();
    updateTagCheckboxes(); // set initial state (max 2 selected)
    renderBoard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
