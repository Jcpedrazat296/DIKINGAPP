const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const QRCode = require('qrcode'); // Módulo para generación de QR

const app = express();
const PORT = 3000;

// Middlewares obligatorios
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 1. CONFIGURACIÓN DE LA BASE DE DATOS (MySQL)
// ==========================================
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'diking-db',
    user: 'root',       // Tu usuario de MySQL
    password: '12345',  // Tu contraseña de MySQL
    database: 'diking_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('¡Conectado exitosamente a la base de datos diking_db!');
});

// ========================================================
// 2. PATRONES DE DISEÑO (FACTORY METHOD Y ABSTRACT FACTORY)
// ========================================================

// --- PATRÓN 1: FACTORY METHOD ---
class RegistroVehiculo {
    constructor(placa, cedula) {
        this.placa = placa.toUpperCase();
        this.cedula = cedula;
    }
    procesar(database, response) { throw new Error("Método abstracto 'procesar()' debe ser implementado."); }
}

class RegistroFisico extends RegistroVehiculo {
    procesar(database, response) {
        const sql = 'INSERT INTO vehiculos_activos (placa, cedula, tipo_usuario) VALUES (?, ?, "Normal")';
        database.query(sql, [this.placa, this.cedula], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return response.status(400).json({ error: `La placa ${this.placa} ya figura dentro del parqueadero.` });
                return response.status(500).json({ error: err.message });
            }
            response.status(201).json({ message: 'Vehículo registrado físicamente en celdas con Factory Method.', id: result.insertId });
        });
    }
}

class RegistroReserva extends RegistroVehiculo {
    procesar(database, response) {
        const sqlIngreso = 'INSERT INTO vehiculos_activos (placa, cedula, tipo_usuario) VALUES (?, ?, "Reserva Web")';
        database.query(sqlIngreso, [this.placa, this.cedula], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return response.status(400).json({ error: `La placa ${this.placa} ya cuenta con un registro activo.` });
                return response.status(500).json({ error: err.message });
            }
            
            const sqlBorrarReserva = 'DELETE FROM reservas_pendientes WHERE placa = ?';
            database.query(sqlBorrarReserva, [this.placa], (errDelete) => {
                if (errDelete) console.error("Error limpiando cola de reserva:", errDelete);
                response.status(201).json({ message: 'Reserva validada e ingresada a celdas con Factory Method.', id: result.insertId });
            });
        });
    }
}

class FabricaDeMovimientos {
    static crearRegistro(tipoUsuario, placa, cedula) {
        if (tipoUsuario === 'Reserva Web') {
            return new RegistroReserva(placa, cedula);
        }
        return new RegistroFisico(placa, cedula);
    }
}

// --- PATRÓN 2: ABSTRACT FACTORY ---
class ComponenteTarifa { calcular(minutos) { throw new Error("Método 'calcular()' abstracto."); } }

class TarifaVIP extends ComponenteTarifa {
    calcular(minutos) {
        let base = minutos * 100;
        return base - (base * 0.10);
    }
}

class TarifaNormal extends ComponenteTarifa {
    calcular(minutos) {
        return minutos * 100;
    }
}

class EcosistemaRolesFactory {
    obtenerCalculador() { throw new Error("Método abstracto."); }
}

class FabricaClienteVIP extends EcosistemaRolesFactory {
    obtenerCalculador() { return new TarifaVIP(); }
}

class FabricaPublica extends EcosistemaRolesFactory {
    obtenerCalculador() { return new TarifaNormal(); }
}

// ==========================================
// 3. CONFIGURACIÓN DEL SERVIDOR DE CORREOS
// ==========================================
const transportadorEmail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'juanpedraza@zonak.com.co', 
        pass: 'tnvh nrjl ntfn abfz'        
    }
});

function enviarAlertaEmail(destino, asunto, mensajeHTML) {
    const opciones = {
        from: '"DI-KING Parqueaderos"',
        to: destino,
        subject: asunto,
        html: mensajeHTML
    };

    transportadorEmail.sendMail(opciones, (err, info) => {
        if (err) console.error('Error enviando email a:', destino, err);
        else console.log('Email enviado con éxito a:', destino);
    });
}

// ==========================================
// 4. MÓDULO DE USUARIOS
// ==========================================

app.post('/api/usuarios/registro', async (req, res) => {
    const { nombre, correo, contrasena, tipo } = req.body;
    if (!nombre || !correo || !contrasena) return res.status(400).json({ error: 'Faltan datos obligatorios.' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashContrasena = await bcrypt.hash(contrasena, salt);
        const rolAsignado = tipo === 'Admin' ? 'Admin' : 'Cliente';
        const tokenConfirmacion = crypto.randomBytes(20).toString('hex');

        const sql = 'INSERT INTO usuarios (nombre, correo, contrasena, tipo_usuario, verificado, token_confirmacion) VALUES (?, ?, ?, ?, 0, ?)';
        
        db.query(sql, [nombre, correo, hashContrasena, rolAsignado, tokenConfirmacion], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado.' });
                return res.status(500).json({ error: err.message });
            }

            const enlaceConfirmacion = `http://172.20.10.4:3000/api/usuarios/confirmar/${tokenConfirmacion}`;

            const asuntoEmail = 'Activa tu cuenta en DI-KING Parqueaderos 🔑';
            const mensajeHTML = `
                <div style="font-family: 'Open Sans', sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px; border-radius: 8px; margin: 0 auto;">
                    <h2 style="color: #5d2a7a; text-align: center;">¡Hola, ${nombre}!</h2>
                    <p>Gracias por registrarte en <strong>DI-KING</strong>. Por favor confirma tu correo haciendo clic en el siguiente botón:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${enlaceConfirmacion}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Confirmar mi Cuenta</a>
                    </div>
                </div>
            `;
            
            enviarAlertaEmail(correo, asuntoEmail, mensajeHTML);
            res.status(201).json({ message: 'Usuario pre-registrado. Por favor verifica tu correo electrónico para activar la cuenta.' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno al procesar el registro.' });
    }
});

app.get('/api/usuarios/confirmar/:token', (req, res) => {
    const { token } = req.params;

    const sqlBuscar = 'SELECT * FROM usuarios WHERE token_confirmacion = ?';
    db.query(sqlBuscar, [token], (err, results) => {
        if (err) return res.status(500).send("Error interno en el servidor.");
        if (!results || results.length === 0) return res.status(400).send("<h3 style='font-family: sans-serif; text-align: center; margin-top: 50px;'>El enlace de confirmación es inválido o ya ha expirado.</h3>");

        const usuario = results[0];

        const sqlActivar = 'UPDATE usuarios SET verificado = 1, token_confirmacion = NULL WHERE id = ?';
        db.query(sqlActivar, [usuario.id], (errUpdate) => {
            if (errUpdate) return res.status(500).send("Error al activar la cuenta en el sistema.");
            
            res.send(`
                <div style="text-align: center; font-family: 'Open Sans', sans-serif; margin-top: 50px; padding: 20px;">
                    <h1 style="color: #28a745; font-size: 36px; margin-bottom: 10px;">✔ ¡Cuenta Activada Exitosamente!</h1>
                    <p style="font-size: 16px; color: #333;">Hola <strong>${usuario.nombre}</strong>, tu correo electrónico ha sido verificado con éxito.</p>
                    <br><br>
                    <a href="http://172.20.10.4:3000/login.html" style="background-color: #5d2a7a; color: white; padding: 12px 25px; font-weight: bold; text-decoration: none; border-radius: 5px;">Ir al Login de Di-King →</a>
                </div>
            `);
        });
    });
});

app.post('/api/usuarios/login', (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) return res.status(400).json({ error: 'Faltan campos obligatorios.' });

    const sql = 'SELECT * FROM usuarios WHERE correo = ?';
    db.query(sql, [correo], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'El correo electrónico o la contraseña son incorrectos.' });

        const usuario = results[0];

        if (contrasena === "") {
            if (usuario.verificado === 0) {
                return res.status(403).json({ error: 'La cuenta asociada a este correo existe pero no ha sido verificada aún.' });
            }
            return res.json({ message: 'Usuario validado en el sistema.', usuario: { tipo: usuario.tipo_usuario } });
        }

        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!contrasenaValida) return res.status(401).json({ error: 'El correo electrónico o la contraseña son incorrectos.' });

        if (usuario.verificado === 0) {
            return res.status(403).json({ error: 'Tu cuenta aún no ha sido activada. Por favor, revisa tu bandeja de entrada y confirma tu correo electrónico.' });
        }

        res.json({
            message: 'Login exitoso',
            usuario: { nombre: usuario.nombre, correo: usuario.correo, tipo: usuario.tipo_usuario }
        });
    });
});

// ==========================================
// 5. MÓDULO DE VEHÍCULOS
// ==========================================

app.get('/api/vehiculos', (req, res) => {
    const sql = 'SELECT * FROM vehiculos_activos ORDER BY hora_entrada DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/vehiculos', (req, res) => {
    const { placa, cedula, tipo_usuario } = req.body; 
    if (!placa || !cedula) return res.status(400).json({ error: 'Faltan datos de ingreso del vehículo.' });

    const movimiento = FabricaDeMovimientos.crearRegistro(tipo_usuario, placa, cedula);
    movimiento.procesar(db, res);
});

app.delete('/api/vehiculos/:placa', (req, res) => {
    const { placa } = req.params;
    const sql = 'DELETE FROM vehiculos_activos WHERE placa = ?';
    
    db.query(sql, [placa.toUpperCase()], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'El vehículo especificado no se encuentra en el área activa.' });
        res.json({ message: 'Vehículo retirado de celdas físicas.' });
    });
});

// ==========================================
// 6. MÓDULO DE RESERVAS
// ==========================================

app.get('/api/vehiculos/reservas', (req, res) => {
    const sql = 'SELECT * FROM reservas_pendientes ORDER BY hora_reserva DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/vehiculos/reservas', (req, res) => {
    const { placa, cedula, correo_usuario, fecha_reserva, hora_reserva_usuario, ubicacion } = req.body;
    
    if (!placa || !cedula || !correo_usuario || !fecha_reserva || !hora_reserva_usuario || !ubicacion) {
        return res.status(400).json({ error: 'Datos de reserva incompletos. Por favor selecciona el sitio, fecha y hora.' });
    }

    const sqlCheckUser = 'SELECT verificado FROM usuarios WHERE correo = ?';
    db.query(sqlCheckUser, [correo_usuario], async (errCheck, userResults) => {
        if (errCheck) return res.status(500).json({ error: errCheck.message });
        if (!userResults || userResults.length === 0) return res.status(404).json({ error: 'El usuario no existe en la plataforma.' });
        
        if (userResults[0].verificado === 0) {
            return res.status(403).json({ error: 'No puedes realizar reservas hasta que confirmes tu cuenta desde el correo de verificación enviado.' });
        }

        // Inserción mapeada con las 5 columnas: placa, cedula, correo_usuario, hora_reserva, ubicacion
        const sql = 'INSERT INTO reservas_pendientes (placa, cedula, correo_usuario, hora_reserva, ubicacion) VALUES (?, ?, ?, ?, ?)';
        const fechaHoraCompleta = `${fecha_reserva} ${hora_reserva_usuario}`;

        db.query(sql, [placa.toUpperCase(), cedula, correo_usuario, fechaHoraCompleta, ubicacion], async (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Este vehículo ya cuenta con una reserva activa.' });
                return res.status(500).json({ error: err.message });
            }

            // Carga útil que contendrá el código QR
            const payloadAcceso = JSON.stringify({
                sistema: 'DI-KING PARKING',
                reserva_id: result.insertId,
                placa: placa.toUpperCase(),
                cedula: cedula,
                ubicacion: ubicacion,
                fecha: fecha_reserva,
                hora: hora_reserva_usuario,
                permiso: 'ENTRADA_SALIDA_VALIDA'
            });

            try {
                // Generación de imagen Base64 del QR
                const qrImageBase64 = await QRCode.toDataURL(payloadAcceso, {
                    color: {
                        dark: '#5d2a7a',  // Morado DI-KING
                        light: '#ffffff'
                    },
                    width: 250
                });

                // Enviar correo electrónico con Nodemailer
                const asuntoEmail = 'Confirmación de Reserva y Pase QR - DI-KING 🚗';
                const mensajeHTML = `
                    <div style="font-family: 'Open Sans', sans-serif; max-width: 550px; border: 1px solid #ddd; padding: 25px; border-radius: 8px; margin: 0 auto; color: #333;">
                        <div style="text-align: center; border-bottom: 2px solid #5d2a7a; padding-bottom: 15px;">
                            <h2 style="color: #5d2a7a; margin: 0;">Reserva Confirmada</h2>
                            <strong style="color: #28a745;">DI-KING PARQUEADEROS</strong>
                        </div>
                        
                        <p style="margin-top: 20px; font-size: 15px;">Tu celda ha sido apartada con éxito. Presenta este <strong>Código QR</strong> en la talanquera para autorizar tu <strong>Ingreso y Salida</strong>:</p>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <img src="${qrImageBase64}" alt="Código QR de Acceso" style="border: 2px solid #5d2a7a; padding: 10px; border-radius: 8px;" />
                            <p style="font-size: 12px; color: #777; margin-top: 5px;">Válido únicamente para el vehículo <strong>${placa.toUpperCase()}</strong></p>
                        </div>

                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #5d2a7a;">
                            <p style="margin: 6px 0;">📍 <strong>Sede:</strong> <span style="color: #5d2a7a; font-weight: bold;">${ubicacion}</span></p>
                            <p style="margin: 6px 0;">📅 <strong>Fecha Programada:</strong> ${fecha_reserva}</p>
                            <p style="margin: 6px 0;">⏰ <strong>Hora Estimada:</strong> ${hora_reserva_usuario}</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
                            <p style="margin: 6px 0;">🚗 <strong>Placa:</strong> ${placa.toUpperCase()}</p>
                            <p style="margin: 6px 0;">🪪 <strong>Cédula:</strong> ${cedula}</p>
                        </div>
                        
                        <p style="font-size: 12px; color: #666; text-align: center; margin-top: 25px;">
                            Conserva este correo o realiza una captura de pantalla del pase QR para acercalo a la cámara de la talanquera.
                        </p>
                    </div>
                `;
                
                enviarAlertaEmail(correo_usuario, asuntoEmail, mensajeHTML);
                res.status(201).json({ message: 'Reserva agendada de forma integral con código QR de acceso.' });

            } catch (qrError) {
                console.error('Error generando QR:', qrError);
                res.status(500).json({ error: 'Reserva creada pero hubo un fallo generando el código QR.' });
            }
        });
    });
});

app.delete('/api/vehiculos/reservas/:placa', (req, res) => {
    const { placa } = req.params;
    const sql = 'DELETE FROM reservas_pendientes WHERE placa = ?';
    db.query(sql, [placa.toUpperCase()], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reserva removida de la lista de espera.' });
    });
});

// ==========================================
// 7. MÓDULO DE RECUPERACIÓN DE CONTRASEÑA
// ==========================================

app.post('/api/usuarios/olvido-contrasena', (req, res) => {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ error: 'Por favor ingresa tu correo electrónico.' });

    const sqlBuscar = 'SELECT * FROM usuarios WHERE correo = ?';
    db.query(sqlBuscar, [correo], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error interno en el servidor.' });
        
        if (!results || results.length === 0) {
            return res.json({ message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación pronto.' });
        }

        const usuario = results[0];
        const tokenReset = crypto.randomBytes(20).toString('hex');
        
        const sqlGuardarToken = 'UPDATE usuarios SET token_confirmacion = ? WHERE id = ?';
        db.query(sqlGuardarToken, [tokenReset, usuario.id], (errUpdate) => {
            if (errUpdate) return res.status(500).json({ error: 'Error al generar la solicitud.' });

            const enlaceReset = `http://172.20.10.4:3000/reset.html?token=${tokenReset}`;

            const asuntoEmail = 'Restablecer contraseña - DI-KING Parqueaderos 🔑';
            const mensajeHTML = `
                <div style="font-family: 'Open Sans', sans-serif; max-width: 500px; border: 1px solid #eee; padding: 25px; border-radius: 8px; margin: 0 auto; color: #333;">
                    <h2 style="color: #5d2a7a; text-align: center;">Recuperación de Contraseña</h2>
                    <p>Hola <strong>${usuario.nombre}</strong>,</p>
                    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en DI-KING.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${enlaceReset}" style="background-color: #5d2a7a; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Restablecer mi Contraseña</a>
                    </div>
                    <p style="font-size: 12px; color: #777; text-align: center;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${enlaceReset}</p>
                </div>
            `;

            enviarAlertaEmail(correo, asuntoEmail, mensajeHTML);
            res.json({ message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación pronto.' });
        });
    });
});

app.post('/api/usuarios/restablecer-contrasena', async (req, res) => {
    const { token, nuevaContrasena } = req.body;
    if (!token || !nuevaContrasena) return res.status(400).json({ error: 'Datos incompletos.' });

    try {
        const sqlBuscar = 'SELECT * FROM usuarios WHERE token_confirmacion = ?';
        db.query(sqlBuscar, [token], async (err, results) => {
            if (err) return res.status(500).json({ error: 'Error interno en el servidor.' });
            if (!results || results.length === 0) return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });

            const usuario = results[0];
            const salt = await bcrypt.genSalt(10);
            const hashNueva = await bcrypt.hash(nuevaContrasena, salt);

            const sqlUpdate = 'UPDATE usuarios SET contrasena = ?, token_confirmacion = NULL WHERE id = ?';
            db.query(sqlUpdate, [hashNueva, usuario.id], (errUp) => {
                if (errUp) return res.status(500).json({ error: 'Error actualizando la contraseña en la base de datos.' });
                res.json({ message: '¡Contraseña actualizada exitosamente! Ya puedes iniciar sesión con tu nueva clave.' });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la encriptación.' });
    }
});

// ==========================================
// 8. ENCENDIDO DEL SERVIDOR UNIVERSAL
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` SERVIDOR DI-KING OPERANDO CON PATRONES DE DISEÑO   `);
    console.log(` Local Localhost: http://172.20.10.4:${PORT}        `);
    console.log(` Estatus Arquitectura: Factory & Abstract Factory OK`);
    console.log(` Flujo de Seguridad: Doble Opt-In (Email) Activado  `);
    console.log(`====================================================`);
});
