let vehiculoEncontradoGlobal = null;
let indiceGlobal = -1;

function procesarLiquidacion() {
    const placa = document.getElementById('pago-placa').value.trim().toUpperCase();
    const cedula = document.getElementById('pago-cedula').value.trim();
    const esVIP = document.querySelector('input[name="tipo-user"]:checked').value === 'vip';
    
    // 1. Obtener los vehículos que están en el parqueadero (Base de datos de gestión)
    const vehiculosInternos = JSON.parse(localStorage.getItem("db_di_king")) || [];
    
    // 2. Buscar por placa y cédula
    indiceGlobal = vehiculosInternos.findIndex(v => v.placa === placa && v.cedula === cedula);

    if (indiceGlobal !== -1) {
        const v = vehiculosInternos[indiceGlobal];
        const horaEntrada = new Date(v.horaEntrada);
        const ahora = new Date();
        
        // Calcular minutos (mínimo 1)
        const minutos = Math.max(1, Math.floor((ahora - horaEntrada) / 60000));
        let subtotal = minutos * 80; // Tarifa de 80 por minuto
        let descuento = esVIP ? (subtotal * 0.10) : 0;
        let total = subtotal - descuento;

        vehiculoEncontradoGlobal = { ...v, total };

        // Mostrar resumen
        document.getElementById('form-pago').style.display = 'none';
        document.getElementById('resumen-pago').style.display = 'block';
        document.getElementById('detalle-liquidacion').innerHTML = `
            <p>Tiempo de estancia: <strong>${minutos} min</strong></p>
            <p>Subtotal: <strong>$${subtotal}</strong></p>
            ${esVIP ? `<p style="color:#28a745;">Descuento VIP (10%): <strong>-$${descuento}</strong></p>` : ''}
            <h2 style="color:#5d2a7a;">Total a Pagar: $${total}</h2>
        `;
    } else {
        alert("Error: No se encontró un vehículo con esa placa y cédula en nuestras instalaciones.");
    }
}

function finalizarTransaccion() {
    // 1. Eliminar de la base de datos de gestión (ya pagó)
    let vehiculosInternos = JSON.parse(localStorage.getItem("db_di_king")) || [];
    vehiculosInternos.splice(indiceGlobal, 1);
    localStorage.setItem("db_di_king", JSON.stringify(vehiculosInternos));

    // 2. Mostrar mensaje de agradecimiento
    document.getElementById('resumen-pago').style.display = 'none';
    document.getElementById('mensaje-gracias').style.display = 'block';
}