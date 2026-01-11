/**
 * Checkie Auth Forms Handler
 * Integrates login/register forms with the API
 */

(function() {
  'use strict';

  // Wait for DOM
  document.addEventListener('DOMContentLoaded', function() {
    initLoginForm();
    initRegisterForm();
    initLogoutButtons();
    checkAuthState();
  });

  // ============================================
  // Login Form
  // ============================================

  function initLoginForm() {
    const form = document.getElementById('wf-form-login');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      const email = form.querySelector('[name="email"]')?.value;
      const password = form.querySelector('[name="Password"]')?.value;
      const submitBtn = form.querySelector('[type="submit"]');
      const errorDiv = form.closest('.w-form')?.querySelector('.w-form-fail');

      if (!email || !password) {
        showError(errorDiv, 'Please fill in all fields');
        return;
      }

      // Disable button
      const originalText = submitBtn.value;
      submitBtn.value = 'Logging in...';
      submitBtn.disabled = true;
      hideError(errorDiv);

      try {
        await CheckieAPI.login(email, password);

        // Redirect to dashboard
        window.location.href = '/pages/dashboard/home.html';
      } catch (error) {
        console.error('Login error:', error);
        showError(errorDiv, error.message || 'Invalid email or password');
        submitBtn.value = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // ============================================
  // Register Form
  // ============================================

  function initRegisterForm() {
    const form = document.getElementById('wf-form-sign-up');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Get name field (single field in Webflow form)
      const nameValue = form.querySelector('[name="name"]')?.value || '';
      const nameParts = nameValue.trim().split(' ');
      const firstName = nameParts[0] || '';
      // If no last name provided, use a dash as placeholder (API requires at least 1 char)
      const lastName = nameParts.slice(1).join(' ') || '-';

      const email = form.querySelector('[name="email"]')?.value;
      const password = form.querySelector('[name="Password"]')?.value;
      const submitBtn = form.querySelector('[type="submit"]');
      const errorDiv = form.closest('.w-form')?.querySelector('.w-form-fail');

      if (!firstName || !email || !password) {
        showError(errorDiv, 'Please fill in all fields');
        return;
      }

      // Validate password
      if (password.length < 8) {
        showError(errorDiv, 'Password must be at least 8 characters');
        return;
      }

      // Disable button
      const originalText = submitBtn.value;
      submitBtn.value = 'Creating account...';
      submitBtn.disabled = true;
      hideError(errorDiv);

      try {
        await CheckieAPI.register(email, password, firstName, lastName);

        // Redirect to onboarding
        window.location.href = '/pages/onboarding/welcome-page.html';
      } catch (error) {
        console.error('Register error:', error);
        showError(errorDiv, error.message || 'Registration failed. Please try again.');
        submitBtn.value = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // ============================================
  // Logout
  // ============================================

  function initLogoutButtons() {
    // Find all logout links/buttons
    const logoutElements = document.querySelectorAll('[data-action="logout"], .logout-btn, [href*="logout"]');

    logoutElements.forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        CheckieAPI.logout();
      });
    });
  }

  // ============================================
  // Auth State Check
  // ============================================

  function checkAuthState() {
    const isAuthenticated = CheckieAPI.isAuthenticated();
    const currentPath = window.location.pathname;

    // Public pages that don't require auth
    const publicPages = ['/login', '/sign-up', '/reset-password', '/create-new-password', '/pricing', '/privacy', '/legal-security', '/ways-to-pay', '/'];
    const isPublicPage = publicPages.some(page => currentPath === page || currentPath.startsWith('/pages/public/'));

    // Dashboard pages that require auth
    const isDashboardPage = currentPath.startsWith('/dashboard') || currentPath.startsWith('/pages/dashboard/');
    const isOnboardingPage = currentPath.startsWith('/onboarding') || currentPath.startsWith('/pages/onboarding/');

    if (!isAuthenticated && (isDashboardPage || isOnboardingPage)) {
      // Not logged in, trying to access protected page
      window.location.href = '/pages/public/login.html';
      return;
    }

    if (isAuthenticated && (currentPath === '/login' || currentPath === '/sign-up' || currentPath.includes('login.html') || currentPath.includes('sign-up.html'))) {
      // Already logged in, redirect to dashboard
      window.location.href = '/pages/dashboard/home.html';
      return;
    }

    // Update UI with user info if authenticated
    if (isAuthenticated) {
      updateUserUI();
    }
  }

  function updateUserUI() {
    const user = CheckieAPI.getUser();
    if (!user) return;

    // Update user name displays
    const nameElements = document.querySelectorAll('[data-user="name"], .user-name');
    nameElements.forEach(el => {
      el.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    });

    // Update user email displays
    const emailElements = document.querySelectorAll('[data-user="email"], .user-email');
    emailElements.forEach(el => {
      el.textContent = user.email;
    });

    // Update avatar initials
    const avatarElements = document.querySelectorAll('[data-user="avatar"], .user-avatar-initials');
    avatarElements.forEach(el => {
      const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.email[0].toUpperCase();
      el.textContent = initials;
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
