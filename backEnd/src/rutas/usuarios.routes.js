import { Router } from "express";
import pool from "../db/db.js";
import bcrypt from "bcrypt"; // Ideal para cifrar contraseñas (asegúrate de tenerlo instalado)

const router = Router();

// =======================
// GET - OBTENER USUARIOS
// =======================
router.get('/usuarios', async (req, res) => {
    try {
        // Ocultamos el password_hash por seguridad al listar
        const result = await pool.query('SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ mensaje: "ERROR AL OBTENER USUARIOS ⚠️" });
    }
});

// =======================
// POST - CREAR USUARIO (Con hash de contraseña)
// =======================
router.post('/usuarios', async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({ 
                mensaje: "El nombre, email y contraseña son obligatorios ⚠️" 
            });
        }

        // Verificar si el email ya existe
        const userExists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ mensaje: "El correo electrónico ya está registrado ❌" });
        }

        // Encriptar la contraseña de forma segura
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO usuarios (nombre, email, password_hash, rol)
             VALUES ($1, $2, $3, $4)
             RETURNING id, nombre, email, rol, creado_en`,
            [nombre, email, password_hash, rol || 'admin']
        );

        res.status(201).json({
            mensaje: "Usuario creado exitosamente 🚀",
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al crear el usuario" });
    }
});

// =======================
// PUT - ACTUALIZAR USUARIO
// =======================
router.put('/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, rol } = req.body;

        if (!nombre || !email) {
            return res.status(400).json({ mensaje: "El nombre y el email son obligatorios ⚠️" });
        }

        const result = await pool.query(
            `UPDATE usuarios 
             SET nombre = $1, email = $2, rol = $3 
             WHERE id = $4 
             RETURNING id, nombre, email, rol, creado_en`,
            [nombre, email, rol || 'admin', id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado ❌" });
        }

        res.json({
            mensaje: "Usuario actualizado correctamente 🚀",
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al actualizar el usuario" });
    }
});

// =======================
// DELETE - ELIMINAR USUARIO
// =======================
router.delete('/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, email, rol`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado ❌" });
        }

        res.json({
            mensaje: "Usuario eliminado correctamente 🗑️",
            usuarioEliminado: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al eliminar el usuario" });
    }
});

// =======================
// POST - LOGIN DE USUARIO
// =======================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                mensaje: "Debes ingresar tu correo y contraseña ⚠️" 
            });
        }

        // 1. Buscar el usuario por email
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ mensaje: "Credenciales incorrectas ❌" });
        }

        const usuario = result.rows[0];

        // 2. Comparar la contraseña ingresada con el hash guardado en DB
        const passwordValido = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordValido) {
            return res.status(401).json({ mensaje: "Credenciales incorrectas ❌" });
        }

        // 3. Respuesta exitosa (ocultamos el password_hash)
        const { password_hash, ...datosUsuario } = usuario;

        res.json({
            mensaje: "¡Bienvenido/a al sistema! 🚀",
            usuario: datosUsuario
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error en el servidor al intentar iniciar sesión" });
    }
});
export default router;