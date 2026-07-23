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
const submitButton = document.getElementById('submitButton') || form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const formData = new FormData(form);
  const email = formData.get('email').trim();
  const name = formData.get('name').trim();
  const companyWebsite = formData.get('companyWebsite'); // Honeypot

  if (!email) {
    formMessage.textContent = 'Please enter a valid email address.';
    return;
  }

  // Gather URL tracking parameters
  const urlParams = new URLSearchParams(window.location.search);
  
  const payload = {
    email,
    name,
    companyWebsite,
    utm_source: urlParams.get('utm_source') || '',
    utm_medium: urlParams.get('utm_medium') || '',
    utm_campaign: urlParams.get('utm_campaign') || '',
    referrer: document.referrer || '',
    page_url: window.location.href
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Joining...';
  formMessage.textContent = '';

  try {
    const response = await fetch('/api/early-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ok) {
      if (data.status === 'existing') {
        formMessage.textContent = 'You’re already on the PANOOJA early-access list.';
      } else {
        formMessage.textContent = 'You’re on the list. We’ll let you know when PANOOJA launches.';
        form.reset();
      }
    } else {
      if (data.status === 'invalid') {
        formMessage.textContent = 'Please enter a valid email address.';
      } else {
        formMessage.textContent = 'We couldn’t save your details right now. Please try again.';
      }
    }
  } catch (error) {
    console.error('Submission error:', error);
    formMessage.textContent = 'We couldn’t save your details right now. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Join the Early Access List';
  }
});
