/**
 * Checkie Onboarding Flow Handler
 * Handles store creation and onboarding steps
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    updateWelcomeName();
    initWelcomeButton();
    initStoreForm();
  });

  // ============================================
  // Welcome Page
  // ============================================

  function updateWelcomeName() {
    const user = CheckieAPI.getUser();
    if (!user) return;

    // Update name in welcome heading
    const nameElements = document.querySelectorAll('[data-ms-member="first-name"]');
    nameElements.forEach(el => {
      el.textContent = user.firstName || 'there';
    });

    // Update any user ID elements (for Webflow CMS compatibility)
    const uidElements = document.querySelectorAll('[data-ms-member="id"]');
    uidElements.forEach(el => {
      el.textContent = user.id;
    });
  }

  function initWelcomeButton() {
    // Find the "Get started" button and make it work
    const getStartedBtn = document.querySelector('.submit-button');
    if (!getStartedBtn) return;

    // Check if we're on welcome page
    if (!window.location.pathname.includes('welcome')) return;

    getStartedBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = '/pages/onboarding/set-up-store.html';
    });
  }

  // ============================================
  // Store Setup Form
  // ============================================

  function initStoreForm() {
    const form = document.getElementById('wf-form-set-up-your-store');
    if (!form) return;

    // Pre-fill support email with user's email
    const user = CheckieAPI.getUser();
    if (user) {
      const supportEmailInput = form.querySelector('#support-email');
      if (supportEmailInput && !supportEmailInput.value) {
        supportEmailInput.value = user.email;
      }
    }

    // Override the existing submit handler
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      const storeName = form.querySelector('#store-name')?.value;
      const storeFocus = form.querySelector('#store-focus')?.value;
      const currency = form.querySelector('#currency')?.value;
      const supportEmail = form.querySelector('#support-email')?.value;
      const websiteUrl = form.querySelector('#website-url')?.value;

      const submitBtn = form.querySelector('[type="submit"]');
      const errorDiv = form.closest('.w-form')?.querySelector('.w-form-fail');
      const successDiv = form.closest('.w-form')?.querySelector('.w-form-done');

      // Validate required fields
      if (!storeName || !currency || !supportEmail) {
        showError(errorDiv, 'Please fill in all required fields');
        return;
      }

      // Disable button
      const originalText = submitBtn.value;
      submitBtn.value = 'Creating store...';
      submitBtn.disabled = true;
      hideError(errorDiv);

      try {
        // Create store via API
        // Note: currency, supportEmail, focus will be added to Store model later
        const storeData = {
          name: storeName,
          description: `Focus: ${storeFocus || 'General'}. Contact: ${supportEmail}`
        };

        // Only add websiteUrl if it's a valid URL
        if (websiteUrl) {
          // Add protocol if missing
          let url = websiteUrl;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          storeData.websiteUrl = url;
        }

        const store = await CheckieAPI.createStore(storeData);

        console.log('Store created:', store);

        // Store the store ID for later use
        localStorage.setItem('checkie_current_store', store.id);

        // Show success message briefly
        if (successDiv) {
          successDiv.style.display = 'block';
          form.style.display = 'none';
        }

        // Redirect to next step after short delay
        setTimeout(() => {
          window.location.href = '/pages/onboarding/add-your-brand.html';
        }, 1000);

      } catch (error) {
        console.error('Store creation error:', error);
        showError(errorDiv, error.message || 'Failed to create store. Please try again.');
        submitBtn.value = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // ============================================
  // Helpers
  // ============================================

  function showError(errorDiv, message) {
    if (!errorDiv) return;
    errorDiv.style.display = 'block';
    const messageEl = errorDiv.querySelector('div');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  function hideError(errorDiv) {
    if (!errorDiv) return;
    errorDiv.style.display = 'none';
  }

})();
