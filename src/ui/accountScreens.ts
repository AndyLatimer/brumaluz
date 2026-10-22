// Pantallas de acceso: iniciar sesión, registrarse y recuperar la contraseña.
import { t } from './i18n';
import { session } from '../game/state';
import type { User } from '@supabase/supabase-js';
import { signUp, signIn, requestPasswordReset, updatePassword, getAccountClient, accountConfigError, onAuthChange, currentSession } from '../services/account';
import { syncBackdropTime, syncAccount } from './characterSelect';
import { $ } from './dom';
import { menuMusic } from '../game/audio';
import { errorMessage } from '../game/server';

export function showAuthScreen(message = '') {
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  menuMusic.sync();
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Un nuevo capítulo');
  $('#auth-intro').textContent = t('Inicia sesión o crea una cuenta para entrar en el mundo de Brumaluz.');
  $('#auth-intro').hidden = false;
  $('.auth-switch').hidden = false;
  authForm.hidden = false;
  $('#recovery-request-form').hidden = true;
  $('#password-update-form').hidden = true;
  if (session.authMode !== 'login') $('[data-auth-mode="login"]').click();
  $('#auth-message').textContent = message;
  $('#auth-message').classList.remove('error');
}
export function showRecoveryRequestScreen() {
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  menuMusic.sync();
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Recuperar contraseña');
  $('#auth-intro').hidden = true;
  $('.auth-switch').hidden = true;
  authForm.hidden = true;
  $('#password-update-form').hidden = true;
  $('#recovery-request-form').hidden = false;
  $<HTMLInputElement>('#recovery-email').value = $<HTMLInputElement>('#auth-email').value.trim();
  $('#recovery-request-message').textContent = '';
  $('#recovery-request-message').classList.remove('error');
  $<HTMLInputElement>('#recovery-email').focus();
}
export function showPasswordUpdateScreen(user: User) {
  session.passwordRecoveryUser = user;
  session.currentUser = user;
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  menuMusic.sync();
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Nueva contraseña');
  $('#auth-intro').hidden = true;
  $('.auth-switch').hidden = true;
  authForm.hidden = true;
  $('#recovery-request-form').hidden = true;
  $('#password-update-form').hidden = false;
  $<HTMLInputElement>('#new-password').value = '';
  $<HTMLInputElement>('#confirm-new-password').value = '';
  $('#password-update-message').textContent = '';
  $('#password-update-message').classList.remove('error');
  $<HTMLInputElement>('#new-password').focus();
}
export const authForm = $<HTMLFormElement>('#auth-form');
export const rememberEmailKey = 'brumaluz-remembered-email';
export const authEmail = $<HTMLInputElement>('#auth-email');
export const rememberEmail = $<HTMLInputElement>('#auth-remember');
export const rememberedEmail = localStorage.getItem(rememberEmailKey);
export function persistRememberedEmail() {
  if (rememberEmail.checked && authEmail.value.trim() && authEmail.validity.valid) {
    localStorage.setItem(rememberEmailKey, authEmail.value.trim());
  } else localStorage.removeItem(rememberEmailKey);
}
export async function initializeAccountAccess() {
  try {
    if (!getAccountClient()) {
      $('#auth-config-error').textContent = `${t(accountConfigError())} ${t('Copia .env.example como .env.local, añade los datos del proyecto y reinicia Vite.')}`;
      $('#auth-config-error').hidden = false;
      $('.auth-switch').hidden = true;
      authForm.hidden = true;
      return;
    }
    onAuthChange((event, _session, user) => {
      if (event === 'PASSWORD_RECOVERY' && user) {
        showPasswordUpdateScreen(user);
        return;
      }
      if (session.passwordRecoveryUser && event !== 'SIGNED_OUT') return;
      void syncAccount(user);
    });
    await syncAccount((await currentSession())?.user ?? null);
  } catch (error) {
    showAuthScreen();
    $('#auth-message').textContent = errorMessage(error);
    $('#auth-message').classList.add('error');
  }
}
/** Formularios de acceso a la cuenta. */
export function installAccountScreens() {
  if (rememberedEmail) {
    authEmail.value = rememberedEmail;
    rememberEmail.checked = true;
  }
  rememberEmail.addEventListener('change', persistRememberedEmail);
  authEmail.addEventListener('input', () => {
    if (session.authMode === 'login') persistRememberedEmail();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    button.onclick = () => {
      session.authMode = button.dataset.authMode === 'register' ? 'register' : 'login';
      document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((option) => {
        const active = option === button;
        option.classList.toggle('active', active);
        option.setAttribute('aria-selected', String(active));
      });
      const confirmField = $<HTMLDivElement>('#confirm-password-field');
      const confirmInput = $<HTMLInputElement>('#auth-confirm-password');
      const usernameField = $<HTMLDivElement>('#username-field');
      const usernameInput = $<HTMLInputElement>('#auth-username');
      confirmField.hidden = session.authMode !== 'register';
      confirmInput.required = session.authMode === 'register';
      usernameField.hidden = session.authMode !== 'register';
      usernameInput.required = session.authMode === 'register';
      $('#forgot-password').hidden = session.authMode !== 'login';
      $('#remember-email-field').hidden = session.authMode !== 'login';
      $<HTMLInputElement>('#auth-password').autocomplete = session.authMode === 'register' ? 'new-password' : 'current-password';
      $('#auth-submit').textContent = session.authMode === 'register' ? t('Crear cuenta') : t('Iniciar sesión');
      $('#auth-message').textContent = '';
      $('#auth-message').classList.remove('error');
    };
  });
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $<HTMLInputElement>('#auth-username').value.trim();
    const email = $<HTMLInputElement>('#auth-email').value.trim();
    const password = $<HTMLInputElement>('#auth-password').value;
    const message = $('#auth-message');
    const submit = $<HTMLButtonElement>('#auth-submit');
    if (session.authMode === 'register' && !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      message.textContent = t('El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo.');
      message.classList.add('error');
      return;
    }
    if (session.authMode === 'register' && password !== $<HTMLInputElement>('#auth-confirm-password').value) {
      message.textContent = t('Las contraseñas no coinciden.');
      message.classList.add('error');
      return;
    }
    submit.disabled = true;
    message.classList.remove('error');
    message.textContent = session.authMode === 'register' ? t('Creando tu cuenta…') : t('Iniciando sesión…');
    try {
      if (session.authMode === 'register') {
        const result = await signUp(username, email, password);
        if (!result.session) {
          $('[data-auth-mode="login"]').click();
          message.textContent = t('Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión.');
        } else {
          await syncAccount(result.user);
        }
      } else {
        persistRememberedEmail();
        const result = await signIn(email, password);
        await syncAccount(result.user);
      }
    } catch (error) {
      message.textContent = errorMessage(error);
      message.classList.add('error');
    } finally {
      submit.disabled = false;
    }
  });
  $('#forgot-password').onclick = showRecoveryRequestScreen;
  $('#recovery-back-to-login').onclick = () => showAuthScreen();
  $('#recovery-request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailInput = $<HTMLInputElement>('#recovery-email');
    const submit = $<HTMLButtonElement>('#recovery-request-submit');
    const message = $('#recovery-request-message');
    submit.disabled = true;
    message.classList.remove('error');
    message.textContent = t('Enviando el enlace…');
    try {
      await requestPasswordReset(emailInput.value.trim(), `${window.location.origin}${window.location.pathname}`);
      message.textContent = t('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de spam.');
    } catch (error) {
      message.textContent = errorMessage(error);
      message.classList.add('error');
    } finally {
      submit.disabled = false;
    }
  });
  $<HTMLFormElement>('#password-update-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $<HTMLInputElement>('#new-password').value;
    const confirmPassword = $<HTMLInputElement>('#confirm-new-password').value;
    const submit = $<HTMLButtonElement>('#password-update-submit');
    const message = $('#password-update-message');
    if (password !== confirmPassword) {
      message.textContent = t('Las contraseñas no coinciden.');
      message.classList.add('error');
      return;
    }
    if (!session.passwordRecoveryUser) {
      message.textContent = t('El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.');
      message.classList.add('error');
      return;
    }
    submit.disabled = true;
    message.classList.remove('error');
    message.textContent = t('Actualizando la contraseña…');
    try {
      await updatePassword(password);
      const user = session.passwordRecoveryUser;
      session.passwordRecoveryUser = null;
      await syncAccount(user);
      $('#character-message').textContent = t('Contraseña actualizada correctamente.');
    } catch (error) {
      message.textContent = errorMessage(error);
      message.classList.add('error');
    } finally {
      submit.disabled = false;
    }
  });
}
