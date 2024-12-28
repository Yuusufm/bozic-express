document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu functionality
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // Contact form functionality
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Form submitted - Frontend');
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                company: document.getElementById('company').value,
                phone: document.getElementById('phone').value,
                message: document.getElementById('message').value
            };

            console.log('Form data:', formData);

            try {
                const response = await fetch('/submit-contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    alert('Message sent successfully!');
                    this.reset();
                } else {
                    alert('Failed to send message. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
});

// Fade in animations on scroll
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(element => {
    observer.observe(element);
});

const mobileNavToggle = document.querySelector('.mobile-nav-toggle');

if (mobileNavToggle) {
    mobileNavToggle.addEventListener('click', () => {
        const navLinks = document.querySelector('.nav-links');
        navLinks.classList.toggle('show');
    });
}


document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-links') && !e.target.closest('.mobile-nav-toggle')) {
        navLinks.classList.remove('show');
    }
});

// Phone call handling
document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', function(e) {
        // Check if device supports phone calls
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isMac = /Mac/i.test(navigator.userAgent);
        
        // Allow direct calls on mobile devices and Mac (for FaceTime)
        if (!isMobile && !isMac) {
            e.preventDefault();
            const phoneNumber = this.getAttribute('href').replace('tel:', '');
            
            // Create a modal or notification
            const notification = document.createElement('div');
            notification.className = 'phone-notification';
            notification.innerHTML = `
                <div class="phone-notification-content">
                    <i class="fas fa-phone"></i>
                    <p>Phone number: <strong>${phoneNumber.replace('+1', '')}</strong></p>
                    <p>Call from your phone or use a service like Skype</p>
                    <button onclick="this.parentElement.parentElement.remove()">Close</button>
                </div>
            `;
            document.body.appendChild(notification);
        }
    });
});

// Add client-side form validation
function validateForm(formData) {
    const email = formData.get('email');
    const phone = formData.get('phone');
    
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('Please enter a valid email address');
        return false;
    }
    
    if (!phone.match(/^\d{10}$/)) {
        alert('Please enter a valid phone number');
        return false;
    }
    
    return true;
}