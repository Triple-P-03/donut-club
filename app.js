const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

document.querySelectorAll('.flavor-dot').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.flavor-dot').forEach((dot) => {
      const active = dot === button;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-pressed', String(active));
    });
    window.dispatchEvent(new CustomEvent('flavorchange', { detail: { color: button.dataset.color } }));
  });
});

document.querySelectorAll('.card-action').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.flavor} added to your happy list ✳`));
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.classList.add('is-visible');
  });
});
