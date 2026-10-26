const datosParqueaderos = {
    "bogota": {
        direcciones: ["Calle 100 #15-20", "Centro Andino - Local 12", "Calle 26 #68-10"],
        mapaUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127263.60411831882!2d-74.15317765!3d4.6097102!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f9bfd2da6cb29%3A0x239d63552075674!2zQm9nb3TDoA!5e0!3m2!1ses!2sco!4v1714100000000"
    },
    "medellin": {
        direcciones: ["El Poblado - Cra 43", "C.C. Santa Fé", "Laureles Circular 4ta"],
        mapaUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15863.3948740156!2d-75.589665!3d6.244203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e4428dfc80fad05%3A0x42137cfcc6b51b56!2sMedellin%2C%20Antioquia!5e0!3m2!1ses!2sco!4v1714100000000"
    }
};

function buscarCiudad() {
    const input = document.getElementById('city-search').value.toLowerCase().trim();
    const lista = document.getElementById('lista-direcciones');
    const iframe = document.querySelector('iframe');

    if (datosParqueaderos[input]) {
        // Actualizar direcciones
        lista.innerHTML = `<h3>Resultados para ${input.toUpperCase()}:</h3>`;
        datosParqueaderos[input].direcciones.forEach(dir => {
            lista.innerHTML += `<div class="address-item">📍 ${dir}</div>`;
        });
        // Actualizar Mapa
        iframe.src = datosParqueaderos[input].mapaUrl;
    } else {
        lista.innerHTML = `<p style="color:red;">No encontramos parqueaderos en esa ciudad. Prueba con "Bogotá" o "Medellín".</p>`;
    }
}

// Permitir buscar al presionar "Enter"
document.getElementById('city-search').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') buscarCiudad();
});