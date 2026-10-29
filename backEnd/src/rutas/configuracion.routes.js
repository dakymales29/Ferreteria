import { Router } from "express";
import pool from "../db/db.js";

const router = Router();

// =======================
// GET - OBTENER CONFIGURACIÓN
// =======================
router.get('/configuracion', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM configuracion LIMIT 1');
        
        // Si existe un registro, nos aseguramos de enviar stock_minimo_global listo para el frontend
        const config = result.rows[0] || {};
        
        res.json(config);
    } catch (error) {
        console.error("Error al obtener configuración:", error);
        res.status(500).json({ mensaje: "Error al obtener la configuración ⚠️" });
    }
});

// =======================
// PUT - ACTUALIZAR CONFIGURACIÓN
// =======================
router.put('/configuracion', async (req, res) => {
    try {
        const { nombre_negocio, porcentaje_iva, moneda, stock_minimo_global } = req.body;

        if (!nombre_negocio) {
            return res.status(400).json({ mensaje: "El nombre del negocio es obligatorio ⚠️" });
        }

        // Convertimos a número el stock mínimo global para evitar problemas en la BD
        const stockMinimo = parseInt(stock_minimo_global ?? 1);

        const result = await pool.query(
            `UPDATE configuracion 
             SET nombre_negocio = $1, porcentaje_iva = $2, moneda = $3, stock_minimo_global = $4 
             WHERE id = 1 
             RETURNING *`,
            [nombre_negocio, porcentaje_iva, moneda, stockMinimo]
        );

        if (result.rows.length === 0) {
            const insertResult = await pool.query(
                `INSERT INTO configuracion (id, nombre_negocio, porcentaje_iva, moneda, stock_minimo_global) 
                 VALUES (1, $1, $2, $3, $4) 
                 RETURNING *`,
                [nombre_negocio, porcentaje_iva, moneda, stockMinimo]
            );
            return res.status(201).json({
                mensaje: "Configuración creada correctamente 🚀",
                configuracion: insertResult.rows[0]
            });
        }

        res.json({
            mensaje: "Configuración actualizada correctamente 🚀",
            configuracion: result.rows[0]
        });

    } catch (error) {
        console.error("Error al actualizar configuración:", error);
        res.status(500).json({ mensaje: "Error al actualizar la configuración" });
    }
});

export default router;