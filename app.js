const firebaseConfig = {
  apiKey: "AIzaSyCP51P7jBtgK425eugqv7UwW3stAA2kaYE",
  authDomain: "ym-lex-nn-website.firebaseapp.com",
  projectId: "ym-lex-nn-website",
  storageBucket: "ym-lex-nn-website.firebasestorage.app",
  messagingSenderId: "359813736996",
  appId: "1:359813736996:web:e745bdb4cf8356183486b1",
  measurementId: "G-TM5HCSDV8L"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const approvalPendingScreen = document.getElementById('approval-pending');
const appContainer = document.getElementById('app-container');
const googleSignInBtn = document.getElementById('google-signin');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const mainNav = document.getElementById('main-nav');
const navLinks = mainNav.querySelectorAll('a');
const contentSections = document.querySelectorAll('.content-section');

// Current user information
let currentUser = null;

// Authentication
googleSignInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            console.error('Error during sign in:', error);
            alert('Error signing in. Please try again.');
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .catch(error => {
            console.error('Error during sign out:', error);
        });
});

// Check authentication state
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName || user.email;
        
        // Check if user is approved
        let userDoc = await db.collection('users').doc(user.uid).get();
        
        // Create user in database if they don't exist
        if (!userDoc.exists) {
            console.log('Creating new user document in Firestore for:', user.email);
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || '',
                email: user.email,
                approved: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Get the updated user document after creation
            userDoc = await db.collection('users').doc(user.uid).get();
        }
        
        if (userDoc.exists && userDoc.data().approved) {
            // User is approved, show the app
            loginScreen.style.display = 'none';
            approvalPendingScreen.style.display = 'none';
            appContainer.style.display = 'block';
            
            // Load initial content (This Week's Work)
            loadContent('this-week');
        } else {
            // User is not approved, show pending screen
            loginScreen.style.display = 'none';
            appContainer.style.display = 'none';
            approvalPendingScreen.style.display = 'flex';
        }
    } else {
        // User is logged out
        currentUser = null;
        loginScreen.style.display = 'flex';
        approvalPendingScreen.style.display = 'none';
        appContainer.style.display = 'none';
    }
});

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        
        // Update active link
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        link.classList.add('active');
        
        // Show corresponding content
        loadContent(page);
    });
});

// Load content based on selected nav item
function loadContent(page) {
    contentSections.forEach(section => {
        section.style.display = 'none';
    });
    
    const selectedSection = document.getElementById(page);
    if (selectedSection) {
        selectedSection.style.display = 'block';
        
        // Load data for the selected section
        switch (page) {
            case 'this-week':
                loadWorkItems();
                break;
            case 'meetings':
                loadMeetings();
                break;
            case 'checklists':
                loadChecklists();
                break;
            case 'finances':
                loadExpenses();
                break;
            case 'inventory':
                loadInventory();
                break;
            case 'forms':
                loadForms();
                break;
            case 'roles':
                loadRoles();
                break;
            case 'halaqas':
                loadHalaqas();
                break;
        }
    }
}

// ====== THIS WEEK'S WORK FUNCTIONALITY ======
const addWorkItemBtn = document.getElementById('add-work-item');
const workItemsList = document.getElementById('work-items-list');
const addWorkForm = document.getElementById('add-work-form');
const workForm = document.getElementById('work-form');
const cancelWorkAddBtn = document.getElementById('cancel-work-add');

// Show/hide work form
addWorkItemBtn.addEventListener('click', () => {
    addWorkForm.style.display = 'block';
    workForm.reset();
});

cancelWorkAddBtn.addEventListener('click', () => {
    addWorkForm.style.display = 'none';
});

// Handle work form submission
workForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('work-description').value;
    const deadline = document.getElementById('work-deadline').value || null;
    
    try {
        await db.collection('workItems').add({
            description,
            deadline,
            completed: false,
            completedBy: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        addWorkForm.style.display = 'none';
        loadWorkItems();
    } catch (error) {
        console.error('Error adding work item:', error);
        alert('Error adding work item. Please try again.');
    }
});

// Load work items
async function loadWorkItems() {
    try {
        const snapshot = await db.collection('workItems')
            .orderBy('createdAt', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No work items found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const item = doc.data();
                const completed = item.completed ? 'checked' : '';
                const textClass = item.completed ? 'work-item-text work-item-completed' : 'work-item-text';
                
                html += `
                    <div class="work-item" data-id="${doc.id}">
                        <input type="checkbox" class="work-item-checkbox" ${completed}>
                        <div class="${textClass}">
                            ${item.description}
                            ${item.deadline ? `<div class="work-item-meta">Deadline: ${item.deadline}</div>` : ''}
                            ${item.completed ? `<div class="work-item-meta">Completed by: ${item.completedBy}</div>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        workItemsList.innerHTML = html;
        
        // Add event listeners to checkboxes
        const checkboxes = workItemsList.querySelectorAll('.work-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleWorkItemCheck);
        });
    } catch (error) {
        console.error('Error loading work items:', error);
        workItemsList.innerHTML = '<div class="error-message">Error loading work items. Please try again.</div>';
    }
}

// Handle work item checkbox change
async function handleWorkItemCheck(e) {
    const checkbox = e.target;
    const workItem = checkbox.closest('.work-item');
    const itemId = workItem.getAttribute('data-id');
    const isChecked = checkbox.checked;
    
    try {
        await db.collection('workItems').doc(itemId).update({
            completed: isChecked,
            completedBy: isChecked ? currentUser.displayName : null
        });
        
        // Update UI
        const textElement = workItem.querySelector('.work-item-text');
        if (isChecked) {
            textElement.classList.add('work-item-completed');
            const meta = document.createElement('div');
            meta.className = 'work-item-meta';
            meta.textContent = `Completed by: ${currentUser.displayName}`;
            textElement.appendChild(meta);
        } else {
            textElement.classList.remove('work-item-completed');
            const meta = textElement.querySelector('.work-item-meta:last-child');
            if (meta && meta.textContent.includes('Completed by')) {
                meta.remove();
            }
        }
    } catch (error) {
        console.error('Error updating work item:', error);
        alert('Error updating work item. Please try again.');
        // Revert checkbox state
        checkbox.checked = !isChecked;
    }
}

// ====== MEETINGS FUNCTIONALITY ======
const addMeetingBtn = document.getElementById('add-meeting');
const viewPastMeetingsBtn = document.getElementById('view-past-meetings');
const meetingList = document.getElementById('meeting-list');
const addMeetingForm = document.getElementById('add-meeting-form');
const meetingForm = document.getElementById('meeting-form');
const cancelMeetingAddBtn = document.getElementById('cancel-meeting-add');

// Show/hide meeting form
addMeetingBtn.addEventListener('click', () => {
    addMeetingForm.style.display = 'block';
    meetingForm.reset();
});

cancelMeetingAddBtn.addEventListener('click', () => {
    addMeetingForm.style.display = 'none';
});

// Handle meeting form submission
meetingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('meeting-date').value;
    const title = document.getElementById('meeting-title').value;
    const notes = document.getElementById('meeting-notes').value;
    
    try {
        await db.collection('meetings').add({
            date,
            title,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addMeetingForm.style.display = 'none';
        loadMeetings();
    } catch (error) {
        console.error('Error adding meeting:', error);
        alert('Error adding meeting. Please try again.');
    }
});

// Load meetings
async function loadMeetings() {
    try {
        const snapshot = await db.collection('meetings')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No meetings found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const meeting = doc.data();
                html += `
                    <div class="list-item" data-id="${doc.id}">
                        <div>
                            <h3>${meeting.title}</h3>
                            <div class="list-item-meta">Date: ${meeting.date}</div>
                            <div class="list-item-meta">Added by: ${meeting.createdByName || 'Unknown'}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn-small view-meeting">View</button>
                        </div>
                    </div>
                `;
            });
        }
        
        meetingList.innerHTML = html;
        
        // Add event listeners to view buttons
        const viewButtons = meetingList.querySelectorAll('.view-meeting');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewMeeting);
        });
    } catch (error) {
        console.error('Error loading meetings:', error);
        meetingList.innerHTML = '<div class="error-message">Error loading meetings. Please try again.</div>';
    }
}

// View meeting details
async function viewMeeting(e) {
    const button = e.target;
    const listItem = button.closest('.list-item');
    const meetingId = listItem.getAttribute('data-id');
    
    try {
        const doc = await db.collection('meetings').doc(meetingId).get();
        if (doc.exists) {
            const meeting = doc.data();
            
            // Create modal for viewing meeting
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>${meeting.title}</h2>
                    <div class="modal-meta">Date: ${meeting.date}</div>
                    <div class="modal-meta">Added by: ${meeting.createdByName || 'Unknown'}</div>
                    <div class="modal-body">
                        <pre>${meeting.notes}</pre>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    } catch (error) {
        console.error('Error viewing meeting:', error);
        alert('Error viewing meeting. Please try again.');
    }
}

// ====== CHECKLISTS FUNCTIONALITY ======
const createChecklistBtn = document.getElementById('create-checklist');
const viewPastChecklistsBtn = document.getElementById('view-past-checklists');
const currentChecklistContainer = document.getElementById('current-checklist');
const addChecklistForm = document.getElementById('add-checklist-form');
const checklistForm = document.getElementById('checklist-form');
const cancelChecklistAddBtn = document.getElementById('cancel-checklist-add');
const addChecklistItemBtn = document.getElementById('add-checklist-item');
const checklistItems = document.getElementById('checklist-items');

// Show/hide checklist form
createChecklistBtn.addEventListener('click', () => {
    addChecklistForm.style.display = 'block';
    checklistForm.reset();
    
    // Clear all checklist items except the first one
    const items = checklistItems.querySelectorAll('.checklist-item');
    for (let i = 1; i < items.length; i++) {
        items[i].remove();
    }
    
    // Clear the first item's input
    const firstItemInput = checklistItems.querySelector('.checklist-item-text');
    if (firstItemInput) {
        firstItemInput.value = '';
    }
});

cancelChecklistAddBtn.addEventListener('click', () => {
    addChecklistForm.style.display = 'none';
});

// Add checklist item
addChecklistItemBtn.addEventListener('click', addChecklistItem);

function addChecklistItem() {
    const newItem = document.createElement('div');
    newItem.className = 'checklist-item';
    newItem.innerHTML = `
        <input type="text" class="checklist-item-text" placeholder="Checklist item" required>
        <button type="button" class="remove-item">×</button>
    `;
    checklistItems.appendChild(newItem);
    
    // Add event listener for the remove button
    const removeBtn = newItem.querySelector('.remove-item');
    removeBtn.addEventListener('click', () => {
        newItem.remove();
    });
    
    // Focus the new input
    const input = newItem.querySelector('.checklist-item-text');
    input.focus();
}

// Add event listeners to existing remove buttons
document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', () => {
        button.closest('.checklist-item').remove();
    });
});

// Handle checklist form submission
checklistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('checklist-title').value;
    const itemInputs = document.querySelectorAll('.checklist-item-text');
    const items = [];
    
    itemInputs.forEach(input => {
        if (input.value.trim()) {
            items.push({
                text: input.value.trim(),
                checked: false
            });
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one checklist item.');
        return;
    }
    
    try {
        await db.collection('checklists').add({
            title,
            items,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addChecklistForm.style.display = 'none';
        loadChecklists();
    } catch (error) {
        console.error('Error creating checklist:', error);
        alert('Error creating checklist. Please try again.');
    }
});

// Load checklists
async function loadChecklists() {
    try {
        const snapshot = await db.collection('checklists')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html += '<div class="empty-list">No checklists found. Create one using the button above.</div>';
        } else {
            html += '<div class="checklist-list">';
            snapshot.forEach(doc => {
                const checklist = doc.data();
                html += `
                    <div class="list-item" data-id="${doc.id}">
                        <div>
                            <h3>${checklist.title}</h3>
                            <div class="list-item-meta">Items: ${checklist.items.length}</div>
                            <div class="list-item-meta">Created by: ${checklist.createdByName || 'Unknown'}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn-small view-checklist">View/Edit</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        currentChecklistContainer.innerHTML = html;
        
        // Add event listeners to view buttons
        const viewButtons = currentChecklistContainer.querySelectorAll('.view-checklist');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewChecklist);
        });
    } catch (error) {
        console.error('Error loading checklists:', error);
        currentChecklistContainer.innerHTML = '<div class="error-message">Error loading checklists. Please try again.</div>';
    }
}

// View and edit checklist
async function viewChecklist(e) {
    const button = e.target;
    const listItem = button.closest('.list-item');
    const checklistId = listItem.getAttribute('data-id');
    
    try {
        const doc = await db.collection('checklists').doc(checklistId).get();
        if (doc.exists) {
            const checklist = doc.data();
            
            // Create modal for viewing/editing checklist
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>${checklist.title}</h2>
                    <div class="modal-meta">Created by: ${checklist.createdByName || 'Unknown'}</div>
                    <div class="checklist-items-container">
                        ${checklist.items.map((item, index) => `
                            <div class="checklist-item-view">
                                <input type="checkbox" id="item-${index}" data-index="${index}" ${item.checked ? 'checked' : ''}>
                                <label for="item-${index}">${item.text}</label>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions">
                        <button id="save-checklist" class="btn">Save Changes</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Handle save changes
            const saveBtn = modal.querySelector('#save-checklist');
            saveBtn.addEventListener('click', async () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const updatedItems = [...checklist.items];
                
                checkboxes.forEach(checkbox => {
                    const index = parseInt(checkbox.getAttribute('data-index'));
                    if (index >= 0 && index < updatedItems.length) {
                        updatedItems[index].checked = checkbox.checked;
                    }
                });
                
                try {
                    await db.collection('checklists').doc(checklistId).update({
                        items: updatedItems
                    });
                    modal.remove();
                    loadChecklists();
                } catch (error) {
                    console.error('Error updating checklist:', error);
                    alert('Error updating checklist. Please try again.');
                }
            });
        }
    } catch (error) {
        console.error('Error viewing checklist:', error);
        alert('Error viewing checklist. Please try again.');
    }
}

// ====== FINANCES FUNCTIONALITY ======
const addExpenseBtn = document.getElementById('add-expense');
const viewExpensesBtn = document.getElementById('view-expenses');
const expensesList = document.getElementById('expenses-list');
const addExpenseForm = document.getElementById('add-expense-form');
const expenseForm = document.getElementById('expense-form');
const cancelExpenseAddBtn = document.getElementById('cancel-expense-add');

// Show/hide expense form
addExpenseBtn.addEventListener('click', () => {
    addExpenseForm.style.display = 'block';
    expenseForm.reset();
});

cancelExpenseAddBtn.addEventListener('click', () => {
    addExpenseForm.style.display = 'none';
});

// Handle expense form submission
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const item = document.getElementById('expense-item').value;
    const price = parseFloat(document.getElementById('expense-price').value);
    const date = document.getElementById('expense-date').value;
    const receipt = document.getElementById('expense-receipt').value;
    const reason = document.getElementById('expense-reason').value;
    const approver = document.getElementById('expense-approver').value;
    const refunded = document.getElementById('expense-refunded').value;
    
    try {
        await db.collection('expenses').add({
            item,
            price,
            date,
            receiptUrl: receipt,
            reason,
            approvedBy: approver,
            refunded: refunded === 'yes',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addExpenseForm.style.display = 'none';
        loadExpenses();
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Error adding expense. Please try again.');
    }
});

// Add these after the expense-related DOM elements
const addDonationBtn = document.getElementById('add-donation');
const addDonationForm = document.getElementById('add-donation-form');
const donationForm = document.getElementById('donation-form');
const cancelDonationAddBtn = document.getElementById('cancel-donation-add');

// Show/hide donation form
addDonationBtn.addEventListener('click', () => {
    addDonationForm.style.display = 'block';
    donationForm.reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('donation-date').value = today;
});

cancelDonationAddBtn.addEventListener('click', () => {
    addDonationForm.style.display = 'none';
});

// Handle donation form submission
donationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('donation-amount').value);
    const date = document.getElementById('donation-date').value;
    const donor = document.getElementById('donation-donor').value;
    const notes = document.getElementById('donation-notes').value;
    
    try {
        await db.collection('donations').add({
            amount,
            date,
            donor,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addDonationForm.style.display = 'none';
        loadExpenses(); // This will now also load donations
    } catch (error) {
        console.error('Error adding donation:', error);
        alert('Error adding donation. Please try again.');
    }
});

// Function to load budget information
async function loadBudgetInfo() {
    try {
        // Get the budget document from Firestore
        const budgetDoc = await db.collection('settings').doc('budget').get();
        
        if (budgetDoc.exists) {
            const budgetData = budgetDoc.data();
            document.getElementById('initial-budget').textContent = `$${budgetData.initialBudget.toFixed(2)}`;
        } else {
            // If the budget document doesn't exist, create it with a default value
            await db.collection('settings').doc('budget').set({
                initialBudget: 0.00,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser ? currentUser.uid : 'system'
            });
            document.getElementById('initial-budget').textContent = '$0.00';
        }
    } catch (error) {
        console.error('Error loading budget information:', error);
        document.getElementById('initial-budget').textContent = '$0.00';
    }
}

async function loadExpenses() {
    try {
        // Load budget information first
        await loadBudgetInfo();
        
        // Load expenses
        const expensesSnapshot = await db.collection('expenses')
            .orderBy('date', 'desc')
            .get();
            
        // Load donations
        const donationsSnapshot = await db.collection('donations')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        let totalExpenses = 0;
        let totalDonations = 0;
        
        // Process expenses
        expensesSnapshot.forEach(doc => {
        const expense = doc.data();
        // Include all expenses in the total regardless of refund status
            totalExpenses += expense.price;
        });
        
        // Process donations
        donationsSnapshot.forEach(doc => {
            const donation = doc.data();
            totalDonations += donation.amount;
        });
        
        // Calculate net budget
        const initialBudget = parseFloat(document.getElementById('initial-budget').textContent.replace('$', ''));
        const netBudget = initialBudget + totalDonations - totalExpenses;
        
        // Update the displayed information
        document.getElementById('total-donations').textContent = `$${totalDonations.toFixed(2)}`;
        document.getElementById('spent-to-date').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('budget-remaining').textContent = `$${netBudget.toFixed(2)}`;
        
        // Add color based on remaining amount
        const remainingElement = document.getElementById('budget-remaining');
        if (netBudget < 0) {
            remainingElement.style.color = 'var(--error-color)';
        } else if (netBudget < initialBudget * 0.2) {
            remainingElement.style.color = 'orange';
        } else {
            remainingElement.style.color = 'var(--success-color)';
        }
        
        // Generate the HTML for expenses and donations table
        // Generate table headers
        html += `
            <div class="expense-table">
                <div class="expense-header">
                    <div class="expense-cell">Type</div>
                    <div class="expense-cell">Description</div>
                    <div class="expense-cell">Amount</div>
                    <div class="expense-cell">Date</div>
                    <div class="expense-cell">Person</div>
                    <div class="expense-cell">Actions</div>
                </div>
        `;
        
        // Add expenses to the table
        expensesSnapshot.forEach(doc => {
            const expense = doc.data();
            html += `
                <div class="expense-row" data-id="${doc.id}" data-type="expense">
                    <div class="expense-cell">Expense</div>
                    <div class="expense-cell">${expense.item}</div>
                    <div class="expense-cell">-$${expense.price.toFixed(2)}</div>
                    <div class="expense-cell">${expense.date}</div>
                    <div class="expense-cell">${expense.approvedBy}</div>
                    <div class="expense-cell">
                        <button class="btn-small view-expense">Details</button>
                    </div>
                </div>
            `;
        });
        
        // Add donations to the table
        donationsSnapshot.forEach(doc => {
            const donation = doc.data();
            html += `
                <div class="expense-row donation-row" data-id="${doc.id}" data-type="donation">
                    <div class="expense-cell">Donation</div>
                    <div class="expense-cell">${donation.notes || 'General Donation'}</div>
                    <div class="expense-cell donation-amount">+$${donation.amount.toFixed(2)}</div>
                    <div class="expense-cell">${donation.date}</div>
                    <div class="expense-cell">${donation.donor}</div>
                    <div class="expense-cell">
                        <button class="btn-small view-donation">Details</button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        
        expensesList.innerHTML = html;
        
        // Add event listeners to view buttons
        const viewExpenseButtons = expensesList.querySelectorAll('.view-expense');
        viewExpenseButtons.forEach(button => {
            button.addEventListener('click', viewExpense);
        });
        
        const viewDonationButtons = expensesList.querySelectorAll('.view-donation');
        viewDonationButtons.forEach(button => {
            button.addEventListener('click', viewDonation);
        });
    } catch (error) {
        console.error('Error loading finances:', error);
        expensesList.innerHTML = '<div class="error-message">Error loading financial data. Please try again.</div>';
    }
}

// View expense details
async function viewExpense(e) {
    const button = e.target;
    const row = button.closest('.expense-row');
    const expenseId = row.getAttribute('data-id');
    
    try {
        const doc = await db.collection('expenses').doc(expenseId).get();
        if (doc.exists) {
            const expense = doc.data();
            
            // Create modal for viewing expense
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Expense Details: ${expense.item}</h2>
                    <div class="expense-details">
                        <div class="detail-row">
                            <div class="detail-label">Item:</div>
                            <div class="detail-value">${expense.item}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Price:</div>
                            <div class="detail-value">$${expense.price.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Date:</div>
                            <div class="detail-value">${expense.date}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Reason:</div>
                            <div class="detail-value">${expense.reason}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Approved By:</div>
                            <div class="detail-value">${expense.approvedBy}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Need to reimburse?</div>
                            <div class="detail-value">${expense.refunded ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Added By:</div>
                            <div class="detail-value">${expense.createdByName || 'Unknown'}</div>
                        </div>
                        ${expense.receiptUrl ? `
                            <div class="detail-row">
                                <div class="detail-label">Receipt:</div>
                                <div class="detail-value">
                                    <a href="${expense.receiptUrl}" target="_blank">View Receipt</a>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    } catch (error) {
        console.error('Error viewing expense:', error);
        alert('Error viewing expense. Please try again.');
    }
}

async function viewDonation(e) {
    const button = e.target;
    const row = button.closest('.donation-row');
    const donationId = row.getAttribute('data-id');
    
    try {
        const doc = await db.collection('donations').doc(donationId).get();
        if (doc.exists) {
            const donation = doc.data();
            
            // Create modal for viewing donation
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Donation Details</h2>
                    <div class="expense-details">
                        <div class="detail-row">
                            <div class="detail-label">Amount:</div>
                            <div class="detail-value">$${donation.amount.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Date:</div>
                            <div class="detail-value">${donation.date}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Donor:</div>
                            <div class="detail-value">${donation.donor}</div>
                        </div>
                        ${donation.notes ? `
                            <div class="detail-row">
                                <div class="detail-label">Notes:</div>
                                <div class="detail-value">${donation.notes}</div>
                            </div>
                        ` : ''}
                        <div class="detail-row">
                            <div class="detail-label">Added By:</div>
                            <div class="detail-value">${donation.createdByName || 'Unknown'}</div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    } catch (error) {
        console.error('Error viewing donation:', error);
        alert('Error viewing donation. Please try again.');
    }
}


// ====== INVENTORY FUNCTIONALITY ======
const addInventoryBtn = document.getElementById('add-inventory');
const viewInventoryBtn = document.getElementById('view-inventory');
const inventoryList = document.getElementById('inventory-list');
const addInventoryForm = document.getElementById('add-inventory-form');
const inventoryForm = document.getElementById('inventory-form');
const cancelInventoryAddBtn = document.getElementById('cancel-inventory-add');

// Show/hide inventory form
addInventoryBtn.addEventListener('click', () => {
    addInventoryForm.style.display = 'block';
    inventoryForm.reset();
    document.getElementById('inventory-quantity').value = 1;
});

cancelInventoryAddBtn.addEventListener('click', () => {
    addInventoryForm.style.display = 'none';
});

// Handle inventory form submission
inventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const item = document.getElementById('inventory-item').value;
    const location = document.getElementById('inventory-location').value;
    const quantity = parseInt(document.getElementById('inventory-quantity').value);
    
    try {
        await db.collection('inventory').add({
            item,
            location,
            quantity,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addInventoryForm.style.display = 'none';
        loadInventory();
    } catch (error) {
        console.error('Error adding inventory item:', error);
        alert('Error adding inventory item. Please try again.');
    }
});

// Load inventory
async function loadInventory() {
    try {
        const snapshot = await db.collection('inventory')
            .orderBy('item')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No inventory items found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const inventoryItem = doc.data();
                html += `
                    <div class="list-item inventory-item" data-id="${doc.id}">
                        <div>
                            <h3>${inventoryItem.item}</h3>
                            <div class="list-item-meta">Location: ${inventoryItem.location}</div>
                            <div class="list-item-meta">Quantity: <span class="quantity-value">${inventoryItem.quantity}</span></div>
                        </div>
                        <div class="list-item-actions inventory-actions">
                            <button class="btn-small decrease-quantity">-</button>
                            <button class="btn-small increase-quantity">+</button>
                            <button class="btn-small view-inventory-item">Details</button>
                        </div>
                    </div>
                `;
            });
        }
        
        inventoryList.innerHTML = html;
        
        // Add event listeners to quantity buttons
        const decreaseButtons = inventoryList.querySelectorAll('.decrease-quantity');
        decreaseButtons.forEach(button => {
            button.addEventListener('click', decreaseInventoryQuantity);
        });
        
        const increaseButtons = inventoryList.querySelectorAll('.increase-quantity');
        increaseButtons.forEach(button => {
            button.addEventListener('click', increaseInventoryQuantity);
        });
        
        // Add event listeners to view buttons
        const viewButtons = inventoryList.querySelectorAll('.view-inventory-item');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewInventoryItem);
        });
    } catch (error) {
        console.error('Error loading inventory:', error);
        inventoryList.innerHTML = '<div class="error-message">Error loading inventory. Please try again.</div>';
    }
}

// Decrease inventory quantity
async function decreaseInventoryQuantity(e) {
    const button = e.target;
    const listItem = button.closest('.inventory-item');
    const itemId = listItem.getAttribute('data-id');
    const quantityElement = listItem.querySelector('.quantity-value');
    const currentQuantity = parseInt(quantityElement.textContent);
    
    // Don't allow negative quantities
    if (currentQuantity <= 0) {
        return;
    }
    
    const newQuantity = currentQuantity - 1;
    
    try {
        await db.collection('inventory').doc(itemId).update({
            quantity: newQuantity
        });
        
        // Update UI
        quantityElement.textContent = newQuantity;
    } catch (error) {
        console.error('Error updating inventory quantity:', error);
        alert('Error updating inventory quantity. Please try again.');
    }
}

// Increase inventory quantity
async function increaseInventoryQuantity(e) {
    const button = e.target;
    const listItem = button.closest('.inventory-item');
    const itemId = listItem.getAttribute('data-id');
    const quantityElement = listItem.querySelector('.quantity-value');
    const currentQuantity = parseInt(quantityElement.textContent);
    
    const newQuantity = currentQuantity + 1;
    
    try {
        await db.collection('inventory').doc(itemId).update({
            quantity: newQuantity
        });
        
        // Update UI
        quantityElement.textContent = newQuantity;
    } catch (error) {
        console.error('Error updating inventory quantity:', error);
        alert('Error updating inventory quantity. Please try again.');
    }
}

// View inventory item details
async function viewInventoryItem(e) {
    const button = e.target;
    const listItem = button.closest('.inventory-item');
    const itemId = listItem.getAttribute('data-id');
    
    try {
        const doc = await db.collection('inventory').doc(itemId).get();
        if (doc.exists) {
            const inventoryItem = doc.data();
            
            // Create modal for viewing inventory item
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Inventory Item: ${inventoryItem.item}</h2>
                    <div class="inventory-details">
                        <div class="detail-row">
                            <div class="detail-label">Item:</div>
                            <div class="detail-value">${inventoryItem.item}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Location:</div>
                            <div class="detail-value">${inventoryItem.location}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Quantity:</div>
                            <div class="detail-value">${inventoryItem.quantity}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Added By:</div>
                            <div class="detail-value">${inventoryItem.createdByName || 'Unknown'}</div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="update-quantity">Update Quantity:</label>
                        <input type="number" id="update-quantity" min="0" value="${inventoryItem.quantity}">
                        <button id="save-quantity" class="btn">Save New Quantity</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Handle save quantity
            const saveBtn = modal.querySelector('#save-quantity');
            saveBtn.addEventListener('click', async () => {
                const newQuantity = parseInt(modal.querySelector('#update-quantity').value);
                
                try {
                    await db.collection('inventory').doc(itemId).update({
                        quantity: newQuantity
                    });
                    modal.remove();
                    loadInventory();
                } catch (error) {
                    console.error('Error updating inventory quantity:', error);
                    alert('Error updating inventory quantity. Please try again.');
                }
            });
        }
    } catch (error) {
        console.error('Error viewing inventory item:', error);
        alert('Error viewing inventory item. Please try again.');
    }
}


// ====== FORMS FUNCTIONALITY ======
const addFormBtn = document.getElementById('add-form');
const viewFormsBtn = document.getElementById('view-forms');
const formsList = document.getElementById('forms-list');
const addFormForm = document.getElementById('add-form-form');
const formAddForm = document.getElementById('form-add-form');
const cancelFormAddBtn = document.getElementById('cancel-form-add');

// Show/hide form form
addFormBtn.addEventListener('click', () => {
    addFormForm.style.display = 'block';
    formAddForm.reset();
});

cancelFormAddBtn.addEventListener('click', () => {
    addFormForm.style.display = 'none';
});

// Handle form form submission
formAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('form-title').value;
    const url = document.getElementById('form-url').value;
    const description = document.getElementById('form-description').value;
    
    try {
        await db.collection('forms').add({
            title,
            url,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addFormForm.style.display = 'none';
        loadForms();
    } catch (error) {
        console.error('Error adding form:', error);
        alert('Error adding form. Please try again.');
    }
});

// Load forms
async function loadForms() {
    try {
        const snapshot = await db.collection('forms')
            .orderBy('createdAt', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No forms found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const form = doc.data();
                html += `
    <div class="list-item" data-id="${doc.id}">
        <div>
            <h3>${form.title}</h3>
            <div class="list-item-meta">Added by: ${form.createdByName || 'Unknown'}</div>
            <div class="list-item-description">${form.description || ''}</div>
        </div>
        <div class="list-item-actions">
            <a href="${form.url}" target="_blank" class="btn-small">Open Form</a>
        </div>
    </div>
`;
            });
        }
        
        formsList.innerHTML = html;
        
        // Add event listeners to view responses buttons
        const viewResponsesButtons = formsList.querySelectorAll('.view-form-responses');
        viewResponsesButtons.forEach(button => {
            button.addEventListener('click', () => {
                alert('Google Form responses need to be viewed directly in Google Forms. Please open the form and check the responses there.');
            });
        });
    } catch (error) {
        console.error('Error loading forms:', error);
        formsList.innerHTML = '<div class="error-message">Error loading forms. Please try again.</div>';
    }
}

// ====== ROLES FUNCTIONALITY ======
const addRoleBtn = document.getElementById('add-role');
const rolesList = document.getElementById('roles-list');
const addRoleForm = document.getElementById('add-role-form');
const roleForm = document.getElementById('role-form');
const cancelRoleAddBtn = document.getElementById('cancel-role-add');

// Show/hide role form
addRoleBtn.addEventListener('click', () => {
    addRoleForm.style.display = 'block';
    roleForm.reset();
});

cancelRoleAddBtn.addEventListener('click', () => {
    addRoleForm.style.display = 'none';
});

// Handle role form submission
roleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('member-name').value;
    const role = document.getElementById('member-role').value;
    const description = document.getElementById('role-description').value;
    
    try {
        await db.collection('roles').add({
            name,
            role,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        addRoleForm.style.display = 'none';
        loadRoles();
    } catch (error) {
        console.error('Error adding role:', error);
        alert('Error adding role. Please try again.');
    }
});

// Load roles
async function loadRoles() {
    try {
        const snapshot = await db.collection('roles')
            .orderBy('name')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No roles found. Add some using the button above.</div>';
        } else {
            html += '<div class="roles-grid">';
            snapshot.forEach(doc => {
                const role = doc.data();
                html += `
                    <div class="role-card" data-id="${doc.id}">
                        <h3 class="role-name">${role.name}</h3>
                        <div class="role-title">${role.role}</div>
                        ${role.description ? `<div class="role-description">${role.description}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }
        
        rolesList.innerHTML = html;
    } catch (error) {
        console.error('Error loading roles:', error);
        rolesList.innerHTML = '<div class="error-message">Error loading roles. Please try again.</div>';
    }
}

// ====== HALAQAS FUNCTIONALITY ======
const addHalaqaBtn = document.getElementById('add-halaqa');
const viewHalaqasBtn = document.getElementById('view-halaqas');
const halaqasList = document.getElementById('halaqas-list');
const addHalaqaForm = document.getElementById('add-halaqa-form');
const halaqaForm = document.getElementById('halaqa-form');
const cancelHalaqaAddBtn = document.getElementById('cancel-halaqa-add');

// Show/hide halaqa form
addHalaqaBtn.addEventListener('click', () => {
    addHalaqaForm.style.display = 'block';
    halaqaForm.reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('halaqa-date').value = today;
});

cancelHalaqaAddBtn.addEventListener('click', () => {
    addHalaqaForm.style.display = 'none';
});

// Handle halaqa form submission
halaqaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('halaqa-title').value;
    const date = document.getElementById('halaqa-date').value;
    const citation1 = document.getElementById('halaqa-citation1').value;
    const citation2 = document.getElementById('halaqa-citation2').value;
    const citation3 = document.getElementById('halaqa-citation3').value;
    const notes = document.getElementById('halaqa-notes').value;
    
    // Prepare citations array (filter out empty ones)
    const citations = [citation1, citation2, citation3].filter(citation => citation.trim() !== '');
    
    try {
        await db.collection('halaqas').add({
            title,
            date,
            citations,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addHalaqaForm.style.display = 'none';
        loadHalaqas();
    } catch (error) {
        console.error('Error adding halaqa:', error);
        alert('Error adding halaqa. Please try again.');
    }
});

// Load halaqas
async function loadHalaqas() {
    try {
        const snapshot = await db.collection('halaqas')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No halaqas found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const halaqa = doc.data();
                const citationsHtml = halaqa.citations.map(citation => 
                    `<div class="citation-item">${citation}</div>`
                ).join('');
                
                html += `
                    <div class="halaqa-card" data-id="${doc.id}">
                        <div class="halaqa-header">
                            <h3 class="halaqa-title">${halaqa.title}</h3>
                            <div class="halaqa-date">${halaqa.date}</div>
                        </div>
                        <div class="halaqa-citations">
                            ${citationsHtml}
                        </div>
                        ${halaqa.notes ? `
                            <div class="halaqa-notes">
                                <strong>Notes:</strong>
                                <p>${halaqa.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        
        halaqasList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading halaqas:', error);
        halaqasList.innerHTML = '<div class="error-message">Error loading halaqas. Please try again.</div>';
    }
}

viewHalaqasBtn.addEventListener('click', viewHalaqaSchedule);

// Function to format schedule text with bullet points
function formatScheduleText(text) {
    if (!text) return 'No schedule has been added yet.';
    
    // Simple HTML conversion - convert newlines to <br> tags
    // and wrap the whole thing in a div
    let formattedText = '<div>';
    
    // Split text by lines
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '') {
            // Empty line becomes a line break
            formattedText += '<br>';
        } else if (line.startsWith('• ') || line.startsWith('- ')) {
            // Simple bullet point formatting - indent and add some visual cues
            const bulletContent = line.substring(2);
            formattedText += `<div class="bullet-point">• ${bulletContent}</div>`;
        } else {
            // Regular text becomes a paragraph with some styling
            formattedText += `<div class="schedule-heading">${line}</div>`;
        }
    }
    
    formattedText += '</div>';
    return formattedText;
}

// Function to view halaqa schedule
async function viewHalaqaSchedule() {
    try {
        // Try to get the halaqa schedule from Firestore
        const scheduleDoc = await db.collection('settings').doc('halaqaSchedule').get();
        let scheduleText = '';
        
        if (scheduleDoc.exists) {
            scheduleText = scheduleDoc.data().text || '';
        }
        
        // Create modal for viewing/editing halaqa schedule
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Halaqa Schedule</h2>
                <div class="schedule-container">
                    <div id="schedule-display" class="schedule-text">${formatScheduleText(scheduleText)}</div>
                    <div id="schedule-edit" style="display: none;">
                        <div class="form-group">
                            <p class="edit-instructions">Use bullet points by starting lines with "• " (bullet and space) or "- " (dash and space).</p>
                            <textarea id="schedule-textarea" rows="10" class="schedule-textarea" placeholder="Enter the halaqa schedule here...
• Use bullet points like this
• For each scheduled item
- Or use dashes instead
- For organized content">${scheduleText}</textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="edit-schedule" class="btn">Edit Halaqa Schedule</button>
                    <button id="save-schedule" class="btn" style="display: none;">Save Changes</button>
                    <button id="cancel-edit" class="btn-cancel" style="display: none;">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle closing modal
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Handle edit button click
        const editBtn = modal.querySelector('#edit-schedule');
        const saveBtn = modal.querySelector('#save-schedule');
        const cancelBtn = modal.querySelector('#cancel-edit');
        const displayDiv = modal.querySelector('#schedule-display');
        const editDiv = modal.querySelector('#schedule-edit');
        
        editBtn.addEventListener('click', () => {
            displayDiv.style.display = 'none';
            editDiv.style.display = 'block';
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
        });
        
        // Handle cancel button click
        cancelBtn.addEventListener('click', () => {
            displayDiv.style.display = 'block';
            editDiv.style.display = 'none';
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        });
        
        // Handle save button click
        saveBtn.addEventListener('click', async () => {
            const newText = modal.querySelector('#schedule-textarea').value;
            
            try {
                // Save the updated schedule text to Firestore
                await db.collection('settings').doc('halaqaSchedule').set({
                    text: newText,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentUser.uid,
                    updatedByName: currentUser.displayName
                });
                
                // Format and update the display
                displayDiv.innerHTML = formatScheduleText(newText);
                
                // Switch back to display mode
                displayDiv.style.display = 'block';
                editDiv.style.display = 'none';
                editBtn.style.display = 'inline-block';
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
            } catch (error) {
                console.error('Error saving halaqa schedule:', error);
                alert('Error saving halaqa schedule. Please try again.');
            }
        });
    } catch (error) {
        console.error('Error loading halaqa schedule:', error);
        alert('Error loading halaqa schedule. Please try again.');
    }
}

// Initialize the application by loading the content
document.addEventListener('DOMContentLoaded', () => {
    // Set "This Week's Work" as active by default
    const defaultNavLink = document.querySelector('a[data-page="this-week"]');
    if (defaultNavLink) {
        defaultNavLink.classList.add('active');
    }
});
