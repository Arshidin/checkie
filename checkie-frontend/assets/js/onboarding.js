/**
 * Checkie Onboarding Flow Handler
 * Handles store creation and onboarding steps
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    updateWelcomeName();
    initStoreForm();
    initBrandingPage();
    initInviteTeamPage();
  });

  // ============================================
  // Welcome Page (Final Step)
  // ============================================

  function updateWelcomeName() {
    const user = CheckieAPI.getUser();
    if (!user) return;

    // Update name in welcome heading
    const nameElements = document.querySelectorAll('[data-user="first-name"]');
    nameElements.forEach(el => {
      el.textContent = user.firstName || 'there';
    });

    // Update any user ID elements (for Webflow CMS compatibility)
    const uidElements = document.querySelectorAll('[data-user="id"]');
    uidElements.forEach(el => {
      el.textContent = user.id;
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
  // Branding Page
  // ============================================

  function initBrandingPage() {
    // Check if we're on branding page
    if (!window.location.pathname.includes('add-your-brand')) return;

    const form = document.getElementById('wf-form-branding');
    if (!form) return;

    // Remove required from file input (make logo optional)
    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.removeAttribute('required');
    }

    // Enable submit button by default (since logo is now optional)
    const submitBtn = form.querySelector('.submit-button');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('disable');
    }

    // Add Skip button after submit button
    const skipBtn = document.createElement('a');
    skipBtn.href = '#';
    skipBtn.className = 'text-link-button';
    skipBtn.style.cssText = 'display: block; text-align: center; margin-top: 16px; color: #666; text-decoration: underline; cursor: pointer;';
    skipBtn.textContent = 'Skip for now';
    skipBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Go to next step (invite team or dashboard)
      window.location.href = '/pages/onboarding/invite-team-member.html';
    });

    // Insert skip button after submit
    if (submitBtn && submitBtn.parentNode) {
      submitBtn.parentNode.insertBefore(skipBtn, submitBtn.nextSibling);
    }

    // Handle form submit - just go to next step for now
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      // For now just redirect to next step
      // TODO: Implement actual branding update with file upload
      window.location.href = '/pages/onboarding/invite-team-member.html';
    });
  }

  // ============================================
  // Invite Team Page
  // ============================================

  function initInviteTeamPage() {
    // Check if we're on invite team page
    if (!window.location.pathname.includes('invite-team-member')) return;

    const form = document.getElementById('wf-form-invite-team');
    const skipBtn = document.querySelector('.text-link-button, [data-action="skip"]');
    const submitBtn = document.querySelector('.submit-button');

    // Handle skip button - go to welcome page (final step)
    if (skipBtn) {
      skipBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/pages/onboarding/welcome-page.html';
      });
    }

    // Handle form submit
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        // TODO: Implement team invite API call
        // For now, just go to welcome page
        window.location.href = '/pages/onboarding/welcome-page.html';
      });
    }

    // If there's a submit button without form, handle click
    if (submitBtn && !form) {
      submitBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/pages/onboarding/welcome-page.html';
      });
    }
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
