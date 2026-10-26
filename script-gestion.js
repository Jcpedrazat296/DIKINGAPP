
const API_IP = '172.20.10.4'; 
const API_BASE_URL = `http://${API_IP}:3000/api/vehiculos`;

class Vehiculo {
    constructor(placa, cedula, horaEntrada) {
        this.placa = placa.toUpperCase();
        this.cedula = cedula;
        this.horaEntrada = new Date(horaEntrada);
    }
}

class GestorParqueadero {
    constructor(tarifaMinuto = 80) {
        this.tarifaMinuto = tarifaMinuto;
        this.vehiculosActivos = [];
        this.reservasPendientes = []; 
        this.vehiculoEnProceso = null;
        
        // Inicializamos cargando los datos desde la Base de Datos Real MySQL
        this.cargarDesdeServidor();
        
        // Intervalo para actualizar automáticamente la UI cada 5 segundos (Ideal para sincronización con el celular)
        setInterval(() => this.cargarDesdeServidor(), 5000);
    }

    // REEMPLAZA A: cargarDesdeLocal()
    async cargarDesdeServidor() {
        try {
            // Hacemos una petición paralela para traer vehículos y reservas de la DB
            const [resActivos, resReservas] = await Promise.all([
                fetch(API_BASE_URL),
                fetch(`${API_BASE_URL}/reservas`) // Asegúrate de mapear esta ruta si la usas en el backend
            ]);

            if (resActivos.ok) {
                const rawActivos = await resActivos.json();
                this.vehiculosActivos = rawActivos.map(v => new Vehiculo(v.placa, v.cedula, v.hora_entrada));
            }

            // Nota: Si aún no tienes el endpoint de reservas montado en Node, puedes comentar estas 4 líneas 
            // y mantener provisionalmente las reservas por localStorage si es necesario.
            if (resReservas.ok) {
                this.reservasPendientes = await resReservas.json();
            }

            this.actualizarUI();
        } catch (error) {
            console.error("Error sincronizando con el servidor central:", error);
        }
    }

    // REEMPLAZA A: aprobarReserva(placa)
    async aprobarReserva(placa) {
        const reserva = this.reservasPendientes.find(r => r.placa === placa);
        if (!reserva) return;

        try {
            // Enviar el nuevo registro al servidor real
            const respuesta = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    placa: reserva.placa,
                    cedula: reserva.cedula,
                    tipo_usuario: 'Normal'
                })
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                // Si la DB lo acepta, limpiamos localmente la reserva ficticia
                this.reservasPendientes = this.reservasPendientes.filter(r => r.placa !== placa);
                alert(`Reserva de ${placa} aprobada en MySQL. Vehículo ingresado.`);
                this.cargarDesdeServidor();
            } else {
                alert(`Error: ${resultado.error}`);
            }
        } catch (error) {
            alert("Fallo de conexión al aprobar reserva.");
        }
    }

    // REEMPLAZA A: registrarEntrada()
    async registrarEntrada() {
        const p = document.getElementById('reg-placa').value.trim().toUpperCase();
        const c = document.getElementById('reg-cedula').value.trim();

        if (!p || !c) return alert("Faltan datos");

        try {
            const respuesta = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placa: p, cedula: c, tipo_usuario: 'Normal' })
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                alert(`¡Vehículo ${p} registrado con éxito en MySQL!`);
                document.getElementById('reg-placa').value = "";
                document.getElementById('reg-cedula').value = "";
                this.cargarDesdeServidor();
            } else {
                alert(`Error: ${resultado.error}`);
            }
        } catch (error) {
            alert("Error crítico al conectar con el backend.");
        }
    }

    registrarSalida() {
        const pBuscar = document.getElementById('out-placa').value.trim().toUpperCase();
        const encontrado = this.vehiculosActivos.find(v => v.placa === pBuscar);

        if (encontrado) {
            const ahora = new Date();
            // El cálculo matemático se mantiene idéntico, directo en memoria
            const min = Math.max(1, Math.floor((ahora - encontrado.horaEntrada) / 60000));
            const total = min * this.tarifaMinuto;
            
            this.vehiculoEnProceso = { vehiculo: encontrado, min, total, ahora };
            this.mostrarRecibo();
        } else {
            alert("Vehículo no encontrado en el parqueadero activo.");
        }
    }

    mostrarRecibo() {
        const { vehiculo, min, total, ahora } = this.vehiculoEnProceso;
        document.getElementById('detalle-recibo').innerHTML = `
            <h2 style="color:var(--primary)">RECIBO DE PAGO</h2>
            <hr style="margin:15px 0">
            <p><strong>PLACA:</strong> ${vehiculo.placa}</p>
            <p><strong>TIEMPO:</strong> ${min} Minutos</p>
            <p><strong>ENTRADA:</strong> ${vehiculo.horaEntrada.toLocaleTimeString()}</p>
            <p><strong>SALIDA:</strong> ${ahora.toLocaleTimeString()}</p>
            <h1 style="margin:20px 0">$${total.toLocaleString()}</h1>
        `;
        document.getElementById('modal-recibo').style.display = 'flex';
    }

    // REEMPLAZA A: confirmarPago()
    async confirmarPago() {
        const placaAEliminar = this.vehiculoEnProceso.vehiculo.placa;

        try {
            // Enviamos un método DELETE a nuestra API Rest
            const respuesta = await fetch(`${API_BASE_URL}/${placaAEliminar}`, {
                method: 'DELETE'
            });

            if (respuesta.ok) {
                alert("Pago procesado de forma segura en la base de datos.");
                this.cerrarRecibo();
                document.getElementById('out-placa').value = "";
                this.cargarDesdeServidor(); // Recargamos la UI limpia
            } else {
                const err = await respuesta.json();
                alert(`Error al procesar pago: ${err.error}`);
            }
        } catch (error) {
            alert("Error al intentar comunicar la salida al servidor.");
        }
    }

    cerrarRecibo() { document.getElementById('modal-recibo').style.display = 'none'; }

    actualizarUI() {
        // 1. Renderizar Vehículos Activos
        const bodyActivos = document.getElementById('lista-vehiculos-body');
        bodyActivos.innerHTML = "";
        this.vehiculosActivos.forEach((v, idx) => {
            bodyActivos.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${v.placa}</strong></td>
                    <td>${v.cedula}</td>
                    <td>${v.horaEntrada.toLocaleTimeString()}</td>
                    <td><button class="login-btn" onclick="document.getElementById('out-placa').value='${v.placa}'; gestor.registrarSalida()" style="padding:5px 10px; font-size:12px;">Cobrar</button></td>
                </tr>
            `;
        });

        // 2. Renderizar Reservas del Día
        const bodyReservas = document.getElementById('lista-reservas-body');
        if (bodyReservas) {
            bodyReservas.innerHTML = "";
            if (this.reservasPendientes.length === 0) {
                bodyReservas.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999; font-size:12px;">Sin reservas</td></tr>';
            } else {
                this.reservasPendientes.forEach(res => {
                    bodyReservas.innerHTML += `
                        <tr>
                            <td><strong>${res.placa}</strong></td>
                            <td>${res.entrada || 'Pendiente'}</td>
                            <td><button onclick="gestor.aprobarReserva('${res.placa}')" style="background:#28a745; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">INGRESAR</button></td>
                        </tr>
                    `;
                });
            }
        }

        document.getElementById('cupos-info').innerText = `Cupos ocupados: ${this.vehiculosActivos.length}`;
    }
}

// Inicialización del Script de ejecución global
const gestor = new GestorParqueadero(80);
document.getElementById('fecha-actual').innerText = new Date().toLocaleDateString();