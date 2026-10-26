// Reemplaza la lógica de tu script-login.js con esta:
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('username').value; // Usamos el campo username para el email
    const pass = document.getElementById('password').value;
    const errorBox = document.getElementById('error-message');

    // 1. Cargar "Base de Datos"
    let usuarios = JSON.parse(localStorage.getItem('usuarios_db')) || [];
    
    // 2. Buscar usuario
    const usuarioValido = usuarios.find(u => u.email === email && u.pass === pass);

    if (usuarioValido) {
        // Guardamos quién inició sesión para la reserva
        localStorage.setItem('usuario_logeado', JSON.stringify(usuarioValido));
        window.location.href = "reservas.html"; 
    } else if (email === "Admin" && pass === "Admin1234") {
        // Mantener el acceso de admin que tenías
        localStorage.setItem('usuario_logeado', JSON.stringify({name: "Administrador"}));
        window.location.href = "reservas.html";
    } else {
        errorBox.textContent = "Credenciales incorrectas. ¿Ya te registraste?";
        errorBox.style.display = "block";
    }
});