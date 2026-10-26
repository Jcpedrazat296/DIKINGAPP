window.addEventListener('scroll', function() {
    const header = document.getElementById('main-header');
    if (window.scrollY > 50) {
        header.style.padding = '10px 50px';
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    } else {
        header.style.padding = '20px 50px';
        header.style.boxShadow = 'none';
    }
});