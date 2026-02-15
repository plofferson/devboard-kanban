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
    { id: '2', title: 'Build Kanban Board', description: 'Create this board with drag and drop.', column: 'completed' },
    { id: '3', title: 'Learn API Integration', description: 'REST and async patterns.', column: 'completed' },
    {id: "4", title: "Deploy to GitHub Pages", description: "Make board accessible online", column: "completed"},
    {id: "10", title: "Week 2: API Integration", description: "Learn to fetch external data", column: "to-learn"},
    {id: "6", title: "Feature - Card Tags", description: "Categorize cards with tags", column: "to-learn"},
    {id: "7", title: "Feature - due dates", description: "Insights when cards are due", column: "to-learn"},
    {id: "8", title: "Feature - Priority levels", description: "Prioritize cards based on importance", column: "to-learn"},
    {id: "9", title: "Feature - Search filter", description: "Search cards by title or description", column: "to-learn"},
    ];

  // --- State (in-memory list of cards) ---
  let cards = [];

  // --- DOM references (set in init) ---
  let modalOverlay;
  let addCardForm;
  let cardTitleInput;
  let cardDescriptionInput;
  let modalCancelBtn;

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
 * Build the DOM element for one card (title, tags, description, delete button, draggable).
 * @param {{id: string, title: string, description: string, column: string, tags?: string[]}} card
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

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'card-delete';
    deleteBtn.setAttribute('aria-label', 'Delete card');
    deleteBtn.textContent = 'Delete';

    header.append(titleEl, deleteBtn);

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

    el.append(header);
    if (tagsContainer) el.append(tagsContainer);
    el.append(descEl);

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
   * Open the add-card modal and focus the title input.
   */
  function openModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.add('modal-open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    addCardForm.reset();
    cardTitleInput.value = '';
    cardDescriptionInput.value = '';
    setTimeout(() => cardTitleInput.focus(), 50);
  }

  /**
   * Close the add-card modal.
   */
  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('modal-open');
    modalOverlay.setAttribute('aria-hidden', 'true');

    // Reset tag checkboxes so modal opens fresh next time
    document.querySelectorAll('.tag-checkbox').forEach(cb => { cb.checked = false; });
    updateTagCheckboxes();
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

    // 1. Get all checked tag checkboxes (name="tag" or class="tag-checkbox")
    const tagCheckboxes = Array.from(document.querySelectorAll('input[name="tags"], .tag-checkbox'));
    const checkedTags = tagCheckboxes.filter(cb => cb.checked);

    // 2. Store selected tag values in a tags array
    const tags = checkedTags.map(cb => cb.value);

    // 3. Validate max 2 tags selected - if more, show alert and return early
    if (tags.length > 2) {
      alert("You may select up to 2 tags only.");
      return;
    }

    // 4. Add tags array to the newCard object (empty array if none selected)
    const newCard = {
      id: generateId(),
      title,
      description,
      tags, // always an array (could be empty)
      column: 'to-learn',
    };
    cards.push(newCard);
    saveToStorage();
    renderBoard();
    closeModal();

    // 5. Tag checkbox reset/uncheck handled in closeModal (see custom rule)
    // (If not: tagCheckboxes.forEach(cb => cb.checked = false);)
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

    // Delete: delegate from board container (cards are recreated on render)
    const board = document.querySelector('.board-container');
    if (board) {
      board.addEventListener('click', (e) => {
        const btn = e.target.closest('.card-delete');
        if (!btn) return;
        const card = btn.closest('.card');
        if (card) {
          e.preventDefault();
          deleteCard(card.getAttribute('data-card-id'));
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
    modalCancelBtn = document.getElementById('modal-cancel');

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
