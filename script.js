const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelectorAll('.nav-links a');
const header = document.querySelector('.site-header');

// Mobile menu toggle
menuToggle.addEventListener('click', () => {
  const isOpen = document.body.classList.toggle('menu-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

// Sticky header scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Reveal animations on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

// Update footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Waitlist form handling
const form = document.getElementById('waitlistForm');
const formMessage = document.getElementById('formMessage');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  
  const email = new FormData(form).get('email').trim();

  if (!email) {
    formMessage.textContent = 'Please enter a valid email address.';
    return;
  }

  // Demo behavior - remove this and use a real backend for production
  // Example for Formspree:
  // fetch('https://formspree.io/f/YOUR_FORM_ID', {
  //   method: 'POST',
  //   body: new FormData(form),
  //   headers: { 'Accept': 'application/json' }
  // }).then(...)
  
  // Simulated success message for now
  formMessage.textContent = 'Thank you! You are on the early access list.';
  form.reset();
});
