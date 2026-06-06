let selectedPlan = null;
let pollingInterval = null;

// Load plans
async function loadPlans() {
  try {
    const res = await fetch('/api/plans');
    const data = await res.json();
    
    const container = document.getElementById('plans-container');
    container.innerHTML = '';
    
    data.plans.forEach(plan => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML = `
        <div class="plan-card-header">
          <div>
            <span class="plan-name">${plan.name}</span>
            <span class="plan-desc">${plan.description || ''}</span>
          </div>
          <div class="plan-price-box">
            <div class="plan-price">${plan.price_ksh.toLocaleString()}.00</div>
            <span class="plan-currency">KES</span>
            <span class="plan-duration-badge">${plan.duration_minutes} min</span>
          </div>
        </div>
        <div class="plan-features">
          <span class="feature-tag"><i class="fas fa-bolt"></i> ${plan.speed_limit}</span>
          <span class="feature-tag"><i class="fas fa-clock"></i> ${plan.duration_minutes} minutes</span>
          <span class="feature-tag"><i class="fas fa-wifi"></i> Unlimited</span>
        </div>
      `;
      card.onclick = () => selectPlan(plan, card);
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load plans:', err);
    document.getElementById('plans-container').innerHTML = 
      '<p style="color:white;text-align:center;grid-column:1/-1;">Failed to load plans. Please refresh.</p>';
  }
}

function selectPlan(plan, element) {
  // Remove selection from all cards
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  
  // Add selection to clicked card
  element.classList.add('selected');
  selectedPlan = plan;
  
  // Update payment modal
  document.getElementById('selected-summary').innerHTML = `
    <span class="plan-info">${plan.name} (${plan.duration_minutes} min)</span>
    <span class="plan-amount">KES ${plan.price_ksh.toLocaleString()}.00</span>
  `;
  
  // Show payment modal popup
  document.getElementById('payment-modal').classList.add('active');
  
  // Focus phone input
  setTimeout(() => document.getElementById('phone').focus(), 400);
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
  document.getElementById('phone').value = '';
}

// Phone input formatting
document.getElementById('phone').addEventListener('input', function(e) {
  this.value = this.value.replace(/[^0-9]/g, '').substring(0, 9);
});

// Allow Enter key to submit
document.getElementById('phone').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    initiatePayment();
  }
});

async function initiatePayment() {
  const phone = document.getElementById('phone').value;
  
  if (!selectedPlan) {
    alert('Please select a WiFi plan first');
    return;
  }
  
  if (!phone || phone.length < 9) {
    alert('Please enter a valid phone number (7XX XXX XXX)');
    document.getElementById('phone').focus();
    return;
  }

  const fullPhone = '254' + phone;
  
  try {
    // Close payment modal, show processing
    document.getElementById('payment-modal').classList.remove('active');
    showModal('processing');
    document.getElementById('processing-timer').textContent = 'Sending STK Push...';
    
    const res = await fetch('/api/payments/mpesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone, planId: selectedPlan.id })
    });
    
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('processing-timer').textContent = 'Check your phone for M-Pesa prompt';
      pollPaymentStatus(data.reference);
    } else {
      showError('Payment Failed', data.error || 'Could not initiate M-Pesa payment');
    }
  } catch (err) {
    showError('Connection Error', 'Could not connect to payment service. Check your internet.');
  }
}

function pollPaymentStatus(reference) {
  let attempts = 0;
  const maxAttempts = 30;
  
  pollingInterval = setInterval(async () => {
    attempts++;
    
    try {
      const res = await fetch('/api/payments/status/' + reference);
      const data = await res.json();
      
      if (data.status === 'completed') {
        clearInterval(pollingInterval);
        showSuccess(data.credentials);
      } else if (attempts >= maxAttempts) {
        clearInterval(pollingInterval);
        showError('Payment Timeout', 'Payment confirmation took too long. Please try again.');
      }
      
      const remaining = (maxAttempts - attempts) * 2;
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      document.getElementById('processing-timer').textContent = 
        `Waiting... ${mins}:${secs.toString().padStart(2, '0')}`;
        
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 2000);
}

function showSuccess(credentials) {
  showModal('success');
  
  document.getElementById('cred-username').textContent = credentials.username;
  document.getElementById('cred-password').textContent = credentials.password;
  document.getElementById('cred-plan').textContent = credentials.plan;
  
  const expiry = new Date(credentials.expires);
  
  const timerInterval = setInterval(() => {
    const now = new Date();
    const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
    
    if (remaining <= 0) {
      document.getElementById('timer').textContent = 'EXPIRED';
      clearInterval(timerInterval);
      return;
    }
    
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    document.getElementById('timer').textContent = 
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function showError(title, message) {
  showModal('error');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = message;
}

function showModal(name) {
  // Hide all modals
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  
  // Show selected modal
  if (name !== 'selection') {
    document.getElementById(name + '-modal').classList.add('active');
  }
  
  // Clear polling if not processing
  if (pollingInterval && name !== 'processing') {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function cancelPayment() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  showModal('selection');
}

function goBack() {
  showModal('selection');
  document.getElementById('phone').value = '';
}

// Close modals on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
});

// Close modal when clicking overlay background
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('active');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }
  });
});

// Initialize
loadPlans();
