const datosParqueaderos = {
    "bogota": { direcciones: ["Calle 100 #15-20", "Centro Andino - Local 12", "Calle 26 #68-10"] },
    "medellin": { direcciones: ["El Poblado - Cra 43", "C.C. Santa Fé", "Laureles Circular 4ta"] }
};

let ubicacionGlobal = "";

// 1. Mostrar Direcciones
document.querySelectorAll('.btn-ciudad').forEach(btn => {
    btn.addEventListener('click', () => {
        const ciudad = btn.getAttribute('data-ciudad');
        const infoDiv = document.getElementById('info-ubicaciones');
        infoDiv.style.display = 'block';
        document.getElementById('titulo-ciudad').textContent = `Ubicaciones en ${ciudad.toUpperCase()}`;
        
        const lista = document.getElementById('lista-direcciones');
        lista.innerHTML = '';
        
        datosParqueaderos[ciudad].direcciones.forEach(dir => {
            const li = document.createElement('li');
            li.innerHTML = `📍 ${dir}`;
            li.onclick = () => seleccionarDireccion(dir);
            lista.appendChild(li);
        });
    });
});

// 2. Activar Formulario y "Mover" Interfaz
function seleccionarDireccion(dir) {
    ubicacionGlobal = dir;
    const formPanel = document.getElementById('formulario-panel');
    formPanel.style.display = 'block';
    document.getElementById('ubicacion-seleccionada').textContent = dir;
}

// 3. ENVIAR A GESTIÓN (LocalStorage)
document.getElementById('form-reserva').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nuevaReserva = {
        placa: document.getElementById('placa').value.toUpperCase(),
        cedula: document.getElementById('cedula').value,
        entrada: document.getElementById('h-entrada').value,
        ubicacion: ubicacionGlobal,
        origen: "Reserva Web"
    };

    // Obtener lista actual de gestión
    let vehiculosGestion = JSON.parse(localStorage.getItem('vehiculos_gestion')) || [];

    // Evitar duplicados
    if(vehiculosGestion.some(v => v.placa === nuevaReserva.placa)) {
        alert("Este vehículo ya tiene un ingreso pendiente en gestión.");
        return;
    }

    // Guardar para que Di-King Admin lo vea
    vehiculosGestion.push(nuevaReserva);
    localStorage.setItem('vehiculos_gestion', JSON.stringify(vehiculosGestion));

    alert("¡Reserva confirmada! Los datos han sido enviados al sistema de administración.");
    this.reset();
    document.getElementById('formulario-panel').style.display = 'none';
});