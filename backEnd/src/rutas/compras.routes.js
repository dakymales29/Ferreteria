import { Router } from "express";
import pool from "../db/db.js";

const router = Router();

// =======================
// GET - OBTENER COMPRAS CON SUS DETALLES
// =======================
router.get('/compras', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.numero_compra_dia, 
                c.proveedor, 
                c.total, 
                c.fecha_transaccion,
                json_agg(
                    json_build_object(
                        'producto_id', dc.producto_id,
                        'nombre_producto', p.nombre,
                        'cantidad', dc.cantidad,
                        'precio_unitario', dc.precio_unitario,
                        'subtotal', dc.subtotal
                    )
                ) AS items
            FROM compras c
            LEFT JOIN detalle_compras dc ON c.id = dc.compra_id
            LEFT JOIN productos p ON dc.producto_id = p.id
            GROUP BY c.id
            ORDER BY c.fecha_transaccion DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ mensaje: "ERROR AL OBTENER COMPRAS" });
    }
});

// =======================
// POST - CREAR COMPRA (Suma a stock_actual y actualiza precio_costo)
// =======================
router.post('/compras', async (req, res) => {
    const client = await pool.connect();

    try {
        const { proveedor, total, items } = req.body; 

        if (!items || items.length === 0 || total === undefined) {
            return res.status(400).json({ 
                mensaje: "La compra debe tener un total y al menos un producto ⚠️" 
            });
        }

        await client.query('BEGIN');

        // 1. Calcular automáticamente el número de compra del día
        const countQuery = `
            SELECT COUNT(*) AS total_hoy 
            FROM compras 
            WHERE DATE(fecha_transaccion) = CURRENT_DATE;
        `;
        const countResult = await client.query(countQuery);
        const numero_compra_dia = parseInt(countResult.rows[0].total_hoy) + 1;

        // 2. Insertar cabecera
        const compraQuery = `
            INSERT INTO compras (numero_compra_dia, usuario_id, proveedor, total)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const compraResult = await client.query(compraQuery, [
            numero_compra_dia, 
            null, // usuario_id opcional
            proveedor || 'Proveedor General', 
            total
        ]);
        const compraId = compraResult.rows[0].id;

        // 3. Insertar detalles y actualizar productos
        for (const item of items) {
            const { producto_id, cantidad, precio_unitario, subtotal } = item;

            await client.query(
                `INSERT INTO detalle_compras (compra_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [compraId, producto_id, cantidad, precio_unitario, subtotal || (cantidad * precio_unitario)]
            );

            // Suma a stock_actual y actualiza precio_costo
            await client.query(
                `UPDATE productos 
                 SET stock_actual = stock_actual + $1, precio_costo = $2 
                 WHERE id = $3`,
                [cantidad, precio_unitario, producto_id]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: "Compra registrada correctamente y stock actualizado 🚀",
            compra_id: compraId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("ERROR EN POST /compras:", error);
        res.status(500).json({ mensaje: "Error al registrar la compra" });
    } finally {
        client.release();
    }
});

// =======================
// PUT - ACTUALIZAR COMPRA (Cabecera)
// =======================
router.put('/compras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { proveedor, total } = req.body;

        if (total === undefined) {
            return res.status(400).json({ mensaje: "El total es obligatorio para actualizar ⚠️" });
        }

        const result = await pool.query(
            `UPDATE compras 
             SET proveedor = $1, total = $2 
             WHERE id = $3 
             RETURNING *`,
            [proveedor, total, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Compra no encontrada ❌" });
        }

        res.json({
            mensaje: "Compra actualizada correctamente 🚀",
            compra: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al actualizar la compra" });
    }
});

// =======================
// DELETE - ELIMINAR COMPRA Y REVERTIR STOCK (stock_actual)
// =======================
router.delete('/compras/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        const detalleResult = await client.query(
            `SELECT producto_id, cantidad FROM detalle_compras WHERE compra_id = $1`,
            [id]
        );

        if (detalleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: "Compra no encontrada ❌" });
        }

        for (const item of detalleResult.rows) {
            await client.query(
                `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
                [item.cantidad, item.producto_id]
            );
        }

        await client.query(`DELETE FROM detalle_compras WHERE compra_id = $1`, [id]);
        const compraDelete = await client.query(`DELETE FROM compras WHERE id = $1 RETURNING *`, [id]);

        await client.query('COMMIT');

        res.json({
            mensaje: "Compra eliminada y stock revertido correctamente 🗑️🔄",
            compraEliminada: compraDelete.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ mensaje: "Error al eliminar la compra" });
    } finally {
        client.release();
    }
});

export default router;