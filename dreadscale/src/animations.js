export function initializeAnimations() {
  // Intersection Observer for scroll animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
      }
    });
  }, observerOptions);

  // Observe all elements that should animate on scroll
  const animateElements = document.querySelectorAll('.service-card, .portfolio-item, .about-text, .about-image, .contact-info, .contact-form');
  
  animateElements.forEach(el => {
    el.classList.add('animate-on-scroll');
    observer.observe(el);
  });

  // Add stagger animation to service cards
  const serviceCards = document.querySelectorAll('.service-card');
  serviceCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });

  // Add stagger animation to portfolio items
  const portfolioItems = document.querySelectorAll('.portfolio-item');
  portfolioItems.forEach((item, index) => {
    item.style.animationDelay = `${index * 0.1}s`;
  });

  // Add hover effects to buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
    });
  });

  // Counter animation for stats
  const stats = document.querySelectorAll('.stat h4');
  const animateCounter = (element, target) => {
    let current = 0;
    const increment = target / 100;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current) + '+';
    }, 20);
  };

  // Observe stats for counter animation
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.textContent);
        animateCounter(entry.target, target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(stat => {
    statsObserver.observe(stat);
  });
}